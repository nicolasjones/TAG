import { GoogleGenerativeAI } from "@google/generative-ai";
import { defineString } from 'firebase-functions/params';

const geminiApiKey = defineString('GEMINI_API_KEY');

export class GeminiConnector {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    this.genAI = new GoogleGenerativeAI(geminiApiKey.value());
    this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  }

  async execute(action: string, params: any = {}): Promise<any> {
    if (action === "chat") {
      const result = await this.model.generateContent(params.prompt);
      const response = await result.response;
      return response.text();
    }
    throw new Error(`Acción ${action} no soportada en Gemini`);
  }
}
