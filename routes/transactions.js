const express = require('express');
const router = express.Router();
const { deposit, withdraw, getBalance } = require('../controllers/transactionsController');
const authMiddleware = require('../middleware/authMiddleware');

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.post('/deposit', authMiddleware, asyncHandler(deposit));
router.post('/withdraw', authMiddleware, asyncHandler(withdraw));  // ← added
router.get('/balance', authMiddleware, asyncHandler(getBalance));

module.exports = router;