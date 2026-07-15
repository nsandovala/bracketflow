# NEXT STEPS

## ULTIMO SPRINT EJECUTADO - H1 Home Gedeon Arena hardening

**Fecha:** 2026-07-14
**Rama:** `feat/ui-home-gedeon-arena` (sin commit)

**Objetivo del sprint:** endurecer el Home aprobado de Gedeon Arena para merge seguro a `master`, manteniendo prioridad desktop/tablet first y mobile safe, sin rediseñar la composición ni tocar dashboard/operator/bracket/stream/backend.

**Qué se hizo:**
- Se corrigió `.gitattributes`: se quitó `app/frontend/.gitattributes` mal ubicado y se creó `.gitattributes` en la raíz con `* text=auto eol=lf`, sin ejecutar `git add --renormalize`.
- El hero dejó de servir `app/frontend/public/gedeon/hero-bg-master-4k.png` (~6.07 MB) y ahora usa `app/frontend/public/gedeon-arena-bg.webp` (~442 KB) en desktop/tablet, conservando el mismo encuadre aprobado.
- Mobile usa `app/frontend/public/gedeon-arena-bg-mobile.webp` (~177 KB) en `max-width: 720px` para evitar descargar el asset desktop pesado.
- `GedeonHeroFX` quedó endurecido sin librerías: pausa con `IntersectionObserver`, pausa con `document.visibilitychange`, reanudación sin salto de partículas/pulsos y debounce de `180ms` para `ResizeObserver` + `resize`.
- Se movieron fuera de `public` los assets de mockup/documentación: `HOMECATUAL.jpg`, `mockup_aprobado.png`, `gedeon/boceto1.png`.
- El master 4K del hero quedó resguardado fuera de `public` en `app/docs/images/` como fuente de respaldo para futuras exportaciones high-quality.

**Qué NO se hizo:**
- No se rediseñó el Home ni se cambió headline/copy principal.
- No se agregaron librerías ni se tocó `package.json` / `package-lock.json`.
- No se reescribió `GedeonHeroFX` desde cero.
- No se agregó preload del hero: quedó pendiente hasta validar en Network que no duplique descargas reales.
- No hubo commit ni push.

**Pendiente real:**
- Validación visual manual de Nelson en desktop `1920x1080`, `2560x1440`, laptop `1366x768`, tablet `1024px`, mobile `390x844` y `430x932`.
- Validar `StreamView/OBS 1920x1080` como superficie especial sin declarar aprobación visual hasta que Nelson lo revise.
- Si Nelson quiere todavía más margen premium en desktop, se puede exportar un nuevo WebP/AVIF high-quality desde el master 4K ya resguardado en docs.

**Futuro explícito:**
- OGL/WebGL para una versión futura del FX si el producto decide subir complejidad visual.
- Dashboard operativo como siguiente superficie premium del producto.
- Push Mode.
- `Saber Más` extendido.
- OCR.
- agentes/copilot.

## ULTIMO SPRINT EJECUTADO - F0 residual four-engines backend/state

**Fecha:** 2026-07-07
**Rama:** `fix/f0-four-engines-residual` (sin commit)

**Contexto:** QA manual de los 4 motores post-merge. Objetivo: que el sistema no mienta (botones, estados, reglas, transiciones). Diagnostico backend/state primero, luego fixes minimos.

**Decisiones de producto (Vito, 2026-07-07):**
- **Todos los motores wsow_like pasan a `team_size=3`**: WSOW BR=3, Rebirth WS=3, **Gedeon Roulette WS BR=3 y Rebirth=3**. Kill Race se mantiene 1/2/3 segun config. Override explicito del owner (antes WSOW BR y Gedeon BR eran 4). `lobby_size` no cambia (50 BR / 16 Rebirth).
- **Match Point: cierre minimo activado** (adelanto parcial de D4). Empate en primer lugar sobre umbral → NO corona; el torneo **continua activo** hasta que una partida de desempate deje un lider unico. Coronacion solo al **cierre de partida completa**.

**Qué se hizo (backend primero):**
- `crud.validate_tournament_contract`: WSOW BR ahora exige `team_size=3` (antes 4).
- **Match Point minimo** (`crud.evaluate_match_point` + `get_match_point_threshold`, wired en `upsert_team_result`): **al cerrar cada partida** (todos reportaron) se recalcula leaderboard; si el 1er lugar es unico y su score `>= matchPointThreshold`, cierra torneo (`status=completed`) y persiste `config.championTeamId` + `championDecidedAt`. No corona a mitad de partida (el 2do puede igualar en el ultimo circulo). Empate de score en 1er lugar sobre umbral → NO corona (queda activo). Solo wsow_like; Kill Race excluido por contrato. Sobrevive F5.
- `schemas.TournamentConfig`: expone `championTeamId` y `championDecidedAt` (si no, el response los descartaba).
- `main.py`: eliminado codigo muerto inalcanzable tras el `return` de `lock_bracket_respin` (referenciaba variables inexistentes).

**Qué se hizo (frontend, contrato ya correcto):**
- Preset `wsow_br.team_size` 4→3 (`tournamentModel.ts`), default de `createWorldSeriesTournament` 4→3 (`useWorldSeriesPractice.ts`), tipo `TournamentConfig` + resolver leen `championTeamId`.
- **Fix 409 `bracket-respin/open`:** el backend rechazaba correctamente el re-open sobre bracket ya `locked/running/completed`; faltaba guard en front. `RouletteArena` ahora oculta "Preparar bracket" y muestra solo "Ver bracket" cuando el bracket ya existe; `generateBracketForSelected` corta temprano sin reintentar `open`.
- **Fix "Ver bracket":** `mode` se calculaba solo en el mount; se agrego reconciliacion en render (patron oficial React, sin setState-en-effect) para que `?tab=bracket` cambie de vista aunque el operator ya este montado.
- Standings WSOW muestra "Campeón por Match Point: …" cuando `config.championTeamId` existe.

**QA ejecutado:**
- Backend `pytest` → **57 passed** (51 previos + 6 nuevos: 5 Match Point + rechazo team_size=4 en WSOW BR).
- Frontend `npm run lint` → 0 errores, 11 warnings preexistentes.
- Frontend `npm run build` → exitoso.

**NO se hizo (fuera de scope / decision):**
- No se implemento el estado "Match Point" persistente ni la coronacion por primer ganador en Match Point (eso es D4 completo).
- No se cambio Gedeon Roulette WS BR (sigue 4).
- No se toco Switcharo/KD, agentes/copilot, react-brackets, ni se redisenó UI.
- No hubo commit.

**Pendiente / a confirmar con Vito:**
- Gedeon Roulette WS BR ya bajo a 3 (confirmado 2026-07-07). Todos los wsow_like en 3.
- Fit/Reset del bracket (`BracketView`) SÍ estan implementados; "no funcionan" es porque el board no desborda (scale=1). Pulido front P2 (Vito: no tocar este sprint).
- Empate en Match Point: NO se creo estado `needs_review` (decision Vito: no inventar estados). El torneo sigue activo y se resuelve con partida de desempate.
- Historial de archivados → PARKING_LOT (no en este sprint).
- D4 completo (estado "Match Point" persistente + coronacion por primer ganador en Match Point) sigue pendiente.

---

## ULTIMO SPRINT EJECUTADO - E2.d Kill Race bracket con BYE

**Fecha:** 2026-07-06
**Rama:** `fix/e2c-close-respin`

**Contexto real corregido:**
- E2.c close/lock quedo OK: cerrar respin y bloquear roster habilita `Preparar bracket`.
- El bloqueo posterior estaba en la data del bracket para 6 equipos: se generaba un match de ronda 1 con `team_a_id=NULL` y `team_b_id=NULL`, cableado hacia semifinal, dejando un slot imposible de resolver.
- No se reprodujo un `404` real durante la generacion. El endpoint equivocado detectado para Kill Race fue `GET /tournaments/{id}/results`, que responde `400` porque es WSOW/standings-only. No debe bloquear Kill Race.

**Qué se hizo:**
- `generate_bracket()` ahora usa orden de seeds de bracket (`1 vs N`, etc.) y distribuye BYE como slots reales, no al final como match vacio.
- BYE se auto-completa con `status=completed` y `winner_id` real, y se propaga al `next_match_id/next_slot`.
- La propagacion de BYE ya no depende solo de round 1: evita autocerrar un match si el slot vacio viene de un feeder pendiente.
- `upsert_map_result()` cuenta mapas desde DB despues del flush, evitando que una relacion ORM stale permita mapa 3 tras un 2-0.
- La serie actual de Kill Race filtra solo matches con dos equipos, sin `winner_id` y no `completed`.
- Si no hay serie jugable y no hay campeon, Operator muestra mensaje tecnico de propagacion en vez de decir que el bracket esta listo para operar.
- El stream Kill Race no consulta `/results`; para bracket usa `matches`.
- `Ver bracket` desde ruleta Kill Race navega a `/operator?tournamentId=...&tab=bracket`.
- El campeon visible usa nombre real o roster (`Jugador / Jugador`) cuando el equipo se llama `Team N` / `Equipo N`.

**QA ejecutado:**
- Backend `./.venv/bin/python -m pytest` -> 51 passed.
- Backend `qa_killrace.py` -> no ejecutable en este entorno porque falta `requests` y no se instalaron paquetes por regla dura.
- Smoke API 4 equipos: 3 matches, semifinal 2-0, semifinal 2-1, final 2-0, bracket `completed`, campeon real persistido.
- Smoke API 6 equipos: 7 matches, 2 BYE auto-completados, 5 series manuales, final `completed`, campeon real persistido.
- Smoke API 8 equipos: 7 matches reales, sin BYE, primer match 2-0 completado y ganador propagado.
- Smoke 2-0: intento de guardar mapa 3 responde `422 {"detail":"La serie ya esta cerrada."}`.
- Frontend `npm run lint` -> 0 errores, 12 warnings preexistentes.
- Frontend `npm run build` -> exitoso.

**Pendiente real:**
- Validacion visual manual en navegador por Vito si se quiere confirmar copy/layout final; la validacion funcional se hizo por API/DB.

---

## ULTIMO SPRINT EJECUTADO - E2.c Close Roster Respin

**Fecha:** 2026-07-04
**Rama:** `fix/e2c-close-respin`

**Qué se hizo:**
- Se agrego wrapper frontend `closeRosterRespin()` para `POST /tournaments/{id}/roster-respin/close`.
- `lockRosterWindow()` ahora ejecuta `closeRosterRespin()` antes de `lockRosterRespin()` cuando el roster esta en `respin_open`.
- `generateBracketForSelected()` relee el torneo antes de preparar bracket y corta con `Primero cierra el respin y bloquea equipos.` si el roster todavia no esta locked.
- El boton de ruleta cambio de `Locked` a `Cerrar respin y bloquear equipos`, porque ahora representa la accion real: cerrar respin y confirmar equipos.
- El boton de bracket cambio de `Locked bracket ahora` a `Bloquear bracket ahora`.

**Archivos modificados:**
- `frontend/lib/api.ts`
- `frontend/app/lib/useWorldSeriesPractice.ts`
- `frontend/app/components/RouletteArena.tsx`
- `frontend/app/components/WorldSeriesOperator.tsx`
- `docs/NEXT_STEPS.md`
- `docs/QA_CONTEXT.md`

**Pendiente del sprint anterior resuelto:**
- El operador ya no queda atrapado cuando intenta confirmar equipos con la ventana de roster-respin abierta. El frontend usa el endpoint existente del backend para cerrar la ventana antes de bloquear roster.

**Smoke real ejecutado:**
- Torneo QA `6`: la accion de cerrar/bloquear llamo `POST /roster-respin/close` 200 y `POST /roster-respin/lock` 200.
- El timer desaparecio, el estado quedo `Confirmado`, mensaje visible `Equipos confirmados. Ya puedes preparar bracket.` y `Preparar bracket` quedo habilitado.
- `Preparar bracket` llamo `POST /bracket-respin/open` 200, `POST /generate-bracket` 200 y `POST /bracket-respin/lock` 200.
- F5 mantuvo `LISTO PARA OPERAR`, roster locked y bracket visible.
- `npm run lint` -> 0 errores, 12 warnings preexistentes.
- `npm run build` -> exitoso.

---

## ULTIMO SPRINT EJECUTADO - E2B Front Kill Race Flow

**Fecha:** 2026-07-03
**Rama:** `fix/e2b-front-clean`

**Qué se hizo:**
- `generateRouletteForSelected()` ahora solo genera la ruleta con `confirm:false`, refresca torneo y muestra mensaje claro. Ya no bloquea roster automaticamente.
- `lockRosterWindow()` conserva `lockRosterRespin()` y usa copy en español: `Equipos confirmados. Ya puedes preparar bracket.` / `No se pudo confirmar el roster.`
- `generateBracketForSelected()` ejecuta la cadena correcta: `openBracketRespin` -> `generateBracket` -> `lockBracketRespin` -> `refreshSelectedTournament`.
- `Preparar bracket` en Kill Race ahora dispara la generacion real del bracket desde la UI en vez de ser solo navegacion.
- `saveKillRaceMap()` detecta cierre de serie por `winner_id`, `status=completed` o mayoria de mapas ganados. Si la serie cierra, elimina el draft, no calcula mapa siguiente y enfoca el siguiente match listo.
- La UI de la serie actual no muestra inputs ni boton `Guardar mapa` cuando la serie ya esta cerrada. Muestra `Serie cerrada`, `El ganador ya avanzo al siguiente match.`, CTA `Ver bracket actualizado` y, si aplica, `Continuar con siguiente serie`.

**Archivos modificados:**
- `frontend/app/lib/useWorldSeriesPractice.ts`
- `frontend/app/components/WorldSeriesOperator.tsx`
- `frontend/app/components/RouletteArena.tsx`
- `frontend/app/(operator)/operator/page.tsx`
- `docs/NEXT_STEPS.md`
- `docs/QA_CONTEXT.md`

**Validacion tecnica:**
- `cd app/frontend && PATH=/Users/mac/.nvm/versions/node/v22.22.2/bin:$PATH npm run lint` -> 0 errores, warnings preexistentes.
- `cd app/frontend && PATH=/Users/mac/.nvm/versions/node/v22.22.2/bin:$PATH npm run build` -> exitoso.
- No se toco backend.
- No se instalo ninguna libreria.
- No hubo commit ni push.

**Smoke navegador real:**
- Ruleta -> bracket -> F5: generado y persistido en torneo QA `6`.
- BO3 2-0: torneo QA `7`, mapa 1 `20-10`, mapa 2 `15-11`; cerro 2-0, avanzo ganador, no pidio mapa 3, F5 mantuvo bracket.
- BO3 2-1: torneo QA `9`, mapas `20-10`, `10-20`, `15-11`; cerro 2-1, avanzo ganador, F5 mantuvo bracket.
- Error empate: `10-10` mostro en pantalla el mensaje backend exacto: `Empate de kills en un mapa: define desempate manual antes de guardar.`

**Pendiente real / contrato backend:**
- En flujo ruleta con ventana roster abierta 3 minutos, `lockRosterRespin()` responde `Cierra el respin antes de bloquear el roster.`. El frontend no tiene `closeRosterRespin()` y este sprint no podia crear endpoint ni tocar backend. Confirmar producto/contrato: o se expone close en frontend, o backend permite lock dentro de ventana, o la UI debe esperar/cerrar ventana por otro flujo existente.

---

## ULTIMO SPRINT EJECUTADO - UX-P0 Rescue Parte 5 (Rediseño Ruleta Casino + Efecto Portal)

**Fecha:** 2026-07-01
**Rama:** `fix/ux-p0-operator-roulette-bracket`

**Qué se hizo:**
- **Layout horizontal 3 columnas**: `Participantes (izq) | Ruleta Casino (centro) | Seed/Equipos (der)`. La ruleta ya no está abajo sino en el centro visual dominante.
- **Ruleta tipo casino**: Segmentos coloreados pastel con nombre de cada jugador visible (como ruleta de nombres clásica). Borde dorado `#ffd700` con glow. Centro oscuro con contador de jugadores.
- **Efecto portal Doctor Strange al girar**: 4 anillos concéntricos que giran a diferentes velocidades con colores cálidos (dorado, naranja, rojo-anaranjado). Se activan solo durante el spin (1.2s). Glow intenso en los bordes dorados.
- **Botón "Limpiar" eliminado**: Era un botón prominente que confundía y mataba la UI. Ahora es un `×` pequeño al lado del contador de tags de participantes.
- **CSS limpieza**: Todos los estilos v1 (`bf-roulette-arena`, `bf-roulette-grid`, `bf-roulette-panel`, `bf-roulette-wheel`, etc.) y v2 eliminados. Solo quedan clases v3 funcionales.
- **Responsive**: En pantallas <1100px la ruleta pasa arriba y participantes/equipos abajo. En <720px se apilan verticalmente.

**Decisiones de diseño:**
- La ruleta es grande y dominante SOLO cuando hay jugadores cargados y respin abierto — ese momento de expectativa genera dopamina y espectativa por el compañero que tocará.
- Cuando está locked o sin jugadores, muestra una barra compacta de estado.
- Los colores pastel de los segmentos se reparten cíclicamente entre los 16 disponibles para máxima diferenciación.
- El efecto portal usa animaciones CSS puras con `transform: rotate()` y `box-shadow`, sin librerías externas.

**Archivos modificados:**
- `frontend/app/components/RouletteArena.tsx` — Reescrito completo con layout v3, ruleta casino con segmentos, portal effect, tags participantes, seed de bracket/equipos
- `frontend/app/globals.css` — Eliminados ~150 líneas de CSS v1/v2 obsoleto. Agregados ~200 líneas de CSS v3: `.bf-roulette-arena-v3`, `.bf-roulette-workspace-v3`, `.bf-roulette-casino-wheel`, `.bf-roulette-portal`, `.bf-roulette-segment`, `.bf-roulette-casino-actions`, etc.

**Validación técnica:**
- `cd frontend && npm run lint` → 0 errores, 8 warnings preexistentes
- `cd frontend && npm run build` → Exitoso
- No se tocó backend.
- No se cambió stack ni se agregaron dependencias.

---

## ULTIMO SPRINT EJECUTADO - UX-P0 Rescue Parte 4 (Import masivo de equipos WSOW BR)

**Fecha:** 2026-07-01
**Rama:** `fix/ux-p0-operator-roulette-bracket`

**Qué se hizo:**
- **Import masivo de equipos para WSOW BR (fixed squad)**: En la sección "Equipos & Roster" del Operator (modo setup sin ruleta), se agregó botón "Importar equipos .txt/.csv".
- **Formato soportado**: `TeamName,Jugador1,Jugador2,Jugador3,Jugador4` — una línea por equipo. Parser separa por comas (con o sin espacio después), primer elemento = nombre del equipo, resto = roster.
- **Proceso**: Lee archivo con FileReader, parsea línea por línea, llama a `createTeamWithRoster` del hook para cada equipo, muestra mensaje de éxito con contador.
- **Fallback**: El form manual de "Agregar equipo real" sigue funcionando igual. El import es una alternativa rápida para torneos grandes.

**Archivos modificados:**
- `frontend/app/components/WorldSeriesOperator.tsx` — Prop `onBulkImportTeams`, UI de import, parser CSV, estado `teamImportMessage`
- `frontend/app/(operator)/operator/page.tsx` — `handleBulkImportTeams` que itera y crea equipos

**Validación técnica:**
- `cd frontend && npm run lint` → 0 errores, 8 warnings preexistentes
- `cd frontend && npm run build` → Exitoso

---

## ULTIMO SPRINT EJECUTADO - UX-P0 Rescue Parte 3 (Bulk Actions + Estados normalizados)

**Fecha:** 2026-06-30
**Rama:** `fix/ux-p0-operator-roulette-bracket`

**Qué se hizo:**
- **P0.6 Bulk actions**: Checkbox por fila en cada tarjeta de torneo. Checkbox maestro en la barra bulk que refleja "seleccionar visibles". Barra bulk sticky con contador (`N seleccionado(s)`) y botones `[Archivar seleccionados]` `[Eliminar seleccionados]` `[Cancelar]`. Tarjeta resaltada visualmente cuando está seleccionada (`is-checked`).
- **P0.6 Confirmación destructiva**: Modal overlay fijo con backdrop blur, título "Borrar N torneo(s)" en rojo, texto explicativo: "Se eliminarán torneos, equipos, matches, mapas y resultados asociados. Esta acción no se puede deshacer.", botón destructivo rojo "Borrar N torneo(s)", botón cancelar secundario. Nunca dice "OK".
- **P0.7 Estados normalizados**: La lista de torneos ahora usa `getTournamentStatusLabel()` del helper `tournamentStatus.ts`. Nunca muestra `BRACKET_GENERATED`, `TEAMS_GENERATED`, `ACTIVE` crudo. Muestra "Bracket listo", "Equipos listos", "Activo", "Finalizado", etc.

**Archivos modificados:**
- `frontend/app/(operator)/torneos/page.tsx` — Estado `selectedIds`, toggleSelection, toggleSelectAllVisible, bulkArchive, bulkDelete con confirmación modal, checkbox por fila
- `frontend/app/globals.css` — Estilos `.bf-bulk-bar`, `.bf-bulk-confirm`, `.bf-bulk-confirm-panel`, `.bf-hub-tournament-card.is-checked`, checkbox en tarjetas
- `frontend/lib/tournamentStatus.ts` — Sin cambios (ya existía de Parte 1)

**Validación técnica:**
- `cd frontend && npm run lint` → 0 errores, 8 warnings preexistentes
- `cd frontend && npm run build` → Exitoso

---

## ULTIMO SPRINT EJECUTADO - UX-P0 Rescue Parte 2 (Bracket Visual + Nombres + Stream)

**Fecha:** 2026-06-30
**Rama:** `fix/ux-p0-operator-roulette-bracket`

**Qué se hizo:**
- **P0.3 Bracket legible**: Seeds más anchas (300px vs 268px), gap entre rondas aumentado (18px), canvas con transform scale para fit/reset, toolbar con botones `Fit` y `Reset`, scroll horizontal encapsulado dentro del board con borde y fondo oscuro, rounds centrados verticalmente.
- **P0.4 Nombres reales**: `toBracketRounds.ts` ya usaba `getTeamDisplayName` con regex `GENERIC_TEAM_NAME` que detecta "Team 1" / "Equipo 2" y reemplaza por roster real. Verificado que funciona correctamente.
- **P0.5 Ganador/Avanza obvio**: `.is-winner` ahora tiene borde verde más fuerte, background gradient, box-shadow sutil, nombre y score en color éxito con text-shadow. `.is-loser` opacity reducida a 0.48, grayscale 35%, estado "Eliminado" en color danger. Badge "Avanza" agrandado con borde. Score del ganador más grande (1.65rem).
- **P0.9 Stream Kill Race**: `BracketStreamView` ya consumía `BracketView` en modo `stream`, que incluye `ChampionBlock` de la Parte 1. Stream muestra bracket o champion state según corresponda, NO tabla WSOW.

**Archivos modificados:**
- `frontend/app/components/BracketView.tsx` — Toolbar Fit/Reset, canvas con scale
- `frontend/lib/toBracketRounds.ts` — Sin cambios (ya funcionaba correctamente)
- `frontend/app/globals.css` — Estilos bracket ampliados, winner/loser potenciados, toolbar nuevo
- `frontend/app/components/BracketStreamView.tsx` — Sin cambios (ya correcto)

**Qué NO se hizo (para Parte 3):**
- No se implementó zoom granular paso a paso (solo fit/reset).
- No se tocó backend.
- No se agregó pan/drag del bracket.

**Validación técnica:**
- `cd frontend && npm run lint` → 0 errores, 8 warnings preexistentes
- `cd frontend && npm run build` → Exitoso

---

## ULTIMO SPRINT EJECUTADO - UX-P0 Rescue Parte 1 (Navegación + Estados + Champion)

**Fecha:** 2026-06-30
**Rama:** `fix/ux-p0-operator-roulette-bracket`

**Qué se hizo:**
- **P0.1 Champion State**: `BracketView` ahora muestra bloque visual dorado cuando el bracket está `completed` con `winner_id`. Muestra nombre del campeón, roster, score final, y CTAs (Ver bracket final, Ir a Stream, Volver a Torneos). Operator muestra "Torneo finalizado · Campeón: [equipo]" cuando no quedan matches pendientes.
- **P0.2 Botón volver**: Barra contextual sticky `opr-context-bar` en Operator Kill Race con: `← Volver al bracket`, nombre del torneo, y estado actual (`Setup` / `Bracket listo` / `En operación` / `Finalizado`). Si está finalizado, muestra "Campeón: [equipo]".
- **P0.7 Normalizar estados**: Nuevo helper `frontend/lib/tournamentStatus.ts` con mapeo de estados backend a labels humanos (`ACTIVE → Activo`, `COMPLETED → Finalizado`, etc.). Funciones `findChampion()`, `isTournamentCompleted()`, `getTournamentPhase()`.
- **P0.8 Standings Kill Race**: Título visible cambiado a `Bracket / Resultados`. Subtítulo muestra campeón y score final cuando el torneo está completado.
- **Limpieza dependencias**: `react-brackets` movido de `app/package.json` (accidental) a `frontend/package.json` con `--legacy-peer-deps`. `app/package.json` eliminado.

**Archivos modificados:**
- `frontend/app/components/BracketView.tsx` — ChampionBlock, imports de tournamentStatus
- `frontend/app/components/WorldSeriesOperator.tsx` — Context bar sticky, champion state en serie vacía
- `frontend/app/components/WorldSeriesStandings.tsx` — Título Bracket/Resultados, champion en subtítulo
- `frontend/lib/tournamentStatus.ts` — Nuevo helper de estados y champion
- `frontend/app/globals.css` — Estilos `bf-champion-block`, `bf-champion-*`, `opr-context-bar`, `opr-context-*`
- `frontend/package.json` — Agregado `react-brackets@^0.4.7`
- `app/package.json` — Eliminado

**Qué NO se hizo (para Parte 2):**
- No se tocó layout del bracket (zoom, fit, canvas centrado) — va en Parte 2.
- No se tocó visual de ganador/avanza en los seeds del bracket (opacidad, badge) — va en Parte 2.
- No se tocó Stream champion state obs-specific — va en Parte 2.
- No se tocó backend.

**Validación técnica:**
- `cd frontend && npm run lint` → 0 errores, 8 warnings preexistentes
- `cd frontend && npm run build` → Exitoso

---

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
