from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

RIASEC_DIMENSIONS = ["R", "I", "A", "S", "E", "C"]
MBTI_DIMENSIONS = ["E", "I", "S", "N", "T", "F", "J", "P"]


class HealthResponse(BaseModel):
    status: str


# ── Phase 1: Auth & Users ────────────────────────────────────────────────────


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=8, max_length=128)
    email: EmailStr | None = None
    display_name: str | None = Field(default=None, max_length=150)


class RegistrationInfoResponse(BaseModel):
    """Public info the frontend checks before showing the register form."""

    allow_registration: bool = True
    default_role: str = "user"


class LoginRequest(BaseModel):
    username: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class UserSummary(BaseModel):
    id: str
    username: str
    display_name: str | None = None
    email: str | None = None
    roles: list[str]
    is_admin: bool
    is_super_admin: bool = False


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int
    token_type: str = "bearer"
    user: UserSummary


class PermissionsResponse(BaseModel):
    allowed_sections: list[str]
    realm_roles: list[str]


class EffectivePermissionsResponse(BaseModel):
    base_roles: list[str]
    is_admin: bool
    is_super_admin: bool
    global_permissions: list[str]
    allowed_sections: list[str]
    groups: dict[str, object]


class UserResponse(BaseModel):
    id: str
    username: str
    email: str | None = None
    display_name: str | None = None
    avatar_url: str | None = None
    role: str
    permissions: list[str] = []
    is_active: bool
    bio: str | None = None
    timezone: str | None = None
    language: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    display_name: str | None = Field(default=None, max_length=150)
    avatar_url: str | None = None
    bio: str | None = Field(default=None, max_length=500)
    timezone: str | None = None
    language: str | None = None
    is_active: bool | None = None


class HollandRequest(BaseModel):
    scores: dict[str, float] = Field(
        ..., description="RIASEC scores keyed by R, I, A, S, E, C"
    )


class HollandResult(BaseModel):
    normalized_scores: dict[str, float]
    top3_code: str


class MbtiRequest(BaseModel):
    scores: dict[str, float] = Field(
        ..., description="MBTI dimension scores keyed by E, I, S, N, T, F, J, P"
    )


class MbtiResult(BaseModel):
    type_code: str
    certainty: dict[str, float]


class RecommendationRequest(BaseModel):
    holland_code: str = Field(..., min_length=3, max_length=3)
    mbti_type: str = Field(..., min_length=4, max_length=4)


class RecommendationItem(BaseModel):
    title: str
    fit_score: float
    why: str


class RecommendationResponse(BaseModel):
    careers: list[RecommendationItem]
    majors: list[RecommendationItem]
