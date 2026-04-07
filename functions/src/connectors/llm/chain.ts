import { logger } from 'firebase-functions';

export interface LLMProvider {
  execute(action: string, params: any): Promise<any>;
}

export class LLMChain {
  private providers: LLMProvider[];

  constructor(providers: LLMProvider[]) {
    this.providers = providers;
  }

  /**
   * Inicia la cadena de consulta con fallback automático.
   */
  async ask(prompt: string, schema?: any): Promise<any> {
    let lastError: any = null;

    for (const provider of this.providers) {
      const providerName = provider.constructor.name;
      logger.info(`Intentando con IA: ${providerName}`);

      try {
        const result = await provider.execute("chat", { prompt, schema });
        logger.info(`Éxito con IA: ${providerName}`);
        return result;
      } catch (error: any) {
        logger.warn(`Falla en ${providerName}: ${error.message}`);
        lastError = error;
        continue;
      }
    }

    logger.error("ERROR CRÍTICO: Todos los proveedores de IA han fallado");
    throw new Error(`IA_FALLBACK_FAILED: Todos los proveedores fallaron. Último error: ${lastError?.message}`);
  }
}
