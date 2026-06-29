# NEXT STEPS

## HECHO

- Reglas canonicas de 4 motores congeladas (`TOURNAMENT_RULES.md`).
- Matriz `TOURNAMENT_ENGINES` central creada/extendida.
- Form de creacion selecciona motor competitivo y adapta campos.
- Rebirth WS: 1°x1.6 / 2-5°x1.4 / 6-10°x1.2 / 11-16/17°x1.0.
- Match Point configurable (125/150/custom) en `wsow_br`, `rebirth_ws`, `roulette_ws`.
- Lobby BR corregido a 50. Tie-breakers documentados.
- Gedeon Roulette = ruleta + standing WSOW. Kill Race = ruleta + bracket BO3.
- Archivar por defecto + eliminar con confirmacion.
- NO se migro a Neon.

## ESTADO

- Build: VERDE (`PATH=/Users/mac/.nvm/versions/node/v22.22.2/bin:$PATH npm run build`).
- Lint: VERDE (`PATH=/Users/mac/.nvm/versions/node/v22.22.2/bin:$PATH npm run lint`).
- Backend tests: VERDE (`./.venv/bin/python -m pytest` -> 25 passed).
- DB config para engine: SI (`Tournament.config` TEXT JSON existente).
- Delete/archive: SI (`status=archived` y hard delete con cascadas ORM).
- `/stream?obs=1`: SI (`curl -I 'http://localhost:3000/stream?obs=1'` -> 200).
- Manual DB smoke de crear uno de cada motor: no ejecutado para no introducir torneos smoke/seed.

## SIGUIENTE (orden: huesos antes que piel)

- Sprint 1: Ruleta base (cargar participantes -> generar equipos).
- Sprint 2: Kill Race Bracket MVP (generar llave -> BO3 -> avanzar ganador).
- Sprint 3: Roulette WS completo (ruleta + standings WSOW + match point coronacion).
- Sprint futuro: Hub Arena OS (efectos), Neon/Auth, Discord, agentes/screenshots.

## BLOQUEOS

- Bracket real pendiente.
- Ruleta real pendiente como flujo completo de participantes.
- Coronacion Match Point pendiente.
- Auth diferido.
