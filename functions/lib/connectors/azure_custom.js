"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AzureCustomConnector = void 0;
const axios_1 = __importDefault(require("axios"));
const firebase_functions_1 = require("firebase-functions");
const params_1 = require("firebase-functions/params");
const azureClientId = (0, params_1.defineString)('AZURE_CLIENT_ID');
const azureClientSecret = (0, params_1.defineString)('AZURE_CLIENT_SECRET');
const azureTenantId = (0, params_1.defineString)('AZURE_TENANT_ID');
const plannerPlanId = (0, params_1.defineString)('PLANNER_PLAN_ID');
const plannerBucketId = (0, params_1.defineString)('PLANNER_BUCKET_ID');
const debugMode = (0, params_1.defineBoolean)('DEBUG', { default: false });
class AzureCustomConnector {
    accessToken = null;
    tokenExpires = 0;
    graphUrl = "https://graph.microsoft.com/v1.0";
    async getAccessToken() {
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
            const response = await axios_1.default.post(url, params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            const data = response.data;
            this.accessToken = data.access_token;
            this.tokenExpires = now + data.expires_in - 60;
            return this.accessToken;
        }
        catch (error) {
            firebase_functions_1.logger.error(`Error obteniendo token de Azure: ${error.message}`);
            throw error;
        }
    }
    async execute(method, path, params = {}, data = null) {
        const allowedRoots = ["Bitrix", "Templates"];
        const authorizedPlan = plannerPlanId.value();
        const authorizedBucket = plannerBucketId.value();
        const cleanPath = path.startsWith('/') ? path.slice(1) : path;
        if (cleanPath.includes("drives/") && cleanPath.includes("/root:/")) {
            const targetPath = cleanPath.split("/root:/")[1];
            if (!targetPath || !allowedRoots.some(root => targetPath.startsWith(root))) {
                firebase_functions_1.logger.error(`HARD BLOCK: Acceso fuera de ${allowedRoots} denegado: ${targetPath}`);
                throw new Error(`Seguridad: Acceso restringido a las carpetas ${allowedRoots} solamente.`);
            }
        }
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
        const blockedPaths = ["groups", "sites", "users"];
        if (blockedPaths.some(bp => cleanPath.startsWith(bp)) && !debugMode.value()) {
            firebase_functions_1.logger.warn(`HARD BLOCK: Intento de navegación de ${cleanPath} bloqueado.`);
            throw new Error(`Seguridad: No se permite navegar '${cleanPath}' fuera de las rutas autorizadas.`);
        }
        const token = await this.getAccessToken();
        const url = `${this.graphUrl}/${cleanPath}`;
        try {
            const isContent = cleanPath.endsWith('/content');
            const response = await (0, axios_1.default)({
                method,
                url,
                params,
                data,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': isContent ? 'application/octet-stream' : 'application/json'
                },
                responseType: isContent ? 'arraybuffer' : 'json',
                timeout: 60000
            });
            return response.data;
        }
        catch (error) {
            firebase_functions_1.logger.error(`Error en Microsoft Graph (${cleanPath}): ${error.message}`, error.response?.data);
            throw error;
        }
    }
    validatePath(path) {
        let p = path.replace(/^\/+/, '');
        if (!["Bitrix", "Templates"].some(r => p.startsWith(r))) {
            p = `Bitrix/${p}`;
        }
        return p;
    }
    async createFolder(driveId, parentPath, folderName) {
        let pPath = parentPath.startsWith('/') ? parentPath.slice(1) : parentPath;
        if (!["Bitrix", "Templates"].some(r => pPath.startsWith(r))) {
            pPath = `Bitrix/${pPath}`;
        }
        pPath = pPath.replace(/\/+$/, '');
        try {
            return await this.execute("GET", `drives/${driveId}/root:/${pPath}/${folderName}`);
        }
        catch (err) {
            const path = `drives/${driveId}/root:/${pPath}:/children`;
            const data = {
                name: folderName,
                folder: {},
                "@microsoft.graph.conflictBehavior": "fail"
            };
            return await this.execute("POST", path, {}, data);
        }
    }
    async uploadFile(driveId, folderPath, filename, content) {
        const fPath = this.validatePath(folderPath);
        if (fPath.toLowerCase().startsWith("templates")) {
            throw new Error(`Seguridad: La carpeta 'Templates' es solo de lectura.`);
        }
        const token = await this.getAccessToken();
        const url = `${this.graphUrl}/drives/${driveId}/root:/${fPath}/${filename}:/content`;
        const response = await axios_1.default.put(url, content, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/octet-stream'
            }
        });
        return response.data;
    }
    async createPlannerTask(planId, bucketId, title, options = {}) {
        const data = {
            planId,
            bucketId,
            title
        };
        if (options.startDt)
            data.startDateTime = options.startDt;
        if (options.dueDt)
            data.dueDateTime = options.dueDt;
        return await this.execute("POST", "planner/tasks", {}, data);
    }
    async updateTaskDetails(taskId, description, etag) {
        const token = await this.getAccessToken();
        const url = `${this.graphUrl}/planner/tasks/${taskId}/details`;
        const response = await axios_1.default.patch(url, { description }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'If-Match': etag,
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    }
}
exports.AzureCustomConnector = AzureCustomConnector;
//# sourceMappingURL=azure_custom.js.map