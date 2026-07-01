# NEXT STEPS

## ULTIMO SPRINT EJECUTADO - BRACKET-UI react-brackets

**Fecha:** 2026-06-30

**Que se hizo:**
- `frontend/app/components/BracketView.tsx` dejo de dibujar la llave con el grid manual y ahora usa `react-brackets@0.4.7`.
- Nuevo mapper puro `frontend/lib/toBracketRounds.ts` transforma `matches` + `teams` del backend al shape real de la libreria instalada.
- El seed custom ahora muestra nombre real del equipo si existe, roster debajo, score BO3 por lado, badge `Avanza` en el ganador, perdedor con menor opacidad y estado visible por match (`Pendiente`, `En vivo`, `Completado`, `Slot futuro`).
- Los slots futuros vacios muestran `Ganador M#` solo cuando el feeder match todavia no resolvio ganador.
- El scroll horizontal queda encapsulado dentro del bracket y no obliga a romper el shell completo.
- No se tocaron contratos API, scoring, persistencia de mapas, `winner_id` ni avance al siguiente match.

**Que NO se hizo:**
- No se toco `backend/`.
- No se toco scoring WSOW / Rebirth.
- No se toco persistencia BO3.
- No se ejecuto smoke manual con navegador/F5 en esta sesion.
- No se instalo `@g-loot/react-tournament-brackets`; una busqueda local en `package.json` y `package-lock.json` no encontro ese paquete en este workspace al 2026-06-30.

**QA ejecutado:**
- `cd backend && python -m pytest` -> `39 passed`
- `cd backend && python qa_killrace.py` -> FALLA
- `cd frontend && npm run lint` -> `0 errors, 8 warnings` preexistentes
- `cd frontend && npm run build` -> OK

**Error exacto de QA fallido:**
- `python qa_killrace.py` corto en `POST /tournaments/23/roster-respin/open -> 404`
- Mensaje: `ERROR: No se pudo abrir respin de roster`

**Resultado de smoke manual del sprint:**
- Pendiente en esta sesion. No hay validacion honesta de F5 / pantalla coherente sin ejecutar navegador real.

**Bugs / riesgos encontrados:**
- `react-brackets` esta instalado en el workspace raiz, no en `frontend/package.json`. El build actual resuelve bien, pero conviene normalizar esa dependencia en un sprint tecnico aparte si el repo se va a mantener asi.
- Git en esta maquina requiere `safe.directory` inline por ownership dubitativo del repo.
- `qa_killrace.py` no quedo verde, asi que no hay cierre funcional completo del flujo pedido.

**Que NO se debe tocar en el proximo sprint:**
- No tocar backend para forzar un renderer.
- No mezclar este trabajo con scoring WSOW / Rebirth.
- No reabrir `winner_id`, `next_match_id`, `/matches/{id}/maps` ni persistencia BO3 al hacer pulido visual.

**Proximo sprint sugerido:**
- Evaluar migracion a `@g-loot/react-tournament-brackets` solo despues de instalarlo realmente en el workspace y validar su API local.
- Ejecutar smoke manual completo con F5 sobre Import, BO3 avance, navegacion y stream antes de considerar cerrado este bloque visual.

## ULTIMO SPRINT EJECUTADO - Sprint B Respins / Import / Stream

**Fecha:** 2026-06-30

**Que se hizo:**
- Se agregaron locks persistidos en DB para roster y bracket: `roster_status`, `roster_respin_deadline_at`, `roster_locked_at`, `bracket_status`, `bracket_respin_deadline_at`, `bracket_locked_at`.
- Backend ahora abre/cierra ventanas de respin con endpoints dedicados y rechaza regeneraciones fuera de ventana o despues de `locked`.
- El timer del frontend refleja `*_deadline_at` desde DB; F5 no reinicia contadores.
- Import de participantes en frontend ahora acepta texto pegado, `.txt` y `.csv`, separa por newline/coma/punto y coma/tab, hace preview antes de guardar y deduplica.
- Operator Kill Race muestra controles de respin persistido para roster y bracket.
- `/stream` ya no cae en otro torneo por silencio: si viene `tournamentId` usa ese; si no, usa el torneo activo persistido en localStorage.
- `qa_killrace.py` fue actualizado para cubrir el flujo Sprint B de locks reales.

**Que NO se hizo:**
- No se implemento double elimination real.
- No se agrego premium visual ni rediseño de ruleta.
- No se tocaron placement, standings ni scoring de WSOW BR / Rebirth.
- No se agrego import `.docx` ni parsing OCR.

**Que queda para Sprint C / siguientes:**
- Flujo visual mas claro para desempate manual cuando un mapa BO3 empata en kills.
- QA manual con navegador para validar timer visible durante F5 y stream OBS 1920x1080 sin scroll.
- Ajustar warnings de lint preexistentes en `WorldSeriesOperator.tsx` y `tournamentMode.ts`.
- Decidir si `bracket_status=running` debe dispararse al primer mapa o por otro evento explicito de operador.

**Resultado del smoke Sprint B:**
1. `roster-respin/open` -> `generate-roulette-teams` -> `roster-respin/lock`.
2. Intento de regenerar roster con `roster_status=locked` -> rechazo `400`, DB sin cambios.
3. `bracket-respin/open` -> `generate-bracket` -> `bracket-respin/lock`.
4. Intento de regenerar bracket con `bracket_status=locked` -> rechazo `400`, DB sin cambios.
5. SQL real del torneo QA 22:
   - `roster_status='locked'`, `roster_respin_deadline_at=NULL`, `roster_locked_at` poblado.
   - `bracket_status='locked'`, `bracket_respin_deadline_at=NULL`, `bracket_locked_at` poblado.

**Comandos ejecutados:**
- `cd backend && python -m pytest`
- `cd backend && python qa_killrace.py`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`

## ULTIMO SPRINT EJECUTADO - Rescate P0 Kill Race BO3

**Fecha:** 2026-06-30

**Que se hizo:**
- Backend Kill Race con persistencia real de serie BO3 por mapa en `match_maps`.
- `matches` ahora guarda `best_of`, `next_match_id`, `next_slot` y `winner_id` se persiste al cerrar la serie.
- `generate_bracket` arma el arbol completo single elim y avanza BYE al nodo padre sin coronar finales automaticamente.
- Nuevo endpoint `POST /matches/{match_id}/maps` para Kill Race. Kill Race no usa placement.
- `GET /tournaments/{id}/matches` ahora devuelve mapas, score de serie y linkage al siguiente match.
- Operator Kill Race muestra bracket real, serie activa, inputs kills A/B por mapa y refetch completo tras guardar.
- Standings y stream de bracket ahora leen el mismo estado real del backend.

**Que NO se hizo:**
- No se implemento double elimination.
- No se implementaron ventanas de respin / locks.
- No se implemento import TXT adicional ni stream premium visual.
- No se toco el flujo WSOW BR / Rebirth existente de placement, standings ni scoring.

**Resultado del smoke BO3:**
1. Torneo Kill Race 2v2 con 6 participantes -> 3 equipos.
2. Match 1 operado: mapa1 `12-8`, mapa2 `9-14`, mapa3 `11-7`.
3. Tras mapa 1, releido desde DB en nueva sesion: serie `1-0`, `winner_id=null`, persistido.
4. Tras cerrar serie, releido en nueva sesion: serie `2-1`, `winner_id` poblado y siguiente match con slot cargado.
5. SQL real validado:
   - `matches`: round 1 completado con `winner_id=36`, final con `team_a_id=36`, `team_b_id=38`, `status=ready`.
   - `match_maps`: 3 filas persistidas para el BO3.

**Bugs encontrados y corregidos en el sprint:**
- Propagacion de BYE podia autocerrar el match padre y coronar ganador sin jugar la final.
- Firma nueva de `buildSingleElimBracket()` rompia consumidores viejos del dashboard.
- `create_battle_royale_match()` no podia dejar de devolver modelo ORM porque rompia tests existentes.

**Que queda para Sprint B:**
- Double elimination real o bloqueo UI mas visible si sigue fuera de alcance.
- Desempate manual explicito en UI cuando un mapa termina empatado en kills.
- Pulido visual menor de operator/bracket si aparecen roces de UX.
- Cualquier RESPIN / locks / import adicional definido fuera de este rescate.

**Comandos ejecutados:**
- `cd backend && python -m pytest`
- `cd backend && python qa_killrace.py`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`

**Nota de schema local:**
- Como no hay migraciones formales, este cambio agrega columnas en `matches` y crea `match_maps`.
- Si una instancia local vieja queda inconsistente, puede hacer falta detener backend y borrar `backend/bracketflow.db` para regenerarla.

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
