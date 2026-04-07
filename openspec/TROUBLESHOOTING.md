# OpenSpec: Troubleshooting & Error Guide 🚑 🛠️

Common issues and solutions for the Auto-TAG ecosystem.

## 1. Bitrix Integration Errors

| Error | Cause | Solution |
| :--- | :--- | :--- |
| **"401 Unauthorized"** | `BITRIX_WEB_TOKEN` is incorrect or expired. | Update secret in Firebase (`BITRIX_WEB_TOKEN`). |
| **"Could not find PR"** | The folder name doesn't match the `title` in SPA 1096. | Check for trailing spaces or special characters in the filename. |
| **"Access Denied: DELETE"** | Safety policy blocked a deletion attempt. | Deletions must be performed manually in Bitrix. |

---

## 2. Microsoft SharePoint/Graph Errors

| Error | Cause | Solution |
| :--- | :--- | :--- |
| **"404 Not Found"** | File `OTI-2385-26.xlsm` is missing from the `Bitrix Export` folder. | Verify file path in SharePoint. |
| **"Invalid driveId"** | The default `DRIVE_ID` in `config` is for a different tenant. | Check `firebase config:get` or environment variables. |
| **"Templates Folder Restriction"** | Attempting to write to `Templates/`. | Change `folder_path` to `Bitrix/Bitrix Export` or similar. |

---

## 3. Data & Excel Issues

| Issue | Observation | Solution |
| :--- | :--- | :--- |
| **Hidden rows not skipped** | The `only_first_visible` flag is ignored. | Check `sheet.getRow(i).hidden` property in `ExcelJS`. |
| **Zero quantity found** | Document code not found in the `Presupuesto` sheet. | Ensure the code exists in Column 2 of `Presupuesto`. |
| **Links not appearing blue** | The `TXXX_YYY` format is wrong. | Check `MASTER_MAPPING.md` for correct Hex IDs. |

---

## 4. System & Cloud Errors

| Error | Cause | Solution |
| :--- | :--- | :--- |
| **Function Timeout** | Excel file is too large (2,000+ rows). | Standard timeout is 540s. Increase if necessary. |
| **Memory Limit Hit** | Excel processing uses > 1GB RAM. | Update function memory in `index.ts`. |
