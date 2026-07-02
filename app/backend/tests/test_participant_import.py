from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import crud, schemas
from app.database import Base


FIXTURES_DIR = Path(__file__).resolve().parents[2] / "test" / "fixtures"


def read_fixture_lines(name: str) -> list[str]:
    content = (FIXTURES_DIR / name).read_text(encoding="utf-8")
    return content.splitlines()


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


def create_test_tournament(db_session):
    return crud.create_tournament(
        db_session,
        schemas.TournamentCreate(
            name="Parser QA",
            game="Warzone",
            format="battle_royale_points",
            team_size=3,
            scoring_profile="wsow_like",
            config=schemas.TournamentConfig(
                engine_key="roulette_ws",
                game_mode="rebirth",
                roster_policy="roulette",
                tournament_structure="cumulative",
                lobbySize=16,
                teamSize=3,
            ),
        ),
    )


def preview_rows(db_session, tournament_id: int, rows: list[str]):
    return crud.preview_participant_rows(db_session, tournament_id, rows)


def confirm_rows(db_session, tournament_id: int, rows: list[str]):
    return crud.import_participant_rows(db_session, tournament_id, rows)


def test_preview_accepts_plain_fixture_rows(db_session):
    tournament = create_test_tournament(db_session)
    rows = read_fixture_lines("jugadores.txt")
    expected_rows = [row for row in rows if row.strip()]

    payload = preview_rows(db_session, tournament.id, rows)

    assert len(payload["accepted"]) == len(expected_rows)
    assert payload["rejected"] == []
    assert payload["accepted"][0]["display_name"] == "NeonWolf"
    assert payload["accepted"][0]["activision_id"] is None


def test_preview_rejects_fixture_with_three_plus_fields(db_session):
    tournament = create_test_tournament(db_session)
    rows = read_fixture_lines("jugadoresbr.txt")

    payload = preview_rows(db_session, tournament.id, rows)

    assert payload["accepted"] == []
    assert len(payload["rejected"]) == len(rows)
    assert payload["rejected"][0]["line"] == 1
    assert "campos" in payload["rejected"][0]["reason"].lower()


def test_preview_accepts_display_name_plus_activision_id(db_session):
    tournament = create_test_tournament(db_session)

    payload = preview_rows(db_session, tournament.id, ["demian,Demian#7734512"])

    assert payload["rejected"] == []
    assert payload["accepted"] == [
        {
            "line": 1,
            "raw": "demian,Demian#7734512",
            "display_name": "demian",
            "activision_id": "Demian#7734512",
        }
    ]


def test_preview_rejects_internal_commas_with_line_number(db_session):
    tournament = create_test_tournament(db_session)

    payload = preview_rows(
        db_session,
        tournament.id,
        ["manteca, demain, carlos, lalo, clara"],
    )

    assert payload["accepted"] == []
    assert payload["rejected"] == [
        {
            "line": 1,
            "raw": "manteca, demain, carlos, lalo, clara",
            "reason": "La fila tiene 5 campos; solo se admite display name o display name + Activision ID.",
        }
    ]


def test_preview_rejects_bad_activision_id_variants(db_session):
    tournament = create_test_tournament(db_session)

    payload = preview_rows(
        db_session,
        tournament.id,
        [
            "demian,Demian7734512",
            "ana,Ana#tag",
            "luna,",
        ],
    )

    assert payload["accepted"] == []
    assert [item["line"] for item in payload["rejected"]] == [1, 2, 3]
    assert all("activision" in item["reason"].lower() for item in payload["rejected"])


def test_preview_ignores_blank_lines_deduplicates_and_collapses_spaces(db_session):
    tournament = create_test_tournament(db_session)

    payload = preview_rows(
        db_session,
        tournament.id,
        [
            "\ufeff  Demo   Name  ",
            "demo name",
            "   ",
            "",
        ],
    )

    assert payload["rejected"] == []
    assert payload["accepted"] == [
        {
            "line": 1,
            "raw": "\ufeff  Demo   Name  ",
            "display_name": "Demo Name",
            "activision_id": None,
        }
    ]


def test_confirm_persists_only_valid_rows(db_session):
    tournament = create_test_tournament(db_session)

    payload = confirm_rows(
        db_session,
        tournament.id,
        [
            "manteca",
            "demian,Demian#7734512",
            "manteca, demain, carlos",
        ],
    )

    assert len(payload["accepted"]) == 2
    assert len(payload["rejected"]) == 1
    assert payload["persisted_count"] == 2

    players = crud.get_players_by_tournament(db_session, tournament.id)
    assert [player.nickname for player in players] == ["manteca", "demian"]
    assert players[0].display_name == "manteca"
    assert players[0].activision_id is None
    assert players[1].display_name == "demian"
    assert players[1].activision_id == "Demian#7734512"
