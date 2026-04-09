# StockX — Global Stocks Platform · Developer Work Allocation

> **Project:** StockX (Groww-clone) — Full-stack real-time global stocks trading platform
> **Stack:** Node.js 20 · Express · PostgreSQL (Supabase) · Vanilla JS / HTML / CSS (Frontend)
> **Live Backend:** `https://stockx-groww-clone-production.up.railway.app`
> **Team Size:** 4 Developers

---

## Overview of the Project

The project is split into a **completed Node.js/Express backend** (deployed to Railway) and a **pending Vanilla JS frontend**. The backend exposes 6 REST API domains (Auth, Stocks, Orders, Portfolio, Wallet, Watchlist) backed by a 9-table PostgreSQL schema on Supabase, with live Yahoo Finance price sync every 10 seconds. The frontend must cover: a landing/loading page with typewriter animation, auth (login/register), a 3D interactive globe dashboard (globe.gl + Three.js), stocks list with search/filter, stock detail with price chart, portfolio P&L, orders history, wallet deposit/withdraw, and watchlist.

---

## Developer 1 — Auth, Database Schema & Security Foundation

**Domain:** PostgreSQL schema, seeding, authentication, middleware
**Files Owned:**
- `config/db.js`
- `schema.sql`
- `seed.sql`
- `scripts/seedStocksFromExchanges.js`
- `scripts/seedDemoStocks.js`
- `middleware/authMiddleware.js`
- `middleware/validateUUID.js`
- `controllers/authController.js`
- `routes/auth.js`
- `.env.example`
- `gen_token.js`

---

### Completed Tasks

| # | Task | File(s) |
|---|------|---------|
| 1 | Designed and created the full 9-table PostgreSQL schema: `users`, `stocks`, `portfolios`, `holdings`, `orders`, `trades`, `wallet_transactions`, `market_data`, `watchlists`, `refresh_tokens` | `schema.sql` |
| 2 | Added `updated_at` columns and `update_timestamp()` trigger function on `stocks` and `holdings` tables | `schema.sql` |
| 3 | Created performance indexes: `idx_orders_status`, `idx_trades_executed_at`, `idx_refresh_tokens_user_id`, `idx_stocks_symbol_exchange` | `schema.sql` |
| 4 | Unique constraint on `(symbol, exchange)` for idempotent ON CONFLICT upserts | `schema.sql` |
| 5 | `seed.sql` — 30-day OHLCV market data seeder using a random daily price walk with per-exchange volume profiles (NSE: 1M, NASDAQ/NYSE: 700K, LSE: 300K, SGX: 200K) | `seed.sql` |
| 6 | `seedStocksFromExchanges.js` — bulk import of ~14,732 symbols: NSE CSV, NASDAQ/NYSE pipe-delimited files, curated SGX list (20 stocks), curated LSE list (20 stocks) | `scripts/seedStocksFromExchanges.js` |
| 7 | NSE fallback list of 29 blue-chip symbols used when NSE CSV returns HTTP 403 | `scripts/seedStocksFromExchanges.js` |
| 8 | HTTP fetch helper in seed script: follows redirects, handles 403/non-200 errors, BOM stripping, pipe-parsing | `scripts/seedStocksFromExchanges.js` |
| 9 | Supabase PostgreSQL pool via `node-postgres` with SSL (`rejectUnauthorized: false`) | `config/db.js` |
| 10 | JWT `authMiddleware` — Bearer token extraction, `jwt.verify` with `JWT_SECRET`, attaches `req.user` | `middleware/authMiddleware.js` |
| 11 | `validateUUID` middleware — checks `req.params` or `req.body` for RFC-4122 UUID format, returns 400 on failure | `middleware/validateUUID.js` |
| 12 | `register` controller — bcrypt-10 hash, DB insert in transaction, access token + refresh token creation, returns user payload | `controllers/authController.js` |
| 13 | `login` controller — bcrypt compare against stored hash, new token pair on success | `controllers/authController.js` |
| 14 | `getMe` controller — fetch current user profile (id, email, balance, homeCurrency, kycStatus) | `controllers/authController.js` |
| 15 | `refreshToken` controller — per-user token scan, bcrypt compare against all active token hashes, issues new 15-min access token | `controllers/authController.js` |
| 16 | `logout` controller — find active refresh token, set `revoked_at` to revoke it | `controllers/authController.js` |
| 17 | Refresh token schema: 7-day expiry, bcrypt-hashed storage, `revoked_at` soft-delete, index on `user_id` | `schema.sql` |
| 18 | `gen_token.js` — dev-only CLI utility to generate test JWTs | `gen_token.js` |
| 19 | Auth routes file: `POST /register`, `POST /login`, `POST /refresh`, `POST /logout`, `GET /me` | `routes/auth.js` |
| 20 | `.env.example` with all 7 required keys committed with empty values | `.env.example` |

### Pending / Future Tasks

| # | Task |
|---|------|
| 21 | Email verification on register — send confirmation link via SMTP/SendGrid |
| 22 | Rate limiting on `/api/auth/login` and `/api/auth/register` to prevent brute-force |
| 23 | KYC status update endpoint: `PATCH /api/auth/kyc` |
| 24 | Multi-device session management — list active sessions and revoke individual devices |
| 25 | Password reset flow: `POST /api/auth/forgot-password` + `POST /api/auth/reset-password` |
| 26 | Auto-cleanup cron job: purge expired refresh tokens older than 30 days |
| 27 | Switch `DATABASE_URL` to Supabase Transaction-mode pooler URL before production |
| 28 | Lock CORS `origin` to Vercel frontend URL (currently open wildcard) |
| 29 | **Frontend:** Build Login/Register page with tab toggle, inline form validation, loading spinner on submit |
| 30 | **Frontend:** Store `accessToken` + `refreshToken` + `userId` in `localStorage`; auto-refresh access token on 401 responses |

---

## Developer 2 — Stocks, Orders, Portfolio & Price Sync Engine

**Domain:** Stock data, trading engine, real-time sync, portfolio P&L
**Files Owned:**
- `controllers/stocksController.js`
- `controllers/orderController.js`
- `controllers/portfolioController.js`
- `services/priceSync.js`
- `routes/stocks.js`
- `routes/orders.js`
- `routes/portfolio.js`
- `services/Global Stocks Platform — Backend Phases.txt`

---

### Completed Tasks

| # | Task | File(s) |
|---|------|---------|
| 1 | `getAllStocks` — paginated listing with `search` (ILIKE on symbol + company name), `exchange`, and `sector` filters; `COUNT(*) OVER()` window function for total count | `controllers/stocksController.js` |
| 2 | `getStockBySymbol` — fetch stock metadata + 30-day OHLCV price history from `market_data` | `controllers/stocksController.js` |
| 3 | `getStockLookup` — search DB first (case-insensitive); fall back to Yahoo Finance `quote()`, then `search()` if not found; normalize exchange codes; upsert new stock to DB | `controllers/stocksController.js` |
| 4 | Yahoo exchange code normalization: `NMS/NGM/NCM` → `NASDAQ`, `NYQ/NYS` → `NYSE`, `NSI` → `NSE`, `IOB` → `LSE`, `SES` → `SGX` | `controllers/stocksController.js` |
| 5 | Currency map fallback per exchange when Yahoo does not return a currency field | `controllers/stocksController.js` |
| 6 | `placeOrder` — full market order execution in a single atomic DB transaction: user balance lock (`FOR UPDATE`), order insert, trade record, balance update with DB arithmetic, immutable wallet transaction audit, portfolio/holdings upsert | `controllers/orderController.js` |
| 7 | Market order BUY: weighted average cost price recalculation when adding to an existing holding | `controllers/orderController.js` |
| 8 | Market order SELL: `FOR UPDATE` lock on holdings row to prevent race conditions; partial and full position close; delete holding row when fully sold | `controllers/orderController.js` |
| 9 | Limit order: insert with `status='open'`, no immediate balance reservation (executor deferred to future phase) | `controllers/orderController.js` |
| 10 | `getOrderHistory` — JOIN `orders`, `stocks`, `trades` returning all execution metadata in DESC order | `controllers/orderController.js` |
| 11 | Full input validation on orders: `orderType`, `side`, positive quantity, `limitPrice` check for limit orders | `controllers/orderController.js` |
| 12 | `getPortfolio` — multi-currency P&L: holdings joined with current stock prices, FX conversion (INR/USD/SGD/GBP) using rates from `.env`; per-holding P&L and portfolio-level summary | `controllers/portfolioController.js` |
| 13 | Portfolio summary totals: `totalCurrentValue`, `totalInvestedValue`, `totalPnl`, `totalPnlPct` in user's home currency | `controllers/portfolioController.js` |
| 14 | `priceSync` service — tiered architecture: Tier 1 (all stocks in active holdings or watchlists, synced every 10 s), Tier 2 (rotating batch of up to 50 stale stocks not synced in last 2 minutes) | `services/priceSync.js` |
| 15 | Yahoo Finance ticker mapping by exchange: `.NS` (NSE), `.BO` (BSE), `.SI` (SGX), `.L` (LSE), plain symbol (US) | `services/priceSync.js` |
| 16 | Price sync DB transaction per stock: `UPDATE stocks` current price + `INSERT ... ON CONFLICT` upsert into `market_data` (preserves true open price, tracks high/low with GREATEST/LEAST) | `services/priceSync.js` |
| 17 | Per-symbol error isolation in sync loop — one failed Yahoo request does not halt the entire batch | `services/priceSync.js` |
| 18 | `asyncHandler` wrapper on all routes to surface unhandled promise rejections as 500 responses | `routes/orders.js`, `routes/stocks.js` |
| 19 | Stocks routes: `GET /`, `GET /lookup` (auth protected), `GET /:symbol` | `routes/stocks.js` |
| 20 | Orders routes: `POST /` (with UUID validation), `GET /history` | `routes/orders.js` |
| 21 | Portfolio route: `GET /` (auth protected) | `routes/portfolio.js` |
| 22 | Phase-by-phase roadmap documented | `services/Global Stocks Platform — Backend Phases.txt` |

### Pending / Future Tasks

| # | Task |
|---|------|
| 23 | Build limit order executor service — poll `orders WHERE status='open' AND order_type='limit'`; match against current price; execute with same atomic transaction pattern as market orders |
| 24 | Add market hours validation — reject orders placed outside exchange trading hours |
| 25 | Live FX rates table in DB; replace hardcoded `FX_RATES` object in `portfolioController` |
| 26 | `GET /api/stocks/:symbol/history?period=1d|1w|1m|1y` with variable time resolution |
| 27 | Stock fundamentals fields: P/E, market cap, dividend yield, EPS, 52-week high/low (DB columns already exist) |
| 28 | WebSocket channel for live price push (replace 10 s client polling) |
| 29 | Redis cache layer for hot stock prices and portfolio data |
| 30 | Portfolio snapshot cron job for historical P&L charts |
| 31 | Populate sector data for all 14,732 stocks |
| 32 | **Frontend:** Build Stocks List page — search bar, exchange/sector filter dropdowns, paginated table; each row navigates to Stock Detail |
| 33 | **Frontend:** Build Stock Detail page — company header, current price + day change, TradingView Lightweight Charts fed from 30-day OHLCV; buy/sell form; poll price every 10 s |
| 34 | **Frontend:** Wire `POST /api/orders` from buy/sell form with quantity input and order type selector |

---

## Developer 3 — Wallet, Watchlist & Application Server Bootstrap

**Domain:** Wallet ledger, watchlist, Express server entry point
**Files Owned:**
- `controllers/transactionsController.js`
- `controllers/watchlistController.js`
- `routes/transactions.js`
- `routes/watchlist.js`
- `index.js`
- `package.json`
- `README.md`
- `workdivision.txt`
- `backekend.txt`
- `AGENTS.md`

---

### Completed Tasks

| # | Task | File(s) |
|---|------|---------|
| 1 | `deposit` controller — `FOR UPDATE` balance lock, atomic balance update, immutable `wallet_transactions` INSERT | `controllers/transactionsController.js` |
| 2 | `withdraw` controller — same atomic pattern; 422 response on insufficient funds | `controllers/transactionsController.js` |
| 3 | `getBalance` controller — return current balance, home currency, and last 10 transactions ordered by date | `controllers/transactionsController.js` |
| 4 | Immutable ledger rule enforced in code: `wallet_transactions` is insert-only, no UPDATE or DELETE | `controllers/transactionsController.js` |
| 5 | All monetary values stored as `DECIMAL(20,8)` — `.toFixed(8)` used on every amount | `controllers/transactionsController.js` |
| 6 | `getWatchlist` — JOIN `watchlists` + `stocks` returning symbol, price, exchange, currency per entry | `controllers/watchlistController.js` |
| 7 | `addToWatchlist` — stock existence check, `ON CONFLICT (user_id, stock_id) DO NOTHING`, 409 if already watchlisted | `controllers/watchlistController.js` |
| 8 | `removeFromWatchlist` — DELETE by `user_id + stock_id`; 404 if not found in watchlist | `controllers/watchlistController.js` |
| 9 | Wallet routes: `POST /deposit`, `POST /withdraw`, `GET /balance` — all auth protected | `routes/transactions.js` |
| 10 | Watchlist routes: `GET /`, `POST /` (UUID validated on `stockId`), `DELETE /:stockId` (UUID validated) | `routes/watchlist.js` |
| 11 | Express server entry point — registers all 6 route modules under `/api/*`, global error handler (500), starts price sync on boot | `index.js` |
| 12 | CORS middleware (open wildcard — to be restricted to Vercel URL before production) | `index.js` |
| 13 | `NODE_ENV` warning suppression at startup | `index.js` |
| 14 | `engines: { node: "20.x" }` pinned in package.json for Railway deployment | `package.json` |
| 15 | All 8 runtime dependencies declared: `bcrypt`, `cors`, `dotenv`, `express`, `jsonwebtoken`, `pg`, `uuid`, `yahoo-finance2` | `package.json` |
| 16 | Full API reference documentation covering all endpoints, auth flow, DB schema summary, price sync explanation, project structure, and troubleshooting guide | `README.md` |

### Pending / Future Tasks

| # | Task |
|---|------|
| 17 | Add wallet transaction history endpoint with pagination: `GET /api/wallet/transactions?page=&limit=` |
| 18 | Add deposit/withdraw limits and daily caps |
| 19 | Add price alert rules: `POST /api/alerts`, `GET /api/alerts`, `DELETE /api/alerts/:id` |
| 20 | Price alert trigger in price sync loop — check alert rules on each price update |
| 21 | Add `GET /api/watchlist/:stockId` single-item endpoint |
| 22 | Health check endpoint: `GET /api/health` returning DB connectivity status and uptime |
| 23 | Structured logging (replace `console.log/error` with Winston or Pino) |
| 24 | Graceful shutdown handler: drain in-flight requests, close DB pool, stop price sync interval |
| 25 | **Frontend:** Build Wallet page — display balance prominently, deposit/withdraw forms, full transaction history table |
| 26 | **Frontend:** Build Watchlist page — grid of watchlisted stocks with live price badges, one-click remove, add-stock search bar using `GET /api/stocks/lookup` |
| 27 | **Frontend:** Build Orders History page — table with columns: Date/Time, Symbol, Side (Buy/Sell badge), Type, Quantity, Executed Price, Total Value, Status |
| 28 | **Frontend:** Build Portfolio page — holdings table with symbol, quantity, avg cost, current price, P&L amount and P&L % per row; portfolio summary card at top |

---

## Developer 4 — Frontend: Landing Page, Globe Dashboard & UI System

**Domain:** Frontend architecture, interactive 3D globe, landing page, design system
**Files Owned:**
- `index.html`
- `test.html`
- `stockx-test-frontend.html`
- `stockx-frontendv2.html`
- `master frontend prompt.md`
- `Stockx frontend file format.md`
- `Untitled-1.md`
- All future `frontend/` directory files

---

### Completed Tasks (Reference/Prototype Work Already Done)

| # | Task | File(s) |
|---|------|---------|
| 1 | API tester HTML prototype — manual endpoint testing UI covering all 6 API domains with token management | `test.html` |
| 2 | Early frontend prototype v1 — basic HTML/CSS/JS frontend wired to backend | `stockx-test-frontend.html` |
| 3 | Frontend prototype v2 — refined UI shell | `stockx-frontendv2.html` |
| 4 | Frontend architecture document — full folder structure for `app/`, `components/`, `lib/`, `store/` | `Stockx frontend file format.md`, `Untitled-1.md` |
| 5 | Master frontend prompt — Groww-inspired design spec, page-by-page requirements, globe implementation guidance, color palette, typography, API integration order | `master frontend prompt.md` |

### Pending / Future Tasks (Full Frontend Build)

#### Landing / Loading Page
| # | Task |
|---|------|
| 6 | Build landing page (`index.html`) with typewriter/backspace animation cycling through 5–6 financial taglines (inspired by Google Antigravity style) |
| 7 | Typewriter effect: type a sentence → pause → backspace character by character → type next sentence, loop |
| 8 | "Get Started" CTA button navigating to Auth page |
| 9 | "Login" button in top-right corner |
| 10 | Ensure NO internal data (stocks, portfolio, globe) is shown before login — all protected routes redirect to auth |

#### Auth Page
| # | Task |
|---|------|
| 11 | Build single Auth page with tab toggle between Register and Login |
| 12 | Register form: name, email, password, confirm password with inline validation |
| 13 | Login form: email + password with inline validation |
| 14 | Show field-level error messages; loading spinner on submit button |
| 15 | On success: store `accessToken`, `refreshToken`, `userId` in `localStorage`; redirect to Globe Dashboard |
| 16 | On 401: show "Invalid credentials" inline; on 409: show "Email already registered" |

#### Globe Dashboard (Post-Login Homepage)
| # | Task |
|---|------|
| 17 | Integrate `globe.gl` + Three.js + deck.gl to render a full-screen interactive 3D globe |
| 18 | Mark all 5 supported stock exchanges with glowing pins: NSE (India), NYSE (New York), NASDAQ (Silicon Valley), LSE (London), SGX (Singapore) |
| 19 | Globe auto-rotates passively when idle; stops and allows drag when user interacts |
| 20 | Clicking an exchange pin opens a side panel showing top 5 stocks from that exchange with live prices fetched from `GET /api/stocks?exchange=` |
| 21 | Clicking a stock in the side panel navigates to Stock Detail page |
| 22 | Smooth transitions between passive rotation and manual drag control |
| 23 | Pin color indicates market direction: green if majority of exchange stocks are UP, red if DOWN |

#### Shared UI System (Design Tokens)
| # | Task |
|---|------|
| 24 | Set up CSS custom properties: background `#0b0e14`, surface `#111620`, border `#1e2535`, accent green `#00e5a0`, accent blue `#5076ee`, danger red `#ff4d6d`, text `#c9d1e0`, muted `#556070` |
| 25 | Typography: Syne font (display/headings), JetBrains Mono (prices/data), 16px base |
| 26 | Navbar component: StockX logo left, nav links (Stocks, Portfolio, Orders, Wallet, Watchlist), user avatar/logout top-right |
| 27 | Reusable `StockCard` component — symbol, company name, exchange badge, current price, day change % |
| 28 | Reusable `PriceChart` component — TradingView Lightweight Charts fed from 30-day OHLCV data |
| 29 | `OrderModal` / buy-sell drawer — quantity input, order type selector (Market/Limit), limit price field (conditional), submit wired to `POST /api/orders` |
| 30 | Toast notification system for API errors and order confirmations |

#### API Integration Layer
| # | Task |
|---|------|
| 31 | `lib/api.js` — Axios instance with base URL pointing to Railway backend; request interceptor auto-attaches `Authorization: Bearer <token>` header |
| 32 | `lib/auth.js` — JWT decode helper, token read/write/clear from `localStorage`, auto-refresh on 401 using `POST /api/auth/refresh` |
| 33 | Redux Toolkit store with `authSlice` (user, token), `stocksSlice` (stocks list, selected stock), `portfolioSlice` (holdings, P&L summary) |
| 34 | RTK Query API slices: `authApi`, `stocksApi`, `ordersApi`, `portfolioApi`, `walletApi`, `watchlistApi` |

#### Remaining Pages
| # | Task |
|---|------|
| 35 | **Stocks List page** — search input, exchange + sector dropdowns, paginated table/grid of stocks; each row links to Stock Detail |
| 36 | **Stock Detail page** — company header, live price + day change (poll every 10 s), 30-day TradingView chart, buy/sell form |
| 37 | **Portfolio page** — summary card (total value, total P&L, total P&L %), holdings table per stock |
| 38 | **Orders page** — full order history table with status badges |
| 39 | **Wallet page** — balance display, deposit form, withdraw form, last 10 transactions |
| 40 | **Watchlist page** — grid of watchlisted stocks, remove button per stock, add-stock search |
| 41 | Deploy frontend to Vercel: connect GitHub repo, set `NEXT_PUBLIC_API_URL` env var, test full flow on live URL |

---

## Summary Table

| Developer | Domain | Status |
|-----------|--------|--------|
| Developer 1 | Auth, DB Schema, Middleware, Seeding | Backend COMPLETE — Frontend auth page pending |
| Developer 2 | Stocks, Orders, Portfolio, Price Sync | Backend COMPLETE — Frontend stock/portfolio pages pending |
| Developer 3 | Wallet, Watchlist, Server Bootstrap | Backend COMPLETE — Frontend wallet/watchlist/orders pages pending |
| Developer 4 | Frontend Architecture, Globe, Landing, UI System | All frontend work pending (prototypes exist as reference) |

---

## Shared Backend Files (All Developers Reference)

| File | Purpose |
|------|---------|
| `index.js` | Express app entry point — route registration, error handler, price sync start |
| `config/db.js` | PostgreSQL pool — imported by every controller |
| `schema.sql` | Full DB schema + indexes + triggers |
| `package.json` | Dependencies and Node version pin |
| `README.md` | Full API documentation and setup guide |
| `.env.example` | Environment variable template |

---

## API Endpoints Quick Reference

| Domain | Method | Endpoint | Auth | Owner |
|--------|--------|----------|------|-------|
| Auth | POST | `/api/auth/register` | — | Dev 1 |
| Auth | POST | `/api/auth/login` | — | Dev 1 |
| Auth | POST | `/api/auth/refresh` | — | Dev 1 |
| Auth | POST | `/api/auth/logout` | YES | Dev 1 |
| Auth | GET | `/api/auth/me` | YES | Dev 1 |
| Stocks | GET | `/api/stocks` | — | Dev 2 |
| Stocks | GET | `/api/stocks/lookup?q=` | YES | Dev 2 |
| Stocks | GET | `/api/stocks/:symbol` | — | Dev 2 |
| Orders | POST | `/api/orders` | YES | Dev 2 |
| Orders | GET | `/api/orders/history` | YES | Dev 2 |
| Portfolio | GET | `/api/portfolio` | YES | Dev 2 |
| Wallet | POST | `/api/wallet/deposit` | YES | Dev 3 |
| Wallet | POST | `/api/wallet/withdraw` | YES | Dev 3 |
| Wallet | GET | `/api/wallet/balance` | YES | Dev 3 |
| Watchlist | GET | `/api/watchlist` | YES | Dev 3 |
| Watchlist | POST | `/api/watchlist` | YES | Dev 3 |
| Watchlist | DELETE | `/api/watchlist/:stockId` | YES | Dev 3 |

