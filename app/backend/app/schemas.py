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


class RespinWindowOpen(BaseModel):
    duration_minutes: int = Field(ge=3, le=5)


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
    roster_status: Literal["participants_pending", "respin_open", "locked"]
    roster_respin_deadline_at: str | None
    roster_locked_at: str | None
    bracket_status: Literal["pending", "respin_open", "locked", "running", "completed"]
    bracket_respin_deadline_at: str | None
    bracket_locked_at: str | None

    model_config = ConfigDict(from_attributes=True)


def _validate_nickname(value: str) -> str:
    stripped = value.strip()
    if len(stripped) < 2:
        raise ValueError("El nickname debe tener al menos 2 caracteres.")
    if "," in stripped or ";" in stripped or "\t" in stripped:
        raise ValueError("El nickname no puede contener comas, puntos y coma ni tabs internos.")
    return stripped


class PlayerCreate(BaseModel):
    nickname: str


class PlayerBulkImport(BaseModel):
    nicknames: list[str]


class PlayerUpdate(BaseModel):
    nickname: str

    @field_validator("nickname")
    @classmethod
    def check_nickname(cls, v: str) -> str:
        return _validate_nickname(v)


class Player(BaseModel):
    id: int
    nickname: str
    display_name: str | None = None
    activision_id: str | None = None
    tournament_id: int

    model_config = ConfigDict(from_attributes=True)


class ParticipantImportRequest(BaseModel):
    rows: list[str]
    confirm: bool = False


class ParticipantImportAccepted(BaseModel):
    line: int
    raw: str
    display_name: str
    activision_id: str | None = None


class ParticipantImportRejected(BaseModel):
    line: int
    raw: str
    reason: str


class ParticipantImportResult(BaseModel):
    accepted: list[ParticipantImportAccepted]
    rejected: list[ParticipantImportRejected]
    persisted_count: int = 0


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


class MatchMap(BaseModel):
    id: int
    match_id: int
    map_number: int
    kills_a: int
    kills_b: int
    map_winner_id: int | None

    model_config = ConfigDict(from_attributes=True)


class Match(BaseModel):
    id: int
    round: int
    status: str
    team_a_id: int | None
    team_b_id: int | None
    winner_id: int | None
    best_of: int
    next_match_id: int | None
    next_slot: str | None
    tournament_id: int
    maps: list[MatchMap] = Field(default_factory=list)
    maps_won_a: int = 0
    maps_won_b: int = 0

    model_config = ConfigDict(from_attributes=True)


class TeamResultUpsert(BaseModel):
    team_id: int
    kills: int = Field(ge=0)
    placement: int = Field(ge=1)


class MapResultUpsert(BaseModel):
    match_id: int
    map_number: int = Field(ge=1)
    kills_a: int = Field(ge=0)
    kills_b: int = Field(ge=0)


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
