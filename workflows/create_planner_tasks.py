"""
Workflow: CREATE_PLANNER_TASKS
===============================
Crea tareas en Microsoft Planner para cada ítem de un PR en Bitrix24.

Este es un flujo INDEPENDIENTE del CREATE_PR — no modifica el flujo existente.
Es invocado desde Make.com como una ruta nueva en el mismo escenario, o bien
directamente desde cualquier sistema vía el endpoint /v1/webhooks/bitrix
con Function="CREATE_PLANNER_TASKS".

Flujo:
  1. Recibe payload con los datos del PR (mismo formato que CREATE_PR).
  2. Consulta Bitrix24 (crm.item.list) para obtener todos los ítems del PR,
     con el mismo loop paginado de 10 páginas × 50 ítems.
  3. Para cada ítem, crea una tarea en Microsoft Planner usando el Plan y
     Bucket configurados en settings (PLANNER_PLAN_ID / PLANNER_BUCKET_ID).
  4. Respeta todos los guardrails de seguridad del AzureCustomConnector:
     - planId y bucketId deben coincidir exactamente con los configurados.
     - No se permite navegar grupos/sitios fuera del flujo de trabajo.

Restricciones de seguridad:
  - PLANNER_PLAN_ID y PLANNER_BUCKET_ID deben estar definidos en .env.
  - Si no están configurados, el workflow falla con error explicativo.
  - El AzureCustomConnector valida los IDs en cada llamada (no se pueden
    sobreescribir desde el payload).

Payload esperado (enviado por Bitrix24 o Make.com):
  {
      "Function":          "CREATE_PLANNER_TASKS",
      "PR_Nombre":         "PR2025-0001",
      "PR_ID":             "123"
  }
"""

from src.connectors.bitrix import BitrixConnector
from src.connectors.azure_custom import AzureCustomConnector
from src.core.config import settings
from src.core.logger import log_step, logger

# ─── Constantes (igual que create_pr.py) ─────────────────────────────────────
BITRIX_STAGE_APERTURA = "DT1040_13:UC_1QKUZC"
BITRIX_UF_PR_ID       = "UF_CRM_7_1744936769"
REPEATER_PAGES        = 10
ITEMS_PER_PAGE        = 50

# Campos de Bitrix para construir el título de la tarea
UF_CODIGO    = "UF_CRM_7_1745325896"   # Código del documento
UF_HORAS     = "UF_CRM_7_1747688282"   # Horas totales
UF_DIAS      = "UF_CRM_7_1747688406"   # Días para entrega Rev A


def _safe_str(value) -> str:
    """Convierte cualquier valor a string limpio."""
    if value is None:
        return ""
    return str(value).strip()


def _build_task_title(item: dict) -> str:
    """
    Construye el título de la tarea de Planner a partir de los campos del ítem.
    Formato: '{CÓDIGO} - {DESCRIPCIÓN}'
    Si no hay código, usa solo la descripción (title).
    """
    codigo     = _safe_str(item.get(UF_CODIGO, ""))
    descripcion = _safe_str(item.get("title", "Sin descripción"))
    return f"{codigo} - {descripcion}" if codigo else descripcion


def _build_task_notes(item: dict) -> str:
    """
    Construye las notas/descripción de la tarea con la información relevante
    del ítem de Bitrix, para añadirla como detalle en Planner.
    """
    codigo   = _safe_str(item.get(UF_CODIGO, ""))
    horas    = _safe_str(item.get(UF_HORAS, ""))
    dias     = _safe_str(item.get(UF_DIAS, ""))
    bid      = _safe_str(item.get("id", ""))

    lines = [
        f"Código: {codigo}",
    ]
    if horas:
        lines.append(f"Horas estimadas: {horas}")
    if dias:
        lines.append(f"Días para entrega Rev A: {dias}")
    if bid:
        lines.append(f"Bitrix ID: {bid}")

    return "\n".join(lines)


# ─── Flujo principal ─────────────────────────────────────────────────────────

async def main(payload: dict = None):
    """
    Punto de entrada del workflow CREATE_PLANNER_TASKS.

    Payload esperado:
    {
        "Function":          "CREATE_PLANNER_TASKS",
        "PR_Nombre":         "PR2025-0001",
        "PR_ID":             "123"
    }
    """
    if not payload:
        raise ValueError("Payload vacío — se requieren los datos del PR.")

    pr_id           = _safe_str(payload.get("PR_ID", ""))
    pr_nombre       = _safe_str(payload.get("PR_Nombre", ""))

    if not pr_id:
        raise ValueError("Falta PR_ID en el payload.")

    # ── Validación de seguridad: Plan y Bucket deben estar configurados ───────
    # No se toman del payload — siempre desde settings (guardrail crítico).
    plan_id   = getattr(settings, "PLANNER_PLAN_ID", None)
    bucket_id = getattr(settings, "PLANNER_BUCKET_ID", None)

    if not plan_id or not bucket_id:
        raise PermissionError(
            "Seguridad: PLANNER_PLAN_ID y PLANNER_BUCKET_ID deben estar "
            "configurados en el servidor (.env). No se aceptan IDs desde el payload."
        )

    log_step("CREATE_PLANNER_TASKS ── Iniciando", {
        "PR_ID":    pr_id,
        "PR_Nombre": pr_nombre,
        "plan_id":  plan_id,
        "bucket_id": bucket_id,
    })

    bitrix = BitrixConnector()
    azure  = AzureCustomConnector()

    # ── PASO 1: Loop paginado — obtener ítems del PR desde Bitrix ─────────
    log_step("PASO 1: Consultando ítems en Bitrix24")
    all_items = []

    for page in range(REPEATER_PAGES):
        start = page * ITEMS_PER_PAGE
        log_step(f"  Página {page} (start={start})")

        resp = await bitrix.execute("crm.item.list", {
            "entityTypeId":       settings.BITRIX_ENTITY_APERTURA_PR,
            "useOriginalUfNames": "Y",
            "filter": {
                BITRIX_UF_PR_ID: pr_id,
                "stageId":       BITRIX_STAGE_APERTURA,
            },
            "select": ["*"],
            "start": start,
        })

        items = resp.get("result", {}).get("items", [])
        log_step(f"  Ítems recibidos: {len(items)}")

        if not items:
            log_step(f"  Página {page} vacía — deteniendo loop")
            break

        all_items.extend(items)

    log_step(f"Total ítems de Bitrix: {len(all_items)}")

    if not all_items:
        log_step("Sin ítems para crear tareas — flujo finalizado")
        return {
            "status":   "completed",
            "pr_id":    pr_id,
            "pr_nombre": pr_nombre,
            "tareas_creadas": 0,
            "mensaje":  "No se encontraron ítems en la etapa de Apertura PR.",
        }

    # ── PASO 2: Crear tarea en Planner por cada ítem ──────────────────────
    # Los IDs de Plan y Bucket vienen de settings — el AzureCustomConnector
    # los valida internamente también, aplicando doble guardrail.
    log_step(f"PASO 2: Creando {len(all_items)} tareas en Planner")

    tareas_creadas = 0
    errores = []

    for idx, item in enumerate(all_items, start=1):
        titulo = _build_task_title(item)
        notas  = _build_task_notes(item)

        try:
            tarea = await azure.create_planner_task(
                plan_id=plan_id,
                bucket_id=bucket_id,
                title=titulo,
            )
            task_id = tarea.get("id", "") if tarea else ""

            # Si se obtuvo un ID, guardar las notas como detalle de la tarea
            if task_id and notas:
                try:
                    # Obtener ETag del detalle (necesario para PATCH)
                    import httpx
                    token = await azure._get_access_token()
                    detail_url = f"https://graph.microsoft.com/v1.0/planner/tasks/{task_id}/details"
                    async with httpx.AsyncClient() as client:
                        detail_resp = await client.get(
                            detail_url,
                            headers={"Authorization": f"Bearer {token}"}
                        )
                        detail_resp.raise_for_status()
                        etag = detail_resp.headers.get("ETag", "")

                    if etag:
                        await azure.update_task_details(task_id, notas, etag)
                        log_step(f"  [{idx}] Detalle guardado para tarea {task_id}")
                except Exception as detail_err:
                    # El detalle es opcional — no interrumpimos por este error
                    logger.warning(f"  [{idx}] No se pudo guardar detalle de tarea: {detail_err}")

            tareas_creadas += 1
            log_step(f"  [{idx}/{len(all_items)}] Tarea creada: {titulo}")

        except Exception as e:
            logger.error(f"  [{idx}] Error creando tarea '{titulo}': {e}")
            errores.append({"item": titulo, "error": str(e)})

    # ─────────────────────────────────────────────────────────────────────
    log_step("CREATE_PLANNER_TASKS ── Completado", {
        "pr_nombre":      pr_nombre,
        "tareas_creadas": tareas_creadas,
        "errores":        len(errores),
    })

    return {
        "status":         "completed",
        "pr_id":          pr_id,
        "pr_nombre":      pr_nombre,
        "tareas_creadas": tareas_creadas,
        "errores":        errores,
    }
