require('dotenv').config();
const pool = require('../config/db');
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

const DEMO_SYMBOLS = [
  // NSE — India
  'RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'HDFCBANK.NS',
  'BAJFINANCE.NS', 'WIPRO.NS', 'ICICIBANK.NS', 'HINDUNILVR.NS',
  'ADANIENT.NS', 'TATAMOTORS.NS',

  // NYSE
  'AAPL', 'MSFT', 'JPM', 'WMT', 'BAC',
  'GS', 'DIS', 'NKE', 'KO', 'PG',

  // NASDAQ
  'NVDA', 'TSLA', 'META', 'GOOGL', 'AMZN',
  'NFLX', 'AMD', 'INTC', 'PYPL', 'UBER',

  // LSE
  'HSBA.L', 'BP.L', 'SHEL.L', 'AZN.L', 'VOD.L',

  // SGX
  'DBS.SI', 'OCBC.SI', 'UOB.SI', 'ST.SI', 'KEP.SI',
];

const DAYS_OF_HISTORY = 30;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getStockId(symbol) {
  // Try exact match first
  let res = await pool.query(
    `SELECT id FROM stocks WHERE symbol = $1 LIMIT 1`,
    [symbol]
  );
  if (res.rows.length) return res.rows[0].id;

  // Try without suffix (RELIANCE.NS → RELIANCE)
  const base = symbol.split('.')[0];
  res = await pool.query(
    `SELECT id FROM stocks WHERE symbol ILIKE $1 LIMIT 1`,
    [base]
  );
  if (res.rows.length) return res.rows[0].id;

  // Try with exchange filter
  let exchange = 'NSE';
  if (symbol.endsWith('.L')) exchange = 'LSE';
  else if (symbol.endsWith('.SI')) exchange = 'SGX';
  else if (symbol.endsWith('.HK')) exchange = 'HKEX';
  else if (symbol.endsWith('.T')) exchange = 'TSE';
  else if (!symbol.includes('.')) exchange = 'NYSE';

  res = await pool.query(
    `SELECT id FROM stocks WHERE symbol ILIKE $1 AND exchange = $2 LIMIT 1`,
    [base, exchange]
  );
  if (res.rows.length) return res.rows[0].id;

  return null;
}

async function seedDemoStocks() {
  console.log(`\nSeeding ${DEMO_SYMBOLS.length} demo stocks with ${DAYS_OF_HISTORY} days of history...\n`);

  let success = 0, failed = 0, skipped = 0;

  for (const symbol of DEMO_SYMBOLS) {
    try {
      console.log(`Fetching ${symbol}...`);

      const stockId = await getStockId(symbol);
      if (!stockId) {
        console.log(`  ✗ ${symbol} not found in DB — skipping`);
        skipped++;
        continue;
      }

      // Fetch current quote
      const quote = await yahooFinance.quote(symbol, {}, {
        validateResult: false
      });

      if (!quote?.regularMarketPrice) {
        console.log(`  ✗ ${symbol} — no price from Yahoo`);
        failed++;
        continue;
      }

      const price = quote.regularMarketPrice;

      await pool.query(
        `UPDATE stocks SET
           current_price  = $1,
           last_synced_at = NOW(),
           market_cap     = $3,
           pe_ratio       = $4,
           dividend_yield = $5,
           sector         = COALESCE($6, sector)
         WHERE id = $2`,
        [
          price,
          stockId,
          quote.marketCap ?? null,
          quote.trailingPE ?? null,
          quote.trailingAnnualDividendYield ?? null,
          quote.sector ?? null,
        ]
      );

      // Fetch historical data
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - DAYS_OF_HISTORY);

      let history = [];
      try {
        history = await yahooFinance.historical(symbol, {
          period1: startDate.toISOString().split('T')[0],
          period2: endDate.toISOString().split('T')[0],
          interval: '1d',
        }, { validateResult: false });
      } catch {
        console.log(`  ⚠ ${symbol} — history fetch failed, writing today only`);
      }

      // Always write today
      const today = new Date().toISOString().split('T')[0];
      await pool.query(
        `INSERT INTO market_data (stock_id, date, open, high, low, close, volume)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (stock_id, date) DO UPDATE SET
           high   = GREATEST(market_data.high, EXCLUDED.high),
           low    = LEAST(market_data.low, EXCLUDED.low),
           close  = EXCLUDED.close,
           volume = COALESCE(EXCLUDED.volume, market_data.volume)`,
        [
          stockId, today,
          quote.regularMarketOpen    || price,
          quote.regularMarketDayHigh || price,
          quote.regularMarketDayLow  || price,
          price,
            quote.regularMarketVolume  ?? null,
        ]
      );

      // Write historical rows
      if (history.length) {
        for (const day of history) {
          const date = new Date(day.date).toISOString().split('T')[0];
          if (date === today) continue; // already written above
          await pool.query(
            `INSERT INTO market_data (stock_id, date, open, high, low, close, volume)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (stock_id, date) DO UPDATE SET
               high   = GREATEST(market_data.high, EXCLUDED.high),
               low    = LEAST(market_data.low, EXCLUDED.low),
               close  = EXCLUDED.close,
               volume = COALESCE(EXCLUDED.volume, market_data.volume)`,
            [
              stockId, date,
              day.open  || price,
              day.high  || price,
              day.low   || price,
              day.close || price,
              day.volume ?? null,
            ]
          );
        }
        console.log(`  ✓ ${symbol} — ${history.length} days @ ₹${price}`);
      } else {
        console.log(`  ✓ ${symbol} — today only @ ${price}`);
      }

      success++;
      await sleep(500);
    } catch (err) {
      console.log(`  ✗ ${symbol} — ${err.message}`);
      failed++;
      await sleep(800);
    }
  }

  console.log(`\n─────────────────────────────────`);
  console.log(`Done.`);
  console.log(`✓ Success: ${success}`);
  console.log(`✗ Failed:  ${failed}`);
  console.log(`⊘ Skipped: ${skipped}`);
  console.log(`─────────────────────────────────\n`);

  await pool.end();
}

seedDemoStocks().catch(console.error);
