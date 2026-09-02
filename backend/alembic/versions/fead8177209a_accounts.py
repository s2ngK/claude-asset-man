"""대출·예금·적금 계좌와 거래-계좌 연결 (#44)

`accounts` 에는 **잔액 컬럼이 없다.** 잔액은 연결된 거래에서 계산한다 (→ docs/accounts.md).

`transactions` 에 두 칸이 붙는다.
- `account_id` — 이 거래가 움직이는 계좌. 대부분의 거래는 NULL 이다
- `interest_amount` — amount 중 이자분. 나머지가 원금분이고 잔액은 원금분만 움직인다

두 칸 모두 nullable 이라 기존 행은 손대지 않는다 — 데이터 이행이 필요 없다.

자동 생성이 제안한 `groups.admin_code` 의 인덱스→유니크 제약 교체는 **일부러 뺐다.**
c3f81a27b6d4 가 유니크 *인덱스* 로 만들었는데 모델은 `unique=True`(유니크 *제약*)라
autogenerate 가 매번 차이로 본다. 동작은 같고, 바꾸면 SQLite 배치 모드가 테이블을
통째로 다시 쓴다 → docs/pitfalls.md

Revision ID: fead8177209a
Revises: e5a92c14f7b8
Create Date: 2026-09-02 10:23:02.167809

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "fead8177209a"
down_revision: Union[str, None] = "e5a92c14f7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "accounts",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("group_id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("rate", sa.Float(), nullable=False),
        sa.Column("started_on", sa.String(), nullable=False),
        sa.Column("matures_on", sa.String(), nullable=False),
        sa.Column("repay_method", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("settled_on", sa.String(), nullable=True),
        sa.Column("settled_amount", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    # 계좌 목록은 늘 그룹으로 거른다. 잔액 계산도 group_id 로 좁힌 뒤 account_id 로 묶는다.
    op.create_index("ix_accounts_group_id", "accounts", ["group_id"])

    with op.batch_alter_table("transactions", schema=None) as batch_op:
        batch_op.add_column(sa.Column("account_id", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("interest_amount", sa.Integer(), nullable=True))
        # 이름을 준다. SQLite 배치 모드에서 무명 제약은 나중에 떼어낼 수 없다.
        batch_op.create_foreign_key("fk_transactions_account_id", "accounts", ["account_id"], ["id"])

    # 잔액은 계좌별 합계라 이 인덱스가 곧 그 쿼리의 경로다.
    op.create_index("ix_transactions_account_id", "transactions", ["account_id"])


def downgrade() -> None:
    op.drop_index("ix_transactions_account_id", table_name="transactions")
    with op.batch_alter_table("transactions", schema=None) as batch_op:
        batch_op.drop_constraint("fk_transactions_account_id", type_="foreignkey")
        batch_op.drop_column("interest_amount")
        batch_op.drop_column("account_id")

    op.drop_index("ix_accounts_group_id", table_name="accounts")
    op.drop_table("accounts")
