import json
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


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
    rouletteRespinCount: int | None = Field(default=None, ge=0)
    rouletteLastSpinAt: str | None = None
    rouletteRosterTimerState: Literal["idle", "running", "closed"] | None = None
    rouletteRosterDurationSeconds: int | None = Field(default=None, ge=1, le=240)
    championTeamId: int | None = Field(default=None, ge=1)
    championDecidedAt: str | None = None


class RespinWindowOpen(BaseModel):
    duration_seconds: int | None = Field(default=None, ge=1, le=240)
    duration_minutes: int | None = Field(default=None, ge=1, le=5)

    @model_validator(mode="after")
    def validate_duration(self) -> "RespinWindowOpen":
        if self.duration_seconds is None and self.duration_minutes is None:
            self.duration_seconds = 180
        return self

    def resolve_duration_seconds(self) -> int:
        if self.duration_seconds is not None:
            return self.duration_seconds
        if self.duration_minutes is not None:
            return self.duration_minutes * 60
        return 180


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


class TeamResultPlayerStat(BaseModel):
    player_name: str
    kills: int = Field(ge=0)

    model_config = ConfigDict(from_attributes=True)

    @field_validator("player_name")
    @classmethod
    def check_player_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("player_name no puede estar vacío.")
        return stripped


class TeamResultUpsert(BaseModel):
    team_id: int
    kills: int = Field(ge=0)
    placement: int = Field(ge=1)
    # Desglose opcional por player. El score sigue saliendo de kills/placement
    # del equipo; esto es detalle y debe sumar exactamente las kills del equipo.
    player_stats: list[TeamResultPlayerStat] | None = None


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
    player_stats: list[TeamResultPlayerStat] = Field(default_factory=list)

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
    player_stats: list[TeamResultPlayerStat] = Field(default_factory=list)


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


# ---------------------------------------------------------------------------
# Identity metadata v0 — perfiles opcionales de jugador/equipo y game handles.
# Aditivo: no altera schemas de scoring, reports ni tournaments existentes.
# ---------------------------------------------------------------------------


def _validate_identity_display_name(value: str) -> str:
    stripped = value.strip()
    if len(stripped) < 2:
        raise ValueError("display_name debe tener al menos 2 caracteres.")
    return stripped


def _validate_optional_str(value: str | None, *, max_length: int | None = None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    if not stripped:
        return None
    if max_length is not None and len(stripped) > max_length:
        raise ValueError(f"El campo excede el máximo de {max_length} caracteres.")
    return stripped


VERIFIED_STATUSES = ("unverified", "self_reported", "verified")


class PlayerProfileCreate(BaseModel):
    display_name: str
    short_name: str | None = None
    country: str | None = None
    avatar_url: str | None = None
    notes: str | None = None

    @field_validator("display_name")
    @classmethod
    def check_display_name(cls, value: str) -> str:
        return _validate_identity_display_name(value)

    @field_validator("short_name")
    @classmethod
    def check_short_name(cls, value: str | None) -> str | None:
        return _validate_optional_str(value, max_length=24)

    @field_validator("country")
    @classmethod
    def check_country(cls, value: str | None) -> str | None:
        return _validate_optional_str(value, max_length=48)

    @field_validator("avatar_url")
    @classmethod
    def check_avatar_url(cls, value: str | None) -> str | None:
        return _validate_optional_str(value, max_length=500)

    @field_validator("notes")
    @classmethod
    def check_notes(cls, value: str | None) -> str | None:
        return _validate_optional_str(value)


class PlayerProfile(BaseModel):
    id: int
    display_name: str
    short_name: str | None
    country: str | None
    avatar_url: str | None
    notes: str | None
    created_at: str
    updated_at: str

    model_config = ConfigDict(from_attributes=True)


class TeamProfileCreate(BaseModel):
    display_name: str
    short_name: str | None = None
    logo_url: str | None = None
    primary_color: str | None = None
    secondary_color: str | None = None
    notes: str | None = None

    @field_validator("display_name")
    @classmethod
    def check_display_name(cls, value: str) -> str:
        return _validate_identity_display_name(value)

    @field_validator("short_name")
    @classmethod
    def check_short_name(cls, value: str | None) -> str | None:
        return _validate_optional_str(value, max_length=24)

    @field_validator("logo_url")
    @classmethod
    def check_logo_url(cls, value: str | None) -> str | None:
        return _validate_optional_str(value, max_length=500)

    @field_validator("primary_color", "secondary_color")
    @classmethod
    def check_color(cls, value: str | None) -> str | None:
        return _validate_optional_str(value, max_length=32)

    @field_validator("notes")
    @classmethod
    def check_notes(cls, value: str | None) -> str | None:
        return _validate_optional_str(value)


class TeamProfile(BaseModel):
    id: int
    display_name: str
    short_name: str | None
    logo_url: str | None
    primary_color: str | None
    secondary_color: str | None
    notes: str | None
    created_at: str
    updated_at: str

    model_config = ConfigDict(from_attributes=True)


class PlayerGameIdentityCreate(BaseModel):
    player_profile_id: int = Field(ge=1)
    game: str
    game_handle: str
    game_id: str | None = None
    platform: str | None = None
    region: str | None = None
    verified_status: Literal["unverified", "self_reported", "verified"] = "unverified"

    @field_validator("game")
    @classmethod
    def check_game(cls, value: str) -> str:
        stripped = value.strip()
        if len(stripped) < 2:
            raise ValueError("game es requerido (min 2 chars).")
        return stripped

    @field_validator("game_handle")
    @classmethod
    def check_game_handle(cls, value: str) -> str:
        stripped = value.strip()
        if len(stripped) < 2:
            raise ValueError("game_handle es requerido (min 2 chars).")
        return stripped

    @field_validator("game_id", "platform", "region")
    @classmethod
    def check_optional_short(cls, value: str | None) -> str | None:
        return _validate_optional_str(value, max_length=64)


class PlayerGameIdentity(BaseModel):
    id: int
    player_profile_id: int
    game: str
    game_handle: str
    game_id: str | None
    platform: str | None
    region: str | None
    verified_status: str
    created_at: str
    updated_at: str

    model_config = ConfigDict(from_attributes=True)
