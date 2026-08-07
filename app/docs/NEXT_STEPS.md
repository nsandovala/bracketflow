# NEXT STEPS

## Estado actual

- Rama: `feat/kill-race-scorebug-obs-final-v1`.
- Base: `83e2cb3` — `docs(agents): close P5 and hand off P6`.
- P6 — Kill Race Scorebug + Composición OBS Final v1: **CERRADO CON DEUDA VISUAL ACEPTADA**.
- Estado visual: smoke humano completado; bracket funcional sin overflow ni errores de datos. El grid compacto de Caster Hub queda funcionalmente aprobado.
- No se hizo commit, push, cambio de dependencias, migración ni regeneración de `backend/bracketflow.db`.
- `.claude/` no fue inspeccionado ni modificado.

## Arquitectura final P6

Flujo LIVE:

```text
BroadcastChannel(main)
→ active_tournament_id + broadcast_match_id
→ prioridad matchId explícito > tournamentId explícito > channel=main
→ useStreamLeaderboard (poll secuencial 1800 ms)
→ validación torneo/match y política 404 vs transitorio
→ WorldSeriesStreamView
→ Scorebug / Intermission / Bracket / MVP / Champion
```

Caster Hub consulta `main` en paralelo con su torneo seleccionado y mantiene dos grupos editoriales separados:

- `CANAL MAIN · EN VIVO`: URLs estables que no cambian con el selector.
- `PREVIEW · TORNEO SELECCIONADO`: URLs con `tournamentId`, aisladas de Operator.
- Scorebug y MVP conservan launchers fijos con `tournamentId + matchId`, nunca con `channel`.

Bracketflow entrega Browser Sources editoriales. No captura Twitch, no embebe gameplays y no compone el 2×2; esa composición pertenece a OBS o al multiview externo.

### Microcierre visual

- Bracket Broadcast denso usa `requiredHeight = chrome vertical + (cantidad × 122 px) + ((cantidad - 1) × 10 px)` y limita la escala por ancho/alto disponible sin bajar de `0.72`.
- En la ronda de seis series, cada wrapper descuenta el título y los cinco gaps antes de repartir altura; la card se centra en el wrapper, por lo que el conector conserva el centro real del match.
- Sólo `fallback` compacta padding y alturas internas; `showcase`/`standard` mantienen las métricas anteriores para 4, 6 y 8 equipos.
- Caster Hub agrupa LIVE y Preview en grids independientes: Scorebug/Intermission, Bracket/MVP y Champion a ancho completo. Un container query a 680 px los convierte en una columna sin afectar Notas de narración.
- URLs, copia de URL completa, `channel=main`, `tournamentId`, `matchId`, selección y botones mantienen sus contratos P6.
- El smoke humano confirmó el funcionamiento del bracket denso. Su refinamiento visual de separación, jerarquía, bordes/acentos y lectura de equipos queda diferido al futuro refactor visual de Bracket/Web/Broadcast y no reabre P6.

## Política al eliminar un torneo

`crud.delete_tournament` identifica canales cuyo torneo activo o match pertenece al torneo eliminado. En una sola transacción:

1. limpia `active_tournament_id` y `broadcast_match_id` del canal asociado;
2. limpia `engine` sólo cuando corresponde al torneo activo eliminado;
3. preserva `engine`/torneo de canales que sólo requieren limpiar un match inconsistente;
4. actualiza `updated_at` en cada canal afectado;
5. elimina el torneo;
6. ejecuta un único `commit`; ante excepción hace `rollback`.

No se depende de `ON DELETE SET NULL`, no se habilita `PRAGMA foreign_keys` global, no cambia el schema y no se borra la base local.

## Política 404 vs reconexión

- HTTP 404 o match ausente/ajeno al torneo: limpia torneo, equipos, matches, resultados, standings y firma previa; muestra `TORNEO NO DISPONIBLE` o `NO HAY MATCH AL AIRE`; nunca busca otra serie.
- Error transitorio/red/backend temporal: conserva el último snapshot válido, baja `connected`, muestra `RECONECTANDO` y reintenta automáticamente sin F5.
- La firma se resetea tras 404 para que la misma referencia pueda repintarse si vuelve a ser válida.
- URLs explícitas no consultan `channel=main`; una histórica nunca hereda el torneo/match LIVE.

## Matriz final de estados Scorebug

| Evidencia | Estado visible | Verdad competitiva |
|---|---|---|
| `pending` o serie lista sin mapa | `POR COMENZAR` | score confirmado actual |
| match realmente `in_progress` | `LIVE` | score confirmado actual |
| mapa `provisional` visible | `PROVISIONAL` | no modifica el score oficial |
| resultado visible `confirmed` | `FINAL` | score oficial confirmado |
| canal sin serie | `SIN SERIE AL AIRE` / `NO HAY MATCH AL AIRE` | sin fallback |
| error temporal | `RECONECTANDO` | último snapshot conocido |
| torneo/referencia 404 | `TORNEO NO DISPONIBLE` | snapshot limpio |

Estados desconocidos caen a `POR COMENZAR`, nunca a LIVE. `maps_won_a/maps_won_b` y `winner_id` siguen siendo la verdad oficial. `player_stats` ausentes no crean jugadores ni ceros individuales. La UI usa `BAJAS`, no “eliminaciones”.

## Matriz final de URLs

| Layout | LIVE estable | Preview/histórico |
|---|---|---|
| Scorebug | `/stream?channel=main&layout=scorebug&obs=1&bg=transparent` | `/stream?tournamentId=ID&layout=scorebug&obs=1` |
| Intermission | `/stream?channel=main&layout=intermission&obs=1` | `/stream?tournamentId=ID&layout=intermission&obs=1` |
| Bracket | `/stream?channel=main&layout=bracket&obs=1&bg=transparent` | `/stream?tournamentId=ID&layout=bracket&obs=1` |
| MVP | `/stream?channel=main&layout=mvp&obs=1&bg=transparent` | `/stream?tournamentId=ID&layout=mvp&obs=1` |
| Champion | `/stream?channel=main&layout=champion&obs=1&bg=transparent` | `/stream?tournamentId=ID&layout=champion&obs=1` |

Fijas por match:

- Scorebug: `/stream?tournamentId=ID&matchId=MATCH_ID&layout=scorebug&obs=1&bg=transparent`.
- MVP: `/stream?tournamentId=ID&matchId=MATCH_ID&layout=mvp&obs=1`.

## Scorebug y Caster Hub

- CSS: una sola definición base efectiva de `.kr-scorebug`; media query sólo ajusta ancho/columnas.
- Canvas compacto: máximo 1060 px de ancho y 132 px de alto, `box-sizing: border-box`, overflow cerrado y transparencia real.
- Nombres de equipo, nicknames y labels tienen `min-width: 0`, ellipsis y nowrap.
- El roster se limita a dos jugadores por lado; stats ausentes muestran roster con `—`.
- `visualKey` incluye torneo, match, estado, score de serie, mapa, estado de resultado, kills de equipo y kills individuales.
- Caster muestra alertas no bloqueantes para canal sin torneo, referencia eliminada, torneo sin match, selector distinto de LIVE, serie operativa distinta, match inválido/finalizado y falta de `player_stats`.

## Archivos P6

Nuevos:

- `docs/KILL_RACE_OBS_GUIDE.md`.

Modificados:

- `backend/app/crud.py`.
- `backend/tests/test_kill_race_results.py`.
- `frontend/app/components/CasterHub.tsx`.
- `frontend/app/components/KillRaceBracketBroadcast.tsx`.
- `frontend/app/components/KillRaceScorebug.tsx`.
- `frontend/app/components/WorldSeriesStreamView.tsx`.
- `frontend/app/globals.css`.
- `frontend/app/lib/useStreamLeaderboard.ts`.
- `frontend/lib/broadcastChannel.mjs` y `broadcastChannel.d.mts`.
- `frontend/lib/killRaceBroadcast.mjs` y `killRaceBroadcast.d.mts`.
- `frontend/lib/killRaceBracketBroadcast.mjs` y `killRaceBracketBroadcast.d.mts`.
- `frontend/tests/killRaceBroadcast.test.mjs`.
- `docs/CODEX_CONTEXT.md`.
- `docs/NEXT_STEPS.md`.

## Tests y QA real

Baseline sobre `83e2cb3`:

- árbol limpio y `git diff --check` OK;
- frontend lint OK;
- frontend 217/217;
- build productivo OK;
- backend 135/135.

QA P6 final antes de actualizar esta documentación:

- `git diff --check`: OK;
- frontend lint: OK;
- frontend tests: **230/230**;
- frontend build productivo/TypeScript: OK;
- backend tests: **138/138**;
- cuatro `SAWarning` SQLAlchemy preexistentes en `backend/app/crud.py:2203` (desplazado desde 2176 por el código agregado).

Cobertura nueva: tres tests backend para limpieza selectiva/un solo commit, eliminación sin canal y rollback transaccional; ocho tests frontend para estados exhaustivos, 404, error transitorio, prioridad explícita, match incompatible, URLs LIVE/Preview/fijas, CSS base, textos largos, `visualKey` y stats ausentes. Las regresiones previas ya cubren cambio de `broadcastMatchId` sin F5, provisional/confirmed, channel vacío y selector sin alterar LIVE.

Regresión añadida en el microcierre: fixture de 12 equipos con 11 series y rondas 6/3/1/1; altura requerida con gap mínimo; no-overflow y escala legible en 1920×1080/1366×768; invariantes de 4, 6 y 8 equipos; estabilidad de datos/`visualKey`; y estructura responsive, ellipsis, `min-width: 0` y acciones inferiores del Caster Hub.

## Smoke visual realizado

- Bracket Broadcast revisado por humano: funcionamiento correcto, sin overflow y sin errores de datos.
- Grid compacto de Caster Hub: funcionalmente aprobado.
- Deuda visual aceptada: en brackets grandes, la composición densa todavía requiere refinamiento de separación, jerarquía, bordes/acentos y lectura de equipos.
- Esta deuda se difiere al futuro refactor visual de Bracket/Web/Broadcast. **No reabrir P6 por este punto.**

## Warnings, deuda y siguiente sprint

- La ruta solicitada `docs/p6-scorebug-obs-audit.md` no existe en `HEAD`, historial local ni rama local de auditoría; el contrato P6 se tomó íntegramente de la solicitud y no se alteró ninguna evidencia de auditoría.
- Persisten cuatro `SAWarning` SQLAlchemy preexistentes, fuera del alcance P6.
- El estado “serie seleccionada en Operator” no tiene un campo remoto separado: Caster compara su serie operativa visible con `broadcastMatchId`; no se inventó persistencia nueva.
- La deuda visual aceptada del bracket denso queda registrada para el futuro refactor visual de Bracket/Web/Broadcast; no es un pendiente de P6.
- BracketView web, Fit/Reset, Operator/Standings, double elimination, OCR, Twitch/multistream, scoring, identidades y refactor visual global permanecen fuera de alcance.
- P6 está cerrado. Cualquier refinamiento del bracket denso debe planificarse dentro del refactor visual futuro, sin reabrir este sprint.
