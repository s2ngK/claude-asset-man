import secrets
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from jose import jwt
from sqlalchemy.orm import Session

from .. import config, models, schemas
from ..database import get_db
from ..dependencies import ADMIN_SCOPE, check_admin_auth
from ..rate_limit import limiter

router = APIRouter(prefix="/api/admin", tags=["admin"])


def create_admin_token() -> tuple[str, datetime]:
    """관리자 토큰. 사용자 토큰과 달리 `sub` 가 없고 `scope` 로 구분한다.

    사용자 토큰과 같은 시크릿으로 서명하되, `get_current_user` 가 scope 를 보고 거부하므로
    관리자 토큰으로 사용자 API 를 부를 수 없다.
    """
    expire = datetime.now(UTC) + timedelta(minutes=config.admin_token_expire_minutes())
    token = jwt.encode(
        {"scope": ADMIN_SCOPE, "exp": expire},
        config.jwt_secret(),
        algorithm=config.ALGORITHM,
    )
    return token, expire


@router.post("/login", response_model=schemas.AdminTokenResponse)
@limiter.limit("10/minute")
def admin_login(request: Request, payload: schemas.AdminLoginRequest):
    """관리자 키를 **한 번만** 받아 토큰으로 바꿔준다.

    화면은 이 토큰만 들고 있으면 되고, 키 자체는 저장하지 않는다.
    """
    if not secrets.compare_digest(payload.admin_key, config.admin_key()):
        raise HTTPException(status_code=403, detail="관리자 키가 올바르지 않습니다.")
    token, expires_at = create_admin_token()
    return schemas.AdminTokenResponse(access_token=token, expires_at=expires_at)


@router.post("/groups", status_code=201)
@limiter.limit("10/minute")
def create_group(
    request: Request,
    payload: schemas.GroupCreate,
    x_admin_key: str | None = Header(None),
    authorization: str | None = Header(None),
    db: Session = Depends(get_db),
):
    check_admin_auth(x_admin_key, authorization)
    group = models.Group(id=str(uuid.uuid4()), name=payload.name)
    db.add(group)
    db.commit()
    db.refresh(group)
    return {"id": group.id, "name": group.name}


@router.get("/groups")
@limiter.limit("10/minute")
def list_groups(
    request: Request,
    x_admin_key: str | None = Header(None),
    authorization: str | None = Header(None),
    db: Session = Depends(get_db),
):
    check_admin_auth(x_admin_key, authorization)
    return [{"id": g.id, "name": g.name} for g in db.query(models.Group).all()]


@router.post("/users", status_code=201)
@limiter.limit("10/minute")
def create_user(
    request: Request,
    payload: schemas.UserCreate,
    x_admin_key: str | None = Header(None),
    authorization: str | None = Header(None),
    db: Session = Depends(get_db),
):
    check_admin_auth(x_admin_key, authorization)
    if not db.query(models.Group).filter(models.Group.id == payload.group_id).first():
        raise HTTPException(status_code=404, detail="그룹을 찾을 수 없습니다.")
    code = payload.invite_code or secrets.token_urlsafe(8)
    if db.query(models.User).filter(models.User.invite_code == code).first():
        raise HTTPException(status_code=409, detail="이미 사용 중인 초대 코드입니다.")
    user = models.User(
        id=str(uuid.uuid4()), group_id=payload.group_id, display_name=payload.display_name, invite_code=code
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "display_name": user.display_name, "invite_code": code}


@router.get("/users")
@limiter.limit("10/minute")
def list_users(
    request: Request,
    x_admin_key: str | None = Header(None),
    authorization: str | None = Header(None),
    group_id: str | None = Query(None),
    db: Session = Depends(get_db),
):
    check_admin_auth(x_admin_key, authorization)
    q = db.query(models.User)
    if group_id:
        q = q.filter(models.User.group_id == group_id)
    return [
        {"id": u.id, "group_id": u.group_id, "display_name": u.display_name, "invite_code": u.invite_code}
        for u in q.all()
    ]


@router.post("/users/{user_id}/invite-code")
@limiter.limit("10/minute")
def regenerate_invite_code(
    request: Request,
    user_id: str,
    x_admin_key: str | None = Header(None),
    authorization: str | None = Header(None),
    db: Session = Depends(get_db),
):
    """초대 코드를 새로 발급한다. **예전 코드는 즉시 못 쓰게 된다.**

    초대 코드가 곧 로그인 자격증명이라, 유출됐을 때 사용자를 새로 만드는 것 말고는
    돌릴 방법이 없었다. 이미 발급된 JWT 는 만료까지 살아 있다 —
    폐기 목록이 없기 때문이다 (→ docs/auth-and-scoping.md).
    """
    check_admin_auth(x_admin_key, authorization)
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    user.invite_code = secrets.token_urlsafe(8)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "display_name": user.display_name, "invite_code": user.invite_code}
