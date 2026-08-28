import os

ADMIN_KEY = os.getenv("ADMIN_KEY", "change-this-admin-key")


def test_create_group_with_valid_header(client):
    res = client.post(
        "/api/admin/groups",
        json={"name": "새 그룹"},
        headers={"X-Admin-Key": ADMIN_KEY},
    )
    assert res.status_code == 201
    assert res.json()["name"] == "새 그룹"


def test_create_group_missing_credentials(client):
    # X-Admin-Key 는 이제 필수가 아니다 — Authorization: Bearer 관리자 토큰도 받는다.
    # 그래서 아무것도 없으면 422(스키마 위반)가 아니라 403(인증 실패)이다.
    res = client.post("/api/admin/groups", json={"name": "새 그룹"})
    assert res.status_code == 403


def test_create_group_wrong_header(client):
    res = client.post(
        "/api/admin/groups",
        json={"name": "새 그룹"},
        headers={"X-Admin-Key": "wrong-key"},
    )
    assert res.status_code == 403


def test_admin_key_no_longer_accepted_in_body_or_query(client, group):
    # admin_key 가 body/query 필드였던 시기가 있다. 그 경로로는 절대 통과하면 안 된다.
    res = client.get(f"/api/admin/groups?admin_key={ADMIN_KEY}")
    assert res.status_code == 403


def test_admin_endpoint_is_rate_limited_on_repeated_failures(client):
    for _ in range(10):
        res = client.post(
            "/api/admin/groups",
            json={"name": "brute-force"},
            headers={"X-Admin-Key": "wrong-key"},
        )
        assert res.status_code == 403
    res = client.post(
        "/api/admin/groups",
        json={"name": "brute-force"},
        headers={"X-Admin-Key": "wrong-key"},
    )
    assert res.status_code == 429


# ── 관리자 토큰 ──────────────────────────────────────────────────────────────


def _admin_token(client) -> str:
    res = client.post("/api/admin/login", json={"admin_key": ADMIN_KEY})
    assert res.status_code == 200
    return res.json()["access_token"]


def test_admin_login_rejects_wrong_key(client):
    res = client.post("/api/admin/login", json={"admin_key": "wrong-key"})
    assert res.status_code == 403


def test_admin_token_grants_access(client):
    token = _admin_token(client)
    res = client.post(
        "/api/admin/groups",
        json={"name": "토큰으로 만든 그룹"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201


def test_admin_token_cannot_be_used_as_user_token(client):
    """관리자 권한이 사용자 API 로 흘러들어가면 안 된다."""
    token = _admin_token(client)
    res = client.get("/api/transactions", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401


def test_user_token_is_not_admin(client, auth_headers):
    """반대 방향도 막혀 있어야 한다."""
    res = client.get("/api/admin/groups", headers=auth_headers)
    assert res.status_code == 403


def test_admin_login_is_rate_limited(client):
    for _ in range(10):
        assert client.post("/api/admin/login", json={"admin_key": "wrong"}).status_code == 403
    assert client.post("/api/admin/login", json={"admin_key": "wrong"}).status_code == 429


# ── 초대 코드 재발급 ─────────────────────────────────────────────────────────


def test_regenerate_invite_code_changes_it(client, user):
    before = user.invite_code
    res = client.post(
        f"/api/admin/users/{user.id}/invite-code",
        headers={"X-Admin-Key": ADMIN_KEY},
    )
    assert res.status_code == 200
    assert res.json()["invite_code"] != before


def test_old_invite_code_stops_working_after_regeneration(client, user):
    old_code = user.invite_code
    assert client.post("/api/auth/login", json={"invite_code": old_code}).status_code == 200

    new_code = client.post(
        f"/api/admin/users/{user.id}/invite-code",
        headers={"X-Admin-Key": ADMIN_KEY},
    ).json()["invite_code"]

    assert client.post("/api/auth/login", json={"invite_code": old_code}).status_code == 401
    assert client.post("/api/auth/login", json={"invite_code": new_code}).status_code == 200


def test_regenerate_invite_code_unknown_user(client):
    res = client.post("/api/admin/users/nope/invite-code", headers={"X-Admin-Key": ADMIN_KEY})
    assert res.status_code == 404


def test_regenerate_invite_code_requires_admin(client, user):
    assert client.post(f"/api/admin/users/{user.id}/invite-code").status_code == 403
