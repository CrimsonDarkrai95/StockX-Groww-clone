const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { getAllStocks, getStockBySymbol, getStockLookup } = require('../controllers/stocksController');

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/',           asyncHandler(getAllStocks));
router.get('/lookup',     authMiddleware, asyncHandler(getStockLookup));
router.get('/:symbol',    asyncHandler(getStockBySymbol));

module.exports = router;