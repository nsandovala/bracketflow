"""Regresion del scoring WSOW (BF-003, BF-005).

Blinda la tabla fija por bandas que reemplazo la interpolacion
2.0 - ((placement-1)/(team_count-1)), la cual producia multiplicadores
y puntos negativos cuando placement > equipos inscritos.
"""

import pytest

from app.crud import calculate_points, get_placement_multiplier

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
