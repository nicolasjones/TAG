"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleConnector = void 0;
const googleapis_1 = require("googleapis");
const logger_1 = require("../core/logger");
const params_1 = require("firebase-functions/params");
const fs_1 = __importDefault(require("fs"));
const googleServiceAccountPath = (0, params_1.defineString)('GOOGLE_SERVICE_ACCOUNT_JSON_PATH');
const googleImpersonateEmail = (0, params_1.defineString)('GOOGLE_IMPERSONATE_EMAIL');
class GoogleConnector {
    auth;
    constructor() {
        this.initAuth();
    }
    initAuth() {
        const keyPath = googleServiceAccountPath.value();
        if (!fs_1.default.existsSync(keyPath)) {
            console.warn("Google Service Account JSON not found at path:", keyPath);
            return;
        }
        const auth = new googleapis_1.google.auth.GoogleAuth({
            keyFile: keyPath,
            scopes: [
                'https://www.googleapis.com/auth/drive',
                'https://www.googleapis.com/auth/spreadsheets',
            ],
            clientOptions: {
                subject: googleImpersonateEmail.value() || undefined
            }
        });
        this.auth = auth;
    }
    async createFolder(name, parentFolderId) {
        (0, logger_1.logStep)(`Drive: Creando carpeta '${name}'`, { parent: parentFolderId });
        const drive = googleapis_1.google.drive({ version: 'v3', auth: this.auth });
        const res = await drive.files.create({
            requestBody: {
                name,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [parentFolderId],
            },
            fields: 'id',
        });
        (0, logger_1.logStep)(`Drive: Carpeta creada → ${res.data.id}`);
        return res.data.id || "";
    }
    async copyFromTemplate(templateId, name, parentFolderId) {
        (0, logger_1.logStep)(`Drive: Copiando template '${templateId}' como '${name}'`);
        const drive = googleapis_1.google.drive({ version: 'v3', auth: this.auth });
        const res = await drive.files.copy({
            fileId: templateId,
            requestBody: {
                name,
                parents: [parentFolderId],
            },
            fields: 'id',
        });
        (0, logger_1.logStep)(`Drive: Copia creada → ${res.data.id}`);
        return res.data.id || "";
    }
    async exportAsXlsx(fileId) {
        (0, logger_1.logStep)(`Drive: Exportando '${fileId}' como XLSX`);
        const drive = googleapis_1.google.drive({ version: 'v3', auth: this.auth });
        const res = await drive.files.export({
            fileId,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }, { responseType: 'arraybuffer' });
        return Buffer.from(res.data);
    }
    async updateNamedRanges(spreadsheetId, namedRangeValues) {
        const sheets = googleapis_1.google.sheets({ version: 'v4', auth: this.auth });
        const data = Object.entries(namedRangeValues).map(([name, value]) => ({
            range: name,
            values: [[String(value || "")]]
        }));
        if (data.length === 0)
            return;
        (0, logger_1.logStep)(`Sheets: Actualizando ${data.length} named ranges`);
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            requestBody: {
                valueInputOption: 'USER_ENTERED',
                data,
            }
        });
    }
    async updateRow(spreadsheetId, sheetName, rowNumber, colValues) {
        const sheets = googleapis_1.google.sheets({ version: 'v4', auth: this.auth });
        const data = Object.entries(colValues).map(([colIdx, value]) => {
            const colLetter = this.colIndexToLetter(Number(colIdx));
            return {
                range: `'${sheetName}'!${colLetter}${rowNumber}`,
                values: [[String(value || "")]]
            };
        });
        if (data.length === 0)
            return;
        (0, logger_1.logStep)(`Sheets: updateRow '${sheetName}'!${rowNumber}`);
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            requestBody: {
                valueInputOption: 'USER_ENTERED',
                data,
            }
        });
    }
    colIndexToLetter(index) {
        let result = "";
        let n = index + 1;
        while (n > 0) {
            const remainder = (n - 1) % 26;
            result = String.fromCharCode(65 + remainder) + result;
            n = Math.floor((n - 1) / 26);
        }
        return result;
    }
}
exports.GoogleConnector = GoogleConnector;
//# sourceMappingURL=google.js.map