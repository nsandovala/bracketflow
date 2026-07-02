# Diagnóstico E1 — Navegación

## E1.a — Botón "Volver atrás" ausente en Operator para BR (wsow_br)

**Causa raíz:** NO es una regresión. El context bar con botón `← Volver al bracket` fue introducido en commit `f2bfe61` (UX-P0 Rescue Partes 1-4) y **solo se agregó dentro del branch `isKillRace`** de `WorldSeriesOperator.tsx:294`.

Los motores `wsow_br`, `rebirth_ws` y `roulette_ws` caen en el `else` (línea 614+) que **nunca tuvo context bar**.

**Evidencia:**
- `WorldSeriesOperator.tsx:294` — `) : isKillRace ? (` — el context bar se renderiza SOLO cuando `isKillRace` es true.
- `WorldSeriesOperator.tsx:614` — `) : (` — branch para WSOW/Rebirth/Roulette, sin context bar.
- `git log -p -S "opr-context-bar"` — commit `f2bfe61`, diff muestra el bloque agregado exclusivamente dentro del condicional Kill Race.

**Archivo involucrado:** `frontend/app/components/WorldSeriesOperator.tsx`

---

## E1.b — Nav rota en Ruleta Gedeón (roulette_ws)

**Causa raíz:** Mismo problema estructural que E1.a. El context bar solo existe para Kill Race. En `/operator` con un torneo `roulette_ws`:

1. No hay botón contextual para ir a Standings.
2. No hay botón "volver atrás".
3. La única navegación es el sidebar global (no contextual al torneo).

Además, la página `/standings` (`WorldSeriesStandings.tsx`) **tampoco tiene botón de regreso** a Operator u otra vista.

**Rutas verificadas en el router:**
- `/dashboard` — `app/(operator)/dashboard/page.tsx`
- `/torneos` — `app/(operator)/torneos/page.tsx`
- `/operator` — `app/(operator)/operator/page.tsx`
- `/standings` — `app/(operator)/standings/page.tsx`
- `/equipos` — `app/(operator)/equipos/page.tsx`
- `/ajustes` — `app/(operator)/ajustes/page.tsx`
- `/stream` — `app/stream/page.tsx` (fuera del shell operator)

**Archivos involucrados:**
- `frontend/app/components/WorldSeriesOperator.tsx` — falta context bar para no-KillRace
- `frontend/app/components/WorldSeriesStandings.tsx` — no tiene botón de regreso

---

## Conclusión

Ambos bugs comparten la misma causa: el **context bar fue diseñado exclusivamente para Kill Race** y nunca se extendió a los otros 3 motores. La solución es extender el patrón del context bar a TODOS los motores, con copy adaptado según el engine.
