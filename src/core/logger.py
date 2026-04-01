from contextvars import ContextVar
import json
import os
import structlog
import logging
import sys
from datetime import datetime, date
from src.core.config import settings

# ContextVar para capturar los pasos de una ejecución específica
_execution_steps: ContextVar[list] = ContextVar("execution_steps", default=None)

def setup_logger():
    """Configura un logger estructurado e identificable para TAG."""
    
    processors = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.dev.set_exc_info,
        structlog.processors.TimeStamper(fmt="%Y-%m-%d %H:%M:%S", utc=False),
        structlog.dev.ConsoleRenderer() if settings.DEBUG else structlog.processors.JSONRenderer(),
    ]

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(logging.DEBUG if settings.DEBUG else logging.INFO),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )

    return structlog.get_logger()

logger = setup_logger()

def log_step(step_name: str, details: dict = None):
    """Log identificable para fases de workflow."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_entry = {"timestamp": timestamp, "step": step_name, "details": details or {}}
    
    logger.info(f"STEP: {step_name}", **(details or {}))
    
    steps = _execution_steps.get()
    if steps is not None:
        steps.append(log_entry)

def init_execution_logger():
    """Inicia la recolección de pasos para el hilo/contexto actual."""
    _execution_steps.set([])

def get_execution_steps():
    """Retorna los pasos capturados hasta ahora."""
    return _execution_steps.get() or []


class _DateEncoder(json.JSONEncoder):
    """Serializa date/datetime como ISO strings para evitar TypeError."""
    def default(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        return super().default(obj)


def save_execution_logs(workflow_name: str):
    """Guarda los pasos de la ejecución actual en un archivo persistente en data/logs/."""
    steps = get_execution_steps()
    if not steps:
        return
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_dir = os.path.join("data", "logs")
    os.makedirs(log_dir, exist_ok=True)
    
    log_file = os.path.join(log_dir, f"{workflow_name}_{timestamp}.json")
    
    try:
        with open(log_file, "w") as f:
            json.dump({
                "workflow": workflow_name,
                "timestamp": timestamp,
                "total_steps": len(steps),
                "steps": steps
            }, f, indent=4, cls=_DateEncoder)
        logger.info(f"Log de ejecución guardado en: {log_file}")
    except PermissionError:
        logger.warning(f"Sin permiso para escribir log en: {log_file}")
    
    return log_file
