"""비밀번호 해싱 및 검증 — bcrypt 사용."""

from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


def hash_password(password: str) -> str:
    """비밀번호를 bcrypt로 해싱한다."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """평문 비밀번호와 해시가 일치하는지 검증한다."""
    return pwd_context.verify(plain_password, hashed_password)
