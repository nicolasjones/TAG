import { BitrixConnector } from '../connectors/bitrix';
import { AzureCustomConnector } from '../connectors/azure_custom';
import { LLMChain } from '../connectors/llm/chain';
import { GeminiConnector } from '../connectors/llm/gemini';
import { OpenAIConnector } from '../connectors/llm/openai';
import { logStep } from '../core/logger';
import { defineString } from 'firebase-functions/params';

const sharepointDriveId = defineString('SHAREPOINT_DRIVE_ID');

export const main = async (payload: any = null) => {
  logStep("1. Inicializando Conectores (Node.js)");
  const bitrix = new BitrixConnector();
  const azure = new AzureCustomConnector();
  
  // Configuramos IA con Fallback
  const ia = new LLMChain([new GeminiConnector(), new OpenAIConnector()]);
  
  logStep("2. Procesando datos con IA");
  const content = payload?.text || "Hola TAG";
  const aiResponse = await ia.ask(`Analiza este requerimiento para TAG: ${content}`);
  logStep(`AI Respondió: ${aiResponse.substring(0, 100)}...`);
  
  logStep("3. Guardando en Azure SharePoint");
  await azure.uploadFile(
    sharepointDriveId.value(),
    "Bitrix/IA",
    "ia_analysis.txt",
    Buffer.from(aiResponse, "utf-8")
  );
  
  logStep("4. Notificando a Bitrix");
  await bitrix.execute("crm.timeline.item.add", { 
    fields: { COMMENT: `IA dice: ${aiResponse}` } 
  });
  
  return { status: "completed", ai: aiResponse };
};
