import { google } from 'googleapis';
import { logStep } from '../core/logger';
import { defineString } from 'firebase-functions/params';
import fs from 'fs';

const googleServiceAccountPath = defineString('GOOGLE_SERVICE_ACCOUNT_JSON_PATH');
const googleImpersonateEmail = defineString('GOOGLE_IMPERSONATE_EMAIL');

export class GoogleConnector {
  private auth: any;

  constructor() {
    this.initAuth();
  }

  private initAuth() {
    const keyPath = googleServiceAccountPath.value();
    if (!fs.existsSync(keyPath)) {
      console.warn("Google Service Account JSON not found at path:", keyPath);
      return;
    }

    const auth = new google.auth.GoogleAuth({
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

  async createFolder(name: string, parentFolderId: string): Promise<string> {
    logStep(`Drive: Creando carpeta '${name}'`, { parent: parentFolderId });
    const drive = google.drive({ version: 'v3', auth: this.auth });
    const res = await drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId],
      },
      fields: 'id',
    });
    logStep(`Drive: Carpeta creada → ${res.data.id}`);
    return res.data.id || "";
  }

  async copyFromTemplate(templateId: string, name: string, parentFolderId: string): Promise<string> {
    logStep(`Drive: Copiando template '${templateId}' como '${name}'`);
    const drive = google.drive({ version: 'v3', auth: this.auth });
    const res = await drive.files.copy({
      fileId: templateId,
      requestBody: {
        name,
        parents: [parentFolderId],
      },
      fields: 'id',
    });
    logStep(`Drive: Copia creada → ${res.data.id}`);
    return res.data.id || "";
  }

  async exportAsXlsx(fileId: string): Promise<Buffer> {
    logStep(`Drive: Exportando '${fileId}' como XLSX`);
    const drive = google.drive({ version: 'v3', auth: this.auth });
    const res = await drive.files.export({
      fileId,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }, { responseType: 'arraybuffer' });
    return Buffer.from(res.data as ArrayBuffer);
  }

  async updateNamedRanges(spreadsheetId: string, namedRangeValues: Record<string, any>) {
    const sheets = google.sheets({ version: 'v4', auth: this.auth });
    const data = Object.entries(namedRangeValues).map(([name, value]) => ({
      range: name,
      values: [[String(value || "")]]
    }));

    if (data.length === 0) return;

    logStep(`Sheets: Actualizando ${data.length} named ranges`);
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data,
      }
    });
  }

  async updateRow(spreadsheetId: string, sheetName: string, rowNumber: number, colValues: Record<number, any>) {
      const sheets = google.sheets({ version: 'v4', auth: this.auth });
      const data = Object.entries(colValues).map(([colIdx, value]) => {
          const colLetter = this.colIndexToLetter(Number(colIdx));
          return {
              range: `'${sheetName}'!${colLetter}${rowNumber}`,
              values: [[String(value || "")]]
          };
      });

      if (data.length === 0) return;

      logStep(`Sheets: updateRow '${sheetName}'!${rowNumber}`);
      await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: {
              valueInputOption: 'USER_ENTERED',
              data,
          }
      });
  }

  private colIndexToLetter(index: number): string {
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
