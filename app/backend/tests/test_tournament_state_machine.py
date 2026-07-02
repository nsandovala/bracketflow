import json

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import crud, schemas
from app.database import Base


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()


def create_roulette_tournament(
    db_session,
    *,
    engine_key: str = "roulette_ws",
    game_mode: str = "rebirth",
    team_size: int = 3,
):
    scoring_profile = "kill_race" if engine_key == "kill_race_bracket" else "wsow_like"
    tournament_structure = "single_elim" if engine_key == "kill_race_bracket" else "cumulative"
    legacy_format = "roulette_3v3" if team_size == 3 else "roulette_2v2"
    return crud.create_tournament(
        db_session,
        schemas.TournamentCreate(
            name=f"State {engine_key}",
            game="Warzone",
            format=legacy_format,
            team_size=team_size,
            scoring_profile=scoring_profile,
            config=schemas.TournamentConfig(
                engine_key=engine_key,
                game_mode=game_mode,
                roster_policy="roulette",
                tournament_structure=tournament_structure,
                teamSize=team_size,
                bestOf=3 if engine_key == "kill_race_bracket" else None,
                bracketMode="single_elim" if engine_key == "kill_race_bracket" else None,
            ),
        ),
    )


def import_players(db_session, tournament_id: int, names: list[str]):
    result = crud.import_participant_rows(db_session, tournament_id, names)
    assert result["rejected"] == []
    return result


def read_config_value(tournament, key: str):
    config = json.loads(tournament.config) if tournament.config else {}
    return config.get(key)


def test_respin_window_accepts_seconds_and_exposes_timer_state():
    payload = schemas.RespinWindowOpen(duration_seconds=180)

    assert payload.resolve_duration_seconds() == 180


def test_close_roster_respin_is_idempotent_and_persists_closed_state(db_session):
    tournament = create_roulette_tournament(db_session)

    opened = crud.open_roster_respin(db_session, tournament, 180)
    closed = crud.close_roster_respin(db_session, opened)
    closed_again = crud.close_roster_respin(db_session, closed)
    reloaded = crud.get_tournament(db_session, tournament.id)

    assert read_config_value(closed, "rouletteRosterTimerState") == "closed"
    assert read_config_value(closed_again, "rouletteRosterTimerState") == "closed"
    assert read_config_value(reloaded, "rouletteRosterTimerState") == "closed"
    assert reloaded.roster_status == crud.ROSTER_PENDING
    assert reloaded.roster_respin_deadline_at is None


def test_generate_roulette_teams_allows_idle_timer(db_session):
    tournament = create_roulette_tournament(db_session)
    import_players(db_session, tournament.id, ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot"])

    teams, bench, updated_tournament = crud.generate_roulette_teams(
        db_session,
        tournament,
        schemas.RouletteGenerationRequest(confirm=False, reset=True, shuffle_seed="idle-spin"),
    )

    assert len(teams) == 2
    assert bench == []
    assert updated_tournament.status == "teams_generated"


def test_generate_roulette_teams_blocks_closed_timer(db_session):
    tournament = create_roulette_tournament(db_session)
    import_players(db_session, tournament.id, ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot"])

    opened = crud.open_roster_respin(db_session, tournament, 180)
    closed = crud.close_roster_respin(db_session, opened)

    with pytest.raises(ValueError, match="respin"):
        crud.generate_roulette_teams(
            db_session,
            closed,
            schemas.RouletteGenerationRequest(confirm=False, reset=True, shuffle_seed="closed-spin"),
        )


def test_kill_race_chain_generates_bracket_after_opening_bracket_respin(db_session):
    tournament = create_roulette_tournament(
        db_session,
        engine_key="kill_race_bracket",
        game_mode="kill_race",
        team_size=2,
    )
    import_players(db_session, tournament.id, ["alpha", "bravo", "charlie", "delta"])

    crud.generate_roulette_teams(
        db_session,
        tournament,
        schemas.RouletteGenerationRequest(confirm=False, reset=True, shuffle_seed="kill-race"),
    )
    locked_roster = crud.lock_roster(db_session, crud.get_tournament(db_session, tournament.id))

    with pytest.raises(ValueError, match="respin de bracket"):
        crud.generate_bracket(db_session, locked_roster)

    opened_bracket = crud.open_bracket_respin(db_session, locked_roster, 3)
    matches, updated_tournament = crud.generate_bracket(db_session, opened_bracket)

    assert len(matches) == 1
    assert updated_tournament.status == "bracket_generated"
