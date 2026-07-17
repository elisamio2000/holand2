"""Schemas package.

Expose all schema models from app.schemas so callers can import
`from app.schemas import AvatarUploadResponse` (and other Pydantic models).
"""

from .schemas import *  # noqa: F401,F403
