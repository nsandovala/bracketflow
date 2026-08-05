# NEXT STEPS

## Estado de Git

- Rama actual: `feat/kill-race-bracket-broadcast-v1`.
- Commit base: `61e8d24` (`docs(agents): close P3 and hand off P4`).
- La rama parte del cierre aprobado de P3 (`3d77aa7` implementación, `61e8d24` handoff).
- El working tree contiene P4 — Kill Race Bracket Broadcast v1 y esta actualización documental; estaba limpio al iniciar el sprint.
- Commit y push: todavía no realizados por instrucción del sprint.
- La rama parte de la línea de trabajo de Kill Race/Broadcast; no afirmar merges adicionales.

Linaje conocido de commits de los sprints recientes:

- `c1254d2`
- `60ff897`
- `1069940`
- `b758672`
- `90d5eef`
- `2d96ba5`
- `3d77aa7`
- `61e8d24`

## Sprints Kill Race completados

1. Kill Race player results intake y scorebug foundation.
2. Operator cockpit y broadcast overlays.
3. Broadcast bridge y Caster analytics.
4. Stable Broadcast Channel y alertas de transmisión.
5. Kill Race Intermission Overlay v1.
6. P3 — Kill Race Standings Detailed Web v1.
7. P4 — Kill Race Bracket Broadcast v1 (implementado en working tree; sin commit/push).

Los commits anteriores son una línea de continuidad conocida; este documento no afirma que ramas aún abiertas hayan sido mergeadas.
Se confirma que las ramas abiertas aun no han sido mergeadas.

## Sprint actual — P4 Kill Race Bracket Broadcast v1

### Diagnóstico y arquitectura

La escena anterior envolvía `BracketView` con `mode="stream"` y `density="compact"`. Reutilizaba la composición web, partía en escala 1, solo reducía por `scrollWidth/clientWidth` y no recibía `resolvedMatchId`; por eso una llave pequeña quedaba perdida y `in_progress` se confundía visualmente con transmisión editorial.

P4 adopta la decisión **WRAP** para `react-brackets`: conserva la librería, rounds, seeds y conectores, sin instalar dependencias ni reconstruir la resolución del bracket.

- `BracketView` permanece sin cambios para Operator, Standings y Setup.
- `KillRaceBracketBroadcast` es la escena Kill Race dedicada.
- `BracketStreamView` enruta Kill Race a la escena nueva y otros engines al comportamiento anterior.
- El helper puro `killRaceBracketBroadcast.mjs` enriquece la salida canónica de `toBracketRounds(matches, teams, teamSize)` con estado editorial, serie al aire, progreso, campeón, layout adaptable y `visualKey`.
- La escala pura diferencia `showcase` (4 equipos), `standard` (6/8) y fallback mayor a 8, con mínimo legible `0.72` y canvas sin scrollbars visibles.

### Serie al aire y resultados oficiales

- `isBroadcast` solo coincide con `resolvedMatchId` resuelto por prioridad: `matchId` explícito, luego Broadcast Channel.
- No hay fallback a serie provisional, primera viva ni próxima serie.
- Un match `in_progress` no seleccionado es `EN JUEGO`; solo el match resuelto es `EN TRANSMISIÓN`.
- Sin match transmitido, la llave se conserva y el footer declara `SIN SERIE AL AIRE`.
- `winner_id` confirmado determina ganador, avance y campeón; `maps_won_a/maps_won_b` determinan el score oficial.
- Mapas live/provisionales pueden aportar contexto visual de partida y kills, pero nunca mueven equipos ni declaran ganador/finalista/campeón.
- BYE se presenta como pase directo y no cuenta como serie jugada.

### Escena y estados

- Composición fija 1920×1080/1366×768 con header único, bracket protagonista, rounds centrados y footer contextual.
- Estados: sin torneo, torneo preparado sin llave, bracket preparado, activo, final preparada y torneo completado.
- Al completar la final, el bracket permanece visible y el campeón aparece en una banda compacta; no se implementó el Champion Overlay de P5.
- Estilos aislados bajo `.kr-bracket-broadcast-*`, `.kr-broadcast-round-*` y `.kr-broadcast-seed-*`; no se sobrescribieron `.bf-rb-*` ni superficies Operator/Standings.
- Transparencia real: la escena usa fondo transparente, sin partículas, cuando `bg=transparent`.

### Polling, firma y URLs

- Se conservan `1800 ms`, polling secuencial con `setTimeout`, última data válida, Broadcast Channel y prioridad explícita.
- La firma de Stream incluye torneo/resolved match, topología del match, equipos, ganador, score, feeders, mapas, estados, kills y player stats.
- `channel.updatedAt` dejó de forzar updates cuando el payload visible es equivalente; la escena no se remonta por polling idéntico.
- URLs conservadas:
  - `/stream?channel=main&layout=bracket&obs=1`
  - `/stream?channel=main&layout=bracket&obs=1&bg=transparent`
  - `/stream?tournamentId=ID&layout=bracket&obs=1`
  - `/stream?tournamentId=ID&matchId=MATCH_ID&layout=bracket&obs=1`

### Archivos P4

Nuevos:

- `frontend/app/components/KillRaceBracketBroadcast.tsx`
- `frontend/lib/killRaceBracketBroadcast.mjs`
- `frontend/lib/killRaceBracketBroadcast.d.mts`

Modificados:

- `frontend/app/components/BracketStreamView.tsx`
- `frontend/app/components/WorldSeriesStreamView.tsx`
- `frontend/app/lib/useStreamLeaderboard.ts`
- `frontend/lib/streamRouting.mjs`
- `frontend/lib/streamRouting.d.mts`
- `frontend/app/globals.css`
- `frontend/tests/killRaceBroadcast.test.mjs`
- `docs/CODEX_CONTEXT.md`
- `docs/NEXT_STEPS.md`

### Tests y QA real

- QA inicial: lint OK; frontend 144/144; build OK; backend 135/135.
- QA final: `git diff --check` sin errores (aviso CRLF→LF en `BracketStreamView.tsx`); lint OK; frontend 162/162; build productivo OK; backend 135/135.
- Se agregaron 18 tests P4 que cubren 4/6/8 equipos, BYE, broadcast vs live, match inválido sin fallback, provisional, `winner_id`, campeón, escala/overflow, `visualKey`, prioridad URL y routing de otros engines.
- Persisten 4 `SAWarning` SQLAlchemy preexistentes en `backend/app/crud.py:2176`; no se ocultaron ni se tocó backend.

### Smoke visual real

- **Pendiente / no ejecutado.** Los servidores frontend/backend respondieron localmente y se verificaron datos reales disponibles (torneo 25: 4 equipos activo con dos series en progreso y canal `main` en Match 103; torneo 24: 4 equipos completado; torneo 20: 6 equipos completado).
- El runtime de navegador controlado devolvió `No browser is available` y `agent.browsers.list()` devolvió `[]`, por lo que no fue posible inspeccionar 1920×1080 ni 1366×768.
- La base actual tampoco contiene un torneo real de 8 equipos; ese caso está cubierto automáticamente, pero no visualmente.
- No se afirma smoke visual, OBS, cambio sin F5, transparencia visual ni ausencia de regresión visual en Operator/Standings.

### Próxima revisión humana

1. Abrir las cuatro URLs estables en 1920×1080 y 1366×768.
2. Validar torneo 25 para dos series en juego y una sola transmitida, torneo 20 para BYE/6 equipos y torneo 24 para campeón compacto.
3. Preparar o ingresar mediante el flujo real un torneo de 8 equipos antes del smoke correspondiente; no usar datos demo persistentes.
4. Confirmar conectores, clipping, legibilidad, transparencia y cero scrollbars; cambiar torneo/match en canal `main` sin F5.
5. Revisar visualmente Operator y Standings; `BracketView.tsx` no fue modificado.

---

## Sprint anterior — P3 Kill Race Standings Detailed Web v1

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

- P3 — Standings Detailed Web: completado y presente en la base `61e8d24`.
- P4 — Bracket Broadcast v1: **implementado en working tree; falta revisión visual, commit/push**.
- P5 — MVP + Champion overlays: siguiente sprint, no iniciado.
- P6 — Scorebug y composición OBS final.

No abrir P4 dentro de la rama P3.

## Deuda técnica conocida

- Cuatro `SAWarning` SQLAlchemy preexistentes.
- Double elimination todavía no implementado.
- Desempates operativos requieren hardening adicional si reaparecen casos no cubiertos.
- Daño, asistencias y K/D no forman parte del contrato persistido de `player_stats`.
- Smoke visual P4 y pruebas reales en OBS siguen pendientes.
- Falta un torneo real de 8 equipos en la base local para completar el smoke exigido sin fixtures persistentes.
- El contexto histórico de `docs/CODEX_CONTEXT.md` fue actualizado de forma mínima; `PARKING_LOT.md` conserva backlog no operativo.

## Handoff para el siguiente agente

### Próxima acción recomendada

1. Ejecutar y documentar el smoke visual P4 pendiente antes de aprobar o cerrar la rama.
2. Cerrar P4 en `feat/kill-race-bracket-broadcast-v1` solo después de revisión humana; actualmente no hay commit ni push.
3. Antes de editar ejecutar:
   - `git status -sb`
   - `git diff --check`
   - `git log --oneline --decorate -3`
   - `.\scripts\qa.ps1`
4. Leer primero `KillRaceBracketBroadcast.tsx`, `killRaceBracketBroadcast.mjs`, `toBracketRounds.ts`, `WorldSeriesStreamView.tsx` y esta sección P4.
5. No iniciar P5 hasta aprobar composición, escalas y smoke visual de P4.
6. No tocar backend, scoring, Operator, Caster Hub, Scorebug, Intermission ni Stable Broadcast Channel salvo alcance explícito nuevo.
7. Mantener single elimination, `winner_id` oficial, ausencia de fallback editorial y URLs estables.

Comandos de reentrada:

```powershell
git status -sb
git log --oneline --decorate -3
.\scripts\qa.ps1
```
