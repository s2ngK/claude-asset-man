# Project: AI Group Ledger (Mobile App)

## 1. Project Overview
- **Goal**: 스마트폰 카메라로 영수증을 찍거나 내장 계산기로 빠르게 내역을 입력하여, 그룹의 수입과 지출 흐름을 한눈에 파악하는 모바일 애플리케이션 (iOS/Android).
- **Target Audience**: 간편하게 가계부를 작성하고 월별 수입/지출/잔액 추이를 확인하고 구성원들의 통계도 같이 비교/합계하여 확인하고자 하는 사용자.
- **Core Value**: "언제 어디서나 쉽고 빠르게 가계부를 작성하고, 우리 그룹의 재정 상태를 한눈에 파악한다."

## 2. Tech Stack & Environment
- **Framework**: React Native (Expo SDK 52+)
- **Navigation**: Expo Router (File-based routing)
- **Language**: TypeScript
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **Icons**: Lucide React Native
- **Backend/DB**: Supabase (Auth, Postgres DB, RPC Functions for Aggregation)
- **State Management**: React Hooks (useState, useEffect, useFocusEffect) & Supabase Realtime (optional)
- **AI Provider**: Google Gemini 1.5 Flash (via Gemini API) for Receipt OCR & Text Parsing
- **Storage**: Expo Secure Store (Auth Tokens), Supabase Storage (Optional for images)
- **Platform**: iOS, Android (via Expo Go or Native Build)

## 3. Database Schema (Supabase)

The schema remains consistent with the original web project but leverages SQL functions for performance.

### Tables
1.  **`groups`**: Manages group info and invite codes.
2.  **`categories`**: Defines income/expense categories (System defaults + Group custom).
3.  **`profiles`**: User information linked to `auth.users`, including `group_id`.
4.  **`transactions`**: The core ledger data.
    - **FK Update**: `user_id` references `public.profiles(id)` for better join performance.

### RPC Functions (Server-Side Optimization)
To minimize data transfer and client-side calculation load, the following SQL functions are used:
- `get_monthly_category_stats`: Aggregates expenses by category for a given period.
- `get_monthly_member_stats`: Calculates total spending per member.
- `get_monthly_trend`: Returns monthly income/expense trends (last 6 months).
- `get_monthly_summary`: Returns total income, expense, and balance for a user.

## 4. Key Features & Implementation Status

### Phase 1: Authentication & Onboarding (Implemented)
1.  **User Sign Up/In**:
    - Email/Password authentication using Supabase Auth.
    - Auto-login via persistent session (AsyncStorage/SecureStore).
    - **Auth Guard**: `app/index.tsx` redirects users based on session status.
2.  **Account Management**:
    - Profile update (Nickname).
    - Sign out and Account Deletion (Withdrawal).
3.  **Group Info**:
    - Display Group Name and Invite Code.
    - "Copy to Clipboard" functionality for the invite code.

### Phase 2: Transaction Management (Implemented)
1.  **Home Screen (`app/(tabs)/home.tsx`)**:
    - Monthly summary card (Income, Expense, Balance) calculated via RPC.
    - List of transactions grouped by date.
    - **Edit Mode**: Tap any list item to modify existing transactions.
    - **Auto-Refresh**: Uses `useFocusEffect` to sync data when returning to home.
    - Floating Action Button (FAB) to add new entries.
2.  **Add/Edit Entry Screen (`app/add-entry.tsx`)**:
    - **Validation**: Ensures description is entered and amount is greater than 0.
    - **Modes**:
        1.  **Direct Input**: Manual entry with custom numeric keypad (handles both Add and Edit).
        2.  **AI Text Analysis (Chatbot-like)**:
            - **Input**: Paste text (e.g., SMS, Card alerts).
            - **Process**: Gemini API parses Amount, Date, Category, and Description.
        3.  **AI Receipt Scan (Photo)**: Captures/Selects receipt image.
            - **Constraint**: Automatically sets type to **'Expense'** (Income/Expense toggle hidden).
    - **Common UI**: Amount display, Type-aware Category picker, Date picker (Native), Description input.

### Phase 3: Analytics (Implemented)
1.  **Stats Screen (`app/(tabs)/stats.tsx`)**:
    - **Tabs**: [ My Stats | Group Stats ].
    - **Summary Card**: Total expense and Category breakdown (List with visual bars).
    - **Trend Chart**: Visual 6-month trend bar chart for Income and Expense.
    - **Member Ranking** (Group Tab only): Visual progress bars showing spending distribution among members.
    - **Performance**: Uses `supabase.rpc` to fetch pre-calculated stats directly from the DB.

### Phase 4: Settings & Navigation (Implemented)
1.  **Navigation Structure**:
    - Stack Navigator as root.
    - Tab Navigator for main screens (Home, Stats).
    - Modals for 'Add Entry'.
2.  **Settings Screen (`app/settings.tsx`)**:
    - Manage Profile, Group, and Account actions.

## 5. UI/UX Guidelines
- **Native Look & Feel**: Uses native components (`View`, `Text`, `Pressable`, `FlatList`) and native navigation transitions.
- **Auto-Update**: Immediate UI feedback after saving or editing data.
- **Responsiveness**: Layouts adapt to screen size using Flexbox.
- **Feedback**: Loading indicators for async operations, Alerts for errors/confirmations.
- **Safety**: Secure handling of API keys and Auth tokens.

## 6. Future Roadmap
- **Push Notifications**: Notify members when a new transaction is added.
- **Offline Mode**: Cache transactions locally using SQLite or WatermelonDB.
- **Image Storage**: Upload receipt images to Supabase Storage.
- **Advanced Charts**: Enhance visualizations with `victory-native` for more interactivity.
