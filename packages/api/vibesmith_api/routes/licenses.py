"""라이선스 API — 검증, 조회, Stripe Checkout, Webhook (Issue #79)."""

import os
import secrets
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, Header, Request
from starlette.responses import Response
from vibesmith_core import VibeSmithCore

from vibesmith_api.deps import get_core
from vibesmith_api.i18n import KEYS
from vibesmith_api.i18n.exceptions import I18nHTTPException
from vibesmith_api.schemas import (
    CheckoutRequest,
    LicenseResponse,
    LicenseValidateRequest,
)

router = APIRouter(prefix="/api", tags=["license"])


def generate_license_key() -> str:
    """VS-XXXX-XXXX-XXXX-XXXX 형식의 라이선스 키 생성."""
    parts = [secrets.token_hex(2).upper() for _ in range(4)]
    return f"VS-{'-'.join(parts)}"


def _normalize_key(key: str) -> str:
    """라이선스 키 정규화 (공백 제거, 대문자)."""
    return key.strip().upper().replace(" ", "")


def _get_license_by_key(core: VibeSmithCore, key: str) -> dict[str, Any] | None:
    """라이선스 키로 DB에서 조회. 키는 id 컬럼에 저장."""
    normalized = _normalize_key(key)
    if not normalized.startswith("VS-"):
        return None
    conn = core.db.get_connection()
    row = conn.execute(
        "SELECT id, plan, status, expires_at, user_id FROM licenses WHERE id = ?",
        (normalized,),
    ).fetchone()
    if not row:
        return None
    return {
        "id": row[0],
        "plan": row[1],
        "status": row[2],
        "expires_at": row[3],
        "user_id": row[4],
    }


def _is_license_valid(lic: dict[str, Any] | None) -> bool:
    """라이선스가 유효한지 검사 (active, 만료 안됨)."""
    if not lic or lic.get("status") != "active":
        return False
    expires = lic.get("expires_at")
    if expires:
        try:
            exp_dt = datetime.fromisoformat(expires.replace("Z", "+00:00"))
            if exp_dt.tzinfo is None:
                exp_dt = exp_dt.replace(tzinfo=UTC)
            if datetime.now(UTC) > exp_dt:
                return False
        except (ValueError, TypeError):
            return False
    return True


@router.post(
    "/license/validate",
    response_model=LicenseResponse,
    summary="라이선스 키 검증",
)
def validate_license(
    body: LicenseValidateRequest,
    core: VibeSmithCore = Depends(get_core),
):
    """라이선스 키가 유효한지 검증하고 플랜 정보를 반환합니다."""
    lic = _get_license_by_key(core, body.key)
    valid = _is_license_valid(lic)
    plan = lic["plan"] if lic and valid else "free"
    expires_at = None
    if lic and lic.get("expires_at"):
        try:
            expires_at = datetime.fromisoformat(lic["expires_at"].replace("Z", "+00:00"))
        except (ValueError, TypeError):
            pass
    return LicenseResponse(valid=valid, plan=plan, expires_at=expires_at)


@router.get(
    "/license/me",
    response_model=LicenseResponse,
    summary="현재 사용자 라이선스 조회",
)
def get_my_license(
    core: VibeSmithCore = Depends(get_core),
    x_license_key: str | None = Header(None, alias="X-License-Key"),
):
    """X-License-Key 헤더로 전달된 라이선스 키의 정보를 반환합니다."""
    if not x_license_key or not x_license_key.strip():
        return LicenseResponse(valid=False, plan="free", expires_at=None)
    lic = _get_license_by_key(core, x_license_key)
    if not lic:
        return LicenseResponse(valid=False, plan="free", expires_at=None)
    valid = _is_license_valid(lic)
    plan = lic["plan"] if valid else "free"
    expires_at = None
    if lic.get("expires_at"):
        try:
            expires_at = datetime.fromisoformat(lic["expires_at"].replace("Z", "+00:00"))
        except (ValueError, TypeError):
            pass
    return LicenseResponse(valid=valid, plan=plan, expires_at=expires_at)


@router.post(
    "/license/checkout",
    summary="Stripe Checkout Session 생성",
)
def create_checkout(
    body: CheckoutRequest,
    core: VibeSmithCore = Depends(get_core),
):
    """Stripe Checkout Session을 생성하고 URL을 반환합니다."""
    if body.plan not in ("pro", "team"):
        raise I18nHTTPException(400, KEYS.INVALID_PLAN)

    secret_key = os.getenv("STRIPE_SECRET_KEY")
    if not secret_key:
        raise I18nHTTPException(503, KEYS.STRIPE_NOT_CONFIGURED)

    try:
        import stripe

        stripe.api_key = secret_key

        # 테스트 모드: price_xxx ID는 Stripe Dashboard에서 확인
        price_ids = {
            "pro": os.getenv("STRIPE_PRICE_PRO", "price_pro_monthly"),
            "team": os.getenv("STRIPE_PRICE_TEAM", "price_team_monthly"),
        }
        price_id = price_ids.get(body.plan) or price_ids["pro"]

        session = stripe.checkout.Session.create(
            mode="subscription",
            customer_email=body.email,
            line_items=[
                {
                    "price": price_id,
                    "quantity": 1,
                }
            ],
            success_url=os.getenv("STRIPE_SUCCESS_URL", "https://vibesmith.com/success"),
            cancel_url=os.getenv("STRIPE_CANCEL_URL", "https://vibesmith.com/pricing"),
            metadata={"plan": body.plan},
        )
        return {"checkout_url": session.url, "session_id": session.id}
    except Exception as e:
        raise I18nHTTPException(500, KEYS.STRIPE_CHECKOUT_FAILED, detail=str(e)) from e


@router.post(
    "/webhooks/stripe",
    include_in_schema=False,
)
async def stripe_webhook(
    request: Request,
    core: VibeSmithCore = Depends(get_core),
):
    """Stripe Webhook — subscription 생성/갱신/취소 시 라이선스 DB 동기화."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    if not webhook_secret:
        return Response(status_code=500, content="STRIPE_WEBHOOK_SECRET not configured")

    try:
        import stripe

        stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except ValueError:
        return Response(status_code=400, content="Invalid payload")
    except Exception:
        return Response(status_code=400, content="Invalid signature")

    if event["type"] == "customer.subscription.created":
        sub = event["data"]["object"]
        _handle_subscription_created(core, sub)
    elif event["type"] == "customer.subscription.updated":
        sub = event["data"]["object"]
        _handle_subscription_updated(core, sub)
    elif event["type"] == "customer.subscription.deleted":
        sub = event["data"]["object"]
        _handle_subscription_deleted(core, sub)

    return Response(status_code=200, content="OK")


def _handle_subscription_created(core: VibeSmithCore, sub: dict) -> None:
    """구독 생성 시 라이선스 레코드 생성."""
    sub_id = sub["id"]
    customer_id = sub.get("customer")
    status = sub.get("status", "active")
    plan = "pro"  # metadata에서 가져오거나 price에서 추론
    current_period_end = sub.get("current_period_end")
    expires_at = datetime.utcfromtimestamp(current_period_end).isoformat() + "Z" if current_period_end else None

    # Stripe Customer에서 email 조회 (필요 시)
    user_id = None
    if customer_id:
        try:
            import stripe

            c = stripe.Customer.retrieve(customer_id)
            user_id = c.get("email")
        except Exception:
            pass

    license_key = generate_license_key()
    conn = core.db.get_connection()
    conn.execute(
        """
        INSERT INTO licenses (
            id, user_id, plan, stripe_subscription_id, stripe_customer_id,
            status, created_at, expires_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            license_key,
            user_id,
            plan,
            sub_id,
            customer_id,
            status,
            datetime.now(UTC).isoformat(),
            expires_at,
        ),
    )
    conn.commit()


def _handle_subscription_updated(core: VibeSmithCore, sub: dict) -> None:
    """구독 갱신 시 expires_at, status 업데이트."""
    sub_id = sub["id"]
    status = sub.get("status", "active")
    current_period_end = sub.get("current_period_end")
    expires_at = datetime.utcfromtimestamp(current_period_end).isoformat() + "Z" if current_period_end else None
    conn = core.db.get_connection()
    conn.execute(
        "UPDATE licenses SET status = ?, expires_at = ? WHERE stripe_subscription_id = ?",
        (status, expires_at, sub_id),
    )
    conn.commit()


def _handle_subscription_deleted(core: VibeSmithCore, sub: dict) -> None:
    """구독 취소 시 status를 cancelled로 업데이트."""
    sub_id = sub["id"]
    conn = core.db.get_connection()
    conn.execute(
        "UPDATE licenses SET status = ? WHERE stripe_subscription_id = ?",
        ("cancelled", sub_id),
    )
    conn.commit()
