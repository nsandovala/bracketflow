"""Regresion del scoring WSOW (BF-003, BF-005).

Blinda la tabla fija por bandas que reemplazo la interpolacion
2.0 - ((placement-1)/(team_count-1)), la cual producia multiplicadores
y puntos negativos cuando placement > equipos inscritos.
"""

import json

import pytest

from app.crud import (
    calculate_points,
    get_effective_format,
    get_placement_multiplier,
    get_rebirth_placement_multiplier,
    is_wsow_like_tournament,
    requires_unique_placement,
)
from app.models import Tournament

WORLD_SERIES_FORMAT = "battle_royale_points"


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
