import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models, schemas
from app.crud import confirm_kill_race_result, get_match, upsert_kill_race_result
from app.database import Base
from app.kill_race_import import PlayerRef, build_preview


@pytest.fixture()
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def kill_race(db):
    tournament = models.Tournament(
        name="KR", game="Warzone", format="roulette_2v2", team_size=2,
        scoring_profile="kill_race", config='{"engine_key":"kill_race_bracket"}',
        status="active", bracket_status="locked",
    )
    db.add(tournament)
    db.flush()
    players = [
        models.Player(nickname=name, tournament_id=tournament.id)
        for name in ("Vito", "Jasfa", "Barbas", "Xavi")
    ]
    db.add_all(players)
    db.flush()
    left = models.Team(name="Vito / Jasfa", tournament_id=tournament.id, source="manual")
    right = models.Team(name="Barbas / Xavi", tournament_id=tournament.id, source="manual")
    db.add_all([left, right])
    db.flush()
    db.add_all([
        models.TeamMember(team_id=left.id, player_id=players[0].id),
        models.TeamMember(team_id=left.id, player_id=players[1].id),
        models.TeamMember(team_id=right.id, player_id=players[2].id),
        models.TeamMember(team_id=right.id, player_id=players[3].id),
    ])
    match = models.Match(
        round=1, status="ready", team_a_id=left.id, team_b_id=right.id,
        best_of=3, tournament_id=tournament.id,
    )
    db.add(match)
    db.commit()
    return tournament, get_match(db, match.id), left, right, players


def refs(left, right, players):
    return [
        PlayerRef(player.id, player.nickname, left.id if index < 2 else right.id, "left" if index < 2 else "right")
        for index, player in enumerate(players)
    ]


def preview(kill_race, content, format="txt"):
    _, match, left, right, players = kill_race
    return build_preview(
        format=format, content=content, match_id=match.id, expected_map_number=1,
        left_team_id=left.id, left_team_name=left.name,
        right_team_id=right.id, right_team_name=right.name,
        players=refs(left, right, players),
    )


def valid_payload(kill_race, left_total=12):
    _, _, left, right, players = kill_race
    return schemas.KillRaceResultInput(
        map_number=1, status="provisional",
        left={"side": "left", "team_id": left.id, "team_name": left.name,
              "players": [{"player_id": players[0].id, "player_name": "Vito", "kills": 7},
                          {"player_id": players[1].id, "player_name": "Jasfa", "kills": 5}],
              "total_kills": left_total},
        right={"side": "right", "team_id": right.id, "team_name": right.name,
               "players": [{"player_id": players[2].id, "player_name": "Barbas", "kills": 6},
                           {"player_id": players[3].id, "player_name": "Xavi", "kills": 3}],
               "total_kills": 9},
    )


def test_valid_txt_parser_and_totals(kill_race):
    result = preview(kill_race, """MATCH: 1
LEFT: Vito / Jasfa
Vito: 7
Jasfa: 5
RIGHT: Barbas / Xavi
Barbas: 6
Xavi: 3""")
    assert result.valid
    assert result.left.total_kills == 12
    assert result.right.total_kills == 9


def test_valid_compact_txt_only_resolves_against_match_rosters(kill_race):
    result = preview(kill_race, "MATCH 1\nVito,7\nJasfa,5\nBarbas,6\nXavi,3")
    assert result.valid


def test_valid_csv_parser(kill_race):
    result = preview(kill_race, """match,side,team,player,kills
1,left,Vito / Jasfa,Vito,7
1,left,Vito / Jasfa,Jasfa,5
1,right,Barbas / Xavi,Barbas,6
1,right,Barbas / Xavi,Xavi,3""", "csv")
    assert result.valid


def test_wrong_player_duplicate_and_mixed_match_are_invalid(kill_race):
    wrong = preview(kill_race, "MATCH 1\nNobody,7\nJasfa,5\nBarbas,6\nXavi,3")
    duplicate = preview(kill_race, "MATCH 1\nVito,7\nVito,5\nBarbas,6\nXavi,3")
    mixed = preview(kill_race, "MATCH 1\nMATCH 2\nVito,7\nJasfa,5\nBarbas,6\nXavi,3")
    assert not wrong.valid and wrong.conflicts[0].code == "unknown_player"
    assert not duplicate.valid and any(item.code == "duplicate_player" for item in duplicate.errors)
    assert not mixed.valid and any(item.code == "mixed_matches" for item in mixed.errors)


def test_inconsistent_total_is_rejected_without_autocorrection(kill_race):
    with pytest.raises(ValidationError, match="no coincide"):
        valid_payload(kill_race, left_total=99)


def test_provisional_updates_but_confirmed_result_cannot_be_overwritten(db, kill_race):
    tournament, match, *_ = kill_race
    first = upsert_kill_race_result(db, tournament, match, valid_payload(kill_race))
    assert first.maps[0].result_status == "provisional"
    payload = valid_payload(kill_race)
    payload.left.players[0].kills = 8
    payload.left.total_kills = 13
    updated = upsert_kill_race_result(db, tournament, get_match(db, match.id), payload)
    assert updated.maps[0].kills_a == 13
    confirmed = confirm_kill_race_result(db, tournament, get_match(db, match.id), 1)
    assert confirmed.maps_won_a == 1
    assert confirmed.maps[0].kills_a == 13
    with pytest.raises(ValueError, match="confirmado"):
        upsert_kill_race_result(db, tournament, get_match(db, match.id), payload)


def test_series_score_is_separate_from_current_game_kills(db, kill_race):
    tournament, match, *_ = kill_race
    provisional = upsert_kill_race_result(db, tournament, match, valid_payload(kill_race))
    assert (provisional.maps_won_a, provisional.maps_won_b) == (0, 0)
    assert (provisional.maps[0].kills_a, provisional.maps[0].kills_b) == (12, 9)
    confirmed = confirm_kill_race_result(db, tournament, get_match(db, match.id), 1)
    assert (confirmed.maps_won_a, confirmed.maps_won_b) == (1, 0)
    assert (confirmed.maps[0].kills_a, confirmed.maps[0].kills_b) == (12, 9)
