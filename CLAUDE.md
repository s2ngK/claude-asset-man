# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A group personal finance (가계부) web app backed by a self-hosted Python API:

- **Root (`/`)** — Next.js 16 web PWA (TypeScript, Tailwind v4, shadcn/ui)
- **`backend/`** — FastAPI + SQLAlchemy + SQLite REST API

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
- `auth.py` — `POST /auth/login` — validates invite code, issues JWT
- `transactions.py` — CRUD for transactions, scoped to the caller's group
- `categories.py` — list categories (system defaults + group-specific)
- `stats.py` — monthly summary, category breakdown, member stats, 6-month trend
- `admin.py` — create/list groups/users, protected by the `X-Admin-Key` header (must equal `ADMIN_KEY` env var); the check happens inside each route body (not a `Depends`) so failed attempts still count toward rate limiting

**Auth flow:** users submit an invite code → server looks up the matching user → returns a JWT. No email/password. JWT carries `user_id`, `group_id`, `display_name`. `POST /api/auth/login` and all `admin.py` routes are rate-limited (10/minute per IP via `slowapi`, see `app/rate_limit.py`) since the invite code / admin key are the only credentials.

**DB:** SQLAlchemy ORM models in `backend/app/models.py`. Tables: `groups → users → transactions + categories`. Categories with `group_id IS NULL` are system defaults seeded on startup (`backend/app/seed.py`).

### Web App (`/`)

**Routing & Auth:** `src/middleware.ts` checks for a `token` cookie — redirects to `/login` if absent, redirects to `/` if already logged in. Simpler than before: no Supabase, just a JWT cookie check.

**API client:** `src/lib/api.ts` — all backend calls. Token stored in `localStorage` + `document.cookie` (cookie for middleware, localStorage for client reads). Helper exports: `getToken`, `setToken`, `clearToken`, `getLocalUser`.

**Key components:**
- `MainView` — transaction list with month selector, summary card, optimistic delete with undo toast
- `AddEntryModal` — manual entry form (no AI scanning)
- `StatsView` / `SettingsView` — lazy-loaded via `/stats` and `/settings` routes

## Environment Variables

**Web (`.env.local`):**
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Docker (`docker-compose.yml` env or `.env`):**
```
JWT_SECRET=
ADMIN_KEY=
ALLOWED_ORIGINS=http://localhost:3000
API_URL=http://localhost:8000
```

## Key Types

`src/types/index.ts` defines `Transaction`, `Category`, `TransactionType` used across web components.

## Other Directories

- `references/design/` — Vite/React prototype, not production; UI reference only
- `supabase/` — Legacy schema/migrations, no longer used
