import { defineString } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';
import { Request } from 'express';

const tagApiKey = defineString('TAG_API_KEY');
const bitrixToken = defineString('BITRIX_TOKEN');

export const validateApiKey = (req: Request) => {
  const key = req.headers['x-tag-api-key'] || req.query['api_key'];
  if (key === tagApiKey.value()) {
    return true;
  }
  throw new Error('No se pudo validar las credenciales de API Key');
};

export const validateBitrixToken = (payload: any) => {
  const authToken = payload.auth?.application_token || payload.token;
  const expectedToken = bitrixToken.value();

  if (authToken === expectedToken) {
    return true;
  }

  logger.warn(`Intento de Webhook Bitrix con token inválido: ${authToken}`);
  throw new Error('Token de aplicación de Bitrix inválido');
};
