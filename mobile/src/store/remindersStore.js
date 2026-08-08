import { getDb } from '../db/database';
import { timelineStore } from './timelineStore';

// Rappels / relances planifiés par client (aucun envoi automatique).
export const remindersStore = {
  async list(clientId) {
    const db = await getDb();
    const rows = await db.getAllAsync(
      `SELECT id, client_id, title, due_at, done, created_at
       FROM reminders WHERE client_id = ?
       ORDER BY done ASC, due_at ASC`,
      Number(clientId)
    );
    return rows;
  },

  async add(clientId, title, dueAt) {
    const db = await getDb();
    const result = await db.runAsync(
      `INSERT INTO reminders (client_id, title, due_at, done, created_at)
       VALUES (?, ?, ?, 0, ?)`,
      Number(clientId),
      title,
      dueAt,
      Date.now()
    );
    await timelineStore.add(
      clientId,
      'reminder',
      `Rappel créé : ${title}`,
      dueAt ? new Date(dueAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
    );
    return result.lastInsertRowId;
  },

  async toggle(id, done) {
    const db = await getDb();
    const row = await db.getFirstAsync(
      'SELECT client_id, title FROM reminders WHERE id = ?',
      Number(id)
    );
    if (!row) return;
    await db.runAsync('UPDATE reminders SET done = ? WHERE id = ?', done ? 1 : 0, Number(id));
    if (done) {
      await timelineStore.add(row.client_id, 'reminder_done', `Rappel terminé : ${row.title}`);
    }
  },

  async remove(id) {
    const db = await getDb();
    await db.runAsync('DELETE FROM reminders WHERE id = ?', Number(id));
  },
};
