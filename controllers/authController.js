const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');

const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_DAYS = 7;

const createAccessToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });
};

const createAndStoreRefreshToken = async (client, userId) => {
  const refreshToken = uuidv4();
  const tokenHash = await bcrypt.hash(refreshToken, 10);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

  await client.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );

  return refreshToken;
};

const buildUserPayload = (userRow) => ({
  id: userRow.id,
  email: userRow.email,
  balance: userRow.balance,
  homeCurrency: userRow.home_currency,
  kycStatus: userRow.kyc_status,
});

const register = async (req, res) => {
  const client = await pool.connect();
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      client.release();
      return res
        .status(400)
        .json({ success: false, data: null, error: 'Email and password required' });
    }

    await client.query('BEGIN');

    const hashed = await bcrypt.hash(password, 10);
    const result = await client.query(
      `INSERT INTO users (email, hashed_password)
       VALUES ($1, $2)
       RETURNING id, email, balance, home_currency, kyc_status`,
      [email, hashed]
    );

    const user = result.rows[0];
    const accessToken = createAccessToken(user.id);
    const refreshToken = await createAndStoreRefreshToken(client, user.id);

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: buildUserPayload(user),
      },
      error: null,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23505') {
      return res
        .status(409)
        .json({ success: false, data: null, error: 'Email already registered' });
    }
    console.error('register error:', err);
    return res
      .status(500)
      .json({ success: false, data: null, error: 'Internal server error' });
  } finally {
    client.release();
  }
};

const login = async (req, res) => {
  const client = await pool.connect();
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      client.release();
      return res
        .status(400)
        .json({ success: false, data: null, error: 'Email and password required' });
    }

    const result = await client.query(
      `SELECT id, email, hashed_password, balance, home_currency, kyc_status
       FROM users
       WHERE email = $1`,
      [email]
    );
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.hashed_password))) {
      client.release();
      return res
        .status(401)
        .json({ success: false, data: null, error: 'Invalid credentials' });
    }

    await client.query('BEGIN');

    const accessToken = createAccessToken(user.id);
    const refreshToken = await createAndStoreRefreshToken(client, user.id);

    await client.query('COMMIT');

    return res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: buildUserPayload(user),
      },
      error: null,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('login error:', err);
    return res
      .status(500)
      .json({ success: false, data: null, error: 'Internal server error' });
  } finally {
    client.release();
  }
};

const getMe = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, balance, home_currency, kyc_status
       FROM users
       WHERE id = $1`,
      [req.user.id]
    );
    const user = result.rows[0];
    if (!user) {
      return res
        .status(404)
        .json({ success: false, data: null, error: 'User not found' });
    }

    return res.json({
      success: true,
      data: buildUserPayload(user),
      error: null,
    });
  } catch (err) {
    console.error('getMe error:', err);
    return res
      .status(500)
      .json({ success: false, data: null, error: 'Internal server error' });
  }
};

const refreshToken = async (req, res) => {
  const { refreshToken, userId } = req.body || {};

  if (!refreshToken || !userId) {
    return res.status(400).json({
      success: false,
      data: null,
      error: 'refreshToken and userId are required',
    });
  }

  try {
    // Only scan tokens for this specific user — not the whole table
    const result = await pool.query(
      `SELECT id, user_id, token_hash, expires_at
       FROM refresh_tokens
       WHERE user_id = $1
         AND revoked_at IS NULL
         AND expires_at > NOW()`,
      [userId]
    );

    let matchedRow = null;
    for (const row of result.rows) {
      const match = await bcrypt.compare(refreshToken, row.token_hash);
      if (match) {
        matchedRow = row;
        break;
      }
    }

    if (!matchedRow) {
      return res.status(401).json({
        success: false,
        data: null,
        error: 'Invalid or expired refresh token',
      });
    }

    const accessToken = createAccessToken(matchedRow.user_id);

    return res.json({
      success: true,
      data: { accessToken },
      error: null,
    });
  } catch (err) {
    console.error('refreshToken error:', err);
    return res
      .status(500)
      .json({ success: false, data: null, error: 'Internal server error' });
  }
};

const logout = async (req, res) => {
  const userId = req.user.id;
  const { refreshToken } = req.body || {};

  if (!refreshToken) {
    return res
      .status(400)
      .json({ success: false, data: null, error: 'refreshToken is required' });
  }

  try {
    const result = await pool.query(
      `SELECT id, token_hash
       FROM refresh_tokens
       WHERE user_id = $1
         AND revoked_at IS NULL`,
      [userId]
    );

    let tokenIdToRevoke = null;
    for (const row of result.rows) {
      const match = await bcrypt.compare(refreshToken, row.token_hash);
      if (match) {
        tokenIdToRevoke = row.id;
        break;
      }
    }

    if (tokenIdToRevoke) {
      await pool.query(
        `UPDATE refresh_tokens
         SET revoked_at = NOW()
         WHERE id = $1`,
        [tokenIdToRevoke]
      );
    }

    return res.status(200).json({ success: true, data: null, error: null });
  } catch (err) {
    console.error('logout error:', err);
    return res
      .status(500)
      .json({ success: false, data: null, error: 'Internal server error' });
  }
};

module.exports = { register, login, getMe, refreshToken, logout };

