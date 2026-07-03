# 그룹 가계부 (Group Ledger)

그룹 단위로 수입/지출을 함께 기록하고 통계를 확인하는 개인 재정 관리 웹 앱입니다.

## 구성

- **`/`** — Next.js 16 웹 PWA (TypeScript, Tailwind v4, shadcn/ui)
- **`backend/`** — FastAPI + SQLAlchemy + SQLite REST API

## 개발 배경

초기에는 Supabase(Auth + Postgres)와 Google Gemini(영수증 OCR, 문자 파싱)를 사용하는 구조로 시작했고, 웹과 모바일(React Native/Expo) 두 앱을 함께 운영했습니다. 이후 다음과 같은 방향으로 정리했습니다.

1. **AI 기능 제거** — 영수증 스캔, 문자 자동 분석 등 AI 기반 입력 기능을 걷어내고, 카테고리·금액·간단한 적요만 입력하는 단순한 수동 입력 방식으로 전환
2. **백엔드 자체 구축** — Supabase가 과한 것으로 판단하여, 학습 목적을 겸해 Python(FastAPI) + SQLite 기반의 자체 백엔드로 교체
3. **인증 단순화** — 이메일/비밀번호 대신 초대 코드(invite code) 입력만으로 로그인하고 JWT를 발급받는 방식으로 변경
4. **모바일 앱 정리** — 모바일 서비스는 더 이상 운영하지 않기로 하여 `mobile/` 디렉토리를 완전히 제거하고 웹 앱 단일 서비스로 정리

## 기술 스택

| 영역 | 기술 |
|------|------|
| 웹 프론트엔드 | Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Recharts |
| 백엔드 | FastAPI, SQLAlchemy ORM, SQLite, python-jose(JWT) |
| 인증 | 초대 코드 → JWT 발급 (이메일/비밀번호 없음) |
| 배포 | Docker Compose (backend + frontend 2개 컨테이너) |

## 시작하기

### 1. 백엔드 실행

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

서버 시작 시 기본 카테고리가 자동으로 시딩되며, `http://localhost:8000/health`로 헬스체크가 가능합니다.

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

- 사용자는 초대 코드로 그룹에 참여하며, 같은 그룹 구성원끼리 서로의 거래 내역을 공유해서 봅니다.
- 카테고리는 `group_id`가 없으면 시스템 기본값, 있으면 그룹 전용 카테고리입니다.
- 모든 API는 요청자의 `group_id`를 기준으로 데이터를 필터링합니다.

## 주요 API 라우트 (`backend/app/routes/`)

- `auth.py` — 초대 코드 로그인, JWT 발급
- `transactions.py` — 거래 내역 CRUD
- `categories.py` — 카테고리 조회
- `stats.py` — 월별 요약, 카테고리별 통계, 멤버별 통계, 6개월 추이
- `admin.py` — 그룹/사용자 생성 (관리자 키로 보호)

## 참고 디렉토리

- `references/design/` — UI 참고용 Vite/React 프로토타입 (프로덕션 아님)
- `.taskmaster/` — 작업 관리 설정 및 기획 문서
- `supabase/` — 이전 Supabase 스키마/마이그레이션 (더 이상 사용하지 않음, 참고용으로만 보관)

자세한 아키텍처 설명은 [CLAUDE.md](./CLAUDE.md)를 참고하세요.
