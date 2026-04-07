# OpenSpec: DevOps & Maintenance Guide 🚀 🐚

Deployment, versioning, and environment setup for the Auto-TAG ecosystem.

## 1. Local Environment Setup

### Requirements:
*   **Node.js**: v20 or higher.
*   **Firebase CLI**: `npm install -g firebase-tools`.

### Local Build:
1.  Navigate to `functions/`: `cd functions`.
2.  Install dependencies: `npm install`.
3.  Compile TypeScript: `npm run build`.

---

## 2. Deployment (Production)

To deploy with zero downtime:
```bash
# 1. Update secrets (only if changed)
firebase functions:secrets:set AZURE_CLIENT_ID="..."

# 2. Deploy only the functions
firebase deploy --only functions

# 3. Deploy Firestore indexes (only if rules changed)
firebase deploy --only firestore
```

---

## 3. Scaling & Resource Limits
Current Firebase Function configuration (`functions/src/index.ts`):
*   **Region**: `us-central1`.
*   **Memory**: `1GB`.
*   **Timeout**: `540 seconds` (Maximum allowed for HTTPS).
*   **Concurrency**: Enabled by default in v2.

---

## 4. Monitoring & Logs
1.  **Firebase Console**: Go to the "Functions" tab → "Logs".
2.  **Google Cloud Console**: Go to `Logs Explorer` and filter by the `api` function name.
3.  **Audit Logs**: Query the `logs/` Firestore collection to see historical job metadata.

---

## 5. Branch Strategy
*   `main`: Stable production branch (autodeploy to Firebase).
*   `_OLD_PYTHON_BACKUP_`: Historical archive of Python code.
*   `src/scripts`: Legacy Python tools for manual execution.
