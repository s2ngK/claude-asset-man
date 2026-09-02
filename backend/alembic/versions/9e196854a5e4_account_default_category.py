"""계좌에 기본 카테고리를 단다 (#44)

상환·납입 내역을 넣을 때마다 카테고리를 다시 고르게 하지 않는다. 계좌에 한 번 정해두면
그 계좌를 연결하는 순간 화면이 카테고리도 함께 고른다.

**지출 카테고리만** 들어온다 (라우트에서 검증). 계좌를 움직이는 거래는 언제나 지출이다 —
받은 이자는 정산(`/settle`)이 따로 만들고 그 거래는 계좌에 연결되지 않는다.

기존 계좌는 NULL 로 남는다. 비어 있으면 화면이 카테고리를 건드리지 않으므로
지금까지와 똑같이 동작한다 — 데이터 이행이 필요 없다.

자동 생성이 제안한 `groups.admin_code` 인덱스→제약 교체는 여기서도 뺐다 → docs/pitfalls.md

Revision ID: 9e196854a5e4
Revises: fead8177209a
Create Date: 2026-09-02 11:40:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "9e196854a5e4"
down_revision: Union[str, None] = "fead8177209a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("accounts", schema=None) as batch_op:
        batch_op.add_column(sa.Column("category_id", sa.String(), nullable=True))
        # 이름을 준다. SQLite 배치 모드에서 무명 제약은 나중에 떼어낼 수 없다.
        batch_op.create_foreign_key("fk_accounts_category_id", "categories", ["category_id"], ["id"])


def downgrade() -> None:
    with op.batch_alter_table("accounts", schema=None) as batch_op:
        batch_op.drop_constraint("fk_accounts_category_id", type_="foreignkey")
        batch_op.drop_column("category_id")
