"""이미 진행 중인 계좌의 개시 잔액 (#44)

가계부를 쓰기 전에 이미 갚았거나 부은 것이 있는 계좌를 등록할 수 있어야 한다.
지금까지는 앱에 기록한 내역만 잔액에 반영돼서, 8년 갚은 대출을 넣어도 원금 전액이
남아 있는 것으로 보였다.

- `opening_balance` — 기준일 시점의 잔액
- `opening_on` — 그 잔액의 기준일. **이 날 뒤의 거래만** 잔액에 반영된다

둘 다 nullable 이고 기존 행은 NULL 로 남는다. NULL 이면 지금까지와 똑같이 동작한다 —
데이터 이행이 필요 없다.

자동 생성이 제안한 `groups.admin_code` 인덱스→제약 교체는 여기서도 뺐다 → docs/pitfalls.md

Revision ID: 5a58589963eb
Revises: 9e196854a5e4
Create Date: 2026-09-02 12:20:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "5a58589963eb"
down_revision: Union[str, None] = "9e196854a5e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("accounts", schema=None) as batch_op:
        batch_op.add_column(sa.Column("opening_balance", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("opening_on", sa.String(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("accounts", schema=None) as batch_op:
        batch_op.drop_column("opening_on")
        batch_op.drop_column("opening_balance")
