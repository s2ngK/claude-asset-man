# 통계 집계 규칙

← [그룹 가계부](README.md) · 관련 [엔드포인트별 규칙](api-rules.md) [데이터 모델](data-model.md)

무엇이 집계에 잡히고 무엇이 빠지는지. **숫자가 안 맞을 때 여기부터 본다.**

# 화면과 API의 대응

| 화면 | 무엇을 보여주나 | 어디서 오나 |
|---|---|---|
| `MainView` 상단 요약 | 이번 달 수입/지출/잔액 | **서버 아님.** 클라이언트 계산 |
| `StatsView` 총 지출 + 파이 | 카테고리별 지출 | `GET /stats/categories` |
| `StatsView` 6개월 추이 | 월별 수입/지출/잔액 | `GET /stats/trend` |
| `StatsView` 구성원별 | 멤버별 지출 | `GET /stats/members` |

## MainView 요약은 서버를 쓰지 않는다
`GET /stats/summary`가 있고 `api.ts`에 `getSummary()` 래퍼까지 있는데 **아무도 호출하지 않는다.**

대신 `MainView`가 이미 받아온 거래 목록을 `reduce`해서 직접 계산한다.

```
income  = 목록에서 type==='income'  합
expense = 목록에서 type==='expense' 합
balance = income - expense
```

지금은 그 달 거래를 **전부** 받아오므로 결과가 서버 계산과 같다.
⚠️ **페이지네이션을 넣는 순간 화면의 합계가 조용히 틀려진다.** → [#14](https://github.com/s2ngK/claude-asset-man/issues/14) · [결함 목록](known-issues.md)

# 집계 규칙

## 지출만 세는 것들
`GET /stats/categories`와 `GET /stats/members`는 **`type == 'expense'`만** 집계한다.

- 수입은 카테고리 분석에도, 구성원별 순위에도 나오지 않는다
- 의도된 동작이다 — "누가 얼마나 썼나"가 목적이므로
- `StatsView`가 "총 지출"이라고 이름 붙여 보여주는 것도 이 때문

## 수입까지 세는 것
`GET /stats/summary`와 `GET /stats/trend`는 income·expense를 **둘 다** 집계한다.

## `user_only` 플래그
- `/stats/summary`, `/stats/categories`에만 있다
- `StatsView`의 **내 통계 / 그룹 통계** 탭이 이걸 토글한다
- `/stats/trend`와 `/stats/members`에는 **없다** — 추이는 항상 그룹 전체다
  - 즉 "내 통계" 탭에서도 6개월 추이 그래프는 **그룹 전체 수치**를 보여준다

## 월 필터
전부 `date.startswith("YYYY-MM")` 방식이다.

- `date`가 문자열이라 가능한 방법 → [데이터 모델](data-model.md)
- ⚠️ **형식이 어긋난 `date`는 어느 달에도 안 잡힌다.** 목록에는 보이는데 통계에서만 사라진다

## 6개월 추이의 범위
- 이번 달을 포함해 **거꾸로 6개월**
- `date.today().replace(day=1)`에서 `relativedelta`로 계산하므로 월말 경계 문제가 없다
- 데이터가 없는 달도 `income: 0, expense: 0`으로 자리를 채워 반환한다 → 그래프가 끊기지 않는다

## 퍼센트 계산
```python
total = sum(...) or 1      # 0으로 나누기 방지
percentage = round(r.total / total * 100, 1)
```
- 분모가 **그 응답에 포함된 항목들의 합**이다. 전체 지출이 아니다
- `/stats/categories`는 지출만 담으므로 지출 대비 비율이 맞다
- 결과가 없으면 빈 배열이라 `or 1`이 실제로 쓰이는 경우는 없다

## 구성원별의 INNER JOIN
`/stats/members`는 `User`와 `Transaction`을 INNER JOIN 한다.

⚠️ **그 달에 지출이 없는 구성원은 목록에 아예 나오지 않는다.** 0원으로도 안 나온다.

# 집계에서 빠지는 행

집계는 `type == 'income'` 또는 `'expense'`인 행만 센다. 다른 값이 들어간 행은 목록에는
보이면서 합계에서만 사라진다 — 사용자에게는 **"목록엔 있는데 합계엔 없다"**로 나타나
원인을 찾기 매우 어렵다.

API 경계에서는 [#6](https://github.com/s2ngK/claude-asset-man/issues/6)으로 막혔다. `type`은 `Literal["income", "expense"]`,
`amount`는 양수, `date`는 `date`로 검증하므로 **REST를 거친 입력은 반드시 집계에 잡힌다**
(회귀 테스트: `test_valid_transaction_reaches_the_summary`).

여전히 빠질 수 있는 경로:
- **DB에 직접 쓴 행** — 마이그레이션, 수동 SQL, 시드 스크립트
- **이미 저장돼 있던 행** — 검증이 붙기 전 데이터. 필요하면 한 번 훑어야 한다

# 성능

`GET /stats/trend`가 **월마다 쿼리를 따로 날린다** (6개월 = 6회).

SQLite의 `strftime`으로 월을 뽑아 `GROUP BY` 한 번에 끝낼 수 있다. 현재 규모에선 체감되지 않지만, 통계 테스트를 붙일 때 같이 정리하면 좋다. → [#15](https://github.com/s2ngK/claude-asset-man/issues/15) · [결함 목록](known-issues.md)

# 테스트가 없다

`stats.py`는 **백엔드에서 가장 큰 파일(132줄)인데 테스트가 0개다.** 집계·정렬·퍼센트처럼 조용히 틀리기 쉬운 로직이 전부 여기 있는데도 그렇다.

`backend/tests/conftest.py`에 in-memory SQLite 픽스처가 이미 있으니 그대로 쓰면 된다. → [#13](https://github.com/s2ngK/claude-asset-man/issues/13) · [결함 목록](known-issues.md)

# 화면에 점유율을 함께 적는다

`GET /api/stats/categories` 는 `percentage` 를 이미 계산해서 내려준다. 화면은 그 값을
**도넛 가운데(최다 지출), 범례 각 항목, 조각 툴팁** 세 곳에 함께 적는다.

금액만 적으면 "식비가 전체의 얼마인가" 를 눈으로 가늠해야 한다. 구성원별 지출에는 원래부터
`%` 가 있었으므로 표현도 어긋나 있었다 → [#32](https://github.com/s2ngK/claude-asset-man/issues/32)

범례는 **상위 4개가 아니라 전부** 적는다. 잘라내면 나머지가 합쳐서 몇 %인지 알 수 없다.
카테고리는 많아야 예닐곱 개라 전부 적어도 길지 않다.

# 카테고리 색은 눈으로 고르지 않는다

시스템 카테고리 색은 **검증기를 통과시킨 값**이다 (`backend/app/seed.py`,
`src/lib/constants.ts` 양쪽에 같은 값이 있다).

| 검사 | 기준 |
|---|---|
| 명도 밴드 | 라이트 `L 0.43–0.77` · 다크 `L 0.48–0.67` |
| 채도 하한 | `>= 0.1` — 회색으로 읽히면 카테고리 색 구실을 못 한다 |
| 색맹 구분 | 인접 쌍 ΔE `>= 8` (OKLab ×100) |
| 정상 시야 구분 | 인접 쌍 ΔE `>= 15` |
| 표면 대비 | `>= 3:1` (미달이면 글자 라벨로 받쳐야 한다) |

그룹이 추가하는 카테고리도 이 목록에서 색을 받는다 — `backend/app/palette.py` 의
`CATEGORICAL_COLORS` 가 유일한 출처이고, `seed.py` 의 기본 카테고리 색도 여기서 나왔다.
**사용자는 색을 고르지 않는다** (→ [거래 등록·수정 흐름](flow-create-transaction.md)).

**색은 카테고리마다 하나만 저장된다.** 그래서 다크 밴드(`0.48–0.67`)가 라이트 밴드의
부분집합이라는 점을 이용해, **양쪽에 다 들어가는 값**으로 골랐다. 모드별로 색을 나눠 들려면
스키마에 열이 하나 더 필요한데 그건 지금 필요가 없다.

> [!WARNING] 색을 바꾸려면 검증기를 다시 돌린다
> 예전 값은 풀채도 웹 컬러라 `#33FF57`(교통) 1.31:1, `#33FFF5`(의료/건강) 1.22:1 로
> 흰 카드 위에서 거의 안 보였고 `기타`(`#808080`)는 채도가 0이었다. 보기에 선명한 색과
> 차트에서 읽히는 색은 다르다 → [#37](https://github.com/s2ngK/claude-asset-man/issues/37)

> [!NOTE] 그래도 색은 보조 수단이다
> 대비가 3:1 을 겨우 넘는 색이 있고(노랑 `#c98500` 2.99), 색맹 구분도 하한 근처다.
> 범례의 이름·금액·%와 툴팁이 그걸 글자로 받쳐준다.

## 기존 DB 는 마이그레이션으로 바뀐다

`seed_initial_data()` 는 카테고리가 하나라도 있으면 **통째로 건너뛴다.** 그래서 시드값만
고치면 이미 돌고 있는 설치에는 반영되지 않는다. 색 교체는 Alembic 마이그레이션
(`b7c41d0e93a5`)이 하고, **`group_id IS NOT NULL` 인 그룹 전용 카테고리는 건드리지 않는다** —
사용자가 고른 색이다.

# 월 합계의 출처는 서버 하나다

홈 화면 요약 카드(수입·지출·잔액)는 `GET /api/stats/summary` 가 낸 값을 그대로 쓴다.
받아온 목록을 `reduce` 하지 않는다.

지금은 한 달치를 통째로 받아오므로 둘의 결과가 같다. **페이지네이션을 넣는 순간**
목록에 있는 것만 더하게 되어 화면의 합계가 조용히 틀려진다 → [#14](https://github.com/s2ngK/claude-asset-man/issues/14)

거래를 만들거나 고치거나 지운 뒤에는 합계를 다시 받아온다. 목록은 낙관적으로 먼저 바꾸지만
(→ [삭제와 되돌리기](flow-delete-undo.md)) **합계는 서버가 낸 값만 믿는다.**

> [!NOTE] 필터 요약줄은 예외다
> 목록 위 `필터 결과 N건 · …` 은 **화면에 보이는 것**에 대한 이야기라 클라이언트가 센다
> (→ [목록 정렬과 필터](flow-list-sort-filter.md)). 그 달 전체 합계와는 다른 질문이다.

# 6개월 추이는 쿼리 한 번이다

`GET /api/stats/trend` 는 예전에 달마다 집계 쿼리를 따로 날려 **6번** 나갔다 (#15).
`date` 가 `"YYYY-MM-DD"` 문자열 컬럼이라 `substr(date, 1, 7)` 이 곧 월이므로, 그것으로
`GROUP BY` 하면 한 번에 끝난다.

거래가 없는 달은 결과에 아예 안 나온다. **6개월 틀을 채우는 일은 파이썬에서 한다** —
SQL 로 빈 달을 만들려면 달력 테이블이 필요한데 이 규모에서는 과투자다.
