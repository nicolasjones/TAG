# OpenSpec: Infrastructure & Scaling (Firebase) ☁️ 🛡️

## 1. Firebase Cloud Functions (Typescript)
*   **Version**: Node.js 20+
*   **Source**: `/functions`
*   **API**: Express.js router for `/api/*` webhooks and management.
*   **Deploy**: `firebase deploy --only functions`

## 2. Secrets Management (Firebase Secrets Manager)
To ensure system security, the following secrets must be loaded via `firebase functions:secrets:set`:
*   `BITRIX_WEBHOOK_URL`: The master webhook URL for Bitrix24.
*   `AZURE_CLIENT_ID`: OAuth Client ID for Microsoft Graph.
*   `AZURE_CLIENT_SECRET`: OAuth Secret for Microsoft Graph.
*   `AZURE_TENANT_ID`: Microsoft Azure Tenant ID.
*   `GEMINI_API_KEY`: API Key for Google Generative AI.
*   `OPENAI_API_KEY`: API Key for OpenAI.

## 3. Firestore Schema
*   `/jobs/{id}`:
    *   `workflow`: string (name)
    *   `payload`: object
    *   `scheduledAt`: timestamp
    *   `status`: enum ("pending", "completed", "failed")
*   `/logs/{id}`:
    *   `timestamp`: timestamp
    *   `workflow`: string
    *   `steps`: array of object (severity, message, params)

## 4. Frontend (Hosting)
*   **Framework**: React 19 + TypeScript.
*   **Tooling**: Vite 8.
*   **Public path**: `src/frontend/dist`
