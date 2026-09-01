import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, palette, schemas
from ..database import get_db
from ..dependencies import get_current_user
from ..queries import move_transactions_to_fallback, visible_categories

router = APIRouter(prefix="/api/categories", tags=["categories"])


def _require_group_admin(user: models.User) -> None:
    """카테고리를 만들고 지우는 것은 **그룹 관리자만** 할 수 있다.

    카테고리는 그룹 전체가 함께 쓰는 것이라 아무나 지우면 남의 거래 분류가 바뀐다.
    그룹 관리자는 최초 초대 사용자 한 명이다 → docs/admin-console.md
    """
    if user.group is None or user.group.admin_user_id != user.id:
        raise HTTPException(status_code=403, detail="그룹 관리자만 카테고리를 관리할 수 있습니다.")


@router.get("", response_model=list[schemas.CategoryResponse])
def get_categories(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return visible_categories(db, current_user.group_id).order_by(models.Category.type, models.Category.name).all()


@router.post("", response_model=schemas.CategoryResponse, status_code=201)
def create_category(
    payload: schemas.CategoryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """그룹 전용 카테고리를 만든다. **색은 서버가 배정한다.**

    사용자가 고르는 것은 이름과 아이콘이다. 색을 고르게 하면 검증(명도·채도·대비)을
    통과하지 못하는 값이 들어온다 → docs/stats-rules.md
    """
    _require_group_admin(current_user)

    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="이름을 입력해 주세요.")

    # 이미 보이는 이름과 겹치면 안 된다. 시스템 기본값과 같은 이름을 그룹이 또 만들면
    # 선택 목록에 같은 이름이 두 개 뜨고, 어느 쪽을 고른 건지 알 수 없다.
    duplicate = (
        visible_categories(db, current_user.group_id)
        .filter(models.Category.type == payload.type, models.Category.name == name)
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=409, detail=f"이미 있는 카테고리입니다: {name}")

    # **보이는 것 전부**를 기준으로 안 쓴 색을 고른다. 자기 그룹 것만 보면 시스템 기본값과
    # 같은 색이 배정돼, 차트에서 두 조각이 같은 색으로 나온다.
    # 같은 type 만 센다 — 지출 차트에 수입 카테고리는 함께 그려지지 않으므로 색을 나눠 쓸 이유가 없다.
    used = [
        c.color
        for c in visible_categories(db, current_user.group_id).filter(models.Category.type == payload.type).all()
    ]
    category = models.Category(
        id=str(uuid.uuid4()),
        group_id=current_user.group_id,
        type=payload.type,
        name=name,
        icon=payload.icon or None,
        color=palette.next_color(used),
        is_default=False,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=204)
def delete_category(
    category_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """그룹 전용 카테고리를 지운다. **거래는 지우지 않고 `기타` 로 옮긴다.**

    적요(`description`)가 남아 있어서 어떤 지출이었는지는 알 수 있다 — 카테고리만 잃는다.
    거래를 함께 지우거나 삭제 자체를 거절하는 것보다 낫다 (#41).
    """
    _require_group_admin(current_user)

    category = (
        db.query(models.Category)
        .filter(models.Category.id == category_id, models.Category.group_id == current_user.group_id)
        .first()
    )
    if not category:
        # 시스템 기본값과 다른 그룹 것을 같은 404 로 묶는다. 존재 여부를 알려줄 이유가 없다
        # (카테고리 소유권 검증과 같은 방침 → docs/auth-and-scoping.md).
        raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다.")

    if not move_transactions_to_fallback(db, category, visible_categories(db, current_user.group_id)):
        raise HTTPException(status_code=409, detail="옮겨 둘 `기타` 카테고리가 없어 삭제할 수 없습니다.")

    db.delete(category)
    db.commit()
