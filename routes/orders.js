'use strict';

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const validateUUID = require('../middleware/validateUUID');
const { placeOrder, getOrderHistory } = require('../controllers/orderController');

// Wrap async handlers so unhandled promise rejections surface as 500s
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// POST /api/orders  — place a new order
router.post('/', authMiddleware, validateUUID('stockId'), asyncHandler(placeOrder));

// GET /api/orders/history — fetch order history for logged-in user
router.get('/history', authMiddleware, asyncHandler(getOrderHistory));

module.exports = router;