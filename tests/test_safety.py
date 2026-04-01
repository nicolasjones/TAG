import pytest
import asyncio
from unittest.mock import patch, AsyncMock
from src.connectors.bitrix import BitrixConnector

@pytest.mark.asyncio
async def test_bitrix_safety_block():
    connector = BitrixConnector()
    
    # Intentar borrar debería lanzar PermissionError
    with pytest.raises(PermissionError) as excinfo:
        await connector.execute("crm.item.delete", {"id": 123})
    
    assert "prohibida por seguridad" in str(excinfo.value)

@pytest.mark.asyncio
async def test_bitrix_update_audit(caplog):
    connector = BitrixConnector()
    
    # Mock de crm.item.get y crm.item.update
    with patch.object(connector, 'execute', new_callable=AsyncMock) as mock_execute:
        mock_execute.side_effect = [
            {"item": {"UF_CRM_STATUS": "OLD"}}, # mock get
            {"item": {"id": 1}}                 # mock update
        ]
        
        fields = {"UF_CRM_STATUS": "NEW"}
        await connector.update_item(1032, 1, fields)
        
        # Verificar que se llamó a GET primero para auditoría
        assert mock_execute.call_args_list[0][0][0] == "crm.item.get"
        # Verificar que se llamó a UPDATE después
        assert mock_execute.call_args_list[1][0][0] == "crm.item.update"

@pytest.mark.asyncio
async def test_bitrix_whitelisting():
    connector = BitrixConnector()
    
    with patch.object(connector, 'execute', new_callable=AsyncMock) as mock_execute:
        mock_execute.return_value = {"item": {}}
        
        fields = {"SAFE": "OK", "DANGEROUS": "BAD"}
        safe_fields = ["SAFE"]
        
        await connector.update_item(1032, 1, fields, safe_fields=safe_fields)
        
        # El update solo debe contener el campo SAFE
        update_call = mock_execute.call_args_list[1][0][1]
        assert "SAFE" in update_call["fields"]
        assert "DANGEROUS" not in update_call["fields"]
