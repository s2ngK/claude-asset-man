# 로드맵

그룹 가계부 프로젝트의 작업 현황을 관리하는 파일입니다. 작업을 시작/완료할 때마다 이 파일을 갱신합니다.

전체 현황을 한눈에 보는 용도는 이 파일로, 논의가 필요하거나 커밋/PR과 연결하고 싶은 개별 작업은 GitHub Issue로 만듭니다(관련 Issue가 있으면 항목 뒤에 `(#N)`으로 표시).

## 진행 중

- [ ] `fix/admin-header-auth` 브랜치 main 머지 여부 확인 — admin API를 `X-Admin-Key` 헤더 기반으로 전환하고 rate limiting 추가한 작업

## 다음 작업 (백로그)

- [ ] `update-claude-md`, `change-claude` 스테일 브랜치 정리 여부 결정 (둘 다 main에 완전히 흡수된 상태)
- [ ] 프론트엔드 화면 수가 늘어나면 서버 상태관리 라이브러리(react-query 등) 도입 검토
- [ ] `npm run lint` 실행 시 `Invalid project directory provided` 에러 원인 조사

## 보류 (지금은 손대지 않음)

- [ ] AI OCR/문자 자동 추출 기능 재도입 — 프로젝트가 더 구체화·안정화되면 재검토
- [ ] React Native 모바일 앱 재도입 — 위와 동일하게 추후 재검토
- [ ] CI(.github/workflows) 구축, 프론트엔드 테스트 도입 — 현재 규모에선 과투자로 판단, 필요해지면 진행

## 완료

- [x] Supabase/Gemini 제거, FastAPI + SQLite 백엔드로 전환, 초대 코드 기반 JWT 인증
- [x] React Native 모바일 앱 제거, 웹 단일 서비스로 정리
- [x] Alembic 도입 — `create_all()` 대신 마이그레이션으로 스키마 관리
- [x] 백엔드 개발 환경을 uv + ruff로 전환
- [x] pytest 테스트 스위트 추가 (인증, 거래 CRUD, 그룹 스코핑, rate limit)
- [x] 로그인(`/api/auth/login`) rate limiting 추가
- [x] README 폴더 구조 정리
