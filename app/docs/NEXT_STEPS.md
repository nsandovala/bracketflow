# NEXT STEPS

## Estado de Git

- Rama actual: `feat/kill-race-mvp-champion-overlays-v1`.
- Commit base: `291b45d` (`docs(agents): close P4 and hand off P5`).
- La rama parte del P4 aprobado (`7b6ef73` implementación, `291b45d` handoff/documentación); P4 fue publicado y su smoke visual humano fue aprobado.
- El working tree estaba limpio al iniciar P5 y ahora contiene P5 — Kill Race MVP + Champion Overlays v1 sin commit/push.
- `.claude/` figura de forma intermitente como untracked del entorno; no se inspeccionó ni modificó y permanece fuera del sprint y de cualquier staging.
- Commit, push y PR P5: no realizados por instrucción del sprint.
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
- `7b6ef73`
- `291b45d`

## Sprints Kill Race completados

1. Kill Race player results intake y scorebug foundation.
2. Operator cockpit y broadcast overlays.
3. Broadcast bridge y Caster analytics.
4. Stable Broadcast Channel y alertas de transmisión.
5. Kill Race Intermission Overlay v1.
6. P3 — Kill Race Standings Detailed Web v1.
7. P4 — Kill Race Bracket Broadcast v1 (implementación `7b6ef73`, handoff `291b45d`, push y smoke humano aprobados).
8. P5 — Kill Race MVP + Champion Overlays v1 (implementado en working tree; sin commit/push).

Los commits anteriores son una línea de continuidad conocida; este documento no afirma que ramas aún abiertas hayan sido mergeadas.
Se confirma que las ramas abiertas aun no han sido mergeadas.

## Sprint actual — P5 Kill Race MVP + Champion Overlays v1

### Arquitectura y contratos

- Helper puro compartido: `frontend/lib/killRaceAwards.mjs` y `killRaceAwards.d.mts`; no usa React, APIs, estado ni scoring.
- `buildKillRaceMvpOverlay` resuelve alcance de último mapa confirmado, serie completada o torneo oficialmente completado; este último no requiere `matchId`.
- `buildKillRaceChampionOverlay` solo corona desde el match final real, `status === completed`, `winner_id` oficial y ganador perteneciente al torneo.
- `buildKillRaceCasterState` comparte la definición estricta; un `winner_id` en una final no completada ya no aparece como campeón.
- `Tournament.config.championTeamId` no sustituye la final y no se usa para declarar el Champion Overlay.
- Solo mapas `confirmed` alimentan bajas individuales, kills del campeón, promedios y rankings. Provisional queda fuera de premios oficiales.
- No existen datos persistidos oficiales de daño, asistencias, K/D de partida, precisión o redeploys; `declared_kd` no participa.

### MVP

- Serie activa: último mapa `confirmed` de la serie transmitida y solo sus `player_stats`.
- Serie completada: suma de todos sus mapas confirmados, mapas con stat por jugador, promedio y score oficial.
- Torneo finalizado sin `matchId`: suma de todos los mapas confirmados del torneo y ranking MVP.
- Un `matchId` explícito conserva scope de mapa/serie incluso si el torneo ya terminó; un id inválido o perteneciente a otro torneo no selecciona otra serie.
- Los empates no se rompen: se conservan todos los líderes, con composición legible hasta cuatro jugadores.
- Con resultados de equipo pero sin `player_stats`, el estado es `SIN DESGLOSE INDIVIDUAL CONFIRMADO`; no existe Team MVP ni reparto inferido.
- En transparente, estados vacíos/pending no dibujan una tarjeta dominante sobre gameplay.

### Champion

- Presenta torneo, campeón, roster opcional, finalista, score oficial orientado al ganador, BO, series ganadas jugadas y kills confirmadas del campeón.
- Los BYE no cuentan como series ganadas jugadas.
- Las kills son contexto de rendimiento, nunca causa de coronación.
- Sin final válida, debug declara `CAMPEÓN AÚN NO DEFINIDO`; transparente permanece visualmente seguro.

### Routing, Caster y URLs

- Kill Race: `layout=mvp` → `KillRaceMvpOverlay`; `layout=champion` → `KillRaceChampionOverlay`.
- Otros motores conservan `StreamOverlayMvp`; Champion entrega un estado honesto no compatible.
- `getCompatibleOverlayLayouts` de Kill Race expone scorebug, intermission, bracket, mvp y champion.
- Caster Hub separa visual y semánticamente `CANAL MAIN · EN VIVO` de `PREVIEW · TORNEO SELECCIONADO`. Seleccionar un histórico cambia solo los previews; nunca las fuentes LIVE destinadas a OBS.
- `channel=main` representa exclusivamente transmisión real y sigue a Operator. `tournamentId` explícito representa Preview/histórico, tiene prioridad y no consume `broadcastMatchId` del canal.
- Los launchers MVP fijos por match conservan contexto explícito de torneo + serie; Champion no se duplica por match.
- URLs LIVE estables:
  - `/stream?channel=main&layout=mvp&obs=1&bg=transparent`
  - `/stream?channel=main&layout=champion&obs=1&bg=transparent`
- URLs Preview/histórico fijas:
  - `/stream?tournamentId=ID&layout=mvp&obs=1`
  - `/stream?tournamentId=ID&layout=champion&obs=1`
  - `/stream?tournamentId=ID&matchId=MATCH_ID&layout=mvp&obs=1`

### Polling y visualKey

- No se agregaron timers, hooks ni fetches. Se conserva el polling secuencial de Stream a 1800 ms, última data válida, canal `main` y prioridad de URL explícita.
- MVP reacciona a torneo, match, scope, mapa, estado, score y stats agregadas; Champion a final, status, winner, finalista, score, roster, kills y series.
- Payload equivalente conserva el mismo `visualKey`; los componentes no usan key de remount en la escena raíz.

### Archivos P5

Nuevos:

- `frontend/lib/killRaceAwards.mjs`
- `frontend/lib/killRaceAwards.d.mts`
- `frontend/app/components/KillRaceMvpOverlay.tsx`
- `frontend/app/components/KillRaceChampionOverlay.tsx`
- `frontend/tests/killRaceAwards.test.mjs`

Modificados:

- `frontend/app/components/CasterHub.tsx`
- `frontend/app/components/WorldSeriesStreamView.tsx`
- `frontend/app/stream/page.tsx`
- `frontend/lib/killRaceCasterState.mjs`
- `frontend/lib/streamRouting.mjs`
- `frontend/lib/streamRouting.d.mts`
- `frontend/lib/broadcastChannel.mjs`
- `frontend/lib/broadcastChannel.d.mts`
- `frontend/app/globals.css`
- `frontend/package.json`
- `frontend/tests/killRaceBroadcast.test.mjs`
- `docs/CODEX_CONTEXT.md`
- `docs/NEXT_STEPS.md`

### Datos QA read-only

- Base real: `backend/bracketflow.db`, abierta con SQLite `mode=ro`; no se modificó.
- Torneo 25 / matches 102–103: activo, dos series en progreso, player stats confirmadas; match 103 contiene empate real de tres jugadores y canal `main` apunta a 25/103.
- Torneo 24 / final 101: final completada, campeón/finalista/rosters y stats confirmadas.
- Torneo 20 / final 91: seis equipos con BYE, final completada y mezcla de mapas con y sin player stats.
- Torneos 6, 13 y 17: finales completadas y kills de equipo confirmadas sin desglose individual.
- No existen actualmente mapas provisionales ni empate real de cuatro jugadores; ambos casos se cubren con tests puros, sin fixtures persistentes.

### Smoke humano preparado · URLs locales exactas

Mantener Operator transmitiendo torneo 25 / Match 103 y usar:

- Caster Hub torneo 24: `http://localhost:3000/caster?tournamentId=24`
- MVP LIVE (debe seguir en torneo 25): `http://localhost:3000/stream?channel=main&layout=mvp&obs=1&bg=transparent`
- Champion LIVE (misma fuente estable): `http://localhost:3000/stream?channel=main&layout=champion&obs=1&bg=transparent`
- MVP Preview torneo 24: `http://localhost:3000/stream?tournamentId=24&layout=mvp&obs=1`
- Champion Preview torneo 24 / final 101: `http://localhost:3000/stream?tournamentId=24&layout=champion&obs=1`
- MVP fijo final 101: `http://localhost:3000/stream?tournamentId=24&matchId=101&layout=mvp&obs=1`
- Caster Hub torneo 20: `http://localhost:3000/caster?tournamentId=20`
- MVP Preview torneo 20: `http://localhost:3000/stream?tournamentId=20&layout=mvp&obs=1`
- Champion Preview torneo 20 / final 91: `http://localhost:3000/stream?tournamentId=20&layout=champion&obs=1`
- Sin player stats, estado honesto MVP: `http://localhost:3000/stream?tournamentId=6&layout=mvp&obs=1`, `http://localhost:3000/stream?tournamentId=13&layout=mvp&obs=1`, `http://localhost:3000/stream?tournamentId=17&layout=mvp&obs=1`

Validar 1920×1080 y 1366×768, oscuro y transparente, sin clipping/scroll; cambiar entre 24 y 20 debe cambiar ambos previews, mientras LIVE continúa en 25 sin F5. Después seleccionar un torneo WSOW desde Caster Hub y confirmar que MVP acumulativo sigue compatible y Champion Kill Race aparece como no compatible.

### Tests, QA y runtime reales

- QA inicial sobre `291b45d`: lint OK; frontend 162/162; build OK; backend 135/135.
- QA final P5: `git diff --check` OK; lint OK; frontend 217/217; build productivo OK; backend 135/135.
- La suite P5 contiene 55 tests; esta corrección agregó 13 regresiones focalizadas que cubren los 15 contratos LIVE/Preview, aislamiento por torneo, final/MVP histórico, selector, prioridad explícita, estados honestos, WSOW, polling y `visualKey`.
- Backend y frontend levantaron en 8000/3000. Health y las rutas MVP/Champion fija, transparente y canal `main` respondieron HTTP 200.
- Smoke visual real: **pendiente / no ejecutado**. Browser devolvió `No browser is available` y la lista de navegadores fue `[]`; HTTP 200 no es validación visual u OBS.
- Persisten cuatro `SAWarning` SQLAlchemy preexistentes en `backend/app/crud.py:2176`; backend no fue modificado.

### Deuda y siguiente sprint

- Ejecutar smoke humano P5 a 1920×1080 y 1366×768 con los torneos reales anteriores; el empate de cuatro requiere un caso ingresado por flujo real antes de validarlo visualmente.
- Validar sin F5 cambios de match/torneo por canal, transparencia, ausencia de scroll/clipping y no regresión en Scorebug, Intermission, Bracket Broadcast y MVP acumulativo.
- P6 — Scorebug y composición OBS final es el siguiente sprint.
- Continúan fuera de P5/P6 el refactor global UI, BracketView web, Operator, Standings y Fit/Reset.

---

## Sprint anterior — P4 Kill Race Bracket Broadcast v1

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

- El smoke visual humano de P4 fue completado y aprobado antes de abrir P5.
- Implementación P4: `7b6ef73`; documentación/handoff: `291b45d`; push completado.
- Bracket Broadcast está aprobado. El bracket web y Fit/Reset continúan pendientes y no se tocaron en P5.

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
- P4 — Bracket Broadcast v1: aprobado (`7b6ef73`, handoff `291b45d`, push y smoke humano completados).
- P5 — MVP + Champion overlays: diseños aprobados, histórico LIVE/Preview corregido e implementado en el working tree actual, sin commit/push; listo para cierre humano mediante el smoke preparado.
- P6 — Scorebug y composición OBS final: siguiente sprint.

## Deuda técnica conocida

- Cuatro `SAWarning` SQLAlchemy preexistentes.
- Double elimination todavía no implementado.
- Desempates operativos requieren hardening adicional si reaparecen casos no cubiertos.
- Daño, asistencias y K/D no forman parte del contrato persistido de `player_stats`.
- Smoke visual P5 y pruebas reales en OBS siguen pendientes.
- Falta un torneo real de 8 equipos en la base local para completar el smoke exigido sin fixtures persistentes.
- El contexto histórico de `docs/CODEX_CONTEXT.md` fue actualizado de forma mínima; `PARKING_LOT.md` conserva backlog no operativo.

## Handoff para el siguiente agente

### Próxima acción recomendada

1. Ejecutar el smoke humano P5 pendiente con los torneos 25, 24, 20 y 6/13/17 descritos arriba.
2. Revisar y cerrar P5 en `feat/kill-race-mvp-champion-overlays-v1`; actualmente no hay commit ni push P5.
3. Antes de editar ejecutar:
   - `git status -sb`
   - `git diff --check`
   - `git log --oneline --decorate -3`
   - `.\scripts\qa.ps1`
4. Leer primero `killRaceAwards.mjs`, ambos overlays P5, `WorldSeriesStreamView.tsx`, `streamRouting.mjs` y la sección P5.
5. No iniciar P6 hasta revisar MVP/Champion en 1920×1080 y 1366×768, oscuro/transparente y canal `main`.
6. No tocar backend, scoring, Operator, Bracket Broadcast, Scorebug, Intermission ni Stable Broadcast Channel salvo alcance explícito nuevo.
7. Mantener final `completed` + `winner_id` como verdad de campeón, mapas confirmed como verdad MVP y ausencia de fallback editorial.

Comandos de reentrada:

```powershell
git status -sb
git log --oneline --decorate -3
.\scripts\qa.ps1
```
