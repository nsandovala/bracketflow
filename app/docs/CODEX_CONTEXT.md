# Codex Context

> Contexto transversal para agentes. El estado operativo detallado y el handoff viven en `docs/NEXT_STEPS.md`.
> Actualizado: 2026-08-06.

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
- Eliminar un torneo limpia explícitamente, en la misma transacción y antes del único commit, todos los canales que lo referencian; limpia torneo/match, `engine` asociado y actualiza `updated_at`. No depende de `ON DELETE SET NULL` ni de PRAGMA global.
- `channel=main` es exclusivamente contexto LIVE: sigue el torneo/match que Operator envía al aire y sus URLs permanecen estables para OBS.
- `tournamentId` explícito es contexto fijo de Preview/histórico: tiene prioridad sobre el canal y nunca reutiliza `broadcastMatchId` de `main`.
- La prioridad es estricta: `matchId` explícito > `tournamentId` explícito > `channel=main`; una referencia fija inválida queda vacía y nunca cae a otra serie.
- Stream separa 404/referencia inválida de error transitorio: 404 limpia el snapshot y muestra `TORNEO NO DISPONIBLE`/`NO HAY MATCH AL AIRE`; caída temporal conserva el último snapshot, muestra `RECONECTANDO` y reintenta cada 1800 ms.
- Scorebug mapea explícitamente `POR COMENZAR`, `LIVE`, `PROVISIONAL`, `FINAL` y `RECONECTANDO`. Sólo `in_progress` produce LIVE; provisional no altera el score oficial; stats individuales ausentes quedan como `—`.
- Caster Hub agrupa las cinco superficies Kill Race en `CANAL MAIN · EN VIVO` y `PREVIEW · TORNEO SELECCIONADO`; Scorebug/MVP conservan además URLs fijas por match.
- La guía operativa canónica para OBS es `docs/KILL_RACE_OBS_GUIDE.md`.
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
- P5 quedó cerrado en la base `83e2cb3` (`docs(agents): close P5 and hand off P6`).
- P6 — Kill Race Scorebug + Composición OBS Final v1 está **CERRADO CON DEUDA VISUAL ACEPTADA** en `feat/kill-race-scorebug-obs-final-v1`, sin commit/push.
- Microcierre P6: Bracket Broadcast calcula el modo denso con altura real de card (122 px), gap vertical mínimo (10 px), chrome disponible y escala global; el caso de 12 equipos/11 series conserva estructura 6/3/1/1, conectores centrados y no solicita overflow a 1920×1080 ni 1366×768. Los contratos de 4, 6 y 8 equipos no cambian.
- Caster Hub presenta los cinco launchers LIVE y Preview en grid interno de dos columnas; Champion ocupa ambas y el contenedor colapsa a una columna a 680 px, sin cambiar URLs ni selección. El grid compacto quedó funcionalmente aprobado por smoke humano.
- QA P6 final: lint OK, frontend 230/230, build productivo OK y backend 138/138; persisten cuatro `SAWarning` SQLAlchemy preexistentes.
- Smoke humano final realizado: Bracket Broadcast funciona sin overflow ni errores de datos. En brackets grandes, la densidad de cards todavía requiere mejor separación, jerarquía, bordes/acentos y lectura de equipos; esta deuda visual está explícitamente aceptada y diferida al futuro refactor visual de Bracket/Web/Broadcast.
- No reabrir P6 por la deuda visual del bracket denso. El próximo trabajo debe tratarla únicamente dentro del refactor visual futuro correspondiente.
- Continúan pendientes el bracket web, Fit/Reset y el refactor global de UI de Operator/Standings; no mezclarlos con P6.
