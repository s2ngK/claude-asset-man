from __future__ import annotations

import secrets

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from . import config, models
from .database import get_db

security = HTTPBearer()

# 관리자 토큰임을 나타내는 클레임. 사용자 토큰과 **절대 섞이면 안 된다**.
ADMIN_SCOPE = "admin"


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> models.User:
    try:
        payload = jwt.decode(credentials.credentials, config.jwt_secret(), algorithms=[config.ALGORITHM])
        # 관리자 토큰은 sub 가 없어 아래에서 어차피 걸리지만, 의도를 명시해 둔다.
        # 관리자 권한이 사용자 API 로 흘러들어가는 경로를 만들지 않는다.
        if payload.get("scope") == ADMIN_SCOPE:
            raise HTTPException(status_code=401, detail="관리자 토큰으로는 사용자 API를 쓸 수 없습니다.")
        user_id: str | None = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다.")
    except JWTError as e:
        raise HTTPException(status_code=401, detail="토큰 검증에 실패했습니다.") from e

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="사용자를 찾을 수 없습니다.")
    return user


def _valid_admin_token(token: str) -> bool:
    try:
        payload = jwt.decode(token, config.jwt_secret(), algorithms=[config.ALGORITHM])
    except JWTError:
        return False
    return payload.get("scope") == ADMIN_SCOPE


def check_admin_auth(x_admin_key: str | None, authorization: str | None = None) -> None:
    """관리자 인증. **키 원문(`X-Admin-Key`) 또는 관리자 토큰(`Authorization: Bearer`)** 을 받는다.

    키 원문은 curl·스크립트용이고, 토큰은 브라우저용이다. 관리자 키를 브라우저에 저장하면
    XSS 한 번에 **모든 그룹을 만들고 볼 수 있는 값**이 통째로 샌다. 토큰은 만료가 있고
    (`ADMIN_TOKEN_EXPIRE_MINUTES`, 기본 60분) 키 자체는 어디에도 남지 않는다.

    Not a FastAPI Depends(): route handlers call this from inside their own
    body (like login's invite_code check) so that a wrong key still counts
    as a hit against @limiter.limit — a Depends() is resolved before the
    decorated endpoint function runs, so failures there never reach the
    rate limiter.
    """
    if x_admin_key is not None and secrets.compare_digest(x_admin_key, config.admin_key()):
        return

    if authorization is not None:
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() == "bearer" and token and _valid_admin_token(token):
            return

    raise HTTPException(status_code=403, detail="관리자 인증에 실패했습니다.")
