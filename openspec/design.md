# Diseño de Arquitectura: TAG Automation Framework

## Estructura de Directorios
```text
/Auto-TAG
├── src/
│   ├── api/                # Rutas FastAPI (OpenAPI)
│   │   ├── v1/
│   │   │   ├── webhooks.py
│   │   │   ├── management.py # Gestión de Workflows/Schedules
│   │   │   └── actions.py
│   ├── core/               # Lógica central
│   │   ├── config.py
│   │   ├── database.py     # SQLite + SQLAlchemy
│   │   ├── scheduler.py    # APScheduler Core
│   │   └── security.py
│   ├── frontend/           # Dashboard UI (Vite + React)
│   ├── workflows/          # Lógica de Negocio
│   └── main.py             # App FastAPI (Webhooks + UI Server)
├── data/                   # Base de datos persistente (SQLite)
├── Dockerfile              # Multi-stage build
└── docker-compose.yml
```

## Patrones de Diseño (Evolución)
1.  **AI Fallback Chain**: 
    - El conector de LLM no es un proveedor único, sino una cadena. Si el primer proveedor (ej. Gemini) devuelve un error de cuota o servidor, se dispara automáticamente el siguiente en la lista.
2.  **Step-by-Step Phased Logging**: 
    - Cada script de automatización (`workflows/`) inyecta mensajes de log identificables en cada fase.
    - Se implementa un interruptor global en `config.py` para alternar entre `DEBUG_LOGGING` (test) y `INFO_LOGGING` (producción).
3.  **Webhook & CLI Dual Entry**: 
    - Cada Workflow es un módulo Python independiente e importable. 
    - Se puede disparar vía Webhook (Acción -> Reacción inmediata) o vía CLI (Ejecución por lotes o programada).
    - Un scheduler externo (Cron) puede llamar a `python run.py --workflow <nombre>` para tareas periódicas.
3.  **Registry Pattern**: 
    - Los nuevos conectores de terceros se registran en un mapa global. Añadir "Zapier", "Google Drive" o "Custom API" es tan simple como añadir el archivo en `connectors/` y registrarlo.

## Patrones de Seguridad
1.  **Mandatory API Key**:
    - Se implementa una dependencia de FastAPI que intercepta cada petición. Si el token no coincide, se devuelve un `403 Forbidden`.
2.  **Sensitive Log Redaction**:
    - El Logger está configurado para no mostrar valores de tipos `SecretStr` provenientes de la configuración.
3.  **Docker Non-Root**:
    - El contenedor se ejecuta bajo un usuario `taguser`, limitando el acceso al sistema de archivos del host.

## Documentación (OpenAPI)
- Cada ruta tendrá una descripción detallada, ejemplos de entrada y códigos de respuesta estándar (200, 400, 500).
- La UI Swagger estará disponible en `/docs` para pruebas manuales rápidas.
