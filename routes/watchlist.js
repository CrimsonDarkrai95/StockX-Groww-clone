// routes/watchlist.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const validateUUID = require('../middleware/validateUUID');
const { getWatchlist, addToWatchlist, removeFromWatchlist } =
  require('../controllers/watchlistController');

router.get('/', authMiddleware, getWatchlist);
router.post('/', authMiddleware, validateUUID('stockId'), addToWatchlist);         // FIX 4 - body
router.delete('/:stockId', authMiddleware, validateUUID('stockId'), removeFromWatchlist); // FIX 4 - param

module.exports = router;