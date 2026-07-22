# BracketFlow - Contexto de QA y Recomendaciones

> Documento de continuidad para sesiones futuras.  
> Fecha: 2026-07-14  
> Estado actual: D1 Dashboard Operativo implementado sobre datos reales.

## D1 Dashboard Operativo

**Rama:** `feat/dashboard-operational-redesign` (sin commit)

### Objetivo QA

- validar que el Dashboard ya no sea solo una portada visual;
- confirmar que la lectura operativa usa datos reales;
- asegurar que los empty states no mientan;
- mantener desktop/tablet first con mobile safe.

### Datos reales visibles en Dashboard

| Area | Fuente real |
|---|---|
| backend online/offline | `backendOnline` |
| torneo activo | `selectedTournament` |
| motor/formato | `selectedEngine` |
| equipos y participantes | `teams`, `players` |
| partidas / series | `matches` |
| reportes pendientes | `activeMatchResults`, `pendingTeams` |
| standings | `sortedStandings` |
| Match Point | `matchPointStatus` |
| campeon Kill Race | derivado desde `matches` reales |

### QA automatizado ejecutado

| Check | Resultado |
|---|---|
| `cd app/frontend && npm run lint` | pasa, 11 warnings preexistentes fuera de D1 |
| `cd app/frontend && npm run build` | OK |

### QA manual pendiente de Nelson

- Desktop `1920x1080`
- Laptop `1366x768`
- Tablet `1024px`
- Mobile `390x844`

### Criterio honesto de cierre

- No declarar aprobado visualmente sin Nelson.
- Si un dato no existe, el dashboard debe decirlo.
- Si el backend cae, el dashboard debe mostrarlo.
- No usar demo data ni simulaciones para llenar el cockpit.

## Baseline canonico del repo

- `.\scripts\qa.ps1`
- `cd app/frontend && npm run lint`
- `cd app/frontend && npm run build`
- `cd app/backend && .\.venv\Scripts\python.exe -m pytest tests`
- `git status --short`
- `git diff --stat`
- `git diff --name-status`

## Warnings conocidos del frontend

- `RouletteArena.tsx`: warnings de variables no usadas.
- `WorldSeriesOperator.tsx`: warnings de props/estado no usados.
- `tournamentMode.ts`: warnings de variables helper no usadas.

Estos warnings ya existian y no fueron abiertos por D1.

## Fuera de scope explicitado

- backend
- scoring
- APIs nuevas
- Operator
- BracketView
- Stream
- Home Gedeon Arena
- Push Mode
- OCR
- Caster Suite

## Mac / Next Dev: Turbopack cache reset

### Context

When working from `/Volumes/Dev-storage` on Mac, Next.js / Turbopack can occasionally serve a stale CSS snapshot after a large pull or merge.

Symptoms:

- Operator shell loads, but inner screens look like plain text.
- `/caster`, `/dashboard`, `/torneos`, or `/ajustes` lose layout/card styling.
- Sidebar/background still render, but component-level classes are missing.
- `npm run build` can still pass because production CSS is correct.
- Backend and tests can also be healthy.

This is usually not a backend or feature-code issue.

### Confirm

Check Git first:

```bash
git status -sb
git log --oneline --decorate -5