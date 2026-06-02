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

## Validation

```powershell
cd backend
python -m compileall app
```
