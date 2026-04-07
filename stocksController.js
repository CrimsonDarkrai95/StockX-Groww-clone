'use strict';

const pool = require('../config/db');

/**
 * GET /api/stocks
 * Optional query params: ?exchange=NSE  ?search=reliance
 */
async function getAllStocks(req, res) {
  try {
    const { exchange, search } = req.query;

    const conditions = ['s.is_active = true'];
    const values = [];

    if (exchange) {
      values.push(exchange.toUpperCase());
      conditions.push(`s.exchange = $${values.length}`);
    }

    if (search) {
      values.push(`%${search.toLowerCase()}%`);
      conditions.push(
        `(LOWER(s.symbol) LIKE $${values.length} OR LOWER(s.company_name) LIKE $${values.length})`
      );
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT
        s.id,
        s.symbol,
        s.company_name,
        s.exchange,
        s.listing_currency,
        s.sector,
        s.current_price,
        s.is_active
      FROM stocks s
      ${whereClause}
      ORDER BY s.company_name ASC
    `;

    const { rows } = await pool.query(query, values);

    return res.status(200).json({
      success: true,
      data: rows,
      error: null,
    });
  } catch (err) {
    console.error('[getAllStocks]', err.message);
    return res.status(500).json({
      success: false,
      data: null,
      error: 'Failed to fetch stocks',
    });
  }
}

/**
 * GET /api/stocks/:symbol
 * Returns stock details + last 30 days of market_data ordered by date ASC
 */
async function getStockBySymbol(req, res) {
  try {
    const symbol = req.params.symbol.toUpperCase();

    // 1. Fetch the stock row
    const stockQuery = `
      SELECT
        s.id,
        s.symbol,
        s.company_name,
        s.exchange,
        s.listing_currency,
        s.sector,
        s.current_price,
        s.is_active,
        s.created_at
      FROM stocks s
      WHERE s.symbol = $1
      LIMIT 1
    `;
    const { rows: stockRows } = await pool.query(stockQuery, [symbol]);

    if (!stockRows.length) {
      return res.status(404).json({
        success: false,
        data: null,
        error: `Stock '${symbol}' not found`,
      });
    }

    const stock = stockRows[0];

    // 2. Fetch last 30 days of OHLCV data
    const historyQuery = `
      SELECT
        md.date,
        md.open,
        md.high,
        md.low,
        md.close,
        md.volume
      FROM market_data md
      WHERE md.stock_id = $1
        AND md.date >= CURRENT_DATE - INTERVAL '30 days'
      ORDER BY md.date ASC
    `;
    const { rows: historyRows } = await pool.query(historyQuery, [stock.id]);

    return res.status(200).json({
      success: true,
      data: {
        ...stock,
        price_history: historyRows,
      },
      error: null,
    });
  } catch (err) {
    console.error('[getStockBySymbol]', err.message);
    return res.status(500).json({
      success: false,
      data: null,
      error: 'Failed to fetch stock details',
    });
  }
}

module.exports = { getAllStocks, getStockBySymbol };