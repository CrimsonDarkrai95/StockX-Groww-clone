'use strict';

const pool = require('../config/db');

// ---------------------------------------------------------------------------
// Helper: compute weighted average cost price on a buy
// avg = (old_qty * old_avg + new_qty * new_price) / (old_qty + new_qty)
// ---------------------------------------------------------------------------
function computeNewAvg(oldQty, oldAvg, newQty, newPrice) {
  const totalQty = parseFloat(oldQty) + parseFloat(newQty);
  if (totalQty === 0) return 0;
  return (
    (parseFloat(oldQty) * parseFloat(oldAvg) +
      parseFloat(newQty) * parseFloat(newPrice)) /
    totalQty
  );
}

// ---------------------------------------------------------------------------
// POST /api/orders
// ---------------------------------------------------------------------------
async function placeOrder(req, res) {
  const userId = req.user.id;
  const { stockId, orderType, side, quantity, limitPrice } = req.body;

  // ── Basic input validation ──────────────────────────────────────────────
  if (!stockId || !orderType || !side || quantity == null) {
    return res.status(400).json({
      success: false,
      data: null,
      error: 'stockId, orderType, side and quantity are required.',
    });
  }

  const normalizedType = orderType.toLowerCase();
  const normalizedSide = side.toLowerCase();

  if (!['market', 'limit'].includes(normalizedType)) {
    return res.status(400).json({
      success: false,
      data: null,
      error: "orderType must be 'market' or 'limit'.",
    });
  }
  if (!['buy', 'sell'].includes(normalizedSide)) {
    return res.status(400).json({
      success: false,
      data: null,
      error: "side must be 'buy' or 'sell'.",
    });
  }

  const qty = parseFloat(quantity);
  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({
      success: false,
      data: null,
      error: 'quantity must be a positive number.',
    });
  }

  if (normalizedType === 'limit') {
    const lp = parseFloat(limitPrice);
    if (isNaN(lp) || lp <= 0) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'limitPrice must be a positive number for limit orders.',
      });
    }
  }

  // ── Fetch stock ─────────────────────────────────────────────────────────
  const stockRes = await pool.query(
    'SELECT id, symbol, current_price, is_active FROM stocks WHERE id = $1',
    [stockId]
  );
  if (stockRes.rowCount === 0) {
    return res.status(404).json({
      success: false,
      data: null,
      error: 'Stock not found.',
    });
  }
  const stock = stockRes.rows[0];
  if (!stock.is_active) {
    return res.status(400).json({
      success: false,
      data: null,
      error: 'Stock is not currently active for trading.',
    });
  }

  // ── LIMIT ORDER — insert and return early ───────────────────────────────
  // NOTE: no balance reservation on limit orders yet.
  // Balance will be checked at execution time when limit order executor is built.
  if (normalizedType === 'limit') {
    const lp = parseFloat(limitPrice);
    const orderRes = await pool.query(
      `INSERT INTO orders (user_id, stock_id, order_type, side, quantity, limit_price, status)
       VALUES ($1, $2, 'limit', $3, $4, $5, 'open')
       RETURNING *`,
      [userId, stockId, normalizedSide, qty, lp]
    );
    return res.status(201).json({
      success: true,
      data: { order: orderRes.rows[0], trade: null, updatedBalance: null },
      error: null,
    });
  }

  // ── MARKET ORDER — execute inside a single DB transaction ───────────────
  const executionPrice = parseFloat(stock.current_price);
  if (!executionPrice || executionPrice <= 0) {
    return res.status(400).json({
      success: false,
      data: null,
      error: 'Stock has no valid current price for market order execution.',
    });
  }

  const totalValue = qty * executionPrice;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock the user row and read current balance
    const userRes = await client.query(
      'SELECT balance FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );
    if (userRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        data: null,
        error: 'User not found.',
      });
    }
    const balanceBefore = parseFloat(userRes.rows[0].balance);

    // 2. Check sufficient balance for buys
    if (normalizedSide === 'buy' && balanceBefore < totalValue) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Insufficient balance.',
      });
    }

    // 2b. For sells: verify portfolio exists (quantity check happens in step 7
    //     with a FOR UPDATE lock on the holdings row to prevent race conditions)
    if (normalizedSide === 'sell') {
      const portfolioCheck = await client.query(
        'SELECT id FROM portfolios WHERE user_id = $1 LIMIT 1',
        [userId]
      );
      if (portfolioCheck.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          data: null,
          error: 'No portfolio found. Cannot sell.',
        });
      }
    }

    // 3. Insert order (status = 'executed')
    const orderRes = await client.query(
      `INSERT INTO orders (user_id, stock_id, order_type, side, quantity, status)
       VALUES ($1, $2, 'market', $3, $4, 'executed')
       RETURNING *`,
      [userId, stockId, normalizedSide, qty]
    );
    const order = orderRes.rows[0];

    // 4. Insert trade record
    const tradeRes = await client.query(
      `INSERT INTO trades
         (user_id, stock_id, order_id, side, quantity, price, fx_rate_at_execution, total_value)
       VALUES ($1, $2, $3, $4, $5, $6, 1.0, $7)
       RETURNING *`,
      [userId, stockId, order.id, normalizedSide, qty, executionPrice, totalValue]
    );
    const trade = tradeRes.rows[0];

    // 5. Update balance using DB arithmetic to avoid JS float precision issues
    const balanceOp = normalizedSide === 'buy' ? '-' : '+';
    const balanceResult = await client.query(
      `UPDATE users
       SET balance = balance ${balanceOp} $1
       WHERE id = $2
       RETURNING balance`,
      [totalValue.toFixed(8), userId]
    );
    const balanceAfter = parseFloat(balanceResult.rows[0].balance);

    // 6. Insert immutable wallet_transaction audit row
    const txnType = normalizedSide === 'buy' ? 'buy' : 'sell';
    await client.query(
      `INSERT INTO wallet_transactions
         (user_id, txn_type, amount, balance_before, balance_after, reference_order_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        txnType,
        totalValue.toFixed(8),
        balanceBefore.toFixed(8),
        balanceAfter.toFixed(8),
        order.id,
      ]
    );

    // 7. Upsert holdings — get or create portfolio first
    const portfolioRes = await client.query(
      'SELECT id FROM portfolios WHERE user_id = $1 LIMIT 1',
      [userId]
    );

    let portfolioId;
    if (portfolioRes.rowCount === 0) {
      const newPortfolio = await client.query(
        `INSERT INTO portfolios (user_id, name) VALUES ($1, 'My Portfolio') RETURNING id`,
        [userId]
      );
      portfolioId = newPortfolio.rows[0].id;
    } else {
      portfolioId = portfolioRes.rows[0].id;
    }

    if (normalizedSide === 'buy') {
      // Read existing holding to compute new weighted average cost
      const existingHolding = await client.query(
        'SELECT quantity, avg_cost_price FROM holdings WHERE portfolio_id = $1 AND stock_id = $2',
        [portfolioId, stockId]
      );

      let newQty;
      let newAvgCost;
      if (existingHolding.rowCount > 0) {
        const old = existingHolding.rows[0];
        newQty = parseFloat(old.quantity) + qty;
        newAvgCost = computeNewAvg(
          old.quantity,
          old.avg_cost_price,
          qty,
          executionPrice
        );
      } else {
        newQty = qty;
        newAvgCost = executionPrice;
      }

      await client.query(
        `INSERT INTO holdings (portfolio_id, stock_id, quantity, avg_cost_price)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (portfolio_id, stock_id) DO UPDATE SET
           quantity       = $3,
           avg_cost_price = $4,
           updated_at     = NOW()`,
        [portfolioId, stockId, newQty.toFixed(8), newAvgCost.toFixed(8)]
      );
    } else {
      // SELL — lock the holdings row first to prevent concurrent sell race condition
      const holdingRes = await client.query(
        'SELECT quantity FROM holdings WHERE portfolio_id = $1 AND stock_id = $2 FOR UPDATE',
        [portfolioId, stockId]
      );

      if (holdingRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          data: null,
          error: 'No holdings found for this stock.',
        });
      }

      const oldQty = parseFloat(holdingRes.rows[0].quantity);
      if (oldQty < qty) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          data: null,
          error: 'Insufficient holdings to sell.',
        });
      }

      const remainingQty = oldQty - qty;

      if (remainingQty <= 0) {
        // Remove the holding row entirely when fully sold
        await client.query(
          'DELETE FROM holdings WHERE portfolio_id = $1 AND stock_id = $2',
          [portfolioId, stockId]
        );
      } else {
        await client.query(
          `UPDATE holdings
           SET quantity = $1, updated_at = NOW()
           WHERE portfolio_id = $2 AND stock_id = $3`,
          [remainingQty.toFixed(8), portfolioId, stockId]
        );
      }
    }

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      data: {
        order,
        trade,
        updatedBalance: parseFloat(balanceAfter.toFixed(8)),
      },
      error: null,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[placeOrder] Transaction rolled back:', err.message);
    return res.status(500).json({
      success: false,
      data: null,
      error: 'Order placement failed. Please try again.',
    });
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// GET /api/orders/history
// ---------------------------------------------------------------------------
async function getOrderHistory(req, res) {
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT
         o.id,
         o.order_type,
         o.side,
         o.quantity,
         o.limit_price,
         o.status,
         o.created_at,
         s.symbol,
         s.company_name,
         s.listing_currency,
         t.price       AS executed_price,
         t.total_value AS executed_total,
         t.executed_at
       FROM orders o
       JOIN stocks s ON s.id = o.stock_id
       LEFT JOIN trades t ON t.order_id = o.id
       WHERE o.user_id = $1
       ORDER BY o.created_at DESC`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      data: { orders: result.rows },
      error: null,
    });
  } catch (err) {
    console.error('getOrderHistory error:', err);
    return res.status(500).json({
      success: false,
      data: null,
      error: 'Internal server error',
    });
  }
}

module.exports = { placeOrder, getOrderHistory };