from __future__ import annotations

from datetime import date

from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..dependencies import get_current_user

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/summary", response_model=schemas.MonthlySummary)
def get_summary(
    month: str = Query(...),
    user_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    filters = [models.Transaction.group_id == current_user.group_id, models.Transaction.date.startswith(month)]
    if user_only:
        filters.append(models.Transaction.user_id == current_user.id)
    rows = (
        db.query(models.Transaction.type, func.sum(models.Transaction.amount).label("total"))
        .filter(*filters)
        .group_by(models.Transaction.type)
        .all()
    )
    income = next((r.total for r in rows if r.type == "income"), 0) or 0
    expense = next((r.total for r in rows if r.type == "expense"), 0) or 0
    return schemas.MonthlySummary(income=income, expense=expense, balance=income - expense)


@router.get("/categories", response_model=list[schemas.CategoryStat])
def get_category_stats(
    month: str = Query(...),
    user_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    filters = [
        models.Transaction.group_id == current_user.group_id,
        models.Transaction.date.startswith(month),
        models.Transaction.type == "expense",
    ]
    if user_only:
        filters.append(models.Transaction.user_id == current_user.id)
    rows = (
        db.query(
            models.Category.id,
            models.Category.name,
            models.Category.icon,
            models.Category.color,
            func.sum(models.Transaction.amount).label("total"),
        )
        .join(models.Transaction, models.Category.id == models.Transaction.category_id)
        .filter(*filters)
        .group_by(models.Category.id)
        .all()
    )
    total = sum(r.total for r in rows) or 1
    return sorted(
        [
            schemas.CategoryStat(
                category_id=r.id,
                category_name=r.name,
                icon=r.icon,
                color=r.color,
                total=r.total,
                percentage=round(r.total / total * 100, 1),
            )
            for r in rows
        ],
        key=lambda x: x.total,
        reverse=True,
    )


@router.get("/daily", response_model=list[schemas.DailyTotal])
def get_daily_totals(
    month: str = Query(...),
    user_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """그 달의 **날짜별** 수입·지출. 쿼리는 한 번만 나간다.

    `date` 가 `"YYYY-MM-DD"` 문자열 컬럼이라 그대로 묶으면 된다. 날짜마다 따로 물으면
    한 달에 서른 번이다 — 추이에서 한 번 겪은 N+1 이다 (#15).

    **거래가 없는 날은 결과에 없다.** 달력 칸을 채우는 일은 화면에서 한다. 여기서 빈 날을
    만들어 보내면 한 달치 응답이 늘 30줄이 되고, 그 30줄의 대부분이 0 이다.
    """
    filters = [
        models.Transaction.group_id == current_user.group_id,
        models.Transaction.date.startswith(month),
    ]
    if user_only:
        filters.append(models.Transaction.user_id == current_user.id)

    rows = (
        db.query(
            models.Transaction.date,
            models.Transaction.type,
            func.sum(models.Transaction.amount).label("total"),
        )
        .filter(*filters)
        .group_by(models.Transaction.date, models.Transaction.type)
        .all()
    )

    totals: dict[str, dict[str, int]] = {}
    for row in rows:
        day = totals.setdefault(row.date, {"income": 0, "expense": 0})
        day[row.type] = row.total or 0

    return [
        schemas.DailyTotal(date=date_str, income=day["income"], expense=day["expense"])
        for date_str, day in sorted(totals.items())
    ]


@router.get("/trend", response_model=list[schemas.TrendItem])
def get_trend(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """최근 6개월 수입·지출. **쿼리는 한 번만 나간다.**

    예전에는 달마다 집계 쿼리를 따로 날려 6번이었다 (#15). date 가 "YYYY-MM-DD" 문자열
    컬럼이라 앞 7자가 곧 월이므로, 그것으로 묶으면 한 번에 끝난다.

    거래가 없는 달은 결과에 아예 안 나온다. 6개월 틀을 유지하는 채움은 파이썬에서 한다 —
    SQL 로 빈 달을 만들려면 달력 테이블이 필요한데 그건 과투자다.
    """
    today = date.today().replace(day=1)
    months = [(today - relativedelta(months=i)).strftime("%Y-%m") for i in range(5, -1, -1)]

    month_expr = func.substr(models.Transaction.date, 1, 7)
    rows = (
        db.query(
            month_expr.label("month"),
            models.Transaction.type,
            func.sum(models.Transaction.amount).label("total"),
        )
        .filter(models.Transaction.group_id == current_user.group_id, month_expr.in_(months))
        .group_by(month_expr, models.Transaction.type)
        .all()
    )

    totals = {(r.month, r.type): r.total or 0 for r in rows}
    return [
        schemas.TrendItem(
            month=month,
            income=totals.get((month, "income"), 0),
            expense=totals.get((month, "expense"), 0),
        )
        for month in months
    ]


@router.get("/members", response_model=list[schemas.MemberStat])
def get_member_stats(
    month: str = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    rows = (
        db.query(models.User.id, models.User.display_name, func.sum(models.Transaction.amount).label("total"))
        .join(models.Transaction, models.User.id == models.Transaction.user_id)
        .filter(
            models.Transaction.group_id == current_user.group_id,
            models.Transaction.date.startswith(month),
            models.Transaction.type == "expense",
        )
        .group_by(models.User.id)
        .all()
    )
    total = sum(r.total for r in rows) or 1
    return sorted(
        [
            schemas.MemberStat(
                user_id=r.id, display_name=r.display_name, total=r.total, percentage=round(r.total / total * 100, 1)
            )
            for r in rows
        ],
        key=lambda x: x.total,
        reverse=True,
    )
