"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaileysHistory = void 0;
exports.toUnixSeconds = toUnixSeconds;
const baileys_message_mapper_1 = require("./baileys-message-mapper");
const baileys_query_deadline_1 = require("./baileys-query-deadline");
function toUnixSeconds(ts) {
    if (ts == null) {
        return Math.floor(Date.now() / 1000);
    }
    return typeof ts === 'number' ? ts : ts.toNumber();
}
class BaileysHistory {
    host;
    constructor(host) {
        this.host = host;
    }
    sock() {
        return this.host.getSocket();
    }
    async captureHistoryMessages(messages) {
        if (!messages.length) {
            return;
        }
        const b = await this.host.loadLib();
        const nameUpdates = [];
        const mapped = [];
        for (const msg of messages) {
            if (msg.key?.fromMe !== true && msg.pushName) {
                const sender = msg.key?.participant ?? msg.key?.remoteJid;
                if (sender) {
                    nameUpdates.push({ id: sender, notify: msg.pushName });
                }
            }
            this.host.recordMessage(msg);
            const incoming = this.mapHistoryMessage(b, msg);
            if (incoming) {
                mapped.push(incoming);
            }
        }
        if (nameUpdates.length) {
            this.host.upsertContacts(nameUpdates);
        }
        if (mapped.length) {
            this.host.getOnHistoryMessages()?.(mapped);
        }
    }
    async hydrateNames() {
        try {
            const groups = await (0, baileys_query_deadline_1.withQueryDeadline)(this.sock().groupFetchAllParticipating(), baileys_query_deadline_1.BAILEYS_QUERY_BUDGET_MS, 'WhatsApp did not answer the group list query in time');
            const named = Object.values(groups)
                .filter(g => g?.id && g.subject)
                .map(g => ({ id: g.id, name: g.subject }));
            if (named.length) {
                this.host.upsertChats(named);
                this.host.logger.debug('Hydrated group names', { action: 'baileys_hydrate_groups', count: named.length });
            }
        }
        catch (err) {
            this.host.logger.warn('Group name hydration failed', { error: err instanceof Error ? err.message : String(err) });
        }
        try {
            const b = await this.host.loadLib();
            await this.sock().resyncAppState(b.ALL_WA_PATCH_NAMES, false);
            this.host.logger.debug('Re-synced app state for contact names', { action: 'baileys_resync_appstate' });
        }
        catch (err) {
            this.host.logger.warn('App-state resync for contact names failed', {
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
    mapHistoryMessage(b, msg) {
        const raw = msg.message;
        if (!raw || !msg.key?.remoteJid || !msg.key.id) {
            return null;
        }
        const content = b.normalizeMessageContent(raw) ?? raw;
        const contentType = b.getContentType(content);
        if (!contentType ||
            contentType === 'protocolMessage' ||
            contentType === 'reactionMessage' ||
            contentType === 'senderKeyDistributionMessage') {
            return null;
        }
        const body = (0, baileys_message_mapper_1.extractBaileysBody)(content);
        return (0, baileys_message_mapper_1.buildIncomingMessageFromBaileys)({
            id: msg.key.id,
            remoteJid: msg.key.remoteJid,
            fromMe: msg.key.fromMe === true,
            participant: msg.key.participant ?? undefined,
            body,
            contentType,
            isPtt: content.audioMessage?.ptt === true,
            timestamp: toUnixSeconds(msg.messageTimestamp),
            pushName: msg.pushName ?? undefined,
            selfJid: this.host.normalizedSelfJid(),
            ephemeralDuration: this.host.extractEphemeralDuration(msg),
        }, jid => this.host.toNeutralJid(jid));
    }
}
exports.BaileysHistory = BaileysHistory;
//# sourceMappingURL=baileys-history.js.map