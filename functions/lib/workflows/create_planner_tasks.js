"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = void 0;
const bitrix_1 = require("../connectors/bitrix");
const azure_custom_1 = require("../connectors/azure_custom");
const logger_1 = require("../core/logger");
const params_1 = require("firebase-functions/params");
const bitrixEntityAperturaPr = (0, params_1.defineString)('BITRIX_ENTITY_APERTURA_PR');
const plannerPlanId = (0, params_1.defineString)('PLANNER_PLAN_ID');
const plannerBucketId = (0, params_1.defineString)('PLANNER_BUCKET_ID');
const BITRIX_STAGE_APERTURA = "DT1040_13:UC_1QKUZC";
const BITRIX_UF_PR_ID = "UF_CRM_7_1744936769";
const REPEATER_PAGES = 10;
const ITEMS_PER_PAGE = 50;
const UF_CODIGO = "UF_CRM_7_1745325896";
const UF_HORAS = "UF_CRM_7_1747688282";
const UF_DIAS = "UF_CRM_7_1747688406";
const safeStr = (val) => (val === null || val === undefined ? '' : String(val).trim());
const buildTaskTitle = (item) => {
    const codigo = safeStr(item[UF_CODIGO]);
    const descripcion = safeStr(item.title) || 'Sin descripción';
    return codigo ? `${codigo} - ${descripcion}` : descripcion;
};
const buildTaskNotes = (item) => {
    const lines = [
        `Código: ${safeStr(item[UF_CODIGO])}`,
        `Horas estimadas: ${safeStr(item[UF_HORAS])}`,
        `Días para entrega Rev A: ${safeStr(item[UF_DIAS])}`,
        `Bitrix ID: ${safeStr(item.id)}`
    ];
    return lines.filter(l => l.split(': ')[1]).join('\n');
};
const main = async (payload = null) => {
    if (!payload || !payload.PR_ID) {
        throw new Error("Payload vacío o sin PR_ID.");
    }
    const prId = safeStr(payload.PR_ID);
    const prNombre = safeStr(payload.PR_Nombre);
    const planId = plannerPlanId.value();
    const bucketId = plannerBucketId.value();
    (0, logger_1.logStep)("CREATE_PLANNER_TASKS - Iniciando (Node.js)", { prId, prNombre });
    const bitrix = new bitrix_1.BitrixConnector();
    const azure = new azure_custom_1.AzureCustomConnector();
    (0, logger_1.logStep)("PASO 1: Consultando ítems en Bitrix24");
    const allItems = [];
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
        if (items.length === 0)
            break;
        allItems.push(...items);
    }
    (0, logger_1.logStep)(`Total ítems de Bitrix: ${allItems.length}`);
    if (allItems.length === 0) {
        return { status: "completed", tareas_creadas: 0 };
    }
    (0, logger_1.logStep)(`PASO 2: Creando ${allItems.length} tareas en Planner`);
    let tareasCreadas = 0;
    for (const item of allItems) {
        const titulo = buildTaskTitle(item);
        const notas = buildTaskNotes(item);
        try {
            const tarea = await azure.createPlannerTask(planId, bucketId, titulo);
            const taskId = tarea?.id;
            if (taskId && notas) {
                try {
                    const detailUrl = `planner/tasks/${taskId}/details`;
                }
                catch (detailErr) {
                    (0, logger_1.logStep)(`Warning: No se pudo guardar detalle para tarea ${taskId}`);
                }
            }
            tareasCreadas++;
        }
        catch (e) {
            (0, logger_1.logStep)(`Error creando tarea '${titulo}': ${e.message}`);
        }
    }
    return { status: "completed", tareas_creadas: tareasCreadas };
};
exports.main = main;
//# sourceMappingURL=create_planner_tasks.js.map