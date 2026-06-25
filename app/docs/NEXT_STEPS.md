# Next Steps

## Sprint actual

- Dashboard v2: motor de torneos cards, panel casters, nombre+id en stats, look ESPN/dopamina.
- Después: llevar Arena OS a Operator/Standings.
- Auth sprint posterior: Neon Auth + RLS + ownership de torneos + migración SQLite→Postgres.

## HECHO (sprints anteriores)

- `ui(hub): arena os — motores de torneo + ecosistema + fondo` — Hub completo con hero Tap Tap, formulario por progressive disclosure, cuatro motores visuales, herramientas esenciales y fondo minimalista de halos/partículas. Filosofía Arena OS registrada en README. Commit: `cae017c`.
- `ui(shell): migra standings al shell operator + topbar contextual` — `/standings` migrado al route group `(operator)`, topbar contextual, selector de torneo preservado. Commit: `8b9b6c6`.
- `fix(operator): opr-amb z-index, nav+stats visibles` — Commit: `c49df7e`.
- `ui(dashboard): operador-first layout + copy esport, kill redundancia` — Dashboard reescrito: franja estado + podio Top 3 + 4 acciones héroe. Commit: `64b67d3`.
- `ui(hub): rediseño cara de entrada esport` — Base previa del hero, prácticas en curso y navegación del hub. Commit: `9724da5`.
- `ui: EN VIVO en operator + rename equipos&roster` — "Backend online"→"EN VIVO"/"SIN CONEXIÓN" en operator cockpit y "Setup · Equipos"→"Equipos & Roster". Commit: `13d90c2`.

## ESTADO

- Frontend lint verde.
- Frontend production build verde.
- Hub Arena OS completo: tres acciones contextuales, form oculto hasta interacción, cuatro motores, herramientas y fondo con halos/partículas suaves.
- `/dashboard` y `/standings` comparten sidebar y shell.
- `/operator` conserva su layout cockpit.
- `/stream` OBS (sidebar y lower) conserva canvas transparente, sin shell.

## VERIFICAR

- `/`: hero con CTA "Crear práctica", "Continuar torneo" cuando exista uno activo y "Explorar motores"; el form no aparece hasta tocar Crear/Seleccionar.
- `/`: cuatro motores, herramientas esenciales y fondo Arena OS sin efectos reactivos.
- `/dashboard`, `/standings` y `/operator`: sin regresión.
- `/stream?tournamentId=1&obs=1&bg=transparent&layout=sidebar` y `layout=lower`: overlays intactos.

```bash
cd app/frontend
PATH=/Users/mac/.nvm/versions/node/v22.22.2/bin:$PATH npm run lint
PATH=/Users/mac/.nvm/versions/node/v22.22.2/bin:$PATH npm run build
```

## SIGUIENTE

- Dashboard v2: motores + price pool dopamina + nombre e ID de jugadores + look de resultados constantes.
- Luego: Arena OS en Operator/Standings.
- Después: sprint Auth con Neon.

## Regla de enfoque

- Seguir el MAPA-MAESTRO: una fase a la vez.
- Toda idea nueva va a `docs/PARKING_LOT.md` antes de entrar al sprint.
