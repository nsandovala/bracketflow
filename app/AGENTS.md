# BracketFlow Agent Guide

## Que es BracketFlow

BracketFlow es un sistema real de gestion de torneos esports con foco inicial en Warzone. El MVP actual cubre torneos, jugadores, equipos, ruleta 2v2 y 3v3, rondas Battle Royale, resultados por kills y placement, y leaderboard acumulado.

## Stack actual

- Backend: Python, FastAPI, SQLite, SQLAlchemy, Pydantic
- Frontend: Next.js, TypeScript, App Router
- Base de datos local de desarrollo: `backend/bracketflow.db`

## Estructura del proyecto

- `backend/`: API, modelos, schemas, CRUD y persistencia SQLite
- `frontend/`: interfaz Next.js, cliente API y UX del MVP
- `docs/agents/`: reglas operativas por rol para agentes y asistentes

## Reglas generales para cualquier agente

- Mantener el stack actual.
- Mantener la compatibilidad con el bracket clasico y los modos activos.
- Preferir cambios pequenos, verificables y alineados al MVP.
- Extender codigo existente antes de introducir nuevas capas o abstracciones.
- Usar la API real existente cuando ya haya endpoint para la necesidad.
- Definir criterio de exito antes de aceptar cambios funcionales.
- Hacer cambios de backend primero cuando la funcionalidad dependa de datos o contratos.
- Hacer cambios de frontend despues de confirmar contratos y comportamiento backend.
- Cerrar siempre con validacion y QA manual al final.

## Foco actual del sprint

- Unificar `dashboard`, `/operator` y `/standings` dentro del mismo shell visual de operator.
- Hacer el topbar del shell contextual por vista, sin textos hardcodeados compartidos.
- Cerrar un flujo WS Practice fluido y consistente, con calidad visual equivalente entre vistas.
- Mantener el scoring WS ya existente para Battle Royale y extender Rebirth como modo o metadata solo si no cambia el calculo.
- Priorizar consistencia de UX y cierre del flujo real antes de abrir nuevos frentes.

## No foco del sprint actual

- No implementar `Clerk` ni otra autenticacion en este sprint.
- No implementar Match Point en este sprint.
- No implementar monetizacion, creditos, RESPIN ni planes en este sprint.
- No implementar bot de Discord en este sprint.
- No crear agentes de automatizacion de stats, prints u overlays hasta fijar contratos y eventos.
- Si surge una idea nueva de producto, documentarla en backlog antes de mezclarla con el trabajo del sprint.

## Que no se debe hacer

- No mover ni reestructurar `backend/` y `frontend/`.
- No cambiar el stack.
- No agregar Docker.
- No agregar autenticacion.
- No agregar pagos.
- No agregar IA salvo pedido explicito.
- No crear seeders.
- No crear mocks persistentes.
- No agregar demo data.
- No agregar botones demo.
- No reemplazar datos reales por datos ficticios si la API existe.
- No ejecutar `npm audit fix --force`.
- No introducir redisenos grandes sin necesidad funcional.

## Politica estricta de datos

- El repo debe trabajar con datos reales ingresados manualmente o con datos creados por el flujo normal de la aplicacion.
- Estan prohibidos demo data, seeders, fixtures permanentes, mocks persistentes y accesos UI de demostracion.
- Si para probar algo hace falta informacion, debe ingresarse por el flujo real del sistema o documentarse el faltante sin inventar datos.

## Politica SQLite en desarrollo local

- La base local actual es `backend/bracketflow.db`.
- No hay migraciones formales todavia.
- Si cambia el schema en desarrollo local, debe avisarse explicitamente que puede ser necesario detener el backend y borrar `backend/bracketflow.db` para regenerar la base.
- Nunca asumir regeneracion silenciosa de la base; siempre documentar el impacto.

## Como correr backend

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload
```

## Como correr frontend

```powershell
cd frontend
npm run dev
```

## Como validar cambios

Backend:

```powershell
cd backend
python -m compileall app
```

Frontend:

```powershell
cd frontend
npm run lint
```

Validacion funcional minima:

- Backend online
- Swagger responde
- Frontend detecta backend
- Flujo real de torneo sin datos demo
- Leaderboard coherente con resultados cargados

## Flujo correcto de trabajo

1. Confirmar alcance y criterio de exito.
2. Revisar impacto en backend y contratos de datos.
3. Cambiar backend primero si el flujo lo requiere.
4. Cambiar frontend despues, consumiendo la API real.
5. Ejecutar validaciones tecnicas minimas.
6. Ejecutar QA manual del flujo completo al final.

## Referencias operativas

- `docs/agents/architect.md`
- `docs/agents/backend.md`
- `docs/agents/frontend.md`
- `docs/agents/scoring.md`
- `docs/agents/qa.md`
- `docs/agents/stream-ux.md`
- `docs/CODEX_CONTEXT.md`
- `docs/NEXT_STEPS.md`
- `docs/PARKING_LOT.md`
