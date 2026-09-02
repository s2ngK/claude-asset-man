from __future__ import annotations

from datetime import date as date_type
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

# 거래의 수입/지출 구분. models.Transaction.type 은 CHECK 제약 없는 String 이므로
# 여기서 막지 않으면 임의의 문자열이 저장되고, stats.py 가 income/expense 만
# 집계하기 때문에 그 거래는 목록에는 보이면서 합계에서는 조용히 빠진다.
TransactionType = Literal["income", "expense"]

# 계좌의 성격. 부채(loan) 하나와 자산(deposit·installment) 둘로 갈린다.
# 예금은 목돈을 한 번 넣고, 적금은 매달 넣는다 — amount 가 뜻하는 것이 다르다.
AccountKind = Literal["loan", "deposit", "installment"]
# active(진행중) / matured(만기) / closed(중도해지·조기상환).
# 끝난 계좌도 **행을 지우지 않는다** — 그룹 비활성화와 같은 방침이다.
AccountStatus = Literal["active", "matured", "closed"]
# 대출만 쓴다. 원리금균등 / 원금균등 / 만기일시.
RepayMethod = Literal["equal_payment", "equal_principal", "bullet"]


class LoginRequest(BaseModel):
    invite_code: str


class AdminLoginRequest(BaseModel):
    admin_key: str


class AdminTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    # 전체 관리자면 None. 그룹 관리자면 자기 그룹 — 화면이 무엇을 보여줄지 이걸로 가른다.
    group_id: str | None = None
    group_name: str | None = None


class GroupResponse(BaseModel):
    id: str
    name: str
    is_active: bool
    # 그룹 관리자 인증키는 **전체 관리자에게만** 내려간다. 그 외에는 None.
    admin_code: str | None = None
    # 이 그룹의 관리자(최초 초대 사용자). 구성원이 아직 없으면 None.
    admin_user_id: str | None = None
    admin_user_name: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    group_id: str
    display_name: str
    # 토큰의 exp 를 그대로 내려준다. 클라이언트가 쿠키 수명을 이 값에서 계산하므로
    # 쿠키와 JWT 가 **같은 출처**를 갖는다 — 예전엔 쿠키 30일이 하드코딩돼 있어
    # TOKEN_EXPIRE_DAYS 를 줄이면 둘이 어긋났다.
    expires_at: datetime


class UserResponse(BaseModel):
    id: str
    group_id: str
    display_name: str
    # 그룹 카테고리를 만들고 지울 수 있는 사람인지. 화면이 관리 영역을 보여줄지 가른다.
    is_group_admin: bool = False
    model_config = {"from_attributes": True}


class CategoryResponse(BaseModel):
    id: str
    group_id: str | None = None
    type: str
    name: str
    icon: str | None = None
    color: str | None = None
    is_default: bool
    model_config = {"from_attributes": True}


class CategoryCreate(BaseModel):
    type: TransactionType
    name: str = Field(min_length=1, max_length=20)
    # 이모지 한두 글자. 색은 받지 않는다 — 검증된 팔레트에서 서버가 배정한다.
    icon: str | None = Field(default=None, max_length=8)


class TransactionCreate(BaseModel):
    category_id: str
    type: TransactionType
    # 부호는 type 이 나타낸다. 음수 금액은 집계를 뒤집으므로 받지 않는다.
    amount: int = Field(gt=0)
    description: str | None = None
    # 입력은 date 로 검증하고 저장은 "YYYY-MM-DD" 문자열로 한다 —
    # 월 필터가 date.startswith(month) 라서 형식이 어긋나면 어느 달에도 잡히지 않는다.
    date: date_type
    # 이 거래가 움직이는 계좌. 대부분의 거래는 계좌와 무관하므로 선택 항목이다.
    account_id: str | None = None
    # amount 중 이자분. 나머지가 원금분이고 **잔액은 원금분만 움직인다.**
    interest_amount: int | None = Field(default=None, ge=0)


class TransactionUpdate(BaseModel):
    category_id: str | None = None
    type: TransactionType | None = None
    amount: int | None = Field(default=None, gt=0)
    description: str | None = None
    date: date_type | None = None
    account_id: str | None = None
    interest_amount: int | None = Field(default=None, ge=0)


class TransactionResponse(BaseModel):
    id: str
    group_id: str
    user_id: str
    user_display_name: str | None = None
    category_id: str
    category_name: str | None = None
    category_icon: str | None = None
    category_color: str | None = None
    type: str
    amount: int
    description: str | None = None
    date: str
    account_id: str | None = None
    account_name: str | None = None
    interest_amount: int | None = None
    created_at: datetime | None = None


class MonthlySummary(BaseModel):
    income: int
    expense: int
    balance: int


class CategoryStat(BaseModel):
    category_id: str
    category_name: str
    icon: str | None = None
    color: str | None = None
    total: int
    percentage: float


class DailyTotal(BaseModel):
    date: str  # "YYYY-MM-DD"
    income: int
    expense: int


class TrendItem(BaseModel):
    month: str
    income: int
    expense: int


class MemberStat(BaseModel):
    user_id: str
    display_name: str
    total: int
    percentage: float


class GroupCreate(BaseModel):
    name: str


class UserCreate(BaseModel):
    group_id: str
    display_name: str
    invite_code: str | None = None


class AccountCreate(BaseModel):
    kind: AccountKind
    name: str = Field(min_length=1, max_length=40)
    # kind 가 이 값의 뜻을 정한다 — 대출: 대출 원금 · 예금: 예치액 · 적금: 월 납입액.
    amount: int = Field(gt=0)
    # 연이율(%). 예상액을 계산해 보여주는 데만 쓴다.
    rate: float = Field(default=0.0, ge=0, le=100)
    started_on: date_type
    matures_on: date_type
    # 대출이 아니면 무시된다 (라우트에서 None 으로 지운다).
    repay_method: RepayMethod | None = None


class AccountUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=40)
    amount: int | None = Field(default=None, gt=0)
    rate: float | None = Field(default=None, ge=0, le=100)
    started_on: date_type | None = None
    matures_on: date_type | None = None
    repay_method: RepayMethod | None = None


class AccountSettle(BaseModel):
    """만기·해지 정산. **금액은 사람이 확정한다.**

    계산기가 낸 예상액을 화면이 미리 채워주지만, 실제 수령액은 우대금리·중도해지이율·
    세금우대 때문에 공식과 늘 어긋난다 → docs/accounts.md
    """

    status: Literal["matured", "closed"]
    settled_on: date_type
    settled_amount: int = Field(ge=0)
    # 예적금 이자를 수입 거래로 남길 때 쓸 카테고리. 안 주면 서버가 고른다.
    interest_category_id: str | None = None


class AccountResponse(BaseModel):
    id: str
    group_id: str
    user_id: str
    user_display_name: str | None = None
    kind: str
    name: str
    amount: int
    rate: float
    started_on: str
    matures_on: str
    repay_method: str | None = None
    status: str
    settled_on: str | None = None
    settled_amount: int | None = None
    # --- 아래는 전부 계산값이다. 저장되지 않는다 ---
    # 대출: 남은 원금 · 예금: 예치액 · 적금: 누적 납입액. 끝난 계좌는 0.
    balance: int
    # 연결된 거래의 원금분 합계 (대출이면 갚은 원금, 적금이면 넣은 돈).
    paid_principal: int
    # 연결된 거래의 이자분 합계.
    paid_interest: int
