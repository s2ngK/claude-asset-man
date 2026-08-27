# 그룹 가계부

초대 코드로 로그인하는 가족·모임용 가계부. 개인 서버에 올려 쓰는 것을 전제로 만들었다.

- 저장소: https://github.com/s2ngK/claude-asset-man (public)
- 기준: `main` · b13e6ab · 2026-08-27
- 프로덕션 코드 2,488줄 (백엔드 + 웹)

## 스택
- 웹: Next.js 16 · React 19 · Tailwind v4 · shadcn 계열 · PWA
- API: FastAPI · SQLAlchemy 2.0 · SQLite · Alembic
- 인증: 초대 코드 → JWT(HS256). 이메일·비밀번호·리프레시 토큰 없음
- 도구: uv · ruff · pytest / ESLint 9 flat config

# 문서 목록

## 구조
- [아키텍처 개요](architecture.md) — 요청이 흐르는 길. 여기부터 읽는다
- [데이터 모델](data-model.md) — 테이블 4개와 그 관계
- [인증과 그룹 격리](auth-and-scoping.md) — **가장 중요한 불변식**. 새 엔드포인트 만들 때 반드시 볼 것

## API
- [API 문서 읽는 법](api-docs.md) — 자동 생성 문서를 쓰는 법, 그리고 그게 말해주지 않는 것
- [엔드포인트별 규칙](api-rules.md) — OpenAPI가 표현 못 하는 의미론

## 동작
- [거래 등록·수정 흐름](flow-create-transaction.md) — 이름 기반 카테고리 매칭이라는 함정
- [목록 정렬과 필터](flow-list-sort-filter.md) — 전부 클라이언트에서. `created_at` 이 2차 정렬 키인 이유
- [삭제와 되돌리기](flow-delete-undo.md) — 즉시 삭제 + 재생성 방식 되돌리기
- [통계 집계 규칙](stats-rules.md) — 무엇이 집계에 잡히고 무엇이 빠지는가

## 운영
- [개발 환경 세팅](setup.md) — 클론부터 로그인까지
- [함정과 교훈](pitfalls.md) — 이미 한 번씩 당한 것들

## 현황
- [결함 목록](known-issues.md) — 리뷰에서 확인된 13건. **상태는 GitHub 이슈에서 읽어오므로 손으로 고칠 필요가 없다**

# 이 프로젝트의 원칙

핵심 기능부터 만들고 하나씩 올린다. **목표 대비 처음부터 과투자하지 않는다.**

- 원래 구상에 있던 영수증 OCR과 React Native 앱은 "과투자" 판단으로 제거됐다. 되살리자는 제안보다 지금 있는 것을 단단하게 만드는 쪽이 우선이다
- 같은 이유로 **스키마에 미래를 위한 빈 자리를 미리 만들지 않는다**
- 무엇이 일부러 보류인지는 저장소 `ROADMAP.md`에 있다

# 무엇을 어디에 쓰는가

| 성격 | 두는 곳 |
|---|---|
| 이게 어떻게 동작하는가 (구조·규칙·동작) | **이 `docs/` 폴더** |
| 무엇을 바꿔야 하는가 (결함·작업) | GitHub Issue |
| 전체 현황 한눈에 | 저장소 루트 `ROADMAP.md` |
| 엔드포인트·스키마 명세 | 안 쓴다. FastAPI가 `/docs`로 자동 생성 |
| Claude Code용 작업 지침 | 저장소 루트 `CLAUDE.md` |

`ROADMAP.md`에 이미 같은 규칙이 적혀 있다 — "논의가 필요하거나 커밋/PR과 연결하고 싶은 개별 작업은 GitHub Issue로 만듭니다".

> [!IMPORTANT] 코드를 바꾸면 이 문서도 같은 PR에서 고친다
> 문서를 저장소 안에 두는 이유가 이것이다. 동작이 바뀌는 PR은 여기 해당 문서도 함께 고쳐야
> 리뷰에서 드러난다. 문서가 코드와 떨어져 있으면 조용히 낡는다.
>
> 특히 다음을 바꿀 때는 짝이 되는 문서를 확인할 것:
>
> | 바꾼 것 | 같이 볼 문서 |
> |---|---|
> | `app/models.py`, 마이그레이션 | [데이터 모델](data-model.md) |
> | `dependencies.py`, 인증·그룹 필터 | [인증과 그룹 격리](auth-and-scoping.md) |
> | `routes/` 의 동작·에러 응답 | [엔드포인트별 규칙](api-rules.md) |
> | `routes/stats.py`, 집계 방식 | [통계 집계 규칙](stats-rules.md) |
> | 거래 등록·삭제 UI 로직 | [거래 등록 흐름](flow-create-transaction.md), [삭제와 되돌리기](flow-delete-undo.md) |
> | 빌드·실행 명령, 환경변수 | [개발 환경 세팅](setup.md) |

## 옵시디언에서 보기

이 `docs/` 폴더를 옵시디언 볼트로 직접 열 수 있다 — **Open folder as vault**로 지정하면 된다.
문서 간 링크가 위키링크가 아니라 표준 마크다운 상대 경로라서 옵시디언과 GitHub 양쪽에서 모두 동작한다.
mermaid 다이어그램도 양쪽 다 렌더된다.

볼트 설정 파일(`.obsidian/`)은 gitignore 처리돼 있으므로 개인 설정은 커밋되지 않는다.
