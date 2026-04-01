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
    from src.connectors.azure_custom import AzureCustomConnector
from src.connectors.azure_custom import AzureCustomConnector

@pytest.mark.asyncio
async def test_azure_connector_execution():
    """Valida que el conector de Azure intenta llamar al endpoint correcto."""
    connector = AzureCustomConnector()
    
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_res = MagicMock()
        mock_res.status_code = 200
        mock_res.json.return_value = {"status": "success", "file_id": "123"}
        mock_res.raise_for_status = MagicMock()
        mock_post.return_value = mock_res
        
        params = {"folder": "Bitrix", "filename": "test.txt"}
        result = await connector.execute("upload", params)
        
        assert result["status"] == "success"
        mock_post.assert_called_once()
