# 엔드포인트별 규칙

← [그룹 가계부](README.md) · 관련 [API 문서 읽는 법](api-docs.md) [인증과 그룹 격리](auth-and-scoping.md)

경로·스키마는 `/docs`에서 본다. 여기엔 **자동 문서가 표현 못 하는 규칙**만 적는다.

# 공통

- 인증이 필요한 모든 엔드포인트는 `Authorization: Bearer <JWT>`
- 인증 실패는 전부 **401**. 관리자 키 실패만 **403**
- **모든 응답은 호출자의 그룹으로 한정된다** → [인증과 그룹 격리](auth-and-scoping.md)
- 검증 실패는 FastAPI가 자동으로 **422**

# `/api/auth`

## `POST /login`
- 인증 불필요. **10회/분** (IP 기준), 초과 시 429
- 잘못된 초대 코드 → **401**
- 응답에 `id`가 아니라 **`user_id`**가 온다. 프론트 타입이 이걸 틀렸던 적이 있다
- 성공 시 프론트가 `setToken()`으로 localStorage + 쿠키에 저장한다

## `GET /me`
- 토큰의 `sub`로 사용자를 다시 조회해 반환한다. 여기는 `user_id`가 아니라 **`id`**로 온다
- 현재 프론트에서 호출하지 않는다

# `/api/transactions`

## `GET ""`
- `month` 쿼리(`YYYY-MM`)로 필터. **`date.startswith(month)` 방식**이라 형식이 어긋나면 조용히 안 잡힌다
- `month`를 안 주면 그룹의 **전체 거래**를 반환한다. 페이지네이션이 없다
- `date DESC` 정렬
- 카테고리·사용자를 `joinedload`로 함께 가져와 `category_name`, `category_icon`, `category_color`, `user_display_name`을 평평하게 실어준다

## `POST ""` → 201
- `group_id`, `user_id`는 **토큰에서 채운다.** 요청 본문에 넣어도 무시된다
- 카테고리가 없으면 **404**
- ⚠️ **카테고리의 그룹 소유권은 검사하지 않는다** → [결함 목록](known-issues.md) 결함 01
- ⚠️ `type`·`amount`·`date` 값 검증이 없다. `type='바나나'`, `amount=-50000`, `date='내일'`이 전부 201로 저장된다 → 결함 02

## `PUT /{tx_id}`
- `id` + `group_id`로 찾는다. 남의 그룹 것이면 **404** (403이 아니다 — 존재를 숨긴다)
- `exclude_unset=True`라 **보낸 필드만** 바뀐다
- ⚠️ `category_id`를 바꿀 때 **존재 여부조차 확인하지 않는다.** POST보다 더 느슨하다

## `DELETE /{tx_id}` → 204
- 남의 그룹 것이면 **404**
- 실제 삭제다. 소프트 삭제가 아니다
- 프론트는 4초 지연 후 호출한다 → [삭제와 되돌리기](flow-delete-undo.md)

# `/api/categories`

## `GET ""`
- **시스템 기본값 + 내 그룹 전용**을 함께 반환한다 (`group_id IS NULL OR group_id = 내 그룹`)
- `type`, `name` 순 정렬
- **생성/수정/삭제 엔드포인트가 없다.** 카테고리는 현재 시딩된 10개가 전부다
- `기타`가 expense·income 양쪽에 있으므로 **`name`만으로 찾으면 안 된다** → [거래 등록 흐름](flow-create-transaction.md)

# `/api/stats`

집계 규칙 전반은 [통계 집계 규칙](stats-rules.md)에 정리했다.

## `GET /summary`
- `month` **필수**, `user_only` 선택(기본 false)
- `income`, `expense`, `balance`(= income − expense)
- 현재 프론트에서 호출하지 않는다 (`MainView`가 직접 계산)

## `GET /categories`
- `month` 필수, `user_only` 선택
- ⚠️ **지출만 집계한다.** 수입은 포함되지 않는다
- 금액 내림차순 정렬, `percentage` 포함

## `GET /trend`
- 파라미터 없음. **항상 최근 6개월** (이번 달 포함)
- `user_only`가 없다 — 언제나 그룹 전체
- ⚠️ 월마다 쿼리를 따로 날린다 (6회) → [결함 목록](known-issues.md) 결함 11

## `GET /members`
- `month` 필수
- ⚠️ **지출만** 집계
- INNER JOIN이라 **지출이 0인 구성원은 아예 나오지 않는다**

# `/api/admin`

관리자 키가 유일한 보호 수단이다. 전 라우트 **10회/분**.

## 공통
- `X-Admin-Key` 헤더 **필수**. 틀리면 **403**, 헤더 자체가 없으면 422
- 키 검사는 `Depends`가 아니라 **함수 본문 안에서** 한다. rate limit이 동작하려면 그래야 한다 → [인증과 그룹 격리](auth-and-scoping.md)
- 예전에 쿼리 파라미터/본문으로 키를 받던 방식은 **제거됐다.** 로그에 시크릿이 남는 문제 때문

## `POST /groups` → 201
- `{"name": "..."}` → `{"id", "name"}`

## `POST /users` → 201
- `group_id` 필수. 없는 그룹이면 **404**
- `invite_code`를 안 주면 `secrets.token_urlsafe(8)`로 생성
- 이미 쓰는 코드면 **409**
- 응답에 `invite_code`가 실려 온다. **이 값이 곧 비밀번호다**

## `GET /users`
- `group_id` 쿼리로 필터 가능
- ⚠️ **모든 사용자의 `invite_code`를 평문으로 반환한다** → [결함 목록](known-issues.md) 결함 08

# `/health`
- 인증 불필요. `{"status": "ok"}`
- docker-compose의 healthcheck가 이걸 본다. frontend가 `service_healthy`를 기다린다
