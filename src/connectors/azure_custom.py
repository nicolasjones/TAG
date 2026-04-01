import httpx
from typing import Any, Dict, Optional
from src.connectors.base import BaseConnector
from src.core.config import settings
from src.core.logger import logger, log_step

class AzureCustomConnector(BaseConnector):
    """Conector para Microsoft Graph API (SharePoint / OneDrive)."""
    
    GRAPH_URL = "https://graph.microsoft.com/v1.0"

    def __init__(self):
        self.client_id = settings.AZURE_CLIENT_ID
        self.client_secret = settings.AZURE_CLIENT_SECRET.get_secret_value() if hasattr(settings.AZURE_CLIENT_SECRET, 'get_secret_value') else settings.AZURE_CLIENT_SECRET
        self.tenant_id = settings.AZURE_TENANT_ID
        self._access_token = None
        self._token_expires = 0

    async def _get_access_token(self):
        """Obtiene un token de acceso OAuth2 para Microsoft Graph."""
        import time
        if self._access_token and time.time() < self._token_expires:
            return self._access_token

        url = f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token"
        data = {
            "client_id": self.client_id,
            "scope": "https://graph.microsoft.com/.default",
            "client_secret": self.client_secret,
            "grant_type": "client_credentials",
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, data=data)
            response.raise_for_status()
            token_data = response.json()
            self._access_token = token_data["access_token"]
            self._token_expires = time.time() + token_data["expires_in"] - 60
            return self._access_token

    async def execute(self, method: str, path: str, params: Dict[str, Any] = None, data: Any = None) -> Any:
        """
        Ejecuta una petición directa a Microsoft Graph con GUARDRAILS ESTRICTOS.
        RESTRICCIÓN: Solo carpeta 'Bitrix' y IDs de Planner autorizados.
        """
        allowed_roots = ["Bitrix", "Templates"]
        authorized_plan = settings.PLANNER_PLAN_ID
        authorized_bucket = settings.PLANNER_BUCKET_ID

        # 1. SEGURIDAD: SharePoint / OneDrive Paths literal
        if "drives/" in path and "/root:/" in path:
            target_path = path.split("/root:/")[-1]
            # Bloqueamos cualquier intento de subir de nivel (..) o acceder a otros roots
            if not target_path or not any(target_path.startswith(root) for root in allowed_roots):
                logger.error(f"HARD BLOCK: Acceso fuera de {allowed_roots} denegado: {target_path}")
                raise PermissionError(f"Seguridad: Acceso restringido a las carpetas {allowed_roots} solamente.")

        # 2. SEGURIDAD: Microsoft Planner (Solo permitir el Plan y Bucket configurado)
        if "planner/" in path:
            # Validar planId en el path o en el body
            if "plans/" in path:
                p_id = path.split("plans/")[-1].split("/")[0]
                if authorized_plan and p_id != authorized_plan:
                    raise PermissionError(f"Seguridad: Intento de acceso a Plan no autorizado ({p_id}).")
            
            # Validar bucketId y planId en el body (POST/PATCH)
            if data and isinstance(data, dict):
                p_id_body = data.get("planId")
                b_id_body = data.get("bucketId")
                if p_id_body and authorized_plan and p_id_body != authorized_plan:
                    raise PermissionError("Seguridad: planId no autorizado en el cuerpo de la petición.")
                if b_id_body and authorized_bucket and b_id_body != authorized_bucket:
                    raise PermissionError("Seguridad: bucketId no autorizado en el cuerpo de la petición.")

        # 3. SEGURIDAD: Bloqueo de navegación de grupos/sitios en producción
        # Exceptuamos GET de planes por grupo si el grupo es el configurado (opcional)
        blocked_paths = ["groups", "sites", "users"]
        if any(path.startswith(bp) for bp in blocked_paths):
            # Solo permitimos listar grupos/planes si estamos en modo DEBUG o búsqueda inicial
            # Pero para el workflow regular, bloqueamos.
            if not settings.DEBUG:
                logger.warning(f"HARD BLOCK: Intento de navegación de {path} bloqueado por política de mínimo privilegio.")
                raise PermissionError(f"Seguridad: No se permite navegar '{path}' fuera de las rutas de trabajo autorizadas.")

        token = await self._get_access_token()
        url = f"https://graph.microsoft.com/v1.0/{path.lstrip('/')}"
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        log_step(f"Graph API {method}: {path}", {
            "params": params, 
            "data": data if method != "GET" else None,
            "security": "RESTRICTED TO BITRIX/PLANNER"
        })
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.request(method, url, headers=headers, params=params, json=data, timeout=60.0)
                if response.status_code >= 400:
                   logger.error(f"Microsoft Graph Error: {response.status_code} - {response.text}")
                response.raise_for_status()
                return response.json() if response.status_code not in [204, 201] or (response.status_code == 201 and response.text) else response.json() if response.text else None
            except Exception as e:
                logger.error(f"Error en Microsoft Graph ({path}): {str(e)}")
                raise


    def _validate_path(self, path: str) -> str:
        """Asegura que el path empiece por un root autorizado ('Bitrix' o 'Templates')."""
        path = path.strip("/")
        if not any(path.startswith(r) for r in ["Bitrix", "Templates"]):
            path = f"Bitrix/{path}"
        return path

    async def list_site_drives(self, site_id: str):
        """Lista las bibliotecas de documentos (Drives) de un sitio de SharePoint."""
        return await self.execute("GET", f"sites/{site_id}/drives")

    async def create_folder(self, drive_id: str, parent_path: str, folder_name: str) -> dict:
        """Crea una carpeta en SharePoint (dentro de los roots autorizados)."""
        # Aseguramos que el path empiece por un root autorizado
        if not any(parent_path.startswith(r) for r in ["Bitrix", "Templates"]):
            parent_path = f"Bitrix/{parent_path.lstrip('/')}".rstrip('/')

        # Usamos @microsoft.graph.conflictBehavior: fail para intentar crearla y si existe, obtenerla
        # Pero es más seguro intentar obtenerla primero con su ruta absoluta si es posible.
        try:
             # Intentamos ver si ya existe
             existing = await self.execute("GET", f"drives/{drive_id}/root:/{parent_path}/{folder_name}")
             if existing and "id" in existing:
                 return existing
        except Exception:
             pass # Si no existe, procedemos a crearla
             
        path = f"drives/{drive_id}/root:/{parent_path}:/children"
        data = {
            "name": folder_name,
            "folder": {},
            "@microsoft.graph.conflictBehavior": "fail"
        }
        try:
            return await self.execute("POST", path, data=data)
        except Exception as e:
            # Reintentar obtener por si acaso hubo una carrera en la creación
             return await self.execute("GET", f"drives/{drive_id}/root:/{parent_path}/{folder_name}")

    async def upload_file(self, drive_id: str, folder_path: str, filename: str, content: bytes) -> dict:
        """Sube un archivo a SharePoint."""
        folder_path = self._validate_path(folder_path)
        
        # Guardrail: Impedir escritura en Templates
        full_path = f"{folder_path}/{filename}".lower()
        if "templates/" in full_path or full_path.startswith("templates/"):
            raise PermissionError(f"Seguridad: La carpeta 'Templates' es solo de lectura. No se permite subir '{filename}'.")
            
        token = await self._get_access_token()
        # Nota: Usamos PUT para archivos pequeños ( < 4mb ). Para grandes se usa Upload Session.
        url = f"{self.GRAPH_URL}/drives/{drive_id}/root:/{folder_path}/{filename}:/content"
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/octet-stream"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.put(url, headers=headers, content=content)
            response.raise_for_status()
            return response.json()

    async def list_folder_contents(self, drive_id: str, folder_path: str):
        """Lista los archivos dentro de una carpeta específica en los roots autorizados."""
        folder_path = self._validate_path(folder_path)
        
        path = f"drives/{drive_id}/root:/{folder_path}:/children"
        return await self.execute("GET", path)

    async def download_file(self, drive_id: str, file_path: str) -> bytes:
        """Descarga el contenido de un archivo desde SharePoint."""
        file_path = self._validate_path(file_path)
        
        token = await self._get_access_token()
        url = f"{self.GRAPH_URL}/drives/{drive_id}/root:/{file_path}:/content"
        
        headers = {"Authorization": f"Bearer {token}"}
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, follow_redirects=True)
            response.raise_for_status()
            return response.content

    async def list_groups(self):
        """Lista los grupos de Office 365 disponibles."""
        return await self.execute("GET", "groups")

    # ── Soporte para Microsoft Planner ───────────────────────────────────────

    async def get_plans_by_group(self, group_id: str):
        """Lista los planes vinculados a un grupo de Office 365."""
        return await self.execute("GET", f"groups/{group_id}/planner/plans")

    async def get_buckets_by_plan(self, plan_id: str):
        """Lista los buckets dentro de un plan."""
        return await self.execute("GET", f"planner/plans/{plan_id}/buckets")

    async def create_planner_task(self, plan_id: str, bucket_id: str, title: str, start_dt: str = None, due_dt: str = None):
        """Crea una tarea en Microsoft Planner."""
        data = {
            "planId": plan_id,
            "bucketId": bucket_id,
            "title": title
        }
        if start_dt:
            data["startDateTime"] = start_dt
        if due_dt:
            data["dueDateTime"] = due_dt
        
        return await self.execute("POST", "planner/tasks", data=data)

    async def update_task_details(self, task_id: str, description: str, etag: str):
        """Actualiza los detalles (descripción) de una tarea. Requiere ETag."""
        headers = {
            "If-Match": etag,
            "Content-Type": "application/json"
        }
        url = f"https://graph.microsoft.com/v1.0/planner/tasks/{task_id}/details"
        token = await self._get_access_token()
        
        async with httpx.AsyncClient() as client:
            response = await client.patch(url, headers={"Authorization": f"Bearer {token}", **headers}, json={"description": description})
            response.raise_for_status()
            return response.json()

