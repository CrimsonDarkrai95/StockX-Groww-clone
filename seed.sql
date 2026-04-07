-- seed.sql
-- Seed helper for generating 30 days of market_data per active stock.

DO $$
DECLARE
  stock_rec      RECORD;
  day_offset     INTEGER;
  day_date       DATE;
  base_price     NUMERIC(20,8);
  price          NUMERIC(20,8);
  open_price     NUMERIC(20,8);
  high_price     NUMERIC(20,8);
  low_price      NUMERIC(20,8);
  close_price    NUMERIC(20,8);
  base_volume    BIGINT;
  volume_val     BIGINT;
BEGIN
  FOR stock_rec IN
    SELECT id, exchange, current_price
    FROM stocks
  LOOP
    -- Use current_price as a starting point; fall back to 100 if null.
    base_price := COALESCE(stock_rec.current_price, 100);
    price      := base_price;

    -- Generate the last 30 days (oldest to newest).
    FOR day_offset IN REVERSE 0..29 LOOP
      day_date := CURRENT_DATE - day_offset;

      -- Small random daily walk, roughly ±2%.
      price := price * (1 + ((random() - 0.5) * 0.04));

      open_price := ROUND(price::numeric, 4);

      -- Intra-day high/low around the open price (±2% band).
      high_price := open_price * (1 + (random() * 0.02));
      low_price  := open_price * (1 - (random() * 0.02));

      -- Ensure ordering: low ≤ open,close ≤ high.
      IF low_price > open_price THEN
        low_price := open_price;
      END IF;
      IF high_price < open_price THEN
        high_price := open_price;
      END IF;

      close_price := low_price + (random() * (high_price - low_price));

      -- Volume profile by exchange.
      base_volume :=
        CASE stock_rec.exchange
          WHEN 'NSE' THEN 1000000
          WHEN 'BSE' THEN 800000
          WHEN 'NYSE' THEN 700000
          WHEN 'NASDAQ' THEN 700000
          WHEN 'LSE' THEN 300000
          WHEN 'SGX' THEN 200000
          ELSE 250000
        END;

      volume_val := GREATEST(1, FLOOR(base_volume * (0.8 + (random() * 0.4))));

      INSERT INTO market_data (stock_id, date, open, high, low, close, volume)
      VALUES (stock_rec.id, day_date, open_price, high_price, low_price, close_price, volume_val)
      ON CONFLICT (stock_id, date) DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;

