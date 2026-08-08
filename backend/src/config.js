require('dotenv').config();

function required(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`Variable d'environnement manquante: ${name}`);
  }
  return v;
}

const config = {
  port: required('PORT', 3000),
  adminUser: required('ADMIN_USER', 'admin'),
  adminPassword: required('ADMIN_PASSWORD'),
  jwtSecret: required('JWT_SECRET'),
  publicUrl: required('PUBLIC_URL'),
  openwaUrl: required('OPENWA_URL'),
  openwaApiKey: required('OPENWA_API_KEY'),
  openwaSessionId: required('OPENWA_SESSION_ID', ''),
  webhookSecret: required('WEBHOOK_SECRET'),
  databaseUrl: required('DATABASE_URL')
};

module.exports = config;
