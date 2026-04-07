import { initExecutionLogger, logStep, saveExecutionLogs, getExecutionSteps } from './logger';
import { logger } from 'firebase-functions/v2';

export const runWorkflow = async (workflowName: string, payload: any = null) => {
  initExecutionLogger();
  logStep(`Iniciando Workflow: ${workflowName}`, { payload });

  try {
    // Dinámicamente importamos el workflow desde ../workflows/
    // Nota: El archivo TS debe haber sido compilado a JS en lib/
    const modulePath = `../workflows/${workflowName}`;
    const workflow = await import(modulePath);

    if (workflow && workflow.main) {
      const result = await workflow.main(payload);
      logStep(`Workflow ${workflowName} finalizado con éxito`);

      const summary = {
        result,
        execution_summary: {
          workflow: workflowName,
          steps_count: getExecutionSteps().length,
          logs: getExecutionSteps()
        }
      };

      await saveExecutionLogs(workflowName);
      return summary;
    } else {
      throw new Error(`El workflow '${workflowName}' no tiene una función 'main'`);
    }

  } catch (error: any) {
    logger.error(`Error ejecutando workflow '${workflowName}': ${error.message}`);
    logStep(`Workflow fallido: ${error.message}`);
    await saveExecutionLogs(workflowName);
    throw error;
  }
};
