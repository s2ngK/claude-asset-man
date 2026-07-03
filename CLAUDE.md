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
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload   # API at http://localhost:8000
```

### Docker (full stack)
```bash
docker compose up --build   # backend :8000, frontend :3000
```
Backend data persists in `backend/data/ledger.db` (SQLite file, bind-mounted).

## Architecture

### Backend (`backend/`)

**FastAPI app** in `backend/app/main.py` — registers routes, runs `Base.metadata.create_all()` and `seed_initial_data()` on startup.

**Routes** (`backend/app/routes/`):
- `auth.py` — `POST /auth/login` — validates invite code, issues JWT
- `transactions.py` — CRUD for transactions, scoped to the caller's group
- `categories.py` — list categories (system defaults + group-specific)
- `stats.py` — monthly summary, category breakdown, member stats, 6-month trend
- `admin.py` — create groups/users (protected by `ADMIN_KEY` env var)

**Auth flow:** users submit an invite code → server looks up the matching user → returns a JWT. No email/password. JWT carries `user_id`, `group_id`, `display_name`.

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
- `.taskmaster/` — Task management config and PRD docs
- `supabase/` — Legacy schema/migrations, no longer used
