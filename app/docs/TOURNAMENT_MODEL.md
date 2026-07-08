# Tournament Model V2

## Decision

BracketFlow separates the tournament model into independent axes:

```ts
type GameKey =
  | "warzone"
  | "fortnite"
  | "valorant"
  | "csgo"
  | "fifa"
  | "custom";

type TournamentEngineKey =
  | "wsow_br"
  | "rebirth_ws"
  | "roulette_ws"
  | "kill_race_bracket";

type GameMode =
  | "br"
  | "rebirth"
  | "kill_race"
  | "head_to_head"
  | "round_based"
  | "custom";

type ScoringProfile =
  | "wsow_like"
  | "kill_race"
  | "head_to_head"
  | "rounds"
  | "custom";

type RosterPolicy =
  | "fixed_squad"
  | "roulette";

type TournamentStructure =
  | "cumulative"
  | "single_elim"
  | "double_elim";

type TeamSize = 1 | 2 | 3 | 4;

type TournamentConfig = {
  engine_key?: TournamentEngineKey;
  game_mode?: "br" | "rebirth" | "kill_race" | "custom";
  roster_policy?: RosterPolicy;
  tournament_structure?: TournamentStructure;
  lobbySize?: number;
  bracketMode?: "single_elim" | "double_elim";
  teamSize?: TeamSize;
  bestOf?: number;
  matchPointThreshold?: number;
  rouletteGeneratedAt?: string;
  rouletteSeed?: string;
  rouletteTeamSize?: TeamSize;
  rouletteBench?: string[];
  rouletteStatus?: "generated" | "confirmed";
};
```

Rule: `game` is separate from `engine`. The engine must not assume every game uses `kills + placement`. Warzone uses kills/placement today; Valorant, CS:GO and FIFA need different scoring profiles later.

## Current Audit

The legacy model overloads `Tournament.format`.

| Current source | Current behavior | Problem |
| --- | --- | --- |
| `Tournament.format` | Stores `single_elimination`, `battle_royale_points`, `roulette_2v2`, `roulette_3v3` | One property mixes tournament structure, roster policy and scoring assumptions. |
| `scoring_profile` | Stored on `Tournament`, defaults to `wsow_like` | Exists, but scoring is still mostly inferred from `format`. |
| `roulette_2v2` / `roulette_3v3` | Format changes team size and roulette roster generation; backend scoring currently counts kills only | Mixes roster policy + team size + tournament/scoring behavior. |
| `battle_royale_points` | Treated as World Series/BR cumulative scoring | Assumes `kills + placement`; correct for current WS practice, not generic. |
| `useWorldSeriesPractice` | Previously filtered only `battle_royale_points` | Operator reads were tied to one old format instead of an engine resolver. |
| `tournamentMode.ts` | Maps UI modes and scoring fields from `format` | Useful compatibility layer, but still infers scoring from old format. |
| Backend `calculate_points` | Uses `format` to decide WSOW multiplier vs kills-only roulette | Confirms scoring is format-driven today. |

Compatibility now lives in `app/frontend/lib/tournamentModel.ts` via `resolveTournamentEngine(tournament)`.

## Transition Map

| Old model | Problem | New model |
| --- | --- | --- |
| `format = battle_royale` | Mixes mode and scoring; not currently the active backend literal | `engine_key = wsow_br`, `game = warzone`, `game_mode = br`, `scoring_profile = wsow_like`, `roster_policy = fixed_squad`, `tournament_structure = cumulative` |
| `format = battle_royale_points` | Assumes kills + placement | `engine_key = wsow_br`, `game = warzone`, `game_mode = br`, `scoring_profile = wsow_like`, `roster_policy = fixed_squad`, `tournament_structure = cumulative` |
| `format = roulette_2v2` | Mixes roster + team size + scoring | Legacy fallback resolves to `engine_key = kill_race_bracket`, `scoring_profile = kill_race`, `roster_policy = roulette`, `team_size = 2` only when no `config.engine_key` exists. |
| `format = roulette_3v3` | Mixes roster + team size + scoring | Legacy fallback resolves to `engine_key = kill_race_bracket`, `scoring_profile = kill_race`, `roster_policy = roulette`, `team_size = 3` only when no `config.engine_key` exists. |
| `battle_royale_points` scoring | Kills + placement with WSOW-like multiplier | Keep only for `scoring_profile = wsow_like`; do not use generically. |
| `tournamentMode.ts` | Infers scoring from format | Keep as legacy UI helper; new work should use `resolveTournamentEngine`. |

SQLite now has `Tournament.config TEXT NULL` as a JSON string for engine metadata. The resolver reads `tournament.engine_key` first, then `tournament.config.engine_key`, then legacy `format`.

## Base Engines

### `wsow_br`

- game: `warzone`
- game_mode: `br`
- scoring_profile: `wsow_like`
- roster_policy: `fixed_squad`
- tournament_structure: `cumulative`
- uses kills + placement
- placement is relevant
- placement must be unique per partida
- team_size: 3 jugadores por equipo (override de producto 2026-07-07; antes 4)
- lobby_size default: 50 squads
- matchPointThreshold configurable

### `rebirth_ws`

- game: `warzone`
- game_mode: `rebirth`
- scoring_profile: `wsow_like`
- roster_policy: `fixed_squad`
- tournament_structure: `cumulative`
- uses kills + placement
- placement is relevant
- placement must be unique per partida
- team_size: 3 jugadores por equipo
- lobby_size default: 16
- scoring: 1°x1.6 / 2-5°x1.4 / 6-10°x1.2 / 11-16/17°x1.0
- matchPointThreshold configurable

### `roulette_ws`

- game: `warzone`
- game_mode: `rebirth`
- scoring_profile: `wsow_like`
- roster_policy: `roulette`
- tournament_structure: `cumulative`
- teams are mixed by roulette
- team_size: 3 (BR y Rebirth) — override de producto 2026-07-07; antes BR=4
- still uses WSOW-like points
- placement remains part of scoring
- matchPointThreshold configurable
- RESPIN is not implemented

### `kill_race_bracket`

- game: `warzone` for now; later can support Fortnite or another game
- game_mode: `kill_race`
- scoring_profile: `kill_race`
- roster_policy: `roulette`
- tournament_structure: `single_elim | double_elim`
- winner is the team with most kills
- in `single_elim`, loser is eliminated
- in `double_elim`, loser moves to losers bracket / rematch
- placement must not block validations
- placement uniqueness does not apply
- ties remain pending until manual tiebreak

# Motor -> vista principal

## `wsow_br`

- Vista principal: standings acumulativo.
- Inputs: kills + placement.
- Valida placement unico por partida.
- Uso: Battle Royale tipo World Series.
- Lobby default: 50.

## `rebirth_ws`

- Vista principal: standings acumulativo.
- Inputs: kills + placement.
- Valida placement unico por partida.
- Multiplicadores Rebirth confirmados en `TOURNAMENT_RULES.md`.

## `roulette_ws`

- Vista principal: standings acumulativo.
- Inputs: kills + placement.
- Roster policy: roulette.
- Requiere ruleta real antes de operar.
- Flujo: pool de participantes -> ruleta -> equipos confirmados -> Operator.

## `kill_race_bracket`

- Vista principal esperada: bracket / llave.
- Inputs futuros: kills por enfrentamiento.
- No usa placement.
- Single elim: perdedor eliminado.
- Double elim: perdedor baja a losers bracket.
- Hoy muestra bracket visual MVP con seed generado; el avance BO3 real queda pendiente.

Kill Race no debe renderizarse como World Series. Si no existe seed, la UI debe decir "Falta generar bracket" en vez de mostrar una tabla WSOW falsa.

## PlayerIdentity roadmap

Hoy el jugador se identifica por `nickname`, que tambien funciona como `displayName`.

Modelo futuro:

```ts
type PlayerIdentity = {
  nickname: string;
  activisionId?: string;
  platform?: "battle_net" | "psn" | "xbox" | "steam" | "ea" | "epic" | "other";
  gameIds?: Array<{
    game: string;
    value: string;
  }>;
};
```

- `displayName = nickname` por ahora.
- Torneos casuales pueden operar solo con nickname.
- Torneos competitivos/legales deben poder exigir ID oficial del juego cuando aplique.
- No bloquear la ruleta ni el bracket MVP por este roadmap.

## Operator Guardrails

Common:

- `kills` is required when the engine uses kills.
- `kills >= 0`.
- advancing is blocked when mandatory reports are missing.
- pending teams are listed in the message.

For `wsow_like`:

- `placement` is required.
- `placement >= 1`.
- `placement <= effectiveLobbySize`.
- `effectiveLobbySize = tournament.config.lobbySize ?? totalTeams`.
- duplicate placement in the same partida is blocked.

Important: placement is validated against lobby size, not registered tournament teams. A real Warzone lobby can have 40+ squads while the tournament tracks fewer teams.

For `kill_race`:

- kills are required and must be `>= 0`.
- placement is not shown in Operator.
- placement uniqueness is not enforced.
- current DB still requires a technical placement value, so the frontend sends a compatibility placeholder until schema migration.
- if top kills are tied after all reports are loaded, advancing is blocked for manual tiebreak.

## Future Extension

```ts
type ReportEvidence = {
  type: "manual" | "screenshot" | "agent";
  status: "none" | "pending" | "verified" | "rejected";
  file_url?: string;
  extracted_kills?: number;
  extracted_placement?: number;
};
```

No upload, OCR or agents are active in this sprint.
