# 그룹 가계부 (Group Ledger)

그룹 단위로 수입/지출을 함께 기록하고 통계를 확인하는 개인 재정 관리 웹 앱입니다.

## 구성

```
claude-asset-man/
├── src/                    # Next.js 16 웹 PWA (TypeScript, Tailwind v4, shadcn/ui)
│   ├── app/                # 라우트 (login/, stats/, settings/, admin/)
│   ├── components/         # UI 컴포넌트 (components/ui는 shadcn)
│   ├── lib/                # API 클라이언트, 상수, 스토리지 훅
│   └── types/              # 공용 타입 정의
├── backend/                # FastAPI + SQLAlchemy + SQLite REST API
│   ├── app/
│   │   ├── routes/         # auth, transactions, categories, stats, admin
│   │   ├── models.py       # SQLAlchemy ORM 모델
│   │   ├── schemas.py      # Pydantic 스키마
│   │   ├── config.py       # 환경변수 + 기동 시 설정 검증
│   │   ├── palette.py      # 검증된 카테고리 색 (색의 유일한 출처)
│   │   └── main.py         # FastAPI 앱 엔트리포인트
│   ├── alembic/            # DB 스키마 마이그레이션
│   ├── tests/              # pytest 테스트 (138개)
│   └── pyproject.toml      # uv 기반 의존성 관리
├── docs/                   # 아키텍처·동작 문서 (옵시디언 볼트로도 열린다)
├── references/design/      # UI 참고용 프로토타입 (프로덕션 아님)
├── supabase/               # 이전 Supabase 스키마 (참고용, 더 이상 사용 안 함)
└── docker-compose.yml
```

## 기술 스택

| 영역 | 기술 |
|------|------|
| 웹 프론트엔드 | Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Recharts |
| 백엔드 | FastAPI, SQLAlchemy ORM, SQLite, python-jose(JWT) |
| 인증 | 초대 코드 → JWT 발급 (이메일/비밀번호 없음). 관리자는 별도 키 → 별도 scope 토큰 |
| 배포 | Docker Compose (backend + frontend 2개 컨테이너) |

## 시작하기

### 1. 백엔드 실행

```bash
cd backend
mkdir -p data                     # 없으면 SQLite가 DB 파일을 못 열고 죽습니다
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
```

서버 시작 시 기본 카테고리가 자동으로 시딩되며, `http://localhost:8000/health`로 헬스체크가 가능합니다.

로그인하려면 초대 코드가 필요한데, 회원가입이 없어 **관리자 API로만** 만들 수 있습니다.
그 과정은 [docs/setup.md](./docs/setup.md)에 있습니다.

### 2. 웹 프론트엔드 실행

```bash
npm install
npm run dev
```

`.env.local`에 API 주소를 지정합니다.

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

`http://localhost:3000`에서 접속합니다.

### 3. Docker로 한 번에 실행

```bash
docker compose up --build
```

`backend`(포트 8000)와 `frontend`(포트 3000) 두 컨테이너가 함께 뜨며, SQLite 데이터는 `backend/data/ledger.db`에 영속됩니다.

## 데이터 구조

`groups → users → transactions + categories`

- 사용자는 초대 코드로 그룹에 참여하며, 같은 그룹 구성원끼리 서로의 거래 내역을 공유해서 봅니다. 다만 **수정·삭제는 작성자 본인만** 할 수 있습니다.
- 카테고리는 `group_id`가 없으면 시스템 기본값, 있으면 그룹 전용 카테고리입니다. 그룹 전용은 그룹 관리자가, 공통은 전체 관리자가 관리합니다.
- 모든 API는 요청자의 `group_id`를 기준으로 데이터를 필터링합니다.
- 그룹은 삭제하지 않고 **비활성화**합니다 — 기록은 남고 인증키만 전부 무효화되며, 복구할 수 있습니다.

## 주요 API 라우트 (`backend/app/routes/`)

- `auth.py` — 초대 코드 로그인, JWT 발급
- `transactions.py` — 거래 내역 CRUD (작성자만 수정·삭제)
- `categories.py` — 카테고리 조회 + 그룹 전용 카테고리 생성·삭제
- `stats.py` — 월별 요약, 카테고리별 통계, 날짜별 소계(달력), 멤버별 통계, 6개월 추이
- `admin.py` — 관리자 콘솔 API: 관리자 로그인, 그룹 관리(생성·비활성화·복구·인증키 재발급), 구성원·초대 코드 관리, 공통 카테고리 관리

## 참고 디렉토리

- `references/design/` — UI 참고용 Vite/React 프로토타입 (프로덕션 아님)
- `supabase/` — 이전 Supabase 스키마/마이그레이션 (더 이상 사용하지 않음, 참고용으로만 보관)

## 더 읽을 것

- [docs/](./docs/) — 아키텍처·동작 문서. [docs/README.md](./docs/README.md)에서 시작합니다
- [ROADMAP.md](./ROADMAP.md) — 진행 중·백로그·보류 작업
- [CLAUDE.md](./CLAUDE.md) — Claude Code용 작업 지침
