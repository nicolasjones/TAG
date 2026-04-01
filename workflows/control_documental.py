import pandas as pd
import io
from src.connectors.bitrix import BitrixConnector
from src.connectors.azure_custom import AzureCustomConnector
from src.core.config import settings
from src.core.logger import log_step, logger

async def main(payload: dict = None):
    """
    Workflow: Control Documental
    1. Recibe folder_name de make.com.
    2. Busca archivo 'Números OTI' en SharePoint.
    3. Lee Excel y busca columna 'N Asignado'.
    4. Sincroniza con Bitrix SPA Ingeniería (1100).
    """
    if not payload or "folder_name" not in payload:
        raise ValueError("Payload debe contener 'folder_name'")

    folder_name = payload["folder_name"]
    log_step(f"Iniciando Control Documental para carpeta: {folder_name}")

    azure = AzureCustomConnector()
    bitrix = BitrixConnector()

    # 1. Buscar el archivo en SharePoint
    folder_path = f"Control Documental/{folder_name}"
    log_step(f"Buscando archivo 'Números OTI' en: {folder_path}")
    
    try:
        items = await azure.list_folder_contents(settings.SHAREPOINT_DRIVE_ID, folder_path)
        oti_file = None
        for item in items.get("value", []):
            name = item.get("name", "")
            if name.startswith("Números OTI") and name.endswith(".xlsx"):
                oti_file = item
                break
        
        if not oti_file:
            raise FileNotFoundError(f"No se encontró el archivo 'Números OTI' en {folder_path}")

        log_step(f"Archivo encontrado: {oti_file['name']}")

        # 2. Descargar y procesar Excel
        content = await azure.download_file(settings.SHAREPOINT_DRIVE_ID, f"{folder_path}/{oti_file['name']}")
        df = pd.read_excel(io.BytesIO(content))
        
        # Configuración específica solicitada por el usuario:
        # Columna E (index 4) -> Identificador del documento en Bitrix
        # Columna H (index 7) -> Valor del N° ASIGNADO
        
        log_step(f"Procesando {len(df)} filas. Usando Columna E para identificar y Columna H para el valor.")

        # 3. Sincronizar con Bitrix
        stats = {"total": 0, "updates": 0, "errors": 0}
        
        for index, row in df.iterrows():
            # Acceso por índice de columna para mayor precisión (0-indexed)
            doc_name = str(row.iloc[4]).strip() if len(row) > 4 else None
            n_asignado_val = str(row.iloc[7]).strip() if len(row) > 7 and pd.notna(row.iloc[7]) else ""
            
            if not doc_name or doc_name == "nan":
                continue
            
            # Normalización de espacios y limpieza adicional
            doc_name = " ".join(doc_name.split())
            
            stats["total"] += 1
            log_step(f"Sincronizando: {doc_name} -> {n_asignado_val}")
            
            try:
                # 1. Intento de búsqueda exacta
                search_res = await bitrix.execute("crm.item.list", {
                    "entityTypeId": 1100,
                    "filter": {"TITLE": doc_name},
                    "select": ["id", "title"]
                })
                
                items_found = search_res.get("result", {}).get("items", [])
                
                # 2. Si falla la exacta, intentar búsqueda parcial/insensible
                if not items_found:
                    logger.info(f"Búsqueda exacta falló para '{doc_name}'. Intentando búsqueda parcial...")
                    # Algunos campos en Bitrix no soportan '%' directamente en Smart Processes de la misma forma,
                    # así que intentamos obtener ítems recientes o con un filtro más relajado si es posible,
                    # pero lo más seguro es usar el título tal cual sin caracteres extraños.
                    search_res = await bitrix.execute("crm.item.list", {
                        "entityTypeId": 1100,
                        "filter": {"%TITLE": doc_name},
                        "select": ["id", "title"]
                    })
                    items_found = search_res.get("result", {}).get("items", [])
                
                if not items_found:
                    logger.warning(f"No se encontró el documento '{doc_name}' en Bitrix (ni búsqueda exacta ni parcial).")
                    stats["errors"] += 1
                    continue
                
                # Para cada coincidencia, actualizar el campo
                for b_item in items_found:
                    await bitrix.execute("crm.item.update", {
                        "entityTypeId": 1100,
                        "id": b_item["id"],
                        "fields": {
                            "ufCrm35_1750701105": n_asignado_val # Nro asignado
                        }
                    })
                    stats["updates"] += 1
            
            except Exception as e:
                logger.error(f"Error actualizando '{doc_name}': {str(e)}")
                stats["errors"] += 1

        return {
            "status": "completed",
            "stats": stats,
            "folder": folder_name,
            "file": oti_file['name']
        }

    except Exception as e:
        logger.error(f"Error en workflow de Control Documental: {str(e)}")
        raise
