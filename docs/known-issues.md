# 결함 목록

← [그룹 가계부](README.md)

2026-08-27 코드 리뷰(`main` · b13e6ab)에서 확인된 13건.

> [!NOTE] 이 목록의 성격
> 여기는 **인덱스이자 스냅샷**이다. 각 건의 진행 상태는 GitHub Issue에서 관리한다.
> 결함 상세를 이 볼트에 길게 적으면, 고친 뒤에도 문서는 계속 "깨져 있음"이라고 말하게 된다.
> 결함이 드러낸 **규칙**은 각 동작 문서에 남기고, **고칠 일**은 이슈로 뺀다.

# 심각도 기준
데이터가 **조용히** 망가지는가를 기준으로 매겼다.

- 🔴 데이터 정합성 — 사용자가 모르는 사이 값이 틀어진다
- 🟠 보안 · 배포 — 노출되거나 배포가 성립하지 않는다
- 🔵 품질 — 지금 당장은 문제없지만 곧 문제가 된다

# 목록

| # | 심각도 | 내용 | 위치 | 관련 문서 |
|---|---|---|---|---|
| 01 | 🔴 | 거래 생성 시 **카테고리의 그룹 소유권 미검증** | `routes/transactions.py` | [인증과 그룹 격리](auth-and-scoping.md) |
| 02 | 🔴 | `type`·`amount`·`date` **값 검증 전무** | `schemas.py` | [통계 집계 규칙](stats-rules.md) |
| 03 | 🔴 | 연속 삭제 시 **먼저 지운 항목이 서버에 남음** | `MainView.tsx` | [삭제와 되돌리기](flow-delete-undo.md) |
| 04 | 🟠 | `docker compose up --build` **프론트 빌드 실패** | `Dockerfile.frontend` | [개발 환경 세팅](setup.md) |
| 05 | 🟠 | docker-compose의 `API_URL`이 **무효** | `docker-compose.yml` | [함정과 교훈](pitfalls.md) |
| 06 | 🟠 | CORS 기본값 `*` + `allow_credentials` | `main.py` | [함정과 교훈](pitfalls.md) |
| 07 | 🟠 | 토큰 만료 시 **화면은 열리고 데이터만 빔** | `api.ts`, `proxy.ts` | [인증과 그룹 격리](auth-and-scoping.md) |
| 08 | 🟠 | **기본 시크릿으로도 서버가 기동** | `dependencies.py` | [인증과 그룹 격리](auth-and-scoping.md) |
| 09 | 🔵 | `stats.py`·`categories.py` **테스트 0** | `backend/tests/` | [통계 집계 규칙](stats-rules.md) |
| 10 | 🔵 | 월 합계를 **서버·클라이언트가 각자 계산** | `MainView.tsx` | [통계 집계 규칙](stats-rules.md) |
| 11 | 🔵 | 6개월 추이 **N+1 쿼리** | `routes/stats.py` | [통계 집계 규칙](stats-rules.md) |
| 12 | 🔵 | 사용자 이름 **하이드레이션 불일치** | `MainView.tsx`, `SettingsView.tsx` | |
| 13 | 🔵 | 카테고리를 **이름으로 매칭** | `MainView.tsx`, `constants.ts` | [거래 등록 흐름](flow-create-transaction.md) |

# 재현된 것

01 · 02 · 06은 실제로 서버를 띄워 확인했다. 나머지는 코드 판독 근거.

## 01 — 타 그룹 카테고리 붙이기
```
그룹B 전용 카테고리 생성 (name='B그룹비밀카테고리')
A유저가 그 category_id로 거래 생성 → HTTP 201
응답 category_name = 'B그룹비밀카테고리'
```
지금은 모든 카테고리가 시스템 기본값이라 실질 피해가 없다. **그룹 전용 카테고리 기능을 붙이는 순간 실제 유출이 된다.**

## 02 — 아무 값이나 저장됨
```
type='바나나'   → 201, 저장됨
  └ /stats/summary → {income:0, expense:9999}   ← 어디에도 안 잡힘
amount=-50000  → 201, 저장됨
date='내일'     → 201, 저장됨
```

## 06 — 임의 origin echo back
```
$ curl -X OPTIONS .../api/transactions -H "Origin: https://evil.example.com"

access-control-allow-origin: https://evil.example.com
access-control-allow-credentials: true
```
인증이 쿠키가 아니라 Bearer 헤더 방식이라 고전적 CSRF로 바로 이어지지는 않는다. **쿠키 인증으로 옮기는 순간 취약점이 된다.**

## 04 — standalone 출력이 없음
```
$ grep -n "output" next.config.ts        → (없음)
$ npm run build && ls -d .next/standalone → No such file or directory
```
Docker 데몬이 꺼져 있어 이미지 빌드 자체는 실행하지 못했다. COPY 원본이 존재하지 않는다는 사실까지만 확인.

# 권장 처리 순서

1. **02** — Pydantic 스키마 한 파일로 구멍 3개가 한 번에 막힌다. 비용 최저, 효과 최대. 회귀 테스트를 같이 넣으면 09의 첫 삽도 된다
2. **01** — `categories.py`의 필터 조건을 헬퍼로 빼서 재사용
3. **03** — 사용자가 실제로 겪는 유일한 데이터 유실 경로
4. **04 + 05** — 둘 다 한 줄 수정. 고친 뒤 **실제로 `docker compose up --build`를 돌려 확인**하는 것까지가 작업
5. **08 + 06** — `lifespan`에서 한 번 검사하면 둘 다 처리. 외부 노출 계획이 있으면 순위를 올린다
6. **07** — `request()` 한 곳만 고치면 된다

# 이슈로 옮기기

아직 GitHub Issue를 만들지 않았다. `ROADMAP.md`에 적힌 규칙:

> 전체 현황을 한눈에 보는 용도는 이 파일로, 논의가 필요하거나 커밋/PR과 연결하고 싶은 개별 작업은 GitHub Issue로 만듭니다(관련 Issue가 있으면 항목 뒤에 `(#N)`으로 표시).

이슈를 만들면 위 표의 각 행 뒤에 `(#N)`을 달아 연결한다.
