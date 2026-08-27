from __future__ import annotations

from datetime import UTC, datetime, timedelta

from jose import jwt

from app import config


def test_login_success(client, user):
    res = client.post("/api/auth/login", json={"invite_code": user.invite_code})
    assert res.status_code == 200
    body = res.json()
    assert body["user_id"] == user.id
    assert body["group_id"] == user.group_id
    assert "access_token" in body


def test_login_invalid_code(client):
    res = client.post("/api/auth/login", json={"invite_code": "NOPE"})
    assert res.status_code == 401


def test_me_requires_auth(client):
    res = client.get("/api/auth/me")
    assert res.status_code in (401, 403)


def test_me_with_token(client, auth_headers, user):
    res = client.get("/api/auth/me", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["id"] == user.id


def test_me_with_invalid_token(client):
    res = client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-real-token"})
    assert res.status_code == 401


def test_login_is_rate_limited(client):
    for _ in range(10):
        res = client.post("/api/auth/login", json={"invite_code": "WRONG"})
        assert res.status_code == 401
    res = client.post("/api/auth/login", json={"invite_code": "WRONG"})
    assert res.status_code == 429


def test_login_returns_token_expiry(client, user, monkeypatch):
    """쿠키 수명을 클라이언트가 이 값에서 계산한다 — 없으면 30일 하드코딩으로 돌아간다."""
    monkeypatch.setenv("TOKEN_EXPIRE_DAYS", "7")
    res = client.post("/api/auth/login", json={"invite_code": user.invite_code})
    assert res.status_code == 200

    expires_at = datetime.fromisoformat(res.json()["expires_at"])
    expected = datetime.now(UTC) + timedelta(days=7)
    # 요청 처리 시간만큼의 차이는 있을 수 있다
    assert abs((expires_at - expected).total_seconds()) < 60


def test_token_expiry_matches_jwt_exp(client, user):
    """응답의 expires_at 과 JWT 안의 exp 가 어긋나면 쿠키와 토큰이 따로 논다."""
    res = client.post("/api/auth/login", json={"invite_code": user.invite_code})
    body = res.json()

    claims = jwt.decode(body["access_token"], config.jwt_secret(), algorithms=[config.ALGORITHM])
    expires_at = datetime.fromisoformat(body["expires_at"])
    assert int(expires_at.timestamp()) == claims["exp"]
