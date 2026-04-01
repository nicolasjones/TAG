from typing import List, Optional, Any, Dict
from src.connectors.base import BaseConnector
from src.core.logger import logger, log_step

class LLMChain:
    """Motor de Fallback para IAs. Intenta con proveedores en orden de prioridad."""
    
    def __init__(self, providers: List[BaseConnector]):
        self.providers = providers

    async def ask(self, prompt: str, schema: Any = None) -> Any:
        """Inicia la cadena de consulta con fallback automático."""
        last_error = None
        
        for provider in self.providers:
            provider_name = provider.__class__.__name__
            log_step(f"Intentando con IA: {provider_name}")
            
            try:
                result = await provider.execute("chat", {"prompt": prompt, "schema": schema})
                log_step(f"Éxito con IA: {provider_name}")
                return result
            except Exception as e:
                logger.warning(f"Falla en {provider_name}: {str(e)}")
                last_error = e
                continue
        
        log_step("ERROR CRÍTICO: Todos los proveedores de IA han fallado")
        raise Exception(f"IA_FALLBACK_FAILED: Todos los proveedores fallaron. Último error: {str(last_error)}")
