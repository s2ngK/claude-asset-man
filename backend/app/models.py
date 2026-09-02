from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class Group(Base):
    """그룹 — 현재 1그룹 운용, group_id 유지로 확장성 확보"""

    __tablename__ = "groups"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String, nullable=False)
    # 그룹 관리자 인증키. 초대 코드와 같은 성격이다 — 이 값 하나가 곧 그 그룹의 관리 권한이다.
    # 전체 관리자가 발급해 따로 전달한다.
    admin_code: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    # 비활성 시각. NULL 이면 살아 있는 그룹이다.
    # **행을 지우지 않는다** — 기록을 남겨두고 복구할 수 있어야 한다.
    deactivated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # 이 그룹의 관리자. **그룹당 한 명**이고 최초 초대 사용자로 정해진다.
    #
    # users.id 를 가리키지만 ForeignKey 를 걸지 않는다 — users.group_id 가 이미 groups 를
    # 가리키고 있어 제약을 걸면 두 테이블이 순환한다. SQLite 는 외래키를 강제하지도 않고,
    # create_all 이 순환에서 걸린다. 참조 무결성은 이 값을 채우는 한 곳(create_user)에서 지킨다.
    admin_user_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    @property
    def is_active(self) -> bool:
        return self.deactivated_at is None

    users: Mapped[list[User]] = relationship("User", back_populates="group")
    transactions: Mapped[list[Transaction]] = relationship("Transaction", back_populates="group")
    categories: Mapped[list[Category]] = relationship("Category", back_populates="group")
    accounts: Mapped[list[Account]] = relationship("Account", back_populates="group")


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
    accounts: Mapped[list[Account]] = relationship("Account", back_populates="user")


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
    # 이 거래가 움직이는 계좌. NULL 이면 계좌와 무관한 보통의 거래다 (대부분이 그렇다).
    account_id: Mapped[str | None] = mapped_column(String, ForeignKey("accounts.id"), nullable=True, index=True)
    # amount 중 이자분. 나머지가 원금분이고, **잔액은 원금분만 움직인다.**
    # 50만원을 갚았고 그중 이자가 10만원이면 amount=500000, interest_amount=100000 이다 —
    # 거래를 원금/이자 두 줄로 쪼개지 않는다 (→ docs/accounts.md).
    interest_amount: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    group: Mapped[Group] = relationship("Group", back_populates="transactions")
    user: Mapped[User] = relationship("User", back_populates="transactions")
    category: Mapped[Category] = relationship("Category", back_populates="transactions")
    account: Mapped[Account | None] = relationship("Account", back_populates="transactions")


class Account(Base):
    """대출·예금·적금 계좌.

    **잔액 컬럼이 없다.** 잔액은 이 계좌에 연결된 거래에서 계산한다 — 손으로 갱신하는
    숫자는 몇 달 뒤에 안 고치게 되고, 그러면 화면에 옛 잔액이 남는다 (→ docs/accounts.md).

    소유는 개인(`user_id`)이지만 **열람은 그룹 전체**다. 거래와 같은 규칙이다:
    읽기는 그룹, 쓰기는 본인.
    """

    __tablename__ = "accounts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    group_id: Mapped[str] = mapped_column(String, ForeignKey("groups.id"), nullable=False, index=True)
    # 계좌 주인. 그룹이 아니라 구성원 한 명의 것이다.
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    # loan(대출) / deposit(예금) / installment(적금)
    kind: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    # 상환·납입 내역에 **기본으로 붙일 카테고리.** 지출 카테고리만 온다 — 계좌를 움직이는
    # 거래는 언제나 지출이기 때문이다. 비어 있으면 화면이 카테고리를 건드리지 않는다.
    category_id: Mapped[str | None] = mapped_column(String, ForeignKey("categories.id"), nullable=True)
    # **kind 가 이 값의 뜻을 정한다** — 대출: 대출 원금 · 예금: 예치액 · 적금: 월 납입액.
    # 셋으로 나누면 어느 행에서든 둘은 항상 비어 있다.
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    # 연이율(%). 만기 예상액·상환 예상액을 **계산해 보여주는 데만** 쓴다.
    # 확정 값은 사람이 넣는다 — 우대금리·중도해지이율 때문에 공식과 늘 어긋난다.
    rate: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    started_on: Mapped[str] = mapped_column(String, nullable=False)  # YYYY-MM-DD
    matures_on: Mapped[str] = mapped_column(String, nullable=False)  # YYYY-MM-DD
    # ── 이미 진행 중인 계좌를 등록할 때 ──────────────────────────────────────
    # 가계부를 쓰기 전에 이미 갚았거나 부은 것이 있으면 그 시점의 잔액을 여기 적는다.
    # 없으면 계좌를 처음부터 이 앱으로 관리한 것으로 본다.
    #
    # `opening_on` **뒤의 거래만** 잔액에 반영된다. 기준일 이전 내역을 나중에 채워 넣어도
    # 이미 opening_balance 에 들어 있는 것을 두 번 빼지 않는다.
    opening_balance: Mapped[int | None] = mapped_column(Integer, nullable=True)
    opening_on: Mapped[str | None] = mapped_column(String, nullable=True)  # YYYY-MM-DD
    # 대출만 채운다. equal_payment(원리금균등) / equal_principal(원금균등) / bullet(만기일시)
    repay_method: Mapped[str | None] = mapped_column(String, nullable=True)
    # active / matured(만기) / closed(중도해지·조기상환)
    status: Mapped[str] = mapped_column(String, nullable=False, default="active")
    settled_on: Mapped[str | None] = mapped_column(String, nullable=True)
    # 만기·해지 시 **사용자가 확정한** 수령액·상환액. 계산값이 아니다.
    settled_amount: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    @property
    def is_active(self) -> bool:
        return self.status == "active"

    group: Mapped[Group] = relationship("Group", back_populates="accounts")
    user: Mapped[User] = relationship("User", back_populates="accounts")
    category: Mapped[Category | None] = relationship("Category")
    transactions: Mapped[list[Transaction]] = relationship(
        "Transaction", back_populates="account", foreign_keys="Transaction.account_id"
    )
