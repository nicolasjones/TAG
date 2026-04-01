from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from src.core.logger import logger
import importlib
from datetime import datetime

class SchedulerService:
    _instance = None
    _scheduler = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(SchedulerService, cls).__new__(cls)
            
            jobstores = {
                'default': SQLAlchemyJobStore(url='sqlite:///./data/jobs.sqlite')
            }
            cls._scheduler = AsyncIOScheduler(jobstores=jobstores)
        return cls._instance

    @property
    def scheduler(self):
        return self._scheduler

    async def start(self):
        if not self._scheduler.running:
            self._scheduler.start()
            logger.info("Scheduler iniciado correctamente")

    async def shutdown(self):
        if self._scheduler.running:
            self._scheduler.shutdown()
            logger.info("Scheduler detenido")

    async def run_workflow_job(self, workflow_name: str, payload: dict = None):
        """Función que envuelve la ejecución del workflow para APScheduler."""
        logger.info(f"Ejecución programada iniciada: {workflow_name}")
        try:
            module = importlib.import_module(f"workflows.{workflow_name}")
            if hasattr(module, "main"):
                await module.main(payload)
                logger.info(f"Ejecución programada {workflow_name} completada")
            else:
                logger.error(f"Workflow {workflow_name} no tiene función main")
        except Exception as e:
            logger.error(f"Error en ejecución programada {workflow_name}: {str(e)}")

    def add_cron_job(self, workflow_name: str, cron_expr: str, job_id: str, payload: dict = None):
        # Convertir cron_expr a argumentos (simplificado para el ejemplo)
        # Formato esperado: "minute hour day month day_of_week"
        parts = cron_expr.split()
        if len(parts) != 5:
            raise ValueError("Expresión cron debe tener 5 partes: 'min hour day month dow'")
        
        self._scheduler.add_job(
            self.run_workflow_job,
            'cron',
            minute=parts[0],
            hour=parts[1],
            day=parts[2],
            month=parts[3],
            day_of_week=parts[4],
            id=job_id,
            args=[workflow_name, payload],
            replace_existing=True
        )
        logger.info(f"Job cron añadido: {workflow_name} ({cron_expr})")

    def add_interval_job(self, workflow_name: str, minutes: int, job_id: str, payload: dict = None):
        self._scheduler.add_job(
            self.run_workflow_job,
            'interval',
            minutes=minutes,
            id=job_id,
            args=[workflow_name, payload],
            replace_existing=True
        )
        logger.info(f"Job intervalo añadido: {workflow_name} (cada {minutes} min)")

    def remove_job(self, job_id: str):
        if self._scheduler.get_job(job_id):
            self._scheduler.remove_job(job_id)
            logger.info(f"Job eliminado: {job_id}")

scheduler_service = SchedulerService()
