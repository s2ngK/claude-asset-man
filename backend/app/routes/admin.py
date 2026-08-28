import secrets
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from jose import jwt
from sqlalchemy.orm import Session

from .. import config, models, schemas
from ..database import get_db
from ..dependencies import ADMIN_SCOPE, GROUP_ADMIN_SCOPE, AdminIdentity, resolve_admin
from ..rate_limit import limiter

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _new_code(length: int = 12) -> str:
    return secrets.token_urlsafe(length)


def create_admin_token(group: models.Group | None = None) -> tuple[str, datetime]:
    """관리자 토큰. 사용자 토큰과 달리 `sub` 가 없고 `scope` 로 구분한다.

    `group` 을 주면 **그 그룹만** 관리할 수 있는 그룹 관리자 토큰이 된다. 그룹 이름까지
    함께 담는 이유는 화면이 "나는 누구인가" 를 **토큰 하나에서** 읽게 하기 위해서다 —
    권한과 표시가 따로 저장되면 둘이 어긋난다.

    사용자 토큰과 같은 시크릿으로 서명하되, `get_current_user` 가 scope 를 보고 거부하므로
    관리자 토큰으로 사용자 API 를 부를 수 없다.
    """
    expire = datetime.now(UTC) + timedelta(minutes=config.admin_token_expire_minutes())
    claims: dict[str, object] = {"exp": expire}
    if group is None:
        claims["scope"] = ADMIN_SCOPE
    else:
        claims["scope"] = GROUP_ADMIN_SCOPE
        claims["group_id"] = group.id
        claims["group_name"] = group.name
    token = jwt.encode(claims, config.jwt_secret(), algorithm=config.ALGORITHM)
    return token, expire


def _group_or_404(db: Session, group_id: str) -> models.Group:
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="그룹을 찾을 수 없습니다.")
    return group


def _serialize_group(group: models.Group, viewer: AdminIdentity, db: Session) -> schemas.GroupResponse:
    admin_user = (
        db.query(models.User).filter(models.User.id == group.admin_user_id).first() if group.admin_user_id else None
    )
    return schemas.GroupResponse(
        id=group.id,
        name=group.name,
        is_active=group.is_active,
        # 그룹 관리자 인증키는 **전체 관리자에게만** 보인다. 그룹 관리자가 자기 키를
        # 다시 읽을 수 있으면, 그 화면을 한 번 본 사람이 영구 접근권을 갖는다.
        admin_code=group.admin_code if viewer.is_super else None,
        admin_user_id=group.admin_user_id,
        admin_user_name=admin_user.display_name if admin_user else None,
    )


# ── 인증 ─────────────────────────────────────────────────────────────────────


@router.post("/login", response_model=schemas.AdminTokenResponse)
@limiter.limit("10/minute")
def admin_login(request: Request, payload: schemas.AdminLoginRequest, db: Session = Depends(get_db)):
    """관리자 키를 **한 번만** 받아 토큰으로 바꿔준다.

    전체 관리자 키(`ADMIN_KEY`)와 그룹 관리자 인증키(`groups.admin_code`)를 같은 입구로
    받는다. 화면은 이 토큰만 들고 있으면 되고, 키 자체는 저장하지 않는다.
    """
    if secrets.compare_digest(payload.admin_key, config.admin_key()):
        token, expires_at = create_admin_token()
        return schemas.AdminTokenResponse(access_token=token, expires_at=expires_at)

    group = db.query(models.Group).filter(models.Group.admin_code == payload.admin_key).first()
    if group is None:
        raise HTTPException(status_code=403, detail="관리자 키가 올바르지 않습니다.")
    if not group.is_active:
        # 비활성화하면 인증키가 새로 발급되지만, 옛 키를 들고 오는 경우까지 막아 둔다.
        raise HTTPException(status_code=403, detail="비활성화된 그룹입니다.")

    token, expires_at = create_admin_token(group)
    return schemas.AdminTokenResponse(
        access_token=token, expires_at=expires_at, group_id=group.id, group_name=group.name
    )


# ── 그룹 ─────────────────────────────────────────────────────────────────────


@router.post("/groups", status_code=201, response_model=schemas.GroupResponse)
@limiter.limit("10/minute")
def create_group(
    request: Request,
    payload: schemas.GroupCreate,
    x_admin_key: str | None = Header(None),
    authorization: str | None = Header(None),
    db: Session = Depends(get_db),
):
    admin = resolve_admin(x_admin_key, authorization, db)
    admin.require_super()
    # 그룹을 만들면 관리자 인증키도 함께 난다. 나중에 따로 발급하게 두면 인증키 없는
    # 그룹이 조용히 생긴다.
    group = models.Group(id=str(uuid.uuid4()), name=payload.name, admin_code=_new_code())
    db.add(group)
    db.commit()
    db.refresh(group)
    return _serialize_group(group, admin, db)


@router.get("/groups", response_model=list[schemas.GroupResponse])
@limiter.limit("10/minute")
def list_groups(
    request: Request,
    x_admin_key: str | None = Header(None),
    authorization: str | None = Header(None),
    db: Session = Depends(get_db),
):
    admin = resolve_admin(x_admin_key, authorization, db)
    query = db.query(models.Group)
    if not admin.is_super:
        query = query.filter(models.Group.id == admin.group_id)
    return [_serialize_group(g, admin, db) for g in query.all()]


@router.post("/groups/{group_id}/deactivate", response_model=schemas.GroupResponse)
@limiter.limit("10/minute")
def deactivate_group(
    request: Request,
    group_id: str,
    x_admin_key: str | None = Header(None),
    authorization: str | None = Header(None),
    db: Session = Depends(get_db),
):
    """그룹을 비활성화한다. **기록은 지우지 않는다.**

    - 구성원은 로그인할 수 없고, 이미 로그인한 세션도 다음 요청에서 끊긴다
      (`get_current_user` 가 그룹 상태를 본다)
    - **인증키를 전부 무효화한다** — 구성원 초대 코드와 그룹 관리자 인증키를 모두 새로 낸다.
      복구해도 옛 코드는 살아나지 않으므로 관리자가 다시 나눠줘야 한다
    """
    admin = resolve_admin(x_admin_key, authorization, db)
    admin.require_super()  # 그룹 관리자는 자기 그룹도 비활성화할 수 없다

    group = _group_or_404(db, group_id)
    if group.is_active:
        group.deactivated_at = datetime.now(UTC)
        group.admin_code = _new_code()
        for user in db.query(models.User).filter(models.User.group_id == group.id).all():
            user.invite_code = _new_code(8)
        db.commit()
        db.refresh(group)
    return _serialize_group(group, admin, db)


@router.post("/groups/{group_id}/restore", response_model=schemas.GroupResponse)
@limiter.limit("10/minute")
def restore_group(
    request: Request,
    group_id: str,
    x_admin_key: str | None = Header(None),
    authorization: str | None = Header(None),
    db: Session = Depends(get_db),
):
    """비활성화한 그룹을 되살린다. 거래·카테고리는 그대로 남아 있다.

    인증키는 되돌리지 않는다 — 비활성화 시점에 무효화한 것이 복구로 되살아나면
    "전부 무효화" 가 말이 안 된다.
    """
    admin = resolve_admin(x_admin_key, authorization, db)
    admin.require_super()

    group = _group_or_404(db, group_id)
    group.deactivated_at = None
    db.commit()
    db.refresh(group)
    return _serialize_group(group, admin, db)


@router.post("/groups/{group_id}/admin-code", response_model=schemas.GroupResponse)
@limiter.limit("10/minute")
def regenerate_group_admin_code(
    request: Request,
    group_id: str,
    x_admin_key: str | None = Header(None),
    authorization: str | None = Header(None),
    db: Session = Depends(get_db),
):
    """그룹 관리자 인증키를 새로 낸다. 예전 키로는 더 이상 로그인할 수 없다."""
    admin = resolve_admin(x_admin_key, authorization, db)
    admin.require_super()

    group = _group_or_404(db, group_id)
    group.admin_code = _new_code()
    db.commit()
    db.refresh(group)
    return _serialize_group(group, admin, db)


# ── 구성원 ───────────────────────────────────────────────────────────────────


@router.post("/users", status_code=201)
@limiter.limit("10/minute")
def create_user(
    request: Request,
    payload: schemas.UserCreate,
    x_admin_key: str | None = Header(None),
    authorization: str | None = Header(None),
    db: Session = Depends(get_db),
):
    admin = resolve_admin(x_admin_key, authorization, db)
    admin.require_group(payload.group_id)

    group = db.query(models.Group).filter(models.Group.id == payload.group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="그룹을 찾을 수 없습니다.")
    if not group.is_active:
        raise HTTPException(status_code=409, detail="비활성화된 그룹에는 구성원을 추가할 수 없습니다.")

    code = payload.invite_code or _new_code(8)
    if db.query(models.User).filter(models.User.invite_code == code).first():
        raise HTTPException(status_code=409, detail="이미 사용 중인 초대 코드입니다.")
    user = models.User(
        id=str(uuid.uuid4()), group_id=payload.group_id, display_name=payload.display_name, invite_code=code
    )
    db.add(user)
    # 그룹 관리자는 **한 명**이고 최초 초대 사용자로 정해진다. 뒤에 들어온 구성원이
    # 조용히 관리자가 되는 일이 없도록 비어 있을 때만 채운다.
    if group.admin_user_id is None:
        group.admin_user_id = user.id
    db.commit()
    db.refresh(user)
    return {"id": user.id, "group_id": user.group_id, "display_name": user.display_name, "invite_code": code}


@router.get("/users")
@limiter.limit("10/minute")
def list_users(
    request: Request,
    x_admin_key: str | None = Header(None),
    authorization: str | None = Header(None),
    group_id: str | None = Query(None),
    db: Session = Depends(get_db),
):
    admin = resolve_admin(x_admin_key, authorization, db)
    q = db.query(models.User)
    # 그룹 관리자에게는 **자기 그룹만** 보인다. group_id 쿼리로 남의 그룹을 지목해도 마찬가지다.
    if not admin.is_super:
        q = q.filter(models.User.group_id == admin.group_id)
    elif group_id:
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
    admin = resolve_admin(x_admin_key, authorization, db)
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    admin.require_group(user.group_id)

    user.invite_code = _new_code(8)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "display_name": user.display_name, "invite_code": user.invite_code}
