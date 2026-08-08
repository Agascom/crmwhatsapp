const express = require('express');
const pool = require('../db/pool');
const verifyWebhookSignature = require('../middleware/webhookAuth');
const asyncHandler = require('../utils/async');
const { normalizePhone, chatToPhone } = require('../utils/phone');

const router = express.Router();
router.use(verifyWebhookSignature);

async function isDuplicate(idempotencyKey) {
  if (!idempotencyKey) return false;
  const { rows } = await pool.query('SELECT 1 FROM messages WHERE idempotency_key = $1 LIMIT 1', [idempotencyKey]);
  return rows.length > 0;
}

async function upsertContact(sessionId, data) {
  const phone = chatToPhone(data.from);
  if (!phone || (data.isGroup && !data.senderPhone)) return;

  const name = (data.contact && (data.contact.pushname || data.contact.name)) || '';
  const senderPhone = data.senderPhone ? chatToPhone(data.senderPhone) : phone;
  const { rows: existing } = await pool.query('SELECT id FROM contacts WHERE phone = $1 OR wa_id = $2', [senderPhone, phone]);
  if (existing.length) return;

  await pool.query(
    'INSERT INTO contacts (wa_id, name, phone) VALUES ($1, $2, $3)',
    [phone, name || '', senderPhone]
  );
}

async function handleMessage(body) {
  const data = body.data || {};
  if (!data.id) return;

  const fromMe = data.fromMe === true;
  const chatId = fromMe ? (data.to || data.chatId) : (data.from || data.chatId);
  if (!chatId) return;

  const message = {
    session_id: body.sessionId || null,
    wa_message_id: data.id,
    chat_id: chatId,
    direction: fromMe ? 'outgoing' : 'incoming',
    from_me: fromMe ? 1 : 0,
    body: typeof data.body === 'string' ? data.body : null,
    type: data.type || 'text',
    ts: data.timestamp || Math.floor(Date.now() / 1000),
    status: fromMe ? 'sent' : 'received'
  };

  try {
    const { rows: duplicate } = await pool.query(
      'SELECT 1 FROM messages WHERE wa_message_id = $1 LIMIT 1',
      [message.wa_message_id]
    );
    if (duplicate.length) return;

    const result = await pool.query(
      `INSERT INTO messages (session_id, wa_message_id, chat_id, direction, from_me, body, type, ts, status, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [message.session_id, message.wa_message_id, message.chat_id, message.direction,
       message.from_me, message.body, message.type, message.ts, message.status, body.idempotencyKey || null]
    );
    if (result.rowCount === 1 && !fromMe) {
      await upsertContact(body.sessionId, data);
    }
  } catch (err) {
    if (err.code === '23505') return;
    throw err;
  }
}

async function handleAck(body) {
  const data = body.data || {};
  if (!data.messageId || !data.status) return;
  await pool.query(
    'UPDATE messages SET status = $1 WHERE wa_message_id = $2 AND status != $3',
    [data.status, data.messageId, 'read']
  );
}

router.post('/openwa', asyncHandler(async (req, res) => {
  const body = req.body;
  if (!body || !body.event) return res.status(400).json({ message: 'Payload webhook invalide' });

  if (await isDuplicate(body.idempotencyKey)) {
    return res.json({ received: true, duplicate: true });
  }

  switch (body.event) {
    case 'message.received':
    case 'message.sent':
      await handleMessage(body);
      break;
    case 'message.ack':
      await handleAck(body);
      break;
    default:
      break;
  }
  res.json({ received: true });
}));

module.exports = router;
