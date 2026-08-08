const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function init() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const statements = schema
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    await pool.query(stmt);
  }
  console.log('Base de donnees initialisee (tables creees).');
  await pool.end();
}

init().catch((err) => {
  console.error('Erreur initialisation base de donnees:', err.message);
  process.exit(1);
});
