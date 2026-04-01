from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from src.core.database import get_db, Schedule
from src.core.scheduler import scheduler_service
from src.core.logger import logger
from run import run_workflow
import os
import importlib

router = APIRouter()

@router.get("/workflows")
async def list_workflows():
    """Enumera todos los workflows disponibles en la carpeta /workflows de la raíz."""
    workflows_path = "workflows"
    workflows = []
    for file in os.listdir(workflows_path):
        if file.endswith(".py") and file != "__init__.py":
            name = file[:-3]
            workflows.append({"name": name, "label": name.replace("_", " ").title()})
    return workflows

@router.post("/workflows/{name}/run")
async def trigger_workflow(name: str, background_tasks: BackgroundTasks):
    """Ejecuta un workflow manualmente en segundo plano."""
    # Verificar si el workflow existe
    try:
        importlib.import_module(f"workflows.{name}")
    except ImportError:
        raise HTTPException(status_code=404, detail=f"Workflow {name} no encontrado")

    background_tasks.add_task(run_workflow, name)
    return {"message": f"Workflow {name} iniciado en segundo plano"}

@router.get("/schedules")
async def get_schedules(db: Session = Depends(get_db)):
    """Obtiene la lista de procesos agendados."""
    return db.query(Schedule).all()

@router.post("/schedules")
async def create_schedule(
    workflow_name: str, 
    cron_expr: str = None, 
    interval_min: int = None, 
    payload: dict = None,
    db: Session = Depends(get_db)
):
    """Crea un nuevo agendamiento."""
    if not cron_expr and not interval_min:
        raise HTTPException(status_code=400, detail="Debe especificar cron_expr o interval_min")
    
    new_schedule = Schedule(
        workflow_name=workflow_name,
        cron_expression=cron_expr,
        interval_minutes=interval_min,
        payload=payload
    )
    db.add(new_schedule)
    db.commit()
    db.refresh(new_schedule)

    # Registrar en el scheduler de APScheduler
    job_id = f"job_{new_schedule.id}"
    if cron_expr:
        scheduler_service.add_cron_job(workflow_name, cron_expr, job_id, payload)
    else:
        scheduler_service.add_interval_job(workflow_name, interval_min, job_id, payload)

    return new_schedule

@router.delete("/schedules/{schedule_id}")
async def delete_schedule(schedule_id: int, db: Session = Depends(get_db)):
    """Elimina un agendamiento."""
    schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Agendamiento no encontrado")
    
    # Remover del scheduler
    scheduler_service.remove_job(f"job_{schedule.id}")
    
    db.delete(schedule)
    db.commit()
    return {"message": "Agendamiento eliminado correctamente"}
