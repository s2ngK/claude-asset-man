from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import get_db
from ..dependencies import get_current_user
from ..queries import visible_accounts, visible_categories

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


def _storable(data: dict) -> dict:
    """Transaction.date 컬럼은 String 이라 date 객체를 그대로 넣을 수 없다.

    스키마는 형식 검증을 위해 date 로 받고, 저장 직전 여기서 ISO 문자열로 되돌린다.
    월 필터가 date.startswith("YYYY-MM") 이므로 이 형식이어야 한다.
    """
    if isinstance(data.get("date"), date):
        data["date"] = data["date"].isoformat()
    return data


def _own_transaction(db: Session, tx_id: str, user: models.User) -> models.Transaction:
    """수정·삭제 대상 거래를 가져온다. **자기가 쓴 것만** 건드릴 수 있다.

    두 단계로 나눠 응답을 다르게 준다.

    - 다른 **그룹**의 거래 → 404. 목록에 애초에 안 나오므로 존재를 숨긴다
      (카테고리 소유권 검증과 같은 방침).
    - 같은 그룹의 **다른 구성원** 거래 → 403. 목록에 이미 보이고 작성자 이름까지
      표시되므로 숨길 것이 없다. 404 를 주면 "화면에 있는데 없다고 한다"가 되어
      오히려 헷갈린다.
    """
    tx = (
        db.query(models.Transaction)
        .filter(models.Transaction.id == tx_id, models.Transaction.group_id == user.group_id)
        .first()
    )
    if not tx:
        raise HTTPException(status_code=404, detail="거래 내역을 찾을 수 없습니다.")
    if tx.user_id != user.id:
        raise HTTPException(status_code=403, detail="다른 구성원의 내역은 수정하거나 삭제할 수 없습니다.")
    return tx


def _require_usable_category(db: Session, category_id: str, group_id: str) -> None:
    """카테고리가 존재하고 **이 그룹이 쓸 수 있는 것**인지 확인한다.

    존재 여부만 보면 다른 그룹의 전용 카테고리를 자기 거래에 붙일 수 있고,
    응답의 category_name 으로 그 그룹의 카테고리 이름이 새어 나간다.

    남의 그룹 카테고리에는 403 이 아니라 404 를 준다 — 거래 조회/삭제와 같은 방침으로,
    ID 를 넣어보는 것만으로 존재 여부를 알아낼 수 없게 한다.
    """
    if not visible_categories(db, group_id).filter(models.Category.id == category_id).first():
        raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다.")


def _require_usable_account(db: Session, account_id: str, group_id: str) -> None:
    """계좌가 **이 그룹의 것**인지 확인한다. 아니면 404.

    주인이 아니어도 된다 — 배우자의 대출을 대신 갚는 것은 공동 가계부에서 자연스럽다.
    계좌를 고치는 것만 주인 몫이다 (→ routes/accounts.py).
    """
    if not visible_accounts(db, group_id).filter(models.Account.id == account_id).first():
        raise HTTPException(status_code=404, detail="계좌를 찾을 수 없습니다.")


def _check_account_fields(
    db: Session, account_id: str | None, interest: int | None, amount: int, group_id: str
) -> None:
    """계좌 연결과 이자분이 앞뒤가 맞는지 본다. **저장 뒤의 상태**를 기준으로 판단한다.

    - 계좌 없이 이자분만 있으면 그 값은 아무 데도 안 쓰인다 (잔액은 계좌별로 낸다)
    - 이자가 금액보다 크면 원금분이 음수가 되어 잔액이 거꾸로 늘어난다
    """
    if account_id is not None:
        _require_usable_account(db, account_id, group_id)
    elif interest:
        raise HTTPException(status_code=422, detail="계좌를 연결하지 않으면 이자분을 넣을 수 없습니다.")
    if interest is not None and interest > amount:
        raise HTTPException(status_code=422, detail="이자분이 금액보다 클 수 없습니다.")


def _serialize(t: models.Transaction) -> schemas.TransactionResponse:
    return schemas.TransactionResponse(
        id=t.id,
        group_id=t.group_id,
        user_id=t.user_id,
        user_display_name=t.user.display_name if t.user else None,
        category_id=t.category_id,
        category_name=t.category.name if t.category else None,
        category_icon=t.category.icon if t.category else None,
        category_color=t.category.color if t.category else None,
        type=t.type,
        amount=t.amount,
        description=t.description,
        date=t.date,
        account_id=t.account_id,
        account_name=t.account.name if t.account else None,
        interest_amount=t.interest_amount,
        created_at=t.created_at,
    )


def _with_relations(db: Session, tx_id: str) -> models.Transaction:
    return (
        db.query(models.Transaction)
        .options(
            joinedload(models.Transaction.category),
            joinedload(models.Transaction.user),
            joinedload(models.Transaction.account),
        )
        .filter(models.Transaction.id == tx_id)
        .one()
    )


@router.get("", response_model=list[schemas.TransactionResponse])
def list_transactions(
    month: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = (
        db.query(models.Transaction)
        .options(
            joinedload(models.Transaction.category),
            joinedload(models.Transaction.user),
            joinedload(models.Transaction.account),
        )
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
    _require_usable_category(db, payload.category_id, current_user.group_id)
    _check_account_fields(db, payload.account_id, payload.interest_amount, payload.amount, current_user.group_id)
    tx = models.Transaction(
        id=str(uuid.uuid4()),
        group_id=current_user.group_id,
        user_id=current_user.id,
        **_storable(payload.model_dump()),
    )
    db.add(tx)
    db.commit()
    return _serialize(_with_relations(db, tx.id))


@router.put("/{tx_id}", response_model=schemas.TransactionResponse)
def update_transaction(
    tx_id: str,
    payload: schemas.TransactionUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    tx = _own_transaction(db, tx_id, current_user)
    changes = _storable(payload.model_dump(exclude_unset=True))
    if "category_id" in changes:
        _require_usable_category(db, changes["category_id"], current_user.group_id)
    _check_account_fields(
        db,
        changes.get("account_id", tx.account_id),
        changes.get("interest_amount", tx.interest_amount),
        changes.get("amount", tx.amount),
        current_user.group_id,
    )
    for field, value in changes.items():
        setattr(tx, field, value)
    db.commit()
    return _serialize(_with_relations(db, tx_id))


@router.delete("/{tx_id}", status_code=204)
def delete_transaction(
    tx_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)
):
    tx = _own_transaction(db, tx_id, current_user)
    db.delete(tx)
    db.commit()
