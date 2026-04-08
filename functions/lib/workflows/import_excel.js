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
const path_1 = __importDefault(require("path"));
const sharepointDriveId = (0, params_1.defineString)('SHAREPOINT_DRIVE_ID');
const bitrixEntityAperturaPr = (0, params_1.defineString)('BITRIX_ENTITY_APERTURA_PR');
const SPECIALTY_SPA_MAP = {
    "ELECTRICIDAD": 1058,
    "PIPING": 1054,
    "PROCESOS": 1088,
    "MECÁNICA": 1092,
    "INSTRUMENTOS": 1066,
    "ESCÁN_LASER": 1072,
    "ESTUDIOS_ESP": 1076,
    "ARQUITECTURA": 1048
};
const getEntityBitrixId = (entityTypeId, itemId) => `T${entityTypeId.toString(16).toUpperCase()}_${itemId}`;
const getEnvParam = (param, key) => {
    try {
        return param.value() || process.env[key];
    }
    catch {
        return process.env[key];
    }
};
async function findEntityId(bitrix, entityTypeId, title) {
    const res = await bitrix.execute("crm.item.list", {
        entityTypeId,
        filter: { title }
    });
    return res.result?.items?.[0]?.id || null;
}
const main = async (payload = null) => {
    const fileName = payload?.file_name || "OTI-2385-26.xlsm";
    const folderPath = payload?.folder_path || "Bitrix/Bitrix Export";
    const onlyFirstVisible = payload?.only_first_visible ?? true;
    (0, logger_1.logStep)(`Iniciando Importación Excel a Bitrix: ${fileName}`);
    const azure = new azure_custom_1.AzureCustomConnector();
    const bitrix = new bitrix_1.BitrixConnector();
    const driveId = getEnvParam(sharepointDriveId, 'SHAREPOINT_DRIVE_ID');
    const content = await azure.execute("GET", `drives/${driveId}/root:/${folderPath}/${fileName}:/content`);
    const workbook = new exceljs_1.default.Workbook();
    await workbook.xlsx.load(content);
    const sheetAnexo = workbook.getWorksheet("ANEXO 2");
    const sheetPres = workbook.getWorksheet("Presupuesto");
    if (!sheetAnexo || !sheetPres) {
        throw new Error("No se encontraron las hojas ANEXO 2 o Presupuesto");
    }
    const presData = {};
    sheetPres.eachRow((row, rowNumber) => {
        if (rowNumber < 7)
            return;
        const code = row.getCell(2).text.trim();
        const qty = row.getCell(1).value;
        if (code)
            presData[code] = qty;
    });
    const prTitle = path_1.default.parse(fileName).name;
    const prEntityId = await findEntityId(bitrix, 1096, prTitle);
    const prLink = prEntityId ? getEntityBitrixId(1096, prEntityId) : prTitle;
    const entityTypeId = Number(getEnvParam(bitrixEntityAperturaPr, 'BITRIX_ENTITY_APERTURA_PR'));
    const STAGE_APROBADO = "DT1040_13:UC_A0X4JS";
    const CATEGORY_ID = 13;
    let processedCount = 0;
    for (let i = 4; i <= sheetAnexo.rowCount; i++) {
        const row = sheetAnexo.getRow(i);
        if (row.hidden)
            continue;
        const codigo = row.getCell(1).text.trim();
        if (!codigo || codigo.toLowerCase() === "código")
            continue;
        const especialidadText = row.getCell(2).text.toUpperCase();
        const nombreDoc = row.getCell(7).text;
        const unMedida = row.getCell(9).text.toUpperCase();
        let docLink = codigo;
        const specSpaId = SPECIALTY_SPA_MAP[especialidadText];
        if (specSpaId) {
            const foundId = await findEntityId(bitrix, specSpaId, codigo);
            if (foundId)
                docLink = getEntityBitrixId(specSpaId, foundId);
        }
        const cantidadCrear = presData[codigo] || 1;
        const despliegueHojas = unMedida.includes("HOJA") ? "Y" : "N";
        const fields = {
            title: codigo,
            stageId: STAGE_APROBADO,
            categoryId: CATEGORY_ID,
            ufCrm7_1744936769: prLink,
            ufCrm7_1745325896: codigo,
            ufCrm7_1745851966: docLink,
            ufCrm7_1745930888: [docLink],
            ufCrm7_1775580329: nombreDoc,
            ufCrm7_1747688217: 69,
            ufCrm7_1747688317: 77,
            ufCrm7_1747326026: cantidadCrear,
            ufCrm7_1748545118: despliegueHojas,
            ufCrm7_1747688282: 1,
            ufCrm7_1747688577: 1
        };
        (0, logger_1.logStep)(`Creando item ${codigo} en SPA 1040`);
        await bitrix.execute("crm.item.add", { entityTypeId, fields });
        processedCount++;
        if (onlyFirstVisible && processedCount >= 1)
            break;
    }
    return { status: "completed", processedCount };
};
exports.main = main;
//# sourceMappingURL=import_excel.js.map