const crypto = require('crypto');
const http = require('http');
const path = require('path');

process.env.ADMIN_USER = 'admin';
process.env.ADMIN_PASSWORD = 'test';
process.env.JWT_SECRET = 'test-jwt';
process.env.PUBLIC_URL = 'https://crm.example.com';
process.env.OPENWA_URL = 'http://localhost:2785';
process.env.OPENWA_API_KEY = 'test-key';
process.env.WEBHOOK_SECRET = 'test-secret';
process.env.DB_USER = 'u';
process.env.DB_PASSWORD = 'p';
process.env.DB_NAME = 'n';

const SECRET = 'test-secret';

const mockPool = {
  async query(sql, params) {
    const q = String(sql);
    if (q.includes('SELECT 1 FROM messages WHERE idempotency_key')) {
      return [this.alreadyProcessed ? [{}] : []];
    }
    if (q.includes('SELECT 1 FROM messages WHERE wa_message_id')) {
      if (this.waIds.includes(params[0])) return [[{}]];
      return [[]];
    }
    if (q.includes('INSERT INTO messages')) {
      if (this.failInsert) { const e = new Error('dup'); e.code = 'ER_DUP_ENTRY'; throw e; }
      return [{ affectedRows: 1 }];
    }
    if (q.includes('INSERT INTO contacts')) return [{ affectedRows: 1 }];
    if (q.includes('SELECT id FROM contacts')) return [[]];
    if (q.includes('UPDATE messages SET status')) return [{ affectedRows: 1 }];
    return [[]];
  }
};

const poolPath = require.resolve('./src/db/pool');
require.cache[poolPath] = { id: poolPath, filename: poolPath, loaded: true, exports: mockPool };

const app = require('./src/app');

let results = [];
let current = null;
let failures = 0;

function check(name, cond) {
  if (!cond) { failures++; console.log('FAIL', name); } else { console.log('OK  ', name); }
}

function post(pathname, body, headers, expectedStatus, name) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(body));
    const server = http.createServer(app);
    server.listen(0, async () => {
      const port = server.address().port;
      const sig = 'sha256=' + crypto.createHmac('sha256', SECRET).update(data).digest('hex');
      const req = http.request({
        host: '127.0.0.1',
        port,
        path: pathname,
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json', 'X-OpenWA-Signature': sig, 'Content-Length': data.length }
      }, (res) => {
        let out = '';
        res.on('data', (c) => (out += c));
        res.on('end', async () => {
          server.close();
          check(name, res.statusCode === expectedStatus);
          resolve(res.statusCode);
        });
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  });
}

(async () => {
  // 1. Signature valide + nouveau message
  mockPool.alreadyProcessed = false; mockPool.waIds = []; mockPool.failInsert = false;
  await post('/api/webhook/openwa', {
    event: 'message.received',
    sessionId: 's1',
    idempotencyKey: 'k1',
    data: { id: 'wa-1', from: '33612345678@c.us', to: '33698765432@c.us', body: 'Bonjour', type: 'text', timestamp: 1000, isGroup: false, contact: { pushname: 'Jean' } }
  }, {}, 200, 'message.received valide -> 200');

  // 2. Idempotency : même clé -> pas de double insert
  mockPool.alreadyProcessed = true;
  await post('/api/webhook/openwa', {
    event: 'message.received',
    sessionId: 's1',
    idempotencyKey: 'k1',
    data: { id: 'wa-1', from: '33612345678@c.us', to: '33698765432@c.us', body: 'Bonjour', type: 'text', timestamp: 1000 }
  }, {}, 200, 'duplicate idempotency key -> 200 sans insert');

  // 3. Signature invalide -> 401
  mockPool.alreadyProcessed = false; mockPool.waIds = [];
  const badData = Buffer.from(JSON.stringify({ event: 'message.received', idempotencyKey: 'k2', data: { id: 'wa-2', from: 'x@c.us', to: 'y@c.us', body: 'hi', type: 'text', timestamp: 1 } }));
  const httpResult = await new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      const req = http.request({ host: '127.0.0.1', port, path: '/api/webhook/openwa', method: 'POST', headers: { 'Content-Type': 'application/json', 'X-OpenWA-Signature': 'sha256=ffff', 'Content-Length': badData.length } }, (res) => {
        let out = ''; res.on('data', (c) => (out += c)); res.on('end', () => { server.close(); resolve(res.statusCode); });
      });
      req.on('error', reject); req.write(badData); req.end();
    });
  });
  check('signature invalide -> 401', httpResult === 401);

  // 4. message.sent avec wa_message_id deja present -> pas de doublon
  mockPool.alreadyProcessed = false; mockPool.waIds = ['wa-existing'];
  await post('/api/webhook/openwa', {
    event: 'message.sent',
    sessionId: 's1',
    idempotencyKey: 'k3',
    data: { id: 'wa-existing', from: '33698765432@c.us', to: '33612345678@c.us', body: 'Coucou', type: 'text', timestamp: 2000, fromMe: true }
  }, {}, 200, 'message.sent deja present -> pas de doublon');

  // 5. Payload invalide -> 400
  await post('/api/webhook/openwa', {}, {}, 400, 'payload vide -> 400');

  console.log(failures === 0 ? '\nTOUS LES TESTS PASSENT' : `\n${failures} TEST(S) EN ECHEC`);
  process.exit(failures === 0 ? 0 : 1);
})();
