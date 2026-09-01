"""통계 라우트 (#13).

집계·정렬·퍼센트는 **조용히 틀리기 좋은** 로직이라 값 자체를 못박아 둔다.
"""

from __future__ import annotations

from datetime import date

from dateutil.relativedelta import relativedelta

from app import models

THIS_MONTH = date.today().replace(day=1).strftime("%Y-%m")
LAST_MONTH = (date.today().replace(day=1) - relativedelta(months=1)).strftime("%Y-%m")
LONG_AGO = (date.today().replace(day=1) - relativedelta(months=11)).strftime("%Y-%m")


def _tx(db, *, user, category, amount, type_="expense", month=THIS_MONTH, day="15", tx_id=None):
    tx = models.Transaction(
        id=tx_id or f"tx-{type_}-{amount}-{month}-{user.id}",
        group_id=user.group_id,
        user_id=user.id,
        category_id=category.id,
        type=type_,
        amount=amount,
        description="테스트",
        date=f"{month}-{day}",
    )
    db.add(tx)
    db.commit()
    return tx


# ── summary ──────────────────────────────────────────────────────────────────


def test_summary_counts_group_not_just_me(client, auth_headers, db_session, user, group_mate, category):
    _tx(db_session, user=user, category=category, amount=1000)
    _tx(db_session, user=group_mate, category=category, amount=2000)
    _tx(db_session, user=user, category=category, amount=5000, type_="income")

    body = client.get(f"/api/stats/summary?month={THIS_MONTH}", headers=auth_headers).json()
    assert body == {"income": 5000, "expense": 3000, "balance": 2000}


def test_summary_user_only_excludes_group_mate(client, auth_headers, db_session, user, group_mate, category):
    _tx(db_session, user=user, category=category, amount=1000)
    _tx(db_session, user=group_mate, category=category, amount=2000)

    body = client.get(f"/api/stats/summary?month={THIS_MONTH}&user_only=true", headers=auth_headers).json()
    assert body["expense"] == 1000


def test_summary_ignores_other_months(client, auth_headers, db_session, user, category):
    _tx(db_session, user=user, category=category, amount=1000)
    _tx(db_session, user=user, category=category, amount=9999, month=LAST_MONTH)

    body = client.get(f"/api/stats/summary?month={THIS_MONTH}", headers=auth_headers).json()
    assert body["expense"] == 1000


def test_summary_of_empty_month_is_zero(client, auth_headers):
    body = client.get(f"/api/stats/summary?month={THIS_MONTH}", headers=auth_headers).json()
    assert body == {"income": 0, "expense": 0, "balance": 0}


# ── categories ───────────────────────────────────────────────────────────────


def test_category_stats_count_expense_only(client, auth_headers, db_session, user, category):
    _tx(db_session, user=user, category=category, amount=3000)
    _tx(db_session, user=user, category=category, amount=7000, type_="income")

    body = client.get(f"/api/stats/categories?month={THIS_MONTH}", headers=auth_headers).json()
    assert len(body) == 1
    assert body[0]["total"] == 3000  # 수입 7000 이 섞이면 안 된다


def test_category_stats_percentage_and_order(client, auth_headers, db_session, user, category, own_group_category):
    _tx(db_session, user=user, category=category, amount=2500)
    _tx(db_session, user=user, category=own_group_category, amount=7500)

    body = client.get(f"/api/stats/categories?month={THIS_MONTH}", headers=auth_headers).json()
    assert [row["total"] for row in body] == [7500, 2500]  # 큰 것부터
    assert [row["percentage"] for row in body] == [75.0, 25.0]
    assert sum(row["percentage"] for row in body) == 100.0


def test_category_stats_user_only(client, auth_headers, db_session, user, group_mate, category):
    _tx(db_session, user=user, category=category, amount=1000)
    _tx(db_session, user=group_mate, category=category, amount=4000)

    every = client.get(f"/api/stats/categories?month={THIS_MONTH}", headers=auth_headers).json()
    mine = client.get(f"/api/stats/categories?month={THIS_MONTH}&user_only=true", headers=auth_headers).json()
    assert every[0]["total"] == 5000
    assert mine[0]["total"] == 1000


# ── members ──────────────────────────────────────────────────────────────────


def test_member_stats_skip_members_who_spent_nothing(client, auth_headers, db_session, user, group_mate, category):
    """INNER JOIN 이라 지출이 없는 구성원은 아예 안 나온다 — 의도된 동작이다."""
    _tx(db_session, user=user, category=category, amount=1000)

    body = client.get(f"/api/stats/members?month={THIS_MONTH}", headers=auth_headers).json()
    assert [row["display_name"] for row in body] == [user.display_name]
    assert group_mate.display_name not in [row["display_name"] for row in body]


def test_member_stats_percentage_splits_across_members(client, auth_headers, db_session, user, group_mate, category):
    _tx(db_session, user=user, category=category, amount=3000)
    _tx(db_session, user=group_mate, category=category, amount=1000)

    body = client.get(f"/api/stats/members?month={THIS_MONTH}", headers=auth_headers).json()
    assert [(row["display_name"], row["total"], row["percentage"]) for row in body] == [
        (user.display_name, 3000, 75.0),
        (group_mate.display_name, 1000, 25.0),
    ]


def test_member_stats_count_expense_only(client, auth_headers, db_session, user, category):
    _tx(db_session, user=user, category=category, amount=1000)
    _tx(db_session, user=user, category=category, amount=8000, type_="income")

    body = client.get(f"/api/stats/members?month={THIS_MONTH}", headers=auth_headers).json()
    assert body[0]["total"] == 1000


# ── trend ────────────────────────────────────────────────────────────────────


def test_trend_returns_six_months_oldest_first(client, auth_headers):
    body = client.get("/api/stats/trend", headers=auth_headers).json()
    assert len(body) == 6
    months = [row["month"] for row in body]
    assert months == sorted(months)
    assert months[-1] == THIS_MONTH


def test_trend_fills_empty_months_with_zero(client, auth_headers, db_session, user, category):
    _tx(db_session, user=user, category=category, amount=1200)

    body = client.get("/api/stats/trend", headers=auth_headers).json()
    by_month = {row["month"]: row for row in body}
    assert by_month[THIS_MONTH]["expense"] == 1200
    assert by_month[LAST_MONTH] == {"month": LAST_MONTH, "income": 0, "expense": 0}


def test_trend_ignores_months_outside_the_window(client, auth_headers, db_session, user, category):
    """11개월 전 거래는 6개월 창 밖이라 어느 달에도 잡히면 안 된다."""
    _tx(db_session, user=user, category=category, amount=50000, month=LONG_AGO)

    body = client.get("/api/stats/trend", headers=auth_headers).json()
    assert all(row["expense"] == 0 and row["income"] == 0 for row in body)


def test_trend_separates_income_and_expense(client, auth_headers, db_session, user, category):
    _tx(db_session, user=user, category=category, amount=1000)
    _tx(db_session, user=user, category=category, amount=4000, type_="income")

    body = client.get("/api/stats/trend", headers=auth_headers).json()
    this = next(row for row in body if row["month"] == THIS_MONTH)
    assert this["income"] == 4000
    assert this["expense"] == 1000


def test_trend_is_group_scoped(client, auth_headers, db_session, user, category, other_group_category):
    """다른 그룹 거래가 추이에 새면 안 된다 → docs/auth-and-scoping.md"""
    other_user = models.User(
        id="outsider", group_id=other_group_category.group_id, display_name="남", invite_code="OUTSIDER1"
    )
    db_session.add(other_user)
    db_session.commit()
    _tx(db_session, user=other_user, category=other_group_category, amount=99999)

    body = client.get("/api/stats/trend", headers=auth_headers).json()
    assert all(row["expense"] == 0 for row in body)


# ── 인증 ─────────────────────────────────────────────────────────────────────


def test_stats_require_auth(client):
    paths = (
        f"/api/stats/summary?month={THIS_MONTH}",
        f"/api/stats/categories?month={THIS_MONTH}",
        f"/api/stats/members?month={THIS_MONTH}",
        "/api/stats/trend",
    )
    for path in paths:
        assert client.get(path).status_code in (401, 403)


# ── daily (#43) ──────────────────────────────────────────────────────────────


def test_daily_groups_by_date(client, auth_headers, db_session, user, category):
    _tx(db_session, user=user, category=category, amount=1000, day="03", tx_id="d1")
    _tx(db_session, user=user, category=category, amount=2000, day="03", tx_id="d2")
    _tx(db_session, user=user, category=category, amount=5000, day="10", tx_id="d3")

    body = client.get(f"/api/stats/daily?month={THIS_MONTH}", headers=auth_headers).json()
    assert body == [
        {"date": f"{THIS_MONTH}-03", "income": 0, "expense": 3000},
        {"date": f"{THIS_MONTH}-10", "income": 0, "expense": 5000},
    ]


def test_daily_separates_income_and_expense_on_the_same_day(client, auth_headers, db_session, user, category):
    _tx(db_session, user=user, category=category, amount=1000, day="07", tx_id="d1")
    _tx(db_session, user=user, category=category, amount=9000, day="07", type_="income", tx_id="d2")

    body = client.get(f"/api/stats/daily?month={THIS_MONTH}", headers=auth_headers).json()
    assert body == [{"date": f"{THIS_MONTH}-07", "income": 9000, "expense": 1000}]


def test_daily_skips_days_with_no_transactions(client, auth_headers, db_session, user, category):
    """빈 날을 서버가 만들어 보내지 않는다 — 달력 칸을 채우는 일은 화면 몫이다."""
    _tx(db_session, user=user, category=category, amount=1000, day="15")

    body = client.get(f"/api/stats/daily?month={THIS_MONTH}", headers=auth_headers).json()
    assert len(body) == 1


def test_daily_is_sorted_by_date(client, auth_headers, db_session, user, category):
    for day in ("21", "05", "13"):
        _tx(db_session, user=user, category=category, amount=1000, day=day, tx_id=f"d{day}")

    body = client.get(f"/api/stats/daily?month={THIS_MONTH}", headers=auth_headers).json()
    assert [row["date"] for row in body] == sorted(row["date"] for row in body)


def test_daily_ignores_other_months(client, auth_headers, db_session, user, category):
    _tx(db_session, user=user, category=category, amount=1000, day="02")
    _tx(db_session, user=user, category=category, amount=9999, month=LAST_MONTH, day="02", tx_id="old")

    body = client.get(f"/api/stats/daily?month={THIS_MONTH}", headers=auth_headers).json()
    assert [row["expense"] for row in body] == [1000]


def test_daily_user_only(client, auth_headers, db_session, user, group_mate, category):
    _tx(db_session, user=user, category=category, amount=1000, day="09", tx_id="mine")
    _tx(db_session, user=group_mate, category=category, amount=4000, day="09", tx_id="mate")

    every = client.get(f"/api/stats/daily?month={THIS_MONTH}", headers=auth_headers).json()
    mine = client.get(f"/api/stats/daily?month={THIS_MONTH}&user_only=true", headers=auth_headers).json()
    assert every[0]["expense"] == 5000
    assert mine[0]["expense"] == 1000


def test_daily_is_group_scoped(client, auth_headers, db_session, category, other_group_category):
    from app import models

    outsider = models.User(
        id="daily-outsider", group_id=other_group_category.group_id, display_name="남", invite_code="DAILYOUT1"
    )
    db_session.add(outsider)
    db_session.commit()
    _tx(db_session, user=outsider, category=other_group_category, amount=77000, day="11")

    body = client.get(f"/api/stats/daily?month={THIS_MONTH}", headers=auth_headers).json()
    assert body == []


def test_daily_requires_auth(client):
    assert client.get(f"/api/stats/daily?month={THIS_MONTH}").status_code in (401, 403)
