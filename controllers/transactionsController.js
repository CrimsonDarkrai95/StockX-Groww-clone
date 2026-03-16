const pool = require('../config/db');

const deposit = async (req, res) => {
  const userId = req.user.id;
  const { amount } = req.body;

  // Validate
  if (amount === undefined || amount === null) {
    return res.status(400).json({ success: false, data: null, error: 'amount is required' });
  }
  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ success: false, data: null, error: 'amount must be a positive number' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the user row
    const lockRes = await client.query(
      'SELECT balance FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );
    if (lockRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, data: null, error: 'User not found' });
    }

    const balanceBefore = parseFloat(lockRes.rows[0].balance);
    const balanceAfter = balanceBefore + parsedAmount;

    // Update balance
    await client.query(
      'UPDATE users SET balance = $1 WHERE id = $2',
      [balanceAfter.toFixed(8), userId]
    );

    // Insert immutable wallet transaction
    await client.query(
      `INSERT INTO wallet_transactions
         (user_id, txn_type, amount, balance_before, balance_after, reference_order_id)
       VALUES ($1, 'deposit', $2, $3, $4, NULL)`,
      [userId, parsedAmount.toFixed(8), balanceBefore.toFixed(8), balanceAfter.toFixed(8)]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      data: {
        balanceBefore: balanceBefore.toFixed(8),
        balanceAfter: balanceAfter.toFixed(8),
      },
      error: null,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('deposit error:', err);
    return res.status(500).json({ success: false, data: null, error: 'Internal server error' });
  } finally {
    client.release();
  }
};

const getBalance = async (req, res) => {
  const userId = req.user.id;

  try {
    const userRes = await pool.query(
      'SELECT balance, home_currency FROM users WHERE id = $1',
      [userId]
    );
    if (userRes.rowCount === 0) {
      return res.status(404).json({ success: false, data: null, error: 'User not found' });
    }

    const { balance, home_currency } = userRes.rows[0];

    const txnRes = await pool.query(
      `SELECT id, txn_type, amount, balance_before, balance_after,
              reference_order_id, created_at
       FROM wallet_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      data: {
        balance,
        homeCurrency: home_currency,
        recentTransactions: txnRes.rows,
      },
      error: null,
    });
  } catch (err) {
    console.error('getBalance error:', err);
    return res.status(500).json({ success: false, data: null, error: 'Internal server error' });
  }
};

const withdraw = async (req, res) => {
  const userId = req.user.id;
  const { amount } = req.body;

  if (amount === undefined || amount === null) {
    return res.status(400).json({ success: false, data: null, error: 'amount is required' });
  }
  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ success: false, data: null, error: 'amount must be a positive number' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const lockRes = await client.query(
      'SELECT balance FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );
    if (lockRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, data: null, error: 'User not found' });
    }

    const balanceBefore = parseFloat(lockRes.rows[0].balance);
    if (balanceBefore < parsedAmount) {
      await client.query('ROLLBACK');
      return res
        .status(422)
        .json({ success: false, data: null, error: 'Insufficient funds' });
    }

    const balanceAfter = balanceBefore - parsedAmount;

    await client.query(
      'UPDATE users SET balance = $1 WHERE id = $2',
      [balanceAfter.toFixed(8), userId]
    );

    await client.query(
      `INSERT INTO wallet_transactions
         (user_id, txn_type, amount, balance_before, balance_after, reference_order_id)
       VALUES ($1, 'withdrawal', $2, $3, $4, NULL)`,
      [userId, parsedAmount.toFixed(8), balanceBefore.toFixed(8), balanceAfter.toFixed(8)]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      data: {
        balanceBefore: balanceBefore.toFixed(8),
        balanceAfter: balanceAfter.toFixed(8),
      },
      error: null,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('withdraw error:', err);
    return res.status(500).json({ success: false, data: null, error: 'Internal server error' });
  } finally {
    client.release();
  }
};

module.exports = { deposit, withdraw, getBalance };