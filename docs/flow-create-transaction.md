# 거래 등록·수정 흐름

← [그룹 가계부](README.md) · 관련 [목록 정렬과 필터](flow-list-sort-filter.md) [엔드포인트별 규칙](api-rules.md) [데이터 모델](data-model.md)

거래 하나가 저장될 때까지의 경로. **이름 기반 카테고리 매칭**이라는 함정이 여기 있다.
추가와 수정은 **같은 모달·같은 경로**를 쓴다.

# 흐름

```mermaid
sequenceDiagram
    participant M as AddEntryModal
    participant V as MainView
    participant A as api.ts
    participant S as 백엔드

    M->>M: DEFAULT_CATEGORIES에서<br/>type으로 필터해 select 구성
    M->>V: onSave(amount, 카테고리 "이름", desc, type, date)
    V->>A: getCategories()
    A->>S: GET /api/categories
    S-->>V: 서버 카테고리 목록 (id 포함)
    V->>V: name + type이 같은 것을 찾아 id 획득
    alt 추가 (editing === null)
        V->>A: createTransaction({category_id, ...})
        A->>S: POST /api/transactions
        S-->>V: 201
    else 수정 (editing !== null)
        V->>A: updateTransaction(id, {category_id, ...})
        A->>S: PUT /api/transactions/{id}
        S-->>V: 200
    end
    V->>V: fetchTransactions() 재조회
```

`getCategories()` 는 `MainView` 가 **마운트 때 한 번 받아 state 에 들고 있다.** 저장할 때는
그 목록을 쓰고, 비어 있을 때만 그 자리에서 받아온다.

# 추가와 수정은 같은 모달이다

`AddEntryModal` 에 `initial` 을 주면 **수정 모드**가 된다. 폼이 그 값으로 채워지고 제목이
"내역 수정" 으로 바뀐다. 모달은 그 이상을 모른다 — **만들기냐 고치기냐의 판단은 `MainView`**
가 `editing` 상태로 한다. 모달은 값만 모아 `onSave` 로 돌려준다.

목록에서 항목을 **그냥 누르면**(드래그 아님) 수정이 열린다. 단 **자기가 쓴 것만** 열린다 —
남의 내역은 `onEdit` 을 아예 넘기지 않는다. 서버가 403 을 주므로
(→ [인증과 그룹 격리](auth-and-scoping.md)) 열어봐야 저장에서 막힌다.

> [!NOTE]
> 수정해도 `created_at` 은 그대로다. 서버가 그 컬럼을 건드리지 않는다.
> 목록 정렬이 `created_at` 을 쓰므로(→ [목록 정렬과 필터](flow-list-sort-filter.md))
> **금액만 고친 항목이 맨 위로 튀어오르지 않는다.**

## 금액을 비우면 원래 값이 placeholder 로 남는다

수정 중에 `C` 나 백스페이스로 금액을 다 지우면 화면이 `0` 이 되지 않는다. **원래 금액이
흐리게 남고** "비워두면 원래 금액이 그대로 저장됩니다" 라고 알려준다. 그대로 저장하면
원래 값이 유지된다.

`0` 으로 두는 선택지는 애초에 없다 — 서버 스키마가 `amount = Field(gt=0)` 이라 0 은 422 다.
그래서 금액이 0 인 동안에는 **[완료] 를 비활성으로** 둔다. 눌렀다가 알 수 없는 에러를 보는
것보다 낫다.

# 키패드

계산기 배치를 따른다. 숫자는 전화기가 아니라 **계산기 순서**(아래로 갈수록 작아짐)로 놓고,
오른쪽 열은 위에서부터 **지우기 → 연산자 → 확정**으로 내려간다.

```
7   8   9   ⌫
4   5   6   +
1   2   3   −
0   00  C   완료
```

## +/- 는 계산기다

영수증 두 장을 합치거나 더치페이를 나눌 때 쓰라고 둔 것이다.

- `+` / `-` 를 누르면 지금까지의 값이 **확정되고**(`pending`) 키패드는 다음 피연산자를 받는다
- 진행 중인 식은 금액 위에 작게 뜬다 — `12,000 +` → `12,000 + 3,500`
- 큰 숫자는 항상 **지금 저장될 값**이다 (`12,000 + 3,500` 이면 `15,500원`)
- 연속으로 이어진다 — `15,500 - 500` 처럼 앞 결과를 물고 간다
- **[완료] 는 남은 계산을 자동으로 정산한다.** `=` 를 따로 누르지 않아도 된다
- `C` 는 진행 중인 식까지 통째로 지운다 (백스페이스는 현재 피연산자만)
- 수정 모드의 placeholder 상태에서 `+` 를 누르면 **원래 금액에서 시작한다.** 0 에서
  시작하면 쓸모가 없다

### × ÷ 는 왜 없는가

칸이 없어서만은 아니다. 이건 **왼쪽에서 오른쪽으로 그때그때 접는 계산기**라 연산자 우선순위가
없다. `+` 와 `×` 가 섞이면 `12,000 + 3 × 4,500` 을 사람은 `25,500` 으로 읽는데 이 계산기는
`67,500` 을 낸다 — 틀린 값을 조용히 저장하게 된다. 우선순위를 넣으려면 식 전체를 들고 있다가
파싱해야 하고, 그건 가계부 입력창이 감당할 물건이 아니다.

곱셈이 정말 필요해지면 그때는 **키 하나를 더 끼워 넣는 게 아니라** 우선순위까지 갖춘 입력기를
따로 만드는 쪽이 맞다.

> [!NOTE]
> 예전에는 `+`/`-` 가 **아무 동작도 안 하는 것처럼 보였지만 실제로는 입력 문자열에
> 그대로 섞여 들어갔다.** `handleKeyPress` 가 숫자와 같은 분기로 떨어져 `'12000' + '+'`
> 가 됐고, 표시할 때 숫자만 걸러내서 눈에 안 띄었을 뿐이다. 이어서 숫자를 누르면
> `'12000+5'` 가 되어 `120005` 로 읽혔다.

## 종류를 바꾸면 카테고리도 따라간다

카테고리 select 는 `type` 으로 갈린다. 지출에서 `식비` 를 고른 채 수입으로 바꾸면 `식비` 는
새 목록에 없다 — `<select>` 는 첫 항목(`급여`)을 **보여주지만** state 는 `식비` 를 들고 있다.
그대로 저장하면 화면과 다른 카테고리가 붙는다. 그래서 종류를 바꿀 때 현재 선택이 새 목록에
없으면 첫 항목으로 맞춘다.

# 핵심: 모달은 이름만 넘긴다

`AddEntryModal`은 `category_id`를 모른다. `src/lib/constants.ts`의 `DEFAULT_CATEGORIES`로 select를 그리기 때문에 **로컬 상수의 이름 문자열**만 갖고 있다.

그래서 `MainView.handleSaveEntry`가 저장할 때마다:
1. 마운트 때 받아둔 **서버 카테고리 목록**을 쓴다 (비어 있으면 그 자리에서 `getCategories()`)
2. `name`과 `type`이 모두 일치하는 것을 찾는다
3. 못 찾으면 `name`만으로 한 번 더 찾는다 (fallback)
4. 그래도 없으면 에러

> [!WARNING] 두 파일이 조용히 결합돼 있다
> `src/lib/constants.ts`의 `DEFAULT_CATEGORIES`와 `backend/app/seed.py`의 시딩 목록이
> **이름·타입이 정확히 일치해야만** 저장이 된다. 한쪽만 고치면 즉시 깨진다.
> 코드 어디에도 이 결합을 강제하는 장치가 없다.

## 실제로 터졌던 사례
프론트 `DEFAULT_CATEGORIES`에 `type` 필드 자체가 없던 시기가 있었다. 그래서
`DEFAULT_CATEGORIES.filter(c => c.type === type)`가 **항상 빈 배열**을 반환했고,
거래 추가 모달의 카테고리 select가 통째로 비어 있었다. 타입 에러로도 잡혔지만
`npm run build`가 애초에 깨져 있어서 한동안 아무도 몰랐다.

지금은 `type`이 들어갔고 양쪽 10개가 일치하는 것을 실제 서버로 확인했다.

## 왜 `기타`가 두 개인가
시스템 카테고리에 `기타`가 **expense와 income 양쪽에** 있다 → [데이터 모델](data-model.md)

그래서 이름만으로 찾으면 안 되고 반드시 `name + type`이어야 한다. 3번의 fallback(이름만으로 재검색)은 이 경우 잘못된 것을 집을 수 있다.

# 서버 쪽에서 일어나는 일

`POST /api/transactions`:
- `group_id`, `user_id`는 **JWT에서 채운다.** 본문에 넣어도 무시된다
- 카테고리 존재 확인 → 없으면 404
- 저장 후 `joinedload`로 카테고리·사용자를 붙여 평평한 응답을 만든다

검증되는 것:
- **카테고리 소유권** — `visible_categories()` 를 통과해야 한다. 시스템 기본값이거나 자기 그룹 전용이어야 하며, 아니면 404 ([#5](https://github.com/s2ngK/claude-asset-man/issues/5))
- **`type`·`amount`·`date` 값** — Pydantic 스키마에서 막는다 ([#6](https://github.com/s2ngK/claude-asset-man/issues/6))

# 저장 후

`await fetchTransactions()`로 **목록을 통째로 다시 받아온다.**

- 낙관적 업데이트를 하지 않는다 (삭제와는 반대 → [삭제와 되돌리기](flow-delete-undo.md))
- 그래서 저장이 느리게 느껴질 수 있지만 화면과 서버가 어긋나지 않는다
- 실패하면 `alert()`로 메시지를 띄운다

# 개선한다면

1. **모달이 `category_id`를 넘기게 한다.** `MainView` 가 목록을 캐시하면서 저장할 때마다
   나가던 요청은 없앴지만, **`constants.ts` ↔ `seed.py` 이름 결합은 그대로 남아 있다.**
   모달이 서버 카테고리를 직접 받아 id 를 넘기면 그 결합이 끊어진다
2. `DEFAULT_CATEGORIES`는 서버 응답이 오기 전 **초기 렌더용 폴백**으로만 남긴다

→ [#17](https://github.com/s2ngK/claude-asset-man/issues/17) · [결함 목록](known-issues.md)
