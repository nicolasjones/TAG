import time
import httpx
from typing import Any, Dict, Optional
from src.connectors.base import BaseConnector
from src.core.config import settings
from src.core.logger import logger, log_step


class GoogleConnector(BaseConnector):
    """
    Conector unificado para Google Drive API v3 y Google Sheets API v4.
    Autenticación via Service Account (server-to-server), con soporte
    opcional de impersonación de cuenta de usuario.

    Replica los módulos de Make.com:
      - google-drive:createAFolder
      - google-drive:getAFile (export as XLSX)
      - google-sheets:createASpreadsheetFromATemplate
      - google-sheets:updateRow
    """

    SCOPES = [
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/spreadsheets",
    ]

    def __init__(self):
        self.service_account_path = settings.GOOGLE_SERVICE_ACCOUNT_JSON_PATH
        self.impersonate_email: Optional[str] = getattr(settings, "GOOGLE_IMPERSONATE_EMAIL", None)
        self._access_token: Optional[str] = None
        self._token_expires: float = 0.0

    # ------------------------------------------------------------------ #
    #  Auth                                                                #
    # ------------------------------------------------------------------ #

    async def _get_access_token(self) -> str:
        """
        Obtiene (y cachea) un Bearer token OAuth2 usando la Service Account.
        Si GOOGLE_IMPERSONATE_EMAIL está configurado, impersona esa cuenta.
        """
        if self._access_token and time.time() < self._token_expires:
            return self._access_token

        from google.oauth2 import service_account
        from google.auth.transport.requests import Request as GoogleRequest

        creds = service_account.Credentials.from_service_account_file(
            self.service_account_path,
            scopes=self.SCOPES,
        )
        if self.impersonate_email:
            creds = creds.with_subject(self.impersonate_email)

        # refresh() es síncrono; lo llamamos dentro del thread de asyncio
        # (es rápido: solo un POST a accounts.google.com)
        creds.refresh(GoogleRequest())

        self._access_token = creds.token
        # Guardamos con margen de 60 s para no usar tokens a punto de expirar
        self._token_expires = time.time() + creds.expiry.timestamp() - time.time() - 60
        log_step("Google Auth: token renovado")
        return self._access_token

    # ------------------------------------------------------------------ #
    #  Interfaz base                                                       #
    # ------------------------------------------------------------------ #

    async def execute(self, action: str, params: Dict[str, Any] = None) -> Any:
        """No usada directamente — usar los métodos específicos."""
        raise NotImplementedError("Usar los métodos específicos de GoogleConnector.")

    # ------------------------------------------------------------------ #
    #  Helpers HTTP                                                        #
    # ------------------------------------------------------------------ #

    async def _drive_request(
        self,
        method: str,
        path: str,
        params: Dict = None,
        json_body: Dict = None,
    ) -> Any:
        """Ejecuta una petición autenticada a Google Drive API v3."""
        token = await self._get_access_token()
        url = f"https://www.googleapis.com/drive/v3/{path.lstrip('/')}"
        headers = {"Authorization": f"Bearer {token}"}

        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.request(
                    method, url, headers=headers, params=params, json=json_body
                )
                response.raise_for_status()
                return response.json() if response.content else None
            except Exception as e:
                logger.error(f"Error Google Drive ({method} {path}): {e}")
                raise

    async def _sheets_request(
        self,
        method: str,
        spreadsheet_id: str,
        endpoint: str,
        json_body: Dict = None,
        params: Dict = None,
    ) -> Any:
        """Ejecuta una petición autenticada a Google Sheets API v4."""
        token = await self._get_access_token()
        url = f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/{endpoint.lstrip('/')}"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.request(
                    method, url, headers=headers, params=params, json=json_body
                )
                response.raise_for_status()
                return response.json() if response.content else None
            except Exception as e:
                logger.error(f"Error Google Sheets ({method} {spreadsheet_id}/{endpoint}): {e}")
                raise

    # ------------------------------------------------------------------ #
    #  Google Drive — métodos                                              #
    # ------------------------------------------------------------------ #

    async def create_folder(self, name: str, parent_folder_id: str) -> str:
        """
        Crea una carpeta en Google Drive.
        Equivale a: google-drive:createAFolder en Make.com
        Retorna el ID de la carpeta creada.
        """
        log_step(f"Drive: Creando carpeta '{name}'", {"parent": parent_folder_id})
        result = await self._drive_request(
            "POST",
            "files",
            json_body={
                "name": name,
                "mimeType": "application/vnd.google-apps.folder",
                "parents": [parent_folder_id],
            },
        )
        folder_id = result["id"]
        log_step(f"Drive: Carpeta creada → {folder_id}")
        return folder_id

    async def copy_from_template(
        self, template_id: str, name: str, parent_folder_id: str
    ) -> str:
        """
        Copia un Google Sheet template a una nueva carpeta.
        Equivale a: google-sheets:createASpreadsheetFromATemplate en Make.com
        Retorna el ID del nuevo spreadsheet.
        """
        log_step(f"Drive: Copiando template '{template_id}' como '{name}'")
        result = await self._drive_request(
            "POST",
            f"files/{template_id}/copy",
            json_body={
                "name": name,
                "parents": [parent_folder_id],
            },
        )
        new_id = result["id"]
        log_step(f"Drive: Copia creada → {new_id}")
        return new_id

    async def export_as_xlsx(self, file_id: str) -> bytes:
        """
        Descarga un Google Sheet exportado como XLSX.
        Equivale a: google-drive:getAFile con formatSpreadsheets=xlsx en Make.com
        """
        log_step(f"Drive: Exportando '{file_id}' como XLSX")
        token = await self._get_access_token()
        url = f"https://www.googleapis.com/drive/v3/files/{file_id}/export"
        headers = {"Authorization": f"Bearer {token}"}
        params = {
            "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            try:
                response = await client.get(url, headers=headers, params=params)
                response.raise_for_status()
                log_step(f"Drive: XLSX exportado ({len(response.content)} bytes)")
                return response.content
            except Exception as e:
                logger.error(f"Error exportando XLSX ({file_id}): {e}")
                raise

    # ------------------------------------------------------------------ #
    #  Google Sheets — métodos                                             #
    # ------------------------------------------------------------------ #

    async def update_named_ranges(
        self, spreadsheet_id: str, named_range_values: Dict[str, str]
    ):
        """
        Actualiza Named Ranges por nombre en un spreadsheet.
        Equivale al bloque 'values' de createASpreadsheetFromATemplate en Make.com.

        named_range_values: {"NOMBRE_RANGO": "valor", ...}
        Los rangos deben existir como Named Ranges en el template.
        """
        data = [
            {"range": name, "values": [[str(value) if value is not None else ""]]}
            for name, value in named_range_values.items()
            if value is not None and str(value).strip() != ""
        ]
        if not data:
            return

        log_step(
            f"Sheets: Actualizando {len(data)} named ranges en '{spreadsheet_id}'"
        )
        await self._sheets_request(
            "POST",
            spreadsheet_id,
            "values:batchUpdate",
            json_body={
                "valueInputOption": "USER_ENTERED",
                "data": data,
            },
        )

    async def update_row(
        self,
        spreadsheet_id: str,
        sheet_name: str,
        row_number: int,
        col_values: Dict[int, Any],
        value_input_option: str = "USER_ENTERED",
    ):
        """
        Actualiza celdas específicas en una fila de un sheet usando batchUpdate.
        Equivale a: google-sheets:updateRow en Make.com

        col_values: {col_index_0based: valor, ...}  (ej: {4: "texto", 8: "otro"})
        row_number: 1-indexed (igual que Make.com)
        """
        data = []
        for col_idx, value in col_values.items():
            if value is None:
                continue
            col_letter = self._col_index_to_letter(col_idx)
            cell_range = f"'{sheet_name}'!{col_letter}{row_number}"
            data.append(
                {
                    "range": cell_range,
                    "values": [[str(value) if value is not None else ""]],
                }
            )

        if not data:
            return

        log_step(
            f"Sheets: updateRow '{sheet_name}'!{row_number}",
            {"cols": [self._col_index_to_letter(c) for c in col_values]},
        )
        await self._sheets_request(
            "POST",
            spreadsheet_id,
            "values:batchUpdate",
            json_body={
                "valueInputOption": value_input_option,
                "data": data,
            },
        )

    # ------------------------------------------------------------------ #
    #  Utils                                                               #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _col_index_to_letter(index: int) -> str:
        """
        Convierte índice de columna 0-based a letra de columna de Sheets.
        0 → A, 1 → B, ..., 25 → Z, 26 → AA, ...
        """
        result = ""
        n = index + 1
        while n > 0:
            n, remainder = divmod(n - 1, 26)
            result = chr(65 + remainder) + result
        return result
