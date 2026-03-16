require('dotenv').config();
const jwt = require('jsonwebtoken');
const token = jwt.sign(
  { id: '7b6022ac-3636-4888-9d80-b53a237addca' },
  process.env.JWT_SECRET,
  { expiresIn: '1d' }
);
console.log(token);