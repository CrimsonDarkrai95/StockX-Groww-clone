# Global Stocks Platform — Complete Project Roadmap

---

## Before You Start Anything — Required Inputs

| Input Needed | Status |
|---|---|
| GitHub repo created and backend pushed | ✅ Done |
| Railway deployed — backend live 24/7 | ✅ Done |
| `.env.example` committed to repo | ✅ Done |
| Supabase project URL + connection string confirmed working | ✅ Done |
| Yahoo Finance bulk import ran successfully (14,732 stocks) | ✅ Done |
| Node.js 20 LTS on all team laptops | ⚠️ Confirm with teammates |
| Figma account (free tier) | ⏳ Pending |
| Vercel account linked to GitHub | ⏳ Pending |

---

## PHASE 0 — Foundation ✅ COMPLETE

### Step 1 — Push Backend to GitHub ✅
- Repo: `https://github.com/CrimsonDarkrai95/StockX-Groww-clone.git`
- `.env` is in `.gitignore` — secrets never pushed
- `.env.example` committed with empty values

### Step 2 — Deploy Backend to Railway ✅
- Live URL: `https://stockx-groww-clone-production.up.railway.app`
- Node 20.x pinned via `engines` in `package.json`
- All 7 environment variables set in Railway dashboard
- Price sync running on Railway every 10 seconds
- Tested and confirmed:
  - `GET /api/stocks` → 14,732 stocks ✅
  - `GET /api/wallet/balance` → 401 (correct, auth protected) ✅

**Share with teammates privately (WhatsApp/DM):**
```
Railway URL: https://stockx-groww-clone-production.up.railway.app
+ actual .env values
```

### Step 3 — Design System in Figma ⏳ PENDING

Draw all screens before writing any frontend code.

**Design tokens (copy from your API tester HTML):**
```
Colors:
  Background:   #0b0e14
  Surface:      #111620
  Border:       #1e2535
  Accent green: #00e5a0
  Accent blue:  #0090ff
  Danger red:   #ff4d6d
  Warning:      #f5a623
  Text:         #c9d1e0
  Muted:        #556070

Fonts:
  Display/UI:   Syne (400, 600, 700)
  Code/Data:    JetBrains Mono (400, 600)

Border radius:  6px (cards), 10px (sections)
```

**Pages to wireframe:**
1. Homepage (globe centred, login top-right)
2. Stock Detail (chart + buy/sell form + metrics)
3. Dashboard (portfolio P&L, wallet, orders, watchlist)
4. Login / Register
5. All Stocks list (`/stocks`)

---

## PHASE 1 — Frontend Scaffolding ⏳ NEXT

### Step 4 — Create Next.js 14 Project

```bash
npx create-next-app@14 stockx-frontend
```

Answer prompts exactly:
```
TypeScript?          → Yes
ESLint?              → Yes
Tailwind CSS?        → Yes
src/ directory?      → No
App Router?          → Yes
Import alias (@/*)?  → Yes
```

Install all dependencies:
```bash
cd stockx-frontend

# UI
npx shadcn-ui@latest init
npm install class-variance-authority clsx tailwind-merge

# State
npm install @reduxjs/toolkit react-redux

# Globe
npm install react-globe.gl three

# Charts
npm install lightweight-charts recharts

# Utilities
npm install axios date-fns
```

Create `.env.local`:
```
NEXT_PUBLIC_API_URL=https://stockx-groww-clone-production.up.railway.app
```

**Test:** `npm run dev` → opens on `localhost:3000` ✅

### Step 5 — Redux Store + RTK Query Setup

**Folder structure:**
```
store/
├── index.js
├── authSlice.js
└── api/
    ├── authApi.js
    ├── stocksApi.js
    ├── ordersApi.js
    ├── portfolioApi.js
    ├── walletApi.js
    └── watchlistApi.js
```

Wrap `app/layout.js` with `<Provider store={store}>`.

---

## PHASE 2 — Authentication Pages

### Step 6 — Login + Register

**Tool pipeline:**
```
Figma (draw) → Lovable/Stitch (generate shell) → Cursor (wire API + logic)
```

**What login must do:**
```
POST /api/auth/login
→ Store access token in Redux + localStorage
→ Store refresh token in localStorage
→ Redirect to /dashboard on success
→ Show error on 401
```

**Form validation (pure JS):**
```javascript
if (!email.includes('@'))  → "Invalid email"
if (password.length < 8)   → "Min 8 characters"
```

---

## PHASE 3 — Globe Homepage

### Step 7 — Globe Component

**File:** `components/Globe/StockGlobe.jsx`

**Exchange coordinates:**
```javascript
const EXCHANGE_COORDS = {
  NSE:    { lat: 20.5937, lng: 78.9629,   label: 'India · NSE' },
  NYSE:   { lat: 40.7128, lng: -74.0060,  label: 'USA · NYSE' },
  NASDAQ: { lat: 37.3861, lng: -122.0839, label: 'USA · NASDAQ' },
  LSE:    { lat: 51.5074, lng: -0.1278,   label: 'UK · LSE' },
  SGX:    { lat: 1.3521,  lng: 103.8198,  label: 'Singapore · SGX' },
};
```

**Behaviour:**
- Auto-rotates slowly, draggable
- Glowing dots per exchange — green if market UP, red if DOWN
- Click dot → side panel opens with top 5 stocks for that exchange
- Click stock → navigates to `/stocks/[symbol]`

**Tool:** Manual in Cursor only — Lovable/Stitch cannot generate globe.gl correctly.

### Step 8 — Homepage Layout

```
┌─────────────────────────────────────────────┐
│  STOCKX logo          [Login] [Sign Up]      │
├─────────────────────────────────────────────┤
│           [ 3D GLOBE — centred ]            │
├─────────────────────────────────────────────┤
│  NIFTY 50  +1.2%  │  S&P 500  -0.3%  │ ... │
├─────────────────────────────────────────────┤
│  Top Gainers    │   Top Losers    │ Trending │
└─────────────────────────────────────────────┘
```

---

## PHASE 4 — Stock Detail Page

### Step 9 — `/stocks/[symbol]`

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  ← Back    RELIANCE.NS    ₹2,450.30  ▲ +1.2%       │
│  NSE · India · Last updated: 8 seconds ago  [LIVE●] │
├───────────────────────────────────┬─────────────────┤
│                                   │  BUY / SELL     │
│   TradingView Price Chart         │  Qty: [_____]   │
│   (30-day OHLCV from market_data) │  Type: Market ▾ │
│                                   │  [BUY] [SELL]   │
├───────────────────────────────────┴─────────────────┤
│  Current Price │ Day High │ Day Low │ Volume         │
└─────────────────────────────────────────────────────┘
```

**Chart:** TradingView Lightweight Charts fed from `GET /api/stocks/:symbol`

**Real-time polling:**
```javascript
// Poll every 10s to match priceSync interval
setInterval(() => refetch(), 10000);
```

**APIs:**
```
GET /api/stocks/:symbol   → stock data + 30-day OHLCV
POST /api/orders          → place buy/sell
```

---

## PHASE 5 — Dashboard

### Step 10 — `/dashboard`

**Layout:**
```
┌──────────────┬──────────────┬──────────────┐
│  Wallet      │  Portfolio   │  Today's P&L │
│  ₹ 45,230    │  ₹ 1,23,450  │  ▲ +₹2,340  │
├──────────────┴──────────────┴──────────────┤
│  Holdings                                   │
│  RELIANCE  10 shares  ₹2,450  ▲ +2.3%      │
├─────────────────────────────────────────────┤
│  Recent Orders           │  Watchlist       │
└─────────────────────────────────────────────┘
```

**APIs wired:**
```
GET /api/wallet/balance   → Wallet card
GET /api/portfolio        → Portfolio + Holdings
GET /api/orders/history   → Recent Orders
GET /api/watchlist        → Watchlist panel
```

---

## PHASE 6 — Remaining Pages

### Step 11 — All Stocks `/stocks`
- Search → `GET /api/stocks?search=`
- Exchange filter → `?exchange=NSE`
- Sector filter → `?sector=Technology`
- Pagination → `?page=2&limit=20`
- Each row clickable → `/stocks/[symbol]`

### Step 12 — Orders `/orders`
- Table of all past orders from `GET /api/orders/history`
- Columns: Date/Time, Symbol, Type, Qty, Price, Status

### Step 13 — Wallet `/wallet`
- Current balance displayed prominently
- Deposit → `POST /api/wallet/deposit`
- Withdraw → `POST /api/wallet/withdraw`
- Transaction history from `wallet_transactions`

### Step 14 — Watchlist `/watchlist`
- Grid of watchlisted stocks with live prices
- Remove → `DELETE /api/watchlist/:stockId`
- Add stock → `GET /api/stocks/lookup?q=` → `POST /api/watchlist`

---

## PHASE 7 — Deployment

### Step 15 — Deploy Frontend to Vercel

```
1. Push stockx-frontend to GitHub (separate repo)
2. vercel.com → New Project → Import from GitHub
3. Add environment variable:
   NEXT_PUBLIC_API_URL = https://stockx-groww-clone-production.up.railway.app
4. Deploy → get Vercel URL
```

Test full flow on live URL: login → dashboard → buy stock → check portfolio.

---

## Tool Pipeline (Every Page, Same Order)

```
FIGMA        → LOVABLE/STITCH  → CURSOR             → FRAMER (optional)
Draw layout    Generate shell     Wire APIs + logic    Animations
(once upfront) (per page)        (daily work)         (post-submission)
```

**shadcn/ui** lives inside Cursor throughout — add components as needed:
```bash
npx shadcn-ui@latest add button card input table toast
```

---

## Timeline

```
Week 1 (Now)
├── ✅ Phase 0: GitHub + Railway + .env.example
├── → Phase 0: Figma wireframes
└── → Phase 1: Next.js setup + Redux + RTK Query

Week 2
├── Phase 2: Login + Register
└── Phase 3: Globe homepage

Week 3
├── Phase 4: Stock detail + chart + buy/sell
└── Phase 5: Dashboard

Week 4
├── Phase 6: Stocks list + Orders + Wallet + Watchlist
└── Phase 7: Vercel deployment + testing

After Submission
├── Limit order matching engine
├── Live FX rates
└── Analytics
```

---

## Deferred Backend (Post-Submission)

| Feature | Why Deferred |
|---|---|
| Limit order matching engine | Frontend works with market orders for now |
| Live FX rates | Hardcoded rates in `.env` sufficient for MVP |
| Price alerts | Needs new DB table + cron job |
| WebSockets | Polling every 10s sufficient for MVP |
| Redis cache | Not needed at current traffic |
| Stock fundamentals, news, indices | Phase 4/5 features |