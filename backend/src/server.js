const fs = require('fs');
const path = require('path');
const config = require('./config');
const pool = require('./db/pool');
const app = require('./app');
const registerWebhooks = require('./services/registerWebhooks');

const LOG_FILE = path.join(__dirname, 'server.log');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch (e) {
    /* ignore */
  }
}

process.on('uncaughtException', (err) => {
  log('UNCAUGHT EXCEPTION: ' + (err && err.stack ? err.stack : String(err)));
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log('UNHANDLED REJECTION: ' + String(reason));
});

async function start() {
  log('Demarrage... PORT=' + config.port);
  await pool.query('SELECT 1');
  log('Base de donnees connectee.');
  try {
    const results = await registerWebhooks();
    log('Webhooks OpenWA: ' + JSON.stringify(results));
  } catch (err) {
    log('Enregistrement des webhooks impossible: ' + err.message);
  }
  app.listen(config.port, () => {
    log('CRM WhatsApp backend demarre sur le port ' + config.port);
  });
}

start().catch((err) => {
  log('ERREUR AU DEMARRAGE: ' + (err && err.stack ? err.stack : String(err)));
  process.exit(1);
});
