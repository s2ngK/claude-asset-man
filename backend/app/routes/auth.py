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
    return current_user
