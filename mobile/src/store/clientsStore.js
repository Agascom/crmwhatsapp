import { getDb, parseTags } from '../db/database';

const FIELDS = 'id, phone, name, wa_id, status, tags, notes, source, created_at, updated_at';
const STATUSES = ['prospect', 'client', 'finalise'];

function mapRow(row) {
  if (!row) return null;
  return { ...row, tags: parseTags(row.tags) };
}

// Normalise un numéro au format international E.164 (pour WhatsApp).
export function normalizePhone(input) {
  if (input === undefined || input === null) return '';
  return String(input).replace(/[^0-9]/g, '').replace(/^0+/, '');
}

async function get(id) {
  const db = await getDb();
  const row = await db.getFirstAsync(
    `SELECT ${FIELDS} FROM clients WHERE id = ?`,
    Number(id)
  );
  return mapRow(row);
}

async function touch(db, id) {
  await db.runAsync('UPDATE clients SET updated_at = ? WHERE id = ?', Date.now(), Number(id));
}

export const clientsStore = {
  async getAll() {
    const db = await getDb();
    const rows = await db.getAllAsync(`SELECT ${FIELDS} FROM clients ORDER BY name`);
    return rows.map(mapRow);
  },

  async search(term) {
    const all = await this.getAll();
    const t = (term || '').trim().toLowerCase();
    if (!t) return all;
    return all.filter((c) => {
      const haystack = [c.name, c.phone, ...(c.tags || [])].join(' ').toLowerCase();
      return haystack.includes(t);
    });
  },

  get,

  async getByPhone(phone) {
    const p = normalizePhone(phone);
    if (!p) return null;
    const db = await getDb();
    const row = await db.getFirstAsync(`SELECT ${FIELDS} FROM clients WHERE phone = ?`, p);
    return mapRow(row);
  },

  // Crée un client et journalise l'événement dans la timeline.
  async create({ name = '', phone = '', status = 'prospect', tags = [], notes = '', waId = null, source = '' }) {
    const p = normalizePhone(phone);
    const now = Date.now();
    const db = await getDb();
    const result = await db.runAsync(
      `INSERT INTO clients (phone, name, wa_id, status, tags, notes, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      p || null,
      name,
      waId || null,
      status,
      JSON.stringify(tags || []),
      notes || '',
      source || '',
      now,
      now
    );
    await db.runAsync(
      `INSERT INTO timeline_events (client_id, type, title, detail, created_at)
       VALUES (?, 'created', ?, ?, ?)`,
      result.lastInsertRowId,
      name ? `Client créé : ${name}` : 'Client créé',
      p ? `+${p}` : '',
      now
    );
    return get(result.lastInsertRowId);
  },

  async update(id, fields) {
    const current = await get(id);
    if (!current) return null;
    const sets = [];
    const params = [];
    const allowed = { name: 1, status: 1, tags: 1, notes: 1, source: 1 };

    if (fields.phone !== undefined) {
      const p = normalizePhone(fields.phone);
      if (p) {
        sets.push('phone = ?');
        params.push(p);
      }
    }
    if (fields.waId !== undefined) {
      sets.push('wa_id = ?');
      params.push(fields.waId || null);
    }
    for (const key of Object.keys(fields)) {
      if (!allowed[key]) continue;
      if (fields[key] === undefined) continue;
      const value = key === 'tags' ? JSON.stringify(fields[key] || []) : fields[key];
      sets.push(`${key} = ?`);
      params.push(value);
    }
    if (!sets.length) return current;

    const now = Date.now();
    const db = await getDb();
    sets.push('updated_at = ?');
    params.push(now);
    await db.runAsync(`UPDATE clients SET ${sets.join(', ')} WHERE id = ?`, ...params, Number(id));

    // Journalise les changements notables dans la timeline.
    if (fields.status !== undefined && fields.status !== current.status) {
      const label = STATUSES.includes(fields.status) ? fields.status : fields.status;
      await db.runAsync(
        `INSERT INTO timeline_events (client_id, type, title, detail, created_at)
         VALUES (?, 'status', 'Statut passé à ${label}', ?, ?)`,
        Number(id),
        `${current.status} → ${fields.status}`,
        now
      );
    }
    if (fields.notes !== undefined && fields.notes !== current.notes) {
      await db.runAsync(
        `INSERT INTO timeline_events (client_id, type, title, detail, created_at)
         VALUES (?, 'note', 'Note mise à jour', ?, ?)`,
        Number(id),
        fields.notes ? fields.notes.slice(0, 80) : '',
        now
      );
    }
    if (fields.tags !== undefined && JSON.stringify(fields.tags) !== JSON.stringify(current.tags)) {
      await db.runAsync(
        `INSERT INTO timeline_events (client_id, type, title, detail, created_at)
         VALUES (?, 'tags', 'Étiquettes mises à jour', ?, ?)`,
        Number(id),
        (fields.tags || []).join(', '),
        now
      );
    }
    return get(id);
  },

  async remove(id) {
    const db = await getDb();
    await db.runAsync('DELETE FROM reminders WHERE client_id = ?', Number(id));
    await db.runAsync('DELETE FROM timeline_events WHERE client_id = ?', Number(id));
    await db.runAsync('DELETE FROM clients WHERE id = ?', Number(id));
  },
};

export { STATUSES };
