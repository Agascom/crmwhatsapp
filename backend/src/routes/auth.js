const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config');
const asyncHandler = require('../utils/async');

const router = express.Router();

const adminHash = bcrypt.hashSync(config.adminPassword, 10);

router.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: 'Identifiants manquants' });
  }
  if (username !== config.adminUser || !bcrypt.compareSync(password, adminHash)) {
    return res.status(401).json({ message: 'Identifiants incorrects' });
  }
  const token = jwt.sign({ user: config.adminUser, role: 'admin' }, config.jwtSecret, { expiresIn: '7d' });
  res.json({ token, user: config.adminUser });
}));

module.exports = router;
