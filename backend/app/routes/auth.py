from __future__ import annotations
import os
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from jose import jwt
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas
from ..dependencies import SECRET_KEY, ALGORITHM, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


def create_access_token(user_id: str, group_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=int(os.getenv("TOKEN_EXPIRE_DAYS", "30")))
    return jwt.encode({"sub": user_id, "group_id": group_id, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


@router.post("/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.invite_code == payload.invite_code).first()
    if not user:
        raise HTTPException(status_code=401, detail="유효하지 않은 초대 코드입니다.")
    return schemas.TokenResponse(
        access_token=create_access_token(user.id, user.group_id),
        user_id=user.id, group_id=user.group_id, display_name=user.display_name,
    )


@router.get("/me", response_model=schemas.UserResponse)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user
