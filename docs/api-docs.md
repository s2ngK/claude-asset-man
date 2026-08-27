# API 문서 읽는 법

← [그룹 가계부](README.md) · 관련 [엔드포인트별 규칙](api-rules.md) [인증과 그룹 격리](auth-and-scoping.md)

> [!TIP] 엔드포인트 명세를 손으로 쓰지 않는다
> FastAPI가 코드에서 **자동 생성**한다. 손으로 옮겨 적으면 반드시 낡는다.
> 이 볼트에는 자동 문서가 **표현할 수 없는 것**만 쓴다.

# 자동 문서 보는 법

서버를 띄운 뒤:

| 주소 | 용도 |
|---|---|
| http://localhost:8000/docs | Swagger UI. 브라우저에서 직접 호출해볼 수 있다 |
| http://localhost:8000/redoc | ReDoc. 읽기 전용, 인쇄에 적합 |
| http://localhost:8000/openapi.json | 원본 스펙. 클라이언트 코드 생성에 쓴다 |

Swagger UI 우측 상단 **Authorize** 버튼에 JWT를 넣으면 인증이 필요한 엔드포인트도 그대로 눌러볼 수 있다.

서버를 띄우지 않고 스펙만 뽑고 싶으면:
```bash
cd backend
uv run python -c "from app.main import app; import json; print(json.dumps(app.openapi(), ensure_ascii=False))"
```

# 자동 문서가 담아주는 것

2026-08-27 기준 실제로 확인한 내용이다.

- 엔드포인트 **16개** 전부 (경로, 메서드, 쿼리 파라미터, 경로 파라미터)
- 요청/응답 스키마 **15개** — Pydantic 모델에서 그대로 생성됨
- `securitySchemes: HTTPBearer` — 어디에 토큰이 필요한지
- 필수/선택 필드, 타입, 기본값

**이건 절대 손으로 쓰지 말 것.** 코드가 곧 문서다.

# 자동 문서가 놓치는 것

여기가 이 볼트의 존재 이유다.

## 1. 에러 응답이 거의 안 잡힌다

`HTTPException`으로 던지는 응답은 `responses=`를 선언하지 않으면 스펙에 안 나타난다. 지금 상태:

| 엔드포인트 | 스펙에 있는 것 | 실제로 나오는 것 |
|---|---|---|
| `POST /api/auth/login` | 200, 422 | + **401** 잘못된 초대 코드, **429** rate limit |
| `GET /api/auth/me` | 200 | + **401** 토큰 없음/무효 |
| `POST /api/transactions` | 201, 422 | + **401**, **404** 없는 카테고리 |
| `PUT`/`DELETE /api/transactions/{id}` | 200/204, 422 | + **401**, **404** 없거나 남의 그룹 것 |
| `POST /api/admin/groups` | 201, 422 | + **403** 키 오류, **429** |
| `POST /api/admin/users` | 201, 422 | + **403**, **404** 없는 그룹, **409** 코드 중복, **429** |

즉 **인증 실패와 rate limit은 자동 문서에 아예 없다.**

> [!NOTE] 개선 여지
> 라우트에 `responses={401: {...}, 429: {...}}`를 선언하면 이 표가 자동 문서로 흡수된다.
> 그러면 이 문서의 이 절은 지워도 된다 — **문서를 줄이는 방향의 코드 변경**이라 값어치가 있다.

## 2. rate limit이 전혀 표현되지 않는다

slowapi 데코레이터는 OpenAPI 스펙에 흔적을 남기지 않는다.

- `POST /api/auth/login` — **10회/분**, IP 기준
- `/api/admin/*` 전 라우트 — **10회/분**, IP 기준
- 초과 시 **429**

초대 코드와 관리자 키가 유일한 자격증명이라 걸어둔 것이다.

## 3. 의미론은 애초에 표현할 수 없다

- **그룹 격리** — 모든 응답이 호출자의 그룹으로 한정된다는 사실
- `PUT`/`DELETE`가 남의 그룹 데이터에 **404**를 주는 것 (403이 아니라 — 존재 자체를 숨긴다)
- `type` 값이 `income`/`expense`여야 한다는 것 (스펙상 그냥 `string`)
- `date` 형식이 `YYYY-MM-DD`여야 한다는 것 (스펙상 그냥 `string`)
- 카테고리를 **이름으로** 찾는 프론트엔드의 결합 → [거래 등록 흐름](flow-create-transaction.md)

이런 건 [엔드포인트별 규칙](api-rules.md)에 정리했다.

# 프론트엔드에서의 API 호출

`src/lib/api.ts`가 **유일한 통로다.** 컴포넌트에서 `fetch`를 직접 부르지 않는다.

- `request<T>()` 하나가 base URL, `Content-Type`, `Authorization` 헤더를 모두 붙인다
- 응답이 `!ok`면 서버의 `detail` 문구를 담아 `Error`를 던진다
- 204는 `undefined`를 반환한다
- base URL은 `NEXT_PUBLIC_API_URL`, 없으면 `http://localhost:8000`

**`NEXT_PUBLIC_*`은 빌드 시점에 번들에 인라인된다.** 런타임에 바꿀 수 없다 → [개발 환경 세팅](setup.md)

## 쓰이지 않는 래퍼
`api.ts`에 정의돼 있지만 아무도 호출하지 않는 것들:

- `getSummary()` — `MainView`가 서버 대신 클라이언트에서 직접 합계를 낸다 → [통계 집계 규칙](stats-rules.md)
- `updateTransaction()` — **수정 플로우가 구현돼 있지 않다**
- `getMe()` — 로그인 응답에 이미 사용자 정보가 있어서 쓸 일이 없었다
