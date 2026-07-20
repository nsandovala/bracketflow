import pytest
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from app.database import Base, ensure_sqlite_schema


def create_sqlite_engine():
    return create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )


def create_legacy_team_results_table(engine):
    with engine.begin() as connection:
        connection.exec_driver_sql(
            """
            CREATE TABLE team_results (
                id INTEGER PRIMARY KEY,
                tournament_id INTEGER NOT NULL,
                match_id INTEGER NOT NULL,
                team_id INTEGER NOT NULL,
                kills INTEGER NOT NULL DEFAULT 0,
                placement INTEGER NOT NULL,
                kill_points FLOAT NOT NULL DEFAULT 0,
                placement_points FLOAT NOT NULL DEFAULT 0,
                total_points FLOAT NOT NULL DEFAULT 0
            )
            """
        )


def unique_indexes_for_match_team(engine) -> list[str]:
    with engine.begin() as connection:
        indexes = connection.exec_driver_sql("PRAGMA index_list(team_results)").all()
        names: list[str] = []
        for _, index_name, is_unique, *_ in indexes:
            if not is_unique:
                continue
            columns = [
                row[2]
                for row in connection.exec_driver_sql(f"PRAGMA index_info('{index_name}')").all()
            ]
            if columns == ["match_id", "team_id"]:
                names.append(index_name)
        return names


def test_ensure_sqlite_schema_creates_match_team_unique_index_for_legacy_table():
    engine = create_sqlite_engine()
    create_legacy_team_results_table(engine)

    ensure_sqlite_schema(engine)

    assert unique_indexes_for_match_team(engine) == ["uq_team_results_match_team"]


def test_ensure_sqlite_schema_rejects_preexisting_duplicate_reports():
    engine = create_sqlite_engine()
    create_legacy_team_results_table(engine)
    with engine.begin() as connection:
        connection.exec_driver_sql(
            """
            INSERT INTO team_results (
                id, tournament_id, match_id, team_id, kills, placement,
                kill_points, placement_points, total_points
            ) VALUES
                (1, 1, 10, 20, 7, 1, 7, 2, 14),
                (2, 1, 10, 20, 9, 2, 9, 1.8, 16.2)
            """
        )

    with pytest.raises(RuntimeError, match="reportes oficiales duplicados"):
        ensure_sqlite_schema(engine)

    assert unique_indexes_for_match_team(engine) == []


def test_ensure_sqlite_schema_keeps_existing_match_team_unique_index():
    engine = create_sqlite_engine()
    Base.metadata.create_all(engine)

    ensure_sqlite_schema(engine)

    assert len(unique_indexes_for_match_team(engine)) == 1
