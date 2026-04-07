# OpenSpec: Research Notes & Discovery 🧪 🔍

This document captures the technical discoveries and "Gotchas" found during the development of the Auto-TAG framework.

## 1. Excel Structure Insights (TAG Standard)
*   **Header Row**: Standard engineering headers start at **Row 4** in "ANEXO 2".
*   **Hidden Rows**: Key finding – Excel often contains 500+ legacy or filtered rows. Logic **MUST** check `row.hidden` to avoid importing garbage data.
*   **Sheet "Presupuesto"**: Row 7 starts the mapping. Column 2 is the Join Key (Doc Code) and Column 1 contains the definitive Quantity.

## 2. Bitrix24 Discovery (SPAs & States)
*   **Apertura PR (1040)**:
    *   **Pipeline ID**: 13 (Default)
    *   **Aprobado Stage**: `DT1040_13:UC_A0X4JS`.
*   **Specialty SPAs**:
    *   `1058` (Electricidad): Standard prefix `ELE-`.
    *   `1054` (Piping): Standard prefix `PI-`.
*   **Smart Links**: Bitrix expects `T{HEX_ENTITY_TYPE}_{ITEM_ID}` for CRM Reference fields. Hex of 1058 = `422`, 1096 = `448`.

## 3. Test Log & Validation
*   **PR OTI-2385-26**: Confirmed as item ID `423` in SPA 1096.
*   **Test Case ELE-0032**:
    *   Found at Row 267 of OTI-2385-26.xlsm.
    *   Successfully created item `5545` and `5549` in Apertura PR.
    *   Verified inclusion of 7 custom fields (HS, Hojas, Cantidad, Despliegue).

## 4. Current TypeScript Research Tools
Located in `functions/src/research/`:
*   `scan_excel.ts`: Replaces Python `scan_anexo2_headers.py`.
*   `audit_bitrix.ts`: Replaces Python `audit_creations.py`.
