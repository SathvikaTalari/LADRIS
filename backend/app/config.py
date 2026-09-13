"""
LADRIS — Application Configuration
Loads all settings from environment variables / .env file.
"""
from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict



class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ─── Application ─────────────────────────────────────────────────────────
    APP_ENV: str = "development"
    APP_NAME: str = "LADRIS"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    # ─── Database ─────────────────────────────────────────────────────────────
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "ladris"
    POSTGRES_USER: str = "ladris_user"
    POSTGRES_PASSWORD: str = "landpulse_pass"

    @property
    def effective_host(self) -> str:
        host = self.POSTGRES_HOST
        if host == "db":
            try:
                import socket
                socket.gethostbyname("db")
            except OSError:
                return "localhost"
        return host

    @property
    def effective_port(self) -> int:
        if self.effective_host in ("localhost", "127.0.0.1") and self.POSTGRES_PORT == 5432:
            try:
                import socket
                with socket.create_connection(("127.0.0.1", 15432), timeout=0.3):
                    return 15432
            except OSError:
                pass
        return self.POSTGRES_PORT

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.effective_host}:{self.effective_port}/{self.POSTGRES_DB}"
        )

    @property
    def SYNC_DATABASE_URL(self) -> str:
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.effective_host}:{self.effective_port}/{self.POSTGRES_DB}"
        )

    # ─── JWT ──────────────────────────────────────────────────────────────────
    JWT_SECRET_KEY: str = "01fd109a6c2887b1253cf7d8d77b4a1149f1bfeb38a22750ef7b137b4d5aa060"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ─── Security ─────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    BCRYPT_ROUNDS: int = 12

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

    # ─── Server ───────────────────────────────────────────────────────────────
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000

    # ─── Data.gov.in Integration ──────────────────────────────────────────────
    DATAGOV_API_KEY: str = ""
    # Get free API key at: https://data.gov.in (click Register → My Account → Generate API Key)

    # ─── BhoomiRashi Scraper Settings ────────────────────────────────────────
    BHOOMIRASHI_SCRAPE_DELAY_SECONDS: float = 2.0   # polite crawl delay
    BHOOMIRASHI_MAX_PROJECTS_PER_STATE: int = 500   # cap per state
    BHOOMIRASHI_TIMEOUT_SECONDS: float = 30.0

    # ─── ETL Settings ─────────────────────────────────────────────────────────
    ETL_BATCH_SIZE: int = 50                        # DB upsert batch size
    ETL_DATA_DIR: str = "data"                      # relative to backend/

    # ─── First Admin Seed ─────────────────────────────────────────────────────
    FIRST_ADMIN_EMAIL: str = "admin@ladris.gov.in"
    FIRST_ADMIN_PASSWORD: str = ""
    FIRST_ADMIN_NAME: str = "System Administrator"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
