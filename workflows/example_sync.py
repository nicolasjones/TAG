from src.connectors.bitrix import BitrixConnector
from src.connectors.azure_custom import AzureCustomConnector
from src.connectors.llm.chain import LLMChain
from src.connectors.llm.providers.gemini import GeminiConnector
from src.connectors.llm.providers.openai import OpenAIConnector
from src.core.logger import log_step

async def main(payload: dict = None):
    """Ejemplo de flujo: Recibe de Bitrix -> Procesa IA -> Guarda Azure -> Responde Bitrix."""
    
    log_step("1. Inicializando Conectores")
    bitrix = BitrixConnector()
    azure = AzureCustomConnector()
    
    # Configuramos IA con Fallback
    ia = LLMChain(providers=[GeminiConnector(), OpenAIConnector()])
    
    log_step("2. Procesando datos con IA")
    content = payload.get("text", "Sin contenido") if payload else "Hola TAG"
    ai_response = await ia.ask(f"Analiza este requerimiento para TAG: {content}")
    log_step(f"AI Respondió: {ai_response[:100]}...")
    
    log_step("3. Guardando en Azure SharePoint")
    from src.core.config import settings
    await azure.upload_file(
        drive_id=settings.SHAREPOINT_DRIVE_ID,
        folder_path="Bitrix/IA",
        filename="ia_analysis.txt",
        content=ai_response.encode("utf-8")
    )
    
    log_step("4. Notificando a Bitrix")
    await bitrix.execute("crm.timeline.item.add", {"fields": {"COMMENT": f"IA dice: {ai_response}"}})
    
    return {"status": "completed", "ai": ai_response}
