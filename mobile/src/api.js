import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { contactsStore } from './contactsStore';

const URL_KEY = 'owa_url';
const KEY_KEY = 'owa_api_key';
const SESSION_KEY = 'owa_session_id';

const defaults = {
  url: Constants.expoConfig?.extra?.owaUrl || '',
  key: Constants.expoConfig?.extra?.owaApiKey || ''
};

function normalizePhone(input) {
  if (input === undefined || input === null) return '';
  return String(input).replace(/[^0-9]/g, '').replace(/^0+/, '');
}

function chatToPhone(chatId) {
  return normalizePhone(String(chatId || '').split('@')[0]);
}

function phoneToChatId(phone) {
  return `${normalizePhone(phone)}@c.us`;
}

export async function getConfig() {
  const url = (await SecureStore.getItemAsync(URL_KEY)) || defaults.url;
  const key = (await SecureStore.getItemAsync(KEY_KEY)) || defaults.key;
  return { url: url.replace(/\/+$/, ''), key: key.trim() };
}

export async function setConfig({ url, key }) {
  if (url) await SecureStore.setItemAsync(URL_KEY, url.replace(/\/+$/, ''));
  if (key) await SecureStore.setItemAsync(KEY_KEY, key.trim());
}

export async function clearConfig() {
  await SecureStore.deleteItemAsync(URL_KEY);
  await SecureStore.deleteItemAsync(KEY_KEY);
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

export async function isConfigured() {
  const { url, key } = await getConfig();
  return Boolean(url && key);
}

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const { url, key } = await getConfig();
  if (!url || !key) throw new ApiError('Application non configurée (URL ou clé API manquante)', 401);
  const headers = { 'X-API-Key': key };
  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${url}/api${path}`, { method, headers, body: payload });
  } catch (e) {
    throw new ApiError('Impossible de joindre le serveur OpenWA', 0);
  }

  if (res.status === 401) {
    throw new ApiError('Clé API invalide', 401);
  }
  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data && (data.message || data.error)
      ? (Array.isArray(data.message) ? data.message.join(', ') : data.message)
      : `Erreur ${res.status}`;
    throw new ApiError(msg, res.status);
  }
  return data;
}

async function getCachedSessionId() {
  return SecureStore.getItemAsync(SESSION_KEY);
}

async function resolveSessionId() {
  const sessions = await request('/sessions');
  const ready = sessions.find((s) => s.status === 'ready');
  if (!ready) {
    throw new ApiError('Aucune session WhatsApp prête. Connectez le numéro depuis le dashboard OpenWA.', 503);
  }
  await SecureStore.setItemAsync(SESSION_KEY, ready.id);
  return ready.id;
}

async function getSessionId() {
  const cached = await getCachedSessionId();
  if (cached) return cached;
  return resolveSessionId();
}

async function withSession(fn) {
  try {
    const sid = await getSessionId();
    return await fn(sid);
  } catch (err) {
    if (err.status === 400 || err.status === 404 || err.status === 503) {
      await SecureStore.deleteItemAsync(SESSION_KEY);
      const sid = await resolveSessionId();
      return await fn(sid);
    }
    throw err;
  }
}

function mapMessage(m, chatId) {
  const fromMe = m.direction === 'outgoing' || m.fromMe === true;
  return {
    id: m.id,
    chat_id: m.chatId || chatId,
    body: typeof m.body === 'string' ? m.body : '',
    direction: fromMe ? 'outgoing' : 'incoming',
    from_me: fromMe ? 1 : 0,
    type: m.type || 'text',
    ts: m.timestamp || Math.floor(Date.now() / 1000)
  };
}

export const api = {
  async connect() {
    const sessions = await request('/sessions');
    const ready = sessions.find((s) => s.status === 'ready');
    if (ready) await SecureStore.setItemAsync(SESSION_KEY, ready.id);
    return sessions;
  },

  async getSessions() {
    return request('/sessions');
  },

  async getConversations() {
    return withSession(async (sid) => {
      const [chats, contacts] = await Promise.all([
        request(`/sessions/${sid}/chats?limit=100`),
        contactsStore.getAll()
      ]);
      const byPhone = new Map(contacts.map((c) => [c.phone, c]));
      return chats.map((c) => {
        const phone = chatToPhone(c.id);
        const contact = byPhone.get(phone) || null;
        return {
          chatId: c.id,
          name: c.name || (contact && contact.name) || phone,
          lastMessage: c.lastMessage || '',
          lastDirection: 'incoming',
          lastTs: c.timestamp || null,
          unread: c.unreadCount || 0,
          contact
        };
      });
    });
  },

  async getMessages(chatId) {
    return withSession(async (sid) => {
      const data = await request(`/sessions/${sid}/messages?chatId=${encodeURIComponent(chatId)}&limit=50`);
      return (Array.isArray(data) ? data : []).map((m) => mapMessage(m, chatId));
    });
  },

  async sendMessage(chatId, text) {
    return withSession(async (sid) => {
      const result = await request(`/sessions/${sid}/messages/send-text`, {
        method: 'POST',
        body: { chatId, text }
      });
      return {
        id: result?.messageId || result?.id || `tmp-${Date.now()}`,
        chat_id: chatId,
        body: text,
        direction: 'outgoing',
        from_me: 1,
        type: 'text',
        ts: Math.floor(Date.now() / 1000)
      };
    });
  },

  async markRead(chatId) {
    return withSession(async (sid) => {
      await request(`/sessions/${sid}/chats/read`, { method: 'POST', body: { chatId } });
    });
  },

  async getContacts(search) {
    const all = await contactsStore.getAll();
    const term = (search || '').trim().toLowerCase();
    if (!term) return all;
    return all.filter((c) =>
      (c.name || '').toLowerCase().includes(term) || (c.phone || '').includes(term)
    );
  },

  async getContact(id) {
    const c = await contactsStore.get(id);
    if (!c) throw new ApiError('Contact introuvable', 404);
    return c;
  },

  async createContact(data) {
    return contactsStore.create(data);
  },

  async updateContact(id, data) {
    return contactsStore.update(id, data);
  },

  async deleteContact(id) {
    return contactsStore.remove(id);
  },

  async checkNumber(phone) {
    return withSession(async (sid) => {
      const digits = normalizePhone(phone);
      if (!digits) return { exists: false };
      return request(`/sessions/${sid}/contacts/check/${digits}`);
    });
  },

  phoneToChatId
};

export function isAuthError(err) {
  return err && (err.status === 401 || err.status === 0);
}
