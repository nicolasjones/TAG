import { BitrixConnector } from '../connectors/bitrix';
import { AzureCustomConnector } from '../connectors/azure_custom';
import { logStep } from '../core/logger';
import { defineString } from 'firebase-functions/params';
import ExcelJS from 'exceljs';

const sharepointDriveId = defineString('SHAREPOINT_DRIVE_ID');

export const main = async (payload: any = null) => {
  if (!payload || !payload.folder_name) {
    throw new Error("Payload debe contener 'folder_name'");
  }

  const folderName = payload.folder_name;
  logStep(`Iniciando Control Documental para carpeta: ${folderName}`);

  const azure = new AzureCustomConnector();
  const bitrix = new BitrixConnector();

  // 1. Buscar el archivo en SharePoint
  const folderPath = `Control Documental/${folderName}`;
  logStep(`Buscando archivo 'Números OTI' en: ${folderPath}`);

  try {
    const itemsResp = await azure.execute("GET", `drives/${sharepointDriveId.value()}/root:/${folderPath}:/children`);
    const items = itemsResp.value || [];
    
    let otiFile: any = null;
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

    logStep(`Archivo encontrado: ${otiFile.name}`);

    // 2. Descargar y procesar Excel
    // Asumimos que azure.execute("GET", .../content) devuelve el buffer del archivo
    const content = await azure.execute("GET", `drives/${sharepointDriveId.value()}/root:/${folderPath}/${otiFile.name}:/content`);
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(content as any);
    const worksheet = workbook.worksheets[0];

    const stats = { total: 0, updates: 0, errors: 0 };

    // 3. Sincronizar con Bitrix
    // Iteramos filas (empezando desde la 2 para saltar el header si lo hay, o la 1 si no)
    // El Python original no especificaba saltar filas, así que iteraremos todas.
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Saltar header habitualmente

      // Columna E (5) -> Doc Name
      // Columna H (8) -> N Asignado
      const docName = String(row.getCell(5).value || "").trim();
      const nAsignadoVal = String(row.getCell(8).value || "").trim();

      if (!docName || docName === "nan") return;

      stats.total++;
      logStep(`Sincronizando: ${docName} -> ${nAsignadoVal}`);

      // Usar un bloque anónimo async para procesar cada fila
      (async () => {
        try {
            // Búsqueda exacta en Bitrix SPA 1100
            const searchRes = await bitrix.execute("crm.item.list", {
              entityTypeId: 1100,
              filter: { "TITLE": docName },
              select: ["id", "title"]
            });

            const itemsFound = searchRes.result?.items || [];
            
            if (itemsFound.length === 0) {
                // Búsqueda parcial si falla la exacta
                const partialRes = await bitrix.execute("crm.item.list", {
                    entityTypeId: 1100,
                    filter: { "%TITLE": docName },
                    select: ["id", "title"]
                });
                if (partialRes.result?.items) itemsFound.push(...partialRes.result.items);
            }

            if (itemsFound.length === 0) {
                logStep(`Warning: No se encontró '${docName}' en Bitrix`);
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
        } catch (err: any) {
            logStep(`Error actualizando '${docName}': ${err.message}`);
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

  } catch (err: any) {
    logStep(`Error en workflow de Control Documental: ${err.message}`);
    throw err;
  }
};
