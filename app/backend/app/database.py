from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


DATABASE_URL = f"sqlite:///{Path(__file__).resolve().parent.parent / 'bracketflow.db'}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def ensure_sqlite_schema() -> None:
    if engine.dialect.name != "sqlite":
        return

    with engine.begin() as connection:
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


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
