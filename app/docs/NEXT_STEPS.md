# NEXT STEPS

## Estado de Git

- Rama actual: `feat/kill-race-standings-detailed-v1`.
- Commit base: `2d96ba5` (`feat(broadcast): add kill race intermission overlay`).
- El working tree contiene la implementación P3 y esta actualización documental.
- Commit y push: todavía no realizados por instrucción del sprint.
- La rama parte de la línea de trabajo de Kill Race/Broadcast; no afirmar merges adicionales.

Linaje conocido de commits de los sprints recientes:

- `c1254d2`
- `60ff897`
- `1069940`
- `b758672`
- `90d5eef`
- `2d96ba5`

## Sprints Kill Race completados

1. Kill Race player results intake y scorebug foundation.
2. Operator cockpit y broadcast overlays.
3. Broadcast bridge y Caster analytics.
4. Stable Broadcast Channel y alertas de transmisión.
5. Kill Race Intermission Overlay v1.
6. P3 — Kill Race Standings Detailed Web v1.

Los commits anteriores son una línea de continuidad conocida; este documento no afirma que ramas aún abiertas hayan sido mergeadas.
Se confirma que las ramas abiertas aun no han sido mergeadas.

## Sprint actual — P3 Kill Race Standings Detailed Web v1

### Problema resuelto

`/standings` trataba Kill Race como cualquier vista bracket y terminaba renderizando prácticamente la misma información que `/stream?layout=bracket`. La rama Kill Race de `StandingsTable` tampoco recibía leaderboard porque su engine usa `primaryView: "bracket"`.

P3 separa tres verdades que no deben confundirse:

- rendimiento estadístico por kills confirmadas;
- avance competitivo por resultados de serie;
- campeón oficial definido por el match final.

### Arquitectura implementada

- Helper puro: `frontend/lib/killRaceStandings.mjs` y declaración `killRaceStandings.d.mts`.
- Componente web específico: `frontend/app/components/KillRaceStandingsDetailed.tsx`.
- Tests puros: `frontend/tests/killRaceStandings.test.mjs`.
- `WorldSeriesStandings` enruta:
  - Kill Race → `KillRaceStandingsDetailed`;
  - otros brackets → `BracketView` existente;
  - motores acumulativos → `StandingsTable` existente.
- El helper produce `summary`, `teamRanking`, `playerRanking`, `matchHistory`, `bracketSummary` y `visualKey`.
- `BracketView mode="standings"` permanece read-only dentro de la pestaña BRACKET.

### Navegación y estados

Pestañas implementadas:

1. RENDIMIENTO
2. JUGADORES
3. PARTIDAS
4. BRACKET

Estados competitivos implementados:

- POR DISPUTAR
- EN SEMIFINAL
- ESPERANDO RIVAL
- EN FINAL
- ELIMINADO EN SEMIFINAL
- SUBCAMPEÓN
- CAMPEÓN

No existe ni se inventa tercer/cuarto lugar.

### Confirmed versus provisional

- Solo mapas `confirmed` alimentan kills, mapas, promedios y player ranking.
- `winner_id` determina W–L de serie y avance competitivo.
- `map_winner_id` confirmado determina W–L de mapas.
- Un provisional aparece en PARTIDAS y en el detalle del equipo como `En revisión`.
- Un provisional no altera ranking, promedio, score oficial, series ni campeón.
- La ausencia de `player_stats` no reparte ni inventa kills individuales.
- Los empates MVP conservan el mismo ranking y a todos los líderes reales.

### Polling de Standings

`useWorldSeriesPractice(preferredTournamentId, { pollMs: 1800 })` habilita polling solo desde `/standings`.

- Usa `setTimeout` recursivo.
- Espera la respuesta anterior antes de programar la siguiente.
- Deduplica refreshes simultáneos del mismo torneo.
- Se limpia al desmontar y no consulta sin torneo seleccionado.
- Una firma estable de torneo, roster, matches, maps, kills y `player_stats` evita actualizar React con payload idéntico.
- No depende del canal `main` y no modifica polling de Stream/Caster/Broadcast.
- Operator conserva el comportamiento sin polling de datos porque la opción es `null` por defecto.

### QA real

- `git diff --check`: OK.
- Frontend lint: OK, sin warnings nuevos.
- Frontend tests: 144/144.
- Frontend production build: OK.
- Backend tests: 135/135.
- Warnings: cuatro `SAWarning` SQLAlchemy preexistentes en `backend/app/crud.py:2176`.
- Validación visual: pendiente si el entorno no ofrece navegador controlable; no afirmar smoke visual ni polling visual sin realizarlo.
- OBS: no forma parte de P3 y no fue validado.

## Decisiones de arquitectura vigentes

- Operator decide, ingresa y confirma resultados.
- Standings explica rendimiento estadístico y recorrido competitivo.
- Stream presenta overlays y bracket broadcast.
- Caster entrega contexto narrativo y launchers.
- El ranking por kills no equivale a posición oficial del torneo.
- Kills deciden mapas; mapas deciden series; series deciden avance; el bracket decide al campeón.
- Solo mapas confirmados alimentan analytics oficiales.
- Provisionales pueden mostrarse como `En revisión`, pero no alteran analytics ni campeón.
- Player stats ausentes no deben inventarse.
- Broadcast Channel `main` mantiene URLs OBS estables.
- Intermission es una escena independiente, sin multistream ni composición de gameplay.

## Roadmap aprobado

- P3 — Standings Detailed Web: **completado en working tree; falta commit/push**.
- P4 — Bracket Broadcast v1: siguiente sprint recomendado.
- P5 — MVP + Champion overlays.
- P6 — Scorebug y composición OBS final.

No abrir P4 dentro de la rama P3.

## Deuda técnica conocida

- Cuatro `SAWarning` SQLAlchemy preexistentes.
- Double elimination todavía no implementado.
- Desempates operativos requieren hardening adicional si reaparecen casos no cubiertos.
- Daño, asistencias y K/D no forman parte del contrato persistido de `player_stats`.
- El refinamiento visual web/broadcast del bracket corresponde a P4.
- Pruebas reales en OBS siguen pendientes donde no se hayan realizado.
- El contexto histórico de `docs/CODEX_CONTEXT.md` fue actualizado de forma mínima; `PARKING_LOT.md` conserva backlog no operativo.

## Handoff para el siguiente agente

### Próxima acción recomendada

1. Cerrar P3 en esta rama solo después de revisión humana; actualmente no hay commit ni push.
2. Para P4, abrir una rama nueva desde el futuro commit aprobado de P3, sugerida: `feat/kill-race-bracket-broadcast-v1`.
3. Antes de editar ejecutar:
   - `git status -sb`
   - `git diff --check`
   - `git log --oneline --decorate -3`
   - `.\scripts\qa.ps1`
4. Leer primero:
   - `frontend/app/components/BracketView.tsx`
   - `frontend/lib/toBracketRounds.ts`
   - `frontend/lib/bracketDisplay.ts`
   - `frontend/app/components/WorldSeriesStreamView.tsx`
   - `frontend/lib/streamRouting.mjs`
   - `frontend/lib/killRaceStandings.mjs`
5. Objetivo P4: mejorar la presentación broadcast de la llave sin mezclarla con el ranking estadístico web.
6. No tocar backend, scoring, Operator, Caster Hub, scorebug, Intermission ni Stable Broadcast Channel salvo alcance explícito nuevo.
7. Riesgos: mantener single elimination como única estructura real, no usar provisionales como resultados oficiales y preservar URLs estables.
8. Terminado mínimo: helper/routing testeados, bracket web sin regresión, stream build verde, QA completa y smoke visual real antes de afirmar validación.

Comandos de reentrada:

```powershell
git status -sb
git log --oneline --decorate -3
.\scripts\qa.ps1
```
