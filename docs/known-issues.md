# 결함 목록

← [그룹 가계부](README.md)

[![미해결](https://img.shields.io/github/issues-search?query=repo%3As2ngK%2Fclaude-asset-man%20is%3Aopen%20label%3A%22%EC%BD%94%EB%93%9C%EB%A6%AC%EB%B7%B0%202026-08%22&label=%EB%AF%B8%ED%95%B4%EA%B2%B0&color=d73a4a&style=flat-square)](https://github.com/s2ngK/claude-asset-man/issues?q=is%3Aissue+is%3Aopen+label%3A%22코드리뷰+2026-08%22)
[![해결](https://img.shields.io/github/issues-search?query=repo%3As2ngK%2Fclaude-asset-man%20is%3Aclosed%20label%3A%22%EC%BD%94%EB%93%9C%EB%A6%AC%EB%B7%B0%202026-08%22&label=%ED%95%B4%EA%B2%B0&color=1f6b48&style=flat-square)](https://github.com/s2ngK/claude-asset-man/issues?q=is%3Aissue+is%3Aclosed+label%3A%22코드리뷰+2026-08%22)

> [!IMPORTANT]
> **상태는 이 문서가 갖고 있지 않다.** 아래 표의 상태 뱃지는 GitHub API를 그대로 읽는다 —
> 이슈가 닫히면 뱃지도 자동으로 바뀐다. 문서에 "해결됨"을 손으로 적어두면 고친 뒤에도
> 문서만 계속 옛말을 하게 되므로, 여기서는 **무엇이 발견됐는지와 어디를 봐야 하는지**만 남긴다.
>
> 원인 분석·수정 내역·논의는 각 이슈에 있다.

# 심각도 기준

데이터가 **조용히** 망가지는가를 기준으로 매겼다.

- 🔴 데이터 정합성 — 사용자가 모르는 사이 값이 틀어진다
- 🟠 보안 · 배포 — 노출되거나 배포가 성립하지 않는다
- 🔵 품질 — 지금 당장은 문제없지만 곧 문제가 된다

# 목록

발견일은 그 결함을 **확인한 날**이다. 아래 13건은 모두 2026-08-27 전체 코드 리뷰(`main` · b13e6ab)에서 한 번에 나왔다.

| 이슈 | 상태 | 심각도 | 발견일 | 내용 | 위치 | 관련 문서 |
|---|---|---|---|---|---|---|
| [#5](https://github.com/s2ngK/claude-asset-man/issues/5) | ![](https://img.shields.io/github/issues/detail/state/s2ngK/claude-asset-man/5?style=flat-square&label=) | 🔴 | 2026-08-27 | 거래 생성 시 카테고리의 그룹 소유권 미검증 | `routes/transactions.py` | [인증과 그룹 격리](auth-and-scoping.md) |
| [#6](https://github.com/s2ngK/claude-asset-man/issues/6) | ![](https://img.shields.io/github/issues/detail/state/s2ngK/claude-asset-man/6?style=flat-square&label=) | 🔴 | 2026-08-27 | `type`·`amount`·`date` 값 검증 전무 | `schemas.py` | [통계 집계 규칙](stats-rules.md) |
| [#7](https://github.com/s2ngK/claude-asset-man/issues/7) | ![](https://img.shields.io/github/issues/detail/state/s2ngK/claude-asset-man/7?style=flat-square&label=) | 🔴 | 2026-08-27 | 연속 삭제 시 먼저 지운 항목이 서버에 남음 | `MainView.tsx` | [삭제와 되돌리기](flow-delete-undo.md) |
| [#8](https://github.com/s2ngK/claude-asset-man/issues/8) | ![](https://img.shields.io/github/issues/detail/state/s2ngK/claude-asset-man/8?style=flat-square&label=) | 🟠 | 2026-08-27 | `docker compose up --build` 프론트 빌드 실패 | `Dockerfile.frontend` | [개발 환경 세팅](setup.md) |
| [#9](https://github.com/s2ngK/claude-asset-man/issues/9) | ![](https://img.shields.io/github/issues/detail/state/s2ngK/claude-asset-man/9?style=flat-square&label=) | 🟠 | 2026-08-27 | docker-compose의 `API_URL`이 무효 | `docker-compose.yml` | [함정과 교훈](pitfalls.md) |
| [#10](https://github.com/s2ngK/claude-asset-man/issues/10) | ![](https://img.shields.io/github/issues/detail/state/s2ngK/claude-asset-man/10?style=flat-square&label=) | 🟠 | 2026-08-27 | CORS 기본값 `*` + `allow_credentials` | `main.py` | [함정과 교훈](pitfalls.md) |
| [#11](https://github.com/s2ngK/claude-asset-man/issues/11) | ![](https://img.shields.io/github/issues/detail/state/s2ngK/claude-asset-man/11?style=flat-square&label=) | 🟠 | 2026-08-27 | 토큰 만료 시 화면은 열리고 데이터만 빔 | `api.ts`, `proxy.ts` | [인증과 그룹 격리](auth-and-scoping.md) |
| [#12](https://github.com/s2ngK/claude-asset-man/issues/12) | ![](https://img.shields.io/github/issues/detail/state/s2ngK/claude-asset-man/12?style=flat-square&label=) | 🟠 | 2026-08-27 | 기본 시크릿으로도 서버가 기동 | `dependencies.py` | [인증과 그룹 격리](auth-and-scoping.md) |
| [#13](https://github.com/s2ngK/claude-asset-man/issues/13) | ![](https://img.shields.io/github/issues/detail/state/s2ngK/claude-asset-man/13?style=flat-square&label=) | 🔵 | 2026-08-27 | `stats.py`·`categories.py` 테스트 0 | `backend/tests/` | [통계 집계 규칙](stats-rules.md) |
| [#14](https://github.com/s2ngK/claude-asset-man/issues/14) | ![](https://img.shields.io/github/issues/detail/state/s2ngK/claude-asset-man/14?style=flat-square&label=) | 🔵 | 2026-08-27 | 월 합계를 서버·클라이언트가 각자 계산 | `MainView.tsx` | [통계 집계 규칙](stats-rules.md) |
| [#15](https://github.com/s2ngK/claude-asset-man/issues/15) | ![](https://img.shields.io/github/issues/detail/state/s2ngK/claude-asset-man/15?style=flat-square&label=) | 🔵 | 2026-08-27 | 6개월 추이 N+1 쿼리 | `routes/stats.py` | [통계 집계 규칙](stats-rules.md) |
| [#16](https://github.com/s2ngK/claude-asset-man/issues/16) | ![](https://img.shields.io/github/issues/detail/state/s2ngK/claude-asset-man/16?style=flat-square&label=) | 🔵 | 2026-08-27 | 사용자 이름 하이드레이션 불일치 | `MainView.tsx`, `SettingsView.tsx` | |
| [#17](https://github.com/s2ngK/claude-asset-man/issues/17) | ![](https://img.shields.io/github/issues/detail/state/s2ngK/claude-asset-man/17?style=flat-square&label=) | 🔵 | 2026-08-27 | 카테고리를 이름으로 매칭 | `MainView.tsx`, `constants.ts` | [거래 등록 흐름](flow-create-transaction.md) |

> [!NOTE]
> 뱃지는 GitHub이 이미지를 프록시·캐시하므로 이슈를 닫은 직후 몇 분간 옛 상태로 보일 수 있다.
> 정확한 현재 상태는 [이슈 목록](https://github.com/s2ngK/claude-asset-man/issues?q=is%3Aissue+label%3A%22코드리뷰+2026-08%22)에서 본다.
>
> 옵시디언에서도 같은 뱃지가 뜬다 (외부 이미지 로드 필요).

# 2026-08-27 리뷰 시점 재현 기록

아래는 **리뷰 당시** 실제로 서버를 띄워 확인한 결과다. 그 시점의 사실이므로 수정 여부와 무관하게 그대로 둔다 — 무엇이 어떻게 잘못됐었는지가 남아야 같은 실수를 다시 안 한다. 나머지 항목은 코드 판독 근거.

## [#5](https://github.com/s2ngK/claude-asset-man/issues/5) — 타 그룹 카테고리 붙이기

```
그룹B 전용 카테고리 생성 (name='B그룹비밀카테고리')
A유저가 그 category_id로 거래 생성 → HTTP 201
응답 category_name = 'B그룹비밀카테고리'      ← 이름 유출
```

## [#6](https://github.com/s2ngK/claude-asset-man/issues/6) — 아무 값이나 저장됨

```
type='바나나'   → 201, 저장됨
  └ /stats/summary → {income:0, expense:9999}   ← 어디에도 안 잡힘
amount=-50000  → 201, 저장됨
date='내일'     → 201, 저장됨
```

## [#10](https://github.com/s2ngK/claude-asset-man/issues/10) — 임의 origin echo back

```
$ curl -X OPTIONS .../api/transactions -H "Origin: https://evil.example.com"

access-control-allow-origin: https://evil.example.com
access-control-allow-credentials: true
```

인증이 쿠키가 아니라 Bearer 헤더 방식이라 고전적 CSRF로 바로 이어지지는 않는다. **쿠키 인증으로 옮기는 순간 취약점이 된다.**

## [#8](https://github.com/s2ngK/claude-asset-man/issues/8) — standalone 출력이 없음

```
$ grep -n "output" next.config.ts        → (없음)
$ npm run build && ls -d .next/standalone → No such file or directory
```

Docker 데몬이 꺼져 있어 이미지 빌드 자체는 실행하지 못했다. COPY 원본이 존재하지 않는다는 사실까지만 확인.

# 권장 처리 순서

심각도와 비용을 함께 본 순서다. 완료 여부는 위 표의 뱃지로 확인한다.

1. [#6](https://github.com/s2ngK/claude-asset-man/issues/6) — Pydantic 스키마 한 파일로 구멍 3개가 한 번에 막힌다. 비용 최저, 효과 최대
2. [#5](https://github.com/s2ngK/claude-asset-man/issues/5) — 필터를 헬퍼로 빼서 목록 조회와 참조 검증이 같은 조건을 보게 한다
3. [#7](https://github.com/s2ngK/claude-asset-man/issues/7) — 사용자가 실제로 겪는 유일한 데이터 유실 경로
4. [#8](https://github.com/s2ngK/claude-asset-man/issues/8) + [#9](https://github.com/s2ngK/claude-asset-man/issues/9) — 둘 다 한 줄 수정. 고친 뒤 **실제로 `docker compose up --build`를 돌려 확인**하는 것까지가 작업
5. [#12](https://github.com/s2ngK/claude-asset-man/issues/12) + [#10](https://github.com/s2ngK/claude-asset-man/issues/10) — `lifespan`에서 한 번 검사하면 둘 다 처리. 외부 노출 계획이 있으면 순위를 올린다
6. [#11](https://github.com/s2ngK/claude-asset-man/issues/11) — `request()` 한 곳만 고치면 된다

# 라벨

- `데이터 정합성` — 값이 조용히 틀어지는 문제
- `보안·배포` — 노출되거나 배포가 성립하지 않는 문제
- `품질` — 지금은 괜찮지만 곧 문제가 되는 것
- `코드리뷰 2026-08` — 이 리뷰에서 나온 항목 전체

새 결함을 발견하면 이슈로 등록하고 위 표에 행을 추가한다. **상태는 적지 않는다** — 뱃지가 대신한다.
