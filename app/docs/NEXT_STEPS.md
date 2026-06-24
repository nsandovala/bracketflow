# Next Steps

## Sprint actual

- Shell unification: migrar `/operator` y `/standings` dentro del mismo shell de operator.
- Topbar contextual por vista (hoy el topbar compacto vive en `/operator`; llevar a las demás vistas operativas).
- Placeholders premium: Torneos / Equipos / Ajustes en el sidebar del shell.
- Clerk / auth: saludo contextual en dashboard ("Bienvenido, [nombre]").

## HECHO (sprints anteriores)

- `fix(operator): opr-amb z-index, nav+stats visibles` — `.opr-amb` (position:fixed, z-index:0) tapaba nav compacta y tira de 3 stats. Fix: z-index:-1 + position:relative z-index:1 en hijos directos. Commit: `c49df7e`.
- `ui(dashboard): operador-first layout + copy esport, kill redundancia` — Dashboard reescrito: franja de estado 1-línea + podio Top 3 + 4 acciones héroe grandes. Eliminadas tablas duplicadas y grid "Cargar game". Copy hub actualizado (hero, chip backend→EN VIVO, título Otros Modos limpio). Typo "reguardar"→"Editar" en Operator. Commit: pendiente.

## VERIFICAR

- `/` (hub): hero nuevo sin "sin ruido visual", chip EN VIVO (verde), título "Formatos alternativos".
- `/dashboard`: franja de estado + stat-cards + podio Top 3 + 4 acciones héroe grandes. Sin tabla duplicada ni grid de cards vacías.
- `/operator` y `/standings`: intactos, sin regresión visual.
- Build + lint verde.

## Orden recomendado

1. Consolidar el shell visual y el layout compartido.
2. Migrar `operator` y `standings` adentro del shell.
3. Topbar contextual por vista activa.
4. Verificar alineación frontend/backend en flujo real.
5. QA manual end-to-end con torneo real, resultados y leaderboard.

## Siguiente bloque después del sprint

- Match Point para BR y Rebirth.
- Badges y estado de campeón en standings y stream.
- Ajustes de stream UX según lo que deje el shell unificado.

## Backlog diferido

- `Clerk` y ownership de torneos.
- Créditos, RESPIN y monetización.
- Bot de Discord.
- Agentes de automatización para stats prints u overlays.
- Persistencia más robusta, migraciones y tests automatizados.

## Regla de enfoque

- Si una idea no ayuda directamente a cerrar el shell unificado o WS Practice/Rebirth, va a `docs/PARKING_LOT.md` y no entra a este sprint.
