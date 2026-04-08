"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiConnector = void 0;
const generative_ai_1 = require("@google/generative-ai");
const params_1 = require("firebase-functions/params");
const geminiApiKey = (0, params_1.defineString)('GEMINI_API_KEY');
class GeminiConnector {
    genAI;
    model;
    constructor() {
        this.genAI = new generative_ai_1.GoogleGenerativeAI(geminiApiKey.value());
        this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    }
    async execute(action, params = {}) {
        if (action === "chat") {
            const result = await this.model.generateContent(params.prompt);
            const response = await result.response;
            return response.text();
        }
        throw new Error(`Acción ${action} no soportada en Gemini`);
    }
}
exports.GeminiConnector = GeminiConnector;
//# sourceMappingURL=gemini.js.map