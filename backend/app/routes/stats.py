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
    month: str = Query(...), user_only: bool = Query(False),
    db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user),
):
    filters = [models.Transaction.group_id == current_user.group_id, models.Transaction.date.startswith(month)]
    if user_only:
        filters.append(models.Transaction.user_id == current_user.id)
    rows = db.query(models.Transaction.type, func.sum(models.Transaction.amount).label("total")).filter(*filters).group_by(models.Transaction.type).all()
    income = next((r.total for r in rows if r.type == "income"), 0) or 0
    expense = next((r.total for r in rows if r.type == "expense"), 0) or 0
    return schemas.MonthlySummary(income=income, expense=expense, balance=income - expense)


@router.get("/categories", response_model=list[schemas.CategoryStat])
def get_category_stats(
    month: str = Query(...), user_only: bool = Query(False),
    db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user),
):
    filters = [models.Transaction.group_id == current_user.group_id, models.Transaction.date.startswith(month), models.Transaction.type == "expense"]
    if user_only:
        filters.append(models.Transaction.user_id == current_user.id)
    rows = (
        db.query(models.Category.id, models.Category.name, models.Category.icon, models.Category.color, func.sum(models.Transaction.amount).label("total"))
        .join(models.Transaction, models.Category.id == models.Transaction.category_id)
        .filter(*filters).group_by(models.Category.id).all()
    )
    total = sum(r.total for r in rows) or 1
    return sorted([schemas.CategoryStat(category_id=r.id, category_name=r.name, icon=r.icon, color=r.color, total=r.total, percentage=round(r.total / total * 100, 1)) for r in rows], key=lambda x: x.total, reverse=True)


@router.get("/trend", response_model=list[schemas.TrendItem])
def get_trend(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    today = date.today().replace(day=1)
    months = [(today - relativedelta(months=i)).strftime("%Y-%m") for i in range(5, -1, -1)]
    result = []
    for month in months:
        rows = db.query(models.Transaction.type, func.sum(models.Transaction.amount).label("total")).filter(models.Transaction.group_id == current_user.group_id, models.Transaction.date.startswith(month)).group_by(models.Transaction.type).all()
        result.append(schemas.TrendItem(month=month, income=next((r.total for r in rows if r.type == "income"), 0) or 0, expense=next((r.total for r in rows if r.type == "expense"), 0) or 0))
    return result


@router.get("/members", response_model=list[schemas.MemberStat])
def get_member_stats(
    month: str = Query(...),
    db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user),
):
    rows = (
        db.query(models.User.id, models.User.display_name, func.sum(models.Transaction.amount).label("total"))
        .join(models.Transaction, models.User.id == models.Transaction.user_id)
        .filter(models.Transaction.group_id == current_user.group_id, models.Transaction.date.startswith(month), models.Transaction.type == "expense")
        .group_by(models.User.id).all()
    )
    total = sum(r.total for r in rows) or 1
    return sorted([schemas.MemberStat(user_id=r.id, display_name=r.display_name, total=r.total, percentage=round(r.total / total * 100, 1)) for r in rows], key=lambda x: x.total, reverse=True)
