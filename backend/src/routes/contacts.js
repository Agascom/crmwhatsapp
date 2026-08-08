const express = require('express');
const pool = require('../db/pool');
const requireAuth = require('../middleware/auth');
const asyncHandler = require('../utils/async');
const { normalizePhone } = require('../utils/phone');

const router = express.Router();
router.use(requireAuth);

const STATUSES = ['prospect', 'client', 'finalise'];

router.get('/', asyncHandler(async (req, res) => {
  const search = (req.query.search || '').trim();
  let rows;
  if (search) {
    const like = `%${search}%`;
    const { rows: found } = await pool.query(
      'SELECT * FROM contacts WHERE name ILIKE $1 OR phone ILIKE $1 ORDER BY name',
      [like]
    );
    rows = found;
  } else {
    const { rows: all } = await pool.query('SELECT * FROM contacts ORDER BY name');
    rows = all;
  }
  res.json(rows);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM contacts WHERE id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Contact introuvable' });
  res.json(rows[0]);
}));

router.post('/', asyncHandler(async (req, res) => {
  const { name, phone, waId, status, notes } = req.body || {};
  if (!name || !phone) {
    return res.status(400).json({ message: 'Le nom et le telephone sont requis' });
  }
  const norm = normalizePhone(phone);
  const existing = await findContactByPhone(norm);
  if (existing) {
    return res.status(409).json({ message: 'Un contact avec ce telephone existe deja' });
  }
  const { rows } = await pool.query(
    'INSERT INTO contacts (name, phone, wa_id, status, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [name, norm, waId || null, STATUSES.includes(status) ? status : 'prospect', notes || null]
  );
  res.status(201).json(rows[0]);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const { name, phone, status, notes } = req.body || {};
  const { rows: current } = await pool.query('SELECT * FROM contacts WHERE id = $1', [req.params.id]);
  if (!current.length) return res.status(404).json({ message: 'Contact introuvable' });

  const { rows: updated } = await pool.query(
    `UPDATE contacts SET name = $1, phone = $2, status = $3, notes = $4
     WHERE id = $5 RETURNING *`,
    [
      name !== undefined ? name : current[0].name,
      phone !== undefined ? normalizePhone(phone) : current[0].phone,
      status !== undefined ? (STATUSES.includes(status) ? status : current[0].status) : current[0].status,
      notes !== undefined ? notes : current[0].notes,
      req.params.id
    ]
  );
  res.json(updated[0]);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM contacts WHERE id = $1', [req.params.id]);
  res.status(204).end();
}));

async function findContactByPhone(phone) {
  const { rows } = await pool.query('SELECT * FROM contacts WHERE phone = $1', [phone]);
  return rows[0] || null;
}

module.exports = router;
