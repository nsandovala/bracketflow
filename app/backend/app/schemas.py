from pydantic import BaseModel, ConfigDict, Field


class TournamentBase(BaseModel):
    name: str
    game: str
    format: str = "single_elimination"
    team_size: int = 2
    scoring_profile: str = "wsow_like"


class TournamentCreate(TournamentBase):
    pass


class Tournament(TournamentBase):
    id: int
    status: str

    model_config = ConfigDict(from_attributes=True)


class PlayerCreate(BaseModel):
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
    team_size: int = 2
    seed: str | None = None
    reset: bool = True


class RouletteGenerationResult(BaseModel):
    team_size: int
    teams_created: list[Team]
    bench: list[Player]


class LeaderboardEntry(BaseModel):
    team_id: int
    team_name: str
    matches_played: int
    kills: int
    placement_points: float
    total_points: float
    best_placement: int | None
