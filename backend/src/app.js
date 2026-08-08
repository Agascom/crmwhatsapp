const express = require('express');
const cors = require('cors');
const registerWebhooks = require('./services/registerWebhooks');
const requireAuth = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const sessionRoutes = require('./routes/sessions');
const contactRoutes = require('./routes/contacts');
const conversationRoutes = require('./routes/conversations');
const webhookRoutes = require('./routes/webhook');

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb', verify: (req, _res, buf) => { req.rawBody = buf; } }));

app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

app.use('/api/auth', authRoutes);
app.use('/api/webhook', webhookRoutes);

app.use('/api/sessions', sessionRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/conversations', conversationRoutes);

app.post('/api/register-webhooks', requireAuth, async (_req, res) => {
  const results = await registerWebhooks();
  res.json(results);
});

app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || (err.code === 'ER_ACCESS_DENIED_ERROR' ? 503 : 500);
  res.status(status).json({ message: err.message || 'Erreur interne' });
});

module.exports = app;
