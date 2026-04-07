# OpenSpec: Logic & Architecture Patterns 🏗️ 🧠

This document describes the high-level logic patterns and architectural safety guards implemented in the Auto-TAG framework.

## 1. Smart-Linking Pattern (Bitrix CRM Links)
Instead of importing technical references as plain text, the system converts references into clickable Bitrix entities using the `T{HEX_ID}_{ID}` format.

*   **Logic**:
    1.  Search for the entity (e.g., Doc Code `ELE-0032`) in its corresponding SPA (e.g., `1058`).
    2.  If found, retrieve its internal Bitrix `ID`.
    3.  Convert the SPA `EntityTypeID` to Hex (e.g., `1058` -> `422`).
    4.  Generate the link string: `T422_95`.
    5.  Populate the `crm` type field in Bitrix.

## 2. Cross-Sheet Data Fusion
The import process creates a virtual record by joining two distinct Excel sheets:
*   **ANEXO 2 (Structure)**: Defines the "what" (Specialty, Sigla, Type, Description).
*   **Presupuesto (Volume)**: Defines the "how many" (Quantity/Cantidad).
*   **Link Key**: Both sheets are joined via the `CÓDIGO` column (Column 1 in Anexo, Column 2 in Presupuesto).

## 3. Safe-Edit & Audit Policy
To prevent data loss in Bitrix24, the framework follows these rules:
*   **No Destructive Actions**: The `BitrixConnector` is restricted from using `DELETE` methods in production.
*   **Audit Logs**: Every creation or update is logged to Firestore (`/logs`) with the pre-change state and parameters used.
*   **Hidden Row Awareness**: The parser explicitly respects Excel filters. Rows marked as `hidden: true` are skipped to match the User's visual selection in the spreadsheet.

## 4. Multi-Tenant / Project Isolation
The framework distinguishes between different business units (e.g., VC vs TAG) using:
*   **Category Isolation**: Using `categoryId` to keep "Apertura PR" items in separate logical pipelines.
*   **Entity Mapping**: Different `entityTypeIDs` are reserved for different types of technical documentation.

## 5. Technology Transition (Python to TS)
*   **Legacy (Python)**: Used for rapid prototyping and manual local execution (`src/scripts/`).
*   **Production (TypeScript)**: Deployed as Firebase Cloud Functions (`functions/src/workflows/`) for serverless reliability and automatic scaling.
