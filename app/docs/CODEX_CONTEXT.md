# Codex Context

> Handoff persistente para futuras sesiones de Codex.
> Ultima actualizacion: 2026-06-30.

## Estado actual

- Parser de participantes robusto: separa por newline, coma, punto y coma, tab, multiples espacios.
- Validacion anti-comas en frontend y backend: evita nicknames concatenados como `manteca, demain, carlos, lalo, clara`.
- UI copy anti-duplicidad aplicada en ruleta, bracket, standings y operator.
- Bracket visual funciona con nombres reales y BYE explicito.
- Stream bifurca correctamente: Kill Race -> bracket, WSOW/Rebirth -> standings.
- Operator Kill Race muestra bracket y contexto BO3 (pero avance automatico de ganador no esta implementado).
- Dashboard unificado dentro del shell de operator: `/operator` y `/standings` ya comparten layout visual.

## Decision tomada

- El siguiente trabajo de producto debe ser implementar el flujo BO3 real para Kill Race: crear matches de bracket, registrar kills por mapa, avanzar ganador.
- El topbar del shell debe seguir siendo contextual por vista (ya parcialmente implementado).
- Prioridad: flujo operativo real sobre pulido visual.

## Foco del sprint vigente (P0.1 completado)

- Ruleta base MVP completo (cargar participantes -> preview UI -> confirmar -> persistir equipos).
- Kill Race Bracket MVP parcial (seed listo, bracket visual, falta BO3 operativo).

## Lo que no entra en este sprint

- `Clerk` o cualquier autenticacion.
- Match Point.
- Monetizacion, creditos, RESPIN o planes.
- Bot de Discord.
- Agentes de automatizacion para stats prints, overlays o salidas automaticas.
- Import .docx.

## Rebirth

- La hipotesis vigente es que Rebirth usa el mismo scoring multiplicativo ya cubierto por `WSOW_PLACEMENT_BANDS`.
- Antes de cerrar esa parte, hay que verificar si existe alguna variante real por tamano de lobby o reglas de evento.
- Mientras eso no cambie el calculo, BR vs Rebirth debe resolverse como diferencia de modo o metadata, no como motor nuevo de scoring.

## Clerk y backlog de producto

- `Clerk` si esta en backlog cercano, pero deliberadamente fuera del sprint actual.
- El backlog grande de producto, monetizacion y automatizacion ya fue congelado en `docs/PARKING_LOT.md`.
- Si surge una idea nueva, documentarla primero y no mezclarla con el trabajo del sprint.

## Como retomar rapido en otra maquina

1. Leer `AGENTS.md`.
2. Leer `docs/CODEX_CONTEXT.md`.
3. Leer `docs/NEXT_STEPS.md`.
4. Leer `docs/PARKING_LOT.md`.
5. Revisar el layout y routing actuales del frontend antes de cambiar codigo.

## Siguiente paso recomendado

- Implementar backend para matches de bracket Kill Race (crear matches con team_a_id / team_b_id, guardar resultados por mapa).
- Implementar Operator Kill Race BO3: seleccionar match, inputs de kills A/B, guardar mapa, estado de serie 0-0/1-0/etc.
- Avance automatico de ganador single-elim (minimo viable: mostrar proximo match, sin automatizar completamente).
- Validar flujo completo manualmente con un torneo real de 4-8 equipos.
