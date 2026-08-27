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
- **비밀번호 변경이 없다.** 초대 코드가 유출되면 관리자가 새 사용자를 만드는 수밖에 없다
- **로그아웃은 클라이언트에서만 일어난다.** 토큰 폐기(revocation) 목록이 없어서, 발급된 JWT는 만료까지 유효하다
- **리프레시 토큰이 없다.** 30일 뒤 다시 초대 코드를 넣어야 한다
- `GET /api/admin/users`는 **모든 사용자의 초대 코드를 평문으로 반환한다.** 사실상 전 계정 비밀번호 목록이다. 관리자 키로 보호되고 rate limit도 걸려 있다

> [!CAUTION] 기본 시크릿으로도 서버가 그냥 뜬다
> `JWT_SECRET`, `ADMIN_KEY`는 값이 없으면 `"change-this-secret-in-production"` 같은 기본값으로 떨어지고 경고도 없다.
> 환경변수를 빠뜨린 채 배포하면 **공개된 문자열로 서명된 JWT**를 쓰게 되고 누구나 토큰을 위조할 수 있다.
> → [#12](https://github.com/s2ngK/claude-asset-man/issues/12) · [결함 목록](known-issues.md)

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

# 프론트엔드 쪽 인증

## 토큰이 두 군데 저장된다
`src/lib/api.ts`의 `setToken()`이 한 번에 처리한다.

| 저장소 | 용도 | 수명 |
|---|---|---|
| `localStorage` | API 호출 시 `Authorization: Bearer` | 명시적 삭제까지 |
| 쿠키 `token` | `proxy.ts`가 읽어 라우팅 가드 | `max-age` 30일 **하드코딩** |

`document.cookie`로 심기 때문에 **HttpOnly가 될 수 없다.** XSS가 나면 토큰이 그대로 털린다. `SameSite=Lax`는 걸려 있지만 `Secure` 플래그는 없다 — HTTPS 없이 배포하면 평문으로 흐른다.

## 만료가 어긋난다
- 쿠키 수명은 30일 하드코딩
- JWT 수명은 `TOKEN_EXPIRE_DAYS` 환경변수 (기본 30일)
- **이 환경변수를 줄이면 둘이 어긋난다.** 쿠키는 살아 있고 JWT는 죽은 상태가 된다

그러면 `proxy.ts`는 통과시키고 → 화면은 열리고 → 모든 API 호출이 401이 된다. 그런데 `request()`가 401을 **처리하지 않아서** 토큰도 안 지우고 로그인으로 보내지도 않는다. 사용자는 빈 화면과 "아직 내역이 없습니다"만 보게 된다.

→ [#11](https://github.com/s2ngK/claude-asset-man/issues/11) · [결함 목록](known-issues.md)

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
