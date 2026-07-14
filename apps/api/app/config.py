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
    rate_limit_recommendation_feedback_per_minute: int = 30

    # Recommendation quality monitor
    recommendation_quality_alert_threshold_percent: float = 35.0
    recommendation_quality_alert_min_samples: int = 10

    # Beta launch readiness thresholds
    beta_completion_rate_threshold_percent: float = 70.0
    beta_completion_min_sessions: int = 10
    beta_5xx_error_rate_threshold_percent: float = 1.0

    # Beta launch ownership
    beta_owner_sre: str = "sre-oncall"
    beta_owner_backend: str = "backend-oncall"
    beta_owner_product: str = "product-oncall"

    # Monitoring / observability
    observability_log_level: str = "INFO"
    sentry_dsn: str | None = None
    sentry_traces_sample_rate: float = 0.1

    # Storage
    storage_backend: str = "local"
    storage_local_path: str = "./storage"
    static_url_prefix: str = "/static"


@lru_cache
def get_settings() -> Settings:
    return Settings()


def get_operational_env_issues(settings: Settings | None = None) -> list[str]:
    current = settings or get_settings()
    issues: list[str] = []
    env = current.app_env.lower()

    if env in {"staging", "production"}:
        if len(current.app_secret_key) < 32 or current.app_secret_key.startswith("change-this-"):
            issues.append("APP_SECRET_KEY must be set to a non-default value with at least 32 chars.")
        if len(current.jwt_secret_key) < 32 or current.jwt_secret_key.startswith("change-this-"):
            issues.append("JWT_SECRET_KEY must be set to a non-default value with at least 32 chars.")
        if "*" in current.allowed_hosts_list:
            issues.append("ALLOWED_HOSTS must be explicitly set (wildcard host is not allowed).")

    return issues
