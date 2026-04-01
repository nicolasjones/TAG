# Tareas de Desarrollo: TAG Automation Framework

## Fase 1: Motor y Logger Configurable (DEBUG/PROD)
1.  [ ] Configurar `src/core/logger.py` con soportes para niveles incrementales.
2.  [ ] Implementar flag `LOG_DETAIL_LEVEL` en `src/core/config.py`.
3.  [ ] Crear decoradores de logging para pasos de workflow (identificables).

## Fase 2: Conectores Robustos y Fallback de IA
4.  [ ] Implementar `src/connectors/llm/chain.py` (Lógica de Fallback Multi-Provider).
5.  [ ] Integrar `azure_custom.py` apuntando al endpoint existente de Azure TAG.
6.  [ ] Finalizar conector de Bitrix Único (Acción/Reacción).
7.  [ ] **[TDD]** Test de estrés de Fallback: Simular caída de Gemini y verificar salto a OpenAI.

## Fase 3: API, CLI y Ejecución Manual
11. [ ] Implementar `run.py` como entry point para ejecución manual (CLI).
12. [ ] Implementar endpoint `POST /run/{workflow_name}` en FastAPI.
13. [ ] Crear decorador de ejecución que asegure la misma lógica para CLI y Webhooks.
14. [ ] **[TDD]** Probar ejecución de un workflow dummy vía CLI y verificar logs.

## Fase 4: API y Webhooks
15. [ ] Configurar app principal FastAPI en `src/main.py`.
16. [ ] Implementar rutas de webhooks en `src/api/v1/webhooks.py`.
17. [ ] Implementar el Dispatcher (`src/core/dispatcher.py`) para mapear eventos.
18. [ ] Documentar cada campo de la API con Pydantic Models (OpenAPI).

## Fase 6: Dashboard y Agendamiento (Scheduler)
22. [x] Implementar `src/core/database.py` y `src/core/scheduler.py`.
23. [x] Desarrollar API de gestión en `src/api/v1/management.py`.
24. [x] Crear Dashboard en `src/frontend` (React + Vite).
25. [x] Integrar servidor de estáticos en FastAPI para la UI.

## Fase 7: Testing Mandatorio y Dockerización
26. [x] **[Backend]** Implementar tests unitarios para API de gestión y Scheduler.
27. [x] **[Frontend]** Implementar tests unitarios para componentes principales (Vitest).
28. [x] **[Docker]** Configurar Multi-stage build con persistencia de datos.
29. [x] Ejecutar suite completa de tests y verificar en contenedor Docker.

## Fase 5: Workflows y Verificación
19. [ ] Crear primer workflow en `src/workflows/example_sync.py`.
20. [ ] Verificar integración total Bitrix -> FastAPI -> Azure.
21. [ ] Pruebas finales de escalabilidad (añadir un conector dummy para validar facilidad).
