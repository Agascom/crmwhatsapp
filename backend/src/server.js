const config = require('./config');
const pool = require('./db/pool');
const app = require('./app');
const registerWebhooks = require('./services/registerWebhooks');

async function start() {
  await pool.query('SELECT 1');
  console.log('Base de donnees connectee.');
  try {
    const results = await registerWebhooks();
    console.log('Webhooks OpenWA:', JSON.stringify(results));
  } catch (err) {
    console.warn('Enregistrement des webhooks impossible:', err.message);
  }
  app.listen(config.port, () => {
    console.log(`CRM WhatsApp backend demarre sur le port ${config.port}`);
  });
}

start().catch((err) => {
  console.error('Erreur au demarrage:', err.message);
  process.exit(1);
});
