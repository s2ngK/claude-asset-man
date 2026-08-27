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
