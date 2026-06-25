# Next Steps

## Sprint actual

- Dashboard v2: motor de torneos cards, panel casters, nombre+id en stats, look ESPN/dopamina.
- Auth sprint: Neon Auth + RLS + ownership de torneos + migración SQLite→Postgres + saludo contextual en dashboard.

## HECHO (sprints anteriores)

- `ui(shell): migra standings al shell operator + topbar contextual` — `/standings` migrado al route group `(operator)`, topbar contextual, selector de torneo preservado. Commit: `8b9b6c6`.
- `fix(operator): opr-amb z-index, nav+stats visibles` — Commit: `c49df7e`.
- `ui(dashboard): operador-first layout + copy esport, kill redundancia` — Dashboard reescrito: franja estado + podio Top 3 + 4 acciones héroe. Commit: `64b67d3`.
- `ui(hub): rediseño cara de entrada esport` — Hero 2-col (copy + form "Crear torneo" como CTA), tournament cards con 3 botones inline, formatos como chips. Commit: pendiente.
- `ui: EN VIVO en operator + rename equipos&roster` — "Backend online"→"EN VIVO"/"SIN CONEXIÓN" en operator cockpit, "Setup · Equipos"→"Equipos & Roster". Stream links del hub llevan tournamentId directo. Commit: pendiente.

## ESTADO

- Frontend lint verde.
- `/dashboard` y `/standings` comparten sidebar y shell.
- `/operator` conserva su layout cockpit.
- `/stream` OBS (sidebar y lower) conserva canvas transparente, sin shell.

## VERIFICAR

- `/` (hub): hero con peso (título Rajdhani grande + tagline + form CTA), prácticas en curso como cards inline, formatos comprimidos a chips.
- `/operator`: chip "EN VIVO" (no "Backend online"). Toggle "Equipos & Roster".
- `/dashboard` → "Abrir Stream": lleva `?tournamentId=`.
- `/stream?tournamentId=1&obs=1&bg=transparent&layout=sidebar` y `layout=lower`: overlays intactos.
- Build + lint verde.

## SIGUIENTE

- Dashboard v2: motores de torneo cards, Discord link, panel casters, nombres de jugadores en stats, estética ESPN.
- Auth: Neon Auth + RLS + ownership + migración SQLite→Postgres.
- Placeholders premium: Torneos / Equipos / Ajustes en sidebar del shell.

## Regla de enfoque

- Si una idea no ayuda directamente a Dashboard v2 o Auth, va a `docs/PARKING_LOT.md`.
