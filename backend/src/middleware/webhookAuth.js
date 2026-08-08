const crypto = require('crypto');
const config = require('../config');

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyWebhookSignature(req, res, next) {
  const signature = req.headers['x-openwa-signature'];
  if (!config.webhookSecret || !signature) {
    return next();
  }
  const expected = 'sha256=' + crypto.createHmac('sha256', config.webhookSecret).update(req.rawBody).digest('hex');
  if (!timingSafeEqual(signature, expected)) {
    return res.status(401).json({ message: 'Signature webhook invalide' });
  }
  next();
}

module.exports = verifyWebhookSignature;
