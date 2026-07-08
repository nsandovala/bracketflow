from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from . import crud, schemas
from .database import Base, engine, ensure_sqlite_schema, get_db


Base.metadata.create_all(bind=engine)
ensure_sqlite_schema()

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
    if not crud.is_wsow_like_tournament(tournament):
        raise HTTPException(
            status_code=400,
            detail="This endpoint is only available for standings-based WSOW-like tournaments",
        )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/tournaments", response_model=schemas.Tournament, status_code=status.HTTP_201_CREATED)
def create_tournament(
    tournament: schemas.TournamentCreate,
    db: Session = Depends(get_db),
) -> schemas.Tournament:
    try:
        return crud.create_tournament(db, tournament)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.get("/tournaments", response_model=list[schemas.Tournament])
def list_tournaments(db: Session = Depends(get_db)) -> list[schemas.Tournament]:
    return crud.get_tournaments(db)


@app.get("/tournaments/{tournament_id}", response_model=schemas.Tournament)
def get_tournament(
    tournament_id: int,
    db: Session = Depends(get_db),
) -> schemas.Tournament:
    return get_tournament_or_404(db, tournament_id)


@app.patch("/tournaments/{tournament_id}", response_model=schemas.Tournament)
def update_tournament(
    tournament_id: int,
    payload: schemas.TournamentUpdate,
    db: Session = Depends(get_db),
) -> schemas.Tournament:
    tournament = get_tournament_or_404(db, tournament_id)
    try:
        return crud.update_tournament(db, tournament, payload)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/tournaments/{tournament_id}/archive", response_model=schemas.Tournament)
def archive_tournament(
    tournament_id: int,
    db: Session = Depends(get_db),
) -> schemas.Tournament:
    tournament = get_tournament_or_404(db, tournament_id)
    return crud.archive_tournament(db, tournament)


@app.delete("/tournaments/{tournament_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tournament(
    tournament_id: int,
    db: Session = Depends(get_db),
) -> None:
    tournament = get_tournament_or_404(db, tournament_id)
    crud.delete_tournament(db, tournament)
    return None


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
    try:
        created = crud.create_players_bulk(db, tournament_id, [player.nickname])
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    if not created:
        raise HTTPException(status_code=400, detail="Ese participante ya existe en el torneo.")
    return created[0]


@app.post(
    "/tournaments/{tournament_id}/players/bulk",
    response_model=list[schemas.Player],
    status_code=status.HTTP_201_CREATED,
)
def bulk_import_players(
    tournament_id: int,
    payload: schemas.PlayerBulkImport,
    db: Session = Depends(get_db),
) -> list[schemas.Player]:
    get_tournament_or_404(db, tournament_id)
    return crud.create_players_bulk(db, tournament_id, payload.nicknames)


@app.post(
    "/tournaments/{tournament_id}/players/import",
    response_model=schemas.ParticipantImportResult,
)
def import_players_preview(
    tournament_id: int,
    payload: schemas.ParticipantImportRequest,
    db: Session = Depends(get_db),
) -> schemas.ParticipantImportResult:
    get_tournament_or_404(db, tournament_id)
    result = (
        crud.import_participant_rows(db, tournament_id, payload.rows)
        if payload.confirm
        else crud.preview_participant_rows(db, tournament_id, payload.rows)
    )
    return schemas.ParticipantImportResult(
        accepted=result["accepted"],
        rejected=result["rejected"],
        persisted_count=int(result.get("persisted_count", 0)),
    )


@app.get("/tournaments/{tournament_id}/players", response_model=list[schemas.Player])
def list_players(
    tournament_id: int,
    db: Session = Depends(get_db),
) -> list[schemas.Player]:
    get_tournament_or_404(db, tournament_id)
    return crud.get_players_by_tournament(db, tournament_id)


@app.delete("/tournaments/{tournament_id}/players", status_code=status.HTTP_204_NO_CONTENT)
def clear_players(
    tournament_id: int,
    db: Session = Depends(get_db),
) -> None:
    tournament = get_tournament_or_404(db, tournament_id)
    try:
        crud.clear_players_if_unlocked(db, tournament)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return None


@app.patch("/players/{player_id}", response_model=schemas.Player)
def update_player(
    player_id: int,
    payload: schemas.PlayerUpdate,
    db: Session = Depends(get_db),
) -> schemas.Player:
    player = crud.get_player(db, player_id)
    if player is None:
        raise HTTPException(status_code=404, detail="Player not found")
    try:
        return crud.update_player(db, player, payload)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.delete("/players/{player_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_player(
    player_id: int,
    db: Session = Depends(get_db),
) -> None:
    player = crud.get_player(db, player_id)
    if player is None:
        raise HTTPException(status_code=404, detail="Player not found")
    try:
        crud.delete_player(db, player)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return None


@app.post(
    "/tournaments/{tournament_id}/generate-bracket",
    response_model=schemas.BracketGenerationResult,
)
def generate_bracket(
    tournament_id: int,
    db: Session = Depends(get_db),
) -> schemas.BracketGenerationResult:
    tournament = get_tournament_or_404(db, tournament_id)
    engine_key = crud.get_engine_key(tournament)
    bracket_mode = crud.read_tournament_config(tournament).get("bracketMode")
    if engine_key != "kill_race_bracket":
        raise HTTPException(
            status_code=400,
            detail="Bracket generation is only available for Kill Race tournaments",
        )
    if bracket_mode == "double_elim":
        raise HTTPException(
            status_code=400,
            detail="Double elimination todavia no esta implementado para Kill Race.",
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

    try:
        created_matches, updated_tournament = crud.generate_bracket(db, tournament)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return schemas.BracketGenerationResult(
        matches_created=len(created_matches),
        status=updated_tournament.status,
    )


@app.post("/tournaments/{tournament_id}/roster-respin/open", response_model=schemas.Tournament)
def open_roster_respin(
    tournament_id: int,
    payload: schemas.RespinWindowOpen,
    db: Session = Depends(get_db),
) -> schemas.Tournament:
    tournament = get_tournament_or_404(db, tournament_id)
    try:
        return crud.open_roster_respin(db, tournament, payload.resolve_duration_seconds())
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@app.post("/tournaments/{tournament_id}/roster-respin/close", response_model=schemas.Tournament)
def close_roster_respin(
    tournament_id: int,
    db: Session = Depends(get_db),
) -> schemas.Tournament:
    tournament = get_tournament_or_404(db, tournament_id)
    try:
        return crud.close_roster_respin(db, tournament)
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@app.post("/tournaments/{tournament_id}/roster-respin/lock", response_model=schemas.Tournament)
def lock_roster_respin(
    tournament_id: int,
    db: Session = Depends(get_db),
) -> schemas.Tournament:
    tournament = get_tournament_or_404(db, tournament_id)
    try:
        return crud.lock_roster(db, tournament)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post("/tournaments/{tournament_id}/bracket-respin/open", response_model=schemas.Tournament)
def open_bracket_respin(
    tournament_id: int,
    payload: schemas.RespinWindowOpen,
    db: Session = Depends(get_db),
) -> schemas.Tournament:
    tournament = get_tournament_or_404(db, tournament_id)
    try:
        return crud.open_bracket_respin(db, tournament, payload.duration_minutes)
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@app.post("/tournaments/{tournament_id}/bracket-respin/lock", response_model=schemas.Tournament)
def lock_bracket_respin(
    tournament_id: int,
    db: Session = Depends(get_db),
) -> schemas.Tournament:
    tournament = get_tournament_or_404(db, tournament_id)
    try:
        return crud.lock_bracket(db, tournament)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


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
    if not crud.requires_roulette(tournament):
        raise HTTPException(
            status_code=400,
            detail="Roulette teams are only available for roulette tournament engines",
        )

    try:
        teams_created, bench, _ = crud.generate_roulette_teams(db, tournament, payload)
        team_size = crud.resolve_roulette_team_size(tournament)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return schemas.RouletteGenerationResult(
        team_size=team_size,
        teams_created=teams_created,
        bench=bench,
        status="confirmed" if payload.confirm else "generated",
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
    if crud.requires_roulette(tournament) and not crud.get_teams_by_tournament(db, tournament_id):
        raise HTTPException(
            status_code=400,
            detail="Ruleta requerida: carga participantes para generar equipos antes de operar.",
        )
    return crud.build_match_schema(crud.create_battle_royale_match(db, tournament, match))


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
        lobby_size = crud.get_effective_lobby_size(tournament)
        if lobby_size is not None and payload.placement > lobby_size:
            raise HTTPException(
                status_code=400,
                detail=f"Placement must be between 1 and {lobby_size}",
            )
        conflict = crud.get_conflicting_placement(
            db, match.id, payload.placement, payload.team_id
        )
        if conflict is not None:
            raise HTTPException(
                status_code=409,
                detail=f"Placement #{payload.placement} ya fue reportado por {conflict.team.name}.",
            )

    return crud.upsert_team_result(db, tournament, match, payload)


@app.post("/matches/{match_id}/maps", response_model=schemas.Match)
def upsert_match_map(
    match_id: int,
    payload: schemas.MapResultUpsert,
    db: Session = Depends(get_db),
) -> schemas.Match:
    match = crud.get_match(db, match_id)
    if match is None:
        raise HTTPException(status_code=404, detail="Match not found")

    tournament = get_tournament_or_404(db, match.tournament_id)
    if crud.get_engine_key(tournament) != "kill_race_bracket":
        raise HTTPException(
            status_code=400,
            detail="This endpoint is only available for Kill Race tournaments",
        )

    try:
        return crud.upsert_map_result(db, tournament, match, payload)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


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
    return [crud.build_match_schema(match) for match in crud.get_matches_by_tournament(db, tournament_id)]


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
