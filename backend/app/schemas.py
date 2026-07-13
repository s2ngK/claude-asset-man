from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class LoginRequest(BaseModel):
    invite_code: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    group_id: str
    display_name: str


class UserResponse(BaseModel):
    id: str
    group_id: str
    display_name: str
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


class TransactionCreate(BaseModel):
    category_id: str
    type: str
    amount: int
    description: str | None = None
    date: str


class TransactionUpdate(BaseModel):
    category_id: str | None = None
    type: str | None = None
    amount: int | None = None
    description: str | None = None
    date: str | None = None


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
