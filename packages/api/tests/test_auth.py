"""인증 API 테스트 (Issue #82)."""

from fastapi.testclient import TestClient


class TestRegister:
    """회원가입 테스트."""

    def test_register_success(self, client: TestClient):
        """회원가입 성공 시 토큰 반환."""
        resp = client.post(
            "/api/auth/register",
            json={"email": "test@example.com", "password": "password123", "name": "Test User"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert len(data["access_token"]) > 0
        assert len(data["refresh_token"]) > 0

    def test_register_duplicate_email(self, client: TestClient):
        """중복 이메일 회원가입 시 400."""
        payload = {"email": "dup@example.com", "password": "password123"}
        client.post("/api/auth/register", json=payload)
        resp = client.post("/api/auth/register", json=payload)
        assert resp.status_code == 400
        assert "email_already_exists" in resp.json().get("message_key", "")

    def test_register_short_password(self, client: TestClient):
        """8자 미만 비밀번호 시 422."""
        resp = client.post(
            "/api/auth/register",
            json={"email": "short@example.com", "password": "short"},
        )
        assert resp.status_code == 422

    def test_register_invalid_email(self, client: TestClient):
        """잘못된 이메일 형식 시 422."""
        resp = client.post(
            "/api/auth/register",
            json={"email": "invalid-email", "password": "password123"},
        )
        assert resp.status_code == 422


class TestLogin:
    """로그인 테스트."""

    def test_login_success(self, client: TestClient):
        """로그인 성공 시 토큰 반환."""
        client.post(
            "/api/auth/register",
            json={"email": "login@example.com", "password": "mypass123"},
        )
        resp = client.post(
            "/api/auth/login",
            json={"email": "login@example.com", "password": "mypass123"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    def test_login_invalid_credentials(self, client: TestClient):
        """잘못된 비밀번호 시 401."""
        client.post(
            "/api/auth/register",
            json={"email": "wrong@example.com", "password": "correct123"},
        )
        resp = client.post(
            "/api/auth/login",
            json={"email": "wrong@example.com", "password": "wrongpass"},
        )
        assert resp.status_code == 401
        assert "invalid_credentials" in resp.json().get("message_key", "")

    def test_login_nonexistent_user(self, client: TestClient):
        """존재하지 않는 사용자 시 401."""
        resp = client.post(
            "/api/auth/login",
            json={"email": "nobody@example.com", "password": "anypass"},
        )
        assert resp.status_code == 401


class TestRefresh:
    """토큰 갱신 테스트."""

    def test_refresh_success(self, client: TestClient):
        """Refresh Token으로 새 토큰 발급."""
        reg = client.post(
            "/api/auth/register",
            json={"email": "refresh@example.com", "password": "pass12345"},
        )
        assert reg.status_code == 201
        refresh_token = reg.json()["refresh_token"]

        resp = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["refresh_token"] != refresh_token  # Rotation

    def test_refresh_invalid_token(self, client: TestClient):
        """유효하지 않은 Refresh Token 시 401."""
        resp = client.post(
            "/api/auth/refresh",
            json={"refresh_token": "invalid.jwt.token"},
        )
        assert resp.status_code == 401
        assert "invalid_token" in resp.json().get("message_key", "")

    def test_refresh_reuse_old_token(self, client: TestClient):
        """이미 사용된 Refresh Token 재사용 시 401 (Rotation)."""
        reg = client.post(
            "/api/auth/register",
            json={"email": "reuse@example.com", "password": "pass12345"},
        )
        refresh_token = reg.json()["refresh_token"]
        client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
        resp = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
        assert resp.status_code == 401


class TestMe:
    """현재 사용자 조회 테스트."""

    def test_me_success(self, client: TestClient):
        """Bearer 토큰으로 사용자 정보 조회."""
        reg = client.post(
            "/api/auth/register",
            json={"email": "me@example.com", "password": "pass12345", "name": "Me"},
        )
        access_token = reg.json()["access_token"]
        resp = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == "me@example.com"
        assert data["name"] == "Me"
        assert "id" in data

    def test_me_unauthorized_no_header(self, client: TestClient):
        """Authorization 헤더 없으면 401."""
        resp = client.get("/api/auth/me")
        assert resp.status_code == 401

    def test_me_unauthorized_invalid_token(self, client: TestClient):
        """잘못된 토큰이면 401."""
        resp = client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert resp.status_code == 401


class TestLogout:
    """로그아웃 테스트."""

    def test_logout_success(self, client: TestClient):
        """로그아웃 시 Refresh Token 무효화."""
        reg = client.post(
            "/api/auth/register",
            json={"email": "logout@example.com", "password": "pass12345"},
        )
        refresh_token = reg.json()["refresh_token"]
        resp = client.post("/api/auth/logout", json={"refresh_token": refresh_token})
        assert resp.status_code == 200

        # 로그아웃 후 해당 Refresh Token으로 갱신 불가
        refresh_resp = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
        assert refresh_resp.status_code == 401
