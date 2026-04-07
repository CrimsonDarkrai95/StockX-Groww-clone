-- schema.sql
-- Core schema extensions and safety helpers for the Global Stocks Platform.

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

-- Add last_synced_at to stocks if not present
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Ensure unique constraint on (symbol, exchange) for ON CONFLICT to work
CREATE UNIQUE INDEX IF NOT EXISTS idx_stocks_symbol_exchange 
  ON stocks (symbol, exchange);

-- Refresh tokens table (required by authController)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by user (used in logout + refresh)
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id 
  ON refresh_tokens (user_id);