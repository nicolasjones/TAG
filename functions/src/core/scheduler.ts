import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { DatabaseService, Schedule } from './database';

export class SchedulerService {
  private dbService = new DatabaseService();

  async processPendingJobs() {
    const now = admin.firestore.Timestamp.now();
    const schedules = await this.dbService.getActiveSchedules();

    for (const schedule of schedules) {
      if (schedule.nextRun && schedule.nextRun.toMillis() <= now.toMillis()) {
        logger.info(`Ejecutando workflow programado: ${schedule.workflowName}`);

        try {
          // Dinámicamente importamos e iniciamos el workflow.
          // En Node, esto requiere que los workflows vivan en carpetas específicas.
          const workflow = await import(`../workflows/${schedule.workflowName}`);
          if (workflow && workflow.main) {
            await workflow.main(schedule.payload);
            logger.info(`Éxito en job: ${schedule.workflowName}`);
          }

          // Actualizar tiempos de la siguiente ejecución
          const nextRun = this.calculateNextRun(schedule);
          await this.dbService.updateSchedule(schedule.id!, {
            lastRun: now,
            nextRun: nextRun
          });
        } catch (error: any) {
          logger.error(`Error en job ${schedule.workflowName}: ${error.message}`);
        }
      }
    }
  }

  private calculateNextRun(schedule: Schedule): admin.firestore.Timestamp {
    const now = Date.now();
    if (schedule.intervalMinutes) {
      return admin.firestore.Timestamp.fromMillis(now + schedule.intervalMinutes * 60000);
    }
    // Para simplificar cron inicial, usaremos intervalos o una librería como `cron-parser`
    // Por ahora, solo soportaremos intervalos de minutos (como estaba en Python)
    return admin.firestore.Timestamp.fromMillis(now + 3600000); // 1 hora pordefault si falla
  }
}
