process.env.NODE_NO_WARNINGS = '1';


require('dotenv').config();

const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const stocksRoutes = require('./routes/stocks');
const ordersRoutes = require('./routes/orders');
const portfolioRoutes = require('./routes/portfolio');
const transactionsRoutes = require('./routes/transactions');
const watchlistRoutes = require('./routes/watchlist');
const { startPriceSync } = require('./services/priceSync');

const app = express();

app.use(cors());
//app.use(cors({ origin: process.env.FRONTEND_URL })); Do this before Production.
app.use(express.json());

app.use('/api/auth',      authRoutes);
app.use('/api/stocks',    stocksRoutes);
app.use('/api/orders',    ordersRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/wallet',    transactionsRoutes);
app.use('/api/watchlist', watchlistRoutes);

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, data: null, error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  startPriceSync();
});

module.exports = app;