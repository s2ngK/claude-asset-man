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


def test_create_group_missing_header(client):
    res = client.post("/api/admin/groups", json={"name": "새 그룹"})
    assert res.status_code == 422


def test_create_group_wrong_header(client):
    res = client.post(
        "/api/admin/groups",
        json={"name": "새 그룹"},
        headers={"X-Admin-Key": "wrong-key"},
    )
    assert res.status_code == 403


def test_admin_key_no_longer_accepted_in_body_or_query(client, group):
    # admin_key used to be a body/query field; it must no longer grant access
    # (missing the required X-Admin-Key header is a 422, not a 200).
    res = client.get(f"/api/admin/groups?admin_key={ADMIN_KEY}")
    assert res.status_code == 422


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
