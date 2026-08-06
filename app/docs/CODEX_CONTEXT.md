# Codex Context

> Contexto transversal para agentes. El estado operativo detallado y el handoff viven en `docs/NEXT_STEPS.md`.
> Actualizado: 2026-08-05.

## Separación vigente de superficies

- **Operator** decide, ingresa y confirma resultados reales.
- **Standings** explica rendimiento y recorrido competitivo; Kill Race dispone de una vista analítica detallada separada del bracket.
- **Stream** presenta overlays y bracket broadcast mediante rutas estables.
- **Caster** entrega contexto narrativo, analytics confirmadas y launchers.

No convertir Standings en una copia del bracket ni trasladar controles de Operator a superficies read-only.

## Reglas Kill Race vigentes

- El ranking de kills es `RANKING DE RENDIMIENTO`, no clasificación oficial.
- Solo mapas `confirmed` alimentan kills, promedios y rankings de jugadores.
- Los provisionales pueden aparecer como `En revisión`, pero no modifican score oficial, W–L, avance ni campeón.
- Kills determinan mapas; mapas determinan series; series determinan avance; el bracket determina campeón.
- `player_stats` ausentes no deben inventarse ni inferirse desde kills de equipo.
- Single elimination es la estructura implementada; double elimination sigue pendiente.

## Broadcast vigente

- Broadcast Channel `main` desacopla URLs OBS de IDs editoriales cambiantes.
- `channel=main` es exclusivamente contexto LIVE: sigue el torneo/match que Operator envía al aire y sus URLs permanecen estables para OBS.
- `tournamentId` explícito es contexto fijo de Preview/histórico: tiene prioridad sobre el canal y nunca reutiliza `broadcastMatchId` de `main`.
- Scorebug, Bracket Stream e Intermission son superficies distintas.
- Kill Race usa `KillRaceBracketBroadcast` como escena editorial independiente; `BracketView` permanece como componente web de Operator/Standings/Setup.
- La serie `EN TRANSMISIÓN` es exclusivamente el `resolvedMatchId` de URL explícita o canal; `in_progress` sin selección editorial se presenta como `EN JUEGO`.
- El bracket broadcast usa `toBracketRounds` como fuente de rounds, feeders, BYE, placeholders, ganadores y avance; `winner_id` y el score oficial son la única verdad competitiva.
- Intermission no es multistream ni composición de gameplay.
- `layout=mvp` usa `KillRaceMvpOverlay` solo para Kill Race; los motores acumulativos conservan `StreamOverlayMvp`.
- `layout=champion` usa `KillRaceChampionOverlay` y exige una final real `completed` con `winner_id`; `championTeamId` aislado no corona.
- `killRaceAwards.mjs` centraliza premios puros, identidad estable `teamId:playerId` con fallback por nickname, empates completos y `visualKey` estable.
- MVP consume exclusivamente `player_stats` de mapas `confirmed`: mapa activo, acumulado de serie completada o acumulado de torneo finalizado. Nunca existe fallback a Team MVP.
- MVP histórico de torneo completado no requiere `matchId`; una URL fija con `matchId` conserva scope de esa serie y rechaza matches ajenos al torneo.
- Daño, asistencias, precisión, redeploys y K/D de partida no están persistidos. `declared_kd` es perfil declarado, no rendimiento oficial.
- No duplicar helpers de `killRaceAwards`, `killRaceCasterState`, `killRaceIntermission` o `killRaceStandings`.

## Cómo retomar

1. Leer `AGENTS.md`.
2. Leer `docs/NEXT_STEPS.md` como estado operativo canónico.
3. Consultar `docs/PARKING_LOT.md` solo para backlog diferido.
4. Ejecutar `git status -sb`, `git diff --check` y `.\scripts\qa.ps1` antes de editar.

## Estado reciente y próximo foco

- P4 fue implementado en `7b6ef73`; el handoff documental es `291b45d`. La rama se publicó y el smoke visual humano aprobó Bracket Broadcast.
- P5 — Kill Race MVP + Champion Overlays v1 está implementado sin commit/push en `feat/kill-race-mvp-champion-overlays-v1`, basado en `291b45d`; los diseños MVP/Champion están aprobados y Caster Hub ya separa LIVE de Preview/histórico.
- El histórico P5 quedó corregido con aislamiento estricto por torneo y está listo para cierre humano.
- El smoke visual automatizado P5 sigue pendiente porque el runtime actual no expuso navegador; no confundir las comprobaciones HTTP 200 con QA visual.
- El próximo sprint previsto es P6 — Scorebug y composición OBS final.
- Continúan pendientes el bracket web, Fit/Reset y el refactor global de UI de Operator/Standings; no mezclarlos con P6.
