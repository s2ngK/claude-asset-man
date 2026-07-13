from __future__ import annotations

import os

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from . import models
from .database import get_db

SECRET_KEY = os.getenv("JWT_SECRET", "change-this-secret-in-production")
ALGORITHM = "HS256"
ADMIN_KEY = os.getenv("ADMIN_KEY", "change-this-admin-key")

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> models.User:
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str | None = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다.")
    except JWTError as e:
        raise HTTPException(status_code=401, detail="토큰 검증에 실패했습니다.") from e

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="사용자를 찾을 수 없습니다.")
    return user


def check_admin_key(x_admin_key: str) -> None:
    # Not a FastAPI Depends(): route handlers call this from inside their own
    # body (like login's invite_code check) so that a wrong key still counts
    # as a hit against @limiter.limit — a Depends() is resolved before the
    # decorated endpoint function runs, so failures there never reach the
    # rate limiter.
    if x_admin_key != ADMIN_KEY:
        raise HTTPException(status_code=403, detail="관리자 키가 올바르지 않습니다.")
