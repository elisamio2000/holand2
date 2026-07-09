"""Alembic environment — async SQLAlchemy with auto-import of all models."""

import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# ── Import all models so Alembic can detect them ────────────────────────────
# Keep this import block up-to-date as new model files are added.
from app.models.base import Base  # noqa: F401
# Phase 1 models — uncomment after creating each file:
# from app.models.user import User  # noqa: F401
# Phase 2 models:
# from app.models.assessment import (  # noqa: F401
#     Assessment, AssessmentVersion, Question, QuestionOption, ScoringFormula,
# )
# Phase 3 models:
# from app.models.session import AssessmentSession, SessionAnswer, SessionResult  # noqa: F401
from app.models.job import Job, Major  # noqa: F401
from app.models.recommendation import Recommendation  # noqa: F401
# Phase 5 models:
from app.models.report import Report  # noqa: F401
# Phase 9 models:
# from app.models.event import Event  # noqa: F401

# ── Alembic Config ───────────────────────────────────────────────────────────
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Override URL from app settings (reads .env)
import os
from app.config import get_settings

settings = get_settings()
# Alembic uses sync URL for migrations — swap asyncpg → psycopg2-style
sync_url = settings.database_url.replace(
    "postgresql+asyncpg://", "postgresql+psycopg2://"
)
config.set_main_option("sqlalchemy.url", sync_url)

target_metadata = Base.metadata


# ── Run migrations ───────────────────────────────────────────────────────────
def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
