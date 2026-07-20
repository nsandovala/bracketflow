from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import declarative_base, sessionmaker


DATABASE_URL = f"sqlite:///{Path(__file__).resolve().parent.parent / 'bracketflow.db'}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def _sqlite_has_match_team_unique_index(db_engine: Engine) -> bool:
    with db_engine.begin() as connection:
        indexes = connection.exec_driver_sql("PRAGMA index_list(team_results)").all()
        for _, index_name, is_unique, *_ in indexes:
            if not is_unique:
                continue
            columns = [
                row[2]
                for row in connection.exec_driver_sql(f"PRAGMA index_info('{index_name}')").all()
            ]
            if columns == ["match_id", "team_id"]:
                return True
    return False


def _sqlite_duplicate_match_team_rows(db_engine: Engine) -> list[tuple[int, int, int, str]]:
    with db_engine.begin() as connection:
        duplicates = connection.exec_driver_sql(
            """
            SELECT
                match_id,
                team_id,
                COUNT(*) AS duplicate_count,
                GROUP_CONCAT(id) AS result_ids
            FROM team_results
            GROUP BY match_id, team_id
            HAVING COUNT(*) > 1
            ORDER BY match_id, team_id
            """
        ).all()
    return [
        (
            int(match_id),
            int(team_id),
            int(duplicate_count),
            str(result_ids),
        )
        for match_id, team_id, duplicate_count, result_ids in duplicates
    ]


def ensure_sqlite_schema(db_engine: Engine | None = None) -> None:
    db_engine = db_engine or engine
    if db_engine.dialect.name != "sqlite":
        return

    with db_engine.begin() as connection:
        columns = {
            row[1]
            for row in connection.exec_driver_sql("PRAGMA table_info(tournaments)").all()
        }
        if columns and "config" not in columns:
            connection.exec_driver_sql("ALTER TABLE tournaments ADD COLUMN config TEXT NULL")
        if columns:
            if "roster_status" not in columns:
                connection.exec_driver_sql(
                    "ALTER TABLE tournaments ADD COLUMN roster_status TEXT NOT NULL DEFAULT 'participants_pending'"
                )
            if "roster_respin_deadline_at" not in columns:
                connection.exec_driver_sql(
                    "ALTER TABLE tournaments ADD COLUMN roster_respin_deadline_at TEXT NULL"
                )
            if "roster_locked_at" not in columns:
                connection.exec_driver_sql(
                    "ALTER TABLE tournaments ADD COLUMN roster_locked_at TEXT NULL"
                )
            if "bracket_status" not in columns:
                connection.exec_driver_sql(
                    "ALTER TABLE tournaments ADD COLUMN bracket_status TEXT NOT NULL DEFAULT 'pending'"
                )
            if "bracket_respin_deadline_at" not in columns:
                connection.exec_driver_sql(
                    "ALTER TABLE tournaments ADD COLUMN bracket_respin_deadline_at TEXT NULL"
                )
            if "bracket_locked_at" not in columns:
                connection.exec_driver_sql(
                    "ALTER TABLE tournaments ADD COLUMN bracket_locked_at TEXT NULL"
                )

        player_columns = {
            row[1]
            for row in connection.exec_driver_sql("PRAGMA table_info(players)").all()
        }
        if player_columns:
            if "display_name" not in player_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE players ADD COLUMN display_name TEXT NULL"
                )
            if "activision_id" not in player_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE players ADD COLUMN activision_id TEXT NULL"
                )

        match_columns = {
            row[1]
            for row in connection.exec_driver_sql("PRAGMA table_info(matches)").all()
        }
        if match_columns:
            if "best_of" not in match_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE matches ADD COLUMN best_of INTEGER NOT NULL DEFAULT 3"
                )
            if "next_match_id" not in match_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE matches ADD COLUMN next_match_id INTEGER NULL"
                )
            if "next_slot" not in match_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE matches ADD COLUMN next_slot TEXT NULL"
                )

        connection.exec_driver_sql(
            """
            CREATE TABLE IF NOT EXISTS match_maps (
                id INTEGER PRIMARY KEY,
                match_id INTEGER NOT NULL,
                map_number INTEGER NOT NULL,
                kills_a INTEGER NOT NULL DEFAULT 0,
                kills_b INTEGER NOT NULL DEFAULT 0,
                map_winner_id INTEGER NULL,
                FOREIGN KEY(match_id) REFERENCES matches(id),
                FOREIGN KEY(map_winner_id) REFERENCES teams(id)
            )
            """
        )

    with db_engine.begin() as connection:
        team_result_columns = {
            row[1]
            for row in connection.exec_driver_sql("PRAGMA table_info(team_results)").all()
        }
    if not team_result_columns or _sqlite_has_match_team_unique_index(db_engine):
        return

    duplicates = _sqlite_duplicate_match_team_rows(db_engine)
    if duplicates:
        sample = "; ".join(
            f"match_id={match_id}, team_id={team_id}, count={duplicate_count}, ids={result_ids}"
            for match_id, team_id, duplicate_count, result_ids in duplicates[:5]
        )
        raise RuntimeError(
            "No se pudo aplicar la unicidad de team_results(match_id, team_id) porque "
            f"ya existen reportes oficiales duplicados: {sample}"
        )

    with db_engine.begin() as connection:
        connection.exec_driver_sql(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS uq_team_results_match_team
            ON team_results (match_id, team_id)
            """
        )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
