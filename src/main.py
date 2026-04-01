from fastapi import FastAPI, BackgroundTasks, HTTPException
from src.api.v1 import webhooks, management
from src.core.config import settings
from src.core.scheduler import scheduler_service
from src.core.database import init_db, SessionLocal, Schedule
from src.core.logger import logger
from contextlib import asynccontextmanager
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
import os

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Iniciando TAG Framework con Scheduler...")
    init_db()
    
    # Iniciar el scheduler
    await scheduler_service.start()
    
    yield
    # Shutdown
    await scheduler_service.shutdown()

app = FastAPI(
    title=settings.APP_NAME,
    description="Motor de automatización robusto para TAG.",
    version="1.0.0",
    lifespan=lifespan
)

# Servir Frontend
current_dir = os.path.dirname(os.path.abspath(__file__))
frontend_path = os.path.join(current_dir, "frontend/dist")
if os.path.exists(frontend_path):
    @app.get("/dashboard", include_in_schema=False)
    async def dashboard_redirect():
        return RedirectResponse(url="/dashboard/")
    
    app.mount("/dashboard/", StaticFiles(directory=frontend_path, html=True), name="dashboard")

# Inclusión de rutas
app.include_router(webhooks.router, prefix="/v1/webhooks")
app.include_router(management.router, prefix="/v1/management")

@app.get("/", include_in_schema=False)
async def root():
    return RedirectResponse(url="/docs")

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "TAG-UAB"}
