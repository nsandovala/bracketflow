import csv
import io
import re
from dataclasses import dataclass

from . import schemas


def _key(value: str) -> str:
    return " ".join(value.casefold().strip().split())


@dataclass(frozen=True)
class PlayerRef:
    id: int
    name: str
    team_id: int
    side: str


def _issue(code: str, message: str, row: int | None = None) -> schemas.KillRaceImportIssue:
    return schemas.KillRaceImportIssue(code=code, message=message, row=row)


def _parse_txt(content: str) -> tuple[int | None, list[dict[str, object]], list[schemas.KillRaceImportIssue]]:
    lines = [(number, raw.strip()) for number, raw in enumerate(content.splitlines(), 1) if raw.strip()]
    match_number: int | None = None
    explicit_side: str | None = None
    rows: list[dict[str, object]] = []
    errors: list[schemas.KillRaceImportIssue] = []
    for number, line in lines:
        match_value = re.fullmatch(r"MATCH\s*:?\s*(\d+)", line, re.IGNORECASE)
        if match_value:
            value = int(match_value.group(1))
            if match_number is not None and match_number != value:
                errors.append(_issue("mixed_matches", "No se pueden mezclar partidas.", number))
            match_number = value
            continue
        side_value = re.fullmatch(r"(LEFT|RIGHT)\s*:\s*(.+)", line, re.IGNORECASE)
        if side_value:
            explicit_side = side_value.group(1).lower()
            continue
        stat_value = re.fullmatch(r"(.+?)\s*[:,]\s*(-?\d+)", line)
        if stat_value:
            rows.append(
                {
                    "row": number,
                    "side": explicit_side,
                    "player": stat_value.group(1).strip(),
                    "kills": int(stat_value.group(2)),
                }
            )
            continue
        errors.append(_issue("invalid_row", f"Fila TXT no reconocida: {line}", number))
    return match_number, rows, errors


def _parse_csv(content: str) -> tuple[int | None, list[dict[str, object]], list[schemas.KillRaceImportIssue]]:
    errors: list[schemas.KillRaceImportIssue] = []
    rows: list[dict[str, object]] = []
    try:
        reader = csv.DictReader(io.StringIO(content))
        required = {"match", "side", "team", "player", "kills"}
        if not reader.fieldnames or {_key(field) for field in reader.fieldnames} != required:
            return None, [], [_issue("invalid_columns", "CSV requiere: match,side,team,player,kills")]
        match_numbers: set[int] = set()
        for row_number, raw in enumerate(reader, 2):
            normalized = {_key(key): (value or "").strip() for key, value in raw.items()}
            try:
                match_number = int(normalized["match"])
                kills = int(normalized["kills"])
            except ValueError:
                errors.append(_issue("invalid_integer", "Match y kills deben ser enteros.", row_number))
                continue
            match_numbers.add(match_number)
            rows.append(
                {
                    "row": row_number,
                    "side": _key(normalized["side"]),
                    "team": normalized["team"],
                    "player": normalized["player"],
                    "kills": kills,
                }
            )
        if len(match_numbers) > 1:
            errors.append(_issue("mixed_matches", "No se pueden mezclar partidas."))
        return next(iter(match_numbers), None), rows, errors
    except csv.Error as error:
        return None, [], [_issue("invalid_csv", f"CSV inválido: {error}")]


def build_preview(
    *,
    format: str,
    content: str,
    match_id: int,
    expected_map_number: int | None,
    left_team_id: int,
    left_team_name: str,
    right_team_id: int,
    right_team_name: str,
    players: list[PlayerRef],
) -> schemas.KillRaceImportPreview:
    parsed_match, rows, errors = (
        _parse_csv(content) if format == "csv" else _parse_txt(content)
    )
    conflicts: list[schemas.KillRaceImportIssue] = []
    if parsed_match is not None and expected_map_number is not None and parsed_match != expected_map_number:
        errors.append(_issue("wrong_match", f"El archivo corresponde a partida {parsed_match}, no {expected_map_number}."))

    by_name: dict[str, list[PlayerRef]] = {}
    for player in players:
        by_name.setdefault(_key(player.name), []).append(player)
    resolved: dict[str, list[schemas.KillRacePlayerInput]] = {"left": [], "right": []}
    seen: set[int] = set()
    for row in rows:
        row_number = int(row["row"])
        kills = int(row["kills"])
        if kills < 0:
            errors.append(_issue("invalid_kills", "Kills debe ser entero >= 0.", row_number))
            continue
        candidates = by_name.get(_key(str(row["player"])), [])
        if not candidates:
            conflicts.append(_issue("unknown_player", f"Jugador desconocido: {row['player']}", row_number))
            continue
        if len(candidates) != 1:
            conflicts.append(_issue("ambiguous_player", f"Nombre ambiguo: {row['player']}", row_number))
            continue
        player = candidates[0]
        supplied_side = row.get("side")
        if supplied_side not in (None, "", "left", "right"):
            errors.append(_issue("unknown_side", f"Side desconocido: {supplied_side}", row_number))
            continue
        if supplied_side and supplied_side != player.side:
            errors.append(_issue("wrong_team", f"{player.name} no pertenece al lado {supplied_side}.", row_number))
            continue
        expected_team = left_team_name if player.side == "left" else right_team_name
        if row.get("team") and _key(str(row["team"])) != _key(expected_team):
            conflicts.append(_issue("team_name_conflict", f"Equipo '{row['team']}' no coincide con '{expected_team}'.", row_number))
            continue
        if player.id in seen:
            errors.append(_issue("duplicate_player", f"Jugador duplicado: {player.name}", row_number))
            continue
        seen.add(player.id)
        resolved[player.side].append(
            schemas.KillRacePlayerInput(player_id=player.id, player_name=player.name, kills=kills)
        )

    for side in ("left", "right"):
        if len(resolved[side]) != 2:
            errors.append(_issue("invalid_roster_size", f"El lado {side} debe resolver exactamente dos jugadores."))

    def build_side(side: str) -> schemas.KillRaceSideInput | None:
        if len(resolved[side]) != 2:
            return None
        return schemas.KillRaceSideInput(
            side=side,
            team_id=left_team_id if side == "left" else right_team_id,
            team_name=left_team_name if side == "left" else right_team_name,
            players=resolved[side],
            total_kills=sum(player.kills for player in resolved[side]),
        )

    left = build_side("left")
    right = build_side("right")
    return schemas.KillRaceImportPreview(
        valid=not errors and not conflicts and left is not None and right is not None,
        match_id=match_id,
        map_number=parsed_match or expected_map_number,
        left=left,
        right=right,
        errors=errors,
        conflicts=conflicts,
    )
