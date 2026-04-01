from google import genai
from src.connectors.base import BaseConnector
from src.core.config import settings
from typing import Any, Dict

class GeminiConnector(BaseConnector):
    """Conector para Google Gemini AI (usando la nueva librería google-genai)."""
    
    def __init__(self):
        self.client = None
        if settings.GEMINI_API_KEY:
            self.client = genai.Client(
                api_key=settings.GEMINI_API_KEY
            )
            self.model_name = 'gemini-flash-latest'

    async def execute(self, action: str, params: Dict[str, Any] = None) -> Any:
        """Ejecuta una consulta a Gemini."""
        if not self.client:
            raise ValueError("GEMINI_API_KEY no está configurada")

        if action == "chat":
            prompt = params.get("prompt")
            # La nueva librería es síncrona por defecto o usa .aio para asíncrono
            # Usaremos la versión asíncrona si está disponible, o simplemente la síncrona por ahora
            response = await self.client.aio.models.generate_content(
                model=self.model_name,
                contents=prompt
            )
            return response.text
        raise NotImplementedError(f"Acción {action} no soportada en Gemini")
