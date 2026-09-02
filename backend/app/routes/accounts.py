from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import get_db
from ..dependencies import get_current_user
from ..queries import (
    FALLBACK_CATEGORY_NAME,
    account_balance,
    account_totals,
    visible_accounts,
    visible_categories,
)

router = APIRouter(prefix="/api/accounts", tags=["accounts"])

INTEREST_CATEGORY_NAME = "금융수입"


def _storable(data: dict) -> dict:
    """날짜 컬럼은 String 이라 date 객체를 그대로 넣을 수 없다 (거래와 같은 방식)."""
    for field in ("started_on", "matures_on", "settled_on"):
        if isinstance(data.get(field), date):
            data[field] = data[field].isoformat()
    return data


def _own_account(db: Session, account_id: str, user: models.User) -> models.Account:
    """수정·삭제 대상 계좌. **자기 계좌만** 건드릴 수 있다.

    거래와 같은 방침이다 (→ routes/transactions.py 의 `_own_transaction`).

    - 다른 그룹의 계좌 → 404. 목록에 안 나오므로 존재를 숨긴다
    - 같은 그룹 다른 구성원의 계좌 → 403. 목록에 이미 보이고 주인 이름까지 표시된다
    """
    account = visible_accounts(db, user.group_id).filter(models.Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="계좌를 찾을 수 없습니다.")
    if account.user_id != user.id:
        raise HTTPException(status_code=403, detail="다른 구성원의 계좌는 수정하거나 삭제할 수 없습니다.")
    return account


def _require_expense_category(db: Session, category_id: str, group_id: str) -> None:
    """계좌의 기본 카테고리는 **이 그룹이 쓸 수 있는 지출 카테고리**여야 한다.

    계좌를 움직이는 거래는 언제나 지출이다 (상환·납입·예치). 수입 카테고리를 달아두면
    그 계좌를 연결하는 순간 화면이 저장할 수 없는 조합을 고르게 된다.
    """
    found = (
        visible_categories(db, group_id)
        .filter(models.Category.id == category_id, models.Category.type == "expense")
        .first()
    )
    if not found:
        raise HTTPException(status_code=404, detail="지출 카테고리를 찾을 수 없습니다.")


def _normalize(kind: str, data: dict) -> dict:
    """대출이 아닌 계좌의 `repay_method` 를 지운다.

    예금에 "원리금균등" 이 붙어 있으면 화면이 그것을 믿고 상환 계산을 시도한다.
    받아두고 무시하는 것보다 저장 자체를 막는 편이 낫다.
    """
    if kind != "loan":
        data["repay_method"] = None
    return data


def serialize(account: models.Account, principal: int = 0, interest: int = 0) -> schemas.AccountResponse:
    return schemas.AccountResponse(
        id=account.id,
        group_id=account.group_id,
        user_id=account.user_id,
        user_display_name=account.user.display_name if account.user else None,
        kind=account.kind,
        name=account.name,
        category_id=account.category_id,
        category_name=account.category.name if account.category else None,
        category_icon=account.category.icon if account.category else None,
        amount=account.amount,
        rate=account.rate,
        started_on=account.started_on,
        matures_on=account.matures_on,
        repay_method=account.repay_method,
        status=account.status,
        settled_on=account.settled_on,
        settled_amount=account.settled_amount,
        balance=account_balance(account, principal),
        paid_principal=principal,
        paid_interest=interest,
    )


def _one(db: Session, account: models.Account) -> schemas.AccountResponse:
    principal, interest = account_totals(db, account.group_id).get(account.id, (0, 0))
    return serialize(account, principal, interest)


@router.get("", response_model=list[schemas.AccountResponse])
def list_accounts(
    kind: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """그룹 전체의 계좌. 잔액은 여기서 계산해 실어준다.

    소유는 개인이지만 **열람은 그룹**이다 — 가계부의 다른 모든 읽기와 같다.
    """
    q = visible_accounts(db, current_user.group_id).options(
        joinedload(models.Account.user), joinedload(models.Account.category)
    )
    if kind:
        q = q.filter(models.Account.kind == kind)
    totals = account_totals(db, current_user.group_id)
    accounts = q.order_by(models.Account.status, models.Account.matures_on).all()
    return [serialize(a, *totals.get(a.id, (0, 0))) for a in accounts]


@router.post("", response_model=schemas.AccountResponse, status_code=201)
def create_account(
    payload: schemas.AccountCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """계좌를 만든다. **주인은 만든 사람**이다 — 요청 본문으로 지정할 수 없다."""
    if payload.matures_on < payload.started_on:
        raise HTTPException(status_code=422, detail="만기일이 시작일보다 빠를 수 없습니다.")
    if payload.category_id:
        _require_expense_category(db, payload.category_id, current_user.group_id)

    account = models.Account(
        id=str(uuid.uuid4()),
        group_id=current_user.group_id,
        user_id=current_user.id,
        status="active",
        **_normalize(payload.kind, _storable(payload.model_dump())),
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return _one(db, account)


@router.put("/{account_id}", response_model=schemas.AccountResponse)
def update_account(
    account_id: str,
    payload: schemas.AccountUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    account = _own_account(db, account_id, current_user)
    changes = _storable(payload.model_dump(exclude_unset=True))
    if changes.get("category_id"):
        _require_expense_category(db, changes["category_id"], current_user.group_id)
    if "repay_method" in changes:
        changes = _normalize(account.kind, changes)

    started = changes.get("started_on", account.started_on)
    matures = changes.get("matures_on", account.matures_on)
    if matures < started:
        raise HTTPException(status_code=422, detail="만기일이 시작일보다 빠를 수 없습니다.")

    for field, value in changes.items():
        setattr(account, field, value)
    db.commit()
    db.refresh(account)
    return _one(db, account)


@router.delete("/{account_id}", status_code=204)
def delete_account(
    account_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """계좌를 지운다. **연결된 거래는 지우지 않고 연결만 끊는다.**

    카테고리를 지울 때 거래를 `기타` 로 옮기는 것과 같은 방침이다 (#41) — 실제로 돈이
    오간 기록이므로 계좌를 정리한다고 가계부에서 사라지면 안 된다.

    끝난 계좌를 기록으로 남기려면 지우지 말고 정산(`/settle`)하면 된다.
    """
    account = _own_account(db, account_id, current_user)
    db.query(models.Transaction).filter(models.Transaction.account_id == account.id).update(
        {models.Transaction.account_id: None, models.Transaction.interest_amount: None},
        synchronize_session=False,
    )
    db.delete(account)
    db.commit()


def _interest_category(db: Session, group_id: str, requested: str | None) -> models.Category:
    """이자 수입을 담을 카테고리. 지정이 없으면 서버가 고른다.

    `금융수입` → `기타`(수입) 순으로 찾는다. 카테고리를 이름으로 **매칭**하는 것과는 다르다 —
    저장되는 것은 언제나 id 이고, 여기서 이름은 기본값을 고르는 힌트일 뿐이다
    (`move_transactions_to_fallback` 가 `기타` 를 찾는 것과 같은 성격).
    """
    income = visible_categories(db, group_id).filter(models.Category.type == "income")
    if requested:
        chosen = income.filter(models.Category.id == requested).first()
        if not chosen:
            raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다.")
        return chosen

    for name in (INTEREST_CATEGORY_NAME, FALLBACK_CATEGORY_NAME):
        found = income.filter(models.Category.name == name).first()
        if found:
            return found
    raise HTTPException(status_code=409, detail="이자를 담을 수입 카테고리가 없습니다.")


@router.post("/{account_id}/settle", response_model=schemas.AccountResponse)
def settle_account(
    account_id: str,
    payload: schemas.AccountSettle,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """만기·중도해지를 확정한다. **금액은 사람이 넣은 값을 그대로 믿는다.**

    화면은 금리로 계산한 예상액을 미리 채워주지만, 실제 수령액은 우대금리·중도해지이율·
    세금우대 때문에 공식과 늘 어긋난다. 그래서 계산은 예상치로만 쓰고 확정은 사람이 한다
    (→ docs/accounts.md).

    **예적금이면 이자를 수입 거래로 남긴다.** 확정 수령액에서 넣은 원금을 뺀 것이 이자다.
    그래야 통계의 수입에 실제로 받은 이자가 잡힌다.

    대출은 거래를 만들지 않는다. 상환은 회차마다 이미 입력돼 있고, 조기상환도 거래 입력이다 —
    여기서는 끝났다는 사실만 기록한다.
    """
    account = _own_account(db, account_id, current_user)
    if account.status != "active":
        raise HTTPException(status_code=409, detail="이미 종료된 계좌입니다.")

    principal, _ = account_totals(db, account.group_id).get(account.id, (0, 0))
    settled_on = payload.settled_on.isoformat()

    if account.kind != "loan":
        deposited = account.amount if account.kind == "deposit" else principal
        gain = payload.settled_amount - deposited
        if gain > 0:
            category = _interest_category(db, account.group_id, payload.interest_category_id)
            db.add(
                models.Transaction(
                    id=str(uuid.uuid4()),
                    group_id=account.group_id,
                    # 이자는 **계좌 주인의 수입**이다. 정산을 누가 눌렀는지와 무관하다.
                    user_id=account.user_id,
                    category_id=category.id,
                    type="income",
                    amount=gain,
                    description=f"{account.name} 이자",
                    date=settled_on,
                    # 이 거래는 잔액을 움직이지 않는다. 계좌는 이 시점에 이미 끝났다.
                    account_id=None,
                )
            )

    account.status = payload.status
    account.settled_on = settled_on
    account.settled_amount = payload.settled_amount
    db.commit()
    db.refresh(account)
    return _one(db, account)
