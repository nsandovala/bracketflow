# Tournament Rules

Este documento congela el contrato de producto para los motores de BracketFlow.
Regla de proyecto: cada clic debe acercarte al torneo, nunca al software.

## Matriz Canonica

| Motor | engine_key | Armado equipos | Calculo | Vista principal |
|---|---|---|---|---|
| World Series BR | `wsow_br` | fijo | kills x multiplicador BR | Standings |
| Resurgence / Rebirth WS | `rebirth_ws` | fijo | kills x multiplicador Rebirth | Standings |
| Gedeon Roulette WS | `roulette_ws` | ruleta | kills x multiplicador BR/Rebirth | Standings |
| Kill Race Bracket | `kill_race_bracket` | ruleta | serie BO3 por kills | Bracket |

Frase dura: Kill Race NO es un standing, es una llave. El standing puede existir como resumen secundario, pero la pantalla principal de Kill Race es bracket.

## World Series BR

- `engine_key`: `wsow_br`
- game: `warzone`
- mode: `br`
- roster: `fixed_squad`
- structure: `cumulative`
- scoring: `wsow_like`
- Vista principal: standings acumulativos.
- Input por partida: kills + placement.
- `team_size`: **3 jugadores por equipo** (override de producto Vito, 2026-07-07). Antes era 4; se bajo a 3 a pedido explicito del owner en `fix/f0-four-engines-residual`. Rebirth WS tambien opera con 3. Gedeon Roulette WS **BR sigue en 4** hasta confirmacion.
- `lobby_size`: default 50 squads.
- Placement: obligatorio, unico por partida, validado contra `lobby_size`.

Multiplicadores BR:

| Placement | Multiplier |
|---|---:|
| 1 | x2.0 |
| 2-5 | x1.8 |
| 6-10 | x1.6 |
| 11-20 | x1.4 |
| 21-35 | x1.2 |
| 36-50 | x1.0 |

## Resurgence / Rebirth WS

- `engine_key`: `rebirth_ws`
- game: `warzone`
- mode: `rebirth`
- roster: `fixed_squad`
- structure: `cumulative`
- scoring: `wsow_like`
- Vista principal: standings.
- Input por partida: kills + placement.
- `team_size`: 3 jugadores por equipo.
- `lobby_size`: default 16, editable 16-17.
- Placement: obligatorio, unico por partida, menor o igual a `lobby_size`.

Multiplicadores Rebirth:

| Placement | Multiplier |
|---|---:|
| 1 | x1.6 |
| 2-5 | x1.4 |
| 6-10 | x1.2 |
| 11-16/17 | x1.0 |

## Gedeon Roulette WS

- `engine_key`: `roulette_ws`
- game: `warzone`
- mode: `br` o `rebirth`
- roster: `roulette`
- structure: `cumulative`
- scoring: `wsow_like`
- Vista principal: standings.
- La ruleta solo arma rosters; el scoring sigue siendo WSOW-like.
- Flujo: crear torneo, cargar lista de participantes, definir mode/team_size/lobby_size, generar equipos aleatorios, cargar kills + placement, ver standings.
- `team_size`: **3 tanto en BR como en Rebirth** (override de producto Vito, 2026-07-07; antes BR=4). `lobby_size` sigue 50 en BR / 16 en Rebirth.
- No es Kill Race.

## Kill Race Bracket

- `engine_key`: `kill_race_bracket`
- game: `warzone`
- mode: `kill_race`
- roster: `roulette`
- structure: `single_elim` o `double_elim`
- scoring: `kill_race`
- Vista principal: bracket / llave.
- No usa placement, no usa WSOW points, no usa best place.
- Flujo: crear, elegir 1v1/2v2/3v3, elegir single/double elim, BO default 3, cargar lista, generar equipos por ruleta, generar bracket, cargar kills por mapa.
- Cada cruce BO3: mapa 1, mapa 2, mapa 3 si la serie va 1-1.
- Gana mapa quien tenga mas kills; gana serie el primero a 2 mapas.
- Single elim: perdedor eliminado. Double elim: perdedor baja a losers bracket.
- Si el seed aun no existe, la UI dice "Falta generar bracket"; nunca mostrar tabla WSOW falsa.

## Match Point

Aplica a `wsow_br`, `rebirth_ws` y `roulette_ws`. No aplica a `kill_race_bracket`.

- Campo: `matchPointThreshold`.
- Configurable por torneo.
- No hardcodear el umbral: oficial uso 125; comunidad usa 125 o 150.
- UI: sugerencias 125 / 150 / custom.
- Cierre minimo implementado (2026-07-07, `fix/f0-four-engines-residual`): **al cerrar cada partida** (todos los equipos reportaron) se recalcula el leaderboard real; si el primer lugar es **unico** y su score total `>= matchPointThreshold`, el torneo se cierra (`status=completed`) y se persiste el campeon en `config.championTeamId` (+ `championDecidedAt`). Sobrevive a F5. No se corona a mitad de partida: en el ultimo circulo de zona el 2do lugar puede igualar al 1ro.
- Si hay **empate de score en el primer lugar** sobre el umbral, NO se corona automatico: el torneo queda activo para revision manual.
- Solo aplica a motores wsow_like / standings; Kill Race lo rechaza a nivel de contrato.
- Pendiente D4 (scoring completo): estado explicito "Match Point" desde la siguiente partida y coronacion por primer ganador en Match Point. Este cierre F0 es el minimo por lider unico.

## Tie-Breakers Standings

Orden oficial para standings:

1. Kills sin multiplicador.
2. Placement promedio.
3. Mas kills en una partida.
4. Mejor placement en una partida.

## Fuente De Scoring

- BR: tabla WSOW-like existente en codigo (`backend/app/crud.py`, `WSOW_PLACEMENT_BANDS`) y contrato canonico de este sprint.
- Rebirth y formatos Gedeon: contrato canonico BracketFlow fijado en este sprint.
