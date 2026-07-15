"""Run/participant code generation (Phase B: Assessment Runtime Integrity).

``run_code``: a short, human-friendly identifier for a single assessment
session run. It is distinct from the internal UUID ``AssessmentSession.id``
and safe to surface in support tooling, printouts, or QR codes without
leaking the primary key. Uses a Crockford-style base32 alphabet (no
ambiguous 0/O/1/I/L) plus a trailing checksum character so a single
mistyped character can be detected client-side before hitting the API.

``participant_code``: a pseudonymous identifier that ties multiple sessions
together for the *same* participant without requiring authentication. It is
deterministic for authenticated users (derived from ``user_id``, stable
across sessions) and randomly generated — then persisted for reuse — for
anonymous/device-based flows, since there is no stable server-side identity
to derive from in that case.

Collision handling is the caller's responsibility: generation is retried by
the caller against the database's unique constraint (see
``routers/sessions.py``); this module only produces candidates.
"""

from __future__ import annotations

import hashlib
import secrets

# Crockford base32 alphabet, ambiguous characters (0/O, 1/I/L, U) removed to
# reduce transcription errors when a code is read aloud or handwritten.
_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ"
_RUN_CODE_BODY_LENGTH = 7


def _checksum_char(body: str) -> str:
    """Deterministic single-character checksum over ``body``."""
    digest = hashlib.sha256(body.encode("ascii")).digest()
    index = digest[0] % len(_ALPHABET)
    return _ALPHABET[index]


def generate_run_code() -> str:
    """Generate an 8-character run code: 7 random body chars + 1 checksum char."""
    body = "".join(secrets.choice(_ALPHABET) for _ in range(_RUN_CODE_BODY_LENGTH))
    return f"{body}{_checksum_char(body)}"


def is_valid_run_code(code: str) -> bool:
    """Validate a run code's checksum (format + tamper/typo detection)."""
    if len(code) != _RUN_CODE_BODY_LENGTH + 1:
        return False
    body, checksum = code[:-1], code[-1]
    if any(ch not in _ALPHABET for ch in body):
        return False
    return _checksum_char(body) == checksum


_PARTICIPANT_CODE_LENGTH = 10


def generate_participant_code(user_id: str | None) -> str:
    """Generate/derive a participant code for the given identity.

    - Authenticated users: deterministic (stable hash of ``user_id``), so the
      *same* user always maps to the same participant code across sessions
      without needing to look one up first.
    - Anonymous users: random, since there is no stable server identity to
      derive from; the caller is responsible for persisting and reusing it
      (e.g. via a client-held cookie/localStorage participant hint) so
      repeat visits from the same device can be linked.
    """
    if user_id:
        digest = hashlib.sha256(f"participant:{user_id}".encode("utf-8")).digest()
        return _encode_digest(digest, _PARTICIPANT_CODE_LENGTH)
    random_bytes = secrets.token_bytes(20)
    return _encode_digest(random_bytes, _PARTICIPANT_CODE_LENGTH)


def _encode_digest(data: bytes, length: int) -> str:
    chars = []
    acc = int.from_bytes(data, "big")
    base = len(_ALPHABET)
    for _ in range(length):
        acc, rem = divmod(acc, base)
        chars.append(_ALPHABET[rem])
    return "".join(chars)
