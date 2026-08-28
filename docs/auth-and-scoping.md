# 인증과 그룹 격리

← [그룹 가계부](README.md) · 관련 [아키텍처 개요](architecture.md) [데이터 모델](data-model.md) [엔드포인트별 규칙](api-rules.md)

이 프로젝트에서 **가장 중요한 문서.** 새 엔드포인트를 만들 때 반드시 읽는다.

# 인증 모델

이메일도 비밀번호도 없다. **초대 코드 하나가 곧 계정이다.**

1. 관리자가 `POST /api/admin/users`로 사용자를 만들면 `invite_code`가 발급된다
2. 사용자가 그 코드를 로그인 화면에 넣는다
3. 서버가 `users.invite_code`로 조회해 맞으면 JWT를 발급한다

## JWT에 담기는 것
```
sub       사용자 id
group_id  소속 그룹 id
exp       만료 (TOKEN_EXPIRE_DAYS, 기본 30일)
```

알고리즘은 HS256, 키는 `JWT_SECRET` 환경변수.

## 이 모델의 성질
- **비밀번호 변경이 없다.** 대신 관리자가 **초대 코드를 재발급**할 수 있다
  (→ [관리자 화면](admin-console.md)). 예전 코드는 즉시 죽지만, 그 코드로 이미 발급된
  JWT 는 만료까지 살아 있다
- **로그아웃은 클라이언트에서만 일어난다.** 토큰 폐기(revocation) 목록이 없어서, 발급된 JWT는 만료까지 유효하다
- **리프레시 토큰이 없다.** 30일 뒤 다시 초대 코드를 넣어야 한다
- `GET /api/admin/users`는 **모든 사용자의 초대 코드를 평문으로 반환한다.** 사실상 전 계정 비밀번호 목록이다. 관리자 키로 보호되고 rate limit도 걸려 있다

> [!IMPORTANT] 기본 시크릿이면 프로덕션에서 뜨지 않는다
> `JWT_SECRET`, `ADMIN_KEY` 가 기본값 그대로면 `APP_ENV=production` 일 때 기동을 거부한다
> (`app/config.py` 의 `verify_startup_config()`, `lifespan` 맨 앞에서 실행).
> 개발에서는 뜨지만 경고 로그가 남는다.
>
> 공개된 문자열로 서명된 JWT 는 **누구나 임의의 사용자 토큰을 위조할 수 있다**는 뜻이라,
> 조용히 넘어가면 안 되는 종류의 설정 실수다.
> → [개발 환경 세팅](setup.md) · [#12](https://github.com/s2ngK/claude-asset-man/issues/12)

## 남의 내역은 화면에서도 열리지 않는다

서버가 403 을 주는 것(`_own_transaction`)과 별개로, **목록에서 수정·삭제 제스처 자체가
열리지 않는다.** `TransactionItem` 이 `isMine` 을 받아 자기 것이 아니면

- 포인터 핸들러를 아예 붙이지 않는다 → 왼쪽으로 끌어도 삭제 버튼이 안 나온다
- 삭제 배경을 렌더하지도 않는다 → DOM 에 없다
- 눌러도 수정 모달이 열리지 않는다

서버 검증을 대신하는 게 아니라 **눌러볼 수 있게 두지 않는 것**이다. 예전에는 남의 내역도
스와이프하면 [삭제] 가 나왔고, 누르면 목록에서 사라졌다가 403 을 받고 되돌아오며 알림이
떴다 → [#30](https://github.com/s2ngK/claude-asset-man/issues/30)

작성자 이름도 같은 이유로 필요하다. 전부 `나` 로 보이면 왜 어떤 것만 안 되는지 알 수 없다
→ [#31](https://github.com/s2ngK/claude-asset-man/issues/31)

# 그룹 격리 — 지켜야 할 불변식

> [!IMPORTANT] 모든 데이터 접근은 `current_user.group_id`로 필터링되어야 한다
> DB 제약이 아니라 **각 라우트 핸들러가 지키는 관례다.** 한 곳이라도 빠뜨리면 그대로 샌다.

## 올바른 형태
`routes/transactions.py`가 표준형이다. 새 라우트는 이걸 본떠 쓴다.

```python
@router.get("")
def list_transactions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),   # ← 인증
):
    q = db.query(models.Transaction).filter(
        models.Transaction.group_id == current_user.group_id  # ← 격리
    )
```

수정·삭제도 마찬가지로 **id와 group_id를 함께** 조건에 넣는다. id만으로 찾으면 남의 그룹 데이터를 건드릴 수 있다.

```python
tx = db.query(models.Transaction).filter(
    models.Transaction.id == tx_id,
    models.Transaction.group_id == current_user.group_id,     # ← 빠뜨리면 안 됨
).first()
```

## 참조하는 ID 도 같은 조건을 통과해야 한다

거래가 가리키는 `category_id` 역시 호출자의 그룹이 쓸 수 있는 것이어야 한다.
**존재 여부만 보면 안 된다** — 다른 그룹 전용 카테고리를 자기 거래에 붙일 수 있고,
응답의 `category_name` 으로 그 그룹의 카테고리 이름이 새어 나간다 ([#5](https://github.com/s2ngK/claude-asset-man/issues/5)).

조건이 두 군데로 갈라지지 않도록 `app/queries.py` 의 `visible_categories()` 하나로 모았다.

```python
def visible_categories(db: Session, group_id: str) -> Query[models.Category]:
    return db.query(models.Category).filter(
        (models.Category.group_id.is_(None)) | (models.Category.group_id == group_id)
    )
```

**목록 조회와 거래 저장이 같은 함수를 본다.** 목록에 안 나오는 카테고리는 붙일 수도 없다.

거래 생성·수정 모두 `_require_usable_category()` 를 거치며, 남의 그룹 카테고리에는
**403 이 아니라 404** 를 준다 — 거래 조회·삭제와 같은 방침으로, ID 를 넣어보는 것만으로
존재 여부를 알아낼 수 없게 한다.

> [!IMPORTANT]
> 앞으로 다른 테이블에도 그룹 전용 행이 생기면 같은 형태를 따른다 —
> 필터를 `queries.py` 에 함수로 두고, 목록 조회와 참조 검증이 **그 함수 하나를** 쓰게 한다.

## 읽기는 그룹 전체, 쓰기는 자기 것만

두 규칙이 다르다. 헷갈리면 안 된다.

| 동작 | 범위 | 근거 |
|---|---|---|
| 목록 조회, 통계 | **그룹 전체** | 공동 가계부의 핵심 기능. 좁히면 서비스가 성립하지 않는다 |
| 생성 | 자기 것으로 고정 | `group_id`·`user_id`를 토큰에서 채운다. 본문 값은 무시 |
| 수정, 삭제 | **자기가 쓴 것만** | 남의 기록을 말없이 바꾸거나 지울 수 없어야 한다 |

수정·삭제는 `_own_transaction()` 한 곳을 거친다. 거절 응답이 두 가지인 것에 이유가 있다.

- **다른 그룹**의 거래 → **404**. 목록에 애초에 안 나오므로 존재를 숨긴다 (카테고리 소유권과 같은 방침)
- 같은 그룹 **다른 구성원**의 거래 → **403**. 목록에 이미 보이고 작성자 이름까지 표시되므로 숨길 것이 없다. 404 를 주면 "화면에 있는데 없다고 한다"가 되어 오히려 헷갈린다

> [!IMPORTANT]
> 거래 외의 자원에 쓰기 경로를 추가할 때도 같은 형태를 따른다 —
> **그룹으로 한 번, 작성자로 한 번.** 그룹만 확인하면 구성원끼리 서로의 기록을 덮어쓸 수 있다.

# 프론트엔드 쪽 인증

## 토큰이 두 군데 저장된다
`src/lib/api.ts`의 `setToken()`이 한 번에 처리한다.

| 저장소 | 용도 | 수명 |
|---|---|---|
| `localStorage` | API 호출 시 `Authorization: Bearer` | 명시적 삭제까지 |
| 쿠키 `token` | `proxy.ts`가 읽어 라우팅 가드 | **JWT 만료와 같은 시각** |

`document.cookie`로 심기 때문에 **HttpOnly가 될 수 없다.** XSS가 나면 토큰이 그대로 털린다. `SameSite=Lax`는 걸려 있고, HTTPS 로 열렸을 때는 `Secure`도 함께 붙인다.

## 만료는 한 출처에서 나온다

`POST /api/auth/login` 이 `expires_at`(토큰의 `exp` 그대로)을 함께 내려주고, `setToken()`이 그 값에서 쿠키 `max-age`를 계산한다. **쿠키와 JWT가 같은 값을 본다.**

예전에는 쿠키 수명이 30일 하드코딩이라 `TOKEN_EXPIRE_DAYS`를 줄이면 둘이 어긋났다. 쿠키는 살아 있고 JWT만 죽은 상태가 되어, `proxy.ts`는 통과시키고 → 화면은 열리고 → 모든 API 호출이 401이 되는데 아무도 그 사실을 말해주지 않았다. 사용자는 빈 목록과 "아직 내역이 없습니다"만 봤다.

## 만료를 세 겹으로 잡는다

| 겹 | 언제 걸리나 | 무엇을 하나 |
|---|---|---|
| 쿠키 `max-age` | 만료 시각이 지나면 | 브라우저가 쿠키를 스스로 지운다 → 로그인 화면 |
| `proxy.ts` | 페이지 진입 시 | 쿠키의 JWT `exp`를 읽어 만료면 `/login?reason=expired` 로 보내고 죽은 쿠키를 지운다 |
| `request()` | API 가 401 을 줄 때 | `clearToken()` 후 `/login?reason=expired` 로 보낸다 |

> [!IMPORTANT] `proxy.ts`는 서명을 검증하지 않는다
> `exp`만 읽는다. 여기서 하는 일은 **보안 경계가 아니라 화면 전환**이고, 실제 검증은
> API 가 매 요청에서 한다. 서명이 틀린 토큰은 proxy 를 통과하지만 데이터를 한 줄도 못 받고,
> 첫 401 에서 세 번째 겹이 로그인으로 돌려보낸다.

> [!NOTE] 로그인 요청의 401 은 세션 만료가 아니다
> 초대 코드가 틀렸다는 뜻이다. `request()`는 `/api/auth/login` 경로를 401 처리에서 **제외한다** —
> 안 그러면 코드를 잘못 친 것만으로 화면이 리다이렉트된다.

→ [#11](https://github.com/s2ngK/claude-asset-man/issues/11)

# 관리자 인증

관리자 API 는 **`X-Admin-Key` 원문 또는 `scope=admin` 토큰** 둘 다 받는다.
브라우저(`/admin`)는 토큰을, 스크립트·`curl` 은 키를 쓴다 → [관리자 화면](admin-console.md)

두 토큰은 같은 시크릿으로 서명하지만 **`scope` 로 갈린다.**

- `get_current_user` — `scope == "admin"` 이면 401. 관리자 토큰으로 사용자 API 를 못 쓴다
- `check_admin_auth` — `scope` 가 `admin` 이 아니면 통과 못 한다. 사용자 토큰으로 관리자 API 를 못 쓴다

관리자 토큰 수명은 `ADMIN_TOKEN_EXPIRE_MINUTES`(기본 60분)로, 사용자 토큰(30일)보다 훨씬
짧다. 이 토큰 하나로 모든 그룹을 만들고 볼 수 있기 때문이다.

## 그룹 관리자는 자기 그룹 밖으로 못 나간다

`scope=group_admin` 토큰은 `group_id` 를 함께 들고 있다. 권한 판단은 `AdminIdentity` 한
곳에 모아 뒀다 — 라우트마다 손으로 쓰면 **한 군데만 빠뜨려도 다른 그룹이 그대로 샌다.**

- `require_super()` — 그룹 생성·비활성화·복구·그룹 인증키 재발급
- `require_group(group_id)` — 구성원 추가, 초대 코드 재발급
- 목록 조회는 쿼리 자체를 좁힌다. `?group_id=` 로 남의 그룹을 지목해도 소용없다

## 비활성 그룹은 세션까지 끊는다

`get_current_user` 는 사용자를 찾은 뒤 **그룹이 살아 있는지도 본다.** 로그인만 막으면
최대 30일 살아 있는 토큰이 남기 때문이다. `resolve_admin` 도 그룹 관리자 토큰에 같은
검사를 한다 → [관리자 화면](admin-console.md)

키 비교는 `secrets.compare_digest` 로 한다.

# rate limit과 `Depends`의 함정

`@limiter.limit`을 건 라우트에서 인증 검사를 `Depends`로 분리하면 **rate limit이 전혀 카운트되지 않는다.** 브루트포스가 무제한이 된다.

FastAPI가 `Depends`를 엔드포인트 함수 본문보다 먼저 해석하기 때문이다. 인증이 거기서 실패하면 데코레이터가 감싼 함수 자체가 호출되지 않는다.

그래서 `admin.py`는 각 라우트 **본문 맨 위에서** 직접 호출한다.

```python
@router.post("/groups", status_code=201)
@limiter.limit("10/minute")
def create_group(request: Request, ..., x_admin_key: str = Header(...)):
    check_admin_key(x_admin_key)     # ← Depends가 아니라 본문에서
```

어색해 보여도 **의도된 형태다.** `dependencies.py`에 이유가 주석으로 남아 있고, `tests/test_admin.py`의 rate limit 테스트가 이걸 지키고 있다. 리팩터링하지 말 것 → [함정과 교훈](pitfalls.md)
