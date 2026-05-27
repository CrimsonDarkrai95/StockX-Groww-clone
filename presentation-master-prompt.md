# StockX — Figma Make Presentation Master Prompt

> **Instructions for Figma Make**
> Copy this entire document into Figma Make as the prompt.
> Each `---` separator is a **new slide**.
> Every fenced code block should be rendered in a dark-background code panel using the font **JetBrains Mono**.
> Use the design tokens defined in Slide 2 for all colours, typography and spacing throughout the deck.

---

## SLIDE 1 — Cover / Project Overview

**Title:** StockX — Global Markets Platform

**Subtitle:** A full-stack stock-trading simulation platform covering 14,732 stocks across 7 global exchanges, built with Node.js + PostgreSQL on the backend and a single-file HTML/JS frontend.

**Stats row (3 cards):**
| Stat | Value |
|---|---|
| Stocks tracked | 14,732 |
| Global exchanges | NSE · NYSE · NASDAQ · LSE · SGX · HKEX · TSE |
| Price sync interval | Every 10 seconds (Yahoo Finance) |

**Live URL:** `https://stockx-groww-clone-production.up.railway.app`

---

## SLIDE 2 — Design System & Colour Tokens

**Title:** Design System

Display every token as a coloured swatch with its variable name and hex value.

```css
/* ── Colour Palette ── */
--bg:        #0b0e14   /* Page background      */
--surface:   #111620   /* Card / panel surface */
--surface2:  #161c2a   /* Hover surface        */
--border:    #1e2535   /* Dividers             */
--accent:    #5076ee   /* Primary blue         */
--green:     #00e5a0   /* Gains / success      */
--red:       #ff4d6d   /* Losses / danger      */
--amber:     #f5a623   /* Warning / NSE colour */
--text:      #c9d1e0   /* Body text            */
--muted:     #556070   /* Captions / labels    */

/* ── Typography ── */
--font-ui:   'Syne', sans-serif          /* All UI labels        */
--font-mono: 'JetBrains Mono', monospace /* Prices / code / data */

/* ── Shape ── */
--radius:    6px   /* Cards          */
--radius-lg: 10px  /* Sections       */
```

---

## SLIDE 3 — Architecture Overview

**Title:** System Architecture

**Diagram description:**
```
Browser (stockx-frontendv2.html)
        │
        │  REST / JSON  (Bearer JWT)
        ▼
  Express.js Server  (index.js)
        │
  ┌─────┼──────────────────────────────────────────────┐
  │     │                                              │
routes/ auth.js      routes/ stocks.js    routes/ orders.js
  │     │                  │                    │
  │  controllers/      controllers/         controllers/
  │  authController    stocksController     orderController
  │     │                  │                    │
  └─────┴──────────────────┴────────────────────┘
                           │
                    config/db.js  (pg Pool)
                           │
                    Supabase PostgreSQL
                           │
               ┌───────────┴───────────┐
          services/               seed.sql
          priceSync.js           schema.sql
          (Yahoo Finance,
           every 10 s)
```

**Tech stack table:**
| Layer | Technology |
|---|---|
| Runtime | Node.js 20 LTS |
| Framework | Express 5 |
| Database | PostgreSQL via Supabase |
| ORM / Query | `pg` (node-postgres) |
| Auth | JWT (access 15 min) + UUID refresh tokens (7 days) |
| Password hashing | bcrypt (10 rounds) |
| Live prices | yahoo-finance2 |
| Deployment | Railway (backend) |
| Frontend | Vanilla HTML + CSS + JS (single file) |
| Globe | globe.gl v2 + Three.js |

---

## SLIDE 4 — Database Schema

**Title:** PostgreSQL Schema

```sql
-- ── USERS ──────────────────────────────────────────────
CREATE TABLE users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT UNIQUE NOT NULL,
  hashed_password  TEXT NOT NULL,
  balance          NUMERIC(20,8) DEFAULT 100000,
  home_currency    TEXT DEFAULT 'INR',
  kyc_status       TEXT DEFAULT 'pending',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── REFRESH TOKENS ─────────────────────────────────────
CREATE TABLE refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,              -- NULL = still valid
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON refresh_tokens(user_id);

-- ── STOCKS ─────────────────────────────────────────────
CREATE TABLE stocks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol           TEXT NOT NULL,
  company_name     TEXT,
  exchange         TEXT,               -- NSE | NYSE | NASDAQ | LSE | SGX
  listing_currency TEXT,               -- INR | USD | GBP | SGD
  sector           TEXT,
  current_price    NUMERIC(20,8),
  market_cap       NUMERIC(30,2),
  pe_ratio         NUMERIC(10,4),
  dividend_yield   NUMERIC(10,4),
  is_active        BOOLEAN DEFAULT true,
  last_synced_at   TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ
);
CREATE UNIQUE INDEX ON stocks(symbol, exchange);

-- ── MARKET DATA (OHLCV) ────────────────────────────────
CREATE TABLE market_data (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id UUID REFERENCES stocks(id) ON DELETE CASCADE,
  date     DATE NOT NULL,
  open     NUMERIC(20,8),
  high     NUMERIC(20,8),
  low      NUMERIC(20,8),
  close    NUMERIC(20,8),
  volume   BIGINT,
  UNIQUE(stock_id, date)
);

-- ── PORTFOLIOS & HOLDINGS ──────────────────────────────
CREATE TABLE portfolios (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT DEFAULT 'My Portfolio',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE holdings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id   UUID REFERENCES portfolios(id) ON DELETE CASCADE,
  stock_id       UUID REFERENCES stocks(id),
  quantity       NUMERIC(20,8) NOT NULL,
  avg_cost_price NUMERIC(20,8) NOT NULL,
  updated_at     TIMESTAMPTZ,
  UNIQUE(portfolio_id, stock_id)
);

-- ── ORDERS & TRADES ────────────────────────────────────
CREATE TABLE orders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id),
  stock_id    UUID REFERENCES stocks(id),
  order_type  TEXT,         -- 'market' | 'limit'
  side        TEXT,         -- 'buy' | 'sell'
  quantity    NUMERIC(20,8),
  limit_price NUMERIC(20,8),
  status      TEXT,         -- 'open' | 'executed' | 'cancelled'
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE trades (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES users(id),
  stock_id              UUID REFERENCES stocks(id),
  order_id              UUID REFERENCES orders(id),
  side                  TEXT,
  quantity              NUMERIC(20,8),
  price                 NUMERIC(20,8),
  fx_rate_at_execution  NUMERIC(10,6) DEFAULT 1.0,
  total_value           NUMERIC(20,8),
  executed_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ── WALLET TRANSACTIONS ────────────────────────────────
CREATE TABLE wallet_transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES users(id),
  txn_type            TEXT,   -- 'deposit' | 'withdrawal' | 'buy' | 'sell'
  amount              NUMERIC(20,8),
  balance_before      NUMERIC(20,8),
  balance_after       NUMERIC(20,8),
  reference_order_id  UUID REFERENCES orders(id),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── WATCHLISTS ─────────────────────────────────────────
CREATE TABLE watchlists (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID REFERENCES users(id) ON DELETE CASCADE,
  stock_id UUID REFERENCES stocks(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, stock_id)
);
```

---

## SLIDE 5 — Server Entry Point

**Title:** `index.js` — Express Server Bootstrap

**Key points to highlight:**
- All routes mounted under `/api/`
- `cors()` open for development (swap for `FRONTEND_URL` before production)
- Global error handler converts unhandled throws to `500` JSON
- `startPriceSync()` kicks off the background price loop on startup

```js
// index.js
process.env.NODE_NO_WARNINGS = '1';
require('dotenv').config();

const express = require('express');
const cors    = require('cors');

const authRoutes         = require('./routes/auth');
const stocksRoutes       = require('./routes/stocks');
const ordersRoutes       = require('./routes/orders');
const portfolioRoutes    = require('./routes/portfolio');
const transactionsRoutes = require('./routes/transactions');
const watchlistRoutes    = require('./routes/watchlist');
const { startPriceSync } = require('./services/priceSync');

const app = express();

app.use(cors());
// app.use(cors({ origin: process.env.FRONTEND_URL })); // ← enable before production
app.use(express.json());

app.use('/api/auth',      authRoutes);
app.use('/api/stocks',    stocksRoutes);
app.use('/api/orders',    ordersRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/wallet',    transactionsRoutes);
app.use('/api/watchlist', watchlistRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false, data: null, error: err.message || 'Internal server error'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  startPriceSync();   // ← background loop starts here
});
```

---

## SLIDE 6 — Database Connection

**Title:** `config/db.js` — PostgreSQL Connection Pool

```js
// config/db.js
'use strict';
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }  // required for Supabase
});

module.exports = pool;
```

**Environment variables required (`.env.example`):**
```
DATABASE_URL=          # Supabase PostgreSQL connection string
JWT_SECRET=            # Secret for signing JWTs
PORT=3000
NODE_NO_WARNINGS=1
FX_USD_INR=            # e.g. 83.5
FX_SGD_INR=            # e.g. 62.0
FX_GBP_INR=            # e.g. 106.0
```

---

## SLIDE 7 — Auth Middleware

**Title:** `middleware/authMiddleware.js` — JWT Guard

**How it works:**
1. Reads the `Authorization: Bearer <token>` header
2. Verifies signature against `JWT_SECRET`
3. Attaches decoded `{ id }` payload to `req.user`
4. Returns `401` if token is absent, malformed, or expired

```js
// middleware/authMiddleware.js
'use strict';
const jwt = require('jsonwebtoken');

module.exports = function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;   // { id: uuid, iat, exp }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};
```

---

## SLIDE 8 — Authentication Controller (Part 1 — Register & Login)

**Title:** `controllers/authController.js` — Register & Login

**Token strategy:**
- **Access token** — JWT, signed with `JWT_SECRET`, expires in **15 minutes**
- **Refresh token** — random UUID v4, bcrypt-hashed and stored in DB, expires in **7 days**

```js
// controllers/authController.js  (register + login)
const jwt    = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const pool   = require('../config/db');

const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_DAYS = 7;

// ── Create short-lived JWT ──────────────────────────────
const createAccessToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });

// ── Store hashed refresh token in DB ───────────────────
const createAndStoreRefreshToken = async (client, userId) => {
  const refreshToken = uuidv4();                          // random opaque token
  const tokenHash    = await bcrypt.hash(refreshToken, 10);
  const expiresAt    = new Date(
    Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000
  );
  await client.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
  return refreshToken;   // raw token returned to client ONCE — never stored plain
};

// ── POST /api/auth/register ─────────────────────────────
const register = async (req, res) => {
  const client = await pool.connect();
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, error: 'Email and password required' });

    await client.query('BEGIN');

    const hashed = await bcrypt.hash(password, 10);
    const result = await client.query(
      `INSERT INTO users (email, hashed_password)
       VALUES ($1, $2)
       RETURNING id, email, balance, home_currency, kyc_status`,
      [email, hashed]
    );
    const user         = result.rows[0];
    const accessToken  = createAccessToken(user.id);
    const refreshToken = await createAndStoreRefreshToken(client, user.id);

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      data: { accessToken, refreshToken, user },
      error: null,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23505')   // unique violation on email
      return res.status(409).json({ success: false, error: 'Email already registered' });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  } finally {
    client.release();
  }
};

// ── POST /api/auth/login ────────────────────────────────
const login = async (req, res) => {
  const client = await pool.connect();
  try {
    const { email, password } = req.body;

    const result = await client.query(
      `SELECT id, email, hashed_password, balance, home_currency, kyc_status
       FROM users WHERE email = $1`,
      [email]
    );
    const user = result.rows[0];

    // bcrypt.compare handles timing-safe comparison
    if (!user || !(await bcrypt.compare(password, user.hashed_password)))
      return res.status(401).json({ success: false, error: 'Invalid credentials' });

    await client.query('BEGIN');
    const accessToken  = createAccessToken(user.id);
    const refreshToken = await createAndStoreRefreshToken(client, user.id);
    await client.query('COMMIT');

    return res.json({ success: true, data: { accessToken, refreshToken, user } });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    return res.status(500).json({ success: false, error: 'Internal server error' });
  } finally {
    client.release();
  }
};
```

---

## SLIDE 9 — Authentication Controller (Part 2 — Refresh & Logout)

**Title:** `controllers/authController.js` — Token Refresh & Logout

```js
// controllers/authController.js  (refreshToken + logout)

// ── POST /api/auth/refresh ──────────────────────────────
// Body: { refreshToken, userId }
// Only scans tokens for that specific user — avoids full-table scan
const refreshToken = async (req, res) => {
  const { refreshToken, userId } = req.body || {};
  if (!refreshToken || !userId)
    return res.status(400).json({ success: false, error: 'refreshToken and userId are required' });

  const result = await pool.query(
    `SELECT id, user_id, token_hash
     FROM refresh_tokens
     WHERE user_id = $1
       AND revoked_at IS NULL
       AND expires_at > NOW()`,
    [userId]
  );

  let matchedRow = null;
  for (const row of result.rows) {
    if (await bcrypt.compare(refreshToken, row.token_hash)) {
      matchedRow = row;
      break;
    }
  }

  if (!matchedRow)
    return res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });

  const accessToken = createAccessToken(matchedRow.user_id);
  return res.json({ success: true, data: { accessToken } });
};

// ── POST /api/auth/logout  (requires valid JWT) ─────────
// Finds and soft-deletes the matching refresh token (sets revoked_at)
const logout = async (req, res) => {
  const userId = req.user.id;
  const { refreshToken } = req.body || {};
  if (!refreshToken)
    return res.status(400).json({ success: false, error: 'refreshToken is required' });

  const result = await pool.query(
    `SELECT id, token_hash FROM refresh_tokens
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );

  let tokenIdToRevoke = null;
  for (const row of result.rows) {
    if (await bcrypt.compare(refreshToken, row.token_hash)) {
      tokenIdToRevoke = row.id;
      break;
    }
  }

  if (tokenIdToRevoke) {
    await pool.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`,
      [tokenIdToRevoke]
    );
  }

  return res.status(200).json({ success: true, data: null, error: null });
};
```

---

## SLIDE 10 — Stocks Controller (Part 1 — List & Detail)

**Title:** `controllers/stocksController.js` — GET /api/stocks & GET /api/stocks/:symbol

```js
// controllers/stocksController.js

// ── GET /api/stocks  (search + filter + pagination) ─────
const getAllStocks = async (req, res) => {
  const { search, exchange, sector } = req.query;
  const page   = parseInt(req.query.page,  10) || 1;
  const limit  = parseInt(req.query.limit, 10) || 20;
  const offset = (page - 1) * limit;

  const whereClauses = ['is_active = true'];
  const params = [];
  let paramIndex = 1;

  if (search) {
    whereClauses.push(`(symbol ILIKE $${paramIndex} OR company_name ILIKE $${paramIndex})`);
    params.push(`%${search}%`);
    paramIndex++;
  }
  if (exchange) { whereClauses.push(`exchange = $${paramIndex}`); params.push(exchange); paramIndex++; }
  if (sector)   { whereClauses.push(`sector = $${paramIndex}`);   params.push(sector);   paramIndex++; }

  const query = `
    SELECT id, symbol, company_name, exchange, listing_currency,
           sector, current_price, is_active, created_at,
           COUNT(*) OVER () AS total     -- window fn for total without extra query
    FROM stocks
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY symbol ASC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  params.push(limit, offset);

  const result     = await pool.query(query, params);
  const total      = result.rows.length > 0 ? parseInt(result.rows[0].total, 10) : 0;
  const totalPages = Math.ceil(total / limit);

  return res.json({
    success: true,
    data: {
      stocks: result.rows.map(({ total: _t, ...rest }) => rest),
      total, page, limit, totalPages,
    },
  });
};

// ── GET /api/stocks/:symbol  (detail + 30-day history) ──
const getStockBySymbol = async (req, res) => {
  const { symbol } = req.params;

  const stockResult = await pool.query(
    `SELECT id, symbol, company_name, exchange, listing_currency,
            sector, current_price, is_active, created_at,
            market_cap, pe_ratio, dividend_yield
     FROM stocks WHERE symbol = $1`,
    [symbol.toUpperCase()]
  );
  if (stockResult.rowCount === 0)
    return res.status(404).json({ success: false, error: 'Stock not found' });

  const stock = stockResult.rows[0];

  // Fetch last 30 days of OHLCV for the chart
  const priceHistoryResult = await pool.query(
    `SELECT date, open, high, low, close, volume
     FROM market_data
     WHERE stock_id = $1
       AND date >= (CURRENT_DATE - INTERVAL '30 days')
     ORDER BY date ASC`,
    [stock.id]
  );

  return res.json({
    success: true,
    data: { stock, priceHistory: priceHistoryResult.rows },
  });
};
```

---

## SLIDE 11 — Stocks Controller (Part 2 — Lookup / Upsert via Yahoo Finance)

**Title:** `controllers/stocksController.js` — GET /api/stocks/lookup

**Flow:**
1. Check DB first (case-insensitive symbol OR name match)
2. If not found → try `yahooFinance.quote(q)` directly
3. If quote fails → fall back to `yahooFinance.search(q)` → pick first EQUITY → re-quote
4. Normalise Yahoo exchange codes → our standard labels (NMS/NGM → NASDAQ, NYQ/NYS → NYSE, etc.)
5. Upsert into DB — `ON CONFLICT (symbol, exchange) DO UPDATE` price only

```js
// controllers/stocksController.js  (getStockLookup)
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

const getStockLookup = async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Query param q is required' });

  // 1. DB check first
  const existing = await pool.query(
    `SELECT * FROM stocks WHERE symbol ILIKE $1 OR company_name ILIKE $1 LIMIT 1`,
    [q]
  );
  if (existing.rowCount > 0)
    return res.json({ success: true, data: existing.rows[0] });

  // 2. Direct Yahoo quote
  let quote = null;
  try {
    const result = await yahooFinance.quote(q.toUpperCase());
    if (result && typeof result.regularMarketPrice === 'number') quote = result;
  } catch (_) { /* fall through */ }

  // 3. Fallback: Yahoo search → first EQUITY
  if (!quote) {
    const searchResult = await yahooFinance.search(q);
    const bestMatch = searchResult?.quotes?.find(i => i.quoteType === 'EQUITY');
    if (bestMatch?.symbol) {
      const result = await yahooFinance.quote(bestMatch.symbol);
      if (result?.regularMarketPrice) quote = result;
    }
  }

  if (!quote) return res.status(404).json({ error: 'Symbol not found' });

  // 4. Normalise exchange codes
  const rawExchange = (quote.exchange || '').toUpperCase();
  const exchangeMap = {
    NMS: 'NASDAQ', NGM: 'NASDAQ', NCM: 'NASDAQ', NASDAQ: 'NASDAQ',
    NYQ: 'NYSE',   NYS: 'NYSE',   NYSE: 'NYSE',
    NSI: 'NSE',    NSE: 'NSE',
    LSE: 'LSE',    IOB: 'LSE',
    SES: 'SGX',    SGX: 'SGX',
  };
  const exchange        = exchangeMap[rawExchange] || rawExchange || 'UNKNOWN';
  const currencyMap     = { NSE:'INR', LSE:'GBP', SGX:'SGD', NYSE:'USD', NASDAQ:'USD' };
  const listingCurrency = quote.currency || currencyMap[exchange] || 'USD';

  // 5. Upsert — only price fields updated on conflict
  const insertResult = await pool.query(
    `INSERT INTO stocks
       (symbol, company_name, exchange, listing_currency, is_active, current_price, last_synced_at)
     VALUES ($1, $2, $3, $4, true, $5, NOW())
     ON CONFLICT (symbol, exchange) DO UPDATE SET
       current_price  = EXCLUDED.current_price,
       last_synced_at = EXCLUDED.last_synced_at
     RETURNING *`,
    [quote.symbol.toUpperCase(), quote.longName || quote.shortName, exchange, listingCurrency, quote.regularMarketPrice]
  );

  return res.json({ success: true, data: insertResult.rows[0] });
};
```

---

## SLIDE 12 — Order Controller (Part 1 — Place Market Order)

**Title:** `controllers/orderController.js` — POST /api/orders (Market)

**Market order execution is fully atomic — all 7 steps run in a single DB transaction:**

```js
// controllers/orderController.js  (placeOrder — market path)

// Weighted-average cost formula used when adding to an existing position
function computeNewAvg(oldQty, oldAvg, newQty, newPrice) {
  const totalQty = parseFloat(oldQty) + parseFloat(newQty);
  return (parseFloat(oldQty) * parseFloat(oldAvg) + parseFloat(newQty) * parseFloat(newPrice)) / totalQty;
}

async function placeOrder(req, res) {
  const { stockId, orderType, side, quantity, limitPrice } = req.body;
  // ... validation omitted for brevity ...

  const stock          = (await pool.query('SELECT * FROM stocks WHERE id = $1', [stockId])).rows[0];
  const executionPrice = parseFloat(stock.current_price);
  const totalValue     = qty * executionPrice;

  const client = await pool.connect();
  await client.query('BEGIN');

  // Step 1 — Lock user row, read balance
  const userRes      = await client.query('SELECT balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
  const balanceBefore = parseFloat(userRes.rows[0].balance);

  // Step 2 — Insufficient balance guard (buy only)
  if (side === 'buy' && balanceBefore < totalValue) {
    await client.query('ROLLBACK');
    return res.status(400).json({ error: 'Insufficient balance.' });
  }

  // Step 3 — Insert order record (status = 'executed')
  const order = (await client.query(
    `INSERT INTO orders (user_id, stock_id, order_type, side, quantity, status)
     VALUES ($1, $2, 'market', $3, $4, 'executed') RETURNING *`,
    [userId, stockId, side, qty]
  )).rows[0];

  // Step 4 — Insert trade record
  const trade = (await client.query(
    `INSERT INTO trades (user_id, stock_id, order_id, side, quantity, price, fx_rate_at_execution, total_value)
     VALUES ($1, $2, $3, $4, $5, $6, 1.0, $7) RETURNING *`,
    [userId, stockId, order.id, side, qty, executionPrice, totalValue]
  )).rows[0];

  // Step 5 — Update balance with DB arithmetic (avoids JS float drift)
  const op = side === 'buy' ? '-' : '+';
  const balanceAfter = parseFloat(
    (await client.query(
      `UPDATE users SET balance = balance ${op} $1 WHERE id = $2 RETURNING balance`,
      [totalValue.toFixed(8), userId]
    )).rows[0].balance
  );

  // Step 6 — Immutable wallet_transactions audit row
  await client.query(
    `INSERT INTO wallet_transactions
       (user_id, txn_type, amount, balance_before, balance_after, reference_order_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, side, totalValue.toFixed(8), balanceBefore.toFixed(8), balanceAfter.toFixed(8), order.id]
  );

  // Step 7 — Upsert holdings (weighted-average cost on buy; delete row when fully sold)
  if (side === 'buy') {
    const existing = (await client.query(
      'SELECT quantity, avg_cost_price FROM holdings WHERE portfolio_id = $1 AND stock_id = $2',
      [portfolioId, stockId]
    )).rows[0];

    const newQty     = existing ? parseFloat(existing.quantity) + qty : qty;
    const newAvgCost = existing ? computeNewAvg(existing.quantity, existing.avg_cost_price, qty, executionPrice) : executionPrice;

    await client.query(
      `INSERT INTO holdings (portfolio_id, stock_id, quantity, avg_cost_price)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (portfolio_id, stock_id) DO UPDATE SET
         quantity = $3, avg_cost_price = $4, updated_at = NOW()`,
      [portfolioId, stockId, newQty.toFixed(8), newAvgCost.toFixed(8)]
    );
  } else {
    // SELL — lock row, check sufficient qty, reduce or delete
    const holding = (await client.query(
      'SELECT quantity FROM holdings WHERE portfolio_id = $1 AND stock_id = $2 FOR UPDATE',
      [portfolioId, stockId]
    )).rows[0];

    const remaining = parseFloat(holding.quantity) - qty;
    if (remaining <= 0) {
      await client.query('DELETE FROM holdings WHERE portfolio_id = $1 AND stock_id = $2', [portfolioId, stockId]);
    } else {
      await client.query('UPDATE holdings SET quantity = $1, updated_at = NOW() WHERE portfolio_id = $2 AND stock_id = $3',
        [remaining.toFixed(8), portfolioId, stockId]);
    }
  }

  await client.query('COMMIT');
  return res.status(201).json({ success: true, data: { order, trade, updatedBalance: balanceAfter } });
}
```

---

## SLIDE 13 — Order Controller (Part 2 — Limit Orders & History)

**Title:** `controllers/orderController.js` — Limit Orders & GET /api/orders/history

```js
// ── LIMIT ORDER path (early return, no balance reservation yet) ──
if (orderType === 'limit') {
  const lp       = parseFloat(limitPrice);
  const orderRes = await pool.query(
    `INSERT INTO orders (user_id, stock_id, order_type, side, quantity, limit_price, status)
     VALUES ($1, $2, 'limit', $3, $4, $5, 'open') RETURNING *`,
    [userId, stockId, side, qty, lp]
  );
  return res.status(201).json({
    success: true,
    data: { order: orderRes.rows[0], trade: null, updatedBalance: null },
  });
  // NOTE: Limit orders are stored as 'open'.
  // A future matching engine will fill them when market price crosses the limit.
}

// ── GET /api/orders/history ─────────────────────────────
async function getOrderHistory(req, res) {
  const result = await pool.query(
    `SELECT
       o.id, o.order_type, o.side, o.quantity, o.limit_price, o.status, o.created_at,
       s.symbol, s.company_name, s.listing_currency,
       t.price       AS executed_price,
       t.total_value AS executed_total,
       t.executed_at
     FROM orders o
     JOIN stocks  s ON s.id = o.stock_id
     LEFT JOIN trades t ON t.order_id = o.id   -- LEFT JOIN: limit orders have no trade yet
     WHERE o.user_id = $1
     ORDER BY o.created_at DESC`,
    [req.user.id]
  );
  return res.json({ success: true, data: { orders: result.rows } });
}
```

---

## SLIDE 14 — Portfolio Controller (FX Conversion & P&L)

**Title:** `controllers/portfolioController.js` — GET /api/portfolio

**Key concept:** All holding values are converted to the user's `home_currency` using hardcoded FX rates (configurable via env vars).

```js
// controllers/portfolioController.js

// FX rates relative to INR (base = 1.0)
const FX_RATES = {
  INR: 1.0,
  USD: parseFloat(process.env.FX_USD_INR || '83.5'),
  SGD: parseFloat(process.env.FX_SGD_INR || '62.0'),
  GBP: parseFloat(process.env.FX_GBP_INR || '106.0'),
};

const getPortfolio = async (req, res) => {
  // ... fetch user, portfolio, holdings ...

  let totalConvertedInvested = 0;
  let totalConvertedCurrent  = 0;

  const holdings = holdingsResult.rows.map((row) => {
    const qty          = parseFloat(row.quantity);
    const avgCost      = parseFloat(row.avg_cost_price);
    const currentPrice = parseFloat(row.current_price ?? 0);

    // Raw P&L in listing currency
    const currentValue  = qty * currentPrice;
    const investedValue = qty * avgCost;
    const pnl           = currentValue - investedValue;
    const pnlPct        = investedValue !== 0 ? (pnl / investedValue) * 100 : 0;

    // Convert to home currency
    // Example: USD stock → multiply by FX_USD_INR; then divide by home-currency rate
    const fromRate = FX_RATES[row.listing_currency] || 1.0;
    const toRate   = FX_RATES[homeCurrency]          || 1.0;

    const convertedCurrent  = currentValue  * fromRate / toRate;
    const convertedInvested = investedValue * fromRate / toRate;
    const convertedPnl      = convertedCurrent - convertedInvested;
    const convertedPnlPct   = convertedInvested !== 0
      ? (convertedPnl / convertedInvested) * 100
      : 0;

    totalConvertedInvested += convertedInvested;
    totalConvertedCurrent  += convertedCurrent;

    return {
      symbol: row.symbol,
      quantity: qty,
      avgCostPrice: avgCost,
      currentPrice,
      pnl:           parseFloat(pnl.toFixed(8)),
      pnlPct:        parseFloat(pnlPct.toFixed(4)),
      convertedPnl:  parseFloat(convertedPnl.toFixed(8)),
      convertedPnlPct: parseFloat(convertedPnlPct.toFixed(4)),
      displayCurrency: homeCurrency,
    };
  });

  return res.json({
    success: true,
    data: {
      holdings,
      summary: {
        totalCurrentValue: parseFloat(totalConvertedCurrent.toFixed(8)),
        totalInvestedValue: parseFloat(totalConvertedInvested.toFixed(8)),
        totalPnl:    parseFloat((totalConvertedCurrent - totalConvertedInvested).toFixed(8)),
        totalPnlPct: parseFloat(
          (totalConvertedInvested !== 0
            ? ((totalConvertedCurrent - totalConvertedInvested) / totalConvertedInvested) * 100
            : 0
          ).toFixed(4)
        ),
        displayCurrency: homeCurrency,
      },
      fx_rates_used: FX_RATES,
    },
  });
};
```

---

## SLIDE 15 — Wallet / Transactions Controller

**Title:** `controllers/transactionsController.js` — Deposit, Withdraw & Balance

**Design principle:** Every balance change (deposit, withdraw, buy, sell) writes an **immutable `wallet_transactions` row** recording `balance_before` and `balance_after` — a full financial audit trail.

```js
// controllers/transactionsController.js

// ── POST /api/wallet/deposit ────────────────────────────
const deposit = async (req, res) => {
  const parsedAmount = parseFloat(req.body.amount);
  const client = await pool.connect();
  await client.query('BEGIN');

  const lockRes       = await client.query('SELECT balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
  const balanceBefore = parseFloat(lockRes.rows[0].balance);
  const balanceAfter  = balanceBefore + parsedAmount;

  await client.query('UPDATE users SET balance = $1 WHERE id = $2', [balanceAfter.toFixed(8), userId]);

  // Immutable audit record
  await client.query(
    `INSERT INTO wallet_transactions
       (user_id, txn_type, amount, balance_before, balance_after)
     VALUES ($1, 'deposit', $2, $3, $4)`,
    [userId, parsedAmount.toFixed(8), balanceBefore.toFixed(8), balanceAfter.toFixed(8)]
  );

  await client.query('COMMIT');
  return res.json({ success: true, data: { balanceBefore, balanceAfter } });
};

// ── POST /api/wallet/withdraw ───────────────────────────
// Same pattern — but checks balanceBefore >= amount first
const withdraw = async (req, res) => {
  // ... same lock + read pattern ...
  if (balanceBefore < parsedAmount) {
    await client.query('ROLLBACK');
    return res.status(422).json({ error: 'Insufficient funds' });
  }
  // ... update balance, insert 'withdrawal' transaction, COMMIT ...
};

// ── GET /api/wallet/balance ─────────────────────────────
const getBalance = async (req, res) => {
  const userRes = await pool.query(
    'SELECT balance, home_currency FROM users WHERE id = $1',
    [req.user.id]
  );
  const txnRes = await pool.query(
    `SELECT id, txn_type, amount, balance_before, balance_after, created_at
     FROM wallet_transactions
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 10`,
    [req.user.id]
  );
  return res.json({
    success: true,
    data: {
      balance: userRes.rows[0].balance,
      homeCurrency: userRes.rows[0].home_currency,
      recentTransactions: txnRes.rows,   // last 10 tx for the wallet page
    },
  });
};
```

---

## SLIDE 16 — Watchlist Controller

**Title:** `controllers/watchlistController.js` — GET / POST / DELETE /api/watchlist

```js
// controllers/watchlistController.js

// ── GET /api/watchlist ──────────────────────────────────
const getWatchlist = async (req, res) => {
  const result = await pool.query(
    `SELECT w.id, w.stock_id, w.added_at,
            s.symbol, s.company_name, s.exchange, s.listing_currency, s.current_price
     FROM watchlists w
     JOIN stocks s ON s.id = w.stock_id
     WHERE w.user_id = $1
     ORDER BY w.added_at DESC`,
    [req.user.id]
  );
  return res.json({ success: true, data: result.rows });
};

// ── POST /api/watchlist ─────────────────────────────────
const addToWatchlist = async (req, res) => {
  const { stockId } = req.body;

  // Verify stock exists first
  const stockRes = await pool.query('SELECT * FROM stocks WHERE id = $1', [stockId]);
  if (stockRes.rowCount === 0)
    return res.status(404).json({ error: 'Stock not found' });

  const insertRes = await pool.query(
    `INSERT INTO watchlists (user_id, stock_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, stock_id) DO NOTHING   -- idempotent
     RETURNING id, stock_id, added_at`,
    [req.user.id, stockId]
  );

  if (insertRes.rowCount === 0)
    return res.status(409).json({ error: 'Stock is already in your watchlist' });

  return res.status(201).json({ success: true, data: { ...insertRes.rows[0], ...stockRes.rows[0] } });
};

// ── DELETE /api/watchlist/:stockId ──────────────────────
const removeFromWatchlist = async (req, res) => {
  const deleteRes = await pool.query(
    'DELETE FROM watchlists WHERE user_id = $1 AND stock_id = $2',
    [req.user.id, req.params.stockId]
  );
  if (deleteRes.rowCount === 0)
    return res.status(404).json({ error: 'Stock not found in your watchlist' });

  return res.json({ success: true, data: { removed: req.params.stockId } });
};
```

---

## SLIDE 17 — Live Price Sync Service

**Title:** `services/priceSync.js` — Background Price Sync (every 10 s)

**Two-tier strategy:**
- **Tier 1** — stocks in active holdings OR watchlists → always synced every cycle
- **Tier 2** — rotating batch of up to 50 stale stocks (not synced in > 2 min)

```js
// services/priceSync.js
'use strict';
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();
const pool         = require('../config/db');

// Yahoo uses suffix notation for non-US exchanges
const mapToYahooTicker = (symbol, exchange) => {
  switch (exchange) {
    case 'NSE':    return `${symbol}.NS`;   // e.g. RELIANCE.NS
    case 'BSE':    return `${symbol}.BO`;
    case 'SGX':    return `${symbol}.SI`;
    case 'LSE':    return `${symbol}.L`;
    default:       return symbol;           // NYSE / NASDAQ — no suffix
  }
};

const startPriceSync = () => {
  setInterval(async () => {

    // ── Tier 1: user-relevant stocks ──────────────────────
    const tier1 = (await pool.query(
      `SELECT DISTINCT s.id, s.symbol, s.exchange FROM stocks s
       WHERE s.id IN (
         SELECT stock_id FROM holdings WHERE quantity > 0
         UNION
         SELECT stock_id FROM watchlists
       ) AND s.is_active = true`
    )).rows;

    // ── Tier 2: stalest active stocks (up to 50) ──────────
    const tier2 = (await pool.query(
      `SELECT id, symbol, exchange FROM stocks
       WHERE is_active = true
         AND (last_synced_at IS NULL OR last_synced_at < NOW() - INTERVAL '2 minutes')
       ORDER BY last_synced_at ASC NULLS FIRST
       LIMIT 50`
    )).rows;

    // Merge — Tier 1 takes priority (Map deduplication)
    const merged = new Map();
    tier1.forEach(s => merged.set(s.id, s));
    tier2.forEach(s => { if (!merged.has(s.id)) merged.set(s.id, s); });

    for (const stock of merged.values()) {
      const ticker = mapToYahooTicker(stock.symbol, stock.exchange);
      try {
        const quote  = await yahooFinance.quote(ticker);
        const price  = quote?.regularMarketPrice;
        const volume = quote?.regularMarketVolume || 0;

        if (typeof price !== 'number') continue;  // skip — no valid price

        const client = await pool.connect();
        await client.query('BEGIN');

        // Update live price on stocks table
        await client.query(
          `UPDATE stocks SET current_price = $1, last_synced_at = NOW() WHERE id = $2`,
          [price, stock.id]
        );

        // Upsert OHLCV for today
        // open is only set on first INSERT — never overwritten; preserves true open
        await client.query(
          `INSERT INTO market_data (stock_id, date, open, high, low, close, volume)
           VALUES ($1, CURRENT_DATE, $2, $2, $2, $2, $3)
           ON CONFLICT (stock_id, date) DO UPDATE SET
             high   = GREATEST(market_data.high, EXCLUDED.high),
             low    = LEAST(market_data.low, EXCLUDED.low),
             close  = EXCLUDED.close,
             volume = EXCLUDED.volume`,
          [stock.id, price, volume]
        );

        await client.query('COMMIT');
        client.release();
      } catch (err) {
        // Per-symbol catch — one failure does not stop the loop
        console.error(`[priceSync] error for ${ticker}:`, err.message);
      }
    }
  }, 10000);  // ← runs every 10 seconds
};

module.exports = { startPriceSync };
```

---

## SLIDE 18 — Market Data Seed Script

**Title:** `seed.sql` — 30-Day OHLCV Seed for All Stocks

**Purpose:** Generates synthetic but realistic candlestick data for every stock so the price chart works immediately without waiting for the live sync to accumulate history.

```sql
-- seed.sql
DO $$
DECLARE
  stock_rec    RECORD;
  day_offset   INTEGER;
  price        NUMERIC(20,8);
  open_price   NUMERIC(20,8);
  high_price   NUMERIC(20,8);
  low_price    NUMERIC(20,8);
  close_price  NUMERIC(20,8);
  base_volume  BIGINT;
  volume_val   BIGINT;
BEGIN
  FOR stock_rec IN SELECT id, exchange, current_price FROM stocks LOOP
    price := COALESCE(stock_rec.current_price, 100);

    -- Walk backwards 30 days, oldest first
    FOR day_offset IN REVERSE 0..29 LOOP
      -- Small random daily walk ±2%
      price := price * (1 + ((random() - 0.5) * 0.04));
      open_price  := ROUND(price::numeric, 4);
      high_price  := open_price * (1 + random() * 0.02);
      low_price   := open_price * (1 - random() * 0.02);
      close_price := low_price + (random() * (high_price - low_price));

      -- Volume profile by exchange
      base_volume := CASE stock_rec.exchange
        WHEN 'NSE'    THEN 1000000
        WHEN 'NYSE'   THEN 700000
        WHEN 'NASDAQ' THEN 700000
        WHEN 'LSE'    THEN 300000
        WHEN 'SGX'    THEN 200000
        ELSE               250000
      END;
      volume_val := GREATEST(1, FLOOR(base_volume * (0.8 + random() * 0.4)));

      INSERT INTO market_data (stock_id, date, open, high, low, close, volume)
      VALUES (stock_rec.id, CURRENT_DATE - day_offset,
              open_price, high_price, low_price, close_price, volume_val)
      ON CONFLICT (stock_id, date) DO NOTHING;  -- idempotent: safe to re-run
    END LOOP;
  END LOOP;
END;
$$;
```

---

## SLIDE 19 — Frontend: Design System Utility Functions

**Title:** `stockx-frontendv2.html` — Shared Utilities (JS)

```js
// ── XSS-safe HTML escape ────────────────────────────────
function escapeHtml(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Format monetary values with currency symbol ─────────
function formatMoney(value, currency = 'INR') {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const symbolMap = { INR:'₹', USD:'$', GBP:'£', SGD:'S$', HKD:'HK$', JPY:'¥' };
  return `${symbolMap[currency] || ''}${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

// ── Central fetch wrapper — auto-logout on 401 ──────────
async function apiFetch(url, options = {}) {
  const res = await fetch(url, options);
  if (res.status === 401) {
    handleLogout();
    showToast('Session expired. Please sign in again.', 'error');
    showAuth();
    throw new Error('Unauthorized');
  }
  return res;
}

// ── Build auth headers from in-memory or localStorage ───
function getAuthHeaders(extra = {}) {
  const token = authState.token || localStorage.getItem('sx_token');
  return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra };
}

// ── Debounce (used for search input) ────────────────────
function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ── Unwrap standard API envelope { success, data, error } ─
function getResponseData(json) {
  return json?.data !== undefined ? json.data : json;
}
function getResponseError(json, fallback = 'Request failed') {
  return json?.error || json?.message || fallback;
}
```

---

## SLIDE 20 — Frontend: State & Session Management

**Title:** `stockx-frontendv2.html` — Client-Side State

```js
// ── Global application state ────────────────────────────
const API = 'https://stockx-groww-clone-production.up.railway.app';

let authState = { loggedIn: false, token: null, user: null };
let currentDetailSymbol  = '';
let currentDetailStockId = null;
let currentDetailCurrency = 'INR';
let currentChartHistory  = [];
let previousPage         = 'dashboard';
let globeInst            = null;
let currentTradeTab      = 'buy';
let currentDetailPrice   = 0;
let allStocks            = [];       // full list loaded from /api/stocks
let stocksCurrentPage    = 1;
const STOCKS_PER_PAGE    = 50;
let stocksTotalFromServer = 0;
let dashboardRefreshInterval = null;
let detailRefreshInterval    = null;
const stockAnalyticsBySymbol = {};   // { [symbol]: { pct, last, volume } }

// ── Restore session from localStorage on page load ──────
const savedToken = localStorage.getItem('sx_token');
const savedUser  = localStorage.getItem('sx_user');
if (savedToken && savedUser) {
  try {
    authState = { loggedIn: true, token: savedToken, user: JSON.parse(savedUser) };
    setUserAvatar();
  } catch {
    localStorage.removeItem('sx_token');
    localStorage.removeItem('sx_user');
  }
}

// ── Page navigation with auth guard ─────────────────────
function showPage(page) {
  const PROTECTED = ['dashboard', 'stocks', 'orders', 'wallet', 'stock-detail'];

  if (PROTECTED.includes(page) && !authState.loggedIn) {
    const t = localStorage.getItem('sx_token');
    const u = localStorage.getItem('sx_user');
    if (t && u) {
      try { authState = { loggedIn: true, token: t, user: JSON.parse(u) }; } catch {}
    } else {
      showAuth();
      return;
    }
  }

  // Hide all pages, show target
  document.querySelectorAll('[id^="page-"]').forEach(el => {
    el.style.display = 'none';
    el.style.flexDirection = '';
  });
  const el = document.getElementById('page-' + page);
  if (el) { el.style.display = 'flex'; el.style.flexDirection = 'column'; }

  // Kick off data loads per page
  if (page === 'dashboard') {
    initDashboardGlobe();
    loadDashboardData();
    dashboardRefreshInterval = setInterval(() => {
      if (authState.loggedIn) loadDashboardData();
    }, 10000);  // ← refresh every 10 s to match backend sync
  }
  if (page === 'stocks')  fetchRealStocks();
  if (page === 'orders')  loadOrdersPage();
  if (page === 'wallet')  loadWalletPage();
}
```

---

## SLIDE 21 — Frontend: Login & Register Flow

**Title:** `stockx-frontendv2.html` — Authentication Handlers

```js
// ── POST /api/auth/login ────────────────────────────────
async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-password').value;

  // Client-side validation (no network call wasted on invalid input)
  let valid = true;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showFieldErr('login-email-err', true); valid = false; }
  if (pass.length < 8)                             { showFieldErr('login-pass-err', true);  valid = false; }
  if (!valid) return;

  const btn = document.getElementById('login-btn');
  btn.textContent = 'Signing in...'; btn.disabled = true;

  const res  = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pass })
  });
  const data = await res.json();

  // Backend wraps response: { success, data: { accessToken, refreshToken, user } }
  const payload      = data.data || data;
  const token        = payload.accessToken || payload.token;
  const user         = payload.user;

  if (res.ok && token) {
    authState = { loggedIn: true, token, user };
    localStorage.setItem('sx_token', token);        // persist for page refreshes
    localStorage.setItem('sx_user', JSON.stringify(user));
    setUserAvatar();
    showToast('Welcome back! 👋', 'success');
    showPage('dashboard');
  } else {
    showToast(getResponseError(data, 'Invalid credentials'), 'error');
  }
  btn.textContent = 'Sign In'; btn.disabled = false;
}

// ── Logout — clears state + localStorage ────────────────
function handleLogout() {
  authState = { loggedIn: false, token: null, user: null };
  localStorage.removeItem('sx_token');
  localStorage.removeItem('sx_user');
  showToast('Logged out', 'info');
  showPage('landing');
}
```

---

## SLIDE 22 — Frontend: Interactive 3D Globe

**Title:** `stockx-frontendv2.html` — Dashboard Globe (globe.gl)

```js
// ── Exchange coordinates & metadata ────────────────────
const EXCHANGES = {
  NSE:    { lat: 19.0760,  lng:  72.8777,  label: 'NSE',    meta: 'National Stock Exchange · India',    color: '#f5a623' },
  NYSE:   { lat: 40.7128,  lng: -74.0060,  label: 'NYSE',   meta: 'New York Stock Exchange · USA',      color: '#5076ee' },
  NASDAQ: { lat: 37.3861,  lng:-122.0839,  label: 'NASDAQ', meta: 'Nasdaq Stock Market · USA',          color: '#00e5a0' },
  LSE:    { lat: 51.5074,  lng:  -0.1278,  label: 'LSE',    meta: 'London Stock Exchange · UK',         color: '#ff4d6d' },
  SGX:    { lat:  1.3521,  lng: 103.8198,  label: 'SGX',    meta: 'Singapore Exchange · Singapore',     color: '#9b59ff' },
  HKEX:   { lat: 22.3193,  lng: 114.1694,  label: 'HKEX',   meta: 'Hong Kong Exchange · China',        color: '#ff6b35' },
  TSE:    { lat: 35.6762,  lng: 139.6503,  label: 'TSE',    meta: 'Tokyo Stock Exchange · Japan',       color: '#00b4ff' },
};

// ── Init globe (runs once when dashboard opens) ──────────
let dashGlobeInit = false;
function initDashboardGlobe() {
  if (dashGlobeInit) return;
  dashGlobeInit = true;

  const container = document.getElementById('globe-dashboard');
  if (!container || typeof Globe === 'undefined') return;

  // One point per exchange, coloured by exchange brand colour
  const points = Object.entries(EXCHANGES).map(([k, v]) => ({
    lat: v.lat, lng: v.lng, label: v.label,
    color: v.color, size: 0.65, exchange: k,
  }));

  globeInst = Globe()(container)
    .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-night.jpg')
    .backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')
    .pointsData(points)
    .pointColor('color')
    .pointRadius('size')
    .pointAltitude(0.015)
    .pointLabel(d => `
      <div style="font-family:JetBrains Mono,monospace;background:rgba(11,14,20,0.95);
                  border:1px solid rgba(80,118,238,0.5);padding:6px 10px;border-radius:6px;">
        <b style="color:${d.color}">${d.label}</b><br>
        <span style="color:#556070">${EXCHANGES[d.exchange].meta}</span>
      </div>`)
    .onPointClick(d => openExchangeTooltip(d.exchange, d));

  globeInst.controls().autoRotate      = true;
  globeInst.controls().autoRotateSpeed = 0.3;   // slow, atmospheric rotation
  setTimeout(() => globeInst.pointOfView({ altitude: 2.2 }), 300);
}

// ── Click handler — shows top stocks for that exchange ──
function openExchangeTooltip(exchangeKey, point) {
  const liveStocks = allStocks
    .filter(s => s.exchange === exchangeKey)
    .slice(0, 5)
    .map(s => ({
      sym:   s.sym,
      name:  s.name,
      price: s.price,
      chg:   stockAnalyticsBySymbol[s.sym]
               ? formatChg(stockAnalyticsBySymbol[s.sym].pct)
               : s.chg,
      up:    stockAnalyticsBySymbol[s.sym]?.pct >= 0 ?? s.up,
    }));

  // Populate and show the tooltip overlay
  const tip = document.getElementById('exchange-tooltip');
  document.getElementById('exch-name').textContent = EXCHANGES[exchangeKey].label;
  document.getElementById('exch-meta').textContent = EXCHANGES[exchangeKey].meta;
  document.getElementById('exch-stocks').innerHTML = liveStocks.map(s => `
    <div class="exch-stock-row" onclick="showStockDetail('${s.sym}','${exchangeKey}','')">
      <span class="exch-stock-sym">${escapeHtml(s.sym.split('.')[0])}</span>
      <span class="exch-stock-name">${escapeHtml(s.name)}</span>
      <span class="exch-stock-price">${escapeHtml(s.price)}</span>
      <span class="exch-stock-chg ${s.up ? 'up' : 'down'}">${escapeHtml(s.chg)}</span>
    </div>
  `).join('');
  tip.style.display = 'block';

  // Fly globe camera to the clicked exchange point
  if (globeInst) {
    globeInst.controls().autoRotate = false;
    globeInst.pointOfView({ lat: point.lat, lng: point.lng, altitude: 2.0 }, 800);
  }
}
```

---

## SLIDE 23 — Frontend: Canvas Price Chart

**Title:** `stockx-frontendv2.html` — drawPriceChart() (HTML5 Canvas)

```js
// ── Draw line chart on <canvas id="price-chart-canvas"> ─
function drawPriceChart() {
  const canvas = document.getElementById('price-chart-canvas');
  const ctx    = canvas.getContext('2d');
  const W = canvas.offsetWidth || 600;
  const H = 260;
  canvas.width = W; canvas.height = H;
  ctx.clearRect(0, 0, W, H);

  // ── 1. Select price series based on chosen period ──────
  const periodDays = { '1W': 7, '1M': 30, '3M': 90, 'ALL': Infinity };
  let prices = currentChartHistory
    .slice(-periodDays[chartPeriod])
    .map(p => Number(p.close))
    .filter(Number.isFinite);

  // Fallback: synthetic random walk if no real history yet
  if (prices.length < 2) {
    let p = currentDetailPrice * 0.95;
    prices = Array.from({ length: periodDays[chartPeriod] || 30 }, () => {
      p += (Math.random() - 0.45) * p * 0.02;
      return p;
    });
    prices[prices.length - 1] = currentDetailPrice;
  }

  // ── 2. Scale helpers ────────────────────────────────────
  const min = Math.min(...prices), max = Math.max(...prices);
  const range = max - min || 1;
  const pad = { t: 20, b: 30, l: 16, r: 16 };
  const cW = W - pad.l - pad.r,   cH = H - pad.t - pad.b;
  const x = i => pad.l + (i / (prices.length - 1)) * cW;
  const y = v => pad.t + cH - ((v - min) / range) * cH;

  // ── 3. Horizontal grid lines ────────────────────────────
  ctx.strokeStyle = 'rgba(30,37,53,0.8)'; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const yy = pad.t + (i / 4) * cH;
    ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(W - pad.r, yy); ctx.stroke();
  }

  // ── 4. Gradient fill under line ─────────────────────────
  const isUp = prices[prices.length - 1] >= prices[0];
  const grad = ctx.createLinearGradient(0, pad.t, 0, H - pad.b);
  grad.addColorStop(0, isUp ? 'rgba(0,229,160,0.22)' : 'rgba(255,77,109,0.22)');
  grad.addColorStop(1, 'rgba(11,14,20,0)');

  ctx.beginPath();
  ctx.moveTo(x(0), y(prices[0]));
  prices.forEach((p, i) => { if (i > 0) ctx.lineTo(x(i), y(p)); });
  ctx.lineTo(x(prices.length - 1), H - pad.b);
  ctx.lineTo(x(0), H - pad.b);
  ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();

  // ── 5. Line stroke ──────────────────────────────────────
  ctx.beginPath();
  ctx.moveTo(x(0), y(prices[0]));
  prices.forEach((p, i) => { if (i > 0) ctx.lineTo(x(i), y(p)); });
  ctx.strokeStyle = isUp ? '#00e5a0' : '#ff4d6d';
  ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();

  // ── 6. Dot at last price ────────────────────────────────
  const lx = x(prices.length - 1), ly = y(prices[prices.length - 1]);
  ctx.beginPath(); ctx.arc(lx, ly, 4, 0, Math.PI * 2);
  ctx.fillStyle   = isUp ? '#00e5a0' : '#ff4d6d'; ctx.fill();
  ctx.strokeStyle = '#0b0e14'; ctx.lineWidth = 2; ctx.stroke();
}

// Redraw on window resize so chart always fits container width
window.addEventListener('resize', () => {
  const dp = document.getElementById('page-stock-detail');
  if (dp && dp.style.display !== 'none') drawPriceChart();
});
```

---

## SLIDE 24 — Frontend: Place Order Flow

**Title:** `stockx-frontendv2.html` — placeOrder() & Live Price Polling

```js
// ── Place order from the trade panel ────────────────────
async function placeOrder() {
  const qty  = parseInt(document.getElementById('trade-qty').value, 10);
  const type = document.getElementById('order-type').value || 'market';
  const sym  = document.getElementById('detail-symbol').textContent;

  if (!Number.isInteger(qty) || qty <= 0) {
    document.getElementById('trade-qty-err').style.display = 'block';
    return;
  }

  let limitPrice = null;
  if (type === 'limit') {
    limitPrice = parseFloat(document.getElementById('trade-limit-price').value);
    if (!Number.isFinite(limitPrice) || limitPrice <= 0) {
      document.getElementById('trade-limit-err').style.display = 'block';
      return;
    }
  }

  if (!authState.loggedIn) { showAuth(); return; }

  // Resolve stockId if not already known (search API → lookup API fallback)
  if (!currentDetailStockId)
    currentDetailStockId = await resolveStockIdBySymbol(currentDetailSymbol);

  const btn = document.getElementById('trade-submit-btn');
  btn.textContent = 'Placing order...'; btn.disabled = true;

  const payload = {
    stockId:   currentDetailStockId,
    orderType: type,
    side:      currentTradeTab,   // 'buy' | 'sell'
    quantity:  qty,
    ...(type === 'limit' ? { limitPrice } : {})
  };

  const res = await apiFetch(`${API}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    showToast(`✓ ${currentTradeTab === 'buy' ? 'Bought' : 'Sold'} ${qty} × ${sym}`, 'success');
    await loadDashboardData();   // refresh wallet balance + holdings
  } else {
    const d = await res.json();
    showToast(getResponseError(d, 'Order failed — check balance'), 'error');
  }
  btn.textContent = `${currentTradeTab === 'buy' ? 'Buy' : 'Sell'} ${sym}`;
  btn.disabled = false;
}

// ── Auto-poll price — runs INSIDE showStockDetail() ──────
// Clears any previous interval first, then starts a new one for this symbol.
async function showStockDetail(symbol, exchange, stockId) {
  // ... (set up UI, call refreshDetailPrice once immediately) ...

  // Clear any previous interval before starting a new one
  if (detailRefreshInterval) { clearInterval(detailRefreshInterval); detailRefreshInterval = null; }

  await refreshDetailPrice(symbol, exchange);

  // Poll every 10 s — matches the backend priceSync cycle
  detailRefreshInterval = setInterval(async () => {
    const dp = document.getElementById('page-stock-detail');
    if (!dp || dp.style.display === 'none') {
      clearInterval(detailRefreshInterval);
      detailRefreshInterval = null;
      return;
    }
    await refreshDetailPrice(symbol, exchange);
  }, 10000);
}
```

---

## SLIDE 25 — API Reference Summary

**Title:** Full API Endpoint Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | ✗ | Create account — returns access + refresh tokens |
| POST | `/api/auth/login` | ✗ | Login — returns access + refresh tokens |
| POST | `/api/auth/refresh` | ✗ | Exchange refresh token for new access token |
| POST | `/api/auth/logout` | ✓ JWT | Revoke refresh token |
| GET | `/api/auth/me` | ✓ JWT | Get current user profile |
| GET | `/api/stocks` | ✗ | List stocks (search, exchange, sector, pagination) |
| GET | `/api/stocks/:symbol` | ✗ | Stock detail + 30-day OHLCV |
| GET | `/api/stocks/lookup?q=` | ✓ JWT | Search/import via Yahoo Finance |
| POST | `/api/orders` | ✓ JWT | Place market or limit order |
| GET | `/api/orders/history` | ✓ JWT | Get all orders for current user |
| GET | `/api/portfolio` | ✓ JWT | Holdings + P&L with FX conversion |
| GET | `/api/wallet/balance` | ✓ JWT | Current balance + last 10 transactions |
| POST | `/api/wallet/deposit` | ✓ JWT | Deposit funds |
| POST | `/api/wallet/withdraw` | ✓ JWT | Withdraw funds |
| GET | `/api/watchlist` | ✓ JWT | Get watchlist with live prices |
| POST | `/api/watchlist` | ✓ JWT | Add stock to watchlist |
| DELETE | `/api/watchlist/:stockId` | ✓ JWT | Remove stock from watchlist |

**Standard response envelope:**
```json
{
  "success": true,
  "data":    { /* payload */ },
  "error":   null
}
```

---

## SLIDE 26 — Key Design Decisions

**Title:** Architecture Decisions & Trade-offs

| Decision | Choice | Rationale |
|---|---|---|
| Token strategy | Short-lived JWT (15 min) + long-lived refresh token (7 days, hashed in DB) | Stateless verification; revocable on logout |
| Password storage | bcrypt (cost factor 10) | Industry standard; timing-safe compare |
| Balance mutation | DB arithmetic (`balance + $1`) inside locked transaction | Avoids JS float drift; prevents race conditions |
| Refresh token lookup | Scan tokens per-user only, not full table | Avoids full table scan; bounded by one user's active sessions |
| Price sync tiers | Tier 1 = user-relevant always; Tier 2 = rotating stale batch | Prioritises user-visible data without hammering Yahoo |
| OHLCV open price | Set only on first INSERT of each day | Preserves true market open; safe to re-run sync loop |
| Holdings on full sell | DELETE row | Keeps `holdings` table clean; no zero-quantity rows |
| Frontend single-file | `stockx-frontendv2.html` (HTML + CSS + JS) | Zero build tooling; works from any CDN or static host |
| Globe data | Hardcoded exchange coords + demo stock data pre-auth | Avoids exposing live prices before login |
| FX rates | Env-var hardcoded floats | Sufficient for MVP; swap for live FX API post-launch |

---

*End of StockX Presentation Master Prompt — 26 slides*
