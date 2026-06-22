import uuid
from .database import SessionLocal
from . import models

DEFAULT_CATEGORIES = [
    ("expense", "식비",      "🍔", "#FF5733"),
    ("expense", "교통",      "🚌", "#33FF57"),
    ("expense", "쇼핑",      "🛍️", "#3357FF"),
    ("expense", "주거/통신", "🏠", "#FF33A1"),
    ("expense", "의료/건강", "💊", "#33FFF5"),
    ("expense", "기타",      "💰", "#808080"),
    ("income",  "급여",      "💰", "#FFBD33"),
    ("income",  "용돈",      "💵", "#75FF33"),
    ("income",  "금융수입",  "📈", "#DB33FF"),
    ("income",  "기타",      "🎸", "#A0A0A0"),
]


def seed_initial_data() -> None:
    db = SessionLocal()
    try:
        if db.query(models.Category).count() > 0:
            return
        for type_, name, icon, color in DEFAULT_CATEGORIES:
            db.add(models.Category(id=str(uuid.uuid4()), group_id=None, type=type_, name=name, icon=icon, color=color, is_default=True))
        db.commit()
        print("✅ 기본 카테고리 시딩 완료")
    finally:
        db.close()
