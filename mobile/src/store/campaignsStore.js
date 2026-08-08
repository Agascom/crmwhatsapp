import { getDb } from '../db/database';
import { clientsStore } from './clientsStore';
import { api } from '../api';

export const CAMPAIGN_STATUSES = { prepared: 'Préparée', in_progress: 'En cours', done: 'Terminée' };

// Substitua les variables {name}, {phone}, {status} dans le corps du template.
export function renderTemplate(body, client) {
  return String(body || '')
    .replace(/\{name\}/g, client.name || '')
    .replace(/\{phone\}/g, client.phone ? `+${client.phone}` : '')
    .replace(/\{status\}/g, client.status || '');
}

// Corps du message d'une campagne : promotion si présente, sinon template, sinon repli.
export function campaignBody(campaign, client) {
  if (campaign && campaign.promotion && campaign.promotion.body) {
    return renderTemplate(campaign.promotion.body, client);
  }
  if (campaign && campaign.template && campaign.template.body) {
    return renderTemplate(campaign.template.body, client);
  }
  return `Bonjour ${client ? client.name : ''},`;
}

export const campaignsStore = {
  async list({ kind } = {}) {
    const db = await getDb();
    const where = kind ? 'WHERE c.kind = ?' : '';
    const params = kind ? [kind] : [];
    const rows = await db.getAllAsync(
      `SELECT c.*,
              (SELECT COUNT(*) FROM campaign_recipients r WHERE r.campaign_id = c.id) AS recipient_count,
              (SELECT COUNT(*) FROM campaign_recipients r WHERE r.campaign_id = c.id AND r.status = 'sent') AS sent_count,
              t.name AS template_name,
              p.title AS promotion_title
       FROM campaigns c
       LEFT JOIN templates t ON t.id = c.template_id
       LEFT JOIN promotions p ON p.id = c.promotion_id
       ${where}
       ORDER BY c.created_at DESC`,
      ...params
    );
    return rows;
  },

  async get(id) {
    const db = await getDb();
    const camp = await db.getFirstAsync('SELECT * FROM campaigns WHERE id = ?', Number(id));
    if (!camp) return null;
    const template = camp.template_id
      ? await db.getFirstAsync('SELECT * FROM templates WHERE id = ?', camp.template_id)
      : null;
    const promotion = camp.promotion_id
      ? await db.getFirstAsync('SELECT * FROM promotions WHERE id = ?', camp.promotion_id)
      : null;
    const recipients = await db.getAllAsync(
      `SELECT r.*, c.name AS client_name, c.phone AS client_phone, c.status AS client_status
       FROM campaign_recipients r LEFT JOIN clients c ON c.id = r.client_id
       WHERE r.campaign_id = ? ORDER BY c.name`,
      Number(id)
    );
    return { ...camp, template, promotion, recipients };
  },

  // Calcule les destinataires selon le segment (statut + étiquette).
  async computeRecipients({ filterStatus = '', filterTag = '' }) {
    const clients = await clientsStore.getAll();
    return clients
      .filter((c) => !filterStatus || c.status === filterStatus)
      .filter((c) => !filterTag || (c.tags || []).includes(filterTag))
      .map((c) => c.id);
  },

  async create({ name, templateId = null, promotionId = null, kind = 'relance', filterStatus = '', filterTag = '' }) {
    const db = await getDb();
    const now = Date.now();
    const result = await db.runAsync(
      `INSERT INTO campaigns (name, template_id, promotion_id, kind, status, filter_status, filter_tag, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'prepared', ?, ?, ?, ?)`,
      name,
      templateId ? Number(templateId) : null,
      promotionId ? Number(promotionId) : null,
      kind || 'relance',
      filterStatus || '',
      filterTag || '',
      now,
      now
    );
    const campaignId = result.lastInsertRowId;

    const ids = await this.computeRecipients({ filterStatus, filterTag });
    for (const clientId of ids) {
      await db.runAsync(
        'INSERT INTO campaign_recipients (campaign_id, client_id, status, sent_at) VALUES (?, ?, ?, NULL)',
        campaignId,
        Number(clientId)
      );
    }
    return this.get(campaignId);
  },

  async setRecipientStatus(recipientId, status) {
    const db = await getDb();
    const r = await db.getFirstAsync('SELECT * FROM campaign_recipients WHERE id = ?', Number(recipientId));
    if (!r) return;
    await db.runAsync(
      'UPDATE campaign_recipients SET status = ?, sent_at = ? WHERE id = ?',
      status,
      status === 'sent' ? Date.now() : null,
      Number(recipientId)
    );
    // Met à jour l'état global de la campagne selon l'avancement.
    const { total, sent, skipped } = await db.getFirstAsync(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
              SUM(CASE WHEN status IN ('sent', 'skipped') THEN 1 ELSE 0 END) AS skipped
       FROM campaign_recipients WHERE campaign_id = ?`,
      r.campaign_id
    );
    let campaignStatus = 'prepared';
    if (Number(total) > 0 && Number(skipped) === Number(total)) campaignStatus = 'done';
    else if (Number(sent) > 0) campaignStatus = 'in_progress';
    await db.runAsync(
      'UPDATE campaigns SET status = ?, updated_at = ? WHERE id = ?',
      campaignStatus,
      Date.now(),
      r.campaign_id
    );
  },

  // Mesure les retours : messages entrants des destinataires envoyés depuis l'envoi.
  async measureReplies(campaignId) {
    const camp = await this.get(campaignId);
    if (!camp) return [];
    const results = [];
    for (const r of camp.recipients) {
      if (r.status !== 'sent' || !r.client_phone) continue;
      try {
        const msgs = await api.getMessages(api.phoneToChatId(r.client_phone));
        const since = r.sent_at || 0;
        const incoming = msgs.filter(
          (m) => !m.from_me && m.ts * 1000 > since && String(m.body || '').trim().length > 0
        );
        if (incoming.length > 0) {
          results.push({
            clientName: r.client_name,
            count: incoming.length,
            lastMessage: incoming[0].body
          });
        }
      } catch (e) {
        // Pas de session/disponibilité : on ignore ce destinataire.
      }
    }
    return results;
  },

  async remove(id) {
    const db = await getDb();
    await db.runAsync('DELETE FROM campaign_recipients WHERE campaign_id = ?', Number(id));
    await db.runAsync('DELETE FROM campaigns WHERE id = ?', Number(id));
  }
};
