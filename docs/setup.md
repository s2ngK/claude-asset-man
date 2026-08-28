# 개발 환경 세팅

← [그룹 가계부](README.md) · 관련 [함정과 교훈](pitfalls.md)

클론부터 로그인까지.

# 백엔드

의존성과 venv는 **uv**가 관리한다 (`pyproject.toml` + `uv.lock`). pip도 `requirements.txt`도 쓰지 않는다.

```bash
cd backend
mkdir -p data                     # ← 빠뜨리면 기동 실패
uv sync                           # .venv 생성 + 의존성 (dev 그룹 포함)
uv run alembic upgrade head       # 스키마 적용

JWT_SECRET=devsecret ADMIN_KEY=devadmin \
  ALLOWED_ORIGINS=http://localhost:3000 \
  uv run uvicorn app.main:app --reload
```

> [!WARNING] `mkdir -p data`를 먼저 한다
> 디렉터리가 없으면 `sqlite3.OperationalError: unable to open database file`로 죽는다.
> 에러 메시지가 원인을 전혀 알려주지 않아서 한참 헤매기 좋다.
> `data/`는 gitignore 대상이라 클론하면 항상 없다.

`ALLOWED_ORIGINS`를 안 주면 기본값이 `*`가 된다 → [함정과 교훈](pitfalls.md)

# 웹

```bash
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev
```

`.env.local`이 없어도 코드 기본값이 `http://localhost:8000`이라 로컬에선 동작한다.

# 로그인할 계정 만들기

여기까지 하면 `localhost:3000`이 뜨지만 **로그인할 수 없다.** 회원가입이 없고, 초대 코드는 관리자 API로만 만들 수 있다.

```bash
# 1) 그룹 생성
curl -X POST localhost:8000/api/admin/groups \
  -H "X-Admin-Key: devadmin" -H "Content-Type: application/json" \
  -d '{"name":"우리집"}'
# → {"id":"...", "name":"우리집"}

# 2) 그 그룹에 사용자 생성
curl -X POST localhost:8000/api/admin/users \
  -H "X-Admin-Key: devadmin" -H "Content-Type: application/json" \
  -d '{"group_id":"위에서 받은 id","display_name":"홍길동"}'
# → {"invite_code":"..."}  ← 이 값으로 로그인
```

`X-Admin-Key`는 서버를 띄울 때 준 `ADMIN_KEY`와 같아야 한다.

# 자주 쓰는 명령

| 명령 | 위치 | 용도 |
|---|---|---|
| `npm run lint` | 루트 | ESLint. **현재 0건 상태를 유지한다** |
| `npx tsc --noEmit` | 루트 | 타입 체크 |
| `npm run build` | 루트 | 프로덕션 빌드 (tsc 포함) |
| `uv run pytest` | `backend/` | 테스트 15개 |
| `uv run ruff check .` | `backend/` | 파이썬 lint |
| `uv run ruff format .` | `backend/` | 포맷 |
| `uv run alembic revision --autogenerate -m "..."` | `backend/` | 모델 수정 후 **필수** |

`dev`와 `build` 둘 다 `--webpack`이 붙어 있다. **지우면 실행이 안 된다** → [함정과 교훈](pitfalls.md)

# 환경변수

## 웹 (`.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

> [!IMPORTANT] `NEXT_PUBLIC_*`은 빌드 시점에 번들로 인라인된다
> 런타임에 바꿀 수 없다. 컨테이너 `environment`로 넣어도 **아무 효과가 없다.**
> Docker에서는 반드시 `build.args`로 넘겨야 한다 → [#9](https://github.com/s2ngK/claude-asset-man/issues/9) · [결함 목록](known-issues.md)

## 백엔드
| 변수 | 기본값 | 비고 |
|---|---|---|
| `APP_ENV` | `development` | `production` 이면 아래 세 개가 기본값일 때 **기동을 거부한다** |
| `JWT_SECRET` | `change-this-secret-in-production` | 개발에선 경고만, 프로덕션이면 거부 |
| `ADMIN_KEY` | `change-this-admin-key` | 동일 |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | `*` 는 프로덕션에서 거부 |
| `DATABASE_URL` | `sqlite:///./data/ledger.db` | |
| `TOKEN_EXPIRE_DAYS` | `30` | 로그인 응답의 `expires_at` 으로 나가 쿠키 수명이 여기 맞춰진다 |
| `ADMIN_TOKEN_EXPIRE_MINUTES` | `60` | `/admin` 이 받는 관리자 토큰 수명 |
| `SQL_ECHO` | `false` | 쿼리 로깅 |

## 기동 시 설정 검증

`app/config.py` 의 `verify_startup_config()` 가 `lifespan` 맨 앞에서 한 번 돈다.

- **개발(`APP_ENV` 미설정 또는 `development`)** — 기본값이어도 뜨지만 경고 로그가 남는다
- **프로덕션(`APP_ENV=production`)** — 기본값이 하나라도 남아 있으면 `RuntimeError` 로 기동을 멈춘다

```
RuntimeError: APP_ENV=production 인데 안전하지 않은 설정이 남아 있어 기동을 멈춘다.
  - JWT_SECRET 이 기본값 그대로다 — 누구나 임의의 사용자 토큰을 위조할 수 있다
  - ADMIN_KEY 가 기본값 그대로다 — ...
```

배포용 값 만들기:

```bash
JWT_SECRET=$(openssl rand -hex 32) ADMIN_KEY=$(openssl rand -hex 32) \
  ALLOWED_ORIGINS=https://ledger.example.com APP_ENV=production \
  docker compose up -d --build
```

→ [#10](https://github.com/s2ngK/claude-asset-man/issues/10) · [#12](https://github.com/s2ngK/claude-asset-man/issues/12)

# 테스트

```bash
cd backend && uv run pytest
```

- in-memory SQLite + `get_db` 오버라이드로 격리돼 **개발용 DB 파일을 건드리지 않는다**
- 픽스처는 `backend/tests/conftest.py`. 새 테스트도 그대로 가져다 쓰면 된다

| 대상 | 테스트 | 덮인 것 |
|---|---|---|
| `auth.py` | 8 | 로그인 성공/실패, 토큰 검증, 만료 시각, rate limit |
| `transactions.py` | 4 | CRUD, 없는 카테고리 거부, 그룹 스코핑 |
| `admin.py` | 51 | 헤더·토큰 인증, 토큰 상호 거부, 초대 코드 재발급, 그룹 비활성화·복구, 그룹 관리자 권한 경계와 지정, 공통 카테고리 |
| `config.py` | 9 | 기본 시크릿 탐지, 프로덕션 기동 거부 |
| `stats.py` | 16 | 그룹/개인 집계, 지출만 세기, 퍼센트·정렬, 추이 6개월 창 |
| `categories.py` | 19 | 목록·격리·정렬, 그룹 전용 추가/삭제, 색 자동 배정, 삭제 시 `기타` 이동, 관리자 권한 |
| 프론트엔드 | **0** | 의도적 보류 |

# Docker

```bash
docker compose up --build            # 개발 — 기본값으로 뜨고 경고가 남는다
```

배포는 `.env` 를 채우거나 환경변수를 직접 준다 (위 "기동 시 설정 검증" 참고).
`APP_ENV=production` 인데 값이 비면 **컨테이너가 뜨지 않는다.**

백엔드 :8000, 프론트엔드 :3000. 백엔드가 healthy 가 된 뒤 프론트엔드가 뜬다.
백엔드는 시작 시 `alembic upgrade head` 를 자동 실행하고, DB 는 `backend/data/ledger.db` 에
bind mount 로 남는다.

## 배포할 호스트 주소 지정

```bash
API_URL=https://ledger.example.com docker compose up --build
```

`NEXT_PUBLIC_API_URL` 은 **빌드 시점에 번들로 인라인**되므로 compose 가 이 값을
`build.args` 로 넘긴다. `environment` 로 넣으면 아무 효과가 없다 → [함정과 교훈](pitfalls.md)

**주소를 바꾸면 프론트엔드 이미지를 다시 빌드해야 한다.** 컨테이너만 재시작해서는 안 바뀐다.

## 알아둘 점

- 루트 `.dockerignore` 가 `node_modules`·`.next`·`backend/data` 를 막는다. 없으면 컨텍스트가
  800MB 를 넘고 **호스트의 개발 DB 가 이미지에 딸려 들어간다**
- 백엔드 healthcheck 는 curl 이 아니라 파이썬으로 한다 — `python:3.12-slim` 에 curl 이 없다

# git 워크플로

- **`main`에서 직접 작업하지 않는다.** 브랜치를 파서 PR로 올린다
- 진행 상황은 저장소 `ROADMAP.md`에서 관리한다. 작업을 시작하거나 끝낼 때 갱신
- `.claude/`, `.vscode/`, `.idea/` 로컬 설정은 커밋하지 않는다
