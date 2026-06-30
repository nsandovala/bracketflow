"""Regresion del scoring WSOW (BF-003, BF-005).

Blinda la tabla fija por bandas que reemplazo la interpolacion
2.0 - ((placement-1)/(team_count-1)), la cual producia multiplicadores
y puntos negativos cuando placement > equipos inscritos.
"""

import json

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import schemas
from app.crud import (
    calculate_points,
    create_battle_royale_match,
    create_players_bulk,
    create_tournament,
    generate_roulette_teams,
    get_effective_format,
    get_effective_lobby_size,
    get_placement_multiplier,
    get_rebirth_placement_multiplier,
    is_wsow_like_tournament,
    requires_unique_placement,
    resolve_roulette_team_size,
    upsert_team_result,
    validate_tournament_contract,
)
from app.database import Base
from app.models import Tournament

WORLD_SERIES_FORMAT = "battle_royale_points"


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


@pytest.mark.parametrize(
    "placement, expected",
    [
        (1, 2.0),
        (2, 1.8),
        (5, 1.8),
        (6, 1.6),
        (10, 1.6),
        (11, 1.4),
        (20, 1.4),
        (21, 1.2),
        (35, 1.2),
        (36, 1.0),
        (100, 1.0),  # clamp: jamas por debajo del minimo
    ],
)
def test_placement_multiplier_bands(placement, expected):
    assert get_placement_multiplier(placement) == expected


@pytest.mark.parametrize("placement", [0, -1])
def test_placement_multiplier_invalid_raises(placement):
    with pytest.raises(ValueError):
        get_placement_multiplier(placement)


def test_calculate_points_world_series_never_negative():
    kill_points, multiplier, total_points = calculate_points(
        WORLD_SERIES_FORMAT, kills=12, placement=7
    )
    assert kill_points == 12.0
    assert multiplier == 1.6
    assert total_points == 19.2
    assert total_points >= 0


@pytest.mark.parametrize(
    "placement, expected",
    [
        (1, 1.6),
        (2, 1.4),
        (5, 1.4),
        (6, 1.2),
        (10, 1.2),
        (11, 1.0),
        (17, 1.0),
    ],
)
def test_rebirth_placement_multiplier_bands(placement, expected):
    assert get_rebirth_placement_multiplier(placement) == expected


def test_calculate_points_rebirth_uses_rebirth_multiplier():
    kill_points, multiplier, total_points = calculate_points(
        WORLD_SERIES_FORMAT, kills=10, placement=1, engine_key="rebirth_ws"
    )
    assert kill_points == 10.0
    assert multiplier == 1.6
    assert total_points == 16.0


def test_unique_placement_guard_only_applies_to_wsow_like_world_series():
    world_series = Tournament(
        name="WS",
        game="Warzone",
        format="battle_royale_points",
        team_size=2,
        scoring_profile="wsow_like",
    )
    kill_race = Tournament(
        name="Kill Race",
        game="Warzone",
        format="roulette_2v2",
        team_size=2,
        scoring_profile="kill_race",
    )

    assert requires_unique_placement(world_series) is True
    assert requires_unique_placement(kill_race) is False
    assert is_wsow_like_tournament(world_series) is True
    assert is_wsow_like_tournament(kill_race) is False


def test_roulette_ws_engine_uses_wsow_scoring_even_with_legacy_format():
    tournament = Tournament(
        name="Roulette WS",
        game="Warzone",
        format="roulette_2v2",
        team_size=2,
        scoring_profile="wsow_like",
        config=json.dumps({"engine_key": "roulette_ws", "roster_policy": "roulette"}),
    )

    assert get_effective_format(tournament) == "battle_royale_points"
    assert requires_unique_placement(tournament) is True


def test_kill_race_engine_does_not_require_unique_placement():
    tournament = Tournament(
        name="Kill Race",
        game="Warzone",
        format="roulette_3v3",
        team_size=3,
        scoring_profile="kill_race",
        config=json.dumps({"engine_key": "kill_race_bracket"}),
    )

    assert get_effective_format(tournament) == "roulette_3v3"
    assert requires_unique_placement(tournament) is False


def test_rebirth_contract_rejects_four_player_roster():
    with pytest.raises(ValueError, match="team_size=3"):
        validate_tournament_contract(
            engine_key="rebirth_ws",
            scoring_profile="wsow_like",
            team_size=4,
            config={
                "engine_key": "rebirth_ws",
                "game_mode": "rebirth",
                "roster_policy": "fixed_squad",
                "tournament_structure": "cumulative",
                "teamSize": 4,
                "lobbySize": 16,
            },
        )


def test_kill_race_contract_rejects_lobby_and_match_point():
    with pytest.raises(ValueError, match="Kill Race cannot receive"):
        validate_tournament_contract(
            engine_key="kill_race_bracket",
            scoring_profile="kill_race",
            team_size=2,
            config={
                "engine_key": "kill_race_bracket",
                "game_mode": "kill_race",
                "roster_policy": "roulette",
                "tournament_structure": "single_elim",
                "teamSize": 2,
                "lobbySize": 16,
                "matchPointThreshold": 125,
            },
        )


def test_wsow_contract_rejects_elimination_structure():
    with pytest.raises(ValueError, match="single/double"):
        validate_tournament_contract(
            engine_key="wsow_br",
            scoring_profile="wsow_like",
            team_size=4,
            config={
                "engine_key": "wsow_br",
                "game_mode": "br",
                "roster_policy": "fixed_squad",
                "tournament_structure": "single_elim",
                "teamSize": 4,
                "lobbySize": 50,
                "matchPointThreshold": 125,
            },
        )


def test_world_series_br_contract_accepts_four_player_roster():
    validate_tournament_contract(
        engine_key="wsow_br",
        scoring_profile="wsow_like",
        team_size=4,
        config={
            "engine_key": "wsow_br",
            "game_mode": "br",
            "roster_policy": "fixed_squad",
            "tournament_structure": "cumulative",
            "teamSize": 4,
            "lobbySize": 50,
            "matchPointThreshold": 125,
        },
    )


def create_engine_tournament(db_session, engine_key: str, team_size: int, game_mode: str):
    scoring_profile = "kill_race" if engine_key == "kill_race_bracket" else "wsow_like"
    tournament_structure = "single_elim" if engine_key == "kill_race_bracket" else "cumulative"
    return create_tournament(
        db_session,
        schemas.TournamentCreate(
            name=f"{engine_key} test",
            game="Warzone",
            format="roulette_2v2" if engine_key == "kill_race_bracket" else "battle_royale_points",
            team_size=team_size,
            scoring_profile=scoring_profile,
            config=schemas.TournamentConfig(
                engine_key=engine_key,
                game_mode=game_mode,
                roster_policy="roulette" if engine_key in {"roulette_ws", "kill_race_bracket"} else "fixed_squad",
                tournament_structure=tournament_structure,
                lobbySize=50 if game_mode == "br" else (16 if game_mode == "rebirth" else None),
                teamSize=team_size,
                matchPointThreshold=125 if scoring_profile == "wsow_like" else None,
                bestOf=3 if engine_key == "kill_race_bracket" else None,
                bracketMode="single_elim" if engine_key == "kill_race_bracket" else None,
            ),
        ),
    )


def add_players(db_session, tournament_id: int, count: int):
    return create_players_bulk(
        db_session,
        tournament_id,
        [f"Player {index}" for index in range(1, count + 1)],
    )


def test_roulette_ws_br_generates_teams_of_four(db_session):
    tournament = create_engine_tournament(db_session, "roulette_ws", 4, "br")
    add_players(db_session, tournament.id, 8)

    teams, bench, updated = generate_roulette_teams(
        db_session,
        tournament,
        schemas.RouletteGenerationRequest(shuffle_seed="br-seed", reset=True),
    )

    assert resolve_roulette_team_size(updated) == 4
    assert len(teams) == 2
    assert all(len(team.members) == 4 for team in teams)
    assert bench == []
    assert json.loads(updated.config)["rouletteTeamSize"] == 4


def test_roulette_ws_rebirth_generates_teams_of_three_with_bench(db_session):
    tournament = create_engine_tournament(db_session, "roulette_ws", 3, "rebirth")
    add_players(db_session, tournament.id, 10)

    teams, bench, updated = generate_roulette_teams(
        db_session,
        tournament,
        schemas.RouletteGenerationRequest(shuffle_seed="rebirth-seed", reset=True),
    )

    assert resolve_roulette_team_size(updated) == 3
    assert len(teams) == 3
    assert all(len(team.members) == 3 for team in teams)
    assert len(bench) == 1
    assert json.loads(updated.config)["rouletteBench"] == [bench[0].nickname]


def test_kill_race_2v2_generates_teams_of_two(db_session):
    tournament = create_engine_tournament(db_session, "kill_race_bracket", 2, "kill_race")
    add_players(db_session, tournament.id, 8)

    teams, bench, updated = generate_roulette_teams(
        db_session,
        tournament,
        schemas.RouletteGenerationRequest(shuffle_seed="kill-race-seed", reset=True),
    )

    assert resolve_roulette_team_size(updated) == 2
    assert len(teams) == 4
    assert all(len(team.members) == 2 for team in teams)
    assert bench == []


def test_roulette_requires_minimum_two_teams(db_session):
    tournament = create_engine_tournament(db_session, "roulette_ws", 4, "br")
    add_players(db_session, tournament.id, 7)

    with pytest.raises(ValueError, match="tienes 7, necesitas mínimo 8"):
        generate_roulette_teams(
            db_session,
            tournament,
            schemas.RouletteGenerationRequest(shuffle_seed="short", reset=True),
        )


def test_roulette_does_not_regenerate_after_results(db_session):
    tournament = create_engine_tournament(db_session, "roulette_ws", 4, "br")
    add_players(db_session, tournament.id, 8)
    teams, _, _ = generate_roulette_teams(
        db_session,
        tournament,
        schemas.RouletteGenerationRequest(shuffle_seed="initial", reset=True),
    )
    match = create_battle_royale_match(db_session, tournament, schemas.MatchCreate(round=1))
    upsert_team_result(
        db_session,
        tournament,
        match,
        schemas.TeamResultUpsert(team_id=teams[0].id, kills=10, placement=1),
    )

    with pytest.raises(ValueError, match="ya existen resultados"):
        generate_roulette_teams(
            db_session,
            tournament,
            schemas.RouletteGenerationRequest(shuffle_seed="blocked", reset=True),
        )


def test_effective_lobby_size_comes_from_config_not_registered_teams():
    tournament = Tournament(
        name="WS",
        game="Warzone",
        format="battle_royale_points",
        team_size=4,
        scoring_profile="wsow_like",
        config=json.dumps({"engine_key": "wsow_br", "lobbySize": 50}),
    )

    assert get_effective_lobby_size(tournament) == 50
