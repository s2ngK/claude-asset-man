"""시스템 카테고리 색을 접근성 기준을 통과하는 값으로 교체 (#37)

예전 색은 풀채도 웹 컬러라 흰 카드 위에서 대비가 1.2~1.3:1 밖에 안 되는 것이 있었고
(`#33FF57` 교통, `#33FFF5` 의료/건강), `기타`(`#808080`)는 채도가 0이라 회색으로 읽혔다.

새 값은 명도 밴드가 라이트(L 0.43–0.77)와 다크(L 0.48–0.67) **양쪽에 모두 들어가는**
것으로 골랐다. 색은 카테고리마다 하나만 저장되므로 두 모드에서 같은 값이 쓰인다.

시드는 이미 행이 있으면 건너뛰므로 (`seed_initial_data`), 기존 DB 는 이 마이그레이션으로만
바뀐다. **그룹 전용 카테고리(`group_id IS NOT NULL`)는 건드리지 않는다** — 사용자가 고른
색이다.

Revision ID: b7c41d0e93a5
Revises: d6213d78c3a2
Create Date: 2026-08-27 11:20:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b7c41d0e93a5"
down_revision: Union[str, None] = "d6213d78c3a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (type, name, 새 색, 예전 색)
RECOLOR: list[tuple[str, str, str, str]] = [
    ("expense", "식비", "#3987e5", "#FF5733"),
    ("expense", "교통", "#d95926", "#33FF57"),
    ("expense", "쇼핑", "#199e70", "#3357FF"),
    ("expense", "주거/통신", "#c98500", "#FF33A1"),
    ("expense", "의료/건강", "#d55181", "#33FFF5"),
    ("expense", "기타", "#008300", "#808080"),
    ("income", "급여", "#9085e9", "#FFBD33"),
    ("income", "용돈", "#e66767", "#75FF33"),
    ("income", "금융수입", "#3987e5", "#DB33FF"),
    ("income", "기타", "#d95926", "#A0A0A0"),
]

categories = sa.table(
    "categories",
    sa.column("group_id", sa.String),
    sa.column("type", sa.String),
    sa.column("name", sa.String),
    sa.column("color", sa.String),
)


def _recolor(pick_new: bool) -> None:
    conn = op.get_bind()
    for type_, name, new_color, old_color in RECOLOR:
        conn.execute(
            categories.update()
            .where(
                categories.c.group_id.is_(None),
                categories.c.type == type_,
                categories.c.name == name,
            )
            .values(color=new_color if pick_new else old_color)
        )


def upgrade() -> None:
    _recolor(pick_new=True)


def downgrade() -> None:
    _recolor(pick_new=False)
