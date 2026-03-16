'use strict';

const express = require('express');
const router = express.Router();
const { getAllStocks, getStockBySymbol } = require('../controllers/stocksController');

// Public — no auth middleware

// GET /api/stocks?exchange=NSE&search=reliance
router.get('/', getAllStocks);

// GET /api/stocks/RELIANCE
router.get('/:symbol', getStockBySymbol);

module.exports = router;