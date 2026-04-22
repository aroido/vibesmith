"""라이선스 API 테스트 (Issue #79)."""

import os
from datetime import UTC, datetime
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from vibesmith_core import VibeSmithCore

from vibesmith_api.routes.licenses import generate_license_key


def _insert_license(core: VibeSmithCore, key: str, plan: str = "pro", status: str = "active"):
    """테스트용 라이선스 삽입."""
    conn = core.db.get_connection()
    conn.execute(
        """
        INSERT INTO licenses (
            id, user_id, plan, stripe_subscription_id, stripe_customer_id, status, created_at, expires_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (key, "test@example.com", plan, "sub_xxx", "cus_xxx", status, datetime.now(UTC).isoformat(), None),
    )
    conn.commit()


def test_validate_invalid_key(client: TestClient):
    """유효하지 않은 라이선스 키 → valid=False, plan=free."""
    response = client.post("/api/license/validate", json={"key": "INVALID-KEY"})
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is False
    assert data["plan"] == "free"
    assert data["expires_at"] is None


def test_validate_wrong_format(client: TestClient):
    """VS- 형식이 아닌 키 → valid=False."""
    response = client.post("/api/license/validate", json={"key": "not-a-license"})
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is False
    assert data["plan"] == "free"


def test_validate_valid_license(client: TestClient, core: VibeSmithCore):
    """유효한 라이선스 키 → valid=True, plan 반환."""
    key = generate_license_key()
    _insert_license(core, key, plan="pro", status="active")

    response = client.post("/api/license/validate", json={"key": key})
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is True
    assert data["plan"] == "pro"
    assert data["expires_at"] is None


def test_validate_expired_license(client: TestClient, core: VibeSmithCore):
    """만료된 라이선스 → valid=False."""
    key = generate_license_key()
    conn = core.db.get_connection()
    conn.execute(
        """
        INSERT INTO licenses (
            id, user_id, plan, stripe_subscription_id, stripe_customer_id, status, created_at, expires_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            key,
            "test@example.com",
            "pro",
            "sub_xxx",
            "cus_xxx",
            "active",
            "2020-01-01T00:00:00Z",
            "2020-12-31T23:59:59Z",
        ),
    )
    conn.commit()

    response = client.post("/api/license/validate", json={"key": key})
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is False
    assert data["plan"] == "free"


def test_validate_cancelled_license(client: TestClient, core: VibeSmithCore):
    """취소된 라이선스 → valid=False."""
    key = generate_license_key()
    _insert_license(core, key, plan="pro", status="cancelled")

    response = client.post("/api/license/validate", json={"key": key})
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is False
    assert data["plan"] == "free"


def test_license_me_no_header(client: TestClient):
    """X-License-Key 없이 /me 호출 → valid=False, plan=free."""
    response = client.get("/api/license/me")
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is False
    assert data["plan"] == "free"
    assert data["expires_at"] is None


def test_license_me_valid_key(client: TestClient, core: VibeSmithCore):
    """유효한 X-License-Key로 /me 호출 → 라이선스 정보 반환."""
    key = generate_license_key()
    _insert_license(core, key, plan="team", status="active")

    response = client.get("/api/license/me", headers={"X-License-Key": key})
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is True
    assert data["plan"] == "team"


def test_checkout_stripe_not_configured(client: TestClient):
    """STRIPE_SECRET_KEY 없이 checkout → 503."""
    with patch.dict(os.environ, {}, clear=False):
        if "STRIPE_SECRET_KEY" in os.environ:
            del os.environ["STRIPE_SECRET_KEY"]
        response = client.post(
            "/api/license/checkout",
            json={"plan": "pro", "email": "user@example.com"},
        )
    assert response.status_code == 503
    data = response.json()
    assert "stripe" in data["detail"].lower() or "stripe" in data.get("message", "").lower()


def test_checkout_invalid_plan(client: TestClient):
    """유효하지 않은 플랜 → 422 (Pydantic validation)."""
    response = client.post(
        "/api/license/checkout",
        json={"plan": "invalid", "email": "user@example.com"},
    )
    assert response.status_code == 422


@patch("stripe.checkout.Session.create")
def test_checkout_creates_session(mock_create: MagicMock, client: TestClient):
    """Stripe 설정 시 checkout 세션 생성."""
    mock_create.return_value = MagicMock(url="https://checkout.stripe.com/xxx", id="cs_xxx")
    os.environ["STRIPE_SECRET_KEY"] = "sk_test_xxx"

    try:
        response = client.post(
            "/api/license/checkout",
            json={"plan": "pro", "email": "user@example.com"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["checkout_url"] == "https://checkout.stripe.com/xxx"
        assert data["session_id"] == "cs_xxx"
        mock_create.assert_called_once()
    finally:
        os.environ.pop("STRIPE_SECRET_KEY", None)


def test_stripe_webhook_no_secret(client: TestClient):
    """STRIPE_WEBHOOK_SECRET 없이 webhook → 500."""
    with patch.dict(os.environ, {}, clear=False):
        if "STRIPE_WEBHOOK_SECRET" in os.environ:
            del os.environ["STRIPE_WEBHOOK_SECRET"]
        response = client.post(
            "/api/webhooks/stripe",
            content=b"{}",
            headers={"Content-Type": "application/json"},
        )
    assert response.status_code == 500


def test_stripe_webhook_invalid_payload(client: TestClient):
    """잘못된 webhook payload → 400."""
    os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_xxx"
    try:
        response = client.post(
            "/api/webhooks/stripe",
            content=b"invalid",
            headers={"Content-Type": "application/json", "stripe-signature": "xxx"},
        )
        assert response.status_code == 400
    finally:
        os.environ.pop("STRIPE_WEBHOOK_SECRET", None)


def test_generate_license_key_format():
    """라이선스 키 형식 검증: VS-XXXX-XXXX-XXXX-XXXX."""
    key = generate_license_key()
    assert key.startswith("VS-")
    parts = key.split("-")
    assert len(parts) == 5  # VS + 4 hex parts
    assert parts[0] == "VS"
    for p in parts[1:]:
        assert len(p) == 4
        assert all(c in "0123456789ABCDEF" for c in p)
