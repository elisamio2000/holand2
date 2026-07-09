"""App-wide settings loaded from environment / .env file."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Application
    app_env: str = "development"
    debug: bool = True
    app_secret_key: str = "change-this-secret-key-in-production-min-32-chars"

    # Server
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    # Database
    database_url: str = "postgresql+asyncpg://holand:holand_dev_pass@localhost:5432/holand_db"
    database_pool_size: int = 5
    database_max_overflow: int = 10

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # JWT
    jwt_secret_key: str = "change-this-jwt-secret-min-32-chars"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 15
    jwt_refresh_token_expire_days: int = 7

    # CORS
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    # Trusted hosts (comma-separated). "*" disables the check (dev default).
    allowed_hosts: str = "*"

    @property
    def allowed_hosts_list(self) -> list[str]:
        return [h.strip() for h in self.allowed_hosts.split(",") if h.strip()]

    # Rate Limiting
    rate_limit_login_per_minute: int = 5
    rate_limit_assessment_start_per_hour: int = 10
    rate_limit_analytics_events_per_minute: int = 60
    rate_limit_expert_lab_writes_per_minute: int = 30

    # Storage
    storage_backend: str = "local"
    storage_local_path: str = "./storage"


@lru_cache
def get_settings() -> Settings:
    return Settings()
