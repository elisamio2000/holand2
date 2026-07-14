"""Local-disk storage service for user-uploaded files (avatars, etc.).

Security:
- File extension is derived from magic bytes, NOT from the client-supplied
  filename, so path-traversal and polyglot-extension attacks are prevented.
- The stored filename is constructed exclusively from the trusted ``user_id``
  (UUID), never from any untrusted input.
- File size is bounded to ``MAX_AVATAR_BYTES`` before writing.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException, UploadFile, status

MAX_AVATAR_BYTES = 2 * 1024 * 1024  # 2 MB


def _detect_extension(header: bytes) -> str:
    """Return a safe lowercase extension inferred from the file's magic bytes."""
    if header[:4] == b"\x89PNG":
        return "png"
    if header[:3] == b"\xff\xd8\xff":
        return "jpg"
    if header[:4] == b"RIFF" and len(header) >= 12 and header[8:12] == b"WEBP":
        return "webp"
    if header[:3] in (b"GIF", ) and header[3:4] in (b"8", b"9"):
        return "gif"
    raise HTTPException(
        status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
        detail="Only PNG, JPEG, WebP, and GIF images are accepted",
    )


class LocalStorageService:
    """Persist files to the local filesystem and return server-relative URLs."""

    def __init__(self, storage_root: str = "./storage", url_prefix: str = "/static") -> None:
        self._root = Path(storage_root)
        self._url_prefix = url_prefix.rstrip("/")

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _avatars_dir(self) -> Path:
        path = self._root / "avatars"
        path.mkdir(parents=True, exist_ok=True)
        return path

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def save_avatar(self, user_id: str, file: UploadFile) -> str:
        """Validate, read, and persist an avatar upload.

        Returns the server-relative URL (e.g. ``/static/avatars/<user_id>.png``).
        Raises :class:`HTTPException` on validation failure.
        """
        # Read with a +1 sentinel to detect oversized uploads without loading
        # the entire (potentially huge) payload first.
        data = await file.read(MAX_AVATAR_BYTES + 1)
        if len(data) > MAX_AVATAR_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Avatar image must be 2 MB or smaller",
            )
        if not data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty",
            )

        extension = _detect_extension(data[:12])
        # Only user_id (a trusted UUID string) appears in the filename.
        filename = f"{user_id}.{extension}"
        dest = self._avatars_dir() / filename
        dest.write_bytes(data)
        return f"{self._url_prefix}/avatars/{filename}"

    def delete_avatar(self, avatar_url: str | None) -> None:
        """Remove the file referenced by *avatar_url*; silently ignores missing files."""
        if not avatar_url:
            return
        # Extract only the basename — never trust the full stored path.
        basename = Path(avatar_url).name
        dest = self._avatars_dir() / basename
        try:
            dest.unlink()
        except FileNotFoundError:
            pass


# Module-level singleton — created lazily on first request.
_service_instance: LocalStorageService | None = None


def get_storage_service() -> LocalStorageService:
    """Return the module-level :class:`LocalStorageService` singleton."""
    global _service_instance
    if _service_instance is None:
        from ..config import get_settings
        settings = get_settings()
        _service_instance = LocalStorageService(
            storage_root=settings.storage_local_path,
            url_prefix="/static",
        )
    return _service_instance
