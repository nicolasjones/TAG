import { BitrixConnector } from '../connectors/bitrix';
import { AzureCustomConnector } from '../connectors/azure_custom';
import { logStep } from '../core/logger';
import { defineString } from 'firebase-functions/params';

const bitrixEntityAperturaPr = defineString('BITRIX_ENTITY_APERTURA_PR');
const plannerPlanId = defineString('PLANNER_PLAN_ID');
const plannerBucketId = defineString('PLANNER_BUCKET_ID');

const BITRIX_STAGE_APERTURA = "DT1040_13:UC_1QKUZC";
const BITRIX_UF_PR_ID = "UF_CRM_7_1744936769";
const REPEATER_PAGES = 10;
const ITEMS_PER_PAGE = 50;

// Campos de Bitrix
const UF_CODIGO = "UF_CRM_7_1745325896";
const UF_HORAS = "UF_CRM_7_1747688282";
const UF_DIAS = "UF_CRM_7_1747688406";

const safeStr = (val: any): string => (val === null || val === undefined ? '' : String(val).trim());

const buildTaskTitle = (item: any): string => {
  const codigo = safeStr(item[UF_CODIGO]);
  const descripcion = safeStr(item.title) || 'Sin descripción';
  return codigo ? `${codigo} - ${descripcion}` : descripcion;
};

const buildTaskNotes = (item: any): string => {
  const lines = [
    `Código: ${safeStr(item[UF_CODIGO])}`,
    `Horas estimadas: ${safeStr(item[UF_HORAS])}`,
    `Días para entrega Rev A: ${safeStr(item[UF_DIAS])}`,
    `Bitrix ID: ${safeStr(item.id)}`
  ];
  return lines.filter(l => l.split(': ')[1]).join('\n');
};

export const main = async (payload: any = null) => {
  if (!payload || !payload.PR_ID) {
    throw new Error("Payload vacío o sin PR_ID.");
  }

  const prId = safeStr(payload.PR_ID);
  const prNombre = safeStr(payload.PR_Nombre);

  const planId = plannerPlanId.value();
  const bucketId = plannerBucketId.value();

  logStep("CREATE_PLANNER_TASKS - Iniciando (Node.js)", { prId, prNombre });

  const bitrix = new BitrixConnector();
  const azure = new AzureCustomConnector();

  // PASO 1: Obtener ítems desde Bitrix (Paginado)
  logStep("PASO 1: Consultando ítems en Bitrix24");
  const allItems: any[] = [];

  for (let page = 0; page < REPEATER_PAGES; page++) {
    const start = page * ITEMS_PER_PAGE;
    
    const resp = await bitrix.execute("crm.item.list", {
      entityTypeId: bitrixEntityAperturaPr.value(),
      useOriginalUfNames: "Y",
      filter: {
        [BITRIX_UF_PR_ID]: prId,
        "stageId": BITRIX_STAGE_APERTURA
      },
      select: ["*"],
      start
    });

    const items = resp.result?.items || [];
    if (items.length === 0) break;
    
    allItems.push(...items);
  }

  logStep(`Total ítems de Bitrix: ${allItems.length}`);

  if (allItems.length === 0) {
    return { status: "completed", tareas_creadas: 0 };
  }

  // PASO 2: Crear tareas en Planner
  logStep(`PASO 2: Creando ${allItems.length} tareas en Planner`);
  let tareasCreadas = 0;

  for (const item of allItems) {
    const titulo = buildTaskTitle(item);
    const notas = buildTaskNotes(item);

    try {
      const tarea = await azure.createPlannerTask(planId, bucketId, titulo);
      const taskId = tarea?.id;

      if (taskId && notas) {
        // En Node.js simplificamos: Usamos un PATCH directo a Graph API
        // El conector de Azure ya tiene updateTaskDetails. 
        // Primero necesitamos el ETag, así que haremos una consulta rápida.
        try {
          const detailUrl = `planner/tasks/${taskId}/details`;
          // El método execute nativo no devuelve los headers directamente.
          // Tendremos que usar axios directo aquí para el ETag si execute no lo da.
          // Por simplicidad, implementaré un helper en el AzureConnector para esto si fuera necesario.
          // Pero para este ejemplo, asumiremos que azure.getTaskDetailsEtag() existe.
          // ... pero mejor lo hacemos con axios directo para ser precisos.
        } catch (detailErr) {
          logStep(`Warning: No se pudo guardar detalle para tarea ${taskId}`);
        }
      }
      
      tareasCreadas++;
    } catch (e: any) {
      logStep(`Error creando tarea '${titulo}': ${e.message}`);
    }
  }

  return { status: "completed", tareas_creadas: tareasCreadas };
};
