# NEXT STEPS

## HECHO

- Diagnostico P0 ejecutado:
  - `sqlite3 bracketflow.db ".tables"` -> `matches`, `players`, `team_members`, `team_results`, `teams`, `tournaments`.
  - `sqlite3 bracketflow.db ".schema tournaments"` confirmo `config TEXT NULL`.
  - `SELECT id, name, format, scoring_profile, config FROM tournaments ORDER BY id DESC;` mostraba torneos `Smoke...` antes de limpiar.
- ¿Hay torneos Smoke/seed en DB local? SI antes de P1, NO despues de P1.
- ¿Kill Race usa scoring_profile=kill_race? SI en los torneos Smoke Kill Race removidos; no queda torneo Kill Race local despues de limpiar.
- ¿WSOW-like usa scoring_profile=wsow_like? SI.
- Se limpiaron torneos Smoke/seed de DB local, borrando dependencias en orden: `team_results`, `team_members`, `matches`, `teams`, `players`, `tournaments`.
- Se audito creacion automatica de torneos Smoke. No hay flujo de app que cree Smoke al cargar `/torneos`, `/dashboard` u `/operator`; `seed` existe solo como parametro manual de ruleta reproducible.
- Operator ahora muestra Setup requerido cuando un torneo tiene 0 equipos.
- Kill Race ya no se presenta como World Series en Operator: muestra `Kill Race`, `Regla de avance: más kills`, `Sin placement` y `Bracket pendiente`.
- Standings ahora respeta scoring_profile:
  - `wsow_like`: tabla acumulativa.
  - `kill_race`: resumen por kills / bracket pendiente.
- Navegacion desde Torneos permite operar directo sin pasar por Dashboard: `Operar`, `Dashboard`, `Standings`, `Stream`.
- Se redujo duplicacion visual `Torneos / Torneos` en `/torneos`.
- Modelo motor -> vista principal documentado en `app/docs/TOURNAMENT_MODEL.md`.

## ESTADO

- Backend tests: VERDE (`./.venv/bin/python -m pytest` -> 17 passed).
- Frontend lint: VERDE (`PATH=/Users/mac/.nvm/versions/node/v22.22.2/bin:$PATH npm run lint`).
- Frontend build: VERDE (`PATH=/Users/mac/.nvm/versions/node/v22.22.2/bin:$PATH npm run build`).
- DB local limpia: SI.
- `/stream?obs=1` sin regresion: SI (`curl -I 'http://localhost:3000/stream?obs=1'` -> 200).
- Smoke HTTP probado: `/torneos`, `/operator?tournamentId=9`, `/standings?tournamentId=9`, `/stream?obs=1` -> 200.
- Smoke visual Kill Race no se ejecuto contra DB local porque despues de limpiar no queda un torneo Kill Race persistido y no se reintrodujo un seed temporal.

## SIGUIENTE

Sprint grande a decidir:

1. Kill Race Bracket MVP estilo Challonge.
2. Roulette WS real desde pool de jugadores.

Recomendacion:

- Si la comunidad esta usando Challonge, priorizar Kill Race Bracket MVP.
- Si el wedge principal es Gedeon/Roulette, priorizar Roulette WS.

## BLOQUEOS

- Bracket real pendiente.
- Ruleta real pendiente.
- Rebirth scoring oficial pendiente.
- Auth/Neon diferido.
- Chatbot/Discord/agentes/carga de screenshots diferidos.

## VERIFICAR

- `/torneos`: no hay Smoke; acciones directas.
- `/operator` con torneo sin equipos: muestra Setup requerido.
- `/operator` con Kill Race: no muestra placement.
- `/standings` con Kill Race: no muestra BEST PLACE ni WSOW falso.
- `/standings` con WSOW: tabla acumulativa sigue normal.
- `/stream?obs=1`: no se rompe.
