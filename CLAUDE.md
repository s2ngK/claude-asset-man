# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A group personal finance (가계부) web app backed by a self-hosted Python API:

- **Root (`/`)** — Next.js 16 web PWA (TypeScript, Tailwind v4, shadcn/ui)
- **`backend/`** — FastAPI + SQLAlchemy + SQLite REST API

Current work status and next tasks are tracked in [ROADMAP.md](./ROADMAP.md) — check it for what's in progress, backlogged, or intentionally on hold, and keep it updated as work completes.

Architecture and behaviour are documented in [docs/](./docs/) — start at [docs/README.md](./docs/README.md). Two entries matter most before changing anything: [auth-and-scoping.md](./docs/auth-and-scoping.md) (the group-isolation invariant every route must uphold) and [pitfalls.md](./docs/pitfalls.md) (traps already hit — slowapi vs `Depends`, Next 16 migration, Docker).

**When a change alters documented behaviour, update the matching doc in the same PR.** `docs/README.md` maps source paths to the docs that cover them. Do not hand-write endpoint or schema listings — FastAPI generates those at `/docs`; the files here cover only what OpenAPI cannot express.

Known defects are tracked as GitHub Issues; [docs/known-issues.md](./docs/known-issues.md) is the index.

## Commands

### Web App (root directory)
```bash
npm run dev      # Dev server at http://localhost:3000
npm run build    # Production build (--webpack flag)
npm run lint     # ESLint
```

### Backend (`backend/` directory)
Dependencies and the venv are managed by [uv](https://docs.astral.sh/uv/) (`pyproject.toml` + `uv.lock`), not pip/requirements.txt.
```bash
cd backend
uv sync                         # creates .venv, installs deps (incl. dev group: ruff, pytest)
uv run alembic upgrade head     # apply DB schema migrations
uv run uvicorn app.main:app --reload   # API at http://localhost:8000
uv run ruff check .             # lint
uv run ruff format .            # format
uv run pytest                   # tests
```

### Docker (full stack)
```bash
docker compose up --build   # backend :8000, frontend :3000
```
Backend data persists in `backend/data/ledger.db` (SQLite file, bind-mounted).

## Architecture

### Backend (`backend/`)

**FastAPI app** in `backend/app/main.py` — registers routes, runs `seed_initial_data()` on startup. DB schema is managed by Alembic (`backend/alembic/versions/`), not `create_all()` — after changing `app/models.py`, run `alembic revision --autogenerate -m "..."` and review the generated migration.

**Routes** (`backend/app/routes/`):
- `auth.py` — `POST /auth/login` (invite code → JWT), `GET /auth/me`
- `transactions.py` — CRUD for transactions, scoped to the caller's group; writes are restricted to the author
- `categories.py` — list categories (system defaults + group-specific), plus create/delete of **group-specific** ones (group admin only). Deleting one moves its transactions to `기타` rather than deleting them
- `stats.py` — monthly summary, category breakdown, **daily totals** (`/daily`, powers the calendar), member stats, 6-month trend
- `accounts.py` — loans / deposits / installment savings. **There is no balance column** — balances are computed from linked transactions on every read (`queries.account_totals`). Accounts are owned by one member but readable by the whole group; `/settle` closes one out and books the interest as income
- `admin.py` — admin console API: `POST /admin/login`, groups (create/list/deactivate/restore/rotate admin code), members (create/list/rotate invite code), and **system categories** (`group_id IS NULL`, super admin only)

**Shared backend modules:** `config.py` (env read through functions + `verify_startup_config()`, which refuses to boot in production with placeholder secrets), `dependencies.py` (`get_current_user`, `resolve_admin`), `queries.py` (`visible_categories`, `visible_accounts`, `account_totals`/`account_balance`, fallback-category move), `palette.py` (the 8 validated categorical colors — the single source for category colors), `rate_limit.py`.

**Auth flow:** users submit an invite code → server looks up the matching user → returns a JWT. No email/password. JWT carries `user_id`, `group_id`, `display_name`.

Admin access is a **separate scope on the same JWT secret**: `POST /api/admin/login` takes either `ADMIN_KEY` (→ `scope: admin`, super admin) or a group's `admin_code` (→ `scope: group_admin` + `group_id`/`group_name`, that group only). `get_current_user` rejects admin-scoped tokens, so admin tokens cannot reach user APIs. `/api/admin/*` also still accepts the raw `X-Admin-Key` header for curl/scripts. `POST /api/auth/login` and all `admin.py` routes are rate-limited (10/minute per IP via `slowapi`, see `app/rate_limit.py`) since the invite code / admin key are the only credentials. The key check happens inside each route body (not a `Depends`) so failed attempts still count toward rate limiting.

**DB:** SQLAlchemy ORM models in `backend/app/models.py`. Tables: `groups → users → transactions + categories + accounts`. Categories with `group_id IS NULL` are system defaults seeded on startup (`backend/app/seed.py`). Groups are never deleted — `deactivated_at` soft-deactivates them, invalidating every credential in that group while keeping the records restorable.

### Web App (`/`)

**Routing & Auth:** `src/proxy.ts` (Next 16's rename of the `middleware` convention — exports a `proxy` function) checks for a `token` cookie — redirects to `/login` if absent, redirects to `/` if already logged in. Simpler than before: no Supabase, just a JWT cookie check.

**API client:** `src/lib/api.ts` — all backend calls. Token stored in `localStorage` + `document.cookie` (cookie for `proxy.ts`, localStorage for client reads). Helper exports: `getToken`, `setToken`, `clearToken`, `getLocalUser`. `src/lib/adminApi.ts` is the separate channel for `/api/admin/*` — its token lives in `sessionStorage`, not `localStorage`.

Storage is read through `useSyncExternalStore` (`lib/useLocalUser.ts`, `lib/useAdminToken.ts`), never by setting state in an effect — the project's ESLint config bans that (`react-hooks/set-state-in-effect`) and it also caused hydration mismatches.

**Key components:**
- `MainView` — transaction list with month selector, summary card (server-computed), sort, type/category/member filters, optimistic delete with undo toast
- `TransactionItem` — one row; pointer-event swipe-to-delete (works with a mouse too), own-entry badge/tint
- `AddEntryModal` — manual entry and edit form (no AI scanning); calculator keypad, backdrop/Esc dismiss
- `StatsView` — donut (top 5 + `그 외`), 6-month trend, `MonthCalendar` for daily totals
- `AccountsView` / `AccountModal` / `SettleModal` — loans and savings; balances come from the server, never stored → [docs/accounts.md](./docs/accounts.md)
- `MonthPicker` / `DatePicker` — hand-built replacements for `<input type="month"|"date">`
- `AppNav` — one navigation that changes shape: bottom tab bar below `lg`, left sidebar above (홈 · 자산 · 통계 · 설정)
- `SettingsView` — profile, group categories; lazy-loaded via `/settings`

`/admin` is a separate console with its own login → [docs/admin-console.md](./docs/admin-console.md).

## Environment Variables

**Web (`.env.local`):**
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Docker (`docker-compose.yml` env or `.env`, see `.env.example`):**
```
APP_ENV=development          # production 이면 아래 값이 기본값일 때 기동을 거부한다
JWT_SECRET=
ADMIN_KEY=
ALLOWED_ORIGINS=http://localhost:3000
ADMIN_TOKEN_EXPIRE_MINUTES=60
API_URL=http://localhost:8000   # → build arg NEXT_PUBLIC_API_URL (build time, not runtime)
```

## Key Types

`src/types/index.ts` defines `Transaction`, `Category`, `TransactionType` used across web components.

## Other Directories

- `references/design/` — Vite/React prototype, not production; UI reference only
- `supabase/` — Legacy schema/migrations, no longer used
