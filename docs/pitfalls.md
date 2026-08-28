# 함정과 교훈

← [그룹 가계부](README.md) · 관련 [개발 환경 세팅](setup.md) [인증과 그룹 격리](auth-and-scoping.md)

한 번씩 실제로 당한 것들. 모르면 똑같이 시간을 쓴다.

이 문서의 내용 중 상당수는 **이 프로젝트를 넘어 재사용되는 지식**이다. FastAPI나 Next 16을 다시 쓸 때 다시 볼 것.

# FastAPI · slowapi

## `Depends`로 뺀 인증은 rate limit에 잡히지 않는다

**증상**: `@limiter.limit`을 걸었는데 브루트포스가 무제한으로 통한다.

**원인**: FastAPI는 `Depends`를 **엔드포인트 함수 본문보다 먼저** 해석한다. 라우터 레벨이든 파라미터 레벨이든 상관없다. 인증이 dependency 단계에서 실패하면 데코레이터가 감싼 함수 자체가 호출되지 않으므로, rate limit 카운터가 **한 번도 증가하지 않는다.**

**해결**: rate limit에 걸려야 하는 검증은 **함수 본문 안에서 직접** 호출한다.

```python
@router.post("/groups", status_code=201)
@limiter.limit("10/minute")
def create_group(request: Request, ..., x_admin_key: str = Header(...)):
    check_admin_key(x_admin_key)     # ← 본문 안에서
```

`admin.py` 전체가 이 형태다. 어색해 보여도 **의도된 것이고, 리팩터링하면 안 된다.**
`tests/test_admin.py`의 `test_admin_endpoint_is_rate_limited_on_repeated_failures`가 이걸 지키고 있다.

처음엔 `APIRouter(dependencies=[Depends(require_admin_key)])`로 깔끔하게 짰다가, 실제 브루트포스 테스트를 돌려보고서야 발견했다. **테스트를 쓰지 않았으면 못 잡았을 문제.**

## `from __future__ import annotations`가 slowapi와 충돌한다

**증상**: rate limit을 붙인 라우트에서 FastAPI가 요청 body를 **query 파라미터로 오인식**한다.

**해결**: 해당 파일에서 그 import를 뺀다. 그래서 `routes/auth.py`에만 이 import가 없다.

다른 라우트 파일에는 데코레이터가 없어서 문제가 안 될 뿐이다. **새 라우트에 `@limiter.limit`을 붙일 때는 이 import를 지워야 한다.**

# Docker

## 컨테이너 `CMD`에서 `uv run`을 쓰지 않는다

**증상**: 컨테이너가 시작할 때마다 느리다.

**원인**: `uv run`이 매번 의존성을 재동기화한다. **dev 그룹(ruff, pytest)까지** 끌어온다.

**해결**: `ENV PATH="/app/.venv/bin:$PATH"`를 설정하고 venv 바이너리를 직접 호출한다.

```dockerfile
ENV PATH="/app/.venv/bin:$PATH"
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
```

이미지는 빌드 후 불변이므로 런타임 동기화가 애초에 필요 없다.

## `.dockerignore` 가 없으면 이미지가 오염된다

로컬 `.venv/`, `data/*.db`, `node_modules`, `.next` 가 빌드 컨텍스트에 통째로 들어간다.
**로컬 개발 DB 가 이미지에 박히는** 사고가 난다.

`backend/.dockerignore` 와 **루트 `.dockerignore` 둘 다** 필요하다 — 프론트엔드 빌드는
저장소 루트를 컨텍스트로 쓰기 때문이다. 루트 것을 추가하고 컨텍스트가
**819MB → 800KB** 로 줄었다.

## `NEXT_PUBLIC_*`은 런타임 환경변수가 아니다

빌드 시점에 번들로 **인라인**된다. docker-compose 의 `environment:` 로 넣으면 런타임에
주입돼 봐야 이미 박힌 값을 못 바꾼다. 반드시 `build.args` 로 넘겨야 한다.

```yaml
build:
  context: .
  dockerfile: Dockerfile.frontend
  args:
    NEXT_PUBLIC_API_URL: ${API_URL:-http://localhost:8000}
```

같은 이유로 **API 주소를 바꾸면 이미지를 다시 빌드해야 한다.**

## `python:*-slim` 에는 curl 이 없다

healthcheck 를 `curl -f .../health` 로 걸면 **영원히 실패한다.** API 는 멀쩡히 200 을
주는데도 그렇다. 그리고 `depends_on: condition: service_healthy` 가 걸린 서비스는
그 때문에 아예 기동하지 못한다.

이미지에 curl 을 설치하는 대신 이미 있는 파이썬을 쓴다 — 200 이 아니면 예외가 난다.

```yaml
test:
  - CMD
  - python
  - -c
  - import urllib.request; urllib.request.urlopen("http://localhost:8000/health")
start_period: 15s   # 첫 기동의 alembic upgrade head 시간을 준다
```

컨테이너가 `Up (unhealthy)` 인데 로그는 정상이라면 healthcheck 명령 자체를 의심할 것.
사유는 여기서 보인다:

```bash
docker inspect ledger-backend --format '{{range .State.Health.Log}}{{.Output}}{{end}}'
```

# Next.js 16 마이그레이션

Next 15 → 16에서 걸린 것들. 비슷한 잔재가 더 있을 수 있다.

## `next lint`가 제거됐다

**증상**:
```
Invalid project directory provided, no such directory: .../lint
```

**원인**: `next lint`가 없어져서 `next dev lint`로 해석되고, `./lint`를 프로젝트 디렉터리로 찾는다.

**해결**: `package.json`의 스크립트를 `eslint .`로 교체. flat config(`eslint.config.mjs`)는 이미 Next 16 형식이라 그대로 동작했다.

## `middleware` 파일 컨벤션이 `proxy`로 바뀌었다

`src/middleware.ts` → `src/proxy.ts`. **파일명만 바꾸면 안 되고 export 함수명도** `proxy`로 바꿔야 한다 (또는 default export). `config` export는 그대로 동작하며 `ProxyConfig` 타입이 새로 제공된다.

`NextMiddleware` / `MiddlewareConfig`는 deprecated alias로 남아 있다.

## next-pwa 때문에 Turbopack을 쓸 수 없다

next-pwa가 webpack 설정을 주입하는데 Next 16은 **Turbopack이 기본**이라 충돌한다.

그래서 `dev`와 `build` 양쪽에 `--webpack`이 고정돼 있다. **이 플래그를 지우면 실행이 안 된다.**

Turbopack으로 넘어가려면 PWA 플러그인 대안을 찾아야 한다. 현재 보류.

## `next/font/google`에 아이콘 폰트는 없다

Material Symbols Outlined를 `next/font`로 옮기려 했으나 **불가능**했다. `font-data.json`의 1,907개 패밀리 중 Material Symbols 계열이 없다 — 아이콘 폰트는 데이터셋에 포함되지 않는다.

그래서 `app/layout.tsx`에서 `<link>`로 불러온다. `@next/next/no-page-custom-font` 경고가 뜨지만 이 룰은 **Pages Router의 `_document.js` 전제**라 App Router에선 false positive다. 해당 파일에만 룰을 껐다.

셀프 호스팅(`next/font/local`)은 가능하지만 성능 이득 대비 작업량으로 보류.

## 목록 행에 무언가를 더할 때 — 오른쪽 칸을 건드리지 않는다

거래 목록은 **금액을 세로로 훑는 표**다. 일부 행에만 요소를 더하면 그 행의 금액만 밀려
숫자 끝이 줄마다 어긋난다.

넓은 화면에서 호버 시 삭제 아이콘을 드러내봤다가 되돌렸다 — 아이콘이 흐름 안에서 자리를
차지하는데 **자기 내역에만** 붙어서, 내 줄의 금액만 안쪽으로 밀렸다.

```
동료의 커피   2026-08-27 • 나          -₩4,800  🗑   <- 밀림
첫 번째 지출  2026-08-27 • 테스터-01    -₩1,000       <- 안 밀림
```

더해야 한다면 둘 중 하나다.

- **흐름 밖으로** — `absolute` 로 띄운다 (내 내역 강조 막대가 이 방식이다)
- **왼쪽 정렬 영역으로** — 날짜·작성자 줄은 폭이 어차피 제각각이라 무엇을 더해도 안전하다
  (`나` 뱃지가 여기 있다)

자리를 모든 행에 항상 비워두는 것도 방법이지만, 아무것도 없는 행에 빈칸이 남는다.

# 로컬 환경

## `backend/data/`가 없으면 기동 실패

`sqlite3.OperationalError: unable to open database file`. 메시지가 원인을 전혀 안 알려준다. `mkdir -p backend/data` → [개발 환경 세팅](setup.md)

## 기본 시크릿으로도 뜨던 시절이 있었다 (지금은 막혀 있다)

`ALLOWED_ORIGINS` 기본값이 `*` 였고 `allow_credentials=True` 와 함께라서 **임의 origin 을
echo back** 했다. `JWT_SECRET`·`ADMIN_KEY` 도 공개된 문자열이 기본값이었고, 경고도 기동
차단도 없었다.

지금은 기본값이 `http://localhost:3000` 이고, `APP_ENV=production` 이면 기본값이 남아 있을 때
기동을 거부한다 → [개발 환경 세팅](setup.md) · [#10](https://github.com/s2ngK/claude-asset-man/issues/10) · [#12](https://github.com/s2ngK/claude-asset-man/issues/12)

> [!WARNING] 폴백 문자열은 한 곳에서만 정한다
> `docker-compose.yml` 의 `${JWT_SECRET:-...}` 폴백이 `app/config.py` 의 기본값과
> **달랐던 시기가 있다**(`change-this-secret` vs `change-this-secret-in-production`).
> 그러면 compose 로 띄운 서버가 "설정을 안 했다" 는 판정을 그대로 빠져나간다.
> `config.PLACEHOLDER_JWT_SECRETS` 가 옛 문자열까지 들고 있는 이유다.

## `localStorage` 를 렌더 중에 읽으면 하이드레이션이 깨진다

`localStorage` 는 서버에 없다. 렌더 본문에서 읽으면 서버 HTML 은 빈 값이고 첫 클라이언트
렌더는 실제 값이라 React 가 불일치로 본다 (#16).

`useEffect` 로 옮기는 것도 방법이지만, 이 저장소의 ESLint 는 **effect 안에서의 setState 를
막는다**(`react-hooks/set-state-in-effect`). React 가 정해둔 답은 `useSyncExternalStore` 다 —
`src/lib/useLocalUser.ts` 가 그 형태다. 서버 스냅샷을 명시적으로 `null` 로 주면 서버와 첫
클라이언트 렌더가 같아진다.

> [!WARNING] `getSnapshot` 은 같은 객체를 돌려줘야 한다
> 매번 새 객체를 만들면 React 가 계속 바뀐 것으로 보고 **무한 렌더**에 빠진다.
> `useLocalUser` 가 키를 만들어 캐시하는 이유다.

# 스키마 변경

`create_all()`을 쓰지 않는다. **Alembic이 유일한 스키마 관리 수단이다.**

`app/models.py`를 고쳤으면 반드시:
```bash
uv run alembic revision --autogenerate -m "설명"
```
그리고 **생성된 마이그레이션을 눈으로 검토한다.** autogenerate가 항상 옳지는 않다 — 특히 컬럼 rename을 drop + add로 만들어 데이터를 날릴 수 있다.
