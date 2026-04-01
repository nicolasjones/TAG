import httpx
from typing import Any, Dict
from src.connectors.base import BaseConnector
from src.core.config import settings
from src.core.logger import logger, log_step

class BitrixConnector(BaseConnector):
    """Conector para la instancia única de Bitrix24 de TAG."""
    
    def __init__(self):
        self.webhook_url = settings.BITRIX_WEBHOOK_URL
        self.token = settings.BITRIX_TOKEN

    async def execute(self, action: str, params: Dict[str, Any] = None) -> Any:
        """Ejecuta una acción en Bitrix24 asegurando que no sea destructiva."""
        log_step(f"Bitrix Action: {action}", {"params": params})
        
        # Guardrail: Bloqueo de métodos de borrado
        forbidden_keywords = ["delete", "remove", "drop", "purge", "clear"]
        if any(keyword in action.lower() for keyword in forbidden_keywords):
            logger.error(f"ACCION BLOQUEADA: Intento de ejecución destructiva detectado: {action}")
            raise PermissionError(f"La acción {action} está prohibida por seguridad (Safe-Edit Policy).")

        async with httpx.AsyncClient() as client:
            try:
                url = f"{self.webhook_url}/{action}"
                response = await client.post(url, json=params)
                response.raise_for_status()
                return response.json()
            except Exception as e:
                logger.error(f"Error en BitrixConnector ({action}): {str(e)}")
                raise

    async def update_item(self, entity_type_id: int, item_id: int, fields: Dict[str, Any], safe_fields: list = None):
        """
        Actualiza un ítem en un SPA con Auditoría y Whitelisting.
        """
        # Guardrail: Whitelisting de campos si se proporciona
        if safe_fields:
            filtered_fields = {k: v for k, v in fields.items() if k in safe_fields}
            if len(filtered_fields) < len(fields):
                ignored = set(fields.keys()) - set(filtered_fields.keys())
                logger.warning(f"Campos ignorados por no estar en whitelist: {ignored}")
            fields = filtered_fields

        # Auditoría: Obtener valor actual antes de editar (Safe-Edit Audit)
        try:
            current_data = await self.execute("crm.item.get", {
                "entityTypeId": entity_type_id,
                "id": item_id
            })
            old_values = {k: current_data.get("item", {}).get(k) for k in fields.keys()}
            log_step("AUDITORIA PRE-EDICIÓN", {"item_id": item_id, "old_values": old_values})
        except Exception as e:
            logger.warning(f"No se pudo realizar auditoría previa para item {item_id}: {str(e)}")

        # Ejecución
        result = await self.execute("crm.item.update", {
            "entityTypeId": entity_type_id,
            "id": item_id,
            "fields": fields
        })
        
        log_step("AUDITORIA POST-EDICIÓN", {"item_id": item_id, "new_values": fields})
        return result
