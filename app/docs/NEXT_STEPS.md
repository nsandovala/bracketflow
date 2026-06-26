# Next Steps

## Sprint actual

- Dashboard v2 completado como cockpit operator-first.
- Siguiente foco: revisar visualmente Dashboard v2 con datos reales y decidir si Arena OS baja a Operator/Standings.
- Auth sprint posterior: Neon Auth + RLS + ownership de torneos + migración SQLite→Postgres.

## HECHO (sprints anteriores)

- `ui(dashboard): operator-first cockpit v2` — `/dashboard` convertido en cabina operativa: topbar "Dashboard Operativo", franja de práctica activa con juego/game/líder y CTA a Operator, cuatro métricas superiores, podio compacto Top 3, acciones jerarquizadas y motores compactos informativos. Commit: `8cd5a56`.
- `ui(hub): refine arena os hierarchy and visual depth` — Hub refinado con Command Deck, estado operativo real, jerarquía sin marca duplicada, motores con estados y mayor presencia, ecosistema compacto y fondo con más profundidad. Commit: `c894d60`.
- `ui(hub): arena os — motores de torneo + ecosistema + fondo` — Hub completo con hero Tap Tap, formulario por progressive disclosure, cuatro motores visuales, herramientas esenciales y fondo minimalista de halos/partículas. Filosofía Arena OS registrada en README. Commit: `cae017c`.
- `ui(shell): migra standings al shell operator + topbar contextual` — `/standings` migrado al route group `(operator)`, topbar contextual, selector de torneo preservado. Commit: `8b9b6c6`.
- `fix(operator): opr-amb z-index, nav+stats visibles` — Commit: `c49df7e`.
- `ui(dashboard): operador-first layout + copy esport, kill redundancia` — Dashboard reescrito: franja estado + podio Top 3 + 4 acciones héroe. Commit: `64b67d3`.
- `ui(hub): rediseño cara de entrada esport` — Base previa del hero, prácticas en curso y navegación del hub. Commit: `9724da5`.
- `ui: EN VIVO en operator + rename equipos&roster` — "Backend online"→"EN VIVO"/"SIN CONEXIÓN" en operator cockpit y "Setup · Equipos"→"Equipos & Roster". Commit: `13d90c2`.

## ESTADO

- Frontend lint verde.
- Frontend production build verde.
- `/dashboard` ahora responde a la pregunta operativa: torneo activo, estado, líder y siguiente paso.
- Hub Arena OS refinado: Command Deck con torneo/game/reportes reales, tres acciones contextuales, form oculto hasta interacción, motores modulares y ecosistema próximo.
- `/dashboard` y `/standings` comparten sidebar y shell.
- `/operator` conserva su layout cockpit.
- `/stream` OBS (sidebar y lower) conserva canvas transparente, sin shell.

## VERIFICAR

- `/`: hero con CTA "Crear práctica", "Continuar torneo" cuando exista uno activo y "Explorar motores"; el form no aparece hasta tocar Crear/Seleccionar.
- `/`: cuatro motores, herramientas esenciales y fondo Arena OS sin efectos reactivos.
- `/dashboard`: topbar "Dashboard Operativo", franja de práctica activa, 4 métricas, podio Top 3, acciones jerarquizadas, motores compactos.
- `/dashboard`, `/standings` y `/operator`: sin regresión.
- `/stream?tournamentId=1&obs=1&bg=transparent&layout=sidebar` y `layout=lower`: overlays intactos.

```bash
cd app/frontend
PATH=/Users/mac/.nvm/versions/node/v22.22.2/bin:$PATH npm run lint
PATH=/Users/mac/.nvm/versions/node/v22.22.2/bin:$PATH npm run build
```

## SIGUIENTE

- QA visual de Dashboard v2 con datos reales de torneo.
- Luego: Arena OS en Operator/Standings si el cockpit queda validado.
- Después: sprint Auth con Neon.

## BLOQUEOS

- El modelo definitivo de motores de torneo y sus variantes de scoring sigue pendiente de research.
- No implementar esa lógica desde las cards del hub hasta cerrar contratos y reglas.
- QA visual con navegador integrado no estuvo disponible; se validó por lint/build y HTML inicial/rutas.

## Regla de enfoque

- Seguir el MAPA-MAESTRO: una fase a la vez.
- Toda idea nueva va a `docs/PARKING_LOT.md` antes de entrar al sprint.
