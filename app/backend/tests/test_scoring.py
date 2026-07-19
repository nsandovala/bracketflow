"""Regresion del scoring WSOW (BF-003, BF-005).

Blinda la tabla fija por bandas que reemplazo la interpolacion
2.0 - ((placement-1)/(team_count-1)), la cual producia multiplicadores
y puntos negativos cuando placement > equipos inscritos.
"""

import json

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import schemas
from app.main import create_match, upsert_match_map, create_match_result
from app.crud import (
    calculate_points,
    close_roster_respin,
    create_battle_royale_match,
    create_players_bulk,
    create_team,
    create_tournament,
    evaluate_match_point,
    generate_bracket,
    generate_roulette_teams,
    get_effective_format,
    get_effective_lobby_size,
    get_match_point_threshold,
    get_matches_by_tournament,
    get_placement_multiplier,
    get_rebirth_placement_multiplier,
    get_tournament,
    is_wsow_like_tournament,
    lock_bracket,
    lock_roster,
    open_bracket_respin,
    open_roster_respin,
    requires_unique_placement,
    resolve_roulette_team_size,
    upsert_map_result,
    create_team_result,
    validate_tournament_contract,
)
from app.database import Base
from app.models import TeamResult, Tournament

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
            team_size=3,
            config={
                "engine_key": "wsow_br",
                "game_mode": "br",
                "roster_policy": "fixed_squad",
                "tournament_structure": "single_elim",
                "teamSize": 3,
                "lobbySize": 50,
                "matchPointThreshold": 125,
            },
        )


def test_world_series_br_contract_accepts_three_player_roster():
    validate_tournament_contract(
        engine_key="wsow_br",
        scoring_profile="wsow_like",
        team_size=3,
        config={
            "engine_key": "wsow_br",
            "game_mode": "br",
            "roster_policy": "fixed_squad",
            "tournament_structure": "cumulative",
            "teamSize": 3,
            "lobbySize": 50,
            "matchPointThreshold": 125,
        },
    )


def test_world_series_br_contract_rejects_four_player_roster():
    with pytest.raises(ValueError, match="team_size=3"):
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


def test_roulette_ws_br_generates_teams_of_three(db_session):
    # Override de producto 2026-07-07: Gedeon BR tambien opera con 3.
    tournament = create_engine_tournament(db_session, "roulette_ws", 3, "br")
    add_players(db_session, tournament.id, 6)
    tournament = open_roster_respin(db_session, tournament, 180)

    teams, bench, updated = generate_roulette_teams(
        db_session,
        tournament,
        schemas.RouletteGenerationRequest(shuffle_seed="br-seed", reset=True),
    )

    assert resolve_roulette_team_size(updated) == 3
    assert len(teams) == 2
    assert all(len(team.members) == 3 for team in teams)
    assert bench == []
    assert json.loads(updated.config)["rouletteTeamSize"] == 3


def test_roulette_ws_rebirth_generates_teams_of_three_with_bench(db_session):
    tournament = create_engine_tournament(db_session, "roulette_ws", 3, "rebirth")
    add_players(db_session, tournament.id, 10)
    tournament = open_roster_respin(db_session, tournament, 180)

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
    tournament = open_roster_respin(db_session, tournament, 180)

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
    tournament = create_engine_tournament(db_session, "roulette_ws", 3, "br")
    add_players(db_session, tournament.id, 5)
    tournament = open_roster_respin(db_session, tournament, 180)

    with pytest.raises(ValueError, match="tienes 5, necesitas mínimo 6"):
        generate_roulette_teams(
            db_session,
            tournament,
            schemas.RouletteGenerationRequest(shuffle_seed="short", reset=True),
        )


def test_roulette_does_not_regenerate_after_results(db_session):
    tournament = create_engine_tournament(db_session, "roulette_ws", 3, "br")
    add_players(db_session, tournament.id, 8)
    tournament = open_roster_respin(db_session, tournament, 180)
    teams, _, _ = generate_roulette_teams(
        db_session,
        tournament,
        schemas.RouletteGenerationRequest(shuffle_seed="initial", reset=True),
    )
    match = create_battle_royale_match(db_session, tournament, schemas.MatchCreate(round=1))
    create_team_result(
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


def test_roulette_allows_idle_roster_window(db_session):
    tournament = create_engine_tournament(db_session, "kill_race_bracket", 2, "kill_race")
    add_players(db_session, tournament.id, 8)

    teams, bench, updated_tournament = generate_roulette_teams(
        db_session,
        tournament,
        schemas.RouletteGenerationRequest(shuffle_seed="idle-ok", reset=True),
    )

    assert len(teams) == 4
    assert bench == []
    assert updated_tournament.status == "teams_generated"


def test_roulette_rejects_regeneration_after_roster_lock(db_session):
    tournament = create_engine_tournament(db_session, "kill_race_bracket", 2, "kill_race")
    add_players(db_session, tournament.id, 8)
    tournament = open_roster_respin(db_session, tournament, 180)
    generate_roulette_teams(
        db_session,
        tournament,
        schemas.RouletteGenerationRequest(shuffle_seed="initial", reset=True),
    )
    tournament = close_roster_respin(db_session, tournament)
    tournament = lock_roster(db_session, tournament)

    with pytest.raises(ValueError, match="roster ya esta locked"):
        generate_roulette_teams(
            db_session,
            tournament,
            schemas.RouletteGenerationRequest(shuffle_seed="blocked", reset=True),
        )


def test_bracket_remains_locked_after_lock_endpoint(db_session):
    tournament = create_engine_tournament(db_session, "kill_race_bracket", 2, "kill_race")
    add_players(db_session, tournament.id, 8)
    tournament = open_roster_respin(db_session, tournament, 180)
    generate_roulette_teams(
        db_session,
        tournament,
        schemas.RouletteGenerationRequest(shuffle_seed="initial", reset=True),
    )
    tournament = close_roster_respin(db_session, tournament)
    tournament = lock_roster(db_session, tournament)
    tournament = open_bracket_respin(db_session, tournament, 3)
    matches, _ = generate_bracket(db_session, tournament)
    tournament = lock_bracket(db_session, tournament)

    assert len(matches) > 0
    assert tournament.bracket_status == "locked"


def test_first_saved_map_moves_locked_bracket_to_running(db_session):
    tournament = create_engine_tournament(db_session, "kill_race_bracket", 2, "kill_race")
    add_players(db_session, tournament.id, 8)
    tournament = open_roster_respin(db_session, tournament, 180)
    generate_roulette_teams(
        db_session,
        tournament,
        schemas.RouletteGenerationRequest(shuffle_seed="initial", reset=True),
    )
    tournament = close_roster_respin(db_session, tournament)
    tournament = lock_roster(db_session, tournament)
    tournament = open_bracket_respin(db_session, tournament, 3)
    generate_bracket(db_session, tournament)
    tournament = lock_bracket(db_session, tournament)
    first_match = get_matches_by_tournament(db_session, tournament.id)[0]

    upsert_map_result(
        db_session,
        tournament,
        first_match,
        schemas.MapResultUpsert(
            match_id=first_match.id,
            map_number=1,
            kills_a=12,
            kills_b=8,
        ),
    )
    db_session.refresh(tournament)

    assert tournament.bracket_status == "running"


def test_effective_lobby_size_comes_from_config_not_registered_teams():
    tournament = Tournament(
        name="WS",
        game="Warzone",
        format="battle_royale_points",
        team_size=3,
        scoring_profile="wsow_like",
        config=json.dumps({"engine_key": "wsow_br", "lobbySize": 50}),
    )

    assert get_effective_lobby_size(tournament) == 50


def _create_wsow_br_tournament(db_session, threshold: int):
    return create_tournament(
        db_session,
        schemas.TournamentCreate(
            name="WSOW MatchPoint",
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
                matchPointThreshold=threshold,
            ),
        ),
    )


def _seed_match_point_results(db_session, tournament, rows):
    """rows: list of (team_name, kills, placement). Inserta resultados directos
    (bypass del guard de placement unico) para armar un leaderboard controlado."""
    match = create_battle_royale_match(db_session, tournament, schemas.MatchCreate(round=1))
    team_ids = {}
    for name, kills, placement in rows:
        team = create_team(db_session, tournament.id, schemas.TeamCreate(name=name))
        team_ids[name] = team.id
        db_session.add(
            TeamResult(
                tournament_id=tournament.id,
                match_id=match.id,
                team_id=team.id,
                kills=kills,
                placement=placement,
            )
        )
    db_session.commit()
    return match, team_ids


def test_match_point_crowns_unique_leader_over_threshold(db_session):
    tournament = _create_wsow_br_tournament(db_session, threshold=30)
    _, team_ids = _seed_match_point_results(
        db_session, tournament, [("Alpha", 20, 1), ("Bravo", 5, 2)]
    )

    champion = evaluate_match_point(db_session, tournament)
    db_session.commit()

    assert champion == team_ids["Alpha"]
    assert tournament.status == "completed"

    reloaded = get_tournament(db_session, tournament.id)
    assert reloaded.status == "completed"
    assert json.loads(reloaded.config)["championTeamId"] == team_ids["Alpha"]


def test_match_point_does_not_crown_on_tie_over_threshold(db_session):
    tournament = _create_wsow_br_tournament(db_session, threshold=30)
    _seed_match_point_results(
        db_session, tournament, [("Alpha", 15, 1), ("Bravo", 15, 1)]
    )

    champion = evaluate_match_point(db_session, tournament)

    assert champion is None
    assert tournament.status != "completed"
    assert json.loads(tournament.config or "{}").get("championTeamId") is None


def test_match_point_does_not_crown_below_threshold(db_session):
    tournament = _create_wsow_br_tournament(db_session, threshold=100)
    _seed_match_point_results(
        db_session, tournament, [("Alpha", 20, 1), ("Bravo", 5, 2)]
    )

    assert evaluate_match_point(db_session, tournament) is None
    assert tournament.status != "completed"


def test_match_point_not_applicable_to_kill_race(db_session):
    tournament = create_engine_tournament(db_session, "kill_race_bracket", 2, "kill_race")

    assert get_match_point_threshold(tournament) is None
    assert evaluate_match_point(db_session, tournament) is None


def test_upsert_result_crowns_only_when_partida_completes(db_session):
    tournament = _create_wsow_br_tournament(db_session, threshold=30)
    team_a = create_team(db_session, tournament.id, schemas.TeamCreate(name="Alpha"))
    team_b = create_team(db_session, tournament.id, schemas.TeamCreate(name="Bravo"))
    match = create_battle_royale_match(db_session, tournament, schemas.MatchCreate(round=1))

    # Primer reporte: aunque Alpha ya cruzo el umbral, la partida no termino
    # (falta Bravo). No se corona a mitad de partida.
    create_team_result(
        db_session,
        tournament,
        match,
        schemas.TeamResultUpsert(team_id=team_a.id, kills=20, placement=1),
    )
    db_session.refresh(tournament)
    assert tournament.status != "completed"
    assert json.loads(tournament.config or "{}").get("championTeamId") is None

    # Segundo reporte: la partida cierra y ahora si se evalua Match Point.
    create_team_result(
        db_session,
        tournament,
        match,
        schemas.TeamResultUpsert(team_id=team_b.id, kills=5, placement=2),
    )
    db_session.refresh(tournament)
    assert tournament.status == "completed"
    assert json.loads(tournament.config)["championTeamId"] == team_a.id


def test_match_point_tie_stays_active_until_a_tiebreak_partida_decides(db_session):
    tournament = _create_wsow_br_tournament(db_session, threshold=30)
    team_a = create_team(db_session, tournament.id, schemas.TeamCreate(name="Alpha"))
    team_b = create_team(db_session, tournament.id, schemas.TeamCreate(name="Bravo"))

    # Partida 1: ambos cierran empatados en 30 sobre el umbral -> NO corona.
    partida1 = create_battle_royale_match(db_session, tournament, schemas.MatchCreate(round=1))
    create_team_result(
        db_session, tournament, partida1,
        schemas.TeamResultUpsert(team_id=team_a.id, kills=15, placement=1),  # 15 * 2.0 = 30
    )
    create_team_result(
        db_session, tournament, partida1,
        schemas.TeamResultUpsert(team_id=team_b.id, kills=30, placement=36),  # 30 * 1.0 = 30
    )
    db_session.refresh(tournament)
    assert tournament.status != "completed"
    assert json.loads(tournament.config or "{}").get("championTeamId") is None

    # Partida 2 (desempate): Alpha se despega -> lider unico sobre umbral -> corona.
    partida2 = create_battle_royale_match(db_session, tournament, schemas.MatchCreate(round=2))
    create_team_result(
        db_session, tournament, partida2,
        schemas.TeamResultUpsert(team_id=team_a.id, kills=10, placement=1),  # +20 = 50
    )
    create_team_result(
        db_session, tournament, partida2,
        schemas.TeamResultUpsert(team_id=team_b.id, kills=0, placement=2),  # +0 = 30
    )
    db_session.refresh(tournament)
    assert tournament.status == "completed"
    assert json.loads(tournament.config)["championTeamId"] == team_a.id


# ---------------------------------------------------------------------------
# Guard de torneo finalizado (F0): el backend rechaza mutaciones operativas
# cuando el torneo ya esta completed / tiene championTeamId.
# ---------------------------------------------------------------------------


# Se prueban las funciones-endpoint directamente (sin TestClient/httpx) para no
# agregar dependencias de red a la suite; el guard vive en la capa de endpoint.
FINALIZED_DETAIL = "Torneo finalizado: no se permiten nuevas operaciones."


def _crown_wsow_champion(db_session):
    """Arma un torneo WSOW coronado: status completed + championTeamId persistido."""
    tournament = _create_wsow_br_tournament(db_session, threshold=30)
    match, team_ids = _seed_match_point_results(
        db_session, tournament, [("Alpha", 20, 1), ("Bravo", 5, 2)]
    )
    champion = evaluate_match_point(db_session, tournament)
    db_session.commit()
    assert champion == team_ids["Alpha"]
    assert tournament.status == "completed"
    assert json.loads(tournament.config)["championTeamId"] == team_ids["Alpha"]
    return tournament, match, team_ids


def test_finalized_tournament_rejects_new_match(db_session):
    tournament, _, _ = _crown_wsow_champion(db_session)
    before = len(get_matches_by_tournament(db_session, tournament.id))

    with pytest.raises(HTTPException) as exc:
        create_match(tournament.id, schemas.MatchCreate(round=2), db_session)

    assert exc.value.status_code == 409
    assert exc.value.detail == FINALIZED_DETAIL
    assert len(get_matches_by_tournament(db_session, tournament.id)) == before


def test_finalized_tournament_rejects_result_upsert(db_session):
    tournament, match, team_ids = _crown_wsow_champion(db_session)

    with pytest.raises(HTTPException) as exc:
        create_match_result(
            match.id,
            schemas.TeamResultUpsert(team_id=team_ids["Alpha"], kills=999, placement=1),
            db_session,
        )

    assert exc.value.status_code == 409
    assert exc.value.detail == FINALIZED_DETAIL

    saved = (
        db_session.query(TeamResult)
        .filter(TeamResult.match_id == match.id, TeamResult.team_id == team_ids["Alpha"])
        .first()
    )
    assert saved.kills == 20  # sin alterar
    db_session.refresh(tournament)
    assert json.loads(tournament.config)["championTeamId"] == team_ids["Alpha"]


def test_finalized_tournament_rejects_kill_race_map(db_session):
    tournament = create_engine_tournament(db_session, "kill_race_bracket", 2, "kill_race")
    add_players(db_session, tournament.id, 8)
    tournament = open_roster_respin(db_session, tournament, 180)
    generate_roulette_teams(
        db_session,
        tournament,
        schemas.RouletteGenerationRequest(shuffle_seed="finalized", reset=True),
    )
    tournament = close_roster_respin(db_session, tournament)
    tournament = lock_roster(db_session, tournament)
    tournament = open_bracket_respin(db_session, tournament, 3)
    generate_bracket(db_session, tournament)
    tournament = lock_bracket(db_session, tournament)
    first_match = get_matches_by_tournament(db_session, tournament.id)[0]

    # Simula torneo cerrado (campeon decidido). El guard por torneo debe cerrar
    # la escritura de mapas aun cuando el match individual siga sin winner.
    tournament.status = "completed"
    db_session.commit()

    with pytest.raises(HTTPException) as exc:
        upsert_match_map(
            first_match.id,
            schemas.MapResultUpsert(
                match_id=first_match.id,
                map_number=1,
                kills_a=12,
                kills_b=8,
            ),
            db_session,
        )

    assert exc.value.status_code == 409
    assert exc.value.detail == FINALIZED_DETAIL

    db_session.refresh(first_match)
    assert first_match.maps == []  # ningun mapa persistido
    assert first_match.winner_id is None


# ---------------------------------------------------------------------------
# Guard create-only de resultados oficiales (P1): POST /matches/{id}/results
# nunca sobreescribe un resultado existente para el mismo match_id + team_id.
# ---------------------------------------------------------------------------
DUPLICATE_REPORT_DETAIL = "Ya existe reporte oficial para este equipo en esta partida."


def _official_report_fixture(db_session):
    tournament = _create_wsow_br_tournament(db_session, threshold=500)
    team_a = create_team(db_session, tournament.id, schemas.TeamCreate(name="Alpha"))
    team_b = create_team(db_session, tournament.id, schemas.TeamCreate(name="Bravo"))
    match = create_battle_royale_match(
        db_session, tournament, schemas.MatchCreate(round=1)
    )
    return tournament, match, team_a, team_b


def test_first_official_report_creates_result(db_session):
    _, match, team_a, _ = _official_report_fixture(db_session)

    created = create_match_result(
        match.id,
        schemas.TeamResultUpsert(team_id=team_a.id, kills=7, placement=1),
        db_session,
    )

    assert created.kills == 7
    assert created.placement == 1
    stored = (
        db_session.query(TeamResult)
        .filter(TeamResult.match_id == match.id, TeamResult.team_id == team_a.id)
        .all()
    )
    assert len(stored) == 1


def test_second_official_report_same_team_returns_409(db_session):
    _, match, team_a, _ = _official_report_fixture(db_session)
    create_match_result(
        match.id,
        schemas.TeamResultUpsert(team_id=team_a.id, kills=7, placement=1),
        db_session,
    )

    with pytest.raises(HTTPException) as exc:
        create_match_result(
            match.id,
            schemas.TeamResultUpsert(team_id=team_a.id, kills=99, placement=2),
            db_session,
        )

    assert exc.value.status_code == 409
    assert exc.value.detail == DUPLICATE_REPORT_DETAIL


def test_second_official_report_does_not_overwrite_original(db_session):
    _, match, team_a, _ = _official_report_fixture(db_session)
    create_match_result(
        match.id,
        schemas.TeamResultUpsert(team_id=team_a.id, kills=7, placement=1),
        db_session,
    )

    with pytest.raises(HTTPException):
        create_match_result(
            match.id,
            schemas.TeamResultUpsert(team_id=team_a.id, kills=99, placement=2),
            db_session,
        )

    stored = (
        db_session.query(TeamResult)
        .filter(TeamResult.match_id == match.id, TeamResult.team_id == team_a.id)
        .all()
    )
    assert len(stored) == 1
    assert stored[0].kills == 7
    assert stored[0].placement == 1


def test_other_team_can_still_report_after_conflict(db_session):
    _, match, team_a, team_b = _official_report_fixture(db_session)
    create_match_result(
        match.id,
        schemas.TeamResultUpsert(team_id=team_a.id, kills=7, placement=1),
        db_session,
    )
    with pytest.raises(HTTPException):
        create_match_result(
            match.id,
            schemas.TeamResultUpsert(team_id=team_a.id, kills=99, placement=2),
            db_session,
        )

    other = create_match_result(
        match.id,
        schemas.TeamResultUpsert(team_id=team_b.id, kills=3, placement=2),
        db_session,
    )

    assert other.kills == 3
    assert other.placement == 2


def test_unique_constraint_backstops_direct_duplicate_insert(db_session):
    # Camino de carrera: si dos requests pasan el check de lectura, la unique
    # constraint (match_id, team_id) corta el segundo INSERT.
    tournament, match, team_a, _ = _official_report_fixture(db_session)
    create_match_result(
        match.id,
        schemas.TeamResultUpsert(team_id=team_a.id, kills=7, placement=1),
        db_session,
    )

    from sqlalchemy.exc import IntegrityError

    db_session.add(
        TeamResult(
            tournament_id=tournament.id,
            match_id=match.id,
            team_id=team_a.id,
            kills=99,
            placement=2,
            kill_points=99,
            placement_points=0,
            total_points=99,
        )
    )
    with pytest.raises(IntegrityError):
        db_session.flush()
    db_session.rollback()
