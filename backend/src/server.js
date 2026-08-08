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
});

process.on('unhandledRejection', (reason) => {
  log('UNHANDLED REJECTION: ' + String(reason));
});

let config, pool, app, registerWebhooks, ensureSchema;
try {
  config = require('./config');
  pool = require('./db/pool');
  app = require('./app');
  registerWebhooks = require('./services/registerWebhooks');
  ensureSchema = require('./db/ensureSchema');
} catch (err) {
  log('ECHEC CHARGEMENT MODULES: ' + (err && err.stack ? err.stack : String(err)));
  log('CWD=' + process.cwd() + ' NODE=' + process.version + ' PORT=' + process.env.PORT);
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDatabase(attempts, delayMs) {
  for (let i = 1; i <= attempts; i++) {
    try {
      await pool.query('SELECT 1');
      return true;
    } catch (err) {
      log(`Base indisponible (tentative ${i}/${attempts}): ${err.message}`);
      await sleep(delayMs);
    }
  }
  return false;
}

async function start() {
  log('Demarrage... PORT=' + config.port);
  app.listen(config.port, () => {
    log('CRM WhatsApp backend demarre sur le port ' + config.port);
  });

  const dbOk = await waitForDatabase(10, 5000);
  if (!dbOk) {
    log('ECHEC: base de donnees injoignable. Le serveur reste up (voir /health) mais les routes base ne marcheront pas.');
    return;
  }
  log('Base de donnees connectee.');
  try {
    await ensureSchema();
    log('Schema Postgres verifie (tables pretes).');
  } catch (err) {
    log('ECHEC INIT SCHEMA: ' + err.message);
  }
  try {
    const results = await registerWebhooks();
    log('Webhooks OpenWA: ' + JSON.stringify(results));
  } catch (err) {
    log('Enregistrement des webhooks impossible: ' + err.message);
  }
}

start().catch((err) => {
  log('ERREUR AU DEMARRAGE: ' + (err && err.stack ? err.stack : String(err)));
});
