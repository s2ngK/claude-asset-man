# Project: AI Group Ledger (우리 그룹 AI 가계부)

## 1. Project Overview
- **Goal**: 스마트폰 카메라로 영수증을 찍거나 내장 계산기로 빠르게 내역을 입력하여, 그룹의 수입과 지출 흐름을 한눈에 파악하는 PWA 웹 애플리케이션.
- **Target Audience**: 간편하게 가계부를 작성하고 월별 수입/지출/잔액 추이를 확인하고 구성원들의 통계도 같이 비교/합계하여 확인하고자 하는 사용자.
- **Core Value**: "직접 입력하거나 영수증 촬영으로 편하게 간단하게 입력하고 통계를 확인할 수 있다"

## 2. Tech Stack & Environment
- **Framework**: Next.js 14+ (App Router, TypeScript)
- **Styling**: Tailwind CSS, Shadcn UI
- **Charts**: Recharts (for data visualization)
- **Backend/DB**: Supabase (Auth, Postgres DB, Storage, RLS)
- **AI Provider**: Google Gemini 1.5 Flash (via Gemini API) for OCR & parsing
- **Deployment**: Vercel (Recommended)
- **Platform**: Mobile-first Web (PWA supported)

## 3. Database Schema (Supabase)

### 1. `groups` Table (New)
*그룹 정보를 관리하고 초대 코드를 검증하는 테이블*
- `id` (UUID, PK): 그룹 고유 키
- `name` (Text): 그룹 이름 (예: "행복한 우리집")
- `invite_code` (Text, Unique): 12자리 초대 코드 (Index)
- `created_at` (Timestamp)

### 2. `categories` Table (New)
*수입/지출 카테고리 항목을 정의하는 테이블 (시스템 기본 + 그룹별 커스텀)*
- `id` (UUID, PK)
- `group_id` (UUID, FK, Nullable):
    - NULL이면 "시스템 기본 카테고리" (모든 유저에게 보임)
    - 값이 있으면 "해당 그룹 전용 카테고리"
- `type` (Text): 'income' | 'expense'
- `name` (Text): 카테고리명 (식비, 교통, 급여 등)
- `icon` (Text): 이모지 또는 아이콘 식별자 (UI용)
- `color` (Text): Hex Color Code (차트용, 예: #FF5733)
- `is_default` (Boolean): 시스템 기본값 여부

### 3. `profiles` Table (Updated)
*사용자 정보 및 소속 그룹 매핑*
- `id` (UUID, PK): References auth.users
- `group_id` (UUID, FK, Nullable): References groups.id
    - 가입 직후엔 NULL, 그룹 생성/참여 후 값 할당
- `full_name` (Text): 표시 이름
- `avatar_url` (Text)

### 4. `transactions` Table (Updated)
*실제 가계부 내역*
- `id` (UUID, PK)
- `group_id` (UUID, FK): References groups.id (데이터 격리용)
- `user_id` (UUID, FK): References auth.users (작성자 통계용)
- `category_id` (UUID, FK): References categories.id **(Link to Category)**
- `type` (Text): 'income' | 'expense' (De-normalized for easy filtering)
- `amount` (Integer): 금액
- `description` (Text): 상세 내용
- `date` (Date): 거래 일시
- `image_url` (Text): 영수증 이미지
- `created_at` (Timestamp)

## 4. Key Features & Requirements

### Phase 1: Authentication & Onboarding
1. **User Sign Up/In**: Supabase Auth.
2. **Account Management [New]**:
   - **User Withdrawal**: 사용자가 탈퇴 시 `profiles` 및 해당 사용자가 작성한 `transactions` 데이터 처리 (Cascade 삭제 또는 익명화).
3. **Group Connection (Security Enhanced)**:
...
### Phase 2: Transaction Management (Input & Edit)
1. **Input Type Selection**: '직접 입력' vs '영수증 스캔'.
2. **Category Management [New]**:
   - 그룹 멤버는 본인 그룹 전용 카테고리를 추가/수정/삭제 가능.
   - 시스템 기본 카테고리는 수정 불가능, 조회만 가능.
...
2. **Custom Number Pad (Calculator)**:
   - 시스템 키보드 대체, 사칙연산 지원.
   - 구성: 금액/카테고리/날짜/내용/키패드 통합 UI.
3. **Receipt Scan (AI) [Updated]**:
   - 분석 방식: 클라이언트에서 이미지를 Base64로 변환하여 Gemini API에 직접 전달 (스토리지 업로드 없이 즉시 분석).
   - 프로세스: 이미지 선택 -> Base64 변환 -> Gemini API 분석 -> JSON 파싱 -> 입력 폼 자동 채우기.
   - **선택적 업로드 (Future Implementation)**: 사용자가 증빙을 위해 사진을 보관하고 싶을 때만 선택적으로 Supabase Storage에 업로드하여 `image_url`을 저장. (MVP 단계에서는 OCR 분석에 집중), 이미지 용량 최적화 필요함.
4. **CRUD**: 내역 생성/읽기/수정/삭제.

### Phase 3: Dashboard & UX
1. **Home List**: 월별 내역 리스트 (최신순).
2. **Undo Delete**: 삭제 시 토스트 메시지 노출 및 복구 기능.

### Phase 4: Analytics (Stats with Tabs) **[Updated]**
1. **View Mode Tabs**: 상단에 **[ 내 통계 | 그룹 통계 ]** 탭 스위처 배치.
   - **내 통계**: `user_id`가 본인인 내역만 집계.
   - **그룹 통계**: 같은 `group_id`를 가진 모든 내역 집계.
2. **Filters**: 년/월 선택기 (탭 전환 시에도 유지).
3. **Charts (Per Tab Context)**:
   - **Summary**: 총 수입/지출/잔액 카드.
   - **Trend**: 최근 6개월 추이 (Combo Chart).
   - **Category**: 카테고리별 비중 (Donut Chart).
4. **Member Breakdown (Only in Group Tab)**:
   - 그룹 내 구성원별 지출 랭킹 및 기여도 시각화.

### Phase 5: PWA
1. **Manifest**: 홈 화면 아이콘, 스플래시 스크린.
2. **Mobile UX**: `user-scalable=no`, 터치 친화적 UI.

## 5. UI/UX Guidelines
- **General**: 모바일 뷰포트 최적화.
- **Stats Screen Layout**:
  - Top: [년/월 선택]
  - Sub-Top: [내 통계 / 그룹 통계] 탭 (Segmented Control).
  - Content: 선택된 탭에 따라 그래프 및 리스트 데이터 리렌더링.
- **Security**: 초대 코드는 복사하기(Copy to Clipboard) 버튼 제공.