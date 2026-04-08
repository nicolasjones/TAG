import { main } from './workflows/import_excel';
import * as dotenv from 'dotenv';
import path from 'path';

// Cargar .env desde la raíz del proyecto para testing local
dotenv.config({ path: path.join(__dirname, '../.env') });

const testPayload = {
    PR_Nombre: "OTI-2385-26", // El archivo Excel en SharePoint tiene este nombre
};

async function runTest() {
    process.env.DEBUG = "true";
    console.log("🚀 Lanzando RE-TEST de Importación (TypeScript)...");
    try {
        // Ejecutamos el flujo principal de importación
        const result = await main(testPayload);
        console.log("✅ RESULTADO:", JSON.stringify(result, null, 2));
    } catch (error: any) {
        console.error("❌ ERROR DURANTE EL TEST:", error.message);
        if (error.response?.data) {
            console.error("📦 DETALLE BITRIX:", JSON.stringify(error.response.data, null, 2));
        }
    }
}

runTest();
