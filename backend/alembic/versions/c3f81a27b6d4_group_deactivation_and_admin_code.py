"""그룹 비활성화와 그룹 관리자 인증키

- `groups.deactivated_at` — NULL 이면 살아 있는 그룹. **행을 지우지 않는다.**
- `groups.admin_code` — 그룹 관리자 인증키. 초대 코드와 같은 성격이라 유니크해야 한다.

이미 있는 그룹에도 `admin_code` 를 채워 넣는다. 비워두면 그룹 관리자를 세울 수 없는
그룹이 조용히 생긴다.

Revision ID: c3f81a27b6d4
Revises: b7c41d0e93a5
Create Date: 2026-08-28 06:10:00.000000

"""

import secrets
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c3f81a27b6d4"
down_revision: Union[str, None] = "b7c41d0e93a5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("groups", sa.Column("admin_code", sa.String(), nullable=True))
    op.add_column("groups", sa.Column("deactivated_at", sa.DateTime(), nullable=True))

    # 기존 그룹에 인증키를 채운다. SQLite 유니크 인덱스는 NULL 을 여럿 허용하지만,
    # 값이 없으면 그룹 관리자를 세울 방법이 없으므로 다 만들어 둔다.
    groups = sa.table("groups", sa.column("id", sa.String), sa.column("admin_code", sa.String))
    conn = op.get_bind()
    for (group_id,) in conn.execute(sa.select(groups.c.id)).all():
        conn.execute(
            groups.update().where(groups.c.id == group_id).values(admin_code=secrets.token_urlsafe(12))
        )

    op.create_index("ix_groups_admin_code", "groups", ["admin_code"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_groups_admin_code", table_name="groups")
    op.drop_column("groups", "deactivated_at")
    op.drop_column("groups", "admin_code")
