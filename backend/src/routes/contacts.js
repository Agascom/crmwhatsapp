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
    [rows] = await pool.query(
      'SELECT * FROM contacts WHERE name LIKE ? OR phone LIKE ? ORDER BY name',
      [like, like]
    );
  } else {
    [rows] = await pool.query('SELECT * FROM contacts ORDER BY name');
  }
  res.json(rows);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM contacts WHERE id = ?', [req.params.id]);
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
  const [result] = await pool.query(
    'INSERT INTO contacts (name, phone, wa_id, status, notes) VALUES (?, ?, ?, ?, ?)',
    [name, norm, waId || null, STATUSES.includes(status) ? status : 'prospect', notes || null]
  );
  const [rows] = await pool.query('SELECT * FROM contacts WHERE id = ?', [result.insertId]);
  res.status(201).json(rows[0]);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const { name, phone, status, notes } = req.body || {};
  const [rows] = await pool.query('SELECT * FROM contacts WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Contact introuvable' });

  await pool.query(
    'UPDATE contacts SET name = ?, phone = ?, status = ?, notes = ? WHERE id = ?',
    [
      name !== undefined ? name : rows[0].name,
      phone !== undefined ? normalizePhone(phone) : rows[0].phone,
      status !== undefined ? (STATUSES.includes(status) ? status : rows[0].status) : rows[0].status,
      notes !== undefined ? notes : rows[0].notes,
      req.params.id
    ]
  );
  const [updated] = await pool.query('SELECT * FROM contacts WHERE id = ?', [req.params.id]);
  res.json(updated[0]);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM contacts WHERE id = ?', [req.params.id]);
  res.status(204).end();
}));

async function findContactByPhone(phone) {
  const [rows] = await pool.query('SELECT * FROM contacts WHERE phone = ?', [phone]);
  return rows[0] || null;
}

module.exports = router;
