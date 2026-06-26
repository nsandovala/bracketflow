# Next Steps

## HECHO

- Navegacion directa Torneos -> Operator: el boton principal de cada torneo y el flujo post-creacion van a `/operator?tournamentId={id}`.
- Dashboard queda disponible como accion secundaria desde `/torneos`; Standings y Stream quedan como links discretos.
- Model lock V2 documentado en `app/docs/TOURNAMENT_MODEL.md`.
- Auditoria modelo viejo -> nuevo documentada: `format`, `scoring_profile`, `roulette_2v2`, `roulette_3v3`, `battle_royale_points`, `useWorldSeriesPractice`, `tournamentMode.ts` y backend scoring.
- Compatibilidad implementada con `resolveTournamentEngine(tournament)` en frontend.
- Guardrails Operator por scoring profile:
  - `wsow_like`: kills requerido, placement requerido, placement contra `effectiveLobbySize`, placement unico por partida.
  - `kill_race`: kills requerido, no se exige placement en UI, no se bloquean placements duplicados, empate en kills bloquea avanzar.
- Backend ajustado minimamente: placement unico se valida solo para `wsow_like` + `battle_royale_points`.
- Parking actualizado para FIFA, Valorant, CS:GO, Fortnite y evidencia/agentes futuros.

## ESTADO

- Frontend lint verde: `npm run lint`.
- Frontend build verde: `npm run build`.
- Backend tests verdes usando venv: `./.venv/bin/python -m pytest` -> 15 passed.
- No hubo migracion de DB.
- `Tournament.config.lobbySize` queda como contrato frontend/documental; fallback actual: `tournament.config.lobbySize ?? totalTeams`.
- El schema backend todavia requiere `placement`; para `kill_race`, Operator no lo pide y envia un placeholder tecnico compatible hasta migracion.

## SIGUIENTE

- Resolver primero `resolveTournamentEngine(tournament)` como contrato compartido frontend/backend antes de implementar `rebirth_ws` MVP.
- Luego implementar `rebirth_ws` MVP sobre el model lock, sin asumir tablas oficiales hasta tener fuente confirmada.

## BLOQUEOS

- Tablas oficiales Rebirth/WSOW sin confirmar para variantes Rebirth.
- `lobbySize` editable en UI queda pendiente.
- Evidencia/agentes diferidos: no upload, no OCR, no agentes.
- Auth diferido.
- FIFA/Valorant/CS:GO/Fortnite parqueados.
- Schema backend aun no modela `engine_key`, `game_mode`, `roster_policy`, `tournament_structure` ni `config`.

## VERIFICAR

```bash
cd app/frontend
PATH=/Users/mac/.nvm/versions/node/v22.22.2/bin:$PATH npm run lint
PATH=/Users/mac/.nvm/versions/node/v22.22.2/bin:$PATH npm run build

cd ../backend
./.venv/bin/python -m pytest
```

Rutas smoke:

- `/`
- `/torneos`
- `/dashboard`
- `/operator`
- `/standings`
- `/equipos`
- `/ajustes`
- `/stream?obs=1&bg=transparent&layout=sidebar`
- `/stream?obs=1&bg=transparent&layout=lower`

Escenarios manuales/codigo:

- `/torneos` boton principal: `Operar` -> `/operator?tournamentId=X`.
- `/torneos` secundarios: Dashboard, Standings, Stream preservados.
- `/dashboard` mantiene una sola CTA principal a Operator.
- `/operator` bloquea placements duplicados solo en `wsow_like`.
- `/operator` no bloquea placement duplicado para `kill_race`.
- `/operator` valida placement contra `lobbySize` efectivo, no contra `totalTeams` como limite conceptual fijo.
- `/operator` bloquea avanzar con reportes pendientes y lista equipos pendientes.
- `/operator` bloquea avanzar en `kill_race` si hay empate en kills.
- `/stream` sigue fuera del shell operator y mantiene modo transparente por `bf-stream-transparent`.
