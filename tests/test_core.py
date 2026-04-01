import pytest
from unittest.mock import patch
import os

# Mockeamos el entorno antes de importar settings
with patch.dict(os.environ, {
    "BITRIX_WEBHOOK_URL": "http://mock",
    "AZURE_TAG_ENDPOINT": "http://mock",
    "AZURE_CLIENT_ID": "mock",
    "AZURE_CLIENT_SECRET": "mock",
    "AZURE_TENANT_ID": "mock"
}):
    from src.core.config import settings

def test_config_loading():
    """Verifica que la configuración se carga (aunque sea con valores por defecto o fallos controlados)."""
    assert settings.APP_NAME == "TAG Automation Framework"
    # No fallará si no hay .env porque pydantic-settings maneja defaults o requiere campos.
    # Pero aquí validamos que el motor existe.

def test_logger_initialization():
    """Verifica que el logger se inicializa correctamente."""
    from src.core.logger import logger, log_step
    logger.info("Test de logger")
    log_step("Fase de Prueba", {"data": "ok"})
