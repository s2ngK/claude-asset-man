"""여러 라우트가 공유하는 쿼리 조각.

그룹 격리는 DB 제약이 아니라 각 쿼리가 지키는 관례라서, 한 곳이라도 조건을
빠뜨리면 그대로 데이터가 샌다. 같은 조건을 두 번 쓰지 않도록 여기 모아둔다.
"""

from __future__ import annotations

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
