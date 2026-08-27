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


# ── 카테고리 그룹 소유권 (#5) ─────────────────────────────────────────────────
# 예전에는 카테고리의 "존재" 여부만 확인해서, 다른 그룹 전용 카테고리 ID 를 알면
# 자기 거래에 붙일 수 있었다. 응답의 category_name 으로 그 그룹의 카테고리 이름이
# 그대로 새어 나갔다.


def test_create_rejects_other_groups_category(client, auth_headers, other_group_category):
    res = client.post(
        "/api/transactions",
        json=_create_payload(other_group_category),
        headers=auth_headers,
    )
    assert res.status_code == 404
    assert other_group_category.name not in res.text


def test_create_accepts_own_group_category(client, auth_headers, own_group_category):
    res = client.post("/api/transactions", json=_create_payload(own_group_category), headers=auth_headers)
    assert res.status_code == 201
    assert res.json()["category_name"] == own_group_category.name


def test_create_accepts_system_default_category(client, auth_headers, category):
    """group_id IS NULL 인 시스템 기본값은 모든 그룹이 쓸 수 있어야 한다."""
    res = client.post("/api/transactions", json=_create_payload(category), headers=auth_headers)
    assert res.status_code == 201


def test_update_rejects_other_groups_category(client, auth_headers, category, other_group_category):
    tx_id = client.post("/api/transactions", json=_create_payload(category), headers=auth_headers).json()["id"]

    res = client.put(
        f"/api/transactions/{tx_id}",
        json={"category_id": other_group_category.id},
        headers=auth_headers,
    )
    assert res.status_code == 404
    assert other_group_category.name not in res.text


def test_update_rejects_unknown_category(client, auth_headers, category):
    """수정 경로는 예전에 카테고리 존재 여부조차 확인하지 않았다."""
    tx_id = client.post("/api/transactions", json=_create_payload(category), headers=auth_headers).json()["id"]

    res = client.put(f"/api/transactions/{tx_id}", json={"category_id": "없는-카테고리"}, headers=auth_headers)
    assert res.status_code == 404


def test_update_accepts_own_group_category(client, auth_headers, category, own_group_category):
    tx_id = client.post("/api/transactions", json=_create_payload(category), headers=auth_headers).json()["id"]

    res = client.put(
        f"/api/transactions/{tx_id}",
        json={"category_id": own_group_category.id},
        headers=auth_headers,
    )
    assert res.status_code == 200
    assert res.json()["category_name"] == own_group_category.name


def test_category_list_hides_other_groups_category(
    client, auth_headers, category, own_group_category, other_group_category
):
    """목록과 저장이 같은 조건을 봐야 한다 — 목록에 없는 것은 붙일 수도 없어야 한다."""
    names = {c["name"] for c in client.get("/api/categories", headers=auth_headers).json()}
    assert category.name in names
    assert own_group_category.name in names
    assert other_group_category.name not in names


# ── 자기 내역만 수정·삭제 ─────────────────────────────────────────────────────
# 그룹 가계부라 목록과 통계는 그룹 전체를 보여준다. 다만 쓰기는 자기 것만이어야
# 한다 — 예전에는 group_id 만 맞으면 남의 내역도 고치고 지울 수 있었다.


def test_cannot_delete_group_mates_transaction(client, auth_headers, mate_transaction):
    res = client.delete(f"/api/transactions/{mate_transaction.id}", headers=auth_headers)
    assert res.status_code == 403

    # 실제로 남아 있어야 한다
    items = client.get("/api/transactions", headers=auth_headers).json()
    assert any(t["id"] == mate_transaction.id for t in items)


def test_cannot_update_group_mates_transaction(client, auth_headers, mate_transaction):
    res = client.put(f"/api/transactions/{mate_transaction.id}", json={"amount": 1}, headers=auth_headers)
    assert res.status_code == 403

    items = client.get("/api/transactions", headers=auth_headers).json()
    unchanged = next(t for t in items if t["id"] == mate_transaction.id)
    assert unchanged["amount"] == 7000


def test_group_mates_transaction_is_still_visible(client, auth_headers, mate_transaction):
    """읽기는 그대로 그룹 전체다. 공동 가계부의 핵심 기능이라 좁히면 안 된다."""
    items = client.get("/api/transactions", headers=auth_headers).json()
    shown = next(t for t in items if t["id"] == mate_transaction.id)
    assert shown["user_display_name"] == "같은그룹동료"


def test_group_mates_spending_still_counts_in_stats(client, auth_headers, mate_transaction):
    summary = client.get("/api/stats/summary?month=2026-07", headers=auth_headers).json()
    assert summary["expense"] == 7000

    members = client.get("/api/stats/members?month=2026-07", headers=auth_headers).json()
    assert any(m["display_name"] == "같은그룹동료" for m in members)


def test_can_still_modify_own_transaction(client, auth_headers, category):
    tx_id = client.post("/api/transactions", json=_create_payload(category), headers=auth_headers).json()["id"]

    assert client.put(f"/api/transactions/{tx_id}", json={"amount": 5000}, headers=auth_headers).status_code == 200
    assert client.delete(f"/api/transactions/{tx_id}", headers=auth_headers).status_code == 204


def test_other_groups_transaction_still_returns_404(client, auth_headers, db_session, category):
    """다른 그룹 것은 403 이 아니라 404 — 목록에 안 보이므로 존재를 숨긴다."""
    other = models.Group(id="outside-group", name="바깥 그룹")
    db_session.add(other)
    db_session.add(models.User(id="outside-user", group_id=other.id, display_name="외부", invite_code="OUTSIDE1"))
    db_session.add(
        models.Transaction(
            id="outside-transaction",
            group_id=other.id,
            user_id="outside-user",
            category_id=category.id,
            type="expense",
            amount=1000,
            description="외부",
            date="2026-07-01",
        )
    )
    db_session.commit()

    res = client.delete("/api/transactions/outside-transaction", headers=auth_headers)
    assert res.status_code == 404

    res = client.put("/api/transactions/outside-transaction", json={"amount": 1}, headers=auth_headers)
    assert res.status_code == 404
