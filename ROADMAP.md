# 로드맵

그룹 가계부 프로젝트의 작업 현황을 관리하는 파일입니다. 작업을 시작/완료할 때마다 이 파일을 갱신합니다.

전체 현황을 한눈에 보는 용도는 이 파일로, 논의가 필요하거나 커밋/PR과 연결하고 싶은 개별 작업은 GitHub Issue로 만듭니다(관련 Issue가 있으면 항목 뒤에 `(#N)`으로 표시).

## 진행 중

- (없음)

## 다음 작업 (백로그)

- [x] 유출됐던 Supabase Personal Access Token 재발급/폐기 확인 (git 히스토리에선 제거 완료, 토큰 자체 회전 필요) - 별도 작업으로 프로젝트 자체 폐기
- [x] `update-claude-md`, `change-claude` 스테일 브랜치 정리 여부 결정 (둘 다 main에 완전히 흡수된 상태) - 브랜치 정리
- [ ] 프론트엔드 화면 수가 늘어나면 서버 상태관리 라이브러리(react-query 등) 도입 검토

## 다음에 볼 만한 것

- [ ] `.env.local` 정리 — 더 이상 쓰지 않는 Supabase/Gemini 키가 남아 있고, 정작 필요한 `NEXT_PUBLIC_API_URL`이 없음 (기본값 `http://localhost:8000`으로 동작 중). gitignore 대상이라 저장소 유출은 아니지만 Gemini 키는 폐기 권장
- [ ] `middleware.ts` → `proxy.ts` 전환 — Next 16에서 `middleware` 파일 컨벤션 deprecated 경고 발생 중
- [ ] next-pwa가 webpack 설정을 주입해 Turbopack을 못 씀 (`dev`/`build` 모두 `--webpack` 고정 중). Turbopack 전환하려면 PWA 플러그인 대안 검토 필요

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
- [x] GitHub remote 연결 (public — private 생성이 안 되는 플랜)
- [x] `fix/admin-header-auth`, `docs/roadmap-file` 브랜치 처리 — 각각 PR #1, #2로 main에 머지 완료
- [x] `npm run lint` 정상화 — 원인은 Next 16에서 `next lint` 제거된 것(`next dev lint`로 해석되어 `./lint` 디렉터리를 찾음). `eslint .`로 교체하고, `public/`(next-pwa 생성물)·`references/`(프로토타입)를 lint 대상에서 제외, `src/` 실제 경고/에러 9건 전부 수정
- [x] 위 작업 중 발견한 선행 버그 수정 — `DEFAULT_CATEGORIES`에 `type`이 없어 거래 추가 모달의 카테고리 목록이 항상 비어 있었고, `TokenResponse` 타입이 실제 응답(`user_id`)과 어긋나 있었음. 둘 다 `npm run build`(tsc)를 실패시키던 원인
- [x] `npm run dev` 정상화 — next-pwa의 webpack 설정과 Next 16 기본 Turbopack이 충돌해 실행 불가였음, `build`와 동일하게 `--webpack` 고정
