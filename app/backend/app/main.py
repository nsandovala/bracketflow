from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from . import crud, schemas
from .database import Base, engine, get_db


Base.metadata.create_all(bind=engine)

app = FastAPI(title="BracketFlow API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_tournament_or_404(db: Session, tournament_id: int):
    tournament = crud.get_tournament(db, tournament_id)
    if tournament is None:
        raise HTTPException(status_code=404, detail="Tournament not found")
    return tournament


def ensure_battle_royale_tournament(tournament) -> None:
    if tournament.format not in crud.BR_FORMATS:
        raise HTTPException(
            status_code=400,
            detail="This endpoint is only available for battle royale tournament formats",
        )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/tournaments", response_model=schemas.Tournament, status_code=status.HTTP_201_CREATED)
def create_tournament(
    tournament: schemas.TournamentCreate,
    db: Session = Depends(get_db),
) -> schemas.Tournament:
    return crud.create_tournament(db, tournament)


@app.get("/tournaments", response_model=list[schemas.Tournament])
def list_tournaments(db: Session = Depends(get_db)) -> list[schemas.Tournament]:
    return crud.get_tournaments(db)


@app.get("/tournaments/{tournament_id}", response_model=schemas.Tournament)
def get_tournament(
    tournament_id: int,
    db: Session = Depends(get_db),
) -> schemas.Tournament:
    return get_tournament_or_404(db, tournament_id)


@app.post(
    "/tournaments/{tournament_id}/teams",
    response_model=schemas.Team,
    status_code=status.HTTP_201_CREATED,
)
def create_team(
    tournament_id: int,
    team: schemas.TeamCreate,
    db: Session = Depends(get_db),
) -> schemas.Team:
    get_tournament_or_404(db, tournament_id)
    created_team = crud.create_team(db, tournament_id, team)
    return crud.get_team(db, created_team.id)


@app.get("/tournaments/{tournament_id}/teams", response_model=list[schemas.Team])
def list_teams(
    tournament_id: int,
    db: Session = Depends(get_db),
) -> list[schemas.Team]:
    get_tournament_or_404(db, tournament_id)
    return crud.get_teams_by_tournament(db, tournament_id)


@app.post(
    "/teams/{team_id}/members",
    response_model=schemas.Team,
    status_code=status.HTTP_201_CREATED,
)
def add_team_member(
    team_id: int,
    payload: schemas.TeamMemberCreate,
    db: Session = Depends(get_db),
) -> schemas.Team:
    team = crud.get_team(db, team_id)
    if team is None:
        raise HTTPException(status_code=404, detail="Team not found")

    player = crud.get_player(db, payload.player_id)
    if player is None:
        raise HTTPException(status_code=404, detail="Player not found")

    if player.tournament_id != team.tournament_id:
        raise HTTPException(
            status_code=400,
            detail="Player does not belong to the same tournament as the team",
        )

    try:
        return crud.add_player_to_team(db, team, player)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post(
    "/tournaments/{tournament_id}/players",
    response_model=schemas.Player,
    status_code=status.HTTP_201_CREATED,
)
def create_player(
    tournament_id: int,
    player: schemas.PlayerCreate,
    db: Session = Depends(get_db),
) -> schemas.Player:
    get_tournament_or_404(db, tournament_id)
    return crud.create_player(db, tournament_id, player)


@app.get("/tournaments/{tournament_id}/players", response_model=list[schemas.Player])
def list_players(
    tournament_id: int,
    db: Session = Depends(get_db),
) -> list[schemas.Player]:
    get_tournament_or_404(db, tournament_id)
    return crud.get_players_by_tournament(db, tournament_id)


@app.post(
    "/tournaments/{tournament_id}/generate-bracket",
    response_model=schemas.BracketGenerationResult,
)
def generate_bracket(
    tournament_id: int,
    db: Session = Depends(get_db),
) -> schemas.BracketGenerationResult:
    tournament = get_tournament_or_404(db, tournament_id)
    if tournament.format != "single_elimination":
        raise HTTPException(
            status_code=400,
            detail="Bracket generation is only available for single_elimination tournaments",
        )

    teams = crud.get_teams_by_tournament(db, tournament_id)
    if len(teams) < 2:
        raise HTTPException(
            status_code=400,
            detail="At least 2 teams are required to generate a bracket",
        )

    matches = crud.get_matches_by_tournament(db, tournament_id)
    if matches:
        raise HTTPException(
            status_code=400,
            detail="Bracket already generated for this tournament",
        )

    created_matches, updated_tournament = crud.generate_bracket(db, tournament)
    return schemas.BracketGenerationResult(
        matches_created=len(created_matches),
        status=updated_tournament.status,
    )


@app.post(
    "/tournaments/{tournament_id}/generate-roulette-teams",
    response_model=schemas.RouletteGenerationResult,
)
def generate_roulette_teams(
    tournament_id: int,
    payload: schemas.RouletteGenerationRequest,
    db: Session = Depends(get_db),
) -> schemas.RouletteGenerationResult:
    tournament = get_tournament_or_404(db, tournament_id)
    ensure_battle_royale_tournament(tournament)

    if payload.team_size not in {2, 3}:
        raise HTTPException(status_code=400, detail="team_size must be 2 or 3")

    players = crud.get_players_by_tournament(db, tournament_id)
    if len(players) < payload.team_size:
        raise HTTPException(
            status_code=400,
            detail="Not enough players to generate roulette teams",
        )

    teams_created, bench, _ = crud.generate_roulette_teams(db, tournament, payload)
    return schemas.RouletteGenerationResult(
        team_size=payload.team_size,
        teams_created=teams_created,
        bench=bench,
    )


@app.post(
    "/tournaments/{tournament_id}/matches",
    response_model=schemas.Match,
    status_code=status.HTTP_201_CREATED,
)
def create_match(
    tournament_id: int,
    match: schemas.MatchCreate,
    db: Session = Depends(get_db),
) -> schemas.Match:
    tournament = get_tournament_or_404(db, tournament_id)
    ensure_battle_royale_tournament(tournament)
    return crud.create_battle_royale_match(db, tournament, match)


@app.post("/matches/{match_id}/results", response_model=schemas.TeamResult)
def upsert_match_result(
    match_id: int,
    payload: schemas.TeamResultUpsert,
    db: Session = Depends(get_db),
) -> schemas.TeamResult:
    match = crud.get_match(db, match_id)
    if match is None:
        raise HTTPException(status_code=404, detail="Match not found")

    tournament = get_tournament_or_404(db, match.tournament_id)
    ensure_battle_royale_tournament(tournament)

    team = crud.get_team(db, payload.team_id)
    if team is None or team.tournament_id != tournament.id:
        raise HTTPException(
            status_code=400,
            detail="Team does not belong to the same tournament as the match",
        )

    if crud.requires_unique_placement(tournament):
        conflict = crud.get_conflicting_placement(
            db, match.id, payload.placement, payload.team_id
        )
        if conflict is not None:
            raise HTTPException(
                status_code=409,
                detail=f"Placement #{payload.placement} ya fue reportado por {conflict.team.name}.",
            )

    return crud.upsert_team_result(db, tournament, match, payload)


@app.get(
    "/tournaments/{tournament_id}/results",
    response_model=list[schemas.TeamResultDetail],
)
def list_tournament_results(
    tournament_id: int,
    db: Session = Depends(get_db),
) -> list[schemas.TeamResultDetail]:
    tournament = get_tournament_or_404(db, tournament_id)
    ensure_battle_royale_tournament(tournament)
    return crud.get_team_result_details_by_tournament(db, tournament)


@app.get("/tournaments/{tournament_id}/matches", response_model=list[schemas.Match])
def list_matches(
    tournament_id: int,
    db: Session = Depends(get_db),
) -> list[schemas.Match]:
    get_tournament_or_404(db, tournament_id)
    return crud.get_matches_by_tournament(db, tournament_id)


@app.get(
    "/tournaments/{tournament_id}/leaderboard",
    response_model=list[schemas.LeaderboardEntry],
)
def get_leaderboard(
    tournament_id: int,
    db: Session = Depends(get_db),
) -> list[schemas.LeaderboardEntry]:
    tournament = get_tournament_or_404(db, tournament_id)
    ensure_battle_royale_tournament(tournament)
    return crud.get_leaderboard(db, tournament)
