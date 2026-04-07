'use strict';
const express = require('express');
const router  = express.Router();

const authMiddleware = require('../middleware/authMiddleware');  // default export
const { getPortfolio } = require('../controllers/portfolioController');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// GET /api/portfolio — protected
router.get('/', authMiddleware, asyncHandler(getPortfolio));

module.exports = router;