"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BitrixConnector = void 0;
const axios_1 = __importDefault(require("axios"));
const firebase_functions_1 = require("firebase-functions");
const params_1 = require("firebase-functions/params");
const bitrixWebhookUrl = (0, params_1.defineString)('BITRIX_WEBHOOK_URL');
class BitrixConnector {
    async execute(action, params = {}) {
        firebase_functions_1.logger.info(`Bitrix Action: ${action}`, { params });
        const forbiddenKeywords = ["delete", "remove", "drop", "purge", "clear"];
        if (forbiddenKeywords.some(keyword => action.toLowerCase().includes(keyword))) {
            firebase_functions_1.logger.error(`ACCION BLOQUEADA: Intento de ejecución destructiva detectado: ${action}`);
            throw new Error(`La acción ${action} está prohibida por seguridad (Safe-Edit Policy).`);
        }
        try {
            const url = `${bitrixWebhookUrl.value()}/${action}`;
            const response = await axios_1.default.post(url, params);
            return response.data;
        }
        catch (error) {
            const bitrixError = error.response?.data;
            firebase_functions_1.logger.error(`Error en BitrixConnector (${action}): ${error.message}`, { bitrixError });
            throw error;
        }
    }
    async updateItem(entityTypeId, itemId, fields, safeFields) {
        let filteredFields = fields;
        if (safeFields) {
            filteredFields = Object.keys(fields)
                .filter(key => safeFields.includes(key))
                .reduce((obj, key) => {
                obj[key] = fields[key];
                return obj;
            }, {});
            const ignored = Object.keys(fields).filter(key => !safeFields.includes(key));
            if (ignored.length > 0) {
                firebase_functions_1.logger.warn(`Campos ignorados por no estar en whitelist: ${ignored.join(', ')}`);
            }
        }
        try {
            const currentData = await this.execute("crm.item.get", {
                entityTypeId,
                id: itemId
            });
            const oldValues = {};
            Object.keys(filteredFields).forEach(key => {
                oldValues[key] = currentData?.result?.item?.[key];
            });
            firebase_functions_1.logger.info(`AUDITORIA PRE-EDICIÓN - Item ${itemId}`, { oldValues });
        }
        catch (error) {
            firebase_functions_1.logger.warn(`No se pudo realizar auditoría previa para item ${itemId}: ${error.message}`);
        }
        const result = await this.execute("crm.item.update", {
            entityTypeId,
            id: itemId,
            fields: filteredFields
        });
        firebase_functions_1.logger.info(`AUDITORIA POST-EDICIÓN - Item ${itemId}`, { newValues: filteredFields });
        return result;
    }
}
exports.BitrixConnector = BitrixConnector;
//# sourceMappingURL=bitrix.js.map