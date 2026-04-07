'use strict';

// yahoo-finance2 v3.x exports the YahooFinance class as default — instantiate it.
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();
const pool = require('../config/db');



let intervalHandle = null;

const mapToYahooTicker = (symbol, exchange) => {
  switch (exchange) {
    case 'NSE':    return `${symbol}.NS`;
    case 'BSE':    return `${symbol}.BO`;
    case 'SGX':    return `${symbol}.SI`;
    case 'LSE':    return `${symbol}.L`;
    case 'NYSE':
    case 'NASDAQ':
    default:       return symbol;
  }
};

const startPriceSync = () => {
  if (intervalHandle) return;

  intervalHandle = setInterval(async () => {
    let tier1Stocks = [];
    let tier2Stocks = [];

    // Tier 1: stocks in active holdings or watchlists — synced every cycle
    try {
      const tier1Result = await pool.query(
        `SELECT DISTINCT s.id, s.symbol, s.exchange
         FROM stocks s
         WHERE s.id IN (
           SELECT DISTINCT stock_id FROM holdings WHERE quantity > 0
           UNION
           SELECT DISTINCT stock_id FROM watchlists
         )
         AND s.is_active = true`
      );
      tier1Stocks = tier1Result.rows;
    } catch (err) {
      console.error('[priceSync] Tier 1 query failed:', err.message);
    }

    // Tier 2: rotating batch of stale stocks (last synced > 2 min ago)
    try {
      const tier2Result = await pool.query(
        `SELECT id, symbol, exchange FROM stocks
         WHERE is_active = true
           AND (last_synced_at IS NULL OR last_synced_at < NOW() - INTERVAL '2 minutes')
         ORDER BY last_synced_at ASC NULLS FIRST
         LIMIT 50`
      );
      tier2Stocks = tier2Result.rows;
    } catch (err) {
      console.error('[priceSync] Tier 2 query failed:', err.message);
    }

    // Deduplicate by id — Tier 1 takes priority
    const merged = new Map();
    tier1Stocks.forEach((st) => merged.set(st.id, st));
    tier2Stocks.forEach((st) => {
      if (!merged.has(st.id)) merged.set(st.id, st);
    });

    const stocksToSync = Array.from(merged.values());

    console.log(
      `[priceSync] Cycle start — Tier1=${tier1Stocks.length}, ` +
      `Tier2=${tier2Stocks.length}, Total=${stocksToSync.length}`
    );

    let synced = 0;

    for (const stock of stocksToSync) {
      const ticker = mapToYahooTicker(stock.symbol, stock.exchange);

      try {
        const quote = await yahooFinance.quote(ticker);
        const price = quote && quote.regularMarketPrice;
        const volume = (quote && quote.regularMarketVolume) || 0;

        // Skip if no valid price — do not update last_synced_at
        if (typeof price !== 'number') {
          console.log(`[priceSync] ${ticker} — price unavailable, skipping`);
          continue;
        }

        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          // Update current price and sync timestamp on stocks
          await client.query(
            `UPDATE stocks
             SET current_price  = $1,
                 last_synced_at = NOW()
             WHERE id = $2`,
            [price, stock.id]
          );

          // Upsert market_data for today.
          // open is only set on first INSERT — never overwritten on conflict.
          // This preserves the true opening price for the day.
          await client.query(
            `INSERT INTO market_data (stock_id, date, open, high, low, close, volume)
             VALUES ($1, CURRENT_DATE, $2, $2, $2, $2, $3)
             ON CONFLICT (stock_id, date) DO UPDATE SET
               high   = GREATEST(market_data.high, EXCLUDED.high),
               low    = LEAST(market_data.low,      EXCLUDED.low),
               close  = EXCLUDED.close,
               volume = EXCLUDED.volume`,
            [stock.id, price, volume]
          );

          await client.query('COMMIT');
          synced++;
          console.log(`[priceSync] ${ticker} → ${price.toFixed(2)} ✓`);
        } catch (dbErr) {
          await client.query('ROLLBACK').catch(() => {});
          console.error(`[priceSync] DB error for ${ticker}:`, dbErr.message);
        } finally {
          client.release();
        }
      } catch (err) {
        // Per-symbol catch — one failure does not stop the loop
        console.error(`[priceSync] Yahoo error for ${ticker}:`, err.message);
      }
    }

    console.log(`[priceSync] Cycle complete — synced ${synced}/${stocksToSync.length}`);
  }, 10000);
};

module.exports = { startPriceSync };