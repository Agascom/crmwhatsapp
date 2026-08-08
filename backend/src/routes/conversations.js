const express = require('express');
const pool = require('../db/pool');
const openwa = require('../services/openwa');
const config = require('../config');
const requireAuth = require('../middleware/auth');
const asyncHandler = require('../utils/async');
const { chatToPhone } = require('../utils/phone');

const router = express.Router();
router.use(requireAuth);

async function pickSessionId() {
  if (config.openwaSessionId) return config.openwaSessionId;
  const sessions = await openwa.listSessions();
  const ready = sessions.find((s) => s.status === 'ready');
  if (!ready) {
    const err = new Error('Aucune session WhatsApp prete. Connectez le numero depuis le dashboard OpenWA.');
    err.status = 503;
    throw err;
  }
  return ready.id;
}

router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT m.chat_id, m.ts AS last_ts, m.body AS last_body, m.direction AS last_direction,
           COALESCE((
             SELECT COUNT(*) FROM messages u
             WHERE u.chat_id = m.chat_id
               AND u.direction = 'incoming'
               AND u.ts > COALESCE((SELECT last_read_ts FROM conversations c WHERE c.chat_id = m.chat_id), 0)
           ), 0) AS unread
    FROM messages m
    JOIN (
      SELECT chat_id, MAX(id) AS mid FROM messages GROUP BY chat_id
    ) x ON x.chat_id = m.chat_id AND x.mid = m.id
    ORDER BY m.ts DESC
  `);

  const phones = rows.map((r) => chatToPhone(r.chat_id)).filter(Boolean);
  const contactMap = new Map();
  if (phones.length) {
    const { rows: contacts } = await pool.query(
      'SELECT * FROM contacts WHERE phone = ANY($1::text[])',
      [phones]
    );
    for (const c of contacts) contactMap.set(c.phone, c);
  }

  res.json(
    rows.map((r) => ({
      chatId: r.chat_id,
      lastMessage: r.last_body,
      lastDirection: r.last_direction,
      lastTs: r.last_ts,
      unread: Number(r.unread),
      contact: contactMap.get(chatToPhone(r.chat_id)) || null
    }))
  );
}));

router.get('/:chatId/messages', asyncHandler(async (req, res) => {
  const chatId = req.params.chatId;
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  const { rows } = await pool.query(
    'SELECT * FROM messages WHERE chat_id = $1 ORDER BY ts ASC LIMIT $2',
    [chatId, limit]
  );
  res.json(rows);
}));

router.post('/:chatId/messages', asyncHandler(async (req, res) => {
  const chatId = req.params.chatId;
  const text = (req.body || {}).text;
  if (!text || !text.trim()) {
    return res.status(400).json({ message: 'Le texte du message est requis' });
  }
  const sessionId = await pickSessionId();
  const result = await openwa.sendText(sessionId, chatId, text.trim());
  const ts = Math.floor(Date.now() / 1000);
  const { rows } = await pool.query(
    `INSERT INTO messages (session_id, wa_message_id, chat_id, direction, from_me, body, type, ts, status)
     VALUES ($1, $2, $3, 'outgoing', 1, $4, 'text', $5, 'sent')
     RETURNING *`,
    [sessionId, result.messageId, chatId, text.trim(), ts]
  );
  res.status(201).json(rows[0]);
}));

router.post('/:chatId/read', asyncHandler(async (req, res) => {
  const chatId = req.params.chatId;
  const ts = Math.floor(Date.now() / 1000);
  await pool.query(
    `INSERT INTO conversations (chat_id, last_read_ts) VALUES ($1, $2)
     ON CONFLICT (chat_id) DO UPDATE SET last_read_ts = EXCLUDED.last_read_ts`,
    [chatId, ts]
  );
  res.json({ success: true });
}));

module.exports = router;
