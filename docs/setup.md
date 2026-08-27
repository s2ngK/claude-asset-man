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
> Docker에서는 반드시 `build.args`로 넘겨야 한다 → [결함 목록](known-issues.md) 결함 05

## 백엔드
| 변수 | 기본값 | 비고 |
|---|---|---|
| `JWT_SECRET` | `change-this-secret-in-production` | ⚠️ 기본값으로도 서버가 뜬다 |
| `ADMIN_KEY` | `change-this-admin-key` | ⚠️ 동일 |
| `ALLOWED_ORIGINS` | `*` | ⚠️ 임의 origin 허용 |
| `DATABASE_URL` | `sqlite:///./data/ledger.db` | |
| `TOKEN_EXPIRE_DAYS` | `30` | 쿠키 수명(30일 하드코딩)과 어긋날 수 있다 |
| `SQL_ECHO` | `false` | 쿼리 로깅 |

⚠️ 표시는 전부 [결함 목록](known-issues.md)에 항목이 있다.

# 테스트

```bash
cd backend && uv run pytest
```

- in-memory SQLite + `get_db` 오버라이드로 격리돼 **개발용 DB 파일을 건드리지 않는다**
- 픽스처는 `backend/tests/conftest.py`. 새 테스트도 그대로 가져다 쓰면 된다

| 대상 | 테스트 | 덮인 것 |
|---|---|---|
| `auth.py` | 6 | 로그인 성공/실패, 토큰 검증, rate limit |
| `transactions.py` | 4 | CRUD, 없는 카테고리 거부, 그룹 스코핑 |
| `admin.py` | 5 | 헤더 인증, 구 방식 거부, 브루트포스 rate limit |
| `stats.py` | **0** | → [결함 목록](known-issues.md) 결함 09 |
| `categories.py` | **0** | |
| 프론트엔드 | **0** | 의도적 보류 |

# Docker

```bash
docker compose up --build
```

> [!CAUTION] 현재 프론트엔드 빌드가 실패한다
> `Dockerfile.frontend`가 `.next/standalone`을 복사하는데, `next.config.ts`에
> `output: "standalone"`이 없어서 그 디렉터리가 생성되지 않는다.
> → [결함 목록](known-issues.md) 결함 04. 고쳐지기 전까지는 위의 로컬 방식을 쓴다.

백엔드 컨테이너는 정상이다. 시작 시 `alembic upgrade head`를 자동 실행하고,
DB는 `backend/data/ledger.db`에 bind mount로 남는다.

# git 워크플로

- **`main`에서 직접 작업하지 않는다.** 브랜치를 파서 PR로 올린다
- 진행 상황은 저장소 `ROADMAP.md`에서 관리한다. 작업을 시작하거나 끝낼 때 갱신
- `.claude/`, `.vscode/`, `.idea/` 로컬 설정은 커밋하지 않는다
