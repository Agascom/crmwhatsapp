const config = require('../config');

const BASE = `${config.openwaUrl}/api`;

async function request(method, path, body) {
  const headers = { 'X-API-Key': config.openwaApiKey };
  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: payload,
    signal: AbortSignal.timeout(30000)
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data && (data.message || data.error) ? (Array.isArray(data.message) ? data.message.join(', ') : data.message) : `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

const openwa = {
  listSessions() {
    return request('GET', '/sessions');
  },

  getSession(id) {
    return request('GET', `/sessions/${id}`);
  },

  createSession(name) {
    return request('POST', '/sessions', { name });
  },

  startSession(id) {
    return request('POST', `/sessions/${id}/start`);
  },

  stopSession(id) {
    return request('POST', `/sessions/${id}/stop`);
  },

  getQr(id) {
    return request('GET', `/sessions/${id}/qr`);
  },

  getChats(id, limit = 100) {
    return request('GET', `/sessions/${id}/chats?limit=${limit}`);
  },

  getHistory(sessionId, chatId, limit = 50) {
    return request('GET', `/sessions/${sessionId}/messages/${encodeURIComponent(chatId)}/history?limit=${limit}`);
  },

  listWebhooks(sessionId) {
    return request('GET', `/sessions/${sessionId}/webhooks`);
  },

  createWebhook(sessionId, { url, events, secret }) {
    return request('POST', `/sessions/${sessionId}/webhooks`, { url, events, secret });
  },

  checkNumber(sessionId, number) {
    return request('GET', `/sessions/${sessionId}/contacts/check/${encodeURIComponent(number)}`);
  },

  sendText(sessionId, chatId, text) {
    return request('POST', `/sessions/${sessionId}/messages/send-text`, { chatId, text });
  }
};

module.exports = openwa;
