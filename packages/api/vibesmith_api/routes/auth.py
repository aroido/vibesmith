"""인증 관련 엔드포인트 (Issue #82)."""

from fastapi import APIRouter, Depends, Request
from vibesmith_core import VibeSmithCore

from vibesmith_api.auth import create_access_token
from vibesmith_api.auth.service import (
    authenticate_user,
    create_session,
    delete_session_by_refresh_token,
    get_session_by_refresh_token,
    get_user_by_id,
    register_user,
)
from vibesmith_api.deps import get_core, get_locale
from vibesmith_api.i18n import KEYS
from vibesmith_api.i18n.exceptions import I18nHTTPException
from vibesmith_api.schemas import (
    RefreshRequest,
    Token,
    UserLogin,
    UserMeResponse,
    UserRegister,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def get_current_user_from_token(request: Request, core: VibeSmithCore):
    """Authorization: Bearer <access_token>에서 현재 사용자를 반환한다."""
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        raise I18nHTTPException(401, KEYS.INVALID_TOKEN)
    token = auth[7:]
    from vibesmith_api.auth import decode_token

    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise I18nHTTPException(401, KEYS.INVALID_TOKEN)
    user_id = payload.get("sub")
    if not user_id:
        raise I18nHTTPException(401, KEYS.INVALID_TOKEN)
    user = get_user_by_id(core.db, user_id)
    if not user:
        raise I18nHTTPException(401, KEYS.INVALID_TOKEN)
    return user


@router.post(
    "/register",
    response_model=Token,
    status_code=201,
    summary="회원가입",
    response_description="등록 성공 시 토큰 반환",
)
def register(
    body: UserRegister,
    core: VibeSmithCore = Depends(get_core),
    locale: str = Depends(get_locale),
):
    """이메일 기반 회원가입. 성공 시 access_token과 refresh_token을 반환한다."""
    try:
        user_id, _ = register_user(core.db, body.email, body.password, body.name)
    except ValueError as e:
        if str(e) == "EMAIL_ALREADY_EXISTS":
            raise I18nHTTPException(400, KEYS.EMAIL_ALREADY_EXISTS)
        raise I18nHTTPException(400, KEYS.VALIDATION_ERROR)

    user = get_user_by_id(core.db, user_id)
    if not user:
        raise I18nHTTPException(500, KEYS.VALIDATION_ERROR)

    access_token = create_access_token(user["id"], user["email"])
    refresh_token = create_session(core.db, user["id"])

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
    )


@router.post(
    "/login",
    response_model=Token,
    summary="로그인",
    response_description="인증 성공 시 토큰 반환",
)
def login(
    body: UserLogin,
    core: VibeSmithCore = Depends(get_core),
):
    """이메일과 비밀번호로 로그인. 성공 시 access_token과 refresh_token을 반환한다."""
    user = authenticate_user(core.db, body.email, body.password)
    if not user:
        raise I18nHTTPException(401, KEYS.INVALID_CREDENTIALS)

    access_token = create_access_token(user["id"], user["email"])
    refresh_token = create_session(core.db, user["id"])

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
    )


@router.post(
    "/logout",
    status_code=200,
    summary="로그아웃",
)
def logout(
    body: RefreshRequest,
    core: VibeSmithCore = Depends(get_core),
):
    """Refresh Token을 무효화한다 (해당 세션 로그아웃)."""
    delete_session_by_refresh_token(core.db, body.refresh_token)
    return {"message_key": "common.logged_out"}


@router.get(
    "/me",
    response_model=UserMeResponse,
    summary="현재 사용자 조회",
)
def me(
    request: Request,
    core: VibeSmithCore = Depends(get_core),
):
    """Authorization Bearer 토큰으로 현재 로그인 사용자 정보를 반환한다."""
    user = get_current_user_from_token(request, core)
    return UserMeResponse(
        id=user["id"],
        email=user["email"],
        name=user.get("name"),
    )


@router.post(
    "/refresh",
    response_model=Token,
    summary="토큰 갱신",
)
def refresh(
    body: RefreshRequest,
    core: VibeSmithCore = Depends(get_core),
):
    """Refresh Token으로 새로운 access_token과 refresh_token을 발급한다."""
    user = get_session_by_refresh_token(core.db, body.refresh_token)
    if not user:
        raise I18nHTTPException(401, KEYS.INVALID_TOKEN)

    # 기존 세션 삭제 후 새 토큰 발급 (Refresh Token Rotation)
    delete_session_by_refresh_token(core.db, body.refresh_token)
    access_token = create_access_token(user["id"], user["email"])
    new_refresh_token = create_session(core.db, user["id"])

    return Token(
        access_token=access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
    )
