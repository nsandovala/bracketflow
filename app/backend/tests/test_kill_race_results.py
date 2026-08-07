import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models, schemas
from app.crud import (
    archive_tournament,
    confirm_kill_race_result,
    delete_tournament,
    generate_bracket,
    get_match,
    get_matches_by_tournament,
    is_tournament_finalized,
    lock_bracket,
    read_tournament_config,
    update_tournament_broadcast_match,
    get_broadcast_channel,
    update_broadcast_channel,
    upsert_kill_race_result,
)
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


def match_payload(db, match, map_number, status="provisional"):
    left = db.get(models.Team, match.team_a_id)
    right = db.get(models.Team, match.team_b_id)
    left_players = [member.player for member in left.members]
    right_players = [member.player for member in right.members]
    return schemas.KillRaceResultInput(
        map_number=map_number,
        status=status,
        left={
            "side": "left",
            "team_id": left.id,
            "team_name": left.name,
            "players": [
                {"player_id": left_players[0].id, "player_name": left_players[0].nickname, "kills": 7},
                {"player_id": left_players[1].id, "player_name": left_players[1].nickname, "kills": 5},
            ],
            "total_kills": 12,
        },
        right={
            "side": "right",
            "team_id": right.id,
            "team_name": right.name,
            "players": [
                {"player_id": right_players[0].id, "player_name": right_players[0].nickname, "kills": 6},
                {"player_id": right_players[1].id, "player_name": right_players[1].nickname, "kills": 3},
            ],
            "total_kills": 9,
        },
    )


def confirm_left_sweep(db, tournament, match):
    for map_number in (1, 2):
        current = get_match(db, match.id)
        upsert_kill_race_result(db, tournament, current, match_payload(db, current, map_number))
        confirm_kill_race_result(db, tournament, get_match(db, match.id), map_number)
    return get_match(db, match.id)


def create_four_team_bracket(db):
    tournament = models.Tournament(
        name="P7 lifecycle",
        game="Warzone",
        format="roulette_2v2",
        team_size=2,
        scoring_profile="kill_race",
        config='{"engine_key":"kill_race_bracket","bestOf":3}',
        status="active",
        roster_status="locked",
        bracket_status="respin_open",
    )
    db.add(tournament)
    db.flush()
    for team_index in range(4):
        players = [
            models.Player(
                nickname=f"T{team_index + 1}P{player_index + 1}",
                tournament_id=tournament.id,
            )
            for player_index in range(2)
        ]
        db.add_all(players)
        db.flush()
        team = models.Team(
            name=f"Team {team_index + 1}",
            tournament_id=tournament.id,
            source="manual",
        )
        db.add(team)
        db.flush()
        db.add_all(
            models.TeamMember(team_id=team.id, player_id=player.id)
            for player in players
        )
    db.commit()
    generate_bracket(db, tournament)
    lock_bracket(db, tournament)
    return tournament


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


def test_completed_kill_race_bracket_is_finalized_without_syncing_tournament_status(
    kill_race,
):
    tournament, *_ = kill_race
    tournament.status = "bracket_generated"
    tournament.bracket_status = "completed"

    assert is_tournament_finalized(tournament)
    assert tournament.status == "bracket_generated"


def test_decided_bo3_rejects_map_three_and_never_reopens_or_changes_official_data(
    db, kill_race
):
    tournament, match, *_ = kill_race
    next_match = models.Match(
        round=2,
        status="pending",
        best_of=3,
        tournament_id=tournament.id,
    )
    db.add(next_match)
    db.flush()
    match.next_match_id = next_match.id
    match.next_slot = "a"
    db.commit()
    decided = confirm_left_sweep(db, tournament, match)
    original_maps = [
        (item.map_number, item.kills_a, item.kills_b, item.result_status)
        for item in decided.maps
    ]
    original_stats = db.query(models.MatchMapPlayerStat).count()

    with pytest.raises(ValueError, match="serie ya esta decidida"):
        upsert_kill_race_result(
            db,
            tournament,
            get_match(db, match.id),
            match_payload(db, get_match(db, match.id), 3),
        )
    with pytest.raises(ValueError, match="serie ya esta decidida"):
        confirm_kill_race_result(db, tournament, get_match(db, match.id), 1)

    preserved = get_match(db, match.id)
    assert preserved.status == "completed"
    assert preserved.winner_id == preserved.team_a_id
    assert [
        (item.map_number, item.kills_a, item.kills_b, item.result_status)
        for item in preserved.maps
    ] == original_maps
    assert db.query(models.MatchMapPlayerStat).count() == original_stats
    assert all(
        candidate.winner_id is None or candidate.status != "in_progress"
        for candidate in db.query(models.Match).all()
    )


def test_archived_tournament_rejects_kill_race_mutations_but_remains_readable(
    db, kill_race
):
    tournament, match, *_ = kill_race
    upsert_kill_race_result(db, tournament, match, valid_payload(kill_race))
    archive_tournament(db, tournament)

    assert is_tournament_finalized(tournament)
    assert get_match(db, match.id).maps[0].result_status == "provisional"
    with pytest.raises(ValueError, match="Torneo finalizado"):
        confirm_kill_race_result(db, tournament, get_match(db, match.id), 1)
    with pytest.raises(ValueError, match="Torneo finalizado"):
        upsert_kill_race_result(
            db,
            tournament,
            get_match(db, match.id),
            match_payload(db, get_match(db, match.id), 2),
        )

    historical = get_match(db, match.id)
    assert historical.maps[0].result_status == "provisional"
    assert historical.winner_id is None


def test_four_team_kill_race_lifecycle_finishes_and_becomes_immutable(db):
    tournament = create_four_team_bracket(db)
    semifinals = [
        match
        for match in get_matches_by_tournament(db, tournament.id)
        if match.round == 1
    ]
    assert len(semifinals) == 2

    semifinal_winners = []
    for semifinal in semifinals:
        decided = confirm_left_sweep(db, tournament, semifinal)
        assert decided.status == "completed"
        assert decided.winner_id == decided.team_a_id
        semifinal_winners.append(decided.winner_id)

    final = next(
        match
        for match in get_matches_by_tournament(db, tournament.id)
        if match.round == 2
    )
    assert {final.team_a_id, final.team_b_id} == set(semifinal_winners)
    assert final.status == "ready"

    completed_final = confirm_left_sweep(db, tournament, final)
    db.refresh(tournament)
    assert completed_final.winner_id == completed_final.team_a_id
    assert completed_final.status == "completed"
    assert tournament.status == "bracket_generated"
    assert tournament.bracket_status == "completed"
    assert is_tournament_finalized(tournament)

    official_before = [
        (row.match_id, row.map_number, row.kills_a, row.kills_b, row.map_winner_id)
        for row in db.query(models.MatchMap)
        .order_by(models.MatchMap.match_id, models.MatchMap.map_number)
        .all()
    ]
    player_stats_before = db.query(models.MatchMapPlayerStat).count()
    with pytest.raises(ValueError, match="Torneo finalizado"):
        upsert_kill_race_result(
            db,
            tournament,
            get_match(db, final.id),
            match_payload(db, get_match(db, final.id), 3),
        )
    with pytest.raises(ValueError, match="Torneo finalizado"):
        confirm_kill_race_result(db, tournament, get_match(db, final.id), 2)

    official_after = [
        (row.match_id, row.map_number, row.kills_a, row.kills_b, row.map_winner_id)
        for row in db.query(models.MatchMap)
        .order_by(models.MatchMap.match_id, models.MatchMap.map_number)
        .all()
    ]
    assert official_after == official_before
    assert db.query(models.MatchMapPlayerStat).count() == player_stats_before


def test_broadcast_match_update_preserves_existing_config(db, kill_race):
    tournament, match, *_ = kill_race
    updated = update_tournament_broadcast_match(db, tournament, match.id)
    config = read_tournament_config(updated)
    assert config["engine_key"] == "kill_race_bracket"
    assert config["broadcastMatchId"] == match.id


def test_broadcast_match_rejects_completed_and_foreign_match(db, kill_race):
    tournament, match, *_ = kill_race
    match.status = "completed"
    db.commit()
    with pytest.raises(ValueError, match="jugable"):
        update_tournament_broadcast_match(db, tournament, match.id)

    other = models.Tournament(
        name="Other", game="Warzone", format="roulette_2v2", team_size=2,
        scoring_profile="kill_race", status="active", bracket_status="locked",
    )
    db.add(other)
    db.flush()
    foreign = models.Match(
        round=1, status="ready", team_a_id=match.team_a_id, team_b_id=match.team_b_id,
        best_of=3, tournament_id=other.id,
    )
    db.add(foreign)
    db.commit()
    with pytest.raises(ValueError, match="no pertenece"):
        update_tournament_broadcast_match(db, tournament, foreign.id)


def test_main_broadcast_channel_is_persistent_and_merge_safe(db, kill_race):
    tournament, match, *_ = kill_race
    initial = get_broadcast_channel(db, "main")
    assert initial["channelKey"] == "main"
    assert initial["activeTournamentId"] is None

    updated = update_broadcast_channel(db, "main", schemas.BroadcastChannelUpdate(
        activeTournamentId=tournament.id,
        broadcastMatchId=match.id,
        engine="kill_race_bracket",
        updatedBy="operator",
    ))
    merged = update_broadcast_channel(db, "main", schemas.BroadcastChannelUpdate(updatedBy="caster"))
    assert merged["activeTournamentId"] == tournament.id
    assert merged["broadcastMatchId"] == match.id
    assert merged["engine"] == "kill_race_bracket"
    assert merged["updatedBy"] == "caster"
    assert merged["updatedAt"] >= updated["updatedAt"]


def test_channel_tournament_switch_clears_previous_match(db, kill_race):
    tournament, match, *_ = kill_race
    update_broadcast_channel(db, "main", schemas.BroadcastChannelUpdate(
        activeTournamentId=tournament.id, broadcastMatchId=match.id,
    ))
    other = models.Tournament(
        name="Other channel tournament", game="Warzone", format="roulette_2v2",
        team_size=2, scoring_profile="kill_race", status="active",
        bracket_status="locked", config='{"engine_key":"kill_race_bracket"}',
    )
    db.add(other)
    db.commit()
    switched = update_broadcast_channel(
        db, "main", schemas.BroadcastChannelUpdate(activeTournamentId=other.id)
    )
    assert switched["activeTournamentId"] == other.id
    assert switched["broadcastMatchId"] is None


def test_delete_tournament_clears_only_referencing_channels_in_one_commit(
    db, kill_race, monkeypatch
):
    tournament, match, *_ = kill_race
    other = models.Tournament(
        name="Other persistent tournament", game="Warzone", format="roulette_2v2",
        team_size=2, scoring_profile="kill_race", status="active",
        bracket_status="locked", config='{"engine_key":"kill_race_bracket"}',
    )
    db.add(other)
    db.flush()
    affected = models.BroadcastChannel(
        channel_key="main", active_tournament_id=tournament.id,
        broadcast_match_id=match.id, engine="kill_race_bracket",
        updated_at="2026-01-01T00:00:00+00:00", updated_by="operator",
    )
    untouched = models.BroadcastChannel(
        channel_key="secondary", active_tournament_id=other.id,
        broadcast_match_id=None, engine="kill_race_bracket",
        updated_at="2026-01-02T00:00:00+00:00", updated_by="operator",
    )
    db.add_all([affected, untouched])
    db.commit()

    original_commit = db.commit
    commit_calls = 0

    def counted_commit():
        nonlocal commit_calls
        commit_calls += 1
        original_commit()

    monkeypatch.setattr(db, "commit", counted_commit)
    delete_tournament(db, tournament)

    cleaned = db.get(models.BroadcastChannel, "main")
    preserved = db.get(models.BroadcastChannel, "secondary")
    assert commit_calls == 1
    assert cleaned.active_tournament_id is None
    assert cleaned.broadcast_match_id is None
    assert cleaned.engine is None
    assert cleaned.updated_at != "2026-01-01T00:00:00+00:00"
    assert preserved.active_tournament_id == other.id
    assert preserved.updated_at == "2026-01-02T00:00:00+00:00"
    assert db.get(models.Tournament, tournament.id) is None


def test_delete_tournament_without_channel_still_works(db, kill_race):
    tournament, *_ = kill_race
    delete_tournament(db, tournament)
    assert db.get(models.Tournament, tournament.id) is None
    assert db.query(models.BroadcastChannel).count() == 0


def test_delete_tournament_rolls_back_channel_cleanup_when_commit_fails(
    db, kill_race, monkeypatch
):
    tournament, match, *_ = kill_race
    channel = models.BroadcastChannel(
        channel_key="main", active_tournament_id=tournament.id,
        broadcast_match_id=match.id, engine="kill_race_bracket",
        updated_at="2026-01-01T00:00:00+00:00",
    )
    db.add(channel)
    db.commit()

    def failing_commit():
        raise RuntimeError("forced commit failure")

    monkeypatch.setattr(db, "commit", failing_commit)
    with pytest.raises(RuntimeError, match="forced commit failure"):
        delete_tournament(db, tournament)

    restored_channel = db.get(models.BroadcastChannel, "main")
    assert restored_channel.active_tournament_id == tournament.id
    assert restored_channel.broadcast_match_id == match.id
    assert restored_channel.engine == "kill_race_bracket"
    assert restored_channel.updated_at == "2026-01-01T00:00:00+00:00"
    assert db.get(models.Tournament, tournament.id) is not None
