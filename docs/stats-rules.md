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
