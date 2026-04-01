from typing import Optional
from fastapi import Security, HTTPException, status, Query
from fastapi.security.api_key import APIKeyHeader
from src.core.config import settings
from src.core.logger import logger

api_key_header = APIKeyHeader(name="X-TAG-API-KEY", auto_error=False)

async def get_api_key(
    api_key_header: str = Security(api_key_header),
    api_key_query: Optional[str] = Query(None, alias="api_key")
):
    key = api_key_header or api_key_query
    if key == settings.TAG_API_KEY:
        return key
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Could not validate credentials",
    )

async def validate_bitrix_token(payload: dict):
    # Bitrix envía el token en auth[application_token]
    auth_token = payload.get("auth", {}).get("application_token")
    expected_token = settings.BITRIX_TOKEN.get_secret_value() if settings.BITRIX_TOKEN else None
    
    if auth_token == expected_token:
        return True
    
    # Intento alternativo (dependiendo del tipo de webhook saliente)
    if not auth_token:
        # Algunos webhooks antiguos envían 'token' en el nivel raíz
        auth_token = payload.get("token")
        if auth_token == expected_token:
            return True

    logger.warning(f"Intento de Webhook Bitrix con token inválido: {auth_token}")
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid Bitrix application token",
    )
