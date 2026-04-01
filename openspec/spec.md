# Especificación Técnica: TAG Automation Framework

## Requisitos Funcionales
1.  **Bitrix Connector (Instancia Única)**:
    - Integración con la única instancia de Bitrix24 de TAG.
    - Captura de eventos mediante webhooks y ejecución de acciones (ida y vuelta).
2.  **Azure Connector (Endpoint Existente)**:
    - Integración directa con el endpoint de Azure ya desarrollado para TAG.
    - Soporte para operaciones de SharePoint (listado, creación, subida).
3.  **IA de Alta Disponibilidad (Fallback)**:
    - Conector inteligente que encadena Gemini, OpenAI, Groq y OpenRouter. Si el proveedor principal falla, el sistema reintenta con el siguiente en la cadena.
4.  **Logging Identificable y Configurable**:
    - **Modo Debug/Test**: Logs extremadamente detallados en cada paso del script para facilitar la depuración.
    - **Modo Producción**: Registro simplificado para evitar el crecimiento infinito del almacenamiento de logs, manteniendo la trazabilidad básica.
5.  **Ejecución Manual y Programada (CLI + Trigger API)**:
    - **CLI**: Comandos para ejecutar cualquier workflow desde la terminal.
    - **Trigger Endpoint**: Endpoint seguro para disparar un workflow bajo demanda.
6.  **Capa de Seguridad (Imprescindible)**:
    - **Header API Key**: Todos los endpoints (incluyendo `/run`) requieren el header `X-TAG-API-KEY` validado contra la configuración.
    - **Webhook Token Validation**: Verificación de tokens de integridad para las peticiones entrantes de Bitrix24.
    - **Protección de Secretos**: Uso de `SecretStr` en Pydantic para evitar filtraciones en logs.
7.  **Dashboard de Control (UI)**:
    - Interfaz moderna (React) para listar workflows disponibles.
    - Ejecución manual de workflows con un solo click.
    - Gestión de agendamientos (Crear/Eliminar tareas periódicas).
8.  **Motor de Agendamiento (Scheduler)**:
    - Soporte para tareas tipo Cron (ej: "9 AM todos los días") e Intervalo (ej: "cada 30 min").
    - Persistencia en base de datos local (SQLite) para asegurar que los horarios se mantengan.
9.  **Despliegue Contenerizado Robusto (Docker)**:
    - **Multi-stage Build**: Construcción del frontend y backend en una sola imagen optimizada.
    - **Volúmenes Persistentes**: Para la base de datos de agendamientos y logs.
10. **Política de Seguridad "Safe-Edit" (Mandatoria)**:
    - **Prohibición de Borrado**: Los conectores de automatización tienen prohibido usar métodos `DELETE` o destructivos.
    - **Log de Auditoría**: Toda edición debe registrar el valor anterior y el nuevo en los logs.
    - **Whitelisting de Campos**: Solo se permite la edición de campos previamente autorizados en la configuración de cada workflow.
1.  **Bitrix Connector (Instancia Única TAG)**:
    - Integración exclusiva con la instancia de Bitrix24 de TAG.
    - Captura de eventos mediante webhooks y ejecución de acciones (ida y vuelta).
    - Gestión de tokens y autenticación centralizada para TAG.
4.  **Azure/SharePoint Connector**:
    - Manejo de múltiples Drive IDs y Sites según la empresa vinculada.
3.  **LLM Connectors**:
    - Interfaz unificada para Gemini, OpenAI, Groq y OpenRouter.
    - Soporte para prompts estructurados.
4.  **Logging y Monitorización**:
    - Registro detallado de cada acción y respuesta de API.

## Requisitos No Funcionales
3.  **Tests Unitarios Mandatorios**:
    - **Backend**: Cobertura con `pytest` para lógica de negocio y conectores.
    - **Frontend**: Cobertura con `Vitest` para componentes de la UI.
4.  **OpenAPI/Swagger**: Documentación automática en `/docs`.
5.  **Configuración Segura**: Uso de `pydantic-settings` para validar variables de entorno.
6.  **Escalabilidad**: Patrón de diseño "Connector Interface" para añadir nuevos servicios sin tocar el core.
7.  **Separación de Código**: Los scripts residen en una carpeta `workflows` aislada de la lógica de conexión.

## Endpoints de API (Ejemplo Inicial)
- `POST /webhooks/bitrix`: Entrada para eventos de Bitrix (Ej: Cambio de estado en SPA).
- `POST /webhooks/azure`: Entrada para notificaciones de Azure/SharePoint.
- `POST /webhooks/generic`: Entrada para disparar automatizaciones "estilo Make.com" (Acción -> Reacción).
- `POST /run/{workflow_name}`: Disparo manual de un script de lógica de negocio.
- `GET /health`: Estado del sistema y conectividad.
