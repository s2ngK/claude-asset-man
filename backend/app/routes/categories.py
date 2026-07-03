from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas
from ..dependencies import get_current_user

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("", response_model=list[schemas.CategoryResponse])
def get_categories(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return (
        db.query(models.Category)
        .filter(
            (models.Category.group_id == None)  # noqa: E711
            | (models.Category.group_id == current_user.group_id)
        )
        .order_by(models.Category.type, models.Category.name)
        .all()
    )
