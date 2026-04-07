import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions/v2';

let currentSteps: any[] = [];

export const initExecutionLogger = () => {
  currentSteps = [];
};

export const logStep = (message: string, data: any = {}) => {
  const step = {
    timestamp: new Date().toISOString(),
    message,
    data
  };
  currentSteps.push(step);
  logger.info(message, data);
};

export const getExecutionSteps = () => currentSteps;

export const saveExecutionLogs = async (workflowName: string) => {
  const db = admin.firestore();
  await db.collection('execution_logs').add({
    workflowName,
    timestamp: admin.firestore.Timestamp.now(),
    steps: currentSteps,
    stepsCount: currentSteps.length
  });
};
