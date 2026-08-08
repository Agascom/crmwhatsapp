import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Version du schéma : incrémenter à chaque évolution des tables.
const DB_VERSION = 2;

let db = null;

function normalizePhone(input) {
  if (input === undefined || input === null) return '';
  return String(input).replace(/[^0-9]/g, '').replace(/^0+/, '');
}

// Ouvre la base (une seule fois) puis applique les migrations.
export async function getDb() {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('crm.db');
  await migrate(db);
  return db;
}

async function migrate(database) {
  await database.execAsync('PRAGMA journal_mode = WAL;');
  const { user_version: current } = await database.getFirstAsync('PRAGMA user_version');

  if (current < 1) {
    // Schéma v1 : clients + timeline + rappels (Module « Suivi client »).
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT UNIQUE,
        name TEXT NOT NULL DEFAULT '',
        wa_id TEXT,
        status TEXT NOT NULL DEFAULT 'prospect',
        tags TEXT NOT NULL DEFAULT '[]',
        notes TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS timeline_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        detail TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        due_at INTEGER NOT NULL,
        done INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_timeline_client ON timeline_events (client_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_reminders_client ON reminders (client_id);
    `);
    await database.execAsync(`PRAGMA user_version = 1`);
  }

  if (current < 2) {
    // Schéma v2 : devis & factures (Module « Facturation »).
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL DEFAULT 'quote',
        number TEXT NOT NULL,
        client_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        currency TEXT NOT NULL DEFAULT 'EUR',
        issue_date INTEGER NOT NULL,
        due_date INTEGER,
        notes TEXT NOT NULL DEFAULT '',
        total_ht REAL NOT NULL DEFAULT 0,
        total_ttc REAL NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS invoice_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL,
        label TEXT NOT NULL,
        qty REAL NOT NULL DEFAULT 1,
        unit_price REAL NOT NULL DEFAULT 0,
        tva REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices (client_id);
      CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items (invoice_id);
    `);
    await database.execAsync(`PRAGMA user_version = 2`);
  }

  // Migration unique des anciens contacts AsyncStorage vers la table clients.
  await importLegacyContacts(database);
}

async function importLegacyContacts(database) {
  const { n } = await database.getFirstAsync('SELECT COUNT(*) AS n FROM clients');
  if (n > 0) return;

  let raw = null;
  try {
    raw = await AsyncStorage.getItem('crm_contacts');
  } catch (e) {
    return;
  }
  if (!raw) return;

  let contacts = [];
  try {
    contacts = JSON.parse(raw);
  } catch (e) {
    return;
  }

  const now = Date.now();
  for (const c of contacts) {
    if (!c || !c.phone) continue;
    try {
      await database.runAsync(
        `INSERT INTO clients (phone, name, wa_id, status, tags, notes, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        normalizePhone(c.phone),
        c.name || '',
        c.waId || null,
        c.status || 'prospect',
        JSON.stringify([]),
        c.notes || '',
        '',
        c.createdAt || now,
        now
      );
    } catch (e) {
      // Doublon éventuel : on ignore silencieusement.
    }
  }

  // Les contacts migrés ne sont plus nécessaires.
  try {
    await AsyncStorage.removeItem('crm_contacts');
  } catch (e) {
    /* ignore */
  }
}

export function formatTags(tags) {
  if (!Array.isArray(tags)) return '[]';
  return JSON.stringify(tags);
}

export function parseTags(tags) {
  try {
    const arr = JSON.parse(tags || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}
