# Next Steps

## Sprint actual

- Migrar `/operator` y `/standings` al shell (operator) — unificación.
- Reemplazar el topbar fijo por un topbar contextual por vista.
- Mantener la calidad visual del dashboard en todas las vistas operativas.
- Cerrar el flujo WS Practice sin datos demo y con QA manual completo.
- Extender WS a Rebirth como modo o metadata si el scoring permanece igual.

## HECHO (este sprint)

- `fix(operator): opr-amb z-index, nav+stats visibles` — el `.opr-amb` (position:fixed, z-index:0) tapaba la nav compacta y la tira de 3 stats. Fix: `z-index:-1` en `.bf-page-operator > .opr-amb` + `position:relative; z-index:1` en los hijos directos. Build/lint verde.

## VERIFICAR

- Abrir `/operator?tournamentId=1`: confirmar nav compacta arriba (BF + Hub/Operator/Standings/Stream + selector + backend) y tira de 3 stats visible bajo el command bar.

## Orden recomendado

1. Consolidar el shell visual y el layout compartido.
2. Migrar `operator` y `standings` adentro del shell.
3. Volver contextual el header o topbar según la vista activa.
4. Verificar que frontend y backend siguen alineados en el flujo real.
5. Ejecutar QA manual end-to-end con torneo real, resultados y leaderboard.

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
