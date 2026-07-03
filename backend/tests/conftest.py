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
    g = models.Group(id="test-group", name="테스트 그룹")
    db_session.add(g)
    db_session.commit()
    return g


@pytest.fixture()
def user(db_session, group):
    u = models.User(id="test-user", group_id=group.id, display_name="홍길동", invite_code="TESTCODE1")
    db_session.add(u)
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
