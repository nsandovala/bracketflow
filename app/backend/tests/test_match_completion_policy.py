import json

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import crud, models, schemas
from app.database import Base
from app.main import create_match


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


def create_legacy_wsow(db_session):
    tournament = models.Tournament(
        name="WS PRACTICE GEDEON ESPORT",
        game="Warzone",
        status="running",
        format="battle_royale_points",
        team_size=3,
        scoring_profile="wsow_like",
        config=None,
    )
    db_session.add(tournament)
    db_session.commit()
    db_session.refresh(tournament)
    return tournament


def add_completed_match_with_unique_leader(db_session, tournament, *, round_number=1):
    alpha = crud.create_team(
        db_session, tournament.id, schemas.TeamCreate(name="TEAM VITO")
    )
    bravo = crud.create_team(
        db_session, tournament.id, schemas.TeamCreate(name="TEAM BRAVO")
    )
    match = crud.create_battle_royale_match(
        db_session,
        tournament,
        schemas.MatchCreate(round=round_number),
    )
    db_session.add_all(
        [
            models.TeamResult(
                tournament_id=tournament.id,
                match_id=match.id,
                team_id=alpha.id,
                kills=70,
                placement=36,
            ),
            models.TeamResult(
                tournament_id=tournament.id,
                match_id=match.id,
                team_id=bravo.id,
                kills=30,
                placement=36,
            ),
        ]
    )
    match.status = "completed"
    db_session.commit()
    return match, alpha, bravo


def test_new_wsow_creation_persists_default_threshold(db_session):
    tournament = crud.create_tournament(
        db_session,
        schemas.TournamentCreate(
            name="New WSOW",
            game="Warzone",
            format="battle_royale_points",
            team_size=3,
            scoring_profile="wsow_like",
            config=schemas.TournamentConfig(
                engine_key="wsow_br",
                game_mode="br",
                roster_policy="fixed_squad",
                tournament_structure="cumulative",
                teamSize=3,
                lobbySize=50,
            ),
        ),
    )

    config = json.loads(tournament.config)
    assert config["matchPointEnabled"] is True
    assert config["matchPointThreshold"] == 125


def test_legacy_wsow_missing_threshold_returns_explicit_policy(db_session):
    tournament = create_legacy_wsow(db_session)

    policy = crud.get_match_completion_policy(db_session, tournament)

    assert policy.state == "match_point_not_configured"
    assert policy.action == "configure_match_point"
    assert policy.code == "MATCH_POINT_NOT_CONFIGURED"
    assert policy.supportsMatchPoint is True
    assert policy.matchPointEnabled is True
    assert policy.matchPointThreshold is None


def test_missing_threshold_is_not_interpreted_as_disabled(db_session):
    missing = create_legacy_wsow(db_session)
    disabled = models.Tournament(
        name="Explicit disabled",
        game="Warzone",
        status="running",
        format="battle_royale_points",
        team_size=3,
        scoring_profile="wsow_like",
        config=json.dumps({"matchPointEnabled": False}),
    )
    unsupported = models.Tournament(
        name="Kill Race",
        game="Warzone",
        status="running",
        format="roulette_2v2",
        team_size=2,
        scoring_profile="kill_race",
        config=json.dumps({"engine_key": "kill_race_bracket"}),
    )
    db_session.add_all([disabled, unsupported])
    db_session.commit()

    missing_policy = crud.get_match_completion_policy(db_session, missing)
    disabled_policy = crud.get_match_completion_policy(db_session, disabled)
    unsupported_policy = crud.get_match_completion_policy(db_session, unsupported)

    assert missing_policy.code == "MATCH_POINT_NOT_CONFIGURED"
    assert disabled_policy.state == "disabled"
    assert disabled_policy.code == "MATCH_POINT_DISABLED"
    assert unsupported_policy.state == "unsupported"
    assert unsupported_policy.code == "MATCH_POINT_UNSUPPORTED"


def test_explicit_threshold_update_persists_125(db_session):
    tournament = create_legacy_wsow(db_session)

    policy = crud.configure_match_point(db_session, tournament, 125)

    db_session.refresh(tournament)
    assert json.loads(tournament.config)["matchPointThreshold"] == 125
    assert policy.matchPointThreshold == 125
    assert policy.state == "active"


def test_threshold_configuration_reevaluates_completed_matches(db_session):
    tournament = create_legacy_wsow(db_session)
    _, alpha, _ = add_completed_match_with_unique_leader(db_session, tournament)

    policy = crud.configure_match_point(db_session, tournament, 50)

    assert policy.state == "completed"
    assert policy.championTeamId == alpha.id
    assert tournament.status == "completed"


def test_unique_leader_over_threshold_becomes_champion_after_empty_latest_removed(
    db_session,
):
    tournament = create_legacy_wsow(db_session)
    _, alpha, _ = add_completed_match_with_unique_leader(db_session, tournament)
    empty_latest = crud.create_battle_royale_match(
        db_session, tournament, schemas.MatchCreate(round=2)
    )
    empty_latest_id = empty_latest.id

    configured = crud.configure_match_point(db_session, tournament, 50)
    assert configured.state == "threshold_reached"
    assert configured.action == "remove_empty_latest_match"
    assert tournament.status != "completed"

    result = crud.remove_empty_latest_match(db_session, tournament, empty_latest)

    assert result.removedMatchId == empty_latest_id
    assert result.matchCompletionPolicy.state == "completed"
    assert result.matchCompletionPolicy.championTeamId == alpha.id
    assert tournament.status == "completed"


def test_champion_blocks_next_match_with_coded_409(db_session):
    tournament = create_legacy_wsow(db_session)
    _, _, _ = add_completed_match_with_unique_leader(db_session, tournament)
    crud.configure_match_point(db_session, tournament, 50)

    with pytest.raises(HTTPException) as exc:
        create_match(
            tournament.id,
            schemas.MatchCreate(round=2),
            db_session,
        )

    assert exc.value.status_code == 409
    assert exc.value.detail["code"] == "TOURNAMENT_COMPLETED"
    assert exc.value.detail["action"] == "tournament_completed"


def test_latest_empty_match_can_be_removed_safely(db_session):
    tournament = create_legacy_wsow(db_session)
    first = crud.create_battle_royale_match(
        db_session, tournament, schemas.MatchCreate(round=1)
    )
    latest = crud.create_battle_royale_match(
        db_session, tournament, schemas.MatchCreate(round=2)
    )
    latest_id = latest.id

    result = crud.remove_empty_latest_match(db_session, tournament, latest)

    assert result.removedMatchId == latest_id
    assert crud.get_match(db_session, latest_id) is None
    assert crud.get_match(db_session, first.id) is not None


def test_match_containing_reports_cannot_be_removed(db_session):
    tournament = create_legacy_wsow(db_session)
    match = crud.create_battle_royale_match(
        db_session, tournament, schemas.MatchCreate(round=1)
    )
    team = crud.create_team(
        db_session, tournament.id, schemas.TeamCreate(name="Reported")
    )
    db_session.add(
        models.TeamResult(
            tournament_id=tournament.id,
            match_id=match.id,
            team_id=team.id,
            kills=1,
            placement=1,
        )
    )
    db_session.commit()

    with pytest.raises(ValueError, match="reportes oficiales"):
        crud.remove_empty_latest_match(db_session, tournament, match)

    assert crud.get_match(db_session, match.id) is not None


def test_non_latest_match_cannot_be_removed(db_session):
    tournament = create_legacy_wsow(db_session)
    first = crud.create_battle_royale_match(
        db_session, tournament, schemas.MatchCreate(round=1)
    )
    latest = crud.create_battle_royale_match(
        db_session, tournament, schemas.MatchCreate(round=2)
    )

    with pytest.raises(ValueError, match="ultima partida"):
        crud.remove_empty_latest_match(db_session, tournament, first)

    assert crud.get_match(db_session, first.id) is not None
    assert crud.get_match(db_session, latest.id) is not None
