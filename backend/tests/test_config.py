"""기동 시 설정 검증 (#10, #12).

기본값 그대로 프로덕션에 뜨면 **공개된 문자열로 서명된 JWT** 를 쓰게 된다.
그래서 개발에서는 경고만, 프로덕션에서는 기동 거부다.
"""

from __future__ import annotations

import logging

import pytest

from app import config


def _clear(monkeypatch):
    for name in ("APP_ENV", "JWT_SECRET", "ADMIN_KEY", "ALLOWED_ORIGINS"):
        monkeypatch.delenv(name, raising=False)


def test_defaults_are_reported_as_problems(monkeypatch):
    _clear(monkeypatch)
    problems = config.insecure_config_problems()
    joined = " ".join(problems)
    assert "JWT_SECRET" in joined
    assert "ADMIN_KEY" in joined
    # ALLOWED_ORIGINS 기본값은 더 이상 "*" 가 아니므로 문제로 잡히면 안 된다
    assert "ALLOWED_ORIGINS" not in joined


def test_default_allowed_origins_is_localhost_not_wildcard(monkeypatch):
    _clear(monkeypatch)
    assert config.allowed_origins() == ["http://localhost:3000"]


def test_wildcard_origin_is_a_problem(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://ledger.example.com,*")
    assert any("ALLOWED_ORIGINS" in p for p in config.insecure_config_problems())


def test_old_compose_placeholder_is_also_caught(monkeypatch):
    """docker-compose 의 폴백이 코드 기본값과 달랐던 시기가 있다 — 그것도 잡아야 한다."""
    _clear(monkeypatch)
    monkeypatch.setenv("JWT_SECRET", "change-this-secret")
    assert any("JWT_SECRET" in p for p in config.insecure_config_problems())


def test_real_values_have_no_problems(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv("JWT_SECRET", "0f2b" * 8)
    monkeypatch.setenv("ADMIN_KEY", "9a71" * 8)
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://ledger.example.com")
    assert config.insecure_config_problems() == []


def test_production_with_defaults_refuses_to_start(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv("APP_ENV", "production")
    with pytest.raises(RuntimeError) as excinfo:
        config.verify_startup_config()
    assert "JWT_SECRET" in str(excinfo.value)
    assert "ADMIN_KEY" in str(excinfo.value)


def test_production_with_real_values_starts(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET", "0f2b" * 8)
    monkeypatch.setenv("ADMIN_KEY", "9a71" * 8)
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://ledger.example.com")
    config.verify_startup_config()  # 예외가 나면 실패다


def test_development_with_defaults_warns_but_starts(monkeypatch, caplog):
    _clear(monkeypatch)
    with caplog.at_level(logging.WARNING, logger="app.config"):
        config.verify_startup_config()  # 기동은 된다
    assert "JWT_SECRET" in caplog.text


def test_app_env_is_case_and_space_insensitive(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv("APP_ENV", "  Production  ")
    assert config.is_production()
