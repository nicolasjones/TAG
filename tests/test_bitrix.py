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
    from src.connectors.bitrix import BitrixConnector
from src.connectors.bitrix import BitrixConnector

@pytest.mark.asyncio
async def test_bitrix_connector_execution():
    """Valida que el conector de Bitrix intenta llamar al webhook correcto."""
    connector = BitrixConnector()
    
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_res = MagicMock()
        mock_res.status_code = 200
        mock_res.json.return_value = {"result": "ok"}
        mock_res.raise_for_status = MagicMock()
        mock_post.return_value = mock_res
        
        params = {"fields": {"TITLE": "Test TAG"}}
        result = await connector.execute("crm.item.add", params)
        
        assert result["result"] == "ok"
        mock_post.assert_called_once()
