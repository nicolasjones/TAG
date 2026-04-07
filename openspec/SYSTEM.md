# OpenSpec: Auto-TAG Framework (Firebase Edition) 🛡️ 🚀

## Overview
Auto-TAG is a high-performance automation framework migrated from Python/FastAPI to a **Serverless TypeScript** architecture on Firebase. It orchestrates complex business logic between Bitrix24 (CRM), Microsoft Graph (SharePoint & Planner), and Generative AI (Gemini/OpenAI).

## Core Architecture (Firebase)
*   **Functions (Backend)**: TypeScript-based Node.js functions under `functions/src`.
*   **Firestore (Persistence)**: Used for job scheduling, logging, and state management.
*   **Hosting (Frontend)**: React + TypeScript dashboard at `src/frontend`.
*   **Security**: Single-page authentication and cross-project isolation (VC vs TAG).

## Connectors & Guardrails
*   **BitrixConnector**: Implements a **Safe-Edit Policy**. Strictly blocks destructive methods (DELETE/REMOVE). All updates are audited (Pre/Post logging).
*   **AzureCustomConnector**: Direct Microsoft Graph integration. Enforces folder-level restrictions (restricted to `Bitrix/` and `Templates/` folders).
*   **LLMChain**: Intelligent fallback logic (Gemini 2.0 Flash as primary, OpenAI GPT-4o as backup).

## Persistence Schema (Firestore)
*   `jobs/`: Scheduled and pending automation tasks.
*   `logs/`: Permanent execution audit history.
*   `config/`: Dynamic system parameters (Safe-Edit whitelists, IDs).
