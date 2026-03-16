const pool = require('../config/db');

const getWatchlist = async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT
         w.id,
         w.stock_id,
         w.added_at,
         s.symbol,
         s.company_name,
         s.exchange,
         s.listing_currency,
         s.current_price
       FROM watchlists w
       JOIN stocks s ON s.id = w.stock_id
       WHERE w.user_id = $1
       ORDER BY w.added_at DESC`,
      [userId]
    );

    return res.status(200).json({ success: true, data: result.rows, error: null });
  } catch (err) {
    console.error('getWatchlist error:', err);
    return res.status(500).json({ success: false, data: null, error: 'Internal server error' });
  }
};

const addToWatchlist = async (req, res) => {
  const userId = req.user.id;
  const { stockId } = req.body;

  if (!stockId) {
    return res.status(400).json({ success: false, data: null, error: 'stockId is required' });
  }

  try {
    // Check stock exists
    const stockRes = await pool.query(
      'SELECT id, symbol, company_name, exchange, listing_currency, current_price FROM stocks WHERE id = $1',
      [stockId]
    );
    if (stockRes.rowCount === 0) {
      return res.status(404).json({ success: false, data: null, error: 'Stock not found' });
    }

    const stock = stockRes.rows[0];

    const insertRes = await pool.query(
      `INSERT INTO watchlists (user_id, stock_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, stock_id) DO NOTHING
       RETURNING id, stock_id, added_at`,
      [userId, stockId]
    );

    // rowCount 0 means the stock was already in the watchlist
    if (insertRes.rowCount === 0) {
      return res.status(409).json({
        success: false,
        data: null,
        error: 'Stock is already in your watchlist',
      });
    }

    const row = insertRes.rows[0];

    return res.status(201).json({
      success: true,
      data: {
        id: row.id,
        stock_id: row.stock_id,
        added_at: row.added_at,
        symbol: stock.symbol,
        company_name: stock.company_name,
        exchange: stock.exchange,
        listing_currency: stock.listing_currency,
        current_price: stock.current_price,
      },
      error: null,
    });
  } catch (err) {
    console.error('addToWatchlist error:', err);
    return res.status(500).json({ success: false, data: null, error: 'Internal server error' });
  }
};

const removeFromWatchlist = async (req, res) => {
  const userId = req.user.id;
  const { stockId } = req.params;

  if (!stockId) {
    return res.status(400).json({ success: false, data: null, error: 'stockId param is required' });
  }

  try {
    const deleteRes = await pool.query(
      'DELETE FROM watchlists WHERE user_id = $1 AND stock_id = $2',
      [userId, stockId]
    );

    if (deleteRes.rowCount === 0) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Stock not found in your watchlist',
      });
    }

    return res.status(200).json({
      success: true,
      data: { removed: stockId },
      error: null,
    });
  } catch (err) {
    console.error('removeFromWatchlist error:', err);
    return res.status(500).json({ success: false, data: null, error: 'Internal server error' });
  }
};

module.exports = { getWatchlist, addToWatchlist, removeFromWatchlist };