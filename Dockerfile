# Etapa 1: Construcción del Frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/src/frontend
COPY src/frontend/package*.json ./
RUN npm install
COPY src/frontend/ ./
RUN npm run build

# Etapa 2: Aplicación Final
FROM python:3.12-slim-bookworm

# Evitar que Python genere archivos .pyc y activar salida sin buffer
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Directorio de trabajo
WORKDIR /app

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependencias de Python
COPY pyproject.toml .
RUN pip install --no-cache-dir .

# Crear usuario no-root para seguridad
RUN useradd -m taguser 
RUN mkdir -p /app/data && chown taguser:taguser /app/data

# Copiar el código fuente
COPY --chown=taguser:taguser . .

# Copiar el build del frontend desde la primera etapa
COPY --from=frontend-builder --chown=taguser:taguser /app/src/frontend/dist /app/src/frontend/dist

USER taguser

# Exponer el puerto de FastAPI
EXPOSE 8000

# Comando por defecto
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
