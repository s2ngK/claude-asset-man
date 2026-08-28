"""카테고리 라우트 (#13).

이 목록은 **거래를 저장할 때 쓰는 id 의 출처**다. 여기서 남의 그룹 카테고리가 새면
그 이름이 그대로 노출되고, 자기 그룹 것이 빠지면 저장 자체가 막힌다.
"""

from __future__ import annotations


def test_returns_system_defaults(client, auth_headers, category):
    body = client.get("/api/categories", headers=auth_headers).json()
    assert [row["id"] for row in body] == [category.id]
    assert body[0]["group_id"] is None


def test_includes_own_group_category(client, auth_headers, category, own_group_category):
    body = client.get("/api/categories", headers=auth_headers).json()
    ids = {row["id"] for row in body}
    assert own_group_category.id in ids
    assert category.id in ids


def test_excludes_other_group_category(client, auth_headers, category, other_group_category):
    """→ docs/auth-and-scoping.md 의 그룹 격리 불변식"""
    body = client.get("/api/categories", headers=auth_headers).json()
    ids = {row["id"] for row in body}
    assert other_group_category.id not in ids
    assert "다른그룹전용" not in [row["name"] for row in body]


def test_sorted_by_type_then_name(client, auth_headers, db_session, category, own_group_category):
    from app import models

    db_session.add(
        models.Category(id="income-cat", group_id=None, type="income", name="급여", icon=None, is_default=True)
    )
    db_session.commit()

    body = client.get("/api/categories", headers=auth_headers).json()
    keys = [(row["type"], row["name"]) for row in body]
    assert keys == sorted(keys)


def test_requires_auth(client):
    assert client.get("/api/categories").status_code in (401, 403)


# ── 그룹 전용 카테고리 만들기·지우기 (#41) ──────────────────────────────────


def _create(client, headers, name="반려동물", type_="expense", icon="🐶"):
    return client.post("/api/categories", json={"type": type_, "name": name, "icon": icon}, headers=headers)


def test_group_admin_can_create_a_category(client, auth_headers, user, category):
    res = _create(client, auth_headers)
    assert res.status_code == 201
    body = res.json()
    assert body["name"] == "반려동물"
    assert body["group_id"] == user.group_id
    assert body["is_default"] is False


def test_color_comes_from_the_validated_palette(client, auth_headers, category):
    from app.palette import CATEGORICAL_COLORS

    body = _create(client, auth_headers).json()
    # 사용자가 색을 고르지 않는다 — 서버가 검증된 목록에서 배정한다
    assert body["color"] in CATEGORICAL_COLORS


def test_colors_do_not_repeat_until_the_palette_runs_out(client, auth_headers, category):
    colors = [_create(client, auth_headers, name=f"카테고리{i}").json()["color"] for i in range(5)]
    assert len(set(colors)) == 5


def test_color_is_not_taken_from_the_request(client, auth_headers, category):
    res = client.post(
        "/api/categories",
        json={"type": "expense", "name": "직접색", "color": "#00FF00"},
        headers=auth_headers,
    )
    assert res.status_code == 201
    assert res.json()["color"] != "#00FF00"


def test_cannot_duplicate_a_visible_name(client, auth_headers, category):
    """`category` 픽스처가 시스템 기본 `식비` 다. 같은 이름을 또 만들면 목록에 둘이 뜬다."""
    res = _create(client, auth_headers, name=category.name, type_=category.type)
    assert res.status_code == 409


def test_same_name_is_fine_across_types(client, auth_headers, category):
    assert _create(client, auth_headers, name="용돈", type_="expense").status_code == 201
    assert _create(client, auth_headers, name="용돈", type_="income").status_code == 201


def test_new_category_shows_up_in_the_list(client, auth_headers, category):
    created = _create(client, auth_headers).json()
    listed = client.get("/api/categories", headers=auth_headers).json()
    assert created["id"] in [c["id"] for c in listed]


def test_only_the_group_admin_can_create(client, db_session, group_mate, category):
    """같은 그룹이어도 관리자가 아니면 못 만든다."""
    token = client.post("/api/auth/login", json={"invite_code": group_mate.invite_code}).json()["access_token"]
    res = _create(client, {"Authorization": f"Bearer {token}"})
    assert res.status_code == 403


# ── 삭제하면 거래가 `기타` 로 옮겨간다 ───────────────────────────────────────


def _etc(db_session, type_="expense"):
    from app import models

    etc = models.Category(id=f"etc-{type_}", group_id=None, type=type_, name="기타", is_default=True)
    db_session.add(etc)
    db_session.commit()
    return etc


def test_delete_moves_transactions_to_etc(client, auth_headers, db_session, user, category):
    from app import models

    etc = _etc(db_session)
    mine = _create(client, auth_headers).json()
    db_session.add(
        models.Transaction(
            id="tx-1",
            group_id=user.group_id,
            user_id=user.id,
            category_id=mine["id"],
            type="expense",
            amount=5000,
            description="사료값",
            date="2026-08-10",
        )
    )
    db_session.commit()

    assert client.delete(f"/api/categories/{mine['id']}", headers=auth_headers).status_code == 204

    moved = db_session.query(models.Transaction).filter(models.Transaction.id == "tx-1").first()
    assert moved is not None  # 거래는 지워지지 않는다
    assert moved.category_id == etc.id  # 기타로 옮겨간다
    assert moved.description == "사료값"  # 적요가 남아 무엇이었는지 알 수 있다


def test_delete_picks_etc_of_the_same_type(client, auth_headers, db_session, user, category):
    from app import models

    _etc(db_session, "expense")
    income_etc = _etc(db_session, "income")
    mine = _create(client, auth_headers, name="상여", type_="income").json()
    db_session.add(
        models.Transaction(
            id="tx-income",
            group_id=user.group_id,
            user_id=user.id,
            category_id=mine["id"],
            type="income",
            amount=100000,
            description="상여금",
            date="2026-08-10",
        )
    )
    db_session.commit()

    client.delete(f"/api/categories/{mine['id']}", headers=auth_headers)
    moved = db_session.query(models.Transaction).filter(models.Transaction.id == "tx-income").first()
    assert moved.category_id == income_etc.id


def test_cannot_delete_a_system_category(client, auth_headers, category):
    assert client.delete(f"/api/categories/{category.id}", headers=auth_headers).status_code == 404


def test_cannot_delete_another_groups_category(client, auth_headers, other_group_category):
    """존재 여부를 알려주지 않는다 — 404 로 숨긴다."""
    assert client.delete(f"/api/categories/{other_group_category.id}", headers=auth_headers).status_code == 404


def test_only_the_group_admin_can_delete(client, auth_headers, db_session, group_mate, category):
    _etc(db_session)
    mine = _create(client, auth_headers).json()
    token = client.post("/api/auth/login", json={"invite_code": group_mate.invite_code}).json()["access_token"]
    res = client.delete(f"/api/categories/{mine['id']}", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 403


def test_me_reports_group_admin(client, auth_headers, group_mate):
    assert client.get("/api/auth/me", headers=auth_headers).json()["is_group_admin"] is True

    token = client.post("/api/auth/login", json={"invite_code": group_mate.invite_code}).json()["access_token"]
    body = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    assert body["is_group_admin"] is False
