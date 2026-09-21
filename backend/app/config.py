"""
LADRIS — Application Configuration
Loads all settings from environment variables / .env file.
"""
from functools import lru_cache
from typing import List
from pathlib import Path
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
    POSTGRES_PORT: int = 15432
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
        if self.effective_host in ("localhost", "127.0.0.1"):
            import socket
            try:
                with socket.create_connection(("127.0.0.1", self.POSTGRES_PORT), timeout=0.3):
                    return self.POSTGRES_PORT
            except OSError:
                alt = 5432 if self.POSTGRES_PORT == 15432 else 15432
                try:
                    with socket.create_connection(("127.0.0.1", alt), timeout=0.3):
                        return alt
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

    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000

    # ─── Email & Notifications (SMTP) ────────────────────────────────────────
    SMTP_ENABLED: bool = True
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "alerts@ladris.gov.in"
    SMTP_FROM_NAME: str = "LADRIS Delay Intelligence"
    SMTP_USE_TLS: bool = True
    APP_FRONTEND_URL: str = "http://localhost:5173"
    DEFAULT_ALERT_EMAIL: str = "officer@ladris.gov.in"

    # ─── SMS Notifications (Twilio) ───────────────────────────────────────────
    SMS_ENABLED: bool = False
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_FROM_NUMBER: str = ""

    # ─── Data.gov.in Integration ──────────────────────────────────────────────
    DATAGOV_API_KEY: str = ""
    # Get free API key at: https://data.gov.in (click Register → My Account → Generate API Key)

    # ─── BhoomiRashi Scraper Settings ────────────────────────────────────────
    BHOOMIRASHI_SCRAPE_DELAY_SECONDS: float = 2.0   # polite crawl delay
    BHOOMIRASHI_MAX_PROJECTS_PER_STATE: int = 500   # cap per state
    BHOOMIRASHI_TIMEOUT_SECONDS: float = 30.0

    # ─── ETL & Ingestion Settings ─────────────────────────────────────────────
    ETL_BATCH_SIZE: int = 50                        # DB upsert batch size
    ETL_DATA_DIR: str = "data"                      # relative to backend/
    INGESTION_UPLOAD_DIR: str = "data/uploads"
    INGESTION_MAX_FILE_SIZE_MB: int = 50
    INGESTION_API_KEY: str = "ladris-secure-api-key-default"
    EXTERNAL_DB_URL: str = ""

    # ─── Live Datasource Sync Engine ─────────────────────────────────────────
    LIVE_SYNC_ENABLED: bool = True
    LIVE_SYNC_POLL_INTERVAL_SECS: int = 60     # how often the background poller wakes up
    LIVE_SYNC_MAX_FAILURES: int = 5            # disable job after this many consecutive errors
    LIVE_SYNC_REQUEST_TIMEOUT_SECS: float = 20.0  # HTTP request timeout for REST_API syncs
    # Fernet symmetric key for encrypting stored credentials (connection URLs, API keys).
    # Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    # If empty, a deterministic fallback is used (NOT for production).
    FERNET_ENCRYPTION_KEY: str = ""

    # Existing trained LightGBM module (never retrained by request handlers)
    @staticmethod
    def _get_ml_root() -> Path:
        base = Path(__file__).resolve().parents[2]
        for folder in ["land-delay-predictor", "land-delay-prediction", "ml"]:
            candidate = base / folder
            if candidate.exists() and (candidate / "models").exists():
                return candidate
        if (base / "land-delay-predictor").exists():
            return base / "land-delay-predictor"
        return base / "land-delay-predictor"

    ML_MODULE_PATH: str = str(_get_ml_root() / "app")
    MODELS_DIR: str = str(_get_ml_root() / "models")
    ML_PREDICTION_STALE_HOURS: int = 24

    @property
    def resolved_ml_module_path(self) -> str:
        ml_path = self.ML_MODULE_PATH
        if ml_path:
            p = Path(ml_path)
            if p.is_absolute() and p.exists():
                return str(p)
            base_root = Path(__file__).resolve().parents[2]
            clean = ml_path.replace("\\", "/")
            for prefix in ["./", "../", ".\\", "..\\"]:
                while clean.startswith(prefix):
                    clean = clean[len(prefix):]
            for candidate in [base_root / clean, Path(__file__).resolve().parents[1] / clean, Path.cwd() / clean]:
                if candidate.exists():
                    return str(candidate)
        return str(self._get_ml_root() / "app")

    @property
    def resolved_models_dir(self) -> str:
        models_path = self.MODELS_DIR
        if models_path:
            p = Path(models_path)
            if p.is_absolute() and p.exists():
                return str(p)
            base_root = Path(__file__).resolve().parents[2]
            clean = models_path.replace("\\", "/")
            for prefix in ["./", "../", ".\\", "..\\"]:
                while clean.startswith(prefix):
                    clean = clean[len(prefix):]
            for candidate in [base_root / clean, Path(__file__).resolve().parents[1] / clean, Path.cwd() / clean]:
                if candidate.exists():
                    return str(candidate)
        return str(self._get_ml_root() / "models")

    # ─── Project CSV Source ─────────────────────────────────────────────────
    # Runtime project inputs. Training data remains separate and read-only.
    PROJECT_DATA_CSV: str = str(_get_ml_root() / "my_raw_projects.csv")
    SYNC_PROJECTS_FROM_CSV: bool = True
    PROJECT_CSV_EXCLUSIVE: bool = True

    @property
    def resolved_project_data_csv(self) -> str:
        csv_path = self.PROJECT_DATA_CSV
        if csv_path:
            p = Path(csv_path)
            if p.is_absolute() and p.exists():
                return str(p)
            base_root = Path(__file__).resolve().parents[2]
            clean = csv_path.replace("\\", "/")
            for prefix in ["./", "../", ".\\", "..\\"]:
                while clean.startswith(prefix):
                    clean = clean[len(prefix):]
            for candidate in [base_root / clean, Path(__file__).resolve().parents[1] / clean, Path.cwd() / clean]:
                if candidate.exists():
                    return str(candidate)
        return str(self._get_ml_root() / "my_raw_projects.csv")

    # ─── First Admin Seed ─────────────────────────────────────────────────────
    FIRST_ADMIN_EMAIL: str = "admin@ladris.gov.in"
    FIRST_ADMIN_PASSWORD: str = ""
    FIRST_ADMIN_NAME: str = "System Administrator"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
