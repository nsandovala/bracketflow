# Next Steps

## Sprint actual

- Shell unification: `/dashboard` y `/standings` ya comparten el shell operator.
- Mantener `/operator` con su cockpit actual y `/stream` fuera del shell para proteger los overlays OBS.
- Placeholders premium: Torneos / Equipos / Ajustes en el sidebar del shell.

## HECHO (sprints anteriores)

- `ui(shell): migra standings al shell operator + topbar contextual` — `/standings` migrado al route group `(operator)`, navegación propia eliminada, selector de torneo preservado, topbar contextual sin Clerk y tabla alineada con los tokens glass del dashboard. Commit: `8b9b6c6`.
- `fix(operator): opr-amb z-index, nav+stats visibles` — `.opr-amb` (position:fixed, z-index:0) tapaba nav compacta y tira de 3 stats. Fix: z-index:-1 + position:relative z-index:1 en hijos directos. Commit: `c49df7e`.
- `ui(dashboard): operador-first layout + copy esport, kill redundancia` — Dashboard reescrito: franja de estado 1-línea + podio Top 3 + 4 acciones héroe grandes. Eliminadas tablas duplicadas y grid "Cargar game". Copy hub actualizado (hero, chip backend→EN VIVO, título Otros Modos limpio). Typo "reguardar"→"Editar" en Operator. Commit: `64b67d3`.

## ESTADO

- Frontend lint verde.
- Frontend production build verde.
- `/dashboard` y `/standings` comparten sidebar y shell.
- `/operator` conserva su layout actual.
- `/stream` OBS (`sidebar` y `lower`) conserva canvas transparente, sin sidebar ni topbar.

## SIGUIENTE

- Hub redesign como cara de entrada.
- Copy de neuroventa.
- Logo.
- Cambiar "Backend online" por "EN VIVO" en Operator.
- Corregir "Abrir Stream" para que lleve parámetros OBS.
- Cambiar "Setup · Equipos" por "Equipos & Roster".
- Clerk / auth.

## BLOQUEOS

- El navegador integrado no estuvo disponible para QA visual con screenshots.
- El backend local no devolvió un torneo activo durante la comprobación HTTP; se validó routing, shell y aislamiento OBS por estructura renderizada.

## VERIFICAR

```bash
cd app/frontend
PATH=/Users/mac/.nvm/versions/node/v22.22.2/bin:$PATH npm run lint
PATH=/Users/mac/.nvm/versions/node/v22.22.2/bin:$PATH npm run build
```

- `/dashboard` → "Ver clasificación completa" → `/standings`: mismo shell y sidebar, sin navegación duplicada.
- `/standings`: topbar contextual, selector de torneo y primer puesto con acento menta.
- `/operator?tournamentId=1`: cockpit actual intacto.
- `/stream?tournamentId=1&obs=1&bg=transparent&layout=sidebar`: overlay transparente, sin shell.
- `/stream?tournamentId=1&obs=1&bg=transparent&layout=lower`: overlay transparente, sin shell.

## Regla de enfoque

- Si una idea no ayuda directamente a cerrar el shell unificado o WS Practice/Rebirth, va a `docs/PARKING_LOT.md` y no entra a este sprint.
