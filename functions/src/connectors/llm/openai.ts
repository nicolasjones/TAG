import OpenAI from 'openai';
import { defineString } from 'firebase-functions/params';

const openaiApiKey = defineString('OPENAI_API_KEY');

export class OpenAIConnector {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: openaiApiKey.value()
    });
  }

  async execute(action: string, params: any = {}): Promise<any> {
    if (action === "chat") {
      const response = await this.client.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [{ role: "user", content: params.prompt }]
      });
      return response.choices[0].message.content;
    }
    throw new Error(`Acción ${action} no soportada en OpenAI`);
  }
}
