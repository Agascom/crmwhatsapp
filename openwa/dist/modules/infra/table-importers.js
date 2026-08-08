"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TABLE_IMPORTERS = void 0;
const path_safety_1 = require("../../common/utils/path-safety");
function defineTableImporter(importer) {
    return importer;
}
exports.TABLE_IMPORTERS = [
    defineTableImporter({
        key: 'sessions',
        label: 'session',
        sql: `INSERT INTO sessions (id, name, status, phone, "pushName", config, "proxyUrl", "proxyType", "connectedAt", "lastActiveAt", "createdAt", "updatedAt") 
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        id: (session) => session.id,
        skip: (session) => {
            if ((0, path_safety_1.isSafeSessionName)(session.name))
                return null;
            return `Skipped session ${session.id}: unsafe name ${JSON.stringify(session.name)}`;
        },
        map: (session) => [
            session.id,
            session.name,
            session.status,
            session.phone,
            session.pushName,
            typeof session.config === 'string' ? session.config : JSON.stringify(session.config || {}),
            session.proxyUrl,
            session.proxyType,
            session.connectedAt,
            session.lastActiveAt,
            session.createdAt,
            session.updatedAt,
        ],
    }),
    defineTableImporter({
        key: 'webhooks',
        label: 'webhook',
        sql: `INSERT INTO webhooks (id, "sessionId", url, events, secret, headers, filters, active, "retryCount", "lastTriggeredAt", "createdAt", "updatedAt")
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        id: (webhook) => webhook.id,
        map: (webhook) => [
            webhook.id,
            webhook.sessionId,
            webhook.url,
            typeof webhook.events === 'string' ? webhook.events : JSON.stringify(webhook.events || []),
            webhook.secret,
            typeof webhook.headers === 'string' ? webhook.headers : JSON.stringify(webhook.headers || {}),
            webhook.filters == null
                ? null
                : typeof webhook.filters === 'string'
                    ? webhook.filters
                    : JSON.stringify(webhook.filters),
            webhook.active,
            webhook.retryCount,
            webhook.lastTriggeredAt,
            webhook.createdAt,
            webhook.updatedAt,
        ],
    }),
    defineTableImporter({
        key: 'messages',
        label: 'message',
        sql: `INSERT INTO messages (id, "sessionId", "waMessageId", "chatId", "chatName", author, "from", "to", body, type, direction, "timestamp", metadata, status, "createdAt", "mediaPath", "mediaMimetype")
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        id: (msg) => msg.id,
        map: (msg) => [
            msg.id,
            msg.sessionId,
            msg.waMessageId ?? null,
            msg.chatId,
            msg.chatName ?? null,
            msg.author ?? null,
            msg.from,
            msg.to,
            msg.body ?? null,
            msg.type,
            msg.direction,
            msg.timestamp ?? null,
            msg.metadata == null ? null : typeof msg.metadata === 'string' ? msg.metadata : JSON.stringify(msg.metadata),
            msg.status,
            msg.createdAt,
            msg.mediaPath ?? null,
            msg.mediaMimetype ?? null,
        ],
    }),
    defineTableImporter({
        key: 'messageBatches',
        label: 'message batch',
        sql: `INSERT INTO message_batches (id, batch_id, session_id, status, messages, options, progress, results, current_index, created_at, updated_at, started_at, completed_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        id: (batch) => batch.id,
        map: (batch) => [
            batch.id,
            batch.batch_id,
            batch.session_id,
            batch.status,
            typeof batch.messages === 'string' ? batch.messages : JSON.stringify(batch.messages ?? []),
            batch.options == null ? null : typeof batch.options === 'string' ? batch.options : JSON.stringify(batch.options),
            batch.progress == null
                ? null
                : typeof batch.progress === 'string'
                    ? batch.progress
                    : JSON.stringify(batch.progress),
            batch.results == null ? null : typeof batch.results === 'string' ? batch.results : JSON.stringify(batch.results),
            batch.current_index,
            batch.created_at,
            batch.updated_at,
            batch.started_at,
            batch.completed_at,
        ],
    }),
    defineTableImporter({
        key: 'templates',
        label: 'template',
        sql: `INSERT INTO templates (id, "sessionId", name, body, header, footer, "createdAt", "updatedAt")
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        id: (tpl) => tpl.id,
        map: (tpl) => [
            tpl.id,
            tpl.sessionId,
            tpl.name,
            tpl.body,
            tpl.header ?? null,
            tpl.footer ?? null,
            tpl.createdAt,
            tpl.updatedAt,
        ],
    }),
    defineTableImporter({
        key: 'baileysStoredMessages',
        label: 'baileys stored message',
        sql: `INSERT INTO baileys_stored_messages (id, "sessionId", "waMessageId", "serializedMessage", "createdAt")
               VALUES ($1, $2, $3, $4, $5)`,
        id: (bsm) => bsm.id,
        map: (bsm) => [
            bsm.id,
            bsm.sessionId,
            bsm.waMessageId,
            bsm.serializedMessage,
            bsm.createdAt,
        ],
    }),
    defineTableImporter({
        key: 'lidMappings',
        label: 'lid mapping',
        sql: `INSERT INTO lid_mappings (lid, phone, "sessionId", "updatedAt") VALUES ($1, $2, $3, $4)`,
        id: (lm) => lm.lid,
        map: (lm) => [lm.lid, lm.phone ?? null, lm.sessionId ?? null, lm.updatedAt],
    }),
    defineTableImporter({
        key: 'pluginInstances',
        label: 'plugin instance',
        sql: `INSERT INTO plugin_instances (id, "pluginId", "instanceId", "sessionScope", secret, "verifyToken", config, enabled, "createdAt", "updatedAt")
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        id: (pi) => pi.id,
        map: (pi) => [
            pi.id,
            pi.pluginId,
            pi.instanceId,
            pi.sessionScope,
            pi.secret,
            pi.verifyToken,
            pi.config == null ? null : typeof pi.config === 'string' ? pi.config : JSON.stringify(pi.config),
            pi.enabled,
            pi.createdAt,
            pi.updatedAt,
        ],
    }),
    defineTableImporter({
        key: 'conversationMappings',
        label: 'conversation mapping',
        sql: `INSERT INTO conversation_mappings (id, "sessionId", "chatId", "pluginId", "instanceId", "providerConversationId", "handoverState", metadata, "updatedAt")
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        id: (cm) => cm.id,
        map: (cm) => [
            cm.id,
            cm.sessionId,
            cm.chatId,
            cm.pluginId,
            cm.instanceId,
            cm.providerConversationId,
            cm.handoverState,
            cm.metadata == null ? null : typeof cm.metadata === 'string' ? cm.metadata : JSON.stringify(cm.metadata),
            cm.updatedAt,
        ],
    }),
    defineTableImporter({
        key: 'ingressEvents',
        label: 'ingress event',
        sql: `INSERT INTO ingress_events (id, "instanceId", "pluginId", "providerDeliveryId", route, payload, "payloadHash", "sessionId", "dispatchState", "dispatchAttempts", "lastDispatchAt", "createdAt")
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        id: (ie) => ie.id,
        map: (ie) => [
            ie.id,
            ie.instanceId,
            ie.pluginId,
            ie.providerDeliveryId,
            ie.route,
            ie.payload == null ? null : typeof ie.payload === 'string' ? ie.payload : JSON.stringify(ie.payload),
            ie.payloadHash ?? null,
            ie.sessionId,
            ie.dispatchState ?? null,
            ie.dispatchAttempts ?? 0,
            ie.lastDispatchAt ?? null,
            ie.createdAt,
        ],
    }),
    defineTableImporter({
        key: 'webhookDeliveryFailures',
        label: 'webhook delivery failure',
        sql: `INSERT INTO webhook_delivery_failures (id, "webhookId", "sessionId", event, url, "idempotencyKey", "deliveryId", attempts, "lastStatusCode", "lastError", "createdAt")
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        id: (wf) => wf.id,
        map: (wf) => [
            wf.id,
            wf.webhookId,
            wf.sessionId,
            wf.event,
            wf.url,
            wf.idempotencyKey,
            wf.deliveryId,
            wf.attempts,
            wf.lastStatusCode,
            wf.lastError,
            wf.createdAt,
        ],
    }),
    defineTableImporter({
        key: 'integrationDeliveryFailures',
        label: 'integration delivery failure',
        sql: `INSERT INTO integration_delivery_failures (id, direction, "pluginId", "instanceId", "sessionId", "deliveryId", attempts, "lastError", payload, redriven, "createdAt")
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        id: (df) => df.id,
        map: (df) => [
            df.id,
            df.direction,
            df.pluginId,
            df.instanceId,
            df.sessionId,
            df.deliveryId,
            df.attempts,
            df.lastError,
            df.payload == null ? null : typeof df.payload === 'string' ? df.payload : JSON.stringify(df.payload),
            df.redriven,
            df.createdAt,
        ],
    }),
    defineTableImporter({
        key: 'statusUpdates',
        label: 'status update',
        sql: `INSERT INTO status_updates (id, "sessionId", "contactJid", "contactName", "contactPushName", "waStatusId", type, caption, "mediaPath", "mediaMimetype", "mediaOmitted", "omitReason", "backgroundColor", font, "postedAt", "expiresAt")
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        id: (su) => su.id,
        map: (su) => [
            su.id,
            su.sessionId,
            su.contactJid,
            su.contactName ?? null,
            su.contactPushName ?? null,
            su.waStatusId,
            su.type,
            su.caption ?? null,
            su.mediaPath ?? null,
            su.mediaMimetype ?? null,
            su.mediaOmitted ?? false,
            su.omitReason ?? null,
            su.backgroundColor ?? null,
            su.font ?? null,
            su.postedAt,
            su.expiresAt,
        ],
    }),
    defineTableImporter({
        key: 'automationRules',
        label: 'automation rule',
        sql: `INSERT INTO automation_rules (id, "sessionId", name, enabled, conditions, "replyText", "cooldownSeconds", "createdAt", "updatedAt")
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        id: (rule) => rule.id,
        map: (rule) => [
            rule.id,
            rule.sessionId,
            rule.name,
            rule.enabled ?? true,
            rule.conditions ?? null,
            rule.replyText,
            rule.cooldownSeconds ?? 60,
            rule.createdAt,
            rule.updatedAt,
        ],
    }),
];
const EXPECTED_TABLE_KEYS = [
    'sessions',
    'webhooks',
    'messages',
    'messageBatches',
    'templates',
    'baileysStoredMessages',
    'lidMappings',
    'pluginInstances',
    'conversationMappings',
    'ingressEvents',
    'webhookDeliveryFailures',
    'integrationDeliveryFailures',
    'statusUpdates',
    'automationRules',
];
const importerKeys = exports.TABLE_IMPORTERS.map(importer => importer.key);
for (const key of EXPECTED_TABLE_KEYS) {
    if (!importerKeys.includes(key))
        throw new Error(`table-importers: missing descriptor for "${key}"`);
}
if (importerKeys.length !== EXPECTED_TABLE_KEYS.length) {
    throw new Error(`table-importers: expected ${EXPECTED_TABLE_KEYS.length} descriptors, found ${importerKeys.length}`);
}
//# sourceMappingURL=table-importers.js.map