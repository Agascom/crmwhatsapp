import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'crm_token';
const URL_KEY = 'crm_api_url';

export const defaultApiUrl = Constants.expoConfig?.extra?.apiUrl || 'https://crm.votre-domaine.com';

export async function getApiUrl() {
  const stored = await SecureStore.getItemAsync(URL_KEY);
  return (stored || defaultApiUrl).replace(/\/+$/, '');
}

export async function setApiUrl(url) {
  await SecureStore.setItemAsync(URL_KEY, url.replace(/\/+$/, ''));
}

export async function getToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token) {
  if (token) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const base = await getApiUrl();
  const token = await getToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  if (res.status === 401) {
    throw new ApiError('Session expirée, reconnectez-vous', 401);
  }
  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(data?.message || `Erreur ${res.status}`, res.status);
  }
  return data;
}

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export const api = {
  async login(username, password) {
    const data = await request('/api/auth/login', { method: 'POST', body: { username, password } });
    await setToken(data.token);
    return data;
  },

  getConversations() {
    return request('/api/conversations');
  },

  getMessages(chatId) {
    return request(`/api/conversations/${encodeURIComponent(chatId)}/messages`);
  },

  sendMessage(chatId, text) {
    return request(`/api/conversations/${encodeURIComponent(chatId)}/messages`, {
      method: 'POST',
      body: { text }
    });
  },

  markRead(chatId) {
    return request(`/api/conversations/${encodeURIComponent(chatId)}/read`, { method: 'POST' });
  },

  getContacts(search) {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return request(`/api/contacts${q}`);
  },

  getContact(id) {
    return request(`/api/contacts/${id}`);
  },

  createContact(data) {
    return request('/api/contacts', { method: 'POST', body: data });
  },

  updateContact(id, data) {
    return request(`/api/contacts/${id}`, { method: 'PUT', body: data });
  },

  deleteContact(id) {
    return request(`/api/contacts/${id}`, { method: 'DELETE' });
  },

  getSessions() {
    return request('/api/sessions');
  },

  startSession(id) {
    return request(`/api/sessions/${id}/start`, { method: 'POST' });
  }
};

export function isAuthError(err) {
  return err && err.status === 401;
}
