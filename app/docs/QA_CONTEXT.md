# BracketFlow - Contexto de QA y Recomendaciones

> Documento de continuidad para sesiones futuras.
> Fecha: 2026-06-30
> Estado: rescate P0 de Kill Race BO3 validado.

## Sprint H1 - Home Gedeon Arena hardening

**Fecha:** 2026-07-14
**Rama:** `feat/ui-home-gedeon-arena` (sin commit)

### Objetivo QA

- Mantener el Home Gedeon Arena aprobado en desktop/tablet.
- Evitar descarga absurda en mobile.
- Frenar ambos canvas cuando salen del viewport o la pestaña queda oculta.
- Evitar rebuilds agresivos durante resize.
- Limpiar `public/` de mockups y dejar documentación actualizada.

### Decisiones técnicas ejecutadas

| Tema | Decisión |
|---|---|
| Hero desktop/tablet | `globals.css` ahora usa `/gedeon-arena-bg.webp` (~442 KB) en vez de `/gedeon/hero-bg-master-4k.png` (~6.07 MB) |
| Hero mobile | `max-width: 720px` usa `/gedeon-arena-bg-mobile.webp` (~177 KB) |
| Calidad visual | El WebP desktop se revisó visualmente contra el master 4K y se consideró aceptable para preservar el look aprobado sin rediseño |
| Canvas viewport pause | `IntersectionObserver` sobre el canvas |
| Canvas tab pause | `document.visibilitychange` |
| Reanudación | reloj acumulado propio + reset de frame timestamp para evitar teleport/jumps |
| Resize hardening | debounce `180ms` compartido entre `ResizeObserver` y `window.resize` |
| Preload | NO agregado en este sprint; falta validar Network para descartar doble descarga real |

### Assets movidos fuera de public

- `app/frontend/public/HOMECATUAL.jpg` -> `app/docs/images/HOMECATUAL.jpg`
- `app/frontend/public/mockup_aprobado.png` -> `app/docs/images/mockup_aprobado.png`
- `app/frontend/public/gedeon/boceto1.png` -> `app/docs/images/boceto1-home-gedeon.png`
- `app/frontend/public/gedeon/hero-bg-master-4k.png` -> `app/docs/images/hero-bg-master-4k.png`

### QA manual pendiente de Nelson

- Desktop `1920x1080`
- Desktop `2560x1440`
- Laptop `1366x768`
- Tablet `1024px`
- Mobile `390x844`
- Mobile `430x932`
- `StreamView/OBS 1920x1080` como superficie especial posterior

### Criterio honesto de cierre visual

- No declarar aprobación visual automática.
- Desktop manda sobre mobile.
- Mobile debe ser seguro y liviano, no redefinir el encuadre aprobado.

## Sprint F0 residual - four-engines backend/state

**Fecha:** 2026-07-07
**Rama:** `fix/f0-four-engines-residual` (sin commit)

### Diagnostico (con archivo/linea)

| Hallazgo QA | Diagnostico real | Resolucion |
|---|---|---|
| `409` repetido en `bracket-respin/open` | Backend correcto (`crud.py:539-548`): rechaza re-open sobre bracket `locked/running/completed`. Faltaba guard en front (`RouletteArena` botón "Preparar bracket" seguia activo tras generar). | Guard en front: "Ver bracket" reemplaza a "Preparar bracket" si el bracket ya existe; `generateBracketForSelected` corta temprano. |
| "Ver bracket" no lleva al lugar correcto | `mode` en `WorldSeriesOperator` se calculaba solo en el mount; `?tab=bracket` no cambiaba de vista con el componente ya montado. | Reconciliacion en render (patron React, sin setState-en-effect). |
| Match Point 125 "no cierra" | No estaba implementado: cero logica que leyera `matchPointThreshold` para cerrar (grep confirmado). No era "mal leido/persistido". | Cierre minimo por lider unico ≥ umbral; empate no corona. |
| WSOW BR "deberia ser 3" | Backend YA usaba 4 (correcto vs Warzone real). Contradecia hallazgo QA. Owner decidio override a 3. | `team_size=3` en contrato, preset, default, docs. |
| Gedeon "arma equipos mal" | Backend correcto (tests verdes 4 BR / 3 Rebirth). Es visual/nav, no estado. | Fuera de scope (Fase 3 / P2). |
| Fit/Reset "no funcionan" | SÍ estan implementados (`BracketView.tsx:184-198`); no hay cambio visible si el board no desborda (scale=1). | Pulido front P2, sin backend. |

### QA ejecutado

| Check | Resultado |
|---|---|
| Backend `pytest` | **57 passed** (51 previos + 6 nuevos) |
| Match Point: corona lider unico ≥ umbral | PASA (test + wiring via `upsert_team_result`) |
| Match Point: empate en 1er lugar sobre umbral | PASA: NO corona, torneo activo |
| Match Point: bajo umbral | PASA: no corona |
| Match Point: Kill Race excluido | PASA: threshold None |
| Campeon persiste (F5) | PASA: `config.championTeamId` + `status=completed` reload real |
| WSOW BR rechaza team_size=4 | PASA (contrato ahora exige 3) |
| Frontend `npm run lint` | 0 errores, 11 warnings preexistentes |
| Frontend `npm run build` | Exitoso |

### Pendiente real
- Todos los motores wsow_like quedaron en `team_size=3` (WSOW BR, Rebirth, Gedeon BR y Rebirth). Confirmado por Vito 2026-07-07.
- Empate en Match Point: NO corona, torneo sigue activo, se resuelve con partida de desempate; al cerrar esa partida completa se recalcula y solo corona si hay lider unico. Sin estado `needs_review` nuevo (decision Vito). Cubierto por `test_match_point_tie_stays_active_until_a_tiebreak_partida_decides`.
- D4 completo (estado Match Point persistente + coronacion por primer ganador) sigue pendiente; esto es el cierre minimo por lider unico.
- Validacion visual navegador por Vito de "Ver bracket" y del banner de campeon en Standings.

---

## Sprint E2.d - Kill Race bracket con BYE

**Fecha:** 2026-07-06
**Rama:** `fix/e2c-close-respin`

### Diagnostico

| Check | Resultado |
|---|---|
| E2.c close/lock roster | OK: `closeRosterRespin()` + `lockRosterRespin()` habilitan preparar bracket |
| 404 reportado | No se reprodujo 404 real. Endpoint equivocado detectado: `GET /tournaments/{id}/results` -> `400`, WSOW-only, no debe usarse para Kill Race |
| Bracket 6 equipos antes del fix | Creaba 7 matches, pero uno era `team_a_id=NULL`, `team_b_id=NULL` y bloqueaba semifinal/final |
| Serie actual frontend | Seleccionaba primer match con dos equipos y sin winner; ahora excluye tambien `completed` |
| Campeon `Team 1` | Corregido: si el nombre es generico y hay roster, muestra `Jugador / Jugador` |

### SQL clave - 6 equipos despues de generar

Torneo QA `13`:

```text
(48, 1, 'completed', 70, None, 70, 52, 'a')
(49, 1, 'ready', 73, 74, None, 52, 'b')
(50, 1, 'completed', 71, None, 71, 53, 'a')
(51, 1, 'ready', 72, 75, None, 53, 'b')
(52, 2, 'waiting_opponent', 70, None, None, 54, 'a')
(53, 2, 'waiting_opponent', 71, None, None, 54, 'b')
(54, 3, 'pending', None, None, None, None, None)
```

### SQL clave - 6 equipos finalizado

```text
(48, 1, 'completed', 70, None, 70, 52, 'a')
(49, 1, 'completed', 73, 74, 73, 52, 'b')
(50, 1, 'completed', 71, None, 71, 53, 'a')
(51, 1, 'completed', 72, 75, 72, 53, 'b')
(52, 2, 'completed', 70, 73, 70, 54, 'a')
(53, 2, 'completed', 71, 72, 71, 54, 'b')
(54, 3, 'completed', 70, 71, 70, None, None)
```

### QA ejecutado

| Check | Resultado |
|---|---|
| 4 equipos / 8 jugadores | PASO: 3 series manuales, final completed, campeon real |
| 6 equipos / 12 jugadores | PASO: 2 BYE auto-completados, 5 series manuales, final completed, campeon real |
| 8 equipos / 16 jugadores | PASO: 7 matches reales, sin BYE, primer 2-0 completed y ganador propagado |
| BO3 2-0 | PASO: mapa 3 responde `422 La serie ya esta cerrada.` |
| Persistencia F5 equivalente | PASO: re-fetch API/DB mantiene `winner_id`, slots y bracket_status |
| Backend tests | `./.venv/bin/python -m pytest` -> 51 passed |
| Backend qa script | Bloqueado: falta `requests` en entorno, no se instalaron paquetes |
| Frontend lint | 0 errores, 12 warnings preexistentes |
| Frontend build | Exitoso |

---

## Sprint E2.c - Close Roster Respin

**Fecha:** 2026-07-04
**Rama:** `fix/e2c-close-respin`

### QA ejecutado

| Check | Metodo | Resultado |
|---|---|---|
| Confirmar roster con respin abierto | Brave en torneo QA `6`, UI `Cerrar y confirmar` | `POST /roster-respin/close` 200 -> `POST /roster-respin/lock` 200 -> roster `locked` |
| Preparar bracket despues de confirmar | UI `Preparar bracket` | `POST /bracket-respin/open` 200 -> `POST /generate-bracket` 200 -> `POST /bracket-respin/lock` 200 |
| Persistencia | F5 despues de bracket | Sigue `LISTO PARA OPERAR`, roster locked y bracket visible |
| Frontend lint | `cd app/frontend && PATH=/Users/mac/.nvm/versions/node/v22.22.2/bin:$PATH npm run lint` | 0 errores, 12 warnings preexistentes |
| Frontend build | `cd app/frontend && PATH=/Users/mac/.nvm/versions/node/v22.22.2/bin:$PATH npm run build` | Exitoso |

### Cambio funcional

- El wrapper frontend `closeRosterRespin()` conecta el endpoint backend existente `POST /tournaments/{id}/roster-respin/close`.
- `lockRosterWindow()` cierra respin solo si `roster_status === "respin_open"` y luego bloquea roster.
- `generateBracketForSelected()` relee torneo y no prepara bracket si `roster_status !== "locked"`.
- No se toco backend, scoring BO3, WSOW/Rebirth ni parser.

---

## Sprint E2B Front - Kill Race Flow

**Fecha:** 2026-07-03
**Rama:** `fix/e2b-front-clean`

### QA ejecutado

| Check | Comando / metodo | Resultado |
|---|---|---|
| Preflight git | `git status --short`, `git diff --stat`, `git log --oneline -5` | Rama limpia creada desde `origin/master` |
| Frontend lint | `cd app/frontend && PATH=/Users/mac/.nvm/versions/node/v22.22.2/bin:$PATH npm run lint` | 0 errores, warnings preexistentes |
| Frontend build | `cd app/frontend && PATH=/Users/mac/.nvm/versions/node/v22.22.2/bin:$PATH npm run build` | Build exitoso |
| Navegador real | Brave en `127.0.0.1:3000/operator` | Smoke manual ejecutado |

### Smoke ejecutado

1. Ruleta -> bracket:
   - Torneo QA `6`.
   - `Preparar bracket` ejecuto `openBracketRespin` -> `generateBracket` -> `lockBracketRespin` -> refresh.
   - Mensaje visible: `Bracket generado: 3 matches.`
   - F5 mantuvo bracket generado.

2. BO3 2-0:
   - Torneo QA `7`.
   - Match inicial: mapa 1 `20-10`, mapa 2 `15-11`.
   - Serie cerro 2-0, el ganador avanzo y la UI salto al siguiente match listo.
   - No aparecio input para mapa 3.
   - F5 mantuvo bracket y siguiente serie lista.

3. BO3 2-1:
   - Torneo QA `9`.
   - Match inicial: mapa 1 `20-10`, mapa 2 `10-20`, mapa 3 `15-11`.
   - Serie cerro 2-1, el ganador avanzo y la UI salto al siguiente match listo.
   - F5 mantuvo bracket y estado listo.

4. Errores visibles:
   - Empate forzado `10-10` mostro en pantalla el mensaje backend exacto: `Empate de kills en un mapa: define desempate manual antes de guardar.`
   - Intento de confirmar roster mientras la ventana roster-respin seguia abierta mostro en pantalla el mensaje backend exacto: `Cierra el respin antes de bloquear el roster.`

### Riesgos / pendientes reales

- El contrato actual impide cerrar roster dentro de una ventana abierta usando solo `lockRosterRespin()`. Como el frontend no expone `closeRosterRespin()` y este sprint no podia tocar backend ni crear endpoints, queda pendiente resolver la decision de producto/contrato para `Confirmar equipos`.
- El backend local contiene `POST /tournaments/{id}/roster-respin/close`, pero no se uso ni se conecto desde frontend por restriccion explicita del sprint.
- La UI muestra errores backend en pantalla; no hay flujo de desempate manual para mapas empatados.

---

## Sprint B - Respins persistidos / import / stream

### QA ejecutado

| Check | Comando | Resultado |
|---|---|---|
| Backend tests | `cd backend && python -m pytest` | 39 passed |
| Backend QA script | `cd backend && python qa_killrace.py` | PASO |
| Frontend lint | `cd frontend && npm run lint` | 0 errores, 8 warnings no bloqueantes |
| Frontend build | `cd frontend && npm run build` | Build exitoso |

### Smoke Sprint B ejecutado

1. Crear torneo Kill Race 2v2.
2. Import backend robusto validado:
   - nickname con comas internas -> `422`
   - lista valida -> `201`
3. Abrir `roster-respin` 3 min.
4. Generar ruleta y lockear roster.
5. Reintentar generar ruleta con `roster_status=locked` -> rechazo `400`.
6. Abrir `bracket-respin` 3 min.
7. Generar bracket y lockear bracket.
8. Reintentar generar bracket con `bracket_status=locked` -> rechazo `400`.
9. SQL real validado en `backend/bracketflow.db` para torneo QA 22:
   - `('locked', None, '<timestamp>', 'locked', None, '<timestamp>')`

### Bugs encontrados y corregidos

1. `POST /tournaments/{id}/generate-bracket` devolvia `500` porque el endpoint no retornaba `BracketGenerationResult`.
2. `_cleanup_bracket_matches()` tenia codigo ajeno pegado al final y rompia la generacion de bracket.
3. `qa_killrace.py` seguia usando el flujo viejo sin abrir ventanas de respin.
4. `RouletteArena.tsx` mezclaba `Team[]` y preview teams en el render del seed y rompia `npm run build`.

### Riesgos / pendientes

- Falta QA manual con navegador para confirmar que el countdown visible sigue coherente tras F5.
- Falta QA visual de stream OBS 1920x1080 sin scroll ni artefactos.
- `bracket_status` pasa a `running` al guardar el primer mapa; si negocio prefiere otro evento de arranque, decidirlo en siguiente sprint.

## 1. QA ejecutado

### Sprint Rescate P0 - Kill Race BO3 persistente

| Check | Comando | Resultado |
|---|---|---|
| Backend tests | `cd backend && python -m pytest` | 35 passed |
| Backend QA script | `cd backend && python qa_killrace.py` | PASO |
| Frontend lint | `cd frontend && npm run lint` | 0 errores, 8 warnings no bloqueantes |
| Frontend build | `cd frontend && npm run build` | Build exitoso |

### Smoke BO3 ejecutado

1. Crear torneo Kill Race 2v2 con `bestOf=3`.
2. Cargar 6 participantes reales.
3. Generar ruleta -> 3 equipos.
4. Generar bracket single elim completo.
5. Operar Match 1 con:
   - mapa 1: `12-8`
   - mapa 2: `9-14`
   - mapa 3: `11-7`
6. Reabrir sesion despues de mapa 1:
   - serie `1-0`
   - `winner_id = NULL`
   - fila persistida en `match_maps`
7. Reabrir sesion despues del cierre:
   - serie `2-1`
   - `winner_id` persistido en el match resuelto
   - slot del siguiente match poblado con el ganador
8. SQL validado en `backend/bracketflow.db`:
   - `SELECT id, round, status, team_a_id, team_b_id, winner_id, next_match_id FROM matches WHERE tournament_id = 15`
   - `SELECT * FROM match_maps WHERE match_id = 21`

### Estado final del smoke

- `winner_id` se persiste en DB y el avance sobrevive a F5.
- Kill Race no usa placement.
- El siguiente match queda en `status=ready` con ambos equipos cargados.

## 2. Bugs encontrados y corregidos

1. La propagacion de BYE podia autocerrar el nodo padre y dejar un campeon falso antes de jugar la final.
2. El dashboard seguia consumiendo la firma vieja de `buildSingleElimBracket`.
3. `create_battle_royale_match()` no podia devolver schema Pydantic sin romper tests que esperan ORM.

## 3. Riesgos y pendientes reales

- Double elimination sigue fuera de alcance; debe bloquearse con mensaje claro.
- Empate de kills en un mapa responde 422, pero la UI todavia no tiene flujo de desempate manual.
- No hay migraciones formales. Si una DB local vieja queda inconsistente, puede ser necesario detener backend y borrar `backend/bracketflow.db`.

## 4. Reglas vigentes

- No agregar demo data, seeders, fixtures permanentes ni mocks persistentes.
- No redisenar la ruleta en este sprint.
- No tocar placement/scoring de WSOW BR o Rebirth al resolver Kill Race.

## QA Manual — Kill Race 4/6/8 equipos

Fecha: 2026-07-07
Rama: fix/e2c-close-respin

### Kill Race 4 equipos / 8 jugadores
- Setup ruleta: PASA
- Cerrar respin roster: PASA
- Preparar bracket: PASA
- Semifinales: PASA
- Final: PASA
- Campeón con roster real: PASA
- F5 survival: PASA
- 2-0 no pide mapa 3: PASA

### Kill Race 6 equipos / 12 jugadores
- Setup ruleta: PASA
- BYE/Pasa directo: PASA
- Semifinales/final: PASA
- Campeón: PASA
- F5 survival: PASA

### Kill Race 8 equipos / 16 jugadores
- Setup ruleta: PASA
- Bracket sin BYE: PASA
- Cuartos/semis/final: PASA
- Campeón: PASA
- F5 survival: PASA

### Notas visuales
- Pendiente mejorar labels Kills A/B.
- Pendiente mejorar copy BYE.
- Pendiente dashboard activo con último ganador/stats.
