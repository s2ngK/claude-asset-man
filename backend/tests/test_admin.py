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


# ── 그룹 비활성화 ────────────────────────────────────────────────────────────


def _deactivate(client, group_id):
    return client.post(f"/api/admin/groups/{group_id}/deactivate", headers={"X-Admin-Key": ADMIN_KEY})


def test_deactivate_keeps_the_row_and_the_records(client, db_session, user, category, group):
    from app import models

    db_session.add(
        models.Transaction(
            id="kept-tx",
            group_id=group.id,
            user_id=user.id,
            category_id=category.id,
            type="expense",
            amount=1000,
            description="남아야 한다",
            date="2026-08-01",
        )
    )
    db_session.commit()

    assert _deactivate(client, group.id).status_code == 200
    # 행도 거래도 그대로다 — 지우는 게 아니라 재워두는 것이다
    assert db_session.query(models.Group).filter(models.Group.id == group.id).first() is not None
    assert db_session.query(models.Transaction).filter(models.Transaction.id == "kept-tx").first() is not None


def test_deactivate_invalidates_every_code(client, db_session, user, group):
    old_invite = user.invite_code
    old_admin_code = group.admin_code

    body = _deactivate(client, group.id).json()
    assert body["is_active"] is False

    db_session.refresh(user)
    db_session.refresh(group)
    assert user.invite_code != old_invite
    assert group.admin_code != old_admin_code


def test_deactivated_group_member_cannot_log_in(client, db_session, user, group):
    _deactivate(client, group.id)
    db_session.refresh(user)
    # 새로 난 코드조차 통하지 않는다
    res = client.post("/api/auth/login", json={"invite_code": user.invite_code})
    assert res.status_code == 403


def test_deactivation_kills_an_existing_session(client, auth_headers, group):
    assert client.get("/api/transactions", headers=auth_headers).status_code == 200
    _deactivate(client, group.id)
    assert client.get("/api/transactions", headers=auth_headers).status_code == 401


def test_restore_brings_the_group_back(client, db_session, user, group):
    _deactivate(client, group.id)
    db_session.refresh(user)
    new_code = user.invite_code

    body = client.post(f"/api/admin/groups/{group.id}/restore", headers={"X-Admin-Key": ADMIN_KEY}).json()
    assert body["is_active"] is True
    assert client.post("/api/auth/login", json={"invite_code": new_code}).status_code == 200


def test_restore_does_not_bring_old_codes_back(client, db_session, user, group):
    old_invite = user.invite_code
    _deactivate(client, group.id)
    client.post(f"/api/admin/groups/{group.id}/restore", headers={"X-Admin-Key": ADMIN_KEY})
    assert client.post("/api/auth/login", json={"invite_code": old_invite}).status_code == 401


def test_cannot_add_member_to_deactivated_group(client, group):
    _deactivate(client, group.id)
    res = client.post(
        "/api/admin/users",
        json={"group_id": group.id, "display_name": "늦은 사람"},
        headers={"X-Admin-Key": ADMIN_KEY},
    )
    assert res.status_code == 409


# ── 그룹 관리자 ──────────────────────────────────────────────────────────────


def _group_admin_headers(client, group) -> dict[str, str]:
    res = client.post("/api/admin/login", json={"admin_key": group.admin_code})
    assert res.status_code == 200, res.json()
    body = res.json()
    assert body["group_id"] == group.id
    assert body["group_name"] == group.name
    return {"Authorization": f"Bearer {body['access_token']}"}


def test_group_admin_sees_only_its_own_group(client, group, other_group, group_admin_headers):
    body = client.get("/api/admin/groups", headers=group_admin_headers).json()
    assert [g["id"] for g in body] == [group.id]


def test_group_admin_never_sees_the_admin_code(client, group_admin_headers):
    body = client.get("/api/admin/groups", headers=group_admin_headers).json()
    # 자기 인증키를 다시 읽을 수 있으면 화면을 한 번 본 사람이 영구 접근권을 갖는다
    assert body[0]["admin_code"] is None


def test_super_admin_sees_the_admin_code(client, group):
    body = client.get("/api/admin/groups", headers={"X-Admin-Key": ADMIN_KEY}).json()
    assert any(g["admin_code"] for g in body)


def test_group_admin_sees_only_its_own_members(client, user, other_group_user, group_admin_headers):
    body = client.get("/api/admin/users", headers=group_admin_headers).json()
    assert [u["id"] for u in body] == [user.id]


def test_group_admin_cannot_peek_with_group_id_query(client, other_group, other_group_user, group_admin_headers):
    body = client.get(f"/api/admin/users?group_id={other_group.id}", headers=group_admin_headers).json()
    assert all(u["group_id"] != other_group.id for u in body)


def test_group_admin_cannot_create_a_group(client, group_admin_headers):
    res = client.post("/api/admin/groups", json={"name": "몰래 만든 그룹"}, headers=group_admin_headers)
    assert res.status_code == 403


def test_group_admin_cannot_deactivate_its_own_group(client, group, group_admin_headers):
    res = client.post(f"/api/admin/groups/{group.id}/deactivate", headers=group_admin_headers)
    assert res.status_code == 403


def test_group_admin_cannot_rotate_the_admin_code(client, group, group_admin_headers):
    res = client.post(f"/api/admin/groups/{group.id}/admin-code", headers=group_admin_headers)
    assert res.status_code == 403


def test_group_admin_can_add_a_member_to_its_own_group(client, group, group_admin_headers):
    res = client.post(
        "/api/admin/users",
        json={"group_id": group.id, "display_name": "새 구성원"},
        headers=group_admin_headers,
    )
    assert res.status_code == 201
    assert res.json()["invite_code"]


def test_group_admin_cannot_add_a_member_to_another_group(client, other_group, group_admin_headers):
    res = client.post(
        "/api/admin/users",
        json={"group_id": other_group.id, "display_name": "침입자"},
        headers=group_admin_headers,
    )
    assert res.status_code == 403


def test_group_admin_can_rotate_its_own_members_invite_code(client, user, group_admin_headers):
    before = user.invite_code
    res = client.post(f"/api/admin/users/{user.id}/invite-code", headers=group_admin_headers)
    assert res.status_code == 200
    assert res.json()["invite_code"] != before


def test_group_admin_cannot_rotate_another_groups_invite_code(client, other_group_user, group_admin_headers):
    res = client.post(f"/api/admin/users/{other_group_user.id}/invite-code", headers=group_admin_headers)
    assert res.status_code == 403


def test_group_admin_code_stops_working_after_rotation(client, db_session, group):
    old_code = group.admin_code
    client.post(f"/api/admin/groups/{group.id}/admin-code", headers={"X-Admin-Key": ADMIN_KEY})
    assert client.post("/api/admin/login", json={"admin_key": old_code}).status_code == 403


def test_group_admin_cannot_log_in_to_a_deactivated_group(client, db_session, group):
    _deactivate(client, group.id)
    db_session.refresh(group)
    assert client.post("/api/admin/login", json={"admin_key": group.admin_code}).status_code == 403


def test_existing_group_admin_token_dies_with_the_group(client, group, group_admin_headers):
    assert client.get("/api/admin/groups", headers=group_admin_headers).status_code == 200
    _deactivate(client, group.id)
    assert client.get("/api/admin/groups", headers=group_admin_headers).status_code == 403


def test_group_admin_token_is_not_a_user_token(client, group_admin_headers):
    assert client.get("/api/transactions", headers=group_admin_headers).status_code == 401
