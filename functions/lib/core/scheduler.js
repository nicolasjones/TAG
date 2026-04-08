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
exports.SchedulerService = void 0;
const v2_1 = require("firebase-functions/v2");
const admin = __importStar(require("firebase-admin"));
const database_1 = require("./database");
class SchedulerService {
    dbService = new database_1.DatabaseService();
    async processPendingJobs() {
        const now = admin.firestore.Timestamp.now();
        const schedules = await this.dbService.getActiveSchedules();
        for (const schedule of schedules) {
            if (schedule.nextRun && schedule.nextRun.toMillis() <= now.toMillis()) {
                v2_1.logger.info(`Ejecutando workflow programado: ${schedule.workflowName}`);
                try {
                    const workflow = await Promise.resolve(`${`../workflows/${schedule.workflowName}`}`).then(s => __importStar(require(s)));
                    if (workflow && workflow.main) {
                        await workflow.main(schedule.payload);
                        v2_1.logger.info(`Éxito en job: ${schedule.workflowName}`);
                    }
                    const nextRun = this.calculateNextRun(schedule);
                    await this.dbService.updateSchedule(schedule.id, {
                        lastRun: now,
                        nextRun: nextRun
                    });
                }
                catch (error) {
                    v2_1.logger.error(`Error en job ${schedule.workflowName}: ${error.message}`);
                }
            }
        }
    }
    calculateNextRun(schedule) {
        const now = Date.now();
        if (schedule.intervalMinutes) {
            return admin.firestore.Timestamp.fromMillis(now + schedule.intervalMinutes * 60000);
        }
        return admin.firestore.Timestamp.fromMillis(now + 3600000);
    }
}
exports.SchedulerService = SchedulerService;
//# sourceMappingURL=scheduler.js.map