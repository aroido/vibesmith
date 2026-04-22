# VibeSmith API Security

Documentation for VibeSmith API security features and configuration.

## Implemented (Phase 1)

### 1. Security Headers

The following security headers are automatically added to all API responses:

- **X-Content-Type-Options: nosniff** — Prevents MIME type sniffing
- **X-Frame-Options: DENY** — Prevents clickjacking attacks
- **X-XSS-Protection: 1; mode=block** — Enables XSS filter
- **Strict-Transport-Security** — Enforces HTTPS (HTTPS environments only)
- **Content-Security-Policy** — CSP header (production environment only)

**Implementation**: `packages/api/vibesmith_api/security.py::add_security_headers()`

### 2. Environment-Based CORS Configuration

CORS allowed origins are automatically configured based on the `VIBESMITH_ENV` environment variable:

#### Development (default)
```python
allow_origins = [
    "http://localhost:5173",  # Vite dev server
    "http://localhost:4173",  # Vite preview
]
```

#### Staging
```python
allow_origins = [
    "https://staging.vibesmith.com",
    "http://localhost:5173",
    "http://localhost:4173",
]
```

#### Production
```python
allow_origins = [
    "https://vibesmith.com",
    "https://www.vibesmith.com",
]
```

**Implementation**: `packages/api/vibesmith_api/security.py::get_cors_origins()`

### 3. Suspicious Activity Logging

HTTP 4xx/5xx errors are automatically logged:

- **Warning level**: 4xx/5xx errors
- **Error level**: 429 Rate Limit exceeded

**Implementation**: `packages/api/vibesmith_api/security.py::log_suspicious_activity()`

### 4. Rate Limiting Infrastructure Ready

`slowapi` library installed. Can be activated for production deployment:

- **Global limit**: 200 req/minute
- **Scan API**: 10 req/minute (recommended)
- **Create/update/delete APIs**: 50 req/minute (recommended)

**Implementation**: `packages/api/vibesmith_api/security.py::limiter`

**Note**: Since this is currently a local app, Rate Limiting is disabled. For production deployment, apply the `conditional_limiter` decorator to endpoints.

---

## Security Checklist

### Completed

- [x] Security headers (XSS, Clickjacking, MIME Sniffing prevention)
- [x] Environment-based CORS configuration
- [x] Suspicious activity logging
- [x] Rate Limiting infrastructure ready
- [x] Security tests written (8 tests)

### Needed for Production Deployment

- [ ] Activate Rate Limiting
- [ ] Enforce HTTPS (HTTPSRedirectMiddleware)
- [ ] Configure TrustedHostMiddleware
- [ ] Authentication/Authorization (JWT, OAuth)
- [ ] API key rotation
- [ ] Environment variable encryption
- [ ] Sentry integration (error monitoring)
- [ ] WAF (Web Application Firewall) configuration
- [ ] DDoS protection (Cloudflare)

### Already Secure

- [x] **SQL Injection prevention**: Pydantic validation + ORM usage
- [x] **XSS prevention**: FastAPI auto-escaping + security headers
- [x] **CSRF prevention**: SPA architecture (stateless API)
- [x] **Path Traversal prevention**: Filename validation (`_validate_component_name`)

---

## Environment Variables

### VIBESMITH_ENV

API environment configuration:

- `development` (default): Local development environment
- `staging`: Staging environment
- `production`: Production environment

```bash
export VIBESMITH_ENV=production
```

### VIBESMITH_TEST_MODE

Enable test mode (partially disables security features):

```bash
export VIBESMITH_TEST_MODE=1
```

---

## Activating Rate Limiting (Production)

Follow these steps for production deployment:

### 1. Add Request Parameter

Add `Request` parameter to endpoints:

```python
from fastapi import Request
from vibesmith_api.security import limiter

@router.post("/api/scan")
@limiter.limit("10/minute")  # Scan API: 10 req/min
async def scan(
    request: Request,  # Required for Rate Limiter
    req: ScanRequest,
    ...
):
    ...
```

### 2. Configure Per-Endpoint Limits

```python
# General API: default 200 req/min (global setting)
@router.get("/api/stats")
async def get_stats(...):
    ...

# Scan API: 10 req/min
@router.post("/api/scan")
@limiter.limit("10/minute")
async def scan(request: Request, ...):
    ...

# Create/update/delete API: 50 req/min
@router.post("/api/components")
@limiter.limit("50/minute")
async def create_component(request: Request, ...):
    ...
```

### 3. Verify Error Handler

Rate Limit error handler is already implemented in `main.py`:

```python
@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded. Please try again later."},
    )
```

---

## Security Tests

Security features are validated with the following tests:

```bash
cd packages/api
pytest tests/test_security.py -v
```

**Test List** (8 tests):
1. `test_security_headers` — Security headers verification
2. `test_rate_limit_decorator_applied_on_scan` — Scan Rate Limit
3. `test_rate_limit_decorator_applied_on_create` — Create Rate Limit
4. `test_cors_headers` — CORS headers verification
5. `test_cors_allowed_origins` — Environment-based CORS configuration
6. `test_limiter_key_function` — Rate Limiter key function
7. `test_suspicious_activity_logging` — Suspicious activity logging
8. `test_https_only_headers_not_in_http` — HTTPS-only headers

---

## Reporting Security Vulnerabilities

If you discover a security vulnerability:

1. **Do not create a public Issue**
2. Report via email: security@vibesmith.com (TBD)
3. Response within 24 hours

---

## References

- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [slowapi Documentation](https://slowapi.readthedocs.io/)
- [Mozilla Web Security Guidelines](https://infosec.mozilla.org/guidelines/web_security)
