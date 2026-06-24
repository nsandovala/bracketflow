# Codex Context

> Handoff persistente para futuras sesiones de Codex.
> Ultima actualizacion: 2026-06-23.

## Estado actual

- El repo ya tiene un dashboard visualmente mas fuerte dentro del shell de operator.
- El problema abierto es de consistencia: `dashboard` vive dentro del shell, pero `/operator` y `/standings` todavia se sienten de otra liga cuando quedan fuera de ese layout.
- La nav compacta previa fue un parche visual, no la solucion estructural.

## Decision tomada

- El siguiente trabajo de producto y frontend debe ser unificar `dashboard`, `/operator` y `/standings` dentro del mismo shell de operator.
- El topbar del shell no debe quedar hardcodeado con un mensaje fijo; debe volverse contextual por vista.
- El objetivo es que toda la experiencia operativa herede el mismo sidebar, ritmo visual y nivel de pulido del dashboard.

## Foco del sprint

- WS Practice fluido y unificado.
- `operator` y `standings` migrados dentro del shell.
- Topbar contextual por pantalla.
- QA manual del flujo real completo.
- WS en BR y Rebirth, tratando Rebirth como modo o metadata si el scoring no cambia.

## Lo que no entra en este sprint

- `Clerk` o cualquier autenticacion.
- Match Point.
- Monetizacion, creditos, RESPIN o planes.
- Bot de Discord.
- Agentes de automatizacion para stats prints, overlays o salidas automaticas.

## Rebirth

- La hipotesis vigente es que Rebirth usa el mismo scoring multiplicativo ya cubierto por `WSOW_PLACEMENT_BANDS`.
- Antes de cerrar esa parte, hay que verificar si existe alguna variante real por tamano de lobby o reglas de evento.
- Mientras eso no cambie el calculo, BR vs Rebirth debe resolverse como diferencia de modo o metadata, no como motor nuevo de scoring.

## Clerk y backlog de producto

- `Clerk` si esta en backlog cercano, pero deliberadamente fuera del sprint actual.
- El backlog grande de producto, monetizacion y automatizacion ya fue congelado en `docs/PARKING_LOT.md`.
- Si surge una idea nueva, documentarla primero y no mezclarla con el trabajo del shell unificado.

## Como retomar rapido en otra maquina

1. Leer `AGENTS.md`.
2. Leer `docs/CODEX_CONTEXT.md`.
3. Leer `docs/NEXT_STEPS.md`.
4. Leer `docs/PARKING_LOT.md`.
5. Revisar el layout y routing actuales del frontend antes de cambiar codigo.

## Siguiente paso recomendado

- Inspeccionar el shell actual del dashboard en frontend.
- Identificar que layout compartido conviene extraer.
- Mover `/operator` y `/standings` a ese shell.
- Hacer el header contextual por ruta o estado de vista.
- Validar que no se rompa el flujo real de torneo ni la integracion con backend.
