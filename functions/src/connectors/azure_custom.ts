import axios from 'axios';
import { logger } from 'firebase-functions';
import { defineString, defineBoolean } from 'firebase-functions/params';

// Firebase Secrets/Params
const azureClientId = defineString('AZURE_CLIENT_ID');
const azureClientSecret = defineString('AZURE_CLIENT_SECRET');
const azureTenantId = defineString('AZURE_TENANT_ID');
const plannerPlanId = defineString('PLANNER_PLAN_ID');
const plannerBucketId = defineString('PLANNER_BUCKET_ID');
const debugMode = defineBoolean('DEBUG', { default: false });

export class AzureCustomConnector {
  private accessToken: string | null = null;
  private tokenExpires: number = 0;
  private readonly graphUrl = "https://graph.microsoft.com/v1.0";

  /**
   * Obtiene un token de acceso OAuth2 para Microsoft Graph.
   */
  private async getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.accessToken && now < this.tokenExpires) {
      return this.accessToken;
    }

    const url = `https://login.microsoftonline.com/${azureTenantId.value()}/oauth2/v2.0/token`;
    const params = new URLSearchParams();
    params.append('client_id', azureClientId.value());
    params.append('scope', 'https://graph.microsoft.com/.default');
    params.append('client_secret', azureClientSecret.value());
    params.append('grant_type', 'client_credentials');

    try {
      const response = await axios.post(url, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      const data = response.data;
      this.accessToken = data.access_token;
      this.tokenExpires = now + data.expires_in - 60;
      return this.accessToken!;
    } catch (error: any) {
      logger.error(`Error obteniendo token de Azure: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ejecuta una petición a Microsoft Graph con GUARDRAILS ESTRICTOS.
   */
  async execute(method: string, path: string, params: any = {}, data: any = null): Promise<any> {
    const allowedRoots = ["Bitrix", "Templates"];
    const authorizedPlan = plannerPlanId.value();
    const authorizedBucket = plannerBucketId.value();

    const cleanPath = path.startsWith('/') ? path.slice(1) : path;

    // 1. SEGURIDAD: SharePoint Paths
    if (cleanPath.includes("drives/") && cleanPath.includes("/root:/")) {
      const targetPath = cleanPath.split("/root:/")[1];
      if (!targetPath || !allowedRoots.some(root => targetPath.startsWith(root))) {
        logger.error(`HARD BLOCK: Acceso fuera de ${allowedRoots} denegado: ${targetPath}`);
        throw new Error(`Seguridad: Acceso restringido a las carpetas ${allowedRoots} solamente.`);
      }
    }

    // 2. SEGURIDAD: Microsoft Planner
    if (cleanPath.includes("planner/")) {
      if (cleanPath.includes("plans/")) {
        const p_id = cleanPath.split("plans/")[1].split("/")[0];
        if (authorizedPlan && p_id !== authorizedPlan) {
          throw new Error(`Seguridad: Intento de acceso a Plan no autorizado (${p_id}).`);
        }
      }

      if (data && typeof data === 'object') {
        if (data.planId && authorizedPlan && data.planId !== authorizedPlan) {
          throw new Error("Seguridad: planId no autorizado en el cuerpo de la petición.");
        }
        if (data.bucketId && authorizedBucket && data.bucketId !== authorizedBucket) {
          throw new Error("Seguridad: bucketId no autorizado en el cuerpo de la petición.");
        }
      }
    }

    // 3. SEGURIDAD: Bloqueo de navegación
    const blockedPaths = ["groups", "sites", "users"];
    if (blockedPaths.some(bp => cleanPath.startsWith(bp)) && !debugMode.value()) {
        logger.warn(`HARD BLOCK: Intento de navegación de ${cleanPath} bloqueado.`);
        throw new Error(`Seguridad: No se permite navegar '${cleanPath}' fuera de las rutas autorizadas.`);
    }

    const token = await this.getAccessToken();
    const url = `${this.graphUrl}/${cleanPath}`;

    try {
      const response = await axios({
        method,
        url,
        params,
        data,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      });
      return response.data;
    } catch (error: any) {
      logger.error(`Error en Microsoft Graph (${cleanPath}): ${error.message}`, error.response?.data);
      throw error;
    }
  }

  // --- Helpers ---

  private validatePath(path: string): string {
    let p = path.replace(/^\/+/, '');
    if (!["Bitrix", "Templates"].some(r => p.startsWith(r))) {
      p = `Bitrix/${p}`;
    }
    return p;
  }

  async createFolder(driveId: string, parentPath: string, folderName: string): Promise<any> {
    let pPath = parentPath.startsWith('/') ? parentPath.slice(1) : parentPath;
    if (!["Bitrix", "Templates"].some(r => pPath.startsWith(r))) {
      pPath = `Bitrix/${pPath}`;
    }
    pPath = pPath.replace(/\/+$/, '');

    try {
      // Intentar obtener si existe
      return await this.execute("GET", `drives/${driveId}/root:/${pPath}/${folderName}`);
    } catch (err) {
      // Si no existe, crear
      const path = `drives/${driveId}/root:/${pPath}:/children`;
      const data = {
        name: folderName,
        folder: {},
        "@microsoft.graph.conflictBehavior": "fail"
      };
      return await this.execute("POST", path, {}, data);
    }
  }

  async uploadFile(driveId: string, folderPath: string, filename: string, content: Buffer): Promise<any> {
    const fPath = this.validatePath(folderPath);
    if (fPath.toLowerCase().startsWith("templates")) {
        throw new Error(`Seguridad: La carpeta 'Templates' es solo de lectura.`);
    }

    const token = await this.getAccessToken();
    const url = `${this.graphUrl}/drives/${driveId}/root:/${fPath}/${filename}:/content`;

    const response = await axios.put(url, content, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/octet-stream'
      }
    });
    return response.data;
  }

  async createPlannerTask(planId: string, bucketId: string, title: string, options: { startDt?: string, dueDt?: string } = {}): Promise<any> {
    const data: any = {
      planId,
      bucketId,
      title
    };
    if (options.startDt) data.startDateTime = options.startDt;
    if (options.dueDt) data.dueDateTime = options.dueDt;

    return await this.execute("POST", "planner/tasks", {}, data);
  }

  async updateTaskDetails(taskId: string, description: string, etag: string): Promise<any> {
    const token = await this.getAccessToken();
    const url = `${this.graphUrl}/planner/tasks/${taskId}/details`;

    const response = await axios.patch(url, { description }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'If-Match': etag,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  }
}
