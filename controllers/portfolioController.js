const pool = require('../config/db');

const FX_RATES = {
  INR: 1.0,
  USD: parseFloat(process.env.FX_USD_INR || '83.5'),
  SGD: parseFloat(process.env.FX_SGD_INR || '62.0'),
  GBP: parseFloat(process.env.FX_GBP_INR || '106.0'),
};

const getPortfolio = async (req, res) => {
  const userId = req.user.id;
  const client = await pool.connect();

  try {
    const userResult = await client.query(
      `SELECT id, home_currency
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'User not found.',
      });
    }

    const user = userResult.rows[0];
    const homeCurrency = user.home_currency;

    const portfolioResult = await client.query(
      `SELECT id, name
       FROM portfolios
       WHERE user_id = $1
       ORDER BY created_at ASC
       LIMIT 1`,
      [userId]
    );

    if (portfolioResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'No portfolio found for this user.',
      });
    }

    const portfolio = portfolioResult.rows[0];

    const holdingsResult = await client.query(
      `SELECT
         h.id                AS holding_id,
         h.quantity,
         h.avg_cost_price,
         s.id                AS stock_id,
         s.symbol,
         s.company_name,
         s.exchange,
         s.listing_currency,
         s.current_price
       FROM holdings h
       JOIN stocks s ON s.id = h.stock_id
       WHERE h.portfolio_id = $1
         AND h.quantity > 0
       ORDER BY s.symbol ASC`,
      [portfolio.id]
    );

    let totalConvertedInvested = 0;
    let totalConvertedCurrent = 0;

    const holdings = holdingsResult.rows.map((row) => {
      const quantity = parseFloat(row.quantity);
      const avgCostPrice = parseFloat(row.avg_cost_price);
      const currentPrice = parseFloat(row.current_price ?? 0);

      const currentValue = quantity * currentPrice;
      const investedValue = quantity * avgCostPrice;
      const pnl = currentValue - investedValue;
      const pnlPct = investedValue !== 0 ? (pnl / investedValue) * 100 : 0;

      const listingCurrency = row.listing_currency;
      const fromRate = FX_RATES[listingCurrency] || 1.0;
      const toRate = FX_RATES[homeCurrency] || 1.0;

      const convertedCurrentValue =
        currentValue * fromRate / toRate;
      const convertedInvestedValue =
        investedValue * fromRate / toRate;
      const convertedPnl = convertedCurrentValue - convertedInvestedValue;
      const convertedPnlPct =
        convertedInvestedValue !== 0
          ? (convertedPnl / convertedInvestedValue) * 100
          : 0;

      totalConvertedInvested += convertedInvestedValue;
      totalConvertedCurrent += convertedCurrentValue;

      return {
        holdingId: row.holding_id,
        stockId: row.stock_id,
        symbol: row.symbol,
        companyName: row.company_name,
        exchange: row.exchange,
        listingCurrency,
        quantity,
        avgCostPrice,
        currentPrice,
        currentValue: parseFloat(currentValue.toFixed(8)),
        investedValue: parseFloat(investedValue.toFixed(8)),
        pnl: parseFloat(pnl.toFixed(8)),
        pnlPct: parseFloat(pnlPct.toFixed(4)),
        convertedCurrentValue: parseFloat(convertedCurrentValue.toFixed(8)),
        convertedInvestedValue: parseFloat(convertedInvestedValue.toFixed(8)),
        convertedPnl: parseFloat(convertedPnl.toFixed(8)),
        convertedPnlPct: parseFloat(convertedPnlPct.toFixed(4)),
        displayCurrency: homeCurrency,
      };
    });

    const totalPnlConverted = totalConvertedCurrent - totalConvertedInvested;
    const totalPnlPctConverted =
      totalConvertedInvested !== 0
        ? (totalPnlConverted / totalConvertedInvested) * 100
        : 0;

    return res.status(200).json({
      success: true,
      data: {
        portfolio: {
          id: portfolio.id,
          name: portfolio.name,
        },
        holdings,
        summary: {
          totalCurrentValue: parseFloat(totalConvertedCurrent.toFixed(8)),
          totalInvestedValue: parseFloat(totalConvertedInvested.toFixed(8)),
          totalPnl: parseFloat(totalPnlConverted.toFixed(8)),
          totalPnlPct: parseFloat(totalPnlPctConverted.toFixed(4)),
          displayCurrency: homeCurrency,
        },
        fx_rates_used: FX_RATES
      },
      error: null,
    });
  } catch (err) {
    console.error('[portfolioController] getPortfolio error:', err);
    return res.status(500).json({
      success: false,
      data: null,
      error: 'Internal server error while fetching portfolio.',
    });
  } finally {
    client.release();
  }
};

module.exports = { getPortfolio };

