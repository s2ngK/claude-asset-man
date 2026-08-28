import uuid

from . import models
from .database import SessionLocal

# 색은 눈으로 고르지 않는다. 명도 밴드가 **라이트·다크 양쪽에 모두 들어가는** 값이라
# 카테고리마다 색을 하나만 저장해도 두 모드에서 다 읽힌다.
# 바꿀 일이 생기면 값만 바꾸지 말고 검증기를 다시 돌린다 → docs/stats-rules.md
DEFAULT_CATEGORIES = [
    ("expense", "식비", "🍔", "#3987e5"),
    ("expense", "교통", "🚌", "#d95926"),
    ("expense", "쇼핑", "🛍️", "#199e70"),
    ("expense", "주거/통신", "🏠", "#c98500"),
    ("expense", "의료/건강", "💊", "#d55181"),
    ("expense", "기타", "💰", "#008300"),
    # 수입은 지출과 같은 차트에 함께 그려지지 않는다. 그래서 색을 다시 써도 된다.
    ("income", "급여", "💰", "#9085e9"),
    ("income", "용돈", "💵", "#e66767"),
    ("income", "금융수입", "📈", "#3987e5"),
    ("income", "기타", "🎸", "#d95926"),
]


def seed_initial_data() -> None:
    db = SessionLocal()
    try:
        if db.query(models.Category).count() > 0:
            return
        for type_, name, icon, color in DEFAULT_CATEGORIES:
            db.add(
                models.Category(
                    id=str(uuid.uuid4()), group_id=None, type=type_, name=name, icon=icon, color=color, is_default=True
                )
            )
        db.commit()
        print("✅ 기본 카테고리 시딩 완료")
    finally:
        db.close()
