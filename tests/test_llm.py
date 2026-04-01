import pytest
import os
from unittest.mock import AsyncMock, MagicMock, patch

# Mockeamos el entorno para Pydantic
with patch.dict(os.environ, {
    "BITRIX_WEBHOOK_URL": "http://mock",
    "AZURE_TAG_ENDPOINT": "http://mock",
    "AZURE_CLIENT_ID": "mock",
    "AZURE_CLIENT_SECRET": "mock",
    "AZURE_TENANT_ID": "mock"
}):
    from src.connectors.llm.chain import LLMChain
    # ... rest of imports will use this mocked settings if needed
from src.connectors.llm.chain import LLMChain
from src.connectors.llm.providers.gemini import GeminiConnector
from src.connectors.llm.providers.openai import OpenAIConnector

@pytest.mark.asyncio
async def test_llm_fallback_chain():
    """Prueba de estrés: Gemini falla, OpenAI responde."""
    
    # Mock de Gemini que falla
    gemini = MagicMock(spec=GeminiConnector)
    gemini.execute = AsyncMock(side_effect=Exception("Gemini Out of Service"))
    
    # Mock de OpenAI que funciona
    openai = MagicMock(spec=OpenAIConnector)
    openai.execute = AsyncMock(return_value="Respuesta de OpenAI")
    
    chain = LLMChain(providers=[gemini, openai])
    
    result = await chain.ask("Hola")
    
    assert result == "Respuesta de OpenAI"
    gemini.execute.assert_called_once()
    openai.execute.assert_called_once()

@pytest.mark.asyncio
async def test_llm_full_failure():
    """Prueba: Todos los proveedores fallan."""
    gemini = MagicMock(spec=GeminiConnector)
    gemini.execute = AsyncMock(side_effect=Exception("Error 1"))
    
    chain = LLMChain(providers=[gemini])
    
    with pytest.raises(Exception) as exc:
        await chain.ask("Hola")
    
    assert "IA_FALLBACK_FAILED" in str(exc.value)
