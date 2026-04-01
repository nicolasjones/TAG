from abc import ABC, abstractmethod
from typing import Any, Dict

class BaseConnector(ABC):
    """Interfaz base para todos los conectores del framework."""
    
    @abstractmethod
    async def execute(self, action: str, params: Dict[str, Any] = None) -> Any:
        """Ejecuta una acción específica en el servicio externo."""
        pass
