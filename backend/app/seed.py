import uuid

from . import models, palette
from .database import SessionLocal

# 색은 눈으로 고르지 않는다. `palette.CATEGORICAL_COLORS` 가 **유일한 출처**이고,
# 그 값은 명도 밴드가 라이트·다크 양쪽에 들어가도록 검증기를 통과한 것이다
# → docs/stats-rules.md. 여기서는 슬롯 번호만 고른다.
_C = palette.CATEGORICAL_COLORS

DEFAULT_CATEGORIES = [
    ("expense", "식비", "🍔", _C[0]),
    ("expense", "교통", "🚌", _C[1]),
    ("expense", "쇼핑", "🛍️", _C[2]),
    ("expense", "주거/통신", "🏠", _C[3]),
    ("expense", "의료/건강", "💊", _C[4]),
    ("expense", "기타", "💰", _C[5]),
    # 수입은 지출과 같은 차트에 함께 그려지지 않는다. 그래서 색을 다시 써도 된다.
    ("income", "급여", "💰", _C[6]),
    ("income", "용돈", "💵", _C[7]),
    ("income", "금융수입", "📈", _C[0]),
    ("income", "기타", "🎸", _C[1]),
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
