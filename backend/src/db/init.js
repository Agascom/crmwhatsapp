const ensureSchema = require('./ensureSchema');
const pool = require('./pool');

ensureSchema()
  .then(() => {
    console.log('Base de donnees initialisee (tables creees).');
    return pool.end();
  })
  .catch((err) => {
    console.error('Erreur initialisation base de donnees:', err.message);
    process.exit(1);
  });
