import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.main import app
from src.core.database import Base, get_db
import os
from unittest.mock import patch

# Mock environment variables
with patch.dict(os.environ, {
    "TAG_API_KEY": "test-key",
    "BITRIX_WEBHOOK_URL": "http://mock",
    "AZURE_TAG_ENDPOINT": "http://mock",
    "AZURE_CLIENT_ID": "mock",
    "AZURE_CLIENT_SECRET": "mock",
    "AZURE_TENANT_ID": "mock"
}):
    # Configurar base de datos de prueba
    SQLALCHEMY_DATABASE_URL = "sqlite:///./test_tag.db"
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_db():
        try:
            db = TestingSessionLocal()
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)

    client = TestClient(app)

    def test_list_workflows():
        response = client.get("/v1/management/workflows")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        # Debería encontrar al menos 'example_sync'
        names = [wf["name"] for wf in response.json()]
        assert "example_sync" in names

    def test_create_schedule_interval():
        payload = {
            "workflow_name": "example_sync",
            "interval_min": 10
        }
        # Nota: La ruta POST /v1/management/schedules recibe params, no JSON body según mi implementación anterior
        response = client.post("/v1/management/schedules?workflow_name=example_sync&interval_min=10")
        assert response.status_code == 200
        data = response.json()
        assert data["workflow_name"] == "example_sync"
        assert data["interval_minutes"] == 10

    def test_list_schedules():
        response = client.get("/v1/management/schedules")
        assert response.status_code == 200
        assert len(response.json()) >= 1

    def test_delete_schedule():
        # Crear uno primero
        res_create = client.post("/v1/management/schedules?workflow_name=example_sync&interval_min=5")
        sch_id = res_create.json()["id"]
        
        response = client.delete(f"/v1/management/schedules/{sch_id}")
        assert response.status_code == 200
        
        # Verificar que ya no está
        res_list = client.get("/v1/management/schedules")
        ids = [s["id"] for s in res_list.json()]
        assert sch_id not in ids

    # Limpieza final
    @pytest.fixture(scope="session", autouse=True)
    def cleanup(request):
        def remove_test_db():
            if os.path.exists("test_tag.db"):
                os.remove("test_tag.db")
            if os.path.exists("jobs.sqlite"): # APScheduler default jobstore in memory/temp file
                os.remove("jobs.sqlite")
        request.addfinalizer(remove_test_db)
