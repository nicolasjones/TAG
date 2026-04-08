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
const sharepointDriveId = (0, params_1.defineString)('SHAREPOINT_DRIVE_ID');
const main = async (payload = null) => {
    if (!payload || !payload.folder_name) {
        throw new Error("Payload debe contener 'folder_name'");
    }
    const folderName = payload.folder_name;
    (0, logger_1.logStep)(`Iniciando Control Documental para carpeta: ${folderName}`);
    const azure = new azure_custom_1.AzureCustomConnector();
    const bitrix = new bitrix_1.BitrixConnector();
    const folderPath = `Control Documental/${folderName}`;
    (0, logger_1.logStep)(`Buscando archivo 'Números OTI' en: ${folderPath}`);
    try {
        const itemsResp = await azure.execute("GET", `drives/${sharepointDriveId.value()}/root:/${folderPath}:/children`);
        const items = itemsResp.value || [];
        let otiFile = null;
        for (const item of items) {
            const name = item.name || "";
            if (name.startsWith("Números OTI") && name.endsWith(".xlsx")) {
                otiFile = item;
                break;
            }
        }
        if (!otiFile) {
            throw new Error(`No se encontró el archivo 'Números OTI' en ${folderPath}`);
        }
        (0, logger_1.logStep)(`Archivo encontrado: ${otiFile.name}`);
        const content = await azure.execute("GET", `drives/${sharepointDriveId.value()}/root:/${folderPath}/${otiFile.name}:/content`);
        const workbook = new exceljs_1.default.Workbook();
        await workbook.xlsx.load(content);
        const worksheet = workbook.worksheets[0];
        const stats = { total: 0, updates: 0, errors: 0 };
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1)
                return;
            const docName = String(row.getCell(5).value || "").trim();
            const nAsignadoVal = String(row.getCell(8).value || "").trim();
            if (!docName || docName === "nan")
                return;
            stats.total++;
            (0, logger_1.logStep)(`Sincronizando: ${docName} -> ${nAsignadoVal}`);
            (async () => {
                try {
                    const searchRes = await bitrix.execute("crm.item.list", {
                        entityTypeId: 1100,
                        filter: { "TITLE": docName },
                        select: ["id", "title"]
                    });
                    const itemsFound = searchRes.result?.items || [];
                    if (itemsFound.length === 0) {
                        const partialRes = await bitrix.execute("crm.item.list", {
                            entityTypeId: 1100,
                            filter: { "%TITLE": docName },
                            select: ["id", "title"]
                        });
                        if (partialRes.result?.items)
                            itemsFound.push(...partialRes.result.items);
                    }
                    if (itemsFound.length === 0) {
                        (0, logger_1.logStep)(`Warning: No se encontró '${docName}' en Bitrix`);
                        stats.errors++;
                        return;
                    }
                    for (const bItem of itemsFound) {
                        await bitrix.execute("crm.item.update", {
                            entityTypeId: 1100,
                            id: bItem.id,
                            fields: {
                                "ufCrm35_1750701105": nAsignadoVal
                            }
                        });
                        stats.updates++;
                    }
                }
                catch (err) {
                    (0, logger_1.logStep)(`Error actualizando '${docName}': ${err.message}`);
                    stats.errors++;
                }
            })();
        });
        return {
            status: "completed",
            stats,
            folder: folderName,
            file: otiFile.name
        };
    }
    catch (err) {
        (0, logger_1.logStep)(`Error en workflow de Control Documental: ${err.message}`);
        throw err;
    }
};
exports.main = main;
//# sourceMappingURL=control_documental.js.map