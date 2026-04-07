import axios from 'axios';
import { logger } from 'firebase-functions';
import { defineString } from 'firebase-functions/params';

// Firebase Secrets/Params
const bitrixWebhookUrl = defineString('BITRIX_WEBHOOK_URL');

export class BitrixConnector {
  /**
   * Ejecuta una acción en Bitrix24 asegurando que no sea destructiva (Safe-Edit Policy).
   */
  async execute(action: string, params: any = {}): Promise<any> {
    logger.info(`Bitrix Action: ${action}`, { params });

    // Guardrail: Bloqueo de métodos de borrado
    const forbiddenKeywords = ["delete", "remove", "drop", "purge", "clear"];
    if (forbiddenKeywords.some(keyword => action.toLowerCase().includes(keyword))) {
      logger.error(`ACCION BLOQUEADA: Intento de ejecución destructiva detectado: ${action}`);
      throw new Error(`La acción ${action} está prohibida por seguridad (Safe-Edit Policy).`);
    }

    try {
      const url = `${bitrixWebhookUrl.value()}/${action}`;
      const response = await axios.post(url, params);
      return response.data;
    } catch (error: any) {
      const bitrixError = error.response?.data;
      logger.error(`Error en BitrixConnector (${action}): ${error.message}`, { bitrixError });
      throw error;
    }
  }

  /**
   * Actualiza un ítem en un SPA con Auditoría y Whitelisting.
   */
  async updateItem(entityTypeId: number, itemId: number, fields: any, safeFields?: string[]): Promise<any> {
    let filteredFields = fields;

    // Guardrail: Whitelisting de campos
    if (safeFields) {
      filteredFields = Object.keys(fields)
        .filter(key => safeFields.includes(key))
        .reduce((obj: any, key) => {
          obj[key] = fields[key];
          return obj;
        }, {});

      const ignored = Object.keys(fields).filter(key => !safeFields.includes(key));
      if (ignored.length > 0) {
        logger.warn(`Campos ignorados por no estar en whitelist: ${ignored.join(', ')}`);
      }
    }

    // Auditoría: Obtener valor actual antes de editar (Safe-Edit Audit)
    try {
      const currentData = await this.execute("crm.item.get", {
        entityTypeId,
        id: itemId
      });
      const oldValues: any = {};
      Object.keys(filteredFields).forEach(key => {
        oldValues[key] = currentData?.result?.item?.[key];
      });
      logger.info(`AUDITORIA PRE-EDICIÓN - Item ${itemId}`, { oldValues });
    } catch (error: any) {
      logger.warn(`No se pudo realizar auditoría previa para item ${itemId}: ${error.message}`);
    }

    // Ejecución
    const result = await this.execute("crm.item.update", {
      entityTypeId,
      id: itemId,
      fields: filteredFields
    });

    logger.info(`AUDITORIA POST-EDICIÓN - Item ${itemId}`, { newValues: filteredFields });
    return result;
  }
}
