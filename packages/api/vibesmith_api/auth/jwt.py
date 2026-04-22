"""JWT 토큰 생성 및 검증."""

import hashlib
import os
from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt

# Access Token: 15분
ACCESS_TOKEN_EXPIRE_MINUTES = 15
# Refresh Token: 30일
REFRESH_TOKEN_EXPIRE_DAYS = 30
ALGORITHM = "HS256"


def get_jwt_secret() -> str:
    """JWT 시크릿을 환경변수에서 로드한다.

    VIBESMITH_JWT_SECRET이 없으면:
    - 테스트 모드(VIBESMITH_TEST_MODE=1): 고정 시크릿 사용
    - 그 외: 환경변수 누락 에러
    """
    secret = os.getenv("VIBESMITH_JWT_SECRET")
    if secret:
        return secret
    if os.getenv("VIBESMITH_TEST_MODE") == "1":
        return "test-jwt-secret-do-not-use-in-production"
    raise ValueError(
        "VIBESMITH_JWT_SECRET 환경변수가 설정되지 않았습니다. 인증을 사용하려면 JWT 시크릿을 설정해주세요."
    )


def create_access_token(user_id: str, email: str) -> str:
    """Access Token을 생성한다 (15분 유효)."""
    expire = datetime.now(UTC) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": user_id,
        "email": email,
        "exp": expire,
        "iat": datetime.now(UTC),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=ALGORITHM)


def create_refresh_token(user_id: str) -> tuple[str, str]:
    """Refresh Token과 해당 jti를 반환한다 (30일 유효).

    Returns:
        (token_string, jti) — jti는 sessions 테이블에 저장용.
    """
    expire = datetime.now(UTC) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    jti = f"rt_{user_id}_{os.urandom(16).hex()}"
    payload = {
        "sub": user_id,
        "exp": expire,
        "iat": datetime.now(UTC),
        "type": "refresh",
        "jti": jti,
    }
    token = jwt.encode(payload, get_jwt_secret(), algorithm=ALGORITHM)
    # DB에 저장할 해시 (토큰 자체는 저장하지 않음)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    return token, token_hash


def decode_token(token: str) -> dict | None:
    """JWT 토큰을 디코딩한다. 유효하지 않으면 None 반환."""
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None
