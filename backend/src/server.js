const fs = require('fs');
const path = require('path');

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

let config, pool, app, registerWebhooks;
try {
  config = require('./config');
  pool = require('./db/pool');
  app = require('./app');
  registerWebhooks = require('./services/registerWebhooks');
} catch (err) {
  log('ECHEC CHARGEMENT MODULES: ' + (err && err.stack ? err.stack : String(err)));
  log('CWD=' + process.cwd() + ' NODE=' + process.version + ' PORT=' + process.env.PORT);
  process.exit(1);
}

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
