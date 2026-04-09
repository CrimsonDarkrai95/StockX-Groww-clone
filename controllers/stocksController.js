'use strict';

const pool = require('../config/db');

// FIX: yahoo-finance2 is a singleton — do NOT use `new YahooFinance()`
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();



// ---------------------------------------------------------------------------
// GET /api/stocks/lookup?q=TSLA  (auth required)
// ---------------------------------------------------------------------------
const getStockLookup = async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) {
    return res.status(400).json({
      success: false,
      data: null,
      error: 'Query param q is required',
    });
  }

  try {
    // 1. Check DB first (case-insensitive match on symbol or company name)
    const existingResult = await pool.query(
      `SELECT id, symbol, company_name, exchange, listing_currency,
              sector, current_price, is_active, created_at, last_synced_at
       FROM stocks
       WHERE symbol ILIKE $1 OR company_name ILIKE $1
       LIMIT 1`,
      [q]
    );

    if (existingResult.rowCount > 0) {
      return res.status(200).json({
        success: true,
        data: existingResult.rows[0],
        error: null,
      });
    }

    // 2. Try Yahoo direct quote
    let quote = null;
    try {
      const result = await yahooFinance.quote(q.toUpperCase());
      // Guard: Yahoo can return an object with null/undefined price for bad tickers
      if (result && typeof result.regularMarketPrice === 'number') {
        quote = result;
      }
    } catch (_) {
      // quote() threw — fall through to search fallback
    }

    // 3. Fallback: Yahoo search → pick first EQUITY result → re-quote
    if (!quote) {
      try {
        const searchResult = await yahooFinance.search(q);
        const bestMatch =
          searchResult &&
          Array.isArray(searchResult.quotes) &&
          searchResult.quotes.find((item) => item.quoteType === 'EQUITY');

        if (bestMatch && bestMatch.symbol) {
          const result = await yahooFinance.quote(bestMatch.symbol);
          if (result && typeof result.regularMarketPrice === 'number') {
            quote = result;
          }
        }
      } catch (err) {
        console.error('[getStockLookup] Yahoo search/quote error:', err.message);
      }
    }

    if (!quote) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Symbol not found',
      });
    }

    // 4. Normalize Yahoo exchange codes to our standard labels
    const rawExchange = (quote.exchange || '').toUpperCase();
    let exchange;
    if (['NMS', 'NGM', 'NCM', 'NASDAQ'].includes(rawExchange)) {
      exchange = 'NASDAQ';
    } else if (['NYQ', 'NYS', 'NYSE'].includes(rawExchange)) {
      exchange = 'NYSE';
    } else if (['NSI', 'NSE'].includes(rawExchange)) {
      exchange = 'NSE';
    } else if (['LSE', 'IOB'].includes(rawExchange)) {
      exchange = 'LSE';
    } else if (['SES', 'SGX'].includes(rawExchange)) {
      exchange = 'SGX';
    } else {
      // Preserve unknown exchanges rather than losing the stock entirely
      exchange = rawExchange || 'UNKNOWN';
    }

    const symbol = quote.symbol.toUpperCase();
    const companyName = quote.longName || quote.shortName || symbol;

    // Prefer Yahoo's own currency field; fall back to our exchange→currency map
    const currencyMap = {
      NSE: 'INR',
      LSE: 'GBP',
      SGX: 'SGD',
      NYSE: 'USD',
      NASDAQ: 'USD',
    };
    const listingCurrency = quote.currency || currencyMap[exchange] || 'USD';

    // 5. Upsert: insert new stock or update price if it already exists
    //    ON CONFLICT only updates price fields — all other columns are preserved
    const insertResult = await pool.query(
      `INSERT INTO stocks
         (symbol, company_name, exchange, listing_currency, is_active, current_price, last_synced_at)
       VALUES ($1, $2, $3, $4, true, $5, NOW())
       ON CONFLICT (symbol, exchange) DO UPDATE SET
         current_price  = EXCLUDED.current_price,
         last_synced_at = EXCLUDED.last_synced_at
       RETURNING id, symbol, company_name, exchange, listing_currency,
                 sector, current_price, is_active, created_at, last_synced_at`,
      [symbol, companyName, exchange, listingCurrency, quote.regularMarketPrice]
    );

    return res.status(200).json({
      success: true,
      data: insertResult.rows[0],
      error: null,
    });
  } catch (err) {
    console.error('[getStockLookup] error:', err);
    return res
      .status(500)
      .json({ success: false, data: null, error: 'Internal server error' });
  }
};

// ---------------------------------------------------------------------------
// GET /api/stocks
// ---------------------------------------------------------------------------
const getAllStocks = async (req, res) => {
  try {
    const { search, exchange, sector } = req.query;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const whereClauses = ['is_active = true'];
    const params = [];
    let paramIndex = 1;

    if (search) {
      whereClauses.push(
        `(symbol ILIKE $${paramIndex} OR company_name ILIKE $${paramIndex})`
      );
      params.push(`%${search}%`);
      paramIndex += 1;
    }

    if (exchange) {
      whereClauses.push(`exchange = $${paramIndex}`);
      params.push(exchange);
      paramIndex += 1;
    }

    if (sector) {
      whereClauses.push(`sector = $${paramIndex}`);
      params.push(sector);
      paramIndex += 1;
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

    const query = `
      SELECT
        id,
        symbol,
        company_name,
        exchange,
        listing_currency,
        sector,
        current_price,
        is_active,
        created_at,
        COUNT(*) OVER () AS total
      FROM stocks
      ${whereSql}
      ORDER BY symbol ASC
      LIMIT $${paramIndex}
      OFFSET $${paramIndex + 1}
    `;

    params.push(limit);
    params.push(offset);

    const result = await pool.query(query, params);

    const total =
      result.rows.length > 0 ? parseInt(result.rows[0].total, 10) : 0;
    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

    return res.status(200).json({
      success: true,
      data: {
        stocks: result.rows.map(({ total: _total, ...rest }) => rest),
        total,
        page,
        limit,
        totalPages,
      },
      error: null,
    });
  } catch (err) {
    console.error('getAllStocks error:', err);
    return res
      .status(500)
      .json({ success: false, data: null, error: 'Internal server error' });
  }
};

// ---------------------------------------------------------------------------
// GET /api/stocks/:symbol
// ---------------------------------------------------------------------------
const getStockBySymbol = async (req, res) => {
  const { symbol } = req.params;

  try {
    const stockResult = await pool.query(
      `SELECT id, symbol, company_name, exchange, listing_currency,
              sector, current_price, is_active, created_at,
              market_cap, pe_ratio, dividend_yield
       FROM stocks
       WHERE symbol = $1`,
      [symbol.toUpperCase()]
    );

    if (stockResult.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, data: null, error: 'Stock not found' });
    }

    const stock = stockResult.rows[0];

    const priceHistoryResult = await pool.query(
      `SELECT date, open, high, low, close, volume
       FROM market_data
       WHERE stock_id = $1
         AND date >= (CURRENT_DATE - INTERVAL '30 days')
       ORDER BY date ASC`,
      [stock.id]
    );

    return res.status(200).json({
      success: true,
      data: {
        stock,
        priceHistory: priceHistoryResult.rows,
      },
      error: null,
    });
  } catch (err) {
    console.error('getStockBySymbol error:', err);
    return res
      .status(500)
      .json({ success: false, data: null, error: 'Internal server error' });
  }
};

module.exports = { getAllStocks, getStockBySymbol, getStockLookup };