"""환경변수 읽기와 **기동 시 설정 검증**을 한곳에 모은다.

값을 모듈 상수로 굳히지 않고 함수로 읽는 이유는 두 가지다.

- 테스트에서 `monkeypatch.setenv` 로 갈아끼울 수 있다 (모듈 재임포트가 필요 없다)
- 기동 검증과 실제 사용처가 **같은 값**을 본다는 것이 보장된다
"""

from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

ALGORITHM = "HS256"

# 값이 이 중 하나면 "설정을 안 한 것" 으로 본다.
# 문자열이 여러 개인 이유: 코드 기본값과 docker-compose 의 폴백이 서로 달랐던 시기가 있어
# 옛 `.env` 를 그대로 쓰는 배포가 남아 있을 수 있다. 하나라도 놓치면 검사가 무의미해진다.
PLACEHOLDER_JWT_SECRETS = frozenset({"", "change-this-secret-in-production", "change-this-secret"})
PLACEHOLDER_ADMIN_KEYS = frozenset({"", "change-this-admin-key"})

DEFAULT_JWT_SECRET = "change-this-secret-in-production"
DEFAULT_ADMIN_KEY = "change-this-admin-key"
# 예전 기본값은 "*" 였다. allow_credentials=True 와 겹치면 Starlette 이 요청자의 origin 을
# 그대로 되돌려줘서 아무 사이트나 인증 요청을 보낼 수 있었다 (#10).
# 기본값은 **열어두는 쪽이 아니라 막는 쪽**이어야 한다 — 틀리면 안 되는 게 아니라 안 되는 게 낫다.
DEFAULT_ALLOWED_ORIGINS = "http://localhost:3000"


def app_env() -> str:
    return os.getenv("APP_ENV", "development").strip().lower()


def is_production() -> bool:
    return app_env() == "production"


def jwt_secret() -> str:
    return os.getenv("JWT_SECRET", DEFAULT_JWT_SECRET)


def admin_key() -> str:
    return os.getenv("ADMIN_KEY", DEFAULT_ADMIN_KEY)


def admin_token_expire_minutes() -> int:
    """관리자 토큰 수명. 사용자 토큰(30일)보다 훨씬 짧게 둔다 —
    이 토큰 하나로 **모든 그룹**을 만들고 볼 수 있기 때문이다."""
    return int(os.getenv("ADMIN_TOKEN_EXPIRE_MINUTES", "60"))


def allowed_origins() -> list[str]:
    raw = os.getenv("ALLOWED_ORIGINS", DEFAULT_ALLOWED_ORIGINS)
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def insecure_config_problems() -> list[str]:
    """지금 설정에서 **프로덕션이면 안 되는** 것들을 사람이 읽을 문장으로 돌려준다."""
    problems: list[str] = []
    if jwt_secret() in PLACEHOLDER_JWT_SECRETS:
        problems.append("JWT_SECRET 이 기본값 그대로다 — 누구나 임의의 사용자 토큰을 위조할 수 있다")
    if admin_key() in PLACEHOLDER_ADMIN_KEYS:
        problems.append(
            "ADMIN_KEY 가 기본값 그대로다 — 관리자 API 로 그룹·사용자를 만들 수 있고, "
            "전 계정의 초대 코드가 평문으로 노출된다"
        )
    if "*" in allowed_origins():
        problems.append(
            "ALLOWED_ORIGINS 에 * 가 있다 — allow_credentials 와 함께라 임의 origin 이 인증 요청을 보낼 수 있다"
        )
    return problems


def verify_startup_config() -> None:
    """기동 시 한 번 부른다. 프로덕션이면 **거부**하고, 아니면 경고만 남긴다.

    개발 편의를 위해 기본값으로도 뜨는 것은 유지하되, 조용히 뜨지는 않게 한다.
    """
    problems = insecure_config_problems()
    if not problems:
        return

    detail = "\n".join(f"  - {p}" for p in problems)
    if is_production():
        raise RuntimeError(
            "APP_ENV=production 인데 안전하지 않은 설정이 남아 있어 기동을 멈춘다.\n"
            f"{detail}\n"
            "환경변수를 채우고 다시 띄운다. 예:\n"
            "  JWT_SECRET=$(openssl rand -hex 32) ADMIN_KEY=$(openssl rand -hex 32) \\\n"
            "  ALLOWED_ORIGINS=https://ledger.example.com APP_ENV=production"
        )

    logger.warning("안전하지 않은 기본 설정으로 기동한다 (APP_ENV=%s):\n%s", app_env(), detail)
