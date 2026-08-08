import { getDb } from '../db/database';

export const templatesStore = {
  async list() {
    const db = await getDb();
    return db.getAllAsync('SELECT * FROM templates ORDER BY name');
  },

  async get(id) {
    const db = await getDb();
    return db.getFirstAsync('SELECT * FROM templates WHERE id = ?', Number(id));
  },

  async create({ name, body }) {
    const db = await getDb();
    const now = Date.now();
    const result = await db.runAsync(
      'INSERT INTO templates (name, body, created_at, updated_at) VALUES (?, ?, ?, ?)',
      name,
      body,
      now,
      now
    );
    return this.get(result.lastInsertRowId);
  },

  async update(id, { name, body }) {
    const db = await getDb();
    await db.runAsync(
      'UPDATE templates SET name = ?, body = ?, updated_at = ? WHERE id = ?',
      name,
      body,
      Date.now(),
      Number(id)
    );
    return this.get(id);
  },

  async remove(id) {
    const db = await getDb();
    await db.runAsync('DELETE FROM templates WHERE id = ?', Number(id));
  }
};
