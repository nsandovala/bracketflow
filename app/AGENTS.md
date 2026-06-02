# BracketFlow Agent Notes

## Proyecto

BracketFlow vive en esta carpeta `app/` y se divide en:

- `backend/`: FastAPI + SQLite + SQLAlchemy
- `frontend/`: Next.js App Router + TypeScript

## Reglas operativas

- No mover la estructura `backend/` y `frontend/`
- No introducir Docker, auth, pagos ni IA salvo pedido explicito
- Mantener compatibilidad con el bracket clasico
- Para Battle Royale, priorizar cambios minimos y verificables

## Backend

- Entry point: `backend/app/main.py`
- DB local: `backend/bracketflow.db`
- Si cambia el schema y no hay migraciones, parar backend y borrar `backend/bracketflow.db`
- Correr con:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload
```

### Dominio actual

- `Tournament`
- `Team`
- `Player`
- `TeamMember`
- `Match`
- `TeamResult`

### Modos activos

- `single_elimination`
- `battle_royale_points`
- `roulette_2v2`
- `roulette_3v3`

### Validaciones utiles

```powershell
cd backend
python -m compileall app
```

## Frontend

- Pantalla principal: `frontend/app/page.tsx`
- Cliente API: `frontend/lib/api.ts`
- Estilos globales: `frontend/app/globals.css`
- Correr con:

```powershell
cd frontend
npm run dev
```

### Validacion util

```powershell
cd frontend
npm run lint
```

## Estado funcional actual

- Crear torneos con formato
- Crear equipos manuales
- Crear jugadores
- Generar bracket clasico
- Generar ruleta 2v2 y 3v3
- Crear rondas battle royale
- Registrar kills y placement
- Ver leaderboard acumulado
- Ver detalle de puntos por ronda

## Criterio de cambio

- Preferir extender modelos y endpoints existentes
- Evitar rediseños grandes del frontend
- No reemplazar datos reales por mocks si la API existe
