"""Security middleware and Rate Limiting configuration."""

import os
import time
from collections import defaultdict
from collections.abc import Callable

from fastapi import Request, Response
from slowapi import Limiter
from slowapi.util import get_remote_address

from vibesmith_api.logging_config import get_logger

logger = get_logger("vibesmith.security")


# Simple In-Memory Rate Limiter (test-compatible)
class SimpleRateLimiter:
    """Simple testable Rate Limiter."""

    def __init__(self):
        self._requests = defaultdict(list)  # {(client_id, endpoint): [timestamp, ...]}

    def is_allowed(self, client_id: str, endpoint: str, limit: int, window: int = 60) -> bool:
        """Rate limit check.

        Args:
            client_id: Client identifier (IP, etc.)
            endpoint: Endpoint path
            limit: Maximum requests within the time window
            window: Time window (seconds)

        Returns:
            True if allowed, False if rate limit exceeded
        """
        # Always allow in test mode
        if os.getenv("VIBESMITH_TEST_MODE") == "1":
            return True

        key = (client_id, endpoint)
        now = time.time()

        # Remove expired requests
        self._requests[key] = [ts for ts in self._requests[key] if now - ts < window]

        # Check current request count
        if len(self._requests[key]) >= limit:
            return False

        # Record request
        self._requests[key].append(now)
        return True


# Global Rate Limiter instance
rate_limiter = SimpleRateLimiter()


def get_limiter_key(request: Request) -> str:
    """Rate Limiter key function.

    Uses a fixed key instead of IP since this is a local app.
    In production, use get_remote_address(request).
    """
    # Disable Rate Limiter in test environment
    if os.getenv("VIBESMITH_TEST_MODE") == "1":
        return "test-mode"

    # Local development environment
    if os.getenv("VIBESMITH_ENV") != "production":
        return "local-dev"

    # Production: use actual IP address
    return get_remote_address(request)


# slowapi Limiter (kept for backward compatibility)
limiter = Limiter(
    key_func=get_limiter_key,
    default_limits=["200/minute"],
    storage_uri="memory://",
    headers_enabled=True,
)


def conditional_limiter(limit: str):
    """Conditional Rate Limiter decorator (Dummy).

    The decorator does nothing for test compatibility.
    Actual Rate Limiting is handled by middleware.
    """

    def decorator(func):
        # Add limit info to endpoint metadata
        func._rate_limit = limit
        return func

    return decorator


async def add_security_headers(request: Request, call_next: Callable) -> Response:
    """Security headers middleware."""
    response = await call_next(request)

    # XSS protection
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"

    # Content-Security-Policy (production only)
    if os.getenv("VIBESMITH_ENV") == "production":
        response.headers["Content-Security-Policy"] = "default-src 'self'"

    # HSTS (HTTPS only)
    if request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

    return response


async def rate_limit_middleware(request: Request, call_next: Callable) -> Response:
    """Rate Limiting middleware (per-endpoint)."""
    # Extract rate limit info (from endpoint metadata)
    endpoint = request.url.path
    client_id = get_limiter_key(request)

    # Per-endpoint Rate Limit settings
    rate_limits = {
        "/api/scan": (10, 60),  # 10 requests/minute
        "/api/components": (30, 60),  # 30 requests/minute (POST/PUT/DELETE)
    }

    # Endpoint pattern matching
    for pattern, (limit, window) in rate_limits.items():
        if endpoint.startswith(pattern):
            if not rate_limiter.is_allowed(client_id, endpoint, limit, window):
                logger.warning(
                    "Rate limit exceeded",
                    method=request.method,
                    path=endpoint,
                    client=client_id,
                )
                from fastapi.responses import JSONResponse

                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": "Rate limit exceeded. Please try again later.",
                        "message_key": "rate_limit_exceeded",
                        "message": "Rate limit exceeded. Please try again later.",
                    },
                    headers={"Retry-After": str(window)},
                )
            break

    response = await call_next(request)
    return response


async def log_suspicious_activity(request: Request, call_next: Callable) -> Response:
    """Suspicious activity logging middleware."""
    response = await call_next(request)

    # Log 4xx/5xx errors
    if response.status_code >= 400:
        logger.warning(
            "HTTP error response",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            client=get_limiter_key(request),
        )

    # Detect Rate Limit exceeded
    if response.status_code == 429:
        logger.error(
            "Rate limit exceeded",
            method=request.method,
            path=request.url.path,
            client=get_limiter_key(request),
        )

    return response


def get_cors_origins() -> list[str]:
    """Return CORS allowed origins by environment."""
    env = os.getenv("VIBESMITH_ENV", "development")

    if env == "production":
        # Production: allow only actual domains
        return [
            "https://vibesmith.com",
            "https://www.vibesmith.com",
        ]
    elif env == "staging":
        # Staging: staging domain + local
        return [
            "https://staging.vibesmith.com",
            "http://localhost:5173",
            "http://localhost:4173",
        ]
    else:
        # Development: allow local only
        return [
            "http://localhost:5173",
            "http://localhost:4173",
        ]
