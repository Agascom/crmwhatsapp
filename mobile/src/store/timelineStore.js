import { getDb } from '../db/database';

// Journal d'activité d'un client : créations, changements de statut,
// notes, rappels créés/terminés, envois WhatsApp.
export const timelineStore = {
  async add(clientId, type, title, detail = '') {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO timeline_events (client_id, type, title, detail, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      Number(clientId),
      type,
      title,
      detail,
      Date.now()
    );
  },

  async list(clientId) {
    const db = await getDb();
    const rows = await db.getAllAsync(
      `SELECT id, client_id, type, title, detail, created_at
       FROM timeline_events WHERE client_id = ?
       ORDER BY created_at DESC, id DESC LIMIT 200`,
      Number(clientId)
    );
    return rows;
  },

  async clear(clientId) {
    const db = await getDb();
    await db.runAsync('DELETE FROM timeline_events WHERE client_id = ?', Number(clientId));
  },
};
