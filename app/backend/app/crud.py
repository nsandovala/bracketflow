import json
import random
import re
from datetime import UTC, datetime, timedelta
from math import ceil, log2
from collections import defaultdict

from sqlalchemy.orm import Session, selectinload

from . import models, schemas

BR_FORMATS = {"battle_royale_points", "roulette_2v2", "roulette_3v3"}
ROULETTE_FORMATS = {"roulette_2v2", "roulette_3v3"}
WORLD_SERIES_FORMATS = {"battle_royale_points"}
WSOW_ENGINE_KEYS = {"wsow_br", "wsow_classic", "rebirth_ws", "roulette_ws"}
REBIRTH_ENGINE_KEYS = {"rebirth_ws"}
KILL_RACE_ENGINE_KEYS = {"kill_race_bracket"}
STRUCTURAL_CONFIG_FIELDS = {
    "engine_key",
    "scoring_profile",
    "roster_policy",
    "teamSize",
    "game_mode",
    "tournament_structure",
    "bracketMode",
}

ROSTER_RESPIN_OPEN = "respin_open"
ROSTER_LOCKED = "locked"
ROSTER_PENDING = "participants_pending"
BRACKET_PENDING = "pending"
BRACKET_RESPIN_OPEN = "respin_open"
BRACKET_LOCKED = "locked"
BRACKET_RUNNING = "running"
BRACKET_COMPLETED = "completed"
ROULETTE_TIMER_IDLE = "idle"
ROULETTE_TIMER_RUNNING = "running"
ROULETTE_TIMER_CLOSED = "closed"


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


def normalize_config_dict(config: schemas.TournamentConfig | None) -> dict:
    if config is None:
        return {}
    return config.model_dump(exclude_none=True)


def read_tournament_config(tournament: models.Tournament) -> dict:
    if not tournament.config:
        return {}
    try:
        parsed = json.loads(tournament.config)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def write_tournament_config(tournament: models.Tournament, config: dict) -> None:
    tournament.config = json.dumps(config) if config else None


def uses_roulette_timer(engine_key: str | None, config: dict) -> bool:
    return config.get("roster_policy") == "roulette" or engine_key in {
        "roulette_ws",
        "kill_race_bracket",
    }


def get_roulette_timer_state(tournament: models.Tournament) -> str:
    config = read_tournament_config(tournament)
    state = config.get("rouletteRosterTimerState")
    if state in {ROULETTE_TIMER_IDLE, ROULETTE_TIMER_RUNNING, ROULETTE_TIMER_CLOSED}:
        return state
    if tournament.roster_status == ROSTER_LOCKED:
        return ROULETTE_TIMER_CLOSED
    if tournament.roster_status == ROSTER_RESPIN_OPEN and tournament.roster_respin_deadline_at:
        return ROULETTE_TIMER_RUNNING
    return ROULETTE_TIMER_IDLE


def ensure_roulette_timer_config(tournament: models.Tournament) -> None:
    config = read_tournament_config(tournament)
    engine_key = get_engine_key(tournament)
    if not uses_roulette_timer(engine_key, config):
        return

    state = get_roulette_timer_state(tournament)
    changed = False
    if config.get("rouletteRosterTimerState") != state:
        config["rouletteRosterTimerState"] = state
        changed = True
    if not isinstance(config.get("rouletteRosterDurationSeconds"), int):
        config["rouletteRosterDurationSeconds"] = 180
        changed = True
    if changed:
        write_tournament_config(tournament, config)


def set_roulette_timer_state(
    tournament: models.Tournament,
    *,
    state: str,
    duration_seconds: int | None = None,
) -> None:
    config = read_tournament_config(tournament)
    config["rouletteRosterTimerState"] = state
    if duration_seconds is not None:
        config["rouletteRosterDurationSeconds"] = duration_seconds
    elif not isinstance(config.get("rouletteRosterDurationSeconds"), int):
        config["rouletteRosterDurationSeconds"] = 180
    write_tournament_config(tournament, config)


def get_engine_key(tournament: models.Tournament) -> str | None:
    config = read_tournament_config(tournament)
    engine_key = config.get("engine_key")
    if engine_key == "wsow_classic":
        return "wsow_br"
    return engine_key if isinstance(engine_key, str) else None


def get_payload_engine_key(tournament: schemas.TournamentBase) -> str | None:
    if tournament.config is None:
        return None
    engine_key = tournament.config.engine_key
    if engine_key == "wsow_classic":
        return "wsow_br"
    return engine_key


def utc_now_iso() -> str:
    return datetime.now(tz=UTC).isoformat()


def parse_utc_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def validate_tournament_contract(
    *,
    engine_key: str | None,
    scoring_profile: str,
    team_size: int,
    config: dict,
) -> None:
    game_mode = config.get("game_mode")
    roster_policy = config.get("roster_policy")
    tournament_structure = config.get("tournament_structure")
    has_lobby_size = config.get("lobbySize") is not None
    has_match_point = config.get("matchPointThreshold") is not None

    if engine_key == "wsow_br":
        if scoring_profile != "wsow_like":
            raise ValueError("World Series BR requires scoring_profile=wsow_like")
        if roster_policy not in {None, "fixed_squad"}:
            raise ValueError("World Series BR requires roster_policy=fixed_squad")
        if game_mode not in {None, "br"}:
            raise ValueError("World Series BR requires game_mode=br")
        if tournament_structure not in {None, "cumulative"}:
            raise ValueError("WSOW/Rebirth engines cannot use single/double elimination")
        if team_size != 4 or config.get("teamSize") not in {None, 4}:
            raise ValueError("World Series BR requires team_size=4")

    if engine_key == "rebirth_ws":
        if scoring_profile != "wsow_like":
            raise ValueError("Rebirth WS requires scoring_profile=wsow_like")
        if roster_policy not in {None, "fixed_squad"}:
            raise ValueError("Rebirth WS requires roster_policy=fixed_squad")
        if game_mode not in {None, "rebirth"}:
            raise ValueError("Rebirth WS requires game_mode=rebirth")
        if tournament_structure not in {None, "cumulative"}:
            raise ValueError("WSOW/Rebirth engines cannot use single/double elimination")
        if team_size != 3 or config.get("teamSize") not in {None, 3}:
            raise ValueError("Rebirth WS requires team_size=3")
        if config.get("lobbySize") not in {None, 16, 17}:
            raise ValueError("Rebirth WS lobbySize must be 16 or 17")

    if engine_key == "roulette_ws":
        if scoring_profile != "wsow_like":
            raise ValueError("Gedeon Roulette WS requires scoring_profile=wsow_like")
        if roster_policy not in {None, "roulette"}:
            raise ValueError("Gedeon Roulette WS requires roster_policy=roulette")
        if game_mode not in {None, "br", "rebirth"}:
            raise ValueError("Gedeon Roulette WS requires game_mode=br or rebirth")
        if tournament_structure not in {None, "cumulative"}:
            raise ValueError("Gedeon Roulette WS cannot use single/double elimination")
        expected_team_size = 4 if game_mode == "br" else 3
        if team_size != expected_team_size or config.get("teamSize") not in {None, expected_team_size}:
            raise ValueError(
                "Gedeon Roulette WS requires team_size=4 for BR and team_size=3 for Rebirth"
            )

    if engine_key == "kill_race_bracket":
        if scoring_profile != "kill_race":
            raise ValueError("Kill Race requires scoring_profile=kill_race")
        if roster_policy not in {None, "roulette"}:
            raise ValueError("Kill Race requires roster_policy=roulette")
        if game_mode not in {None, "kill_race"}:
            raise ValueError("Kill Race requires game_mode=kill_race")
        if tournament_structure not in {None, "single_elim", "double_elim"}:
            raise ValueError("Kill Race requires single_elim or double_elim")
        if has_lobby_size or has_match_point:
            raise ValueError("Kill Race cannot receive lobbySize or matchPointThreshold")
        if team_size not in {1, 2, 3} or config.get("teamSize") not in {None, 1, 2, 3}:
            raise ValueError("Kill Race team mode must be 1v1, 2v2 or 3v3")


def _set_bracket_completed_if_needed(tournament: models.Tournament) -> None:
    if tournament.bracket_status == BRACKET_RUNNING:
        completed_match = (
            tournament.matches[-1]
            if tournament.matches
            else None
        )
        if completed_match is not None and completed_match.winner_id is not None:
            tournament.bracket_status = BRACKET_COMPLETED


def apply_tournament_windows(db: Session, tournament: models.Tournament) -> models.Tournament:
    changed = False
    now = datetime.now(tz=UTC)

    roster_deadline = parse_utc_iso(tournament.roster_respin_deadline_at)
    if tournament.roster_status == ROSTER_RESPIN_OPEN and roster_deadline is not None and now >= roster_deadline:
        tournament.roster_status = ROSTER_PENDING
        tournament.roster_locked_at = None
        tournament.roster_respin_deadline_at = None
        set_roulette_timer_state(tournament, state=ROULETTE_TIMER_CLOSED)
        changed = True

    bracket_deadline = parse_utc_iso(tournament.bracket_respin_deadline_at)
    if tournament.bracket_status == BRACKET_RESPIN_OPEN and bracket_deadline is not None and now >= bracket_deadline:
        tournament.bracket_locked_at = tournament.bracket_respin_deadline_at
        tournament.bracket_respin_deadline_at = None
        tournament.bracket_status = BRACKET_LOCKED
        changed = True

    if changed:
        db.commit()
        db.refresh(tournament)
    ensure_roulette_timer_config(tournament)
    return tournament


def has_results(db: Session, tournament_id: int) -> bool:
    if (
        db.query(models.TeamResult.id)
        .filter(models.TeamResult.tournament_id == tournament_id)
        .first()
        is not None
    ):
        return True
    return (
        db.query(models.MatchMap.id)
        .join(models.Match, models.Match.id == models.MatchMap.match_id)
        .filter(models.Match.tournament_id == tournament_id)
        .first()
        is not None
    )


def get_effective_lobby_size(tournament: models.Tournament) -> int | None:
    config = read_tournament_config(tournament)
    lobby_size = config.get("lobbySize")
    if isinstance(lobby_size, int) and lobby_size > 0:
        return lobby_size
    engine_key = get_engine_key(tournament)
    if engine_key == "rebirth_ws":
        return 16
    if engine_key in {"wsow_br", "roulette_ws"}:
        return 50 if config.get("game_mode") == "br" else 16
    return None


def resolve_roulette_team_size(tournament: models.Tournament) -> int:
    config = read_tournament_config(tournament)
    engine_key = get_engine_key(tournament)
    if engine_key == "roulette_ws":
        return 4 if config.get("game_mode") == "br" else 3
    if engine_key == "kill_race_bracket":
        team_size = config.get("teamSize")
        return int(team_size) if team_size in {1, 2, 3} else tournament.team_size
    raise ValueError("This tournament does not use roulette roster generation")


def assert_structural_fields_unmodified(
    current: models.Tournament,
    payload: schemas.TournamentUpdate,
) -> None:
    current_config = read_tournament_config(current)
    next_config = normalize_config_dict(payload.config) if payload.config is not None else current_config

    if payload.format is not None and payload.format != current.format:
        raise ValueError("format cannot be changed after results exist")
    if payload.team_size is not None and payload.team_size != current.team_size:
        raise ValueError("team_size cannot be changed after results exist")
    if payload.scoring_profile is not None and payload.scoring_profile != current.scoring_profile:
        raise ValueError("scoring_profile cannot be changed after results exist")

    for field in STRUCTURAL_CONFIG_FIELDS:
        if current_config.get(field) != next_config.get(field):
            raise ValueError(f"{field} cannot be changed after results exist")


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
    config = normalize_config_dict(tournament.config)
    engine_key = get_payload_engine_key(tournament)
    if uses_roulette_timer(engine_key, config):
        config.setdefault("rouletteRosterTimerState", ROULETTE_TIMER_IDLE)
        config.setdefault("rouletteRosterDurationSeconds", 180)
    validate_tournament_contract(
        engine_key=engine_key,
        scoring_profile=tournament.scoring_profile,
        team_size=normalized_team_size,
        config=config,
    )
    db_tournament = models.Tournament(
        name=tournament.name,
        game=tournament.game,
        status="draft",
        format=tournament.format,
        team_size=normalized_team_size,
        scoring_profile=tournament.scoring_profile,
        roster_status=ROSTER_PENDING,
        bracket_status=BRACKET_PENDING,
        config=json.dumps(config) if config else None,
    )
    db.add(db_tournament)
    db.commit()
    db.refresh(db_tournament)
    return db_tournament


def update_tournament(
    db: Session,
    current: models.Tournament,
    payload: schemas.TournamentUpdate,
) -> models.Tournament:
    if has_results(db, current.id):
        assert_structural_fields_unmodified(current, payload)

    next_name = payload.name if payload.name is not None else current.name
    next_game = payload.game if payload.game is not None else current.game
    next_format = payload.format if payload.format is not None else current.format
    next_team_size = (
        normalize_team_size(next_format, payload.team_size)
        if payload.team_size is not None
        else current.team_size
    )
    next_scoring_profile = (
        payload.scoring_profile
        if payload.scoring_profile is not None
        else current.scoring_profile
    )
    next_config = (
        normalize_config_dict(payload.config)
        if payload.config is not None
        else read_tournament_config(current)
    )
    engine_key = next_config.get("engine_key")
    if engine_key == "wsow_classic":
        engine_key = "wsow_br"
    if uses_roulette_timer(engine_key if isinstance(engine_key, str) else None, next_config):
        next_config.setdefault(
            "rouletteRosterTimerState",
            get_roulette_timer_state(current),
        )
        next_config.setdefault(
            "rouletteRosterDurationSeconds",
            180,
        )

    validate_tournament_contract(
        engine_key=engine_key if isinstance(engine_key, str) else None,
        scoring_profile=next_scoring_profile,
        team_size=next_team_size,
        config=next_config,
    )

    current.name = next_name
    current.game = next_game
    current.format = next_format
    current.team_size = next_team_size
    current.scoring_profile = next_scoring_profile
    write_tournament_config(current, next_config)
    db.commit()
    db.refresh(current)
    updated = apply_tournament_windows(db, current)
    ensure_roulette_timer_config(updated)
    return updated


def get_tournaments(db: Session) -> list[models.Tournament]:
    tournaments = (
        db.query(models.Tournament)
        .filter(models.Tournament.status != "archived")
        .order_by(models.Tournament.id.desc())
        .all()
    )
    resolved = [apply_tournament_windows(db, tournament) for tournament in tournaments]
    for tournament in resolved:
        ensure_roulette_timer_config(tournament)
    return resolved


def get_tournament(db: Session, tournament_id: int) -> models.Tournament | None:
    tournament = (
        db.query(models.Tournament)
        .filter(models.Tournament.id == tournament_id)
        .first()
    )
    if tournament is None:
        return None
    resolved = apply_tournament_windows(db, tournament)
    ensure_roulette_timer_config(resolved)
    return resolved


def archive_tournament(db: Session, tournament: models.Tournament) -> models.Tournament:
    tournament.status = "archived"
    db.commit()
    db.refresh(tournament)
    return tournament


def delete_tournament(db: Session, tournament: models.Tournament) -> None:
    db.delete(tournament)
    db.commit()


def open_roster_respin(
    db: Session,
    tournament: models.Tournament,
    duration_seconds: int,
) -> models.Tournament:
    tournament = apply_tournament_windows(db, tournament)
    if tournament.roster_status == ROSTER_LOCKED:
        raise ValueError("El roster ya esta locked. No se puede abrir respin.")
    deadline = datetime.now(tz=UTC) + timedelta(seconds=duration_seconds)
    tournament.roster_status = ROSTER_RESPIN_OPEN
    tournament.roster_respin_deadline_at = deadline.isoformat()
    tournament.roster_locked_at = None
    set_roulette_timer_state(
        tournament,
        state=ROULETTE_TIMER_RUNNING,
        duration_seconds=duration_seconds,
    )
    db.commit()
    db.refresh(tournament)
    return tournament


def close_roster_respin(db: Session, tournament: models.Tournament) -> models.Tournament:
    tournament = apply_tournament_windows(db, tournament)
    if tournament.roster_status == ROSTER_LOCKED:
        ensure_roulette_timer_config(tournament)
        return tournament

    tournament.roster_status = ROSTER_PENDING
    tournament.roster_respin_deadline_at = None
    tournament.roster_locked_at = None
    set_roulette_timer_state(tournament, state=ROULETTE_TIMER_CLOSED)
    db.commit()
    db.refresh(tournament)
    return tournament


def lock_roster(db: Session, tournament: models.Tournament) -> models.Tournament:
    tournament = apply_tournament_windows(db, tournament)
    if tournament.roster_status == ROSTER_LOCKED:
        return tournament
    if get_roulette_timer_state(tournament) == ROULETTE_TIMER_RUNNING:
        raise ValueError("Cierra el respin antes de bloquear el roster.")
    if not get_teams_by_tournament(db, tournament.id):
        raise ValueError("No se puede locked el roster sin equipos generados.")
    tournament.roster_status = ROSTER_LOCKED
    tournament.roster_locked_at = utc_now_iso()
    tournament.roster_respin_deadline_at = None
    set_roulette_timer_state(tournament, state=ROULETTE_TIMER_CLOSED)
    db.commit()
    db.refresh(tournament)
    return tournament


def open_bracket_respin(
    db: Session,
    tournament: models.Tournament,
    duration_minutes: int,
) -> models.Tournament:
    tournament = apply_tournament_windows(db, tournament)
    if tournament.roster_status != ROSTER_LOCKED:
        raise ValueError("Solo se puede abrir respin de bracket con roster locked.")
    if tournament.bracket_status in {BRACKET_LOCKED, BRACKET_RUNNING, BRACKET_COMPLETED}:
        raise ValueError("El bracket ya esta corriendo o completado. No se puede abrir respin.")
    deadline = datetime.now(tz=UTC) + timedelta(minutes=duration_minutes)
    tournament.bracket_status = BRACKET_RESPIN_OPEN
    tournament.bracket_respin_deadline_at = deadline.isoformat()
    tournament.bracket_locked_at = None
    db.commit()
    db.refresh(tournament)
    return tournament


def lock_bracket(db: Session, tournament: models.Tournament) -> models.Tournament:
    tournament = apply_tournament_windows(db, tournament)
    if tournament.bracket_status in {BRACKET_LOCKED, BRACKET_RUNNING, BRACKET_COMPLETED}:
        return tournament
    if not get_matches_by_tournament(db, tournament.id):
        raise ValueError("No se puede locked el bracket sin matches generados.")
    tournament.bracket_status = BRACKET_LOCKED
    tournament.bracket_locked_at = utc_now_iso()
    tournament.bracket_respin_deadline_at = None
    db.commit()
    db.refresh(tournament)
    return tournament


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
    created = create_players_bulk(db, tournament_id, [player.nickname])
    if not created:
        raise ValueError("Ese participante ya existe en el torneo.")
    return created[0]


def normalize_nickname(value: str) -> str:
    return " ".join(value.strip().split())


ACTIVISION_ID_PATTERN = re.compile(r"^[^,#;\t]+#\d+$")


def normalize_participant_row(value: str) -> str:
    return value.replace("\r", "").replace("\uFEFF", "").strip()


def get_player_display_name(player: models.Player) -> str:
    if player.display_name:
        return normalize_nickname(player.display_name)
    return normalize_nickname(player.nickname)


def parse_participant_rows(
    db: Session,
    tournament_id: int,
    rows: list[str],
) -> dict[str, list[dict[str, str | int | None]]]:
    existing = {
        get_player_display_name(player).casefold()
        for player in get_players_by_tournament(db, tournament_id)
    }
    seen: set[str] = set()
    accepted: list[dict[str, str | int | None]] = []
    rejected: list[dict[str, str | int]] = []

    for line_number, raw_row in enumerate(rows, start=1):
        normalized_row = normalize_participant_row(raw_row)
        if not normalized_row:
            continue

        parts = [normalize_nickname(part) for part in normalized_row.split(",")]
        if len(parts) > 2:
            rejected.append(
                {
                    "line": line_number,
                    "raw": raw_row,
                    "reason": f"La fila tiene {len(parts)} campos; solo se admite display name o display name + Activision ID.",
                }
            )
            continue

        display_name = parts[0] if parts else ""
        activision_id = parts[1] if len(parts) == 2 else None

        try:
            display_name = schemas._validate_nickname(display_name)
        except ValueError as error:
            rejected.append(
                {
                    "line": line_number,
                    "raw": raw_row,
                    "reason": str(error),
                }
            )
            continue

        if activision_id is not None:
            if not activision_id or not ACTIVISION_ID_PATTERN.match(activision_id):
                rejected.append(
                    {
                        "line": line_number,
                        "raw": raw_row,
                        "reason": "Activision ID invalido. Usa formato nombre#digitos.",
                    }
                )
                continue

        key = display_name.casefold()
        if key in existing or key in seen:
            continue

        seen.add(key)
        accepted.append(
            {
                "line": line_number,
                "raw": raw_row,
                "display_name": display_name,
                "activision_id": activision_id,
            }
        )

    return {"accepted": accepted, "rejected": rejected}


def preview_participant_rows(
    db: Session,
    tournament_id: int,
    rows: list[str],
) -> dict[str, list[dict[str, str | int | None]] | int]:
    result = parse_participant_rows(db, tournament_id, rows)
    return {
        "accepted": result["accepted"],
        "rejected": result["rejected"],
        "persisted_count": 0,
    }


def import_participant_rows(
    db: Session,
    tournament_id: int,
    rows: list[str],
) -> dict[str, list[dict[str, str | int | None]] | int | list[models.Player]]:
    result = parse_participant_rows(db, tournament_id, rows)
    created: list[models.Player] = []

    for item in result["accepted"]:
        display_name = str(item["display_name"])
        activision_id = (
            str(item["activision_id"])
            if item["activision_id"] is not None
            else None
        )
        db_player = models.Player(
            nickname=display_name,
            display_name=display_name,
            activision_id=activision_id,
            tournament_id=tournament_id,
        )
        db.add(db_player)
        created.append(db_player)

    db.commit()
    for player in created:
        db.refresh(player)

    return {
        "accepted": result["accepted"],
        "rejected": result["rejected"],
        "persisted_count": len(created),
        "players_created": created,
    }


def create_players_bulk(
    db: Session,
    tournament_id: int,
    nicknames: list[str],
) -> list[models.Player]:
    preview = parse_participant_rows(db, tournament_id, nicknames)
    if preview["rejected"]:
        raise ValueError(str(preview["rejected"][0]["reason"]))
    result = import_participant_rows(db, tournament_id, nicknames)
    return result["players_created"]


def update_player(
    db: Session,
    player: models.Player,
    payload: schemas.PlayerUpdate,
) -> models.Player:
    nickname = normalize_nickname(payload.nickname)
    if not nickname:
        raise ValueError("Nickname is required")
    duplicate = (
        db.query(models.Player)
        .filter(
            models.Player.tournament_id == player.tournament_id,
            models.Player.id != player.id,
        )
        .all()
    )
    if any(get_player_display_name(candidate).casefold() == nickname.casefold() for candidate in duplicate):
        raise ValueError("Ese participante ya existe en el torneo.")
    player.nickname = nickname
    player.display_name = nickname
    db.commit()
    db.refresh(player)
    return player


def delete_player(db: Session, player: models.Player) -> None:
    membership = (
        db.query(models.TeamMember)
        .filter(models.TeamMember.player_id == player.id)
        .first()
    )
    if membership is not None:
        raise ValueError("No se puede eliminar un participante que ya tiene equipo.")
    db.delete(player)
    db.commit()


def clear_players_if_unlocked(db: Session, tournament: models.Tournament) -> None:
    tournament = apply_tournament_windows(db, tournament)
    if tournament.roster_status == ROSTER_LOCKED:
        raise ValueError("No se pueden limpiar participantes con roster locked.")
    if has_results(db, tournament.id):
        raise ValueError("No se pueden limpiar participantes si ya existen resultados.")
    if get_teams_by_tournament(db, tournament.id):
        raise ValueError("No se pueden limpiar participantes si ya existen equipos.")
    db.query(models.Player).filter(models.Player.tournament_id == tournament.id).delete(
        synchronize_session=False
    )
    db.commit()


def add_player_to_team(
    db: Session,
    team: models.Team,
    player: models.Player,
) -> models.Team:
    tournament = get_tournament(db, team.tournament_id)
    if tournament is not None:
        member_count = (
            db.query(models.TeamMember)
            .filter(models.TeamMember.team_id == team.id)
            .count()
        )
        if member_count >= tournament.team_size:
            raise ValueError(
                f"Team roster is capped at {tournament.team_size} players for this engine"
            )

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
        .options(selectinload(models.Match.maps))
        .filter(models.Match.tournament_id == tournament_id)
        .order_by(models.Match.round.asc(), models.Match.id.asc())
        .all()
    )


def get_match(db: Session, match_id: int) -> models.Match | None:
    return (
        db.query(models.Match)
        .options(selectinload(models.Match.maps))
        .filter(models.Match.id == match_id)
        .first()
    )


def get_match_maps_won(match: models.Match) -> tuple[int, int]:
    maps_won_a = 0
    maps_won_b = 0
    for item in match.maps:
        if item.map_winner_id == match.team_a_id:
            maps_won_a += 1
        elif item.map_winner_id == match.team_b_id:
            maps_won_b += 1
    return maps_won_a, maps_won_b


def build_match_schema(match: models.Match) -> schemas.Match:
    maps_won_a, maps_won_b = get_match_maps_won(match)
    return schemas.Match(
        id=match.id,
        round=match.round,
        status=match.status,
        team_a_id=match.team_a_id,
        team_b_id=match.team_b_id,
        winner_id=match.winner_id,
        best_of=match.best_of,
        next_match_id=match.next_match_id,
        next_slot=match.next_slot,
        tournament_id=match.tournament_id,
        maps=sorted(match.maps, key=lambda item: item.map_number),
        maps_won_a=maps_won_a,
        maps_won_b=maps_won_b,
    )


def _assign_match_slot(match: models.Match, slot: str | None, team_id: int | None) -> None:
    if slot == "a":
        match.team_a_id = team_id
    elif slot == "b":
        match.team_b_id = team_id


def _refresh_match_status(match: models.Match) -> None:
    if match.winner_id is not None:
        match.status = "completed"
    elif match.team_a_id is not None and match.team_b_id is not None:
        match.status = "ready"
    elif match.team_a_id is not None or match.team_b_id is not None:
        match.status = "waiting_opponent"
    else:
        match.status = "pending"


def _propagate_bye_winners(db: Session, matches_by_id: dict[int, models.Match]) -> None:
    changed = True
    while changed:
        changed = False
        for match in sorted(matches_by_id.values(), key=lambda item: (item.round, item.id)):
            if match.winner_id is not None:
                continue
            if match.round == 1 and match.team_a_id is not None and match.team_b_id is None:
                match.winner_id = match.team_a_id
                match.status = "completed"
            elif match.round == 1 and match.team_b_id is not None and match.team_a_id is None:
                match.winner_id = match.team_b_id
                match.status = "completed"
            else:
                _refresh_match_status(match)
                continue

            if match.next_match_id is not None:
                next_match = matches_by_id[match.next_match_id]
                before = (next_match.team_a_id, next_match.team_b_id)
                _assign_match_slot(next_match, match.next_slot, match.winner_id)
                _refresh_match_status(next_match)
                after = (next_match.team_a_id, next_match.team_b_id)
                if after != before:
                    changed = True


def generate_bracket(
    db: Session, tournament: models.Tournament
) -> tuple[list[models.Match], models.Tournament]:
    tournament = apply_tournament_windows(db, tournament)
    teams = get_teams_by_tournament(db, tournament.id)
    bracket_mode = read_tournament_config(tournament).get("bracketMode")
    if bracket_mode == "double_elim":
        raise ValueError("Double elimination todavia no esta implementado para Kill Race.")
    if tournament.roster_status != ROSTER_LOCKED:
        raise ValueError("Solo se puede generar bracket con roster locked.")
    if tournament.bracket_status in {BRACKET_LOCKED, BRACKET_RUNNING, BRACKET_COMPLETED}:
        raise ValueError("El bracket ya esta locked. No se puede regenerar.")
    if tournament.bracket_status != BRACKET_RESPIN_OPEN:
        raise ValueError("Abre la ventana de respin de bracket antes de generar la llave.")

    if len(teams) < 2:
        raise ValueError("At least 2 teams are required to generate a bracket")

    total_slots = 1 << ceil(log2(len(teams)))
    total_rounds = int(log2(total_slots))
    best_of = read_tournament_config(tournament).get("bestOf")
    resolved_best_of = int(best_of) if isinstance(best_of, int) and best_of > 0 else 3
    _cleanup_bracket_matches(db, tournament.id)

    rounds: list[list[models.Match]] = []
    for round_number in range(1, total_rounds + 1):
        match_count = total_slots // (2**round_number)
        round_matches = [
            models.Match(
                round=round_number,
                status="pending",
                team_a_id=None,
                team_b_id=None,
                winner_id=None,
                best_of=resolved_best_of,
                next_match_id=None,
                next_slot=None,
                tournament_id=tournament.id,
            )
            for _ in range(match_count)
        ]
        rounds.append(round_matches)

    all_matches = [match for round_matches in rounds for match in round_matches]
    db.add_all(all_matches)
    db.flush()

    for round_index in range(len(rounds) - 1):
        current_round = rounds[round_index]
        next_round = rounds[round_index + 1]
        for match_index, match in enumerate(current_round):
            parent = next_round[match_index // 2]
            match.next_match_id = parent.id
            match.next_slot = "a" if match_index % 2 == 0 else "b"

    first_round = rounds[0]
    seeded_team_ids = [team.id for team in teams] + [None] * (total_slots - len(teams))
    for match_index, match in enumerate(first_round):
        match.team_a_id = seeded_team_ids[match_index * 2]
        match.team_b_id = seeded_team_ids[match_index * 2 + 1]
        _refresh_match_status(match)

    matches_by_id = {match.id: match for match in all_matches}
    _propagate_bye_winners(db, matches_by_id)

    tournament.status = "bracket_generated"
    db.commit()

    for match in all_matches:
        db.refresh(match)
    db.refresh(tournament)

    return all_matches, tournament


def _get_assigned_player_ids(db: Session, tournament_id: int) -> set[int]:
    rows = (
        db.query(models.TeamMember.player_id)
        .join(models.Team, models.Team.id == models.TeamMember.team_id)
        .filter(models.Team.tournament_id == tournament_id)
        .all()
    )
    return {row[0] for row in rows}


def _cleanup_roulette_teams(db: Session, tournament_id: int) -> None:
    match_ids = [
        match_id
        for (match_id,) in db.query(models.Match.id)
        .filter(models.Match.tournament_id == tournament_id)
        .all()
    ]
    if match_ids:
        db.query(models.MatchMap).filter(
            models.MatchMap.match_id.in_(match_ids)
        ).delete(synchronize_session=False)
        db.query(models.TeamResult).filter(
            models.TeamResult.match_id.in_(match_ids)
        ).delete(synchronize_session=False)
        db.query(models.Match).filter(models.Match.id.in_(match_ids)).delete(
            synchronize_session=False
        )

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
    tournament = apply_tournament_windows(db, tournament)
    if has_results(db, tournament.id):
        raise ValueError("No se puede regenerar ruleta si ya existen resultados.")
    if tournament.roster_status == ROSTER_LOCKED:
        raise ValueError("El roster ya esta locked. No se puede regenerar equipos.")
    if get_roulette_timer_state(tournament) == ROULETTE_TIMER_CLOSED:
        raise ValueError("El respin de roster esta cerrado. Reabre o reinicia antes de generar equipos.")
    team_size = resolve_roulette_team_size(tournament)
    minimum_players = team_size * 2
    if payload.reset:
        _cleanup_roulette_teams(db, tournament.id)

    players = get_players_by_tournament(db, tournament.id)
    if len(players) < minimum_players:
        raise ValueError(
            f"Faltan participantes para generar equipos: tienes {len(players)}, necesitas mínimo {minimum_players}."
        )

    assigned_player_ids = _get_assigned_player_ids(db, tournament.id)
    available_players = [player for player in players if player.id not in assigned_player_ids]
    if len(available_players) < minimum_players:
        raise ValueError(
            f"Faltan participantes para generar equipos: tienes {len(available_players)}, necesitas mínimo {minimum_players}."
        )

    seed = payload.shuffle_seed if payload.shuffle_seed is not None else payload.seed
    seed_value = str(seed) if seed is not None else str(datetime.now(tz=UTC).timestamp())
    rng = random.Random(seed_value)
    rng.shuffle(available_players)

    created_team_ids: list[int] = []
    next_team_index = _next_roulette_team_index(db, tournament.id)

    for index in range(0, len(available_players), team_size):
        chunk = available_players[index : index + team_size]
        if len(chunk) < team_size:
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

    bench_start = len(created_team_ids) * team_size
    bench = available_players[bench_start:]

    tournament.team_size = team_size
    if team_size == 2:
        tournament.format = "roulette_2v2"
    elif team_size == 3:
        tournament.format = "roulette_3v3"
    elif team_size == 4:
        tournament.format = "battle_royale_points"
    tournament.status = "teams_generated"
    tournament.bracket_status = BRACKET_PENDING
    tournament.bracket_respin_deadline_at = None
    tournament.bracket_locked_at = None
    config = read_tournament_config(tournament)
    config.update(
        {
            "rouletteGeneratedAt": datetime.now(tz=UTC).isoformat(),
            "rouletteSeed": seed_value,
            "rouletteTeamSize": team_size,
            "rouletteBench": [player.nickname for player in bench],
            "rouletteStatus": "confirmed" if payload.confirm else "generated",
        }
    )
    tournament.config = json.dumps(config) if config else None
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


def upsert_map_result(
    db: Session,
    tournament: models.Tournament,
    match: models.Match,
    payload: schemas.MapResultUpsert,
) -> schemas.Match:
    if get_engine_key(tournament) not in KILL_RACE_ENGINE_KEYS:
        raise ValueError("This endpoint is only available for Kill Race tournaments")
    if payload.match_id != match.id:
        raise ValueError("Payload match_id does not match path match_id")
    if match.team_a_id is None or match.team_b_id is None:
        raise ValueError("El match todavia no tiene dos equipos listos.")
    if match.winner_id is not None:
        raise ValueError("La serie ya esta cerrada.")
    if payload.map_number > match.best_of:
        raise ValueError(f"El BO{match.best_of} no admite mapa {payload.map_number}.")
    if payload.kills_a == payload.kills_b:
        raise ValueError("Empate de kills en un mapa: define desempate manual antes de guardar.")

    map_winner_id = match.team_a_id if payload.kills_a > payload.kills_b else match.team_b_id
    db_map = (
        db.query(models.MatchMap)
        .filter(
            models.MatchMap.match_id == match.id,
            models.MatchMap.map_number == payload.map_number,
        )
        .first()
    )

    if db_map is None:
        db_map = models.MatchMap(
            match_id=match.id,
            map_number=payload.map_number,
            kills_a=payload.kills_a,
            kills_b=payload.kills_b,
            map_winner_id=map_winner_id,
        )
        db.add(db_map)
    else:
        db_map.kills_a = payload.kills_a
        db_map.kills_b = payload.kills_b
        db_map.map_winner_id = map_winner_id

    if tournament.bracket_status == BRACKET_LOCKED:
        tournament.bracket_status = BRACKET_RUNNING

    db.flush()

    maps_won_a, maps_won_b = get_match_maps_won(match)
    wins_needed = ceil(match.best_of / 2)
    if maps_won_a >= wins_needed or maps_won_b >= wins_needed:
        winner_id = match.team_a_id if maps_won_a > maps_won_b else match.team_b_id
        match.winner_id = winner_id
        match.status = "completed"
        if match.next_match_id is not None:
            next_match = get_match(db, match.next_match_id)
            if next_match is not None:
                _assign_match_slot(next_match, match.next_slot, winner_id)
                _refresh_match_status(next_match)
        elif tournament.bracket_status in {BRACKET_LOCKED, BRACKET_RUNNING}:
            tournament.bracket_status = BRACKET_COMPLETED
    else:
        match.status = "in_progress"

    db.commit()
    refreshed = get_match(db, match.id)
    if refreshed is None:
        raise ValueError("Match not found after update")
    return build_match_schema(refreshed)


def _cleanup_bracket_matches(db: Session, tournament_id: int) -> None:
    match_ids = [
        match_id
        for (match_id,) in db.query(models.Match.id)
        .filter(models.Match.tournament_id == tournament_id)
        .all()
    ]
    if not match_ids:
        return
    db.query(models.MatchMap).filter(
        models.MatchMap.match_id.in_(match_ids)
    ).delete(synchronize_session=False)
    db.query(models.TeamResult).filter(
        models.TeamResult.match_id.in_(match_ids)
    ).delete(synchronize_session=False)
    db.query(models.Match).filter(
        models.Match.id.in_(match_ids)
    ).delete(synchronize_session=False)
    db.flush()


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
