"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMChain = void 0;
const firebase_functions_1 = require("firebase-functions");
class LLMChain {
    providers;
    constructor(providers) {
        this.providers = providers;
    }
    async ask(prompt, schema) {
        let lastError = null;
        for (const provider of this.providers) {
            const providerName = provider.constructor.name;
            firebase_functions_1.logger.info(`Intentando con IA: ${providerName}`);
            try {
                const result = await provider.execute("chat", { prompt, schema });
                firebase_functions_1.logger.info(`Éxito con IA: ${providerName}`);
                return result;
            }
            catch (error) {
                firebase_functions_1.logger.warn(`Falla en ${providerName}: ${error.message}`);
                lastError = error;
                continue;
            }
        }
        firebase_functions_1.logger.error("ERROR CRÍTICO: Todos los proveedores de IA han fallado");
        throw new Error(`IA_FALLBACK_FAILED: Todos los proveedores fallaron. Último error: ${lastError?.message}`);
    }
}
exports.LLMChain = LLMChain;
//# sourceMappingURL=chain.js.map