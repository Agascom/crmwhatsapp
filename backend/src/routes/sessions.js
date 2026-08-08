const express = require('express');
const openwa = require('../services/openwa');
const requireAuth = require('../middleware/auth');
const asyncHandler = require('../utils/async');

const router = express.Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const sessions = await openwa.listSessions();
  res.json(sessions);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const session = await openwa.getSession(req.params.id);
  res.json(session);
}));

router.post('/:id/start', asyncHandler(async (req, res) => {
  const session = await openwa.startSession(req.params.id);
  res.json(session);
}));

router.post('/:id/stop', asyncHandler(async (req, res) => {
  const session = await openwa.stopSession(req.params.id);
  res.json(session);
}));

router.get('/:id/qr', asyncHandler(async (req, res) => {
  const qr = await openwa.getQr(req.params.id);
  res.json(qr);
}));

module.exports = router;
