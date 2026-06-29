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
- `team_size`: configurable, default 3.
- `lobby_size`: default 50 squads. No usar 150 como lobby size; 150 son jugadores en trios.
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
- `team_size`: default 3, editable.
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
- `team_size`: default 3 si Rebirth, 4 si BR; editable.
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
- Si el bracket aun no existe, la UI dice "Bracket pendiente"; nunca mostrar tabla WSOW falsa.

## Match Point

Aplica a `wsow_br`, `rebirth_ws` y `roulette_ws`. No aplica a `kill_race_bracket`.

- Campo: `matchPointThreshold`.
- Configurable por torneo.
- No hardcodear el umbral: oficial uso 125; comunidad usa 125 o 150.
- UI: sugerencias 125 / 150 / custom.
- Logica futura: al cruzar el umbral, el equipo queda en estado "Match Point" desde la siguiente partida; el primer equipo en Match Point que gana una partida es campeon.
- En este sprint se documenta y persiste config; la coronacion se implementa en scoring completo.

## Tie-Breakers Standings

Orden oficial para standings:

1. Kills sin multiplicador.
2. Placement promedio.
3. Mas kills en una partida.
4. Mejor placement en una partida.

## Fuente De Scoring

- BR: tabla WSOW-like existente en codigo (`backend/app/crud.py`, `WSOW_PLACEMENT_BANDS`) y contrato canonico de este sprint.
- Rebirth y formatos Gedeon: contrato canonico BracketFlow fijado en este sprint.
