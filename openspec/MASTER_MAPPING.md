# OpenSpec: Technical Mapping Master 🗺️ 🔗

This document serves as the **Single Source of Truth** for technical mappings between Microsoft Excel and Bitrix24 SPA (Smart Process Automation) entities.

## 1. Bitrix24 SPA Entities (EntityTypeIDs)

| Entity Name | EntityTypeID | Purpose |
| :--- | :---: | :--- |
| **Apertura PR** | `1040` | Main operational entity for document imports and approvals. |
| **PR (Project)** | `1096` | High-level project metadata (OTI, Budget, Client). |
| **Ingeniería** | `1100` | Detailed engineering tasks and document tracking. |
| **Remitos** | `1044` | Logistics and delivery documentation. |
| **Electricidad** | `1058` | Specialty-specific technical repository (ELE-XXXX). |
| **Piping** | `1054` | Specialty-specific technical repository (PI-XXXX). |
| **Procesos** | `1088` | Specialty-specific technical repository (PR-XXXX). |
| **Mecánica** | `1092` | Specialty-specific technical repository (MC-XXXX). |

---

## 2. Field Mapping: Apertura PR (EntityType 1040)

Mappings used in `import_excel.ts` / `import_sharepoint_to_bitrix.py`.

| Bitrix Field ID | Label | Source (Excel) | Data Type | Logic / Note |
| :--- | :--- | :--- | :--- | :--- |
| `title` | **Document ID** | Sheet: ANEXO 2, Col 1 | String | e.g. ELE-0032 |
| `ufCrm7_1744936769` | **PR** | Filename | CRM Link (T448_X) | Links to Project ID in SPA 1096. |
| `ufCrm7_1745325896` | **Código TAG** | Sheet: ANEXO 2, Col 1 | String | Same as title. |
| `ufCrm7_1745851966` | **Registro Link** | Computed | CRM Link | Link to specialty item (e.g. T422_X). |
| `ufCrm7_1745930888` | **Documentos** | Computed | CRM Link (Multi) | List of linked technical items. |
| `ufCrm7_1748528841` | **Sigla del Doc** | Sheet: ANEXO 2, Col 4 | String | e.g. "P" (Project). |
| `ufCrm7_1750186793` | **Tipo de Doc** | Sheet: ANEXO 2, Col 5 | String | e.g. "MC" (Memoria Cálculo). |
| `ufCrm7_1775580329` | **Descripción Doc** | Sheet: ANEXO 2, Col 7 | String | Full doc name. |
| `ufCrm7_1747326026` | **Cantidad a crear** | Sheet: Presupuesto, Col 1| Double | Extracted via Code match in Col 2. |
| `ufCrm7_1748545118` | **Desp. por Hojas** | Sheet: ANEXO 2, Col 9 | Boolean (Y/N) | "Y" if Col 9 contains "HOJA". |
| `ufCrm7_1747688217` | **Tipo de Revisión**| Hardcoded / Mapping | Enumeration | Default: 69 (LETRA). |
| `ufCrm7_1747688317` | **Línea Contrato** | Hardcoded / Mapping | Enumeration | Default: 77 (ESTANDAR). |
| `ufCrm7_1747688282` | **HS Totales** | Computed | Double | Mocked: 1. |
| `ufCrm7_1747688577` | **Hojas por Doc** | Computed | Double | Mocked: 1. |

---

## 3. Enumeration Values (Enums)

### Tipo de Revisión (`ufCrm7_1747688217`)
*   `69`: **LETRA** (A, B, C...)
*   `71`: **NÚMERO** (0, 1, 2...)
*   `73`: **CO**
*   `75`: **PID**

### Línea de Contrato (`ufCrm7_1747688317`)
*   `77`: **ESTANDAR**
*   `79`: **HORA ESPECIAL**
*   `81`: **RASTREO M2**
*   `83`: **DIA DE RASTREO**
*   `85`: **TRABAJO ESPECIAL (FACTURA)**

---

## 4. Specialty Sub-Process Mapping (Links)

When importing documents, the system searches for existing items in these specific SPAs to create technical links:

| Specialty Text (Excel) | Bitrix SPA ID | Hex ID (for Links) |
| :--- | :---: | :---: |
| **ELECTRICIDAD** | `1058` | `422` |
| **PIPING** | `1054` | `41E` |
| **PROCESOS** | `1088` | `440` |
| **MECÁNICA** | `1092` | `444` |
| **INSTRUMENTOS** | `1066` | `42A` |
| **ESCÁN_LASER** | `1072` | `430` |
| **ESTUDIOS_ESP** | `1076` | `434` |
| **ARQUITECTURA** | `1048` | `418` |
| **PR (Project)** | `1096` | `448` |

---

## 5. Stages & Categories

*   **Apertura PR (1040)**:
    *   **Category ID**: `13`
    *   **Stage ID (Aprobado)**: `DT1040_13:UC_A0X4JS`
