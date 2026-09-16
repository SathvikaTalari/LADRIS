import os
from pathlib import Path

try:
    from dotenv import load_dotenv
    # Load .env from land-delay-predictor directory
    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
    load_dotenv()
except ImportError:
    pass

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.schema import Base
from app.db.staging import RawRecord  # noqa: F401 - import registers the table on Base.metadata

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql+psycopg2://ladris_user:landpulse_pass@localhost:15432/land_delay"
)

engine = create_engine(DATABASE_URL, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def init_db() -> None:
    Base.metadata.create_all(engine)
    print(f"Tables created against {DATABASE_URL}")


def get_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


if __name__ == "__main__":
    init_db()
