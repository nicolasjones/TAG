# OpenSpec: Security & Maintenance 🛡️ 💡

This document summarizes the security framework and operational maintenance of the Auto-TAG ecosystem.

## 1. Secrets Management (Firebase Secrets Manager)
All API keys and credentials are stored securely via `firebase functions:secrets:set`.

| Secret Name | Purpose | Scope |
| :--- | :--- | :--- |
| `BITRIX_WEB_TOKEN` | Bitrix24 webhook inbound token. | Authentication. |
| `AZURE_CLIENT_ID` | Microsoft Graph OAuth ID. | Connectors. |
| `AZURE_CLIENT_SECRET` | Microsoft Graph OAuth Secret. | Connectors. |
| `GEMINI_API_KEY` | Google AI integration. | Connectors. |
| `OPENAI_API_KEY` | OpenAI fallback logic. | Connectors. |
| `INTERNAL_API_KEY` | X-API-KEY for management calls. | Management. |

---

## 2. Safe-Edit & Multi-Tenant Isolation
The `BitrixConnector` and `AzureCustomConnector` implement these guards:

*   **Destructive Method Block**: JavaScript/TS `DELETE` methods are explicitly blocked for production SPA IDs.
*   **Path Restriction**: SharePoint access is restricted to `Bitrix/` and `Templates/` folders via path prefix validation.
*   **Pipeline Isolation**: Multi-project logic (VC vs TAG) is isolated via `categoryId` and `entityTypeId` filters to prevent data leakage.

---

## 3. Maintenance Protocols

### Credential Rotation
Azure Client Secrets expire (typically 1–2 years). Update with:
`firebase functions:secrets:set AZURE_CLIENT_SECRET="NEW_SECRET"` followed by `firebase deploy`.

### Logs & Auditing
Log data is persistent in **Google Cloud Logs (Stackdriver)** and **Firestore (`/logs`)**:
*   **Critical Alerts**: Severity 3+ (Errors) in Cloud Logs.
*   **Execution History**: Metadata for each workflow run in Firestore.

### Version Support
*   **Node.js**: v20 or higher.
*   **ExcelJS**: v4.4+.
*   **Bitrix Rest**: v1.
