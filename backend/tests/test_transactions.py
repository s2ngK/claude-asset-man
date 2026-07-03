from app import models


def _create_payload(category, **overrides):
    payload = {
        "category_id": category.id,
        "type": "expense",
        "amount": 12000,
        "description": "점심",
        "date": "2026-07-01",
    }
    payload.update(overrides)
    return payload


def test_create_and_list_transaction(client, auth_headers, category):
    res = client.post("/api/transactions", json=_create_payload(category), headers=auth_headers)
    assert res.status_code == 201
    tx = res.json()
    assert tx["amount"] == 12000
    assert tx["category_name"] == category.name

    res = client.get("/api/transactions", headers=auth_headers)
    assert res.status_code == 200
    items = res.json()
    assert len(items) == 1
    assert items[0]["id"] == tx["id"]


def test_create_transaction_unknown_category(client, auth_headers):
    res = client.post(
        "/api/transactions",
        json={
            "category_id": "does-not-exist",
            "type": "expense",
            "amount": 1000,
            "date": "2026-07-01",
        },
        headers=auth_headers,
    )
    assert res.status_code == 404


def test_update_and_delete_transaction(client, auth_headers, category):
    res = client.post("/api/transactions", json=_create_payload(category), headers=auth_headers)
    tx_id = res.json()["id"]

    res = client.put(f"/api/transactions/{tx_id}", json={"amount": 7000}, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["amount"] == 7000

    res = client.delete(f"/api/transactions/{tx_id}", headers=auth_headers)
    assert res.status_code == 204

    res = client.get("/api/transactions", headers=auth_headers)
    assert res.json() == []


def test_transactions_are_scoped_to_group(client, auth_headers, db_session, category):
    other_group = models.Group(id="other-group", name="다른 그룹")
    other_user = models.User(id="other-user", group_id=other_group.id, display_name="김철수", invite_code="OTHERCODE")
    other_tx = models.Transaction(
        id="other-tx",
        group_id=other_group.id,
        user_id=other_user.id,
        category_id=category.id,
        type="expense",
        amount=1000,
        date="2026-07-01",
    )
    db_session.add_all([other_group, other_user, other_tx])
    db_session.commit()

    res = client.get("/api/transactions", headers=auth_headers)
    assert res.status_code == 200
    assert res.json() == []
