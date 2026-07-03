from __future__ import annotations

import os
import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/admin", tags=["admin"])
ADMIN_KEY = os.getenv("ADMIN_KEY", "change-this-admin-key")


def _check(key: str):
    if key != ADMIN_KEY:
        raise HTTPException(status_code=403, detail="관리자 키가 올바르지 않습니다.")


@router.post("/groups", status_code=201)
def create_group(payload: schemas.GroupCreate, db: Session = Depends(get_db)):
    _check(payload.admin_key)
    group = models.Group(id=str(uuid.uuid4()), name=payload.name)
    db.add(group)
    db.commit()
    db.refresh(group)
    return {"id": group.id, "name": group.name}


@router.get("/groups")
def list_groups(admin_key: str = Query(...), db: Session = Depends(get_db)):
    _check(admin_key)
    return [{"id": g.id, "name": g.name} for g in db.query(models.Group).all()]


@router.post("/users", status_code=201)
def create_user(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    _check(payload.admin_key)
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
def list_users(admin_key: str = Query(...), group_id: str | None = Query(None), db: Session = Depends(get_db)):
    _check(admin_key)
    q = db.query(models.User)
    if group_id:
        q = q.filter(models.User.group_id == group_id)
    return [
        {"id": u.id, "group_id": u.group_id, "display_name": u.display_name, "invite_code": u.invite_code}
        for u in q.all()
    ]
