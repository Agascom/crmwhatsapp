import { getDb } from '../db/database';

export const DEFAULT_STAGES = [
  { key: 'new', label: 'Nouveau', color: '#78909C' },
  { key: 'contacted', label: 'Contacté', color: '#1E88E5' },
  { key: 'meeting', label: 'Rendez-vous', color: '#FFA000' },
  { key: 'quoted', label: 'Devis envoyé', color: '#8E24AA' },
  { key: 'won', label: 'Gagné', color: '#43A047' },
  { key: 'lost', label: 'Perdu', color: '#E53935' }
];

// Étapes du pipeline (personnalisables via la table settings).
export async function getStages() {
  const db = await getDb();
  const row = await db.getFirstAsync("SELECT value FROM settings WHERE key = 'pipeline_stages'");
  if (row && row.value) {
    try {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch (e) {
      /* valeurs par défaut */
    }
  }
  return DEFAULT_STAGES;
}

export const opportunitiesStore = {
  async ensureForClient(clientId) {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR IGNORE INTO opportunities (client_id, stage, value, expected_close, created_at, updated_at)
       VALUES (?, 'new', 0, NULL, ?, ?)`,
      Number(clientId),
      Date.now(),
      Date.now()
    );
  },

  // Tous les clients avec leur opportunité (crée implicitement une opportunité 'new' à la lecture).
  async listAll() {
    const db = await getDb();
    const rows = await db.getAllAsync(
      `SELECT o.*, c.id AS client_id, c.name AS client_name, c.phone AS client_phone, c.status AS client_status, c.tags AS client_tags
       FROM clients c LEFT JOIN opportunities o ON o.client_id = c.id
       ORDER BY c.name`
    );
    return rows.map((r) => ({
      id: r.id || 0,
      client_id: r.client_id,
      client_name: r.client_name,
      client_phone: r.client_phone,
      client_status: r.client_status,
      client_tags: r.client_tags || '[]',
      stage: r.stage || 'new',
      value: Number(r.value || 0),
      expected_close: r.expected_close || null,
      created_at: r.created_at || 0,
      updated_at: r.updated_at || 0
    }));
  },

  async setStage(clientId, stage) {
    const db = await getDb();
    await this.ensureForClient(clientId);
    await db.runAsync(
      'UPDATE opportunities SET stage = ?, updated_at = ? WHERE client_id = ?',
      stage,
      Date.now(),
      Number(clientId)
    );
  },

  async setField(clientId, { value, expectedClose }) {
    const db = await getDb();
    await this.ensureForClient(clientId);
    if (value !== undefined) {
      await db.runAsync(
        'UPDATE opportunities SET value = ?, updated_at = ? WHERE client_id = ?',
        Number(value) || 0,
        Date.now(),
        Number(clientId)
      );
    }
    if (expectedClose !== undefined) {
      await db.runAsync(
        'UPDATE opportunities SET expected_close = ?, updated_at = ? WHERE client_id = ?',
        expectedClose || null,
        Date.now(),
        Number(clientId)
      );
    }
  },

  // Statistiques par étape : nombre d'opportunités et montant total.
  async stats() {
    const all = await this.listAll();
    const byStage = {};
    for (const o of all) {
      if (!byStage[o.stage]) byStage[o.stage] = { count: 0, total: 0 };
      byStage[o.stage].count += 1;
      byStage[o.stage].total += o.value;
    }
    return byStage;
  }
};
