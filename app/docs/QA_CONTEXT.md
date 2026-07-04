# BracketFlow - Contexto de QA y Recomendaciones

> Documento de continuidad para sesiones futuras.
> Fecha: 2026-06-30
> Estado: rescate P0 de Kill Race BO3 validado.

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
