# BracketFlow

BracketFlow es un MVP full-stack para gestionar torneos esports con dos modos activos:

- `single_elimination` para bracket clasico
- `battle_royale_points`, `roulette_2v2` y `roulette_3v3` para Warzone con scoring por kills y placement

## Filosofía de producto

> Cada clic debe acercarte al torneo, nunca al software.

La interfaz sigue el concepto **Arena OS**: control competitivo, calma con tensión elegante y profundidad visual sin estética gamer recargada.

## Stack

- Frontend: Next.js App Router + TypeScript
- Backend: FastAPI
- Base de datos: SQLite
- ORM: SQLAlchemy
- Schemas: Pydantic

## Estructura

```text
app/
├── backend/
│   ├── app/
│   ├── requirements.txt
│   └── README.md
├── frontend/
│   ├── app/
│   ├── lib/
│   └── README.md
└── AGENTS.md
```

## Estado actual

### Ya implementado

- Health check y Swagger en FastAPI
- Creacion y listado de torneos
- Torneos con formato seleccionable
- Equipos manuales
- Bracket clasico de primera ronda
- Jugadores por torneo
- Ruleta reproducible `2v2` y `3v3` con `seed`
- Equipos generados automaticamente con miembros
- Rondas Battle Royale
- Carga y actualizacion de resultados por equipo
- Scoring `wsow_like`
- Leaderboard acumulado
- Detalle de puntos por ronda en frontend

### Pendiente o no incluido todavia

- Migraciones con Alembic
- Autenticacion
- Persistencia cloud
- Admin avanzado de rounds
- Resolucion completa de bracket
- IA

## Importante sobre SQLite

Si vienes del schema anterior, borra `backend/bracketflow.db` antes de probar cambios de modelos.

`create_all()` crea tablas nuevas, pero no modifica columnas existentes.

## Ejecutar backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend:

- API: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`
- Health: `http://localhost:8000/health`

## Ejecutar frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend:

- UI: `http://localhost:3000`

## QA local del repo

Desde la raiz del repo:

```powershell
.\scripts\qa.ps1
```

Flags disponibles:

- `.\scripts\qa.ps1 -FrontendOnly`
- `.\scripts\qa.ps1 -BackendOnly`
- `.\scripts\qa.ps1 -SkipBuild`

El script ejecuta:

1. `git status --short`
2. `npm run lint` en `app/frontend`
3. `npm run build` en `app/frontend` salvo `-SkipBuild`
4. `pytest` en `app/backend` si hay Python disponible

## CI

El workflow del repo vive en `.github/workflows/ci.yml`.

Corre en:

- `pull_request` hacia `master`
- `push` hacia `master`

Checks actuales:

- frontend: `npm ci`, `npm run lint`, `npm run build`
- backend: `pip install -r requirements.txt`, `python -m pytest tests`

## Pull Requests

Usar `.github/pull_request_template.md`.

Antes de abrir PR:

1. correr `.\scripts\qa.ps1`
2. revisar `git diff --stat`
3. confirmar que el cambio no mezcla dominios
4. documentar riesgos y rollback

## Agentes

Spec del agente de revision/CI:

- `app/docs/agents/ci-pr-qa-agent.md`

Ese agente existe para revisar ramas, ejecutar QA local, detectar scope creep y bloquear merge cuando falten validaciones.

## Flujo rapido de prueba

### Bracket clasico

1. Crear torneo con formato `single_elimination`
2. Agregar al menos dos equipos
3. Generar bracket
4. Ver matches creados

### Warzone / roulette

1. Crear torneo `roulette_2v2` o `roulette_3v3`
2. Agregar 4 o 6 jugadores
3. Generar ruleta
4. Crear ronda 1
5. Registrar `kills` y `placement` por equipo
6. Ver leaderboard y detalle por ronda

## Endpoints principales

- `GET /health`
- `POST /tournaments`
- `GET /tournaments`
- `GET /tournaments/{id}`
- `POST /tournaments/{id}/teams`
- `GET /tournaments/{id}/teams`
- `POST /tournaments/{id}/generate-bracket`
- `POST /tournaments/{id}/players`
- `GET /tournaments/{id}/players`
- `POST /tournaments/{id}/generate-roulette-teams`
- `POST /tournaments/{id}/matches`
- `POST /matches/{match_id}/results`
- `GET /tournaments/{id}/leaderboard`
- `GET /tournaments/{id}/results`
