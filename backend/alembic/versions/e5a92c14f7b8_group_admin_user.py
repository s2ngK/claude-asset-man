"""그룹 관리자를 사람으로 고정한다 — 최초 초대 사용자

`groups.admin_user_id` 는 users.id 를 가리키지만 ForeignKey 를 걸지 않는다.
users.group_id 가 이미 groups 를 가리켜서, 제약을 걸면 두 테이블이 순환한다.

기존 그룹은 **가장 먼저 만들어진 구성원**을 관리자로 채운다.

Revision ID: e5a92c14f7b8
Revises: c3f81a27b6d4
Create Date: 2026-08-28 07:10:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e5a92c14f7b8"
down_revision: Union[str, None] = "c3f81a27b6d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("groups", sa.Column("admin_user_id", sa.String(), nullable=True))

    groups = sa.table("groups", sa.column("id", sa.String), sa.column("admin_user_id", sa.String))
    users = sa.table(
        "users",
        sa.column("id", sa.String),
        sa.column("group_id", sa.String),
        sa.column("created_at", sa.DateTime),
    )
    conn = op.get_bind()
    for (group_id,) in conn.execute(sa.select(groups.c.id)).all():
        first = conn.execute(
            sa.select(users.c.id)
            .where(users.c.group_id == group_id)
            .order_by(users.c.created_at, users.c.id)
            .limit(1)
        ).first()
        if first is not None:
            conn.execute(groups.update().where(groups.c.id == group_id).values(admin_user_id=first[0]))


def downgrade() -> None:
    op.drop_column("groups", "admin_user_id")
