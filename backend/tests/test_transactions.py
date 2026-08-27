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


# ── 입력 검증 (#6) ────────────────────────────────────────────────────────────
# 아래 세 값은 예전에 모두 201 로 저장됐다. type 오타가 특히 고약했는데,
# stats.py 가 income/expense 만 집계하는 탓에 그 거래는 목록에는 보이면서
# 합계에서만 사라져 "숫자가 안 맞는다"로만 나타났다.


def test_create_rejects_unknown_type(client, auth_headers, category):
    res = client.post("/api/transactions", json=_create_payload(category, type="바나나"), headers=auth_headers)
    assert res.status_code == 422


def test_create_rejects_non_positive_amount(client, auth_headers, category):
    for amount in (-50000, 0):
        res = client.post("/api/transactions", json=_create_payload(category, amount=amount), headers=auth_headers)
        assert res.status_code == 422, f"amount={amount} 가 통과함"


def test_create_rejects_malformed_date(client, auth_headers, category):
    for bad in ("내일", "2026-13-01", "20260701"):
        res = client.post("/api/transactions", json=_create_payload(category, date=bad), headers=auth_headers)
        assert res.status_code == 422, f"date={bad!r} 가 통과함"


def test_stored_date_stays_an_iso_string(client, auth_headers, category, db_session):
    """스키마는 date 로 받지만 컬럼은 String 이다.

    월 필터가 date.startswith("YYYY-MM") 라서, 저장 형식이 어긋나면
    거래가 어느 달 통계에도 잡히지 않는다.
    """
    res = client.post("/api/transactions", json=_create_payload(category, date="2026-07-01"), headers=auth_headers)
    assert res.status_code == 201

    stored = db_session.query(models.Transaction).one()
    assert stored.date == "2026-07-01"
    assert isinstance(stored.date, str)

    res = client.get("/api/transactions?month=2026-07", headers=auth_headers)
    assert len(res.json()) == 1


def test_update_rejects_invalid_values(client, auth_headers, category):
    tx_id = client.post("/api/transactions", json=_create_payload(category), headers=auth_headers).json()["id"]

    for patch in ({"type": "바나나"}, {"amount": -1}, {"amount": 0}, {"date": "내일"}):
        res = client.put(f"/api/transactions/{tx_id}", json=patch, headers=auth_headers)
        assert res.status_code == 422, f"{patch} 가 통과함"


def test_update_keeps_date_storable(client, auth_headers, category, db_session):
    tx_id = client.post("/api/transactions", json=_create_payload(category), headers=auth_headers).json()["id"]

    res = client.put(f"/api/transactions/{tx_id}", json={"date": "2026-08-15"}, headers=auth_headers)
    assert res.status_code == 200

    db_session.expire_all()
    stored = db_session.query(models.Transaction).one()
    assert stored.date == "2026-08-15"


def test_valid_transaction_reaches_the_summary(client, auth_headers, category):
    """#6 의 핵심 회귀: 저장된 거래는 반드시 집계에 잡혀야 한다."""
    client.post(
        "/api/transactions",
        json=_create_payload(category, type="expense", amount=9999, date="2026-07-02"),
        headers=auth_headers,
    )

    summary = client.get("/api/stats/summary?month=2026-07", headers=auth_headers).json()
    assert summary["expense"] == 9999
    assert summary["balance"] == -9999
