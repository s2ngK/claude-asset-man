"""여러 라우트가 공유하는 쿼리 조각.

그룹 격리는 DB 제약이 아니라 각 쿼리가 지키는 관례라서, 한 곳이라도 조건을
빠뜨리면 그대로 데이터가 샌다. 같은 조건을 두 번 쓰지 않도록 여기 모아둔다.
"""

from __future__ import annotations

from sqlalchemy import func, or_
from sqlalchemy.orm import Query, Session

from . import models


def visible_categories(db: Session, group_id: str) -> Query[models.Category]:
    """해당 그룹이 쓸 수 있는 카테고리 — 시스템 기본값(group_id IS NULL) + 그 그룹 전용.

    목록 조회와 거래 저장이 **같은 조건**을 봐야 한다. 목록에 안 나오는 카테고리를
    거래에 붙일 수 있으면 다른 그룹의 카테고리 이름이 응답으로 새어 나간다.
    """
    return db.query(models.Category).filter(
        (models.Category.group_id.is_(None)) | (models.Category.group_id == group_id)
    )


FALLBACK_CATEGORY_NAME = "기타"


def move_transactions_to_fallback(db: Session, category: models.Category, scope: Query[models.Category]) -> bool:
    """지워질 카테고리의 거래를 같은 `type` 의 `기타` 로 옮긴다.

    거래를 함께 지우지 않는 이유: 적요(`description`)가 남아 있어 무엇이었는지는 알 수 있고,
    잃는 것은 분류뿐이다 (#41). 삭제를 거절하는 것보다 낫다.

    `기타` 는 수입·지출 양쪽에 하나씩 있으므로 (→ docs/data-model.md) **같은 type** 을 찾는다.
    `scope` 는 어디서 찾을지다 — 그룹 카테고리를 지울 때는 그 그룹이 볼 수 있는 범위,
    공통 카테고리를 지울 때는 공통 범위.

    옮겨 둘 자리가 없으면 아무것도 하지 않고 False 를 돌려준다. 호출자가 거절해야 한다.
    """
    fallback = (
        scope.filter(
            models.Category.type == category.type,
            models.Category.name == FALLBACK_CATEGORY_NAME,
            models.Category.id != category.id,
        )
        .order_by(models.Category.group_id.is_(None).desc())  # 공통 기본값을 먼저 고른다
        .first()
    )
    if fallback is None:
        return False

    db.query(models.Transaction).filter(models.Transaction.category_id == category.id).update(
        {models.Transaction.category_id: fallback.id}, synchronize_session=False
    )
    return True


def visible_accounts(db: Session, group_id: str) -> Query[models.Account]:
    """그 그룹이 볼 수 있는 계좌 — **그룹 전체의 것**.

    계좌의 소유는 개인(`user_id`)이지만 열람은 그룹이다. 거래와 같은 규칙이다:
    읽기는 그룹, 쓰기는 본인 (→ docs/auth-and-scoping.md).
    """
    return db.query(models.Account).filter(models.Account.group_id == group_id)


def account_totals(db: Session, group_id: str) -> dict[str, tuple[int, int]]:
    """계좌별 (원금분 합계, 이자분 합계). **쿼리 한 번**이다.

    잔액을 컬럼으로 두지 않기 때문에(→ docs/accounts.md) 목록을 그릴 때마다 이걸 부른다.
    계좌마다 따로 물으면 계좌 수만큼 쿼리가 나간다 — 추이에서 한 번 겪은 N+1 이다 (#15).

    `amount` 에서 `interest_amount` 를 뺀 것이 원금분이다. 이자는 잔액을 움직이지 않는다.

    **개시 기준일(`opening_on`)이 있으면 그 뒤의 거래만 센다.** 기준일 시점의 잔액은 이미
    `opening_balance` 에 들어 있어서, 그 이전 내역을 나중에 채워 넣어도 두 번 빠지지 않는다.
    날짜가 `"YYYY-MM-DD"` 문자열이라 사전순 비교가 곧 날짜 비교다.
    """
    interest = func.coalesce(models.Transaction.interest_amount, 0)
    rows = (
        db.query(
            models.Transaction.account_id,
            func.sum(models.Transaction.amount - interest).label("principal"),
            func.sum(interest).label("interest"),
        )
        .join(models.Account, models.Account.id == models.Transaction.account_id)
        .filter(
            models.Transaction.group_id == group_id,
            models.Transaction.account_id.isnot(None),
            or_(models.Account.opening_on.is_(None), models.Transaction.date > models.Account.opening_on),
        )
        .group_by(models.Transaction.account_id)
        .all()
    )
    return {r.account_id: (int(r.principal or 0), int(r.interest or 0)) for r in rows}


def account_balance(account: models.Account, principal: int) -> int:
    """계좌의 현재 잔액. 저장하지 않고 매번 계산한다.

    **어디서 출발하느냐**만 `opening_balance` 가 정한다. 이미 진행 중인 계좌를 등록하면
    그 값에서 시작하고, 없으면 계좌를 처음부터 이 앱으로 관리한 것으로 본다.

    끝난 계좌는 0 이다 — 만기에 받았거나 다 갚았으니 남은 것이 없다. 그때의 확정 금액은
    `settled_amount` 에 따로 남는다.
    """
    if account.status != "active":
        return 0
    opening = account.opening_balance
    if account.kind == "loan":
        # 개시 잔액이 곧 그때 남아 있던 원금이다. 없으면 대출 원금 전액에서 출발한다.
        return max((opening if opening is not None else account.amount) - principal, 0)
    if account.kind == "deposit":
        # 목돈을 한 번 넣는다. 만기까지 그대로다 — 거래가 잔액을 움직이지 않는다.
        return opening if opening is not None else account.amount
    # 적금 — 넣은 만큼이 잔액이다. account.amount 는 월 납입액이라 잔액이 아니다.
    return (opening or 0) + principal
