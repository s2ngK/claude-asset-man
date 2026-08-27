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
