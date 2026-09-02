"""대출·예금·적금 계좌 (#44).

여기서 지켜야 할 것은 두 가지다.

1. **잔액은 저장되지 않는다.** 거래에서 계산되므로, 거래가 바뀌면 잔액도 따라 바뀌어야 한다
2. **소유는 개인, 열람은 그룹.** 동료 계좌는 보이지만 고칠 수 없고, 남의 그룹 것은 없는 것이다
"""

from __future__ import annotations


def _new(client, headers, **overrides):
    payload = {
        "kind": "deposit",
        "name": "정기예금",
        "amount": 10_000_000,
        "rate": 3.2,
        "started_on": "2026-01-01",
        "matures_on": "2027-01-01",
    }
    payload.update(overrides)
    return client.post("/api/accounts", json=payload, headers=headers)


def _spend(client, headers, category, account_id, amount, interest=None, day="2026-02-10"):
    body = {
        "category_id": category.id,
        "type": "expense",
        "amount": amount,
        "date": day,
        "account_id": account_id,
    }
    if interest is not None:
        body["interest_amount"] = interest
    return client.post("/api/transactions", json=body, headers=headers)


# ── 만들기 ───────────────────────────────────────────────────────────────────


def test_creates_account_owned_by_caller(client, auth_headers, user):
    body = _new(client, auth_headers).json()
    assert body["user_id"] == user.id
    assert body["group_id"] == user.group_id
    assert body["status"] == "active"


def test_repay_method_is_dropped_for_non_loans(client, auth_headers):
    """예금에 상환방식이 붙어 있으면 화면이 그것을 믿고 상환 계산을 시도한다."""
    body = _new(client, auth_headers, kind="deposit", repay_method="equal_payment").json()
    assert body["repay_method"] is None


def test_repay_method_is_kept_for_loans(client, auth_headers):
    body = _new(client, auth_headers, kind="loan", repay_method="equal_principal").json()
    assert body["repay_method"] == "equal_principal"


def test_rejects_maturity_before_start(client, auth_headers):
    res = _new(client, auth_headers, started_on="2027-01-01", matures_on="2026-01-01")
    assert res.status_code == 422


def test_rejects_unknown_kind(client, auth_headers):
    assert _new(client, auth_headers, kind="주식").status_code == 422


def test_rejects_zero_amount(client, auth_headers):
    assert _new(client, auth_headers, amount=0).status_code == 422


def test_requires_auth(client):
    assert client.get("/api/accounts").status_code == 403


# ── 목록과 격리 ──────────────────────────────────────────────────────────────


def test_lists_group_accounts_including_mates(client, auth_headers, loan_account, mate_account):
    """소유는 개인이지만 **열람은 그룹**이다 → docs/auth-and-scoping.md"""
    body = client.get("/api/accounts", headers=auth_headers).json()
    ids = {row["id"] for row in body}
    assert ids == {loan_account.id, mate_account.id}


def test_shows_owner_name(client, auth_headers, mate_account, group_mate):
    body = client.get("/api/accounts", headers=auth_headers).json()
    assert body[0]["user_display_name"] == group_mate.display_name


def test_excludes_other_group_accounts(client, auth_headers, loan_account, other_group_account):
    body = client.get("/api/accounts", headers=auth_headers).json()
    names = [row["name"] for row in body]
    assert "남의그룹예금" not in names
    assert [row["id"] for row in body] == [loan_account.id]


def test_filters_by_kind(client, auth_headers, loan_account, mate_account):
    body = client.get("/api/accounts?kind=loan", headers=auth_headers).json()
    assert [row["id"] for row in body] == [loan_account.id]


# ── 잔액은 계산된다 ──────────────────────────────────────────────────────────


def test_loan_balance_starts_at_principal(client, auth_headers, loan_account):
    body = client.get("/api/accounts", headers=auth_headers).json()
    assert body[0]["balance"] == loan_account.amount
    assert body[0]["paid_principal"] == 0


def test_loan_balance_drops_by_principal_portion_only(client, auth_headers, category, loan_account):
    """50만원을 갚고 그중 이자가 10만원이면 **원금은 40만원만** 줄어야 한다."""
    _spend(client, auth_headers, category, loan_account.id, 500_000, interest=100_000)

    body = client.get("/api/accounts", headers=auth_headers).json()[0]
    assert body["paid_principal"] == 400_000
    assert body["paid_interest"] == 100_000
    assert body["balance"] == loan_account.amount - 400_000


def test_loan_balance_never_goes_negative(client, auth_headers, category, loan_account):
    _spend(client, auth_headers, category, loan_account.id, 100_000_000)
    _spend(client, auth_headers, category, loan_account.id, 5_000_000, day="2026-03-10")
    assert client.get("/api/accounts", headers=auth_headers).json()[0]["balance"] == 0


def test_deposit_balance_is_the_deposited_amount(client, auth_headers):
    body = _new(client, auth_headers, kind="deposit", amount=10_000_000).json()
    assert body["balance"] == 10_000_000


def test_installment_balance_is_what_was_paid_in(client, auth_headers, category):
    """적금의 `amount` 는 **월 납입액**이라 잔액이 아니다. 넣은 만큼이 잔액이다."""
    account = _new(client, auth_headers, kind="installment", amount=300_000).json()
    _spend(client, auth_headers, category, account["id"], 300_000, day="2026-02-01")
    _spend(client, auth_headers, category, account["id"], 300_000, day="2026-03-01")

    body = client.get("/api/accounts", headers=auth_headers).json()[0]
    assert body["balance"] == 600_000


def test_balance_follows_transaction_deletion(client, auth_headers, category, loan_account):
    """잔액이 컬럼이었다면 여기서 어긋난다."""
    tx = _spend(client, auth_headers, category, loan_account.id, 1_000_000).json()
    client.delete(f"/api/transactions/{tx['id']}", headers=auth_headers)
    assert client.get("/api/accounts", headers=auth_headers).json()[0]["balance"] == loan_account.amount


def test_balance_counts_a_mates_repayment(client, auth_headers, db_session, category, loan_account, group_mate):
    """배우자가 대신 갚는 것은 공동 가계부에서 자연스럽다."""
    from app import models

    db_session.add(
        models.Transaction(
            id="mate-repay",
            group_id=loan_account.group_id,
            user_id=group_mate.id,
            category_id=category.id,
            type="expense",
            amount=1_000_000,
            date="2026-02-10",
            account_id=loan_account.id,
            interest_amount=200_000,
        )
    )
    db_session.commit()

    body = client.get("/api/accounts", headers=auth_headers).json()[0]
    assert body["balance"] == loan_account.amount - 800_000


# ── 고치기·지우기는 주인만 ───────────────────────────────────────────────────


def test_owner_can_update(client, auth_headers, loan_account):
    res = client.put(f"/api/accounts/{loan_account.id}", json={"name": "주택담보대출"}, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["name"] == "주택담보대출"


def test_mates_account_cannot_be_updated(client, auth_headers, mate_account):
    """목록에 이미 보이고 주인 이름까지 표시되므로 숨길 것이 없다 — 403 이다."""
    res = client.put(f"/api/accounts/{mate_account.id}", json={"name": "가로채기"}, headers=auth_headers)
    assert res.status_code == 403


def test_other_group_account_is_a_404(client, auth_headers, other_group_account):
    """목록에 안 나오므로 존재 자체를 숨긴다."""
    res = client.put(f"/api/accounts/{other_group_account.id}", json={"name": "x"}, headers=auth_headers)
    assert res.status_code == 404


def test_update_rejects_maturity_before_start(client, auth_headers, loan_account):
    res = client.put(f"/api/accounts/{loan_account.id}", json={"matures_on": "2025-01-01"}, headers=auth_headers)
    assert res.status_code == 422


def test_delete_keeps_transactions_and_unlinks_them(client, auth_headers, category, loan_account):
    """실제로 돈이 오간 기록이다. 계좌를 정리한다고 가계부에서 사라지면 안 된다."""
    tx = _spend(client, auth_headers, category, loan_account.id, 500_000, interest=100_000).json()

    assert client.delete(f"/api/accounts/{loan_account.id}", headers=auth_headers).status_code == 204

    rows = client.get("/api/transactions", headers=auth_headers).json()
    assert [row["id"] for row in rows] == [tx["id"]]
    assert rows[0]["account_id"] is None
    assert rows[0]["interest_amount"] is None


def test_mates_account_cannot_be_deleted(client, auth_headers, mate_account):
    assert client.delete(f"/api/accounts/{mate_account.id}", headers=auth_headers).status_code == 403


# ── 정산 ─────────────────────────────────────────────────────────────────────


def _settle(client, headers, account_id, amount, status="matured", **extra):
    return client.post(
        f"/api/accounts/{account_id}/settle",
        json={"status": status, "settled_on": "2027-01-01", "settled_amount": amount, **extra},
        headers=headers,
    )


def test_settle_records_the_amount_a_person_typed(client, auth_headers, income_category):
    """계산기가 낸 값이 아니라 **사람이 확정한 값**을 그대로 믿는다."""
    account = _new(client, auth_headers, kind="deposit", amount=10_000_000).json()
    body = _settle(client, auth_headers, account["id"], 10_271_000).json()

    assert body["status"] == "matured"
    assert body["settled_amount"] == 10_271_000
    assert body["settled_on"] == "2027-01-01"


def test_settled_account_has_no_balance(client, auth_headers, income_category):
    account = _new(client, auth_headers, kind="deposit", amount=10_000_000).json()
    body = _settle(client, auth_headers, account["id"], 10_271_000).json()
    assert body["balance"] == 0


def test_settle_books_the_interest_as_income(client, auth_headers, income_category):
    account = _new(client, auth_headers, kind="deposit", amount=10_000_000).json()
    _settle(client, auth_headers, account["id"], 10_271_000)

    rows = client.get("/api/transactions", headers=auth_headers).json()
    assert len(rows) == 1
    assert rows[0]["type"] == "income"
    assert rows[0]["amount"] == 271_000
    assert rows[0]["category_id"] == income_category.id
    # 계좌는 끝났다. 이 거래는 잔액을 움직이지 않는다.
    assert rows[0]["account_id"] is None


def test_installment_interest_is_measured_against_what_was_paid_in(client, auth_headers, category, income_category):
    account = _new(client, auth_headers, kind="installment", amount=300_000).json()
    _spend(client, auth_headers, category, account["id"], 300_000, day="2026-02-01")
    _spend(client, auth_headers, category, account["id"], 300_000, day="2026-03-01")

    _settle(client, auth_headers, account["id"], 620_000)

    income = [r for r in client.get("/api/transactions", headers=auth_headers).json() if r["type"] == "income"]
    assert [r["amount"] for r in income] == [20_000]


def test_settle_without_gain_books_nothing(client, auth_headers, income_category):
    """중도해지로 원금만 돌려받는 경우다. 0원짜리 수입 줄을 남기지 않는다."""
    account = _new(client, auth_headers, kind="deposit", amount=10_000_000).json()
    _settle(client, auth_headers, account["id"], 10_000_000, status="closed")

    assert client.get("/api/transactions", headers=auth_headers).json() == []


def test_settle_uses_the_requested_category(client, auth_headers, db_session, income_category):
    from app import models

    db_session.add(models.Category(id="income-etc", group_id=None, type="income", name="기타", is_default=True))
    db_session.commit()

    account = _new(client, auth_headers, kind="deposit", amount=1_000_000).json()
    _settle(client, auth_headers, account["id"], 1_050_000, interest_category_id="income-etc")

    rows = client.get("/api/transactions", headers=auth_headers).json()
    assert rows[0]["category_id"] == "income-etc"


def test_settle_rejects_an_expense_category(client, auth_headers, category, income_category):
    """이자는 수입이다. 지출 카테고리를 붙이면 통계가 뒤집힌다."""
    account = _new(client, auth_headers, kind="deposit", amount=1_000_000).json()
    res = _settle(client, auth_headers, account["id"], 1_050_000, interest_category_id=category.id)
    assert res.status_code == 404


def test_settle_refuses_when_no_income_category_exists(client, auth_headers):
    account = _new(client, auth_headers, kind="deposit", amount=1_000_000).json()
    assert _settle(client, auth_headers, account["id"], 1_050_000).status_code == 409


def test_loan_settle_books_no_transaction(client, auth_headers, loan_account, income_category):
    """상환은 회차마다 이미 입력돼 있다. 여기서는 끝났다는 사실만 기록한다."""
    _settle(client, auth_headers, loan_account.id, 0, status="closed")
    assert client.get("/api/transactions", headers=auth_headers).json() == []


def test_settle_twice_is_rejected(client, auth_headers, income_category):
    account = _new(client, auth_headers, kind="deposit", amount=1_000_000).json()
    _settle(client, auth_headers, account["id"], 1_050_000)
    assert _settle(client, auth_headers, account["id"], 9_999_999).status_code == 409


def test_mates_account_cannot_be_settled(client, auth_headers, mate_account, income_category):
    assert _settle(client, auth_headers, mate_account.id, 1_000).status_code == 403


# ── 거래 쪽 검증 ─────────────────────────────────────────────────────────────


def test_transaction_rejects_other_group_account(client, auth_headers, category, other_group_account):
    res = _spend(client, auth_headers, category, other_group_account.id, 10_000)
    assert res.status_code == 404


def test_transaction_rejects_interest_without_an_account(client, auth_headers, category):
    res = client.post(
        "/api/transactions",
        json={
            "category_id": category.id,
            "type": "expense",
            "amount": 500_000,
            "date": "2026-02-10",
            "interest_amount": 100_000,
        },
        headers=auth_headers,
    )
    assert res.status_code == 422


def test_transaction_rejects_interest_larger_than_amount(client, auth_headers, category, loan_account):
    """원금분이 음수가 되면 잔액이 거꾸로 늘어난다."""
    res = _spend(client, auth_headers, category, loan_account.id, 100_000, interest=200_000)
    assert res.status_code == 422


def test_update_rejects_interest_larger_than_new_amount(client, auth_headers, category, loan_account):
    """**저장 뒤의 상태**를 기준으로 본다 — 금액만 줄여도 앞뒤가 안 맞을 수 있다."""
    tx = _spend(client, auth_headers, category, loan_account.id, 500_000, interest=100_000).json()
    res = client.put(f"/api/transactions/{tx['id']}", json={"amount": 50_000}, headers=auth_headers)
    assert res.status_code == 422


def test_transaction_carries_the_account_name(client, auth_headers, category, loan_account):
    _spend(client, auth_headers, category, loan_account.id, 500_000, interest=100_000)
    row = client.get("/api/transactions", headers=auth_headers).json()[0]
    assert row["account_name"] == loan_account.name
    assert row["interest_amount"] == 100_000


# ── 계좌의 기본 카테고리 ─────────────────────────────────────────────────────


def test_account_carries_a_default_category(client, auth_headers, category):
    """상환·납입 내역을 넣을 때마다 카테고리를 다시 고르지 않게 계좌에 정해둔다."""
    body = _new(client, auth_headers, kind="loan", category_id=category.id).json()
    assert body["category_id"] == category.id
    assert body["category_name"] == category.name


def test_account_category_is_optional(client, auth_headers):
    body = _new(client, auth_headers).json()
    assert body["category_id"] is None


def test_account_rejects_an_income_category(client, auth_headers, income_category):
    """계좌를 움직이는 거래는 언제나 지출이다. 수입 카테고리를 달면 저장할 수 없는 조합이 된다."""
    res = _new(client, auth_headers, category_id=income_category.id)
    assert res.status_code == 404


def test_account_rejects_another_groups_category(client, auth_headers, other_group_category):
    res = _new(client, auth_headers, category_id=other_group_category.id)
    assert res.status_code == 404


def test_account_category_can_be_changed(client, auth_headers, category, own_group_category, loan_account):
    res = client.put(
        f"/api/accounts/{loan_account.id}", json={"category_id": own_group_category.id}, headers=auth_headers
    )
    assert res.status_code == 200
    assert res.json()["category_id"] == own_group_category.id


def test_account_category_can_be_cleared(client, auth_headers, category):
    account = _new(client, auth_headers, category_id=category.id).json()
    res = client.put(f"/api/accounts/{account['id']}", json={"category_id": None}, headers=auth_headers)
    assert res.json()["category_id"] is None


# ── 수입은 계좌에 붙일 수 없다 ───────────────────────────────────────────────


def test_income_cannot_be_linked_to_an_account(client, auth_headers, income_category, loan_account):
    """잔액 계산이 부호를 보지 않는다 — 붙이면 **수입이 빚을 깎는다.**

    500만원짜리 급여를 대출에 연결했더니 잔액이 1억에서 9,500만으로 줄었다.
    """
    res = client.post(
        "/api/transactions",
        json={
            "category_id": income_category.id,
            "type": "income",
            "amount": 5_000_000,
            "date": "2026-02-10",
            "account_id": loan_account.id,
        },
        headers=auth_headers,
    )
    assert res.status_code == 422
    assert client.get("/api/accounts", headers=auth_headers).json()[0]["balance"] == loan_account.amount


def test_switching_a_linked_transaction_to_income_is_rejected(
    client, auth_headers, category, income_category, loan_account
):
    """**저장 뒤의 상태**로 본다 — 종류만 바꿔도 앞뒤가 안 맞는다."""
    tx = _spend(client, auth_headers, category, loan_account.id, 500_000, interest=100_000).json()
    res = client.put(
        f"/api/transactions/{tx['id']}",
        json={"type": "income", "category_id": income_category.id},
        headers=auth_headers,
    )
    assert res.status_code == 422
