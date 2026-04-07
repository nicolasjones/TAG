# OpenSpec: Operational Workflows (TypeScript) 🛠️ 🤖

## 1. Create PR (Apertura)
**Trigger**: Make.com / Bitrix Webhook
**Goal**: Create an Excel PR documentation and Planner Task from a Bitrix SPA item.
**Flow**: 
*   Fetches PR metadata from Bitrix SPA 1096.
*   Downloads XLSX template from SharePoint (`Bitrix/Templates/`).
*   Replaces placeholders (`{{NOMBRE}}`, etc.) using ExcelJS.
*   Populates "APERTURA DE PR" sheet with child items from SPA 1040.
*   Uploads result to `${PR_ROOT}/${PR_NAME}.xlsx`.
*   Creates a Microsoft Planner task with the Excel link in its description.

## 2. Control Documental (OTI Sync)
**Trigger**: Scheduler (1m) / Manual Dashboard
**Goal**: Sync Bitrix items with OTI numbers from Excel.
**Flow**:
*   Downloads the "Master Excel" OTI sheet from SharePoint.
*   Matches rows by OTI ID.
*   Updates "Conforme a Obra" SPA 1120 items in Bitrix.

## 3. Create Planner Tasks (Heartbeat)
**Trigger**: Firebase Scheduler / Heartbeat function
**Goal**: Bulk-create tasks for engineering PRs.
**Flow**:
*   Executes logic based on specific category IDs in Bitrix.
*   Orchestrates creation of task lists in Microsoft Planner.

## 4. Import Excel (Excel -> Bitrix)
**Trigger**: Manual Dashboard / Script Execution
**Goal**: Import "Anexo 2" rows to Bitrix items with project-specific quantities.
**Flow**: 
1.  **Parse "ANEXO 2" (Items)**: Extracts document identifiers, specialties, and technical signatures.
2.  **Crossover with "Presupuesto" (Quantities)**: Matches the document ID to find the project-specific volume (Column 1).
3.  **Smart Link Discovery**: Searches Bitrix specialty SPAs (e.g., Electricidad, Piping) to find existing technical records.
4.  **Create Entry**: Generates an item in **SPA 1040 (Apertura PR)**, Category 13, Stage "Aprobado".

### Column Mapping (Source: ANEXO 2)
*   **Col 1**: Código TAG / Documento ID.
*   **Col 2**: Especialidad (used for SPA routing).
*   **Col 4**: Sigla del Documento (P/L/etc).
*   **Col 5**: Tipo de Documento (Sigla MC/CU/etc).
*   **Col 7**: Descripción (Full Document Name).
*   **Col 9**: Unidad de Medida (determines "Despliegue por Hojas").

### Column Mapping (Source: Presupuesto)
*   **Col 1**: Cantidad a crear.
*   **Col 2**: Código TAG (Joins with Anexo 2).
