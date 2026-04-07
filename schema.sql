-- schema.sql
-- Core schema extensions and safety helpers for the Global Stocks Platform.
-- All statements are idempotent — safe to re-run at any time.

-- ─────────────────────────────────────────────────────────────────────────────
-- USERS — add columns required by authController and transactionsController
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS balance       NUMERIC(20,8)  NOT NULL DEFAULT 0;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS home_currency TEXT           NOT NULL DEFAULT 'INR';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS kyc_status    TEXT           NOT NULL DEFAULT 'pending';

-- ─────────────────────────────────────────────────────────────────────────────
-- PORTFOLIOS — required for portfolio and order controllers
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS portfolios (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL DEFAULT 'My Portfolio',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portfolios_user_id ON portfolios(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- WALLET TRANSACTIONS — immutable audit log (deposit / withdrawal / buy / sell)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  txn_type            TEXT NOT NULL,
  amount              NUMERIC(20,8) NOT NULL,
  balance_before      NUMERIC(20,8) NOT NULL,
  balance_after       NUMERIC(20,8) NOT NULL,
  reference_order_id  UUID,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON wallet_transactions(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- REFRESH TOKENS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- UPDATED_AT SUPPORT FOR STOCKS & HOLDINGS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE stocks
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE holdings
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;


-- ─────────────────────────────────────────────────────────────────────────────
-- PERFORMANCE INDEXES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_orders_status
  ON orders(status);

CREATE INDEX IF NOT EXISTS idx_trades_executed_at
  ON trades(executed_at DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- GENERIC UPDATED_AT TRIGGER
-- ─────────────────────────────────────────────────────────────────────────────

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
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS set_holdings_updated_at ON holdings;
CREATE TRIGGER set_holdings_updated_at
  BEFORE UPDATE ON holdings
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

-- Add tiered price sync metadata and unique constraint for symbol+exchange scope
ALTER TABLE stocks
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stocks_symbol_exchange
  ON stocks (symbol, exchange);