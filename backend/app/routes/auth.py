import os
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from jose import jwt
from sqlalchemy.orm import Session

from .. import config, models, schemas
from ..database import get_db
from ..dependencies import get_current_user
from ..rate_limit import limiter

router = APIRouter(prefix="/api/auth", tags=["auth"])


def create_access_token(user_id: str, group_id: str) -> tuple[str, datetime]:
    """토큰과 **그 토큰의 만료 시각**을 함께 돌려준다.

    만료를 응답에 실어 보내야 클라이언트가 쿠키 수명을 같은 값에서 계산할 수 있다.
    """
    expire = datetime.now(UTC) + timedelta(days=int(os.getenv("TOKEN_EXPIRE_DAYS", "30")))
    token = jwt.encode(
        {"sub": user_id, "group_id": group_id, "exp": expire},
        config.jwt_secret(),
        algorithm=config.ALGORITHM,
    )
    return token, expire


@router.post("/login", response_model=schemas.TokenResponse)
@limiter.limit("10/minute")
def login(request: Request, payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.invite_code == payload.invite_code).first()
    if not user:
        raise HTTPException(status_code=401, detail="유효하지 않은 초대 코드입니다.")
    # 비활성화된 그룹의 구성원은 들어올 수 없다. 코드는 비활성화 시점에 이미 새로 발급돼
    # 옛 코드로는 여기까지 오지도 못하지만, 새 코드를 아는 사람도 막아야 한다.
    if user.group is None or not user.group.is_active:
        raise HTTPException(status_code=403, detail="비활성화된 그룹입니다.")
    token, expires_at = create_access_token(user.id, user.group_id)
    return schemas.TokenResponse(
        access_token=token,
        user_id=user.id,
        group_id=user.group_id,
        display_name=user.display_name,
        expires_at=expires_at,
    )


@router.get("/me", response_model=schemas.UserResponse)
def get_me(current_user: models.User = Depends(get_current_user)):
    return schemas.UserResponse(
        id=current_user.id,
        group_id=current_user.group_id,
        display_name=current_user.display_name,
        # 화면이 카테고리 관리 영역을 보여줄지 가른다. 권한 판단 자체는 서버가 다시 한다.
        is_group_admin=current_user.group is not None and current_user.group.admin_user_id == current_user.id,
    )
