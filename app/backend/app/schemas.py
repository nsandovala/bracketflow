import json
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TournamentConfig(BaseModel):
    engine_key: Literal[
        "wsow_br",
        "rebirth_ws",
        "roulette_ws",
        "kill_race_bracket",
        "wsow_classic",
    ] | None = None
    game_mode: Literal["br", "rebirth", "kill_race", "custom"] | None = None
    roster_policy: Literal["fixed_squad", "roulette"] | None = None
    tournament_structure: Literal["cumulative", "single_elim", "double_elim"] | None = None
    lobbySize: int | None = Field(default=None, ge=1)
    bracketMode: Literal["single_elim", "double_elim"] | None = None
    teamSize: Literal[1, 2, 3, 4] | None = None
    bestOf: int | None = Field(default=None, ge=1)
    matchPointThreshold: int | None = Field(default=None, ge=1)
    rouletteGeneratedAt: str | None = None
    rouletteSeed: str | None = None
    rouletteTeamSize: Literal[1, 2, 3, 4] | None = None
    rouletteBench: list[str] | None = None
    rouletteStatus: Literal["generated", "confirmed"] | None = None


class TournamentBase(BaseModel):
    name: str
    game: str
    format: str = "single_elimination"
    team_size: int = 2
    scoring_profile: str = "wsow_like"
    config: TournamentConfig | None = None

    @field_validator("config", mode="before")
    @classmethod
    def parse_config(cls, value):
        if value is None or isinstance(value, dict) or isinstance(value, TournamentConfig):
            return value
        if isinstance(value, str):
            if value.strip() == "":
                return None
            try:
                parsed = json.loads(value)
            except json.JSONDecodeError:
                return None
            return parsed if isinstance(parsed, dict) else None
        return None


class TournamentCreate(TournamentBase):
    pass


class TournamentUpdate(BaseModel):
    name: str | None = None
    game: str | None = None
    format: str | None = None
    team_size: int | None = None
    scoring_profile: str | None = None
    config: TournamentConfig | None = None

    @field_validator("config", mode="before")
    @classmethod
    def parse_config(cls, value):
        return TournamentBase.parse_config(value)


class Tournament(TournamentBase):
    id: int
    status: str

    model_config = ConfigDict(from_attributes=True)


class PlayerCreate(BaseModel):
    nickname: str


class PlayerBulkImport(BaseModel):
    nicknames: list[str]


class PlayerUpdate(BaseModel):
    nickname: str


class Player(BaseModel):
    id: int
    nickname: str
    tournament_id: int

    model_config = ConfigDict(from_attributes=True)


class TeamMember(BaseModel):
    id: int
    team_id: int
    player_id: int
    player: Player

    model_config = ConfigDict(from_attributes=True)


class TeamMemberCreate(BaseModel):
    player_id: int


class TeamCreate(BaseModel):
    name: str


class Team(BaseModel):
    id: int
    name: str
    tournament_id: int
    source: str
    members: list[TeamMember] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class MatchCreate(BaseModel):
    round: int = Field(ge=1)


class Match(BaseModel):
    id: int
    round: int
    status: str
    team_a_id: int | None
    team_b_id: int | None
    winner_id: int | None
    tournament_id: int

    model_config = ConfigDict(from_attributes=True)


class TeamResultUpsert(BaseModel):
    team_id: int
    kills: int = Field(ge=0)
    placement: int = Field(ge=1)


class TeamResult(BaseModel):
    id: int
    tournament_id: int
    match_id: int
    team_id: int
    kills: int
    placement: int
    kill_points: float
    placement_points: float
    total_points: float

    model_config = ConfigDict(from_attributes=True)


class TeamResultDetail(BaseModel):
    id: int
    tournament_id: int
    match_id: int
    round: int
    match_status: str
    team_id: int
    team_name: str
    kills: int
    placement: int
    kill_points: float
    placement_points: float
    total_points: float


class BracketGenerationResult(BaseModel):
    matches_created: int
    status: str


class RouletteGenerationRequest(BaseModel):
    shuffle_seed: str | int | None = None
    seed: str | int | None = None
    reset: bool = True
    confirm: bool = True


class RouletteGenerationResult(BaseModel):
    team_size: int
    teams_created: list[Team]
    bench: list[Player]
    status: str = "confirmed"


class LeaderboardEntry(BaseModel):
    team_id: int
    team_name: str
    matches_played: int
    kills: int
    placement_points: float
    total_points: float
    best_placement: int | None
