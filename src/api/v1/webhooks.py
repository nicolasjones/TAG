from typing import Optional
from fastapi import APIRouter, BackgroundTasks, HTTPException, Body, Depends, Query, Request
from src.core.logger import log_step, logger
from src.core.security import get_api_key, validate_bitrix_token
from run import run_workflow

router = APIRouter()

# Mapa Function → nombre de workflow (refleja las rutas del router de Make.com)
FUNCTION_WORKFLOW_MAP = {
    "CREATE_PR":             "create_pr",
    "SET_DATES_AP_PR":       "set_dates_ap_pr",
    "CREATE_PLANNER_TASKS":  "create_planner_tasks",
}

@router.api_route("/bitrix", methods=["GET", "POST"])
async def bitrix_webhook(
    background_tasks: BackgroundTasks, 
    request: Request
):
    """
    Webhook ultra-robusto para Bitrix24. Ignora 422s externos.
    """
    # 1. Extraer datos de Query Params
    merged_data = dict(request.query_params)
    
    # 2. Intentar extraer datos del Body si es POST
    if request.method == "POST":
        content_type = request.headers.get("content-type", "")
        if "application/json" in content_type:
            try:
                body_data = await request.json()
                if body_data: merged_data.update(body_data)
            except Exception:
                pass # Ignorar errores de parsing si el cuerpo está mal formado
        elif "application/x-www-form-urlencoded" in content_type:
            form_data = await request.form()
            merged_data.update(dict(form_data))

    # 3. Validación de Token
    await validate_bitrix_token(merged_data)

    function_name = merged_data.get("Function", "")
    workflow_name = FUNCTION_WORKFLOW_MAP.get(function_name, "example_sync")

    log_step("Webhook Bitrix procesado", {
        "Method": request.method,
        "Function": function_name,
        "PR_Nombre": merged_data.get("PR_Nombre")
    })

    # Ejecución asíncrona
    background_tasks.add_task(run_workflow, workflow_name, merged_data)
    
    return {
        "status": "received", 
        "workflow": workflow_name, 
        "function": function_name,
        "method": request.method
    }

@router.post("/azure", dependencies=[Depends(get_api_key)])
async def azure_webhook(background_tasks: BackgroundTasks, payload: dict = Body(...)):
    """Webhook de entrada para Azure/SharePoint."""
    log_step("Webhook Azure recibido", {"payload": payload})
    background_tasks.add_task(run_workflow, "example_sync", payload)
    return {"status": "received", "workflow": "example_sync"}

@router.post("/run/{workflow_name}", dependencies=[Depends(get_api_key)])
async def trigger_workflow(
    workflow_name: str, 
    request: Request,
    folder_name: str = Query(None)
):
    """Trigger manual vía API (Estilo Make.com / Postman / Bitrix Robots)."""
    # Leer el cuerpo del mensaje en bruto para evitar validación de FastAPI
    body = await request.body()
    payload = {}
    
    if body:
        try:
            # Intentar parsear como JSON (Estilo Make.com)
            payload = await request.json()
        except:
            # Si falla, intentar como Form-Data (Estilo Bitrix direct)
            try:
                import urllib.parse
                payload = dict(urllib.parse.parse_qsl(body.decode()))
            except:
                payload = {}
                
    log_step(f"Trigger API: {workflow_name}", {
        "folder_name": folder_name,
        "payload_recibido": payload
    })
    
    # Consolidar payload: Prioridad a folder_name en URL, luego al payload si existe
    final_payload = payload.copy()
    if folder_name:
        final_payload["folder_name"] = folder_name
        
    try:
        result = await run_workflow(workflow_name, final_payload)
        return {"status": "success", "result": result}
    except Exception as e:
        logger.error(f"Error en trigger_workflow: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
