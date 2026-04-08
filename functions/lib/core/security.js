"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBitrixToken = exports.validateApiKey = void 0;
const params_1 = require("firebase-functions/params");
const v2_1 = require("firebase-functions/v2");
const tagApiKey = (0, params_1.defineString)('TAG_API_KEY');
const bitrixToken = (0, params_1.defineString)('BITRIX_TOKEN');
const validateApiKey = (req) => {
    const key = req.headers['x-tag-api-key'] || req.query['api_key'];
    if (key === tagApiKey.value()) {
        return true;
    }
    throw new Error('No se pudo validar las credenciales de API Key');
};
exports.validateApiKey = validateApiKey;
const validateBitrixToken = (payload) => {
    const authToken = payload.auth?.application_token || payload.token;
    const expectedToken = bitrixToken.value();
    if (authToken === expectedToken) {
        return true;
    }
    v2_1.logger.warn(`Intento de Webhook Bitrix con token inválido: ${authToken}`);
    throw new Error('Token de aplicación de Bitrix inválido');
};
exports.validateBitrixToken = validateBitrixToken;
//# sourceMappingURL=security.js.map