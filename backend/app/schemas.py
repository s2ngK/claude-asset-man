from __future__ import annotations
from datetime import datetime
from typing import Optional
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
    group_id: Optional[str] = None
    type: str
    name: str
    icon: Optional[str] = None
    color: Optional[str] = None
    is_default: bool
    model_config = {"from_attributes": True}


class TransactionCreate(BaseModel):
    category_id: str
    type: str
    amount: int
    description: Optional[str] = None
    date: str

class TransactionUpdate(BaseModel):
    category_id: Optional[str] = None
    type: Optional[str] = None
    amount: Optional[int] = None
    description: Optional[str] = None
    date: Optional[str] = None

class TransactionResponse(BaseModel):
    id: str
    group_id: str
    user_id: str
    user_display_name: Optional[str] = None
    category_id: str
    category_name: Optional[str] = None
    category_icon: Optional[str] = None
    category_color: Optional[str] = None
    type: str
    amount: int
    description: Optional[str] = None
    date: str
    created_at: Optional[datetime] = None


class MonthlySummary(BaseModel):
    income: int
    expense: int
    balance: int

class CategoryStat(BaseModel):
    category_id: str
    category_name: str
    icon: Optional[str] = None
    color: Optional[str] = None
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
    admin_key: str

class UserCreate(BaseModel):
    group_id: str
    display_name: str
    admin_key: str
    invite_code: Optional[str] = None
