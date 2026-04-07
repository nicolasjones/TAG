import { BitrixConnector } from '../connectors/bitrix';
import { AzureCustomConnector } from '../connectors/azure_custom';
import { logStep } from '../core/logger';
import { defineString } from 'firebase-functions/params';
import ExcelJS from 'exceljs';
import path from 'path';

const sharepointDriveId = defineString('SHAREPOINT_DRIVE_ID');
const bitrixEntityAperturaPr = defineString('BITRIX_ENTITY_APERTURA_PR');

const SPECIALTY_SPA_MAP: Record<string, number> = {
    "ELECTRICIDAD": 1058,
    "PIPING": 1054,
    "PROCESOS": 1088,
    "MECÁNICA": 1092,
    "INSTRUMENTOS": 1066,
    "ESCÁN_LASER": 1072,
    "ESTUDIOS_ESP": 1076,
    "ARQUITECTURA": 1048
};

const getEntityBitrixId = (entityTypeId: number, itemId: number) => `T${entityTypeId.toString(16).toUpperCase()}_${itemId}`;

const getEnvParam = (param: any, key: string) => {
    try {
        return param.value() || process.env[key];
    } catch {
        return process.env[key];
    }
};

async function findEntityId(bitrix: BitrixConnector, entityTypeId: number, title: string) {
    const res = await bitrix.execute("crm.item.list", {
        entityTypeId,
        filter: { title }
    });
    return res.result?.items?.[0]?.id || null;
}

export const main = async (payload: any = null) => {
    const fileName = payload?.file_name || "OTI-2385-26.xlsm";
    const folderPath = payload?.folder_path || "Bitrix/Bitrix Export";
    const onlyFirstVisible = payload?.only_first_visible ?? true;

    logStep(`Iniciando Importación Excel a Bitrix: ${fileName}`);

    const azure = new AzureCustomConnector();
    const bitrix = new BitrixConnector();
    const driveId = getEnvParam(sharepointDriveId, 'SHAREPOINT_DRIVE_ID');

    // 1. Descargar Excel
    const content = await azure.execute("GET", `drives/${driveId}/root:/${folderPath}/${fileName}:/content`);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(content as any);

    const sheetAnexo = workbook.getWorksheet("ANEXO 2");
    const sheetPres = workbook.getWorksheet("Presupuesto");

    if (!sheetAnexo || !sheetPres) {
        throw new Error("No se encontraron las hojas ANEXO 2 o Presupuesto");
    }

    // 2. Mapear códigos desde Presupuesto
    const presData: Record<string, any> = {};
    sheetPres.eachRow((row, rowNumber) => {
        if (rowNumber < 7) return;
        const code = row.getCell(2).text.trim();
        const qty = row.getCell(1).value;
        if (code) presData[code] = qty;
    });

    // 3. Contexto PR
    const prTitle = path.parse(fileName).name;
    const prEntityId = await findEntityId(bitrix, 1096, prTitle);
    const prLink = prEntityId ? getEntityBitrixId(1096, prEntityId) : prTitle;

    const entityTypeId = Number(getEnvParam(bitrixEntityAperturaPr, 'BITRIX_ENTITY_APERTURA_PR'));
    const STAGE_APROBADO = "DT1040_13:UC_A0X4JS";
    const CATEGORY_ID = 13;

    let processedCount = 0;

    // 4. Procesar Anexo 2
    for (let i = 4; i <= sheetAnexo.rowCount; i++) {
        const row = sheetAnexo.getRow(i);
        if (row.hidden) continue;

        const codigo = row.getCell(1).text.trim();
        if (!codigo || codigo.toLowerCase() === "código") continue;

        const especialidadText = row.getCell(2).text.toUpperCase();
        const nombreDoc = row.getCell(7).text;
        const unMedida = row.getCell(9).text.toUpperCase();

        // Buscar Link de Documento
        let docLink = codigo;
        const specSpaId = SPECIALTY_SPA_MAP[especialidadText];
        if (specSpaId) {
            const foundId = await findEntityId(bitrix, specSpaId, codigo);
            if (foundId) docLink = getEntityBitrixId(specSpaId, foundId);
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
            ufCrm7_1747688217: 69, // Letra
            ufCrm7_1747688317: 77, // Estandar
            ufCrm7_1747326026: cantidadCrear,
            ufCrm7_1748545118: despliegueHojas,
            ufCrm7_1747688282: 1,
            ufCrm7_1747688577: 1
        };

        logStep(`Creando item ${codigo} en SPA 1040`);
        await bitrix.execute("crm.item.add", { entityTypeId, fields });
        processedCount++;

        if (onlyFirstVisible && processedCount >= 1) break;
    }

    return { status: "completed", processedCount };
};
