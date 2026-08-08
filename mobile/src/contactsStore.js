import AsyncStorage from '@react-native-async-storage/async-storage';

const CONTACTS_KEY = 'crm_contacts';

function normalizePhone(input) {
  if (input === undefined || input === null) return '';
  return String(input).replace(/[^0-9]/g, '');
}

async function readAll() {
  const raw = await AsyncStorage.getItem(CONTACTS_KEY);
  try {
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

async function writeAll(list) {
  await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(list));
}

export const contactsStore = {
  async getAll() {
    return readAll();
  },

  async get(id) {
    const all = await readAll();
    return all.find((c) => String(c.id) === String(id)) || null;
  },

  async findByPhone(phone) {
    const all = await readAll();
    const norm = normalizePhone(phone);
    if (!norm) return null;
    return all.find((c) => c.phone && normalizePhone(c.phone) === norm) || null;
  },

  async create(data) {
    const all = await readAll();
    const contact = {
      id: String(Date.now()),
      name: (data.name || '').trim(),
      phone: normalizePhone(data.phone || ''),
      waId: data.waId || null,
      status: data.status || 'prospect',
      notes: data.notes || '',
      createdAt: Date.now()
    };
    all.push(contact);
    await writeAll(all);
    return contact;
  },

  async update(id, data) {
    const all = await readAll();
    const idx = all.findIndex((c) => String(c.id) === String(id));
    if (idx === -1) throw new Error('Contact introuvable');
    const current = all[idx];
    const updated = {
      ...current,
      name: data.name !== undefined ? data.name : current.name,
      phone: data.phone !== undefined ? normalizePhone(data.phone) : current.phone,
      status: data.status !== undefined ? data.status : current.status,
      notes: data.notes !== undefined ? data.notes : current.notes
    };
    all[idx] = updated;
    await writeAll(all);
    return updated;
  },

  async remove(id) {
    const all = await readAll();
    await writeAll(all.filter((c) => String(c.id) !== String(id)));
  }
};
