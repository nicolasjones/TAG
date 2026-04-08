"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIConnector = void 0;
const openai_1 = __importDefault(require("openai"));
const params_1 = require("firebase-functions/params");
const openaiApiKey = (0, params_1.defineString)('OPENAI_API_KEY');
class OpenAIConnector {
    client;
    constructor() {
        this.client = new openai_1.default({
            apiKey: openaiApiKey.value()
        });
    }
    async execute(action, params = {}) {
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
exports.OpenAIConnector = OpenAIConnector;
//# sourceMappingURL=openai.js.map