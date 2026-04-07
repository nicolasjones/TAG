# OpenSpec: API Reference (Firebase Functions) 📡 ⚙️

This document describes the HTTP endpoints for the Auto-TAG framework (Firebase Edition).

## 1. Webhook Endpoints (Public/Bitrix)

### Bitrix Inbound (`POST /api/bitrix`)
*   **Trigger**: Bitrix24 Robot or Webhook.
*   **Method**: `POST` (application/json or application/x-www-form-urlencoded).
*   **Required Params**: 
    *   `Function`: string (`CREATE_PR`, `SET_DATES_AP_PR`, `CREATE_PLANNER_TASKS`)
    *   `PR_Nombre`: string (Project code, e.g. OTI-2385-26)
    *   `PR_ID`: number (Bitrix Item ID in SPA 1096)

---

### Microsoft Azure / SharePoint (`POST /api/azure`)
*   **Trigger**: Power Automate or Graph Webhook.
*   **Security**: Requires `X-API-KEY` header.
*   **Status**: Primarily used for `example_sync` or future SharePoint notifications.

---

## 2. Management Endpoints (Dashboard/Manual)

### Import Excel (`POST /api/run/import_excel`)
*   **Security**: Restricted via API Key.
*   **Body**:
    ```json
    {
      "file_name": "OTI-2385-26.xlsm",
      "folder_path": "Bitrix/Bitrix Export",
      "only_first_visible": false
    }
    ```
*   **Output**: Success status and count of processed items.

---

### Control Documental (`POST /api/run/control_documental`)
*   **Security**: Restricted via API Key.
*   **Body**:
    ```json
    {
      "folder_name": "01_PROYECTO_A"
    }
    ```
*   **Logic**: Syncs OTI numbers from master Excel back to Bitrix SPA 1100/1120.

---

## 3. Health & Monitoring

### Health Check (`GET /api/health`)
*   **Returns**: `{ "status": "healthy", "service": "TAG-TS-FIREBASE" }`
*   **Purpose**: Uptime robot monitoring and deployment validation.
