# Global Stocks Platform — Backend

A real-time global stocks trading platform backend built with Node.js, Express, and PostgreSQL (Supabase).  
Supports NSE, NYSE, NASDAQ, SGX, and LSE with live price sync via Yahoo Finance.

---

## Tech Stack

- **Runtime**: Node.js 20 LTS
- **Framework**: Express 4.x
- **Language**: JavaScript (ES2022, CommonJS)
- **Database**: PostgreSQL 16 on Supabase
- **DB Client**: node-postgres (pg)
- **Auth**: JWT (access token 15 min) + refresh tokens
- **Price Data**: yahoo-finance2

---

## Prerequisites

- Node.js 20 LTS or higher → https://nodejs.org
- Git

---

## Setup Instructions

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file manually in the project root and add the following — get the actual values from the team lead:

```env
PORT=3000
DATABASE_URL=your_supabase_connection_string_here
JWT_SECRET=your_jwt_secret_here
FX_USD_INR=83.5
FX_SGD_INR=62.0
FX_GBP_INR=106.0
```

- `DATABASE_URL` — Supabase pooled connection string. Supabase dashboard → Project Settings → Database → Connection string → URI mode
- `JWT_SECRET` — shared secret, must be identical across all devs
- `FX_*` — approximate mid-market rates vs INR, update periodically

### 4. Run the database migration

Open your Supabase project → SQL Editor → paste and run `schema.sql` first, then paste and run the migration below:

```sql
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE holdings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stocks_symbol_exchange ON stocks (symbol, exchange);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens (user_id);

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_stocks_updated_at ON stocks;
CREATE TRIGGER set_stocks_updated_at
  BEFORE UPDATE ON stocks
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS set_holdings_updated_at ON holdings;
CREATE TRIGGER set_holdings_updated_at
  BEFORE UPDATE ON holdings
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();
```

> All statements are idempotent — safe to re-run if needed.

### 5. Seed the stock universe

Fetches ~14,000 stock symbols from NSE, NASDAQ, NYSE and inserts them into your database. Run once per environment.

```bash
node scripts/seedStocksFromExchanges.js
```

Expected output:
```
[seed] NSE source loaded 2270 symbols
[seed] NASDAQ source loaded 5381 symbols
[seed] NYSE source loaded 7038 symbols
[seed] SGX hardcoded list: 20 symbols
[seed] LSE hardcoded list: 20 symbols
[seed] Done. Total inserted: 14732 | Per exchange: { NSE: 2251, NASDAQ: 5381, NYSE: 7040, SGX: 20, LSE: 20 }
```

> If you re-run this script after the initial seed, it will show 0 inserted — this is correct and expected. The script is idempotent and only inserts new symbols.

> **NASDAQ/NYSE timeout?** Your network may block `www.nasdaqtrader.com`. See Troubleshooting below.

### 6. Start the server

```bash
node index.js
```

Expected output:
```
🚀 Server running on port 3000
[priceSync] Cycle start — Tier1=0, Tier2=50, Total=50
```

The price sync service starts automatically and updates stock prices every 10 seconds.

---

## API Endpoints

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | — | Create account |
| POST | `/api/auth/login` | — | Login, returns tokens |
| POST | `/api/auth/refresh` | — | Get new access token |
| POST | `/api/auth/logout` | ✅ | Revoke refresh token |
| GET | `/api/auth/me` | ✅ | Get current user |

### Wallet
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/wallet/deposit` | ✅ | Add funds |
| POST | `/api/wallet/withdraw` | ✅ | Withdraw funds |
| GET | `/api/wallet/balance` | ✅ | Get balance + recent transactions |

### Stocks
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/stocks` | — | List stocks (paginated, filterable) |
| GET | `/api/stocks/lookup?q=TSLA` | ✅ | Search + auto-import from Yahoo |
| GET | `/api/stocks/:symbol` | — | Stock detail + 30-day price history |

### Orders
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/orders` | ✅ | Place market or limit order |
| GET | `/api/orders/history` | ✅ | Order history |

### Portfolio
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/portfolio` | ✅ | Holdings with P&L in home currency |

### Watchlist
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/watchlist` | ✅ | Get watchlist |
| POST | `/api/watchlist` | ✅ | Add stock to watchlist |
| DELETE | `/api/watchlist/:stockId` | ✅ | Remove stock from watchlist |

---

## Authentication

All protected routes require a Bearer token in the Authorization header:

```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

Access tokens expire in **15 minutes**. Use `/api/auth/refresh` with your `refreshToken` and `userId` to get a new one:

```json
POST /api/auth/refresh
{
  "refreshToken": "your-refresh-token",
  "userId": "your-user-uuid"
}
```

---

## Project Structure

```
├── config/
│   └── db.js                       # PostgreSQL pool (Supabase)
├── controllers/
│   ├── authController.js
│   ├── orderController.js
│   ├── portfolioController.js
│   ├── stocksController.js
│   ├── transactionsController.js
│   └── watchlistController.js
├── middleware/
│   ├── authMiddleware.js            # JWT verification
│   └── validateUUID.js             # UUID param validation
├── routes/
│   ├── auth.js
│   ├── orders.js
│   ├── portfolio.js
│   ├── stocks.js
│   ├── transactions.js
│   └── watchlist.js
├── scripts/
│   └── seedStocksFromExchanges.js  # One-time stock universe import
├── services/
│   └── priceSync.js                # Tiered real-time price sync
├── .gitignore
├── index.js                        # Express server entry point
├── package.json
├── schema.sql                      # Database schema
└── seed.sql                        # Market data seeder (optional)
```

---

## Database Schema

9 core tables: `users`, `stocks`, `portfolios`, `holdings`, `orders`, `trades`, `wallet_transactions`, `market_data`, `watchlists`

Key rules:
- All monetary values use `DECIMAL(20,8)` — never FLOAT
- All timestamps use `TIMESTAMPTZ` stored in UTC
- `wallet_transactions` is immutable — no UPDATE or DELETE ever
- All queries use parameterized SQL

---

## Price Sync

The price sync service runs every 10 seconds with two tiers:

- **Tier 1**: All stocks in active holdings or watchlists — synced every cycle
- **Tier 2**: Rotating batch of up to 50 stale stocks (not synced in last 2 minutes)

This ensures stocks users care about are always fresh while the full universe is gradually kept up to date.

---

## Troubleshooting

**NASDAQ/NYSE seed timing out**

Your network may block `www.nasdaqtrader.com`. Options:
1. Use a VPN and re-run the seed script
2. Download the files manually in your browser and place them in `scripts/`:
   - `https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt` → save as `scripts/nasdaqlisted.txt`
   - `https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt` → save as `scripts/otherlisted.txt`

The script automatically detects and uses local files if present.

**`price unavailable` logs in price sync**

Normal. Some NYSE symbols (preferred shares, warrants, test symbols) don't have Yahoo Finance data. They stay in the DB with `current_price = NULL` and are skipped silently.

**`yahoo-finance2` errors on startup**

Ensure you are using yahoo-finance2 v3.x and instantiating correctly:
```javascript
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();
```

---

## Team Setup Quick Reference

```bash
git clone <repo-url>
cd <repo-name>
npm install
# create .env manually with values from team lead
node scripts/seedStocksFromExchanges.js
node index.js
```

---

## Notes

- `test.html` is a dev-only API tester. Never deploy it.
- `gen_token.js` is a dev utility to generate test JWTs. Never deploy it.
- FX rates in `.env` are static approximations. A live FX table will be added in a future iteration.
- Limit orders are stored but not auto-executed. A limit order executor will be built as a future feature.
