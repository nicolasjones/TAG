# Propuesta: TAG Automation Framework (v2 - Robusto)

## Visión
Crear un motor de automatización modular, extremadamente escalable y seguro diseñado específicamente para las necesidades de **TAG**. El sistema operará bajo una arquitectura de "código sobre nodos", permitiendo una integración perfecta entre Bitrix24, Microsoft Azure (Sharepoint) y diversos modelos de lenguaje (LLMs), asegurando que el código sea mantenible, documentado y escalable a futuras integraciones de terceros.

## Justificación
TAG requiere una infraestructura técnica que trascienda las limitaciones de herramientas visuales, permitiendo automatizaciones complejas, seguras y validadas mediante pruebas automatizadas (TDD). Este framework servirá como el núcleo de operaciones de RITA para TAG.

## Objetivos Principales
1.  **Escalabilidad Total**: Arquitectura modular que separa conectores (infraestructura) de scripts (lógica de negocio).
2.  **IA de Alta Disponibilidad**: Implementación de un sistema de **fallback automático** (LLM Chain). Si un proveedor (ej. Gemini) falla, el sistema conmuta automáticamente a otro (OpenAI, Groq o OpenRouter) para garantizar que la automatización nunca se detenga.
3.  **Documentación Automática**: Uso de FastAPI + OpenAPI para que cada endpoint esté perfectamente descrito desde el inicio.
4.  **Seguridad**: Manejo de secretos mediante variables de entorno y configuración tipada.
5.  **Calidad Continua**: Integración de pruebas unitarias y TDD para asegurar que cada cambio mantiene la integridad del sistema.
6.  **IA Nativa**: Conectores integrados para Gemini, OpenAI, Groq y OpenRouter.
7.  **Dashboard de Gestión**: Interfaz visual para monitorear, ejecutar manualmente y agendar procesos técnicos sin necesidad de CLI.
8.  **Agendamiento Persistente**: Motor capaz de programar tareas periódicas (Cron/Interval) que sobrevivan a reinicios del sistema.
