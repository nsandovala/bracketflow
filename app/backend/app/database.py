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


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
