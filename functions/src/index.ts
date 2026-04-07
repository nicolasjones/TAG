import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from 'firebase-admin';
import express from "express";
import fs from "fs";
import path from "path";
import { runWorkflow } from "./core/workflowRunner";
import { SchedulerService } from "./core/scheduler";
import { validateBitrixToken, validateApiKey } from "./core/security";
import { logStep } from "./core/logger";

if (!admin.apps.length) {
  admin.initializeApp();
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const FUNCTION_WORKFLOW_MAP: Record<string, string> = {
  "CREATE_PR": "create_pr",
  "SET_DATES_AP_PR": "set_dates_ap_pr",
  "CREATE_PLANNER_TASKS": "create_planner_tasks",
};

// --- API Webhooks ---

app.all("/bitrix", async (req, res) => {
  const mergedData = { ...req.query, ...req.body };
  try {
    validateBitrixToken(mergedData);
    const functionName = (mergedData.Function as string) || "";
    const workflowName = FUNCTION_WORKFLOW_MAP[functionName] || "example_sync";

    logStep("Webhook Bitrix procesado", {
      method: req.method,
      function: functionName,
      prName: mergedData.PR_Nombre
    });

    const result = await runWorkflow(workflowName, mergedData);
    res.json({ status: "completed", workflow: workflowName, result });
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
});

// --- Management API (para el Dashboard) ---

app.get("/workflows", (req, res) => {
  // Enumerar archivos en lib/workflows (después de compilar)
  // O en src/workflows si estamos en desarrollo
  const workflowsPath = path.join(__dirname, "workflows");
  if (!fs.existsSync(workflowsPath)) return res.json([]);

  const files = fs.readdirSync(workflowsPath);
  const workflows = files
    .filter(f => (f.endsWith(".js") || f.endsWith(".ts")) && !f.startsWith("__"))
    .map(f => {
      const name = f.replace(/\.(js|ts)$/, "");
      return { name, label: name.replace(/_/g, " ").toUpperCase() };
    });
  res.json(workflows);
});

app.get("/schedules", async (req, res) => {
  const db = admin.firestore();
  const snapshot = await db.collection("schedules").get();
  const schedules = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  res.json(schedules);
});

app.post("/schedules", async (req, res) => {
  const { workflowName, cronExpression, intervalMinutes, payload } = req.body;
  const db = admin.firestore();
  const doc = await db.collection("schedules").add({
    workflowName,
    cronExpression,
    intervalMinutes,
    payload,
    isActive: true,
    nextRun: admin.firestore.Timestamp.now() // Ejecutar pronto la primera vez
  });
  res.json({ id: doc.id, message: "Agendamiento creado" });
});

app.delete("/schedules/:id", async (req, res) => {
  const db = admin.firestore();
  await db.collection("schedules").doc(req.params.id).delete();
  res.json({ message: "Agendamiento eliminado" });
});

app.post("/run/:workflowName", async (req, res) => {
  try {
    // Si viene del dashboard (browser), no pedimos API Key por ahora si está en el mismo dominio
    // validateApiKey(req); 
    const result = await runWorkflow(req.params.workflowName, req.body);
    res.json({ status: "success", result });
  } catch (error: any) {
    res.status(403).json({ error: error.message });
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "healthy", service: "TAG-TS-FIREBASE" });
});

export const api = onRequest({ region: "us-central1", timeoutSeconds: 540, memory: "1GiB" }, app);

export const heartbeat = onSchedule("every 1 minutes", async () => {
    const scheduler = new SchedulerService();
    await scheduler.processPendingJobs();
});
