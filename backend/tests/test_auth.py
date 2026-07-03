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
