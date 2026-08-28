from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models
from app.database import Base, get_db
from app.main import app
from app.rate_limit import limiter


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    # The limiter's hit counters are global/in-memory, so without a reset
    # they'd accumulate across tests sharing the same TestClient IP.
    limiter.reset()


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(autocommit=False, autoflush=False, bind=engine)()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    # No `with` block: keeps the app's lifespan (which seeds the real dev DB
    # via app.database.SessionLocal) from running against test requests.
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture()
def group(db_session):
    g = models.Group(id="test-group", name="테스트 그룹", admin_code="GROUPADMINCODE1")
    db_session.add(g)
    db_session.commit()
    return g


@pytest.fixture()
def other_group(db_session):
    """다른 그룹 — 그룹 관리자가 넘어가면 안 되는 경계."""
    g = models.Group(id="other-admin-group", name="다른 그룹", admin_code="GROUPADMINCODE2")
    db_session.add(g)
    db_session.commit()
    return g


@pytest.fixture()
def other_group_user(db_session, other_group):
    u = models.User(
        id="other-admin-user", group_id=other_group.id, display_name="남의 그룹 사람", invite_code="OTHERCODE1"
    )
    db_session.add(u)
    db_session.commit()
    return u


@pytest.fixture()
def group_admin_headers(client, group):
    """그룹 관리자 토큰. 인증키를 로그인에 한 번 써서 토큰으로 바꾼다."""
    res = client.post("/api/admin/login", json={"admin_key": group.admin_code})
    assert res.status_code == 200, res.json()
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


@pytest.fixture()
def user(db_session, group):
    """그룹의 첫 구성원. 실제 경로(create_user)와 마찬가지로 **그룹 관리자**가 된다."""
    u = models.User(id="test-user", group_id=group.id, display_name="홍길동", invite_code="TESTCODE1")
    db_session.add(u)
    group.admin_user_id = u.id
    db_session.commit()
    return u


@pytest.fixture()
def category(db_session):
    c = models.Category(id="test-category", group_id=None, type="expense", name="식비", is_default=True)
    db_session.add(c)
    db_session.commit()
    return c


@pytest.fixture()
def auth_headers(client, user):
    res = client.post("/api/auth/login", json={"invite_code": user.invite_code})
    assert res.status_code == 200
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


@pytest.fixture()
def other_group_category(db_session):
    """다른 그룹 전용 카테고리 — 그룹 격리 검증용.

    group_id 가 NULL 이 아니므로 시스템 기본값도 아니고, 테스트 사용자의
    그룹 것도 아니다. 어느 경로로도 이 카테고리에 닿으면 안 된다.
    """
    other = models.Group(id="other-group", name="다른 그룹")
    db_session.add(other)
    c = models.Category(
        id="other-group-category",
        group_id=other.id,
        type="expense",
        name="다른그룹전용",
        is_default=False,
    )
    db_session.add(c)
    db_session.commit()
    return c


@pytest.fixture()
def own_group_category(db_session, group):
    """테스트 사용자 그룹 전용 카테고리 — 정상 사용이 막히지 않는지 확인용."""
    c = models.Category(
        id="own-group-category",
        group_id=group.id,
        type="expense",
        name="우리그룹전용",
        is_default=False,
    )
    db_session.add(c)
    db_session.commit()
    return c


@pytest.fixture()
def group_mate(db_session, group):
    """같은 그룹의 다른 구성원. 목록에는 보이지만 남의 내역은 못 고친다."""
    u = models.User(id="mate-user", group_id=group.id, display_name="같은그룹동료", invite_code="MATECODE1")
    db_session.add(u)
    db_session.commit()
    return u


@pytest.fixture()
def mate_transaction(db_session, group_mate, category):
    tx = models.Transaction(
        id="mate-transaction",
        group_id=group_mate.group_id,
        user_id=group_mate.id,
        category_id=category.id,
        type="expense",
        amount=7000,
        description="동료의 점심",
        date="2026-07-05",
    )
    db_session.add(tx)
    db_session.commit()
    return tx
