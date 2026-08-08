import { getDb } from '../db/database';

export const promotionsStore = {
  async list({ activeOnly = false } = {}) {
    const db = await getDb();
    const where = activeOnly ? 'WHERE active = 1' : '';
    return db.getAllAsync(`SELECT * FROM promotions ${where} ORDER BY active DESC, created_at DESC`);
  },

  async get(id) {
    const db = await getDb();
    return db.getFirstAsync('SELECT * FROM promotions WHERE id = ?', Number(id));
  },

  async create({ title, body, discount_label = '', valid_until = null, active = 1 }) {
    const db = await getDb();
    const now = Date.now();
    const result = await db.runAsync(
      `INSERT INTO promotions (title, body, discount_label, valid_until, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      title,
      body,
      discount_label,
      valid_until || null,
      active ? 1 : 0,
      now,
      now
    );
    return this.get(result.lastInsertRowId);
  },

  async update(id, { title, body, discount_label, valid_until, active }) {
    const db = await getDb();
    await db.runAsync(
      `UPDATE promotions SET title = ?, body = ?, discount_label = ?, valid_until = ?, active = ?, updated_at = ?
       WHERE id = ?`,
      title,
      body,
      discount_label || '',
      valid_until === undefined ? null : valid_until,
      active ? 1 : 0,
      Date.now(),
      Number(id)
    );
    return this.get(id);
  },

  async toggleActive(id, active) {
    const db = await getDb();
    await db.runAsync('UPDATE promotions SET active = ?, updated_at = ? WHERE id = ?', active ? 1 : 0, Date.now(), Number(id));
  },

  async remove(id) {
    const db = await getDb();
    await db.runAsync('DELETE FROM promotions WHERE id = ?', Number(id));
  }
};
