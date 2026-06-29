import json
import random
import re
from collections import defaultdict

from sqlalchemy.orm import Session, selectinload

from . import models, schemas

BR_FORMATS = {"battle_royale_points", "roulette_2v2", "roulette_3v3"}
ROULETTE_FORMATS = {"roulette_2v2", "roulette_3v3"}
WORLD_SERIES_FORMATS = {"battle_royale_points"}
WSOW_ENGINE_KEYS = {"wsow_br", "wsow_classic", "rebirth_ws", "roulette_ws"}
REBIRTH_ENGINE_KEYS = {"rebirth_ws"}
KILL_RACE_ENGINE_KEYS = {"kill_race_bracket"}


def normalize_team_size(format_name: str, requested_team_size: int) -> int:
    if requested_team_size == 1:
        return 1
    if format_name == "roulette_3v3":
        return 3
    if format_name == "roulette_2v2":
        return 2
    return requested_team_size


def serialize_config(config: schemas.TournamentConfig | None) -> str | None:
    if config is None:
        return None
    data = config.model_dump(exclude_none=True)
    return json.dumps(data) if data else None


def read_tournament_config(tournament: models.Tournament) -> dict:
    if not tournament.config:
        return {}
    try:
        parsed = json.loads(tournament.config)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def get_engine_key(tournament: models.Tournament) -> str | None:
    config = read_tournament_config(tournament)
    engine_key = config.get("engine_key")
    if engine_key == "wsow_classic":
        return "wsow_br"
    return engine_key if isinstance(engine_key, str) else None


def get_effective_format(tournament: models.Tournament) -> str:
    engine_key = get_engine_key(tournament)
    if engine_key in WSOW_ENGINE_KEYS:
        return "battle_royale_points"
    if engine_key in KILL_RACE_ENGINE_KEYS:
        return "roulette_3v3" if tournament.team_size == 3 else "roulette_2v2"
    return tournament.format


def requires_unique_placement(tournament: models.Tournament) -> bool:
    effective_format = get_effective_format(tournament)
    return (
        tournament.scoring_profile == "wsow_like"
        and effective_format in WORLD_SERIES_FORMATS
    )


def is_wsow_like_tournament(tournament: models.Tournament) -> bool:
    return tournament.scoring_profile == "wsow_like" and get_engine_key(tournament) not in KILL_RACE_ENGINE_KEYS


def requires_roulette(tournament: models.Tournament) -> bool:
    config = read_tournament_config(tournament)
    return config.get("roster_policy") == "roulette" or get_engine_key(tournament) in {
        "roulette_ws",
        "kill_race_bracket",
    }


def create_tournament(db: Session, tournament: schemas.TournamentCreate) -> models.Tournament:
    normalized_team_size = normalize_team_size(tournament.format, tournament.team_size)
    db_tournament = models.Tournament(
        name=tournament.name,
        game=tournament.game,
        status="draft",
        format=tournament.format,
        team_size=normalized_team_size,
        scoring_profile=tournament.scoring_profile,
        config=serialize_config(tournament.config),
    )
    db.add(db_tournament)
    db.commit()
    db.refresh(db_tournament)
    return db_tournament


def get_tournaments(db: Session) -> list[models.Tournament]:
    return (
        db.query(models.Tournament)
        .filter(models.Tournament.status != "archived")
        .order_by(models.Tournament.id.desc())
        .all()
    )


def get_tournament(db: Session, tournament_id: int) -> models.Tournament | None:
    return (
        db.query(models.Tournament)
        .filter(models.Tournament.id == tournament_id)
        .first()
    )


def archive_tournament(db: Session, tournament: models.Tournament) -> models.Tournament:
    tournament.status = "archived"
    db.commit()
    db.refresh(tournament)
    return tournament


def delete_tournament(db: Session, tournament: models.Tournament) -> None:
    db.delete(tournament)
    db.commit()


def create_team(
    db: Session, tournament_id: int, team: schemas.TeamCreate, source: str = "manual"
) -> models.Team:
    db_team = models.Team(name=team.name, tournament_id=tournament_id, source=source)
    db.add(db_team)
    db.commit()
    db.refresh(db_team)
    return db_team


def get_teams_by_tournament(db: Session, tournament_id: int) -> list[models.Team]:
    return (
        db.query(models.Team)
        .options(selectinload(models.Team.members).selectinload(models.TeamMember.player))
        .filter(models.Team.tournament_id == tournament_id)
        .order_by(models.Team.id.asc())
        .all()
    )


def get_team(db: Session, team_id: int) -> models.Team | None:
    return (
        db.query(models.Team)
        .options(selectinload(models.Team.members).selectinload(models.TeamMember.player))
        .filter(models.Team.id == team_id)
        .first()
    )


def get_players_by_tournament(db: Session, tournament_id: int) -> list[models.Player]:
    return (
        db.query(models.Player)
        .filter(models.Player.tournament_id == tournament_id)
        .order_by(models.Player.id.asc())
        .all()
    )


def get_player(db: Session, player_id: int) -> models.Player | None:
    return db.query(models.Player).filter(models.Player.id == player_id).first()


def create_player(
    db: Session, tournament_id: int, player: schemas.PlayerCreate
) -> models.Player:
    db_player = models.Player(nickname=player.nickname, tournament_id=tournament_id)
    db.add(db_player)
    db.commit()
    db.refresh(db_player)
    return db_player


def add_player_to_team(
    db: Session,
    team: models.Team,
    player: models.Player,
) -> models.Team:
    existing_membership = (
        db.query(models.TeamMember)
        .join(models.Team, models.Team.id == models.TeamMember.team_id)
        .filter(
            models.TeamMember.player_id == player.id,
            models.Team.tournament_id == team.tournament_id,
        )
        .first()
    )
    if existing_membership is not None:
        raise ValueError("Player is already assigned to a team in this tournament")

    db.add(models.TeamMember(team_id=team.id, player_id=player.id))
    db.commit()
    return get_team(db, team.id)


def get_matches_by_tournament(db: Session, tournament_id: int) -> list[models.Match]:
    return (
        db.query(models.Match)
        .filter(models.Match.tournament_id == tournament_id)
        .order_by(models.Match.round.asc(), models.Match.id.asc())
        .all()
    )


def get_match(db: Session, match_id: int) -> models.Match | None:
    return db.query(models.Match).filter(models.Match.id == match_id).first()


def generate_bracket(
    db: Session, tournament: models.Tournament
) -> tuple[list[models.Match], models.Tournament]:
    teams = get_teams_by_tournament(db, tournament.id)
    matches: list[models.Match] = []

    for index in range(0, len(teams), 2):
        team_a = teams[index]
        team_b = teams[index + 1] if index + 1 < len(teams) else None
        matches.append(
            models.Match(
                round=1,
                status="pending",
                team_a_id=team_a.id,
                team_b_id=team_b.id if team_b else None,
                winner_id=None,
                tournament_id=tournament.id,
            )
        )

    db.add_all(matches)
    tournament.status = "bracket_generated"
    db.commit()

    for match in matches:
        db.refresh(match)
    db.refresh(tournament)

    return matches, tournament


def _get_assigned_player_ids(db: Session, tournament_id: int) -> set[int]:
    rows = (
        db.query(models.TeamMember.player_id)
        .join(models.Team, models.Team.id == models.TeamMember.team_id)
        .filter(models.Team.tournament_id == tournament_id)
        .all()
    )
    return {row[0] for row in rows}


def _cleanup_roulette_teams(db: Session, tournament_id: int) -> None:
    roulette_teams = (
        db.query(models.Team)
        .filter(
            models.Team.tournament_id == tournament_id,
            models.Team.source == "roulette",
        )
        .all()
    )
    roulette_team_ids = [team.id for team in roulette_teams]
    if not roulette_team_ids:
        return

    db.query(models.TeamResult).filter(
        models.TeamResult.team_id.in_(roulette_team_ids)
    ).delete(synchronize_session=False)
    db.query(models.TeamMember).filter(
        models.TeamMember.team_id.in_(roulette_team_ids)
    ).delete(synchronize_session=False)
    db.query(models.Team).filter(models.Team.id.in_(roulette_team_ids)).delete(
        synchronize_session=False
    )
    db.flush()


def _next_roulette_team_index(db: Session, tournament_id: int) -> int:
    team_name_pattern = re.compile(r"^Team (\d+)$")
    all_teams = (
        db.query(models.Team.name)
        .filter(models.Team.tournament_id == tournament_id)
        .all()
    )
    max_index = 0
    for (name,) in all_teams:
        match = team_name_pattern.match(name)
        if match:
            max_index = max(max_index, int(match.group(1)))
    return max_index + 1


def generate_roulette_teams(
    db: Session,
    tournament: models.Tournament,
    payload: schemas.RouletteGenerationRequest,
) -> tuple[list[models.Team], list[models.Player], models.Tournament]:
    if payload.reset:
        _cleanup_roulette_teams(db, tournament.id)

    players = get_players_by_tournament(db, tournament.id)
    assigned_player_ids = _get_assigned_player_ids(db, tournament.id)
    available_players = [player for player in players if player.id not in assigned_player_ids]

    rng = random.Random(payload.seed)
    rng.shuffle(available_players)

    created_team_ids: list[int] = []
    next_team_index = _next_roulette_team_index(db, tournament.id)

    for index in range(0, len(available_players), payload.team_size):
        chunk = available_players[index : index + payload.team_size]
        if len(chunk) < payload.team_size:
            break

        team = models.Team(
            name=f"Team {next_team_index}",
            tournament_id=tournament.id,
            source="roulette",
        )
        next_team_index += 1
        db.add(team)
        db.flush()

        for player in chunk:
            db.add(models.TeamMember(team_id=team.id, player_id=player.id))
        created_team_ids.append(team.id)

    bench_start = len(created_team_ids) * payload.team_size
    bench = available_players[bench_start:]

    tournament.team_size = payload.team_size
    if payload.team_size == 2:
        tournament.format = "roulette_2v2"
    elif payload.team_size == 3:
        tournament.format = "roulette_3v3"
    tournament.status = "teams_generated"
    db.commit()

    created_teams = (
        db.query(models.Team)
        .options(selectinload(models.Team.members).selectinload(models.TeamMember.player))
        .filter(models.Team.id.in_(created_team_ids))
        .order_by(models.Team.id.asc())
        .all()
    )
    db.refresh(tournament)
    return created_teams, bench, tournament


def create_battle_royale_match(
    db: Session, tournament: models.Tournament, match: schemas.MatchCreate
) -> models.Match:
    existing_match = (
        db.query(models.Match)
        .filter(
            models.Match.tournament_id == tournament.id,
            models.Match.round == match.round,
            models.Match.team_a_id.is_(None),
            models.Match.team_b_id.is_(None),
        )
        .first()
    )
    if existing_match is not None:
        return existing_match

    db_match = models.Match(
        tournament_id=tournament.id,
        round=match.round,
        status="pending",
        team_a_id=None,
        team_b_id=None,
        winner_id=None,
    )
    db.add(db_match)
    db.commit()
    db.refresh(db_match)
    return db_match


def round_points(value: float) -> float:
    return round(value + 1e-9, 1)


# Tabla oficial WSOW (sin cambios desde 2021).
# Fuente: si.com/esports/call-of-duty/world-series-of-warzone-global-finals-scoring-system-explained-
# 1 punto por kill x multiplicador por banda de placement.
WSOW_PLACEMENT_BANDS: list[tuple[int, float]] = [
    (1, 2.0),    # 1°
    (5, 1.8),    # 2°-5°
    (10, 1.6),   # 6°-10°
    (20, 1.4),   # 11°-20°
    (35, 1.2),   # 21°-35°
]
WSOW_MIN_MULTIPLIER = 1.0  # 36°+ — clamp: jamás 0 ni negativo

REBIRTH_PLACEMENT_BANDS: list[tuple[int, float]] = [
    (1, 1.6),
    (5, 1.4),
    (10, 1.2),
]
REBIRTH_MIN_MULTIPLIER = 1.0


def get_placement_multiplier(placement: int) -> float:
    if placement < 1:
        raise ValueError("placement must be >= 1")
    for max_place, multiplier in WSOW_PLACEMENT_BANDS:
        if placement <= max_place:
            return multiplier
    return WSOW_MIN_MULTIPLIER


def get_rebirth_placement_multiplier(placement: int) -> float:
    if placement < 1:
        raise ValueError("placement must be >= 1")
    for max_place, multiplier in REBIRTH_PLACEMENT_BANDS:
        if placement <= max_place:
            return multiplier
    return REBIRTH_MIN_MULTIPLIER


def get_tournament_team_count(db: Session, tournament_id: int) -> int:
    return db.query(models.Team).filter(models.Team.tournament_id == tournament_id).count()


def calculate_points(
    format_name: str,
    kills: int,
    placement: int,
    engine_key: str | None = None,
) -> tuple[float, float, float]:
    if format_name in ROULETTE_FORMATS:
        total_points = float(kills)
        return float(kills), 0.0, total_points

    if format_name in WORLD_SERIES_FORMATS:
        multiplier = (
            get_rebirth_placement_multiplier(placement)
            if engine_key in REBIRTH_ENGINE_KEYS
            else get_placement_multiplier(placement)
        )
        total_points = round_points(kills * multiplier)
        return float(kills), multiplier, total_points

    total_points = float(kills)
    return float(kills), 0.0, total_points


def build_team_result_schema(
    result: models.TeamResult,
    format_name: str,
    engine_key: str | None = None,
) -> schemas.TeamResult:
    kill_points, placement_points, total_points = calculate_points(
        format_name,
        result.kills,
        result.placement,
        engine_key,
    )
    return schemas.TeamResult(
        id=result.id,
        tournament_id=result.tournament_id,
        match_id=result.match_id,
        team_id=result.team_id,
        kills=result.kills,
        placement=result.placement,
        kill_points=kill_points,
        placement_points=placement_points,
        total_points=total_points,
    )


def get_conflicting_placement(
    db: Session, match_id: int, placement: int, team_id: int
) -> models.TeamResult | None:
    """Otro equipo del mismo game con ese placement (excluye al propio equipo)."""
    return (
        db.query(models.TeamResult)
        .filter(
            models.TeamResult.match_id == match_id,
            models.TeamResult.placement == placement,
            models.TeamResult.team_id != team_id,
        )
        .first()
    )


def upsert_team_result(
    db: Session,
    tournament: models.Tournament,
    match: models.Match,
    payload: schemas.TeamResultUpsert,
) -> schemas.TeamResult:
    effective_format = get_effective_format(tournament)
    engine_key = get_engine_key(tournament)
    kill_points, placement_points, total_points = calculate_points(
        effective_format,
        payload.kills,
        payload.placement,
        engine_key,
    )

    db_result = (
        db.query(models.TeamResult)
        .filter(
            models.TeamResult.match_id == match.id,
            models.TeamResult.team_id == payload.team_id,
        )
        .first()
    )

    if db_result is None:
        db_result = models.TeamResult(
            tournament_id=tournament.id,
            match_id=match.id,
            team_id=payload.team_id,
            kills=payload.kills,
            placement=payload.placement,
            kill_points=kill_points,
            placement_points=placement_points,
            total_points=total_points,
        )
        db.add(db_result)
    else:
        db_result.kills = payload.kills
        db_result.placement = payload.placement
        db_result.kill_points = kill_points
        db_result.placement_points = placement_points
        db_result.total_points = total_points

    db.flush()

    tournament_team_count = get_tournament_team_count(db, tournament.id)
    result_count = (
        db.query(models.TeamResult)
        .filter(models.TeamResult.match_id == match.id)
        .count()
    )
    match.status = "completed" if tournament_team_count and result_count >= tournament_team_count else "in_progress"

    db.commit()
    db.refresh(db_result)
    db.refresh(match)
    return build_team_result_schema(db_result, effective_format, engine_key)


def get_team_results_by_tournament(
    db: Session, tournament_id: int
) -> list[models.TeamResult]:
    return (
        db.query(models.TeamResult)
        .join(models.Team, models.Team.id == models.TeamResult.team_id)
        .filter(models.TeamResult.tournament_id == tournament_id)
        .order_by(models.TeamResult.match_id.asc(), models.TeamResult.team_id.asc())
        .all()
    )


def get_team_result_details_by_tournament(
    db: Session,
    tournament: models.Tournament,
) -> list[schemas.TeamResultDetail]:
    rows = (
        db.query(models.TeamResult, models.Team.name, models.Match.round, models.Match.status)
        .join(models.Team, models.Team.id == models.TeamResult.team_id)
        .join(models.Match, models.Match.id == models.TeamResult.match_id)
        .filter(models.TeamResult.tournament_id == tournament.id)
        .order_by(models.Match.round.asc(), models.Team.name.asc())
        .all()
    )

    details: list[schemas.TeamResultDetail] = []
    for result, team_name, round_number, match_status in rows:
        effective_format = get_effective_format(tournament)
        engine_key = get_engine_key(tournament)
        kill_points, placement_points, total_points = calculate_points(
            effective_format,
            result.kills,
            result.placement,
            engine_key,
        )
        details.append(
            schemas.TeamResultDetail(
                id=result.id,
                tournament_id=result.tournament_id,
                match_id=result.match_id,
                round=round_number,
                match_status=match_status,
                team_id=result.team_id,
                team_name=team_name,
                kills=result.kills,
                placement=result.placement,
                kill_points=kill_points,
                placement_points=placement_points,
                total_points=total_points,
            )
        )
    return details


def get_leaderboard(
    db: Session,
    tournament: models.Tournament,
) -> list[schemas.LeaderboardEntry]:
    teams = get_teams_by_tournament(db, tournament.id)
    results = get_team_results_by_tournament(db, tournament.id)

    summary_by_team: dict[int, dict[str, float | int | set[int] | None]] = defaultdict(
        lambda: {
            "kills": 0,
            "placement_total": 0,
            "results_count": 0,
            "total_points": 0.0,
            "max_kills_in_map": 0,
            "best_placement": None,
            "matches_played": set(),
        }
    )

    for result in results:
        effective_format = get_effective_format(tournament)
        engine_key = get_engine_key(tournament)
        _, _, result_total_points = calculate_points(
            effective_format,
            result.kills,
            result.placement,
            engine_key,
        )
        summary = summary_by_team[result.team_id]
        summary["kills"] = int(summary["kills"]) + result.kills
        summary["placement_total"] = int(summary["placement_total"]) + result.placement
        summary["results_count"] = int(summary["results_count"]) + 1
        summary["total_points"] = round_points(float(summary["total_points"]) + result_total_points)
        summary["max_kills_in_map"] = max(int(summary["max_kills_in_map"]), result.kills)
        summary["matches_played"].add(result.match_id)
        best_placement = summary["best_placement"]
        if best_placement is None or result.placement < int(best_placement):
            summary["best_placement"] = result.placement

    leaderboard: list[schemas.LeaderboardEntry] = []
    for team in teams:
        summary = summary_by_team[team.id]
        kills = int(summary["kills"])
        total_points = round_points(float(summary["total_points"]))
        effective_multiplier = round(total_points / kills, 2) if kills > 0 else 0.0
        leaderboard.append(
            schemas.LeaderboardEntry(
                team_id=team.id,
                team_name=team.name,
                matches_played=len(summary["matches_played"]),
                kills=kills,
                placement_points=(
                    effective_multiplier
                    if get_effective_format(tournament) in WORLD_SERIES_FORMATS and kills > 0
                    else 0.0
                ),
                total_points=total_points,
                best_placement=(
                    int(summary["best_placement"])
                    if summary["best_placement"] is not None
                    else None
                ),
            )
        )

    if get_effective_format(tournament) in WORLD_SERIES_FORMATS:
        leaderboard.sort(
            key=lambda entry: (
                -entry.total_points,
                -entry.kills,
                (
                    float(summary_by_team[entry.team_id]["placement_total"])
                    / max(int(summary_by_team[entry.team_id]["results_count"]), 1)
                ),
                -int(summary_by_team[entry.team_id]["max_kills_in_map"]),
                entry.best_placement if entry.best_placement is not None else 9999,
                entry.team_name.casefold(),
            )
        )
    else:
        leaderboard.sort(key=lambda entry: (-entry.kills, entry.team_name.casefold()))
    return leaderboard
