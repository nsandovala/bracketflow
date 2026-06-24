# Next Steps

## Sprint actual

- Unificar `dashboard`, `/operator` y `/standings` dentro del mismo shell de operator.
- Reemplazar el topbar fijo por un topbar contextual por vista.
- Mantener la calidad visual del dashboard en todas las vistas operativas.
- Cerrar el flujo WS Practice sin datos demo y con QA manual completo.
- Extender WS a Rebirth como modo o metadata si el scoring permanece igual.

## Orden recomendado

1. Consolidar el shell visual y el layout compartido.
2. Migrar `operator` y `standings` adentro del shell.
3. Volver contextual el header o topbar segun la vista activa.
4. Verificar que frontend y backend siguen alineados en el flujo real.
5. Ejecutar QA manual end-to-end con torneo real, resultados y leaderboard.

## Siguiente bloque despues del sprint

- Match Point para BR y Rebirth.
- Badges y estado de campeon en standings y stream.
- Ajustes de stream UX segun lo que deje el shell unificado.

## Backlog diferido

- `Clerk` y ownership de torneos.
- Creditos, RESPIN y monetizacion.
- Bot de Discord.
- Agentes de automatizacion para stats prints u overlays.
- Persistencia mas robusta, migraciones y tests automatizados.

## Regla de enfoque

- Si una idea no ayuda directamente a cerrar el shell unificado o WS Practice/Rebirth, va a `docs/PARKING_LOT.md` y no entra a este sprint.
