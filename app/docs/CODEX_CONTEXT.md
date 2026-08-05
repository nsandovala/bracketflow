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
- Scorebug, Bracket Stream e Intermission son superficies distintas.
- Kill Race usa `KillRaceBracketBroadcast` como escena editorial independiente; `BracketView` permanece como componente web de Operator/Standings/Setup.
- La serie `EN TRANSMISIÓN` es exclusivamente el `resolvedMatchId` de URL explícita o canal; `in_progress` sin selección editorial se presenta como `EN JUEGO`.
- El bracket broadcast usa `toBracketRounds` como fuente de rounds, feeders, BYE, placeholders, ganadores y avance; `winner_id` y el score oficial son la única verdad competitiva.
- Intermission no es multistream ni composición de gameplay.
- No duplicar helpers de `killRaceCasterState`, `killRaceIntermission` o `killRaceStandings`.

## Cómo retomar

1. Leer `AGENTS.md`.
2. Leer `docs/NEXT_STEPS.md` como estado operativo canónico.
3. Consultar `docs/PARKING_LOT.md` solo para backlog diferido.
4. Ejecutar `git status -sb`, `git diff --check` y `.\scripts\qa.ps1` antes de editar.

## Próximo foco aprobado

P4 — Kill Race Bracket Broadcast v1 queda implementado en `feat/kill-race-bracket-broadcast-v1`, sin commit/push y pendiente de revisión visual humana porque el runtime no expuso navegador. El siguiente sprint previsto es P5 — MVP + Champion overlays; no abrirlo dentro de P4.
