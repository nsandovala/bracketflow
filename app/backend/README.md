# Backend

Backend FastAPI de BracketFlow.

## Funcionalidad actual

- Health check
- CRUD basico de torneos
- Equipos manuales
- Bracket clasico de primera ronda
- Jugadores por torneo
- Ruleta 2v2 y 3v3
- Creacion de rondas battle royale
- Carga y actualizacion de resultados
- Leaderboard acumulado
- Detalle de resultados por torneo y ronda

## Install

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Database

- SQLite local en `backend/bracketflow.db`
- Si cambian modelos y el schema ya existe, borra el archivo para regenerarlo
- No hay Alembic todavia

## Run

```powershell
cd backend
uvicorn app.main:app --reload
```

## Health Check

```powershell
Invoke-WebRequest http://127.0.0.1:8000/health
```

## OCR multimodal

El gateway OCR corre solo en backend. Sin `OPENAI_API_KEY`, el endpoint conserva
el estado seguro de proveedor no disponible.

```powershell
$env:OCR_PROVIDER = "openai"
$env:OPENAI_API_KEY = "..."
$env:OCR_OPENAI_MODEL = "gpt-5" # opcional; gpt-5 es el default
$env:OCR_PROVIDER_TIMEOUT_SECONDS = "30" # opcional
$env:OPENAI_API_BASE_URL = "https://api.openai.com/v1" # opcional
```

- `GET /ocr/provider` informa proveedor, modelo y si la configuración local está
  completa. No verifica disponibilidad remota ni expone credenciales.
- `POST /tournaments/{tournament_id}/matches/{match_id}/ocr/extract?filename=shot.png`
  recibe el archivo como body binario.
- PNG, JPG/JPEG y WEBP; máximo 8 MB. MIME, extensión y firma binaria deben coincidir.
- BracketFlow no persiste las imágenes subidas a disco.
- Las solicitudes al Responses API se envían con `store=false`. Esto no constituye
  una afirmación de retención cero fuera de BracketFlow.
- La salida siempre pasa por revisión humana antes de crear drafts locales.

## Validation

```powershell
cd backend
python -m compileall app
```
