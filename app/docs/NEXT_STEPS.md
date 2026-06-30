# NEXT STEPS

## ULTIMO SPRINT EJECUTADO — Ruleta / Kill Race P0.1

**Fecha:** 2026-06-30

**Que se corrigio:**
- Parser de participantes robusto: separa por newline, coma, punto y coma, tab, o multiples espacios.
- Validacion anti-comas en frontend y backend: rechaza nicknames que contengan comas/punto y coma/tabs internos (evita el bug de "manteca, demain, carlos, lalo, clara" como un solo jugador).
- UI copy anti-duplicidad aplicada en `RouletteArena`, `BracketView`, `WorldSeriesStandings`, `WorldSeriesOperator`.
- Estados claros de ruleta: `Carga participantes` -> `Pool listo` -> `Equipos generados` -> `Equipos confirmados`.
- Contador de equipos estimados y banca visible en tiempo real.
- Microcopy: "Tambien puedes copiar y pegar desde Word, Excel, Discord o Google Sheets."
- BracketView: quitados mensajes de "llegan en el siguiente sprint", ahora muestra bracket real con BYE explicito.
- Kill Race Operator: titulo contextual, descripcion de BO3 por kills, sin placement.
- Stream: bifurcacion por `engine_key` ya existia (`BracketStreamView` para Kill Race), verificado que funciona.
- Backend `schemas.py`: validacion de nickname con `field_validator`.

**Archivos tocados:**
- `frontend/app/components/RouletteArena.tsx`
- `frontend/app/components/BracketView.tsx`
- `frontend/app/components/WorldSeriesStandings.tsx`
- `frontend/app/components/WorldSeriesOperator.tsx`
- `frontend/app/components/WorldSeriesStreamView.tsx` (verificado, sin cambios)
- `backend/app/schemas.py`

**Que quedo funcionando:**
- Carga de participantes desde textarea y archivo .txt/.csv.
- Rechazo de nombres malformados con comas internas.
- Generacion de ruleta respetando team_size (2v2, 3v3).
- Banca automatica para jugadores sobrantes.
- Bracket visual con nombres reales y BYE.
- Stream muestra bracket para Kill Race, standings para WSOW.

**Que quedo pendiente:**
- Creacion de partidas BO3 para Kill Race (backend endpoint para matches bracket).
- Avance automatico de ganador en bracket (single elim progression).
- Operator BO3 por kills con inputs de kills A/B y guardar mapa.
- Desempate manual explicito en UI cuando hay empate de kills.
- Import .docx (roadmap futuro).

**Como probarlo:**
1. Backend: `uvicorn app.main:app --reload`
2. Frontend: `npm run dev`
3. Crear torneo Kill Race 2v2.
4. Setup de ruleta: pegar 4 nombres (incluir uno con comas para ver rechazo).
5. Girar ruleta -> confirmar equipos.
6. Operator -> Bracket: ver llave con nombres reales.
7. Stream `?tournamentId=ID&obs=1`: ver bracket para Kill Race.

**Comandos ejecutados:**
- Backend: `python -m compileall app` -> sin errores.
- Frontend: `npm run lint` -> 0 errores, 9 warnings preexistentes.
- Frontend: `npm run build` -> exitoso.
- QA manual backend: script `qa_killrace.py` verifica 422 para comas, 2 equipos de 2, 1 banca con 5 jugadores.

---

## HECHO

- Reglas canonicas de 4 motores congeladas (`TOURNAMENT_RULES.md`).
- Contrato BracketFlow/Gedeon actualizado: BR opera con 4 jugadores por equipo; Rebirth opera con 3.
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
- Backend tests: VERDE (`./.venv/bin/python -m pytest` -> 35 passed).
- DB config para engine: SI (`Tournament.config` TEXT JSON existente).
- Delete/archive: SI (`status=archived` y hard delete con cascadas ORM).
- `/stream?obs=1`: SI (`curl -I 'http://localhost:3000/stream?obs=1'` -> 200).
- Smoke API/UI: Gedeon BR 4v4, Gedeon Rebirth 3v3+banca, Kill Race 2v2 seed y rutas operator/equipos/standings verificados.

## SIGUIENTE (orden: huesos antes que piel)

- Sprint 1: Ruleta base MVP completo (cargar participantes -> preview UI -> confirmar -> persistir equipos).
- Sprint 2: Kill Race Bracket MVP (generar llave -> BO3 -> avanzar ganador).
- Sprint 3: Roulette WS completo (ruleta + standings WSOW + match point coronacion).
- Sprint futuro: Hub Arena OS (efectos), Neon/Auth, Discord, agentes/screenshots.

## BLOQUEOS

- Bracket real pendiente.
- Preview backend separado pendiente: hoy el preview se calcula en UI y el endpoint persiste al confirmar.
- Coronacion Match Point pendiente.
- Auth diferido.
