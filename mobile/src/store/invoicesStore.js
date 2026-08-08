import { getDb } from '../db/database';
import { timelineStore } from './timelineStore';

// Statuts par type de document.
export const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'rejected'];
export const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'overdue', 'cancelled'];

export const STATUS_LABELS = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  accepted: 'Accepté',
  rejected: 'Refusé',
  paid: 'Payée',
  overdue: 'En retard',
  cancelled: 'Annulé'
};

export const TYPE_LABELS = { quote: 'Devis', invoice: 'Facture' };
export const TYPE_PREFIX = { quote: 'DEV', invoice: 'FAC' };

export function computeTotals(items) {
  let ht = 0;
  let ttc = 0;
  for (const it of items || []) {
    const line = Number(it.qty || 0) * Number(it.unit_price || 0);
    ht += line;
    ttc += line * (1 + Number(it.tva || 0) / 100);
  }
  return { ht: Math.round(ht * 100) / 100, ttc: Math.round(ttc * 100) / 100 };
}

function mapRow(row) {
  if (!row) return null;
  return {
    ...row,
    total_ht: Number(row.total_ht || 0),
    total_ttc: Number(row.total_ttc || 0)
  };
}

async function nextNumber(db, type, now) {
  const prefix = TYPE_PREFIX[type] || 'DEV';
  const year = new Date(now).getFullYear();
  const rows = await db.getAllAsync(
    'SELECT number FROM invoices WHERE type = ? AND number LIKE ?',
    type,
    `${prefix}-${year}-%`
  );
  let max = 0;
  for (const r of rows) {
    const m = /-(\d+)$/.exec(String(r.number || ''));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}-${year}-${String(max + 1).padStart(4, '0')}`;
}

export const invoicesStore = {
  async listByClient(clientId) {
    const db = await getDb();
    const rows = await db.getAllAsync(
      'SELECT * FROM invoices WHERE client_id = ? ORDER BY created_at DESC, id DESC',
      Number(clientId)
    );
    return rows.map(mapRow);
  },

  // Factures ouvertes (non soldées) pour un encaissement.
  async listOpenInvoices() {
    const db = await getDb();
    const rows = await db.getAllAsync(
      `SELECT i.*, c.name AS client_name, c.phone AS client_phone,
              COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id), 0) AS paid
       FROM invoices i LEFT JOIN clients c ON c.id = i.client_id
       WHERE i.type = 'invoice' AND i.status IN ('draft', 'sent', 'overdue')
       ORDER BY i.issue_date DESC`
    );
    return rows.map((r) => {
      const inv = mapRow(r);
      inv.client_name = r.client_name;
      inv.client_phone = r.client_phone;
      inv.paid = Number(r.paid || 0);
      inv.remaining = Math.round((inv.total_ttc - inv.paid) * 100) / 100;
      return inv;
    });
  },

  async get(id) {
    const db = await getDb();
    const inv = await db.getFirstAsync('SELECT * FROM invoices WHERE id = ?', Number(id));
    if (!inv) return null;
    const items = await db.getAllAsync(
      'SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id ASC',
      Number(id)
    );
    return { ...mapRow(inv), items };
  },

  async create({ clientId, type = 'quote', items = [], issueDate, dueDate = null, notes = '', currency = 'EUR' }) {
    const db = await getDb();
    const now = Date.now();
    const issue = issueDate || now;
    const totals = computeTotals(items);
    const number = await nextNumber(db, type, issue);

    const result = await db.runAsync(
      `INSERT INTO invoices (type, number, client_id, status, currency, issue_date, due_date, notes, total_ht, total_ttc, created_at, updated_at)
       VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?)`,
      type,
      number,
      Number(clientId),
      currency,
      issue,
      dueDate || null,
      notes || '',
      totals.ht,
      totals.ttc,
      now,
      now
    );
    const invoiceId = result.lastInsertRowId;
    await this.replaceItems(invoiceId, items);

    const label = TYPE_LABELS[type] || 'Document';
    await timelineStore.add(clientId, 'invoice', `${label} créé : ${number}`, `${totals.ttc.toFixed(2)} ${currency}`);

    return this.get(invoiceId);
  },

  async replaceItems(invoiceId, items) {
    const db = await getDb();
    await db.runAsync('DELETE FROM invoice_items WHERE invoice_id = ?', Number(invoiceId));
    for (const it of items || []) {
      if (!it || !it.label) continue;
      const lineTotal = Number(it.qty || 0) * Number(it.unit_price || 0);
      await db.runAsync(
        `INSERT INTO invoice_items (invoice_id, label, qty, unit_price, tva, total)
         VALUES (?, ?, ?, ?, ?, ?)`,
        Number(invoiceId),
        String(it.label),
        Number(it.qty || 0),
        Number(it.unit_price || 0),
        Number(it.tva || 0),
        Math.round(lineTotal * 100) / 100
      );
    }
  },

  async update(id, { type, items, issueDate, dueDate, notes, currency }) {
    const db = await getDb();
    const current = await db.getFirstAsync('SELECT * FROM invoices WHERE id = ?', Number(id));
    if (!current) return null;

    const newType = type || current.type;
    const totals = items !== undefined ? computeTotals(items) : { ht: current.total_ht, ttc: current.total_ttc };

    await db.runAsync(
      `UPDATE invoices SET type = ?, currency = ?, issue_date = ?, due_date = ?, notes = ?, total_ht = ?, total_ttc = ?, updated_at = ?
       WHERE id = ?`,
      newType,
      currency || current.currency,
      issueDate || current.issue_date,
      dueDate === undefined ? current.due_date : dueDate,
      notes === undefined ? current.notes : notes,
      totals.ht,
      totals.ttc,
      Date.now(),
      Number(id)
    );
    if (items !== undefined) await this.replaceItems(id, items);
    return this.get(id);
  },

  async setStatus(id, status) {
    const db = await getDb();
    const inv = await db.getFirstAsync('SELECT * FROM invoices WHERE id = ?', Number(id));
    if (!inv || inv.status === status) return this.get(id);
    await db.runAsync('UPDATE invoices SET status = ?, updated_at = ? WHERE id = ?', status, Date.now(), Number(id));

    const label = TYPE_LABELS[inv.type] || 'Document';
    await timelineStore.add(
      inv.client_id,
      'invoice',
      `${label} ${inv.number} : ${STATUS_LABELS[status] || status}`,
      `${STATUS_LABELS[inv.status] || inv.status} → ${STATUS_LABELS[status] || status}`
    );
    return this.get(id);
  },

  async remove(id) {
    const db = await getDb();
    const inv = await db.getFirstAsync('SELECT * FROM invoices WHERE id = ?', Number(id));
    if (!inv) return;
    await db.runAsync('DELETE FROM invoice_items WHERE invoice_id = ?', Number(id));
    await db.runAsync('DELETE FROM invoices WHERE id = ?', Number(id));
    const label = TYPE_LABELS[inv.type] || 'Document';
    await timelineStore.add(inv.client_id, 'invoice', `${label} supprimé : ${inv.number}`);
  }
};
