import { getDb } from '../db/database';
import { invoicesStore } from './invoicesStore';
import { timelineStore } from './timelineStore';

function fmt(v) {
  return Math.round(Number(v || 0) * 100) / 100;
}

// Vérifie si l'encaissement total d'une facture la solde.
async function reconcileInvoice(db, invoiceId) {
  if (!invoiceId) return;
  const inv = await invoicesStore.get(invoiceId);
  if (!inv) return;
  const { total } = await db.getFirstAsync(
    'SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE invoice_id = ?',
    Number(invoiceId)
  );
  const paid = fmt(total);
  const current = inv.status;
  if (paid >= inv.total_ttc && current !== 'paid') {
    await invoicesStore.setStatus(invoiceId, 'paid');
  } else if (paid < inv.total_ttc && current === 'paid') {
    await invoicesStore.setStatus(invoiceId, 'sent');
  }
}

export const paymentsStore = {
  async record({ invoiceId = null, clientId, amount, method = '', note = '', date = Date.now() }) {
    const amt = fmt(amount);
    if (amt <= 0) throw new Error('Montant invalide.');
    const db = await getDb();
    const result = await db.runAsync(
      `INSERT INTO payments (invoice_id, client_id, amount, method, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      invoiceId ? Number(invoiceId) : null,
      Number(clientId),
      amt,
      method || '',
      note || '',
      date
    );
    if (invoiceId) {
      const inv = await invoicesStore.get(invoiceId);
      if (inv) {
        await timelineStore.add(
          clientId,
          'payment',
          `Encaissement : ${amt.toFixed(2)} ${inv.currency || 'EUR'}`,
          inv.number
        );
      }
    }
    await reconcileInvoice(db, invoiceId);
    return result.lastInsertRowId;
  },

  async listRecent(limit = 30) {
    const db = await getDb();
    const rows = await db.getAllAsync(
      `SELECT p.*, c.name AS client_name, c.phone AS client_phone, i.number AS invoice_number
       FROM payments p
       LEFT JOIN clients c ON c.id = p.client_id
       LEFT JOIN invoices i ON i.id = p.invoice_id
       ORDER BY p.created_at DESC, p.id DESC LIMIT ?`,
      limit
    );
    return rows;
  },

  async listByInvoice(invoiceId) {
    const db = await getDb();
    return db.getAllAsync(
      `SELECT p.*, c.name AS client_name
       FROM payments p LEFT JOIN clients c ON c.id = p.client_id
       WHERE p.invoice_id = ? ORDER BY p.created_at DESC, p.id DESC`,
      Number(invoiceId)
    );
  },

  async listByClient(clientId) {
    const db = await getDb();
    return db.getAllAsync(
      `SELECT p.*, i.number AS invoice_number
       FROM payments p LEFT JOIN invoices i ON i.id = p.invoice_id
       WHERE p.client_id = ? ORDER BY p.created_at DESC, p.id DESC`,
      Number(clientId)
    );
  },

  // Indicateurs du tableau de bord finances.
  async stats() {
    const db = await getDb();
    const now = Date.now();

    const { total: received } = await db.getFirstAsync('SELECT COALESCE(SUM(amount), 0) AS total FROM payments');
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const { total: monthReceived } = await db.getFirstAsync(
      'SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE created_at >= ?',
      startOfMonth.getTime()
    );

    const outstanding = await db.getFirstAsync(
      `SELECT COALESCE(SUM(total_ttc), 0) AS total, COUNT(*) AS count
       FROM invoices WHERE type = 'invoice' AND status IN ('sent', 'overdue')`
    );

    const pendingQuotes = await db.getFirstAsync(
      `SELECT COALESCE(SUM(total_ttc), 0) AS total, COUNT(*) AS count
       FROM invoices WHERE type = 'quote' AND status = 'sent'`
    );

    const overdue = await db.getAllAsync(
      `SELECT i.id, i.number, i.total_ttc, i.due_date, i.status, i.currency,
              c.id AS client_id, c.name AS client_name, c.phone AS client_phone
       FROM invoices i LEFT JOIN clients c ON c.id = i.client_id
       WHERE i.type = 'invoice' AND i.status IN ('sent', 'overdue')
         AND i.due_date IS NOT NULL AND i.due_date < ?
       ORDER BY i.due_date ASC`,
      now
    );

    return {
      received: fmt(received),
      monthReceived: fmt(monthReceived),
      outstanding: fmt(outstanding.total),
      outstandingCount: Number(outstanding.count || 0),
      pendingQuotes: fmt(pendingQuotes.total),
      pendingQuotesCount: Number(pendingQuotes.count || 0),
      overdue: overdue.map((o) => ({
        ...o,
        total_ttc: fmt(o.total_ttc),
        days: Math.max(1, Math.round((now - o.due_date) / 86400000))
      }))
    };
  },

  async remove(id) {
    const db = await getDb();
    const p = await db.getFirstAsync('SELECT * FROM payments WHERE id = ?', Number(id));
    if (!p) return;
    await db.runAsync('DELETE FROM payments WHERE id = ?', Number(id));
    await reconcileInvoice(db, p.invoice_id);
  }
};
