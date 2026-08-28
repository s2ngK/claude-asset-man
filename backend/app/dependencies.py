from __future__ import annotations

import secrets
from dataclasses import dataclass

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from . import config, models
from .database import get_db

security = HTTPBearer()

# 관리자 토큰임을 나타내는 클레임. 사용자 토큰과 **절대 섞이면 안 된다**.
ADMIN_SCOPE = "admin"
# 그룹 관리자. 자기 그룹만 만질 수 있고 그룹 삭제(비활성화)는 못 한다.
GROUP_ADMIN_SCOPE = "group_admin"


@dataclass(frozen=True)
class AdminIdentity:
    """관리자 신원. `group_id` 가 None 이면 **전체 관리자**다.

    권한 판단을 라우트마다 손으로 쓰지 않게 여기 모아둔다 — 한 군데라도 빠뜨리면
    다른 그룹이 그대로 새기 때문이다 (→ docs/auth-and-scoping.md).
    """

    group_id: str | None

    @property
    def is_super(self) -> bool:
        return self.group_id is None

    def require_super(self) -> None:
        if not self.is_super:
            raise HTTPException(status_code=403, detail="전체 관리자만 할 수 있습니다.")

    def require_group(self, group_id: str) -> None:
        if self.is_super:
            return
        if self.group_id != group_id:
            # 다른 그룹의 존재를 알려줄 이유가 없다. 다만 화면에 목록이 없으므로
            # 404 로 숨기기보다 권한 문제임을 알리는 편이 덜 헷갈린다.
            raise HTTPException(status_code=403, detail="이 그룹을 관리할 권한이 없습니다.")


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
    # 그룹이 비활성이면 **이미 로그인한 세션도 즉시 끊는다.** 로그인만 막으면 최대
    # 30일 동안 살아 있는 토큰이 남는다.
    if user.group is None or not user.group.is_active:
        raise HTTPException(status_code=401, detail="비활성화된 그룹입니다.")
    return user


def _valid_admin_token(token: str) -> bool:
    try:
        payload = jwt.decode(token, config.jwt_secret(), algorithms=[config.ALGORITHM])
    except JWTError:
        return False
    return payload.get("scope") == ADMIN_SCOPE


def _admin_claims(authorization: str | None) -> dict | None:
    if authorization is None:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    try:
        return jwt.decode(token, config.jwt_secret(), algorithms=[config.ALGORITHM])
    except JWTError:
        return None


def resolve_admin(x_admin_key: str | None, authorization: str | None, db: Session) -> AdminIdentity:
    """관리자 신원을 판별한다. 실패하면 403.

    받는 것:
    - `X-Admin-Key` 원문 — **전체 관리자만.** curl·스크립트용이다
    - `Authorization: Bearer` 관리자 토큰 — `scope` 로 전체/그룹 관리자가 갈린다

    그룹 관리자 인증키(`groups.admin_code`) 원문은 헤더로 받지 않는다. 로그인
    (`POST /api/admin/login`)에서만 쓰이고 그 자리에서 토큰으로 바뀐다.

    Not a FastAPI Depends(): route handlers call this from inside their own
    body (like login's invite_code check) so that a wrong key still counts
    as a hit against @limiter.limit — a Depends() is resolved before the
    decorated endpoint function runs, so failures there never reach the
    rate limiter.
    """
    if x_admin_key is not None and secrets.compare_digest(x_admin_key, config.admin_key()):
        return AdminIdentity(group_id=None)

    claims = _admin_claims(authorization)
    if claims is not None:
        scope = claims.get("scope")
        if scope == ADMIN_SCOPE:
            return AdminIdentity(group_id=None)
        if scope == GROUP_ADMIN_SCOPE:
            group_id = claims.get("group_id")
            group = db.query(models.Group).filter(models.Group.id == group_id).first() if group_id else None
            if group is None:
                raise HTTPException(status_code=403, detail="관리자 인증에 실패했습니다.")
            # 비활성화하면 그 그룹의 인증키는 전부 무효가 된다. 이미 발급된 토큰도
            # 여기서 막지 않으면 최대 60분 동안 살아 있다.
            if not group.is_active:
                raise HTTPException(status_code=403, detail="비활성화된 그룹입니다.")
            return AdminIdentity(group_id=group.id)

    raise HTTPException(status_code=403, detail="관리자 인증에 실패했습니다.")
