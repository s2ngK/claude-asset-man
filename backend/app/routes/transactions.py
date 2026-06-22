from __future__ import annotations
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from ..database import get_db
from .. import models, schemas
from ..dependencies import get_current_user

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


def _serialize(t: models.Transaction) -> schemas.TransactionResponse:
    return schemas.TransactionResponse(
        id=t.id, group_id=t.group_id, user_id=t.user_id,
        user_display_name=t.user.display_name if t.user else None,
        category_id=t.category_id,
        category_name=t.category.name if t.category else None,
        category_icon=t.category.icon if t.category else None,
        category_color=t.category.color if t.category else None,
        type=t.type, amount=t.amount, description=t.description,
        date=t.date, created_at=t.created_at,
    )


def _with_relations(db: Session, tx_id: str) -> models.Transaction:
    return (
        db.query(models.Transaction)
        .options(joinedload(models.Transaction.category), joinedload(models.Transaction.user))
        .filter(models.Transaction.id == tx_id)
        .one()
    )


@router.get("", response_model=list[schemas.TransactionResponse])
def list_transactions(
    month: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = (
        db.query(models.Transaction)
        .options(joinedload(models.Transaction.category), joinedload(models.Transaction.user))
        .filter(models.Transaction.group_id == current_user.group_id)
    )
    if month:
        q = q.filter(models.Transaction.date.startswith(month))
    return [_serialize(t) for t in q.order_by(models.Transaction.date.desc()).all()]


@router.post("", response_model=schemas.TransactionResponse, status_code=201)
def create_transaction(
    payload: schemas.TransactionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not db.query(models.Category).filter(models.Category.id == payload.category_id).first():
        raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다.")
    tx = models.Transaction(id=str(uuid.uuid4()), group_id=current_user.group_id, user_id=current_user.id, **payload.model_dump())
    db.add(tx)
    db.commit()
    return _serialize(_with_relations(db, tx.id))


@router.put("/{tx_id}", response_model=schemas.TransactionResponse)
def update_transaction(
    tx_id: str, payload: schemas.TransactionUpdate,
    db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user),
):
    tx = db.query(models.Transaction).filter(models.Transaction.id == tx_id, models.Transaction.group_id == current_user.group_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="거래 내역을 찾을 수 없습니다.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(tx, field, value)
    db.commit()
    return _serialize(_with_relations(db, tx_id))


@router.delete("/{tx_id}", status_code=204)
def delete_transaction(tx_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    tx = db.query(models.Transaction).filter(models.Transaction.id == tx_id, models.Transaction.group_id == current_user.group_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="거래 내역을 찾을 수 없습니다.")
    db.delete(tx)
    db.commit()
