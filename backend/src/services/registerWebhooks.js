const openwa = require('./openwa');
const config = require('../config');

const WEBHOOK_PATH = '/api/webhook/openwa';
const EVENTS = ['message.received', 'message.sent', 'message.ack', 'message.failed'];

async function registerWebhooks() {
  const webhookUrl = `${config.publicUrl.replace(/\/$/, '')}${WEBHOOK_PATH}`;
  const sessions = await openwa.listSessions();
  const results = [];

  for (const session of sessions) {
    try {
      const existing = await openwa.listWebhooks(session.id);
      const already = existing.find((w) => w.url === webhookUrl);
      if (already) {
        results.push({ session: session.name, status: 'deja_enregistre' });
        continue;
      }
      await openwa.createWebhook(session.id, {
        url: webhookUrl,
        events: EVENTS,
        secret: config.webhookSecret
      });
      results.push({ session: session.name, status: 'enregistre' });
    } catch (err) {
      results.push({ session: session.name, status: 'erreur', error: err.message });
    }
  }
  return results;
}

module.exports = registerWebhooks;
