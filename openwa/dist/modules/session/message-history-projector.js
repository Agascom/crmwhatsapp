"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.persistHistoryMessages = persistHistoryMessages;
const typeorm_1 = require("typeorm");
const message_entity_1 = require("../message/entities/message.entity");
const message_row_mapper_1 = require("./message-row.mapper");
const feature_flags_1 = require("../../config/feature-flags");
async function persistHistoryMessages(messageRepository, configService, id, messages, logger) {
    const storeEphemeralMessages = (0, feature_flags_1.resolveFeatureFlags)(configService).storeEphemeralMessages;
    const byId = new Map();
    for (const m of messages) {
        if (!m.id || m.isStatusBroadcast || !m.chatId || !m.from || !m.to) {
            continue;
        }
        if (!storeEphemeralMessages && (m.ephemeralDuration ?? 0) > 0) {
            continue;
        }
        byId.set(m.id, m);
    }
    if (byId.size === 0) {
        return;
    }
    const ids = [...byId.keys()];
    const CHUNK = 400;
    let inserted = 0;
    for (let i = 0; i < ids.length; i += CHUNK) {
        const chunkIds = ids.slice(i, i + CHUNK);
        const existing = await messageRepository.find({
            where: { sessionId: id, waMessageId: (0, typeorm_1.In)(chunkIds) },
            select: { waMessageId: true },
        });
        const seen = new Set(existing.map(r => r.waMessageId));
        const rows = chunkIds
            .filter(x => !seen.has(x))
            .map(x => {
            const m = byId.get(x);
            const metadata = (0, message_row_mapper_1.buildMessageMetadata)(m, true);
            const row = messageRepository.create({
                sessionId: id,
                waMessageId: m.id,
                chatId: m.chatId,
                author: m.fromMe ? undefined : m.author,
                from: m.from,
                to: m.to,
                body: m.body,
                type: m.type,
                direction: m.fromMe ? message_entity_1.MessageDirection.OUTGOING : message_entity_1.MessageDirection.INCOMING,
                timestamp: m.timestamp,
                status: message_entity_1.MessageStatus.SENT,
                metadata,
            });
            if (m.timestamp) {
                row.createdAt = new Date(m.timestamp * 1000);
            }
            return row;
        });
        if (rows.length) {
            await messageRepository
                .createQueryBuilder()
                .insert()
                .values(rows)
                .orIgnore()
                .execute();
            inserted += rows.length;
        }
    }
    if (inserted) {
        logger.log(`Persisted ${inserted} history message(s)`, {
            sessionId: id,
            inserted,
            action: 'history_messages_persisted',
        });
    }
}
//# sourceMappingURL=message-history-projector.js.map