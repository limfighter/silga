# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

실가 (Silga) is a personal tool that tracks real-time lowest prices for PC parts (sourced from Danawa, a Korean price-comparison site) and judges whether a completed PC build's asking price is fair. It has two consumers: a personal web app (this repo) and, eventually, AI routers (e.g. Claude) calling the same REST API as a tool.

No auth/login, no commercial use. Single-developer project — do not over-engineer (no message queues, no migration framework, no premature scaling).

**Read `실가_인수인계.md` before starting any non-trivial work.** It's the live handoff doc (current state, in-flight items, open questions) and is required reading at the start of every session per this project's own convention. `실가_REFERENCE.md` holds the stable rules/contracts (API contract, DB schema, design tokens); it only changes when the underlying design changes. `실가_HISTORY.md` is an append-only changelog. If you make a change that alters the API contract or DB schema, update `실가_인수인계.md` (+ append to `실가_HISTORY.md`); update `실가_REFERENCE.md` only when the contract/structure itself changes.

## Commands

### Backend (FastAPI, Python 3.11+)
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Swagger UI at `http://localhost:8000/docs`. There is no configured linter, formatter, or unit test suite for the backend — don't invent commands for these.

### Frontend (Vite + React + TypeScript)
```bash
cd frontend
npm install
npm run dev          # http://localhost:5173, calls backend at http://localhost:8000 by default
npm run build
npm run typecheck    # tsc --noEmit
```
To point at a different backend, set `VITE_API_BASE` in `frontend/.env` (see `frontend/src/lib/api.ts`). There is no ESLint config in this repo — `typecheck` is the only automated check.

### E2E smoke test
```bash
pip install playwright && playwright install chromium
# with both backend (:8000) and frontend (:5173) already running
python3 scripts/e2e_smoke_test.py
```
This is the only test in the repo — a single Playwright script driving the real browser through search → build create → detail → list. There's no per-test filtering; it's one linear script, and screenshots are written to a hardcoded absolute path (`/home/claude/e2e_*.png`) that will need adjusting outside that sandbox.

## Architecture

### Repo layout
Two top-level apps, no separate "API" package (the API *is* `backend/`):
```
backend/app/
  main.py            all FastAPI routes live here (not split into routers)
  database.py        SQLAlchemy engine/session, SQLite in WAL mode
  timezone_utils.py  KST helpers — see "Timezones" below
  utils.py           format_won() (KRW display formatting)
  services/
    danawa.py        vendored/patched Danawa scraper (see "Data source" below)
    verdict.py        calc_verdict() — the over/under-priced judgment
  models/            SQLAlchemy models: Product, Build, BuildItem
  schemas/           Pydantic request/response models, 1:1 with the API contract

frontend/src/
  components/        AppShell (sidebar/topbar), PartRow (autocomplete row)
  pages/             Search, BuildList, BuildCreate, BuildDetail, Placeholder
  lib/                api.ts (typed backend client), useDebouncedValue.ts
  styles/global.css   design tokens as CSS variables
```
A `flutter/` directory is planned for a later mobile port (Phase 5) but doesn't exist yet — don't create scaffolding for it preemptively.

### Data source: Danawa scraping, not a real API
`backend/app/services/danawa.py` is a vendored, hand-patched copy of the unofficial `MineEric64/danawa-py` library (no PyPI package, no setup.py — it's copied in, not installed). Danawa changes its DOM without notice; two of the three functions (`get_product_codes`, `get_product`) were already broken by a site redesign and had to be repatched (see `실가_HISTORY.md`, 2026-08-03). `get_price_variance` is unpatched upstream code.

Rules when touching this module or anything downstream of it:
- **Always use the `lowest_price` field for real math** (estimates, comparisons, verdicts). Never compute a minimum from the `prices` list yourself — that list is UI-display-only, is truncated to roughly the top 10 sellers, and can include sellers Danawa itself excludes from its official lowest-price calculation.
- Be polite: no tight request loops, no concurrent scraping. `_compute_estimate()` in `main.py` calls `danawa.get_product()` once per build item sequentially, on purpose.
- Distinguish scraper failure from legitimate "out of stock": `requests.RequestException` → HTTP 503 ("데이터 소스 연결 실패"); parse success but missing data / not found → HTTP 404; genuinely sold-out products surface via the `in_stock` field instead of an error (see the PALIT RTX5070Ti case in `실가_HISTORY.md`).
- `category` and `cash_price` on `/product/{code}` are permanently `None` right now — the scraper doesn't parse them yet. Don't "fix" this without checking `실가_인수인계.md` first (it's a known open item, not a bug you introduced).

### Verdict calculation
`services/verdict.py::calc_verdict(estimate_total, market_price)` computes `diff_percent = (market_price - estimate_total) / estimate_total * 100` and buckets it into `저가` (underpriced) / `적정가` (fair) / `고가` (overpriced) at a ±5% threshold (`VERDICT_THRESHOLD_PERCENT`). That threshold is an explicit placeholder guess, not a validated number — it's called out as an open decision in `실가_인수인계.md`. `/estimate` and `/build/compare` share this logic through the `_compute_estimate()` helper in `main.py`; don't duplicate the summation logic elsewhere.

### Database is structure-only, never a price cache
Three tables: `products` (metadata cache — title/spec/img, no price fields, keyed by Danawa product code), `builds` (a saved build: name, optional `market_price` to compare against), `build_items` (build ↔ product join with a `category` string). There is deliberately no `price_history` table — price history is always fetched live from `danawa.get_price_variance()` rather than accumulated locally, because the DB's job is remembering *what a build is made of*, not price data. Don't add a price-snapshot table without checking why this was rejected (`실가_REFERENCE.md` #DB-스키마).

### Timezones: KST everywhere, no exceptions
Unlike UTC-standardized projects, this one standardizes on KST because Danawa itself is KST-based. SQLAlchemy's `DateTime(timezone=True)` is a silent no-op under SQLite (it drops the offset on write and comes back naive on read), so all datetime columns use the custom `KSTDateTime` TypeDecorator in `timezone_utils.py` instead — it stores ISO-8601-with-offset strings and **raises if you pass it a naive datetime**. Always create timestamps via `now_kst()`. When adding any new datetime column, use `KSTDateTime`, not `DateTime(timezone=True)`.

### API response shape convention
Every response that includes a price includes both a raw numeric field and a `*_formatted` (KRW string, via `utils.format_won()`) counterpart — the frontend uses the formatted field, an AI router caller uses the raw one. Don't fork this into separate endpoints or response modes; keep both fields on the same object, matching the existing schemas in `backend/app/schemas/`.

`/product/{code}/compare` (single product) and `/build/compare` (whole build) are separate endpoints because the original spec was ambiguous about which one `/compare` meant — see `실가_REFERENCE.md` #엔드포인트-설계 for the resolution. Don't collapse them back into one without re-reading that section.

### Frontend structure
Vite SPA (no Next.js/SSR — the backend is already a separate FastAPI service). Routing is flat in `App.tsx`, all pages nested under a single `AppShell` layout route (sidebar + topbar). Server state goes through TanStack Query; there's no separate global state store. `lib/api.ts` types are meant to mirror `backend/app/schemas/*.py` 1:1 — when you change a Pydantic schema, update the matching TS interface in the same change. Styling is plain CSS using variables from `styles/global.css` (design tokens: dark background, cyan/magenta/amber accents for fair/overpriced/volatile) — no Tailwind, no CSS-in-JS.

Of the seven sidebar tabs, only 검색 (Search) and 빌드 (Build: list/create/detail) are wired to real data; 홈/즐겨찾기/최근기록/통계/설정 are routed placeholders (`PlaceholderPage`) with no backend behind them yet — don't assume they need matching endpoints.

## Conventions
- Commit message format: `type: summary` (`feat` / `fix` / `refactor` / `docs` / `chore`), e.g. `feat: /compare 엔드포인트 추가 (v0.2)`.
- Versioning is semantic-ish and manual (no package-version automation): patch digit = bugfix/no contract change, minor digit = new/changed endpoint (contract-affecting, commit required), major digit = architecture rewrite.
- Changing an API response field name or shape is a contract change — the frontend was hand-built against the contract in `실가_REFERENCE.md`, so check that doc and update it alongside the code, don't rename fields casually.
