const { Pool } = require('pg');
const config = require('../config');

const u = new URL(config.databaseUrl);

const pool = new Pool({
  host: u.hostname,
  port: Number(u.port || 5432),
  user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
  database: decodeURIComponent(u.pathname.replace(/^\//, '')),
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
  max: 5
});

pool.on('error', (err) => {
  console.error('Erreur du pool Postgres:', err.message);
});

module.exports = pool;
