from openai import OpenAI
from src.connectors.base import BaseConnector
from src.core.config import settings
from typing import Any, Dict

class OpenAIConnector(BaseConnector):
    """Conector para OpenAI (GPT-4/3.5)."""
    
    def __init__(self):
        self.client = None
        if settings.OPENAI_API_KEY:
            self.client = OpenAI(api_key=settings.OPENAI_API_KEY)

    async def execute(self, action: str, params: Dict[str, Any] = None) -> Any:
        """Ejecuta una consulta a OpenAI."""
        if not self.client:
            raise ValueError("OPENAI_API_KEY no está configurada")

        if action == "chat":
            prompt = params.get("prompt")
            response = self.client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=[{"role": "user", "content": prompt}]
            )
            return response.choices[0].message.content
        raise NotImplementedError(f"Acción {action} no soportada en OpenAI")
