import asyncio
import importlib
import sys
from src.core.logger import logger, log_step, init_execution_logger, save_execution_logs, get_execution_steps

async def run_workflow(workflow_name: str, payload: dict = None):
    """Orquestador universal para ejecutar workflows por nombre."""
    # Iniciamos el recolector de pasos para esta ejecución específica
    init_execution_logger()
    
    log_step(f"Iniciando Workflow: {workflow_name}", {"payload": payload})
    
    try:
        # Importación dinámica del workflow
        module = importlib.import_module(f"workflows.{workflow_name}")
        importlib.reload(module)  # Soporte para hot-reload durante desarrollo
        
        if hasattr(module, "main"):
            result = await module.main(payload)
            log_step(f"Workflow {workflow_name} finalizado con éxito")
            
            # Agregamos los pasos capturados al resultado final para que Make.com los vea
            return {
                "result": result,
                "execution_summary": {
                    "workflow": workflow_name,
                    "steps_count": len(get_execution_steps()),
                    "logs": get_execution_steps()
                }
            }
        else:
            raise AttributeError(f"El workflow '{workflow_name}' no tiene una función 'main'")
            
    except ImportError:
        logger.error(f"Workflow '{workflow_name}' no encontrado")
        raise
    except Exception as e:
        logger.error(f"Error ejecutando workflow '{workflow_name}': {str(e)}")
        log_step(f"Workflow fallido: {str(e)}")
        raise
    finally:
        # Guardar permanentemente en el sistema de archivos (Carpeta data/logs)
        save_execution_logs(workflow_name)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="TAG CLI Runner")
    parser.add_argument("--workflow", required=True, help="Nombre del workflow a ejecutar")
    args = parser.parse_args()
    
    asyncio.run(run_workflow(args.workflow))
