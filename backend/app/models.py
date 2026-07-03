from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class Group(Base):
    """그룹 — 현재 1그룹 운용, group_id 유지로 확장성 확보"""

    __tablename__ = "groups"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    users: Mapped[list[User]] = relationship("User", back_populates="group")
    transactions: Mapped[list[Transaction]] = relationship("Transaction", back_populates="group")
    categories: Mapped[list[Category]] = relationship("Category", back_populates="group")


class User(Base):
    """사용자 — invite_code가 로그인 자격증명 겸 ID"""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    group_id: Mapped[str] = mapped_column(String, ForeignKey("groups.id"), nullable=False)
    display_name: Mapped[str] = mapped_column(String, nullable=False)
    invite_code: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    group: Mapped[Group] = relationship("Group", back_populates="users")
    transactions: Mapped[list[Transaction]] = relationship("Transaction", back_populates="user")


class Category(Base):
    """카테고리 — group_id=NULL이면 시스템 기본값"""

    __tablename__ = "categories"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    group_id: Mapped[str | None] = mapped_column(String, ForeignKey("groups.id"), nullable=True)
    type: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    icon: Mapped[str | None] = mapped_column(String, nullable=True)
    color: Mapped[str | None] = mapped_column(String, nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    group: Mapped[Group | None] = relationship("Group", back_populates="categories")
    transactions: Mapped[list[Transaction]] = relationship("Transaction", back_populates="category")


class Transaction(Base):
    """거래 내역"""

    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    group_id: Mapped[str] = mapped_column(String, ForeignKey("groups.id"), nullable=False)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    category_id: Mapped[str] = mapped_column(String, ForeignKey("categories.id"), nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    date: Mapped[str] = mapped_column(String, nullable=False)  # YYYY-MM-DD
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    group: Mapped[Group] = relationship("Group", back_populates="transactions")
    user: Mapped[User] = relationship("User", back_populates="transactions")
    category: Mapped[Category] = relationship("Category", back_populates="transactions")
