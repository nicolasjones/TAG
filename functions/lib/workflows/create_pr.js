"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = void 0;
const bitrix_1 = require("../connectors/bitrix");
const azure_custom_1 = require("../connectors/azure_custom");
const logger_1 = require("../core/logger");
const params_1 = require("firebase-functions/params");
const exceljs_1 = __importDefault(require("exceljs"));
const bitrixEntityAperturaPr = (0, params_1.defineString)('BITRIX_ENTITY_APERTURA_PR');
const sharepointPrDriveId = (0, params_1.defineString)('SHAREPOINT_PR_DRIVE_ID');
const sharepointPrRoot = (0, params_1.defineString)('SHAREPOINT_PR_ROOT');
const sharepointTemplatePrPath = (0, params_1.defineString)('SHAREPOINT_TEMPLATE_PR_PATH');
const plannerPlanId = (0, params_1.defineString)('PLANNER_PLAN_ID');
const plannerBucketId = (0, params_1.defineString)('PLANNER_BUCKET_ID');
const BITRIX_STAGE_APERTURA = "DT1040_13:UC_1QKUZC";
const BITRIX_UF_PR_ID = "UF_CRM_7_1744936769";
const REPEATER_PAGES = 10;
const ITEMS_PER_PAGE = 50;
const APERTURA_HEADER_ROW = 4;
const TIPO_REVISION_MAP = { 69: "LETRA", 71: "NÚMERO", 73: "CO", 75: "PID" };
const LINEA_CONTRATO_MAP = {
    77: "ESTANDAR", 79: "HORA ESPECIAL", 81: "RASTREO M2", 83: "DIA DE RASTREO", 85: "TRABAJO ESPECIAL (FACTURA)"
};
const TIPO_INGENIERIA_EXCEL_MAP = {
    "BASICA": "INGENIERÍA BÁSICA",
    "BÁSICA": "INGENIERÍA BÁSICA",
    "DETALLE": "INGENIERÍA DE DETALLE",
    "CONCEPTUAL": "INGENIERÍA CONCEPTUAL",
    "CONFORME A OBRA": "INGENIERÍA CONFORME OBRA"
};
const safeStr = (v) => (v === null || v === undefined ? "" : String(v).trim());
async function fillPlaceholders(workbook, payload) {
    const mapping = {
        "{{NOMBRE_PR}}": payload.PR_Nombre,
        "{{REVISIÓN_PR}}": payload.PR_Revisión,
        "{{DENOMINACIÓN}}": payload.PR_Denominación,
        "{{NRO_DE_CAMBIO}}": payload.PR_NroDeCambio,
        "{{LIDER_EMPRESA}}": payload.PR_LiderEmpresa,
        "{{COMPLEJO}}": payload.PR_Complejo,
        "{{LIDER_YPF}}": payload.PR_LiderYPF,
        "{{AREA}}": payload.PR_Area,
        "{{OT_PEP}}": payload.PR_OT_PEP,
        "{{UNIDAD}}": payload.PR_Unidad,
        "{{OTI_EMPRESA}}": payload.PR_OTI_EMPRESA,
        "{{FECHA_INI_PR}}": payload.PR_FECHA_INI,
        "{{TIPO_INGENIERIA}}": payload.PR_TipoIngenieria,
        "{{DESCRIPCIÓN_TAREAS}}": payload.PR_DescripciónTareas,
        "{{PR_FECHA_APROB}}": payload.PR_FECHA_APROB,
    };
    workbook.eachSheet(sheet => {
        sheet.eachRow(row => {
            row.eachCell(cell => {
                if (cell.value && typeof cell.value === 'string' && cell.value.includes('{{')) {
                    let newValue = cell.value;
                    for (const [placeholder, value] of Object.entries(mapping)) {
                        newValue = newValue.replace(placeholder, safeStr(value));
                    }
                    cell.value = newValue;
                }
            });
        });
    });
}
const main = async (payload = null) => {
    if (!payload || (!payload.PR_Nombre && !payload.PR_ID)) {
        throw new Error("Payload sin nombre o ID de PR.");
    }
    const prNombre = safeStr(payload.PR_Nombre || "");
    const bitrix = new bitrix_1.BitrixConnector();
    const azure = new azure_custom_1.AzureCustomConnector();
    (0, logger_1.logStep)(`CREATE_PR - Buscando PR '${prNombre}'`);
    const findResp = await bitrix.execute("crm.item.list", {
        entityTypeId: 1096,
        filter: { title: prNombre },
        select: ["id", "title"]
    });
    const items = findResp.result?.items || [];
    if (items.length === 0)
        throw new Error(`No se encontró PR '${prNombre}'`);
    const prId = items[0].id;
    const prResp = await bitrix.execute("crm.item.get", { entityTypeId: 1096, id: prId });
    const prData = prResp.result?.item;
    const fetchedPayload = {
        PR_Nombre: prData.title,
        PR_Denominación: safeStr(prData.ufCrm33_1747675458),
        PR_OT_PEP: safeStr(prData.ufCrm33_1747676129),
        PR_Revisión: safeStr(prData.ufCrm33_1747675500 || "0"),
        PR_NroDeCambio: safeStr(prData.ufCrm33_1747751597),
        PR_Complejo: "QLP",
        PR_OTI_EMPRESA: safeStr(prData.ufCrm33_1747676167),
        PR_DescripciónTareas: safeStr(prData.ufCrm33_1747676308),
        PR_TipoIngenieria: "INGENIERÍA BÁSICA"
    };
    Object.assign(payload, fetchedPayload);
    const driveId = sharepointPrDriveId.value();
    const prRoot = sharepointPrRoot.value();
    const folderName = prNombre.replace(/[\/\\:]/g, '-');
    const folderPath = `${prRoot}/${folderName}`;
    await azure.createFolder(driveId, prRoot, folderName);
    const templateBytes = await azure.execute("GET", `drives/${driveId}/root:/${sharepointTemplatePrPath.value()}:/content`);
    const workbook = new exceljs_1.default.Workbook();
    await workbook.xlsx.load(templateBytes);
    await fillPlaceholders(workbook, payload);
    const allItems = [];
    for (let page = 0; page < REPEATER_PAGES; page++) {
        const resp = await bitrix.execute("crm.item.list", {
            entityTypeId: bitrixEntityAperturaPr.value(),
            filter: { [BITRIX_UF_PR_ID]: prId, stageId: BITRIX_STAGE_APERTURA },
            start: page * ITEMS_PER_PAGE
        });
        const pageItems = resp.result?.items || [];
        if (pageItems.length === 0)
            break;
        allItems.push(...pageItems);
    }
    const ws = workbook.getWorksheet("APERTURA DE PR");
    if (ws) {
        allItems.forEach((item, globalIdx) => {
            const page = Math.floor(globalIdx / ITEMS_PER_PAGE);
            const idxInPage = (globalIdx % ITEMS_PER_PAGE) + 1;
            const rowNum = APERTURA_HEADER_ROW + (page * ITEMS_PER_PAGE) + idxInPage;
            const row = ws.getRow(rowNum);
            row.getCell(1).value = `${payload.PR_TipoIngenieria} - ${safeStr(item.UF_CRM_7_1745325896)}`;
            row.getCell(5).value = safeStr(item.UF_CRM_7_1745325896);
            row.getCell(7).value = safeStr(item.UF_CRM_7_1747688168);
            row.getCell(9).value = safeStr(item.title);
            row.getCell(10).value = Number(item.UF_CRM_7_1747688282 || 0);
            row.commit();
        });
    }
    const outputBuffer = await workbook.xlsx.writeBuffer();
    await azure.uploadFile(driveId, folderPath, `${folderName}.xlsx`, Buffer.from(outputBuffer));
    return {
        status: "completed",
        prNombre,
        totalItems: allItems.length,
        sharepoint: `${folderPath}/${folderName}.xlsx`
    };
};
exports.main = main;
//# sourceMappingURL=create_pr.js.map