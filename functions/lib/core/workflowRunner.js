"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runWorkflow = void 0;
const logger_1 = require("./logger");
const v2_1 = require("firebase-functions/v2");
const runWorkflow = async (workflowName, payload = null) => {
    (0, logger_1.initExecutionLogger)();
    (0, logger_1.logStep)(`Iniciando Workflow: ${workflowName}`, { payload });
    try {
        const modulePath = `../workflows/${workflowName}`;
        const workflow = await Promise.resolve(`${modulePath}`).then(s => __importStar(require(s)));
        if (workflow && workflow.main) {
            const result = await workflow.main(payload);
            (0, logger_1.logStep)(`Workflow ${workflowName} finalizado con éxito`);
            const summary = {
                result,
                execution_summary: {
                    workflow: workflowName,
                    steps_count: (0, logger_1.getExecutionSteps)().length,
                    logs: (0, logger_1.getExecutionSteps)()
                }
            };
            await (0, logger_1.saveExecutionLogs)(workflowName);
            return summary;
        }
        else {
            throw new Error(`El workflow '${workflowName}' no tiene una función 'main'`);
        }
    }
    catch (error) {
        v2_1.logger.error(`Error ejecutando workflow '${workflowName}': ${error.message}`);
        (0, logger_1.logStep)(`Workflow fallido: ${error.message}`);
        await (0, logger_1.saveExecutionLogs)(workflowName);
        throw error;
    }
};
exports.runWorkflow = runWorkflow;
//# sourceMappingURL=workflowRunner.js.map