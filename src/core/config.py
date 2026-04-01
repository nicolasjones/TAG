from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    # Configuración de Aplicación
    APP_NAME: str = "TAG Automation Framework"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"  # INFO o DEBUG_STEPS
    TAG_API_KEY: str  # Llave maestra para la API de TAG

    # Bitrix24 (TAG - Instancia Única)
    BITRIX_WEBHOOK_URL: str
    BITRIX_TOKEN: Optional[SecretStr] = None

    # Azure / SharePoint (TAG Direct Graph)
    AZURE_CLIENT_ID: str
    AZURE_CLIENT_SECRET: SecretStr
    AZURE_TENANT_ID: str
    SHAREPOINT_SITE_ID: str
    SHAREPOINT_DRIVE_ID: str

    # AI Fallback Chain (Prioridad)
    GEMINI_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    OPENROUTER_API_KEY: Optional[str] = None

    # ── Google Drive / Sheets (workflow CREATE_PR) ────────────────────────
    # Ruta al archivo JSON de la Service Account de Google
    GOOGLE_SERVICE_ACCOUNT_JSON_PATH: str = "google_sa.json"
    # Cuenta de usuario a impersonar (ej: tagbitrix24@gmail.com).
    # Requiere Domain-Wide Delegation habilitado en la Service Account.
    GOOGLE_IMPERSONATE_EMAIL: Optional[str] = None
    # Carpeta raíz "Gestión TAG" en Google Drive (ID extraído de Make.com módulo 72)
    GOOGLE_PARENT_FOLDER_ID: str = "1vYG4mcW2U3t7k4csqhOxjU0Jn9g_qJtP"
    # Template Apertura PR (ID extraído de Make.com módulo 37)
    GOOGLE_TEMPLATE_APERTURA_ID: str = "1wmG85AxVD1f5mRPWfmw0z69tglJ9tBLqKx5QwtUkMME"
    # Template Gantt (ID extraído de Make.com módulo 71)
    GOOGLE_TEMPLATE_GANTT_ID: str = "15OSsROgnxc_k4nE2Ocs4PxjadfprUpjerViMSZSUbkU"
    # URL del Google Apps Script para generación de PDF (módulo 80, opcional)
    GOOGLE_APPS_SCRIPT_PDF_URL: Optional[str] = None

    # ── Bitrix24 — SPA Apertura PR (workflow CREATE_PR) ───────────────────
    # entityTypeId del Smart Process "Apertura PR".
    # Inferido del stageId "DT1040_13:..." → entityTypeId = 1040
    BITRIX_ENTITY_APERTURA_PR: int = 1040

    # ── SharePoint — Carpeta destino de sheets del PR ─────────────────────
    # Drive ID (extraído del módulo 138/144 de Make.com)
    SHAREPOINT_PR_DRIVE_ID: str = (
        "b!L23K3MBVkk6FJ5K6U24Elqg7EgbJ7FRPnMyc0xoyhiMxDTYYlrC_SbJNNTg8cWnw"
    )
    # Item ID de la carpeta destino dentro del Drive
    SHAREPOINT_PR_FOLDER_ITEM_ID: str = "01LSYOLJDWI7IR7WAYS5CKVRSWNYIVB34M"
    
    # Rutas para el workflow CREATE_PR
    SHAREPOINT_TEMPLATE_PR_PATH: str = "Bitrix/Templates/NUEVO Template PR.xlsx"
    SHAREPOINT_PR_ROOT: str = "Bitrix/Gestión TAG"

    # ── Microsoft Planner (workflow CREATE_PR) ────────────────────────────
    PLANNER_PLAN_ID: Optional[str] = None
    PLANNER_BUCKET_ID: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"  # Ignorar variables de entorno extra no definidas en la clase
    )

settings = Settings()
