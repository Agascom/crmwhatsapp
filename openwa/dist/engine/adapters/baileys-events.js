"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaileysEvents = void 0;
const baileys_message_mapper_1 = require("./baileys-message-mapper");
const message_mapper_1 = require("./message-mapper");
const baileys_history_1 = require("./baileys-history");
const engine_not_ready_error_1 = require("../../common/errors/engine-not-ready.error");
const call_not_found_error_1 = require("../../common/errors/call-not-found.error");
const inbound_media_cap_1 = require("./inbound-media-cap");
const baileys_logger_1 = require("./baileys-logger");
const baileys_query_deadline_1 = require("./baileys-query-deadline");
const CALL_OUTCOMES = {
    accept: 'accepted',
    reject: 'rejected',
    timeout: 'missed',
};
const PRESENCE_STATES = new Set([
    'available',
    'unavailable',
    'composing',
    'recording',
    'paused',
]);
class BaileysEvents {
    host;
    static LIVE_CALL_TTL_MS = 2 * 60_000;
    liveCalls = new Map();
    constructor(host) {
        this.host = host;
    }
    handleMessagesUpsert(event) {
        for (const msg of event.messages) {
            if (!msg.message || !msg.key?.remoteJid) {
                continue;
            }
            if (event.type !== 'notify') {
                if (msg.key.fromMe === true) {
                    continue;
                }
                if ((0, baileys_history_1.toUnixSeconds)(msg.messageTimestamp) < this.host.connectedAt) {
                    continue;
                }
            }
            void this.host.inboundLimiter
                .run(() => this.processInboundMessage(msg))
                .catch(() => {
                this.host.logger.warn('Inbound media limiter saturated; emitting message without media', {
                    msgId: msg.key?.id ?? 'unknown',
                });
                return this.processInboundMessage(msg, { skipMedia: true });
            });
        }
    }
    logContactEvent(event, records = []) {
        const list = records ?? [];
        this.host.logger.debug('Baileys contacts event', {
            action: 'baileys_contacts',
            event,
            count: list.length,
            withName: list.filter(r => r.name || r.notify || r.verifiedName).length,
            withLid: list.filter(r => r.lid).length,
            sample: list.slice(0, 3).map(r => ({ id: r.id, name: r.name, notify: r.notify, lid: r.lid, jid: r.jid })),
        });
    }
    async processInboundMessage(msg, opts) {
        try {
            const b = await this.host.loadLib();
            const remoteJid = msg.key.remoteJid;
            this.host.recordKeyLidMappings(msg.key);
            const normalizedRoot = b.normalizeMessageContent(msg.message ?? undefined) ?? msg.message ?? undefined;
            const contentType = b.getContentType(normalizedRoot);
            if (contentType === 'protocolMessage') {
                const pm = msg.message?.protocolMessage;
                if (pm?.type === b.proto.Message.ProtocolMessage.Type.REVOKE) {
                    const from = msg.key.fromMe === true ? this.host.normalizedSelfJid() : remoteJid;
                    const to = msg.key.fromMe === true ? remoteJid : this.host.normalizedSelfJid();
                    const revoked = {
                        id: pm.key?.id ?? '',
                        revokedId: pm.key?.id ?? undefined,
                        chatId: this.host.toNeutralJid(remoteJid),
                        from: this.host.toNeutralJid(from),
                        to: this.host.toNeutralJid(to),
                        type: 'revoked',
                        body: '',
                        timestamp: (0, baileys_history_1.toUnixSeconds)(msg.messageTimestamp),
                    };
                    this.host.getOnMessageRevoked()?.(revoked);
                    return;
                }
                if (pm?.type === b.proto.Message.ProtocolMessage.Type.MESSAGE_EDIT) {
                    const normalizedEdited = b.normalizeMessageContent(pm.editedMessage ?? undefined) ?? pm.editedMessage ?? {};
                    const editedContentType = b.getContentType(normalizedEdited);
                    const editedSubMessage = normalizedEdited.extendedTextMessage ??
                        normalizedEdited.imageMessage ??
                        normalizedEdited.videoMessage ??
                        normalizedEdited.audioMessage ??
                        normalizedEdited.documentMessage ??
                        normalizedEdited.stickerMessage ??
                        normalizedEdited.locationMessage;
                    const contextInfo = editedSubMessage?.contextInfo;
                    const base = (0, baileys_message_mapper_1.buildIncomingMessageFromBaileys)({
                        id: pm.key?.id ?? '',
                        remoteJid,
                        fromMe: msg.key.fromMe === true,
                        participant: msg.key.participant ?? undefined,
                        body: (0, baileys_message_mapper_1.extractBaileysBody)(normalizedEdited),
                        contentType: editedContentType,
                        isPtt: normalizedEdited.audioMessage?.ptt === true,
                        timestamp: this.toEditUnixSeconds(pm.timestampMs, msg.messageTimestamp),
                        selfJid: this.host.normalizedSelfJid(),
                        mentionedJids: contextInfo?.mentionedJid ?? undefined,
                    }, jid => this.host.toNeutralJid(jid));
                    const hasMedia = editedContentType === 'imageMessage' ||
                        editedContentType === 'videoMessage' ||
                        editedContentType === 'audioMessage' ||
                        editedContentType === 'documentMessage' ||
                        editedContentType === 'documentWithCaptionMessage' ||
                        editedContentType === 'stickerMessage';
                    const edited = (0, message_mapper_1.buildEditedMessage)(base, hasMedia);
                    this.host.recordMessageEdit(remoteJid, edited.messageId, edited.body);
                    this.host.getOnMessageEdited()?.(edited);
                    return;
                }
                return;
            }
            if (contentType === 'reactionMessage') {
                const rm = msg.message?.reactionMessage;
                const event = {
                    messageId: rm?.key?.id ?? '',
                    chatId: this.host.toNeutralJid(remoteJid),
                    reaction: rm?.text ?? '',
                    senderId: this.host.toNeutralJid(msg.key.participant ?? remoteJid),
                };
                this.host.getOnMessageReaction()?.(event);
                return;
            }
            const incoming = await this.mapMessage(msg, contentType, { skipMediaDownload: opts?.skipMedia });
            if (msg.key.fromMe === true) {
                this.host.getOnMessageCreate()?.(incoming);
            }
            else {
                this.host.getOnMessage()?.(incoming);
            }
            void this.host.putStoredMessage(msg)?.catch(err => this.host.logger.warn('Failed to persist message to store', {
                error: err instanceof Error ? err.message : String(err),
            }));
            this.host.recordMessage(msg);
        }
        catch (err) {
            this.host.logger.error(`Unhandled error processing inbound message (id=${msg.key?.id ?? 'unknown'}); dropping`, err instanceof Error ? err.message : String(err));
        }
    }
    handleMessagesUpdate(updates) {
        for (const u of updates) {
            const status = (0, baileys_message_mapper_1.mapBaileysStatus)(u.update?.status);
            if (status && u.key?.id) {
                this.host.getOnMessageAck()?.(u.key.id, status);
            }
        }
    }
    handleGroupParticipantsUpdate(event) {
        const kind = event.action === 'add' ? 'join' : event.action === 'remove' ? 'leave' : undefined;
        if (!kind || !event.id) {
            return;
        }
        const participantIds = (Array.isArray(event.participants) ? event.participants : [])
            .map(entry => this.toNeutralGroupParticipantId(entry))
            .filter((jid) => jid !== null);
        const payload = {
            kind,
            groupId: this.host.toNeutralJid(event.id),
            participantIds,
            timestamp: Math.floor(Date.now() / 1000),
        };
        const actor = event.authorPn ?? event.author;
        if (actor) {
            payload.actorId = this.host.toNeutralJid(actor);
        }
        this.host.getOnGroupEvent()?.(payload);
    }
    handleGroupsUpdate(updates) {
        for (const update of Array.isArray(updates) ? updates : []) {
            if (!update?.id) {
                continue;
            }
            if ('participants' in update || 'creation' in update || 'subjectTime' in update || 'owner' in update) {
                continue;
            }
            const changes = {};
            if (typeof update.subject === 'string')
                changes.subject = update.subject;
            if (typeof update.desc === 'string')
                changes.description = update.desc;
            if (typeof update.announce === 'boolean')
                changes.announce = update.announce;
            if (typeof update.restrict === 'boolean')
                changes.locked = update.restrict;
            const payload = {
                kind: 'update',
                groupId: this.host.toNeutralJid(update.id),
                participantIds: [],
                changes,
                timestamp: Math.floor(Date.now() / 1000),
            };
            const actor = update.authorPn ?? update.author;
            if (actor) {
                payload.actorId = this.host.toNeutralJid(actor);
            }
            this.host.getOnGroupEvent()?.(payload);
        }
    }
    handleCallEvents(calls) {
        for (const call of Array.isArray(calls) ? calls : []) {
            if (!call || !call.id || !call.from) {
                continue;
            }
            if (call.status !== 'offer') {
                this.reportCallOutcome(call);
                continue;
            }
            if (call.offline) {
                continue;
            }
            const selfJid = this.host.normalizedSelfJid();
            if (selfJid) {
                const self = this.host.toNeutralJid(selfJid);
                if (this.host.toNeutralJid(call.from) === self || this.host.toNeutralJid(call.chatId) === self) {
                    continue;
                }
            }
            const published = {
                from: this.host.toNeutralJid(call.callerPn ?? call.from),
                isVideo: call.isVideo === true,
                isGroup: call.isGroup === true,
            };
            if (!this.cacheLiveCall(call.id, call.from, published)) {
                continue;
            }
            const payload = {
                callId: call.id,
                from: this.host.toNeutralJid(call.callerPn ?? call.from),
                isVideo: call.isVideo === true,
                isGroup: call.isGroup === true,
                timestamp: call.date instanceof Date && !Number.isNaN(call.date.getTime())
                    ? Math.floor(call.date.getTime() / 1000)
                    : Math.floor(Date.now() / 1000),
            };
            this.host.getOnCall()?.(payload);
        }
    }
    reportCallOutcome(call) {
        if (call.status === 'terminate') {
            this.liveCalls.delete(call.id);
            return;
        }
        const outcome = CALL_OUTCOMES[call.status];
        if (!outcome)
            return;
        const live = this.liveCalls.get(call.id);
        this.liveCalls.delete(call.id);
        if (call.offline)
            return;
        if (!live)
            return;
        this.host.getOnCallOutcome()?.({
            callId: call.id,
            from: this.host.toNeutralJid(call.callerPn ?? call.from),
            outcome,
            isVideo: call.isVideo === true,
            isGroup: call.isGroup === true,
            timestamp: call.date instanceof Date && !Number.isNaN(call.date.getTime())
                ? Math.floor(call.date.getTime() / 1000)
                : Math.floor(Date.now() / 1000),
        });
    }
    handlePresenceUpdate(update) {
        const report = this.host.getOnPresenceUpdate();
        if (!report || !update?.id || !update.presences)
            return;
        const participants = [];
        for (const [participant, data] of Object.entries(update.presences)) {
            const state = data?.lastKnownPresence;
            if (!state || !PRESENCE_STATES.has(state))
                continue;
            participants.push({
                id: this.host.toNeutralJid(participant),
                state,
                ...(typeof data.lastSeen === 'number' && Number.isFinite(data.lastSeen) ? { lastSeen: data.lastSeen } : {}),
            });
        }
        if (participants.length === 0)
            return;
        const groupOnlineCount = Object.values(update.presences).find(p => typeof p?.groupOnlineCount === 'number')?.groupOnlineCount;
        this.host.getOnPresenceUpdate()?.({
            chatId: this.host.toNeutralJid(update.id),
            participants,
            ...(typeof groupOnlineCount === 'number' ? { groupOnlineCount } : {}),
        });
    }
    cacheLiveCall(callId, callFrom, published) {
        const now = Date.now();
        for (const [id, entry] of this.liveCalls) {
            if (entry.expiresAt <= now) {
                this.liveCalls.delete(id);
            }
        }
        const isNewCall = !this.liveCalls.has(callId);
        this.liveCalls.set(callId, { callFrom, expiresAt: now + BaileysEvents.LIVE_CALL_TTL_MS, ...published });
        return isNewCall;
    }
    async rejectCall(callId) {
        const entry = this.liveCalls.get(callId);
        this.liveCalls.delete(callId);
        if (!entry || entry.expiresAt <= Date.now()) {
            throw new call_not_found_error_1.CallNotFoundError(callId);
        }
        const sock = this.host.getSocketOrNull();
        if (!sock) {
            throw new engine_not_ready_error_1.EngineNotReadyError('Cannot reject a call before the engine is initialized.');
        }
        await (0, baileys_query_deadline_1.withQueryDeadline)(sock.rejectCall(callId, entry.callFrom), baileys_query_deadline_1.BAILEYS_QUERY_BUDGET_MS, 'WhatsApp did not confirm the call rejection in time');
        this.host.getOnCallOutcome()?.({
            callId,
            from: entry.from,
            outcome: 'rejected',
            isVideo: entry.isVideo,
            isGroup: entry.isGroup,
            timestamp: Math.floor(Date.now() / 1000),
        });
    }
    toNeutralGroupParticipantId(entry) {
        if (typeof entry === 'string') {
            return entry ? this.host.toNeutralJid(entry) : null;
        }
        if (entry && typeof entry === 'object') {
            const e = entry;
            const jid = [e.phoneNumber, e.id, e.lid].find((v) => typeof v === 'string' && v.length > 0);
            return jid ? this.host.toNeutralJid(jid) : null;
        }
        return null;
    }
    async downloadInboundMediaCapped(msg, maxBytes) {
        let stream;
        const download = (async () => {
            const b = await this.host.loadLib();
            stream = (await b.downloadMediaMessage(msg, 'stream', {}, {
                logger: (0, baileys_logger_1.createSilentLogger)(),
                reuploadRequest: this.host.getSocket().updateMediaMessage,
            }));
            const chunks = [];
            let total = 0;
            for await (const chunk of stream) {
                total += chunk.length;
                if (total > maxBytes) {
                    stream.destroy?.();
                    return null;
                }
                chunks.push(chunk);
            }
            return Buffer.concat(chunks);
        })();
        return (0, inbound_media_cap_1.withInboundDownloadTimeout)(download, (0, inbound_media_cap_1.inboundMediaTimeoutMs)(), () => stream?.destroy?.());
    }
    async resolveInboundMedia(msg, contentType, content, b, skipMediaDownload) {
        const isMediaType = contentType === 'imageMessage' ||
            contentType === 'videoMessage' ||
            contentType === 'audioMessage' ||
            contentType === 'documentMessage' ||
            contentType === 'documentWithCaptionMessage' ||
            contentType === 'stickerMessage';
        if (!isMediaType) {
            return undefined;
        }
        if (skipMediaDownload || !(0, inbound_media_cap_1.isMediaDownloadEnabled)()) {
            const normalizedContent = b.normalizeMessageContent(content) ?? content;
            const subMessage = normalizedContent.imageMessage ??
                normalizedContent.videoMessage ??
                normalizedContent.audioMessage ??
                normalizedContent.documentMessage ??
                normalizedContent.stickerMessage;
            return {
                mimetype: subMessage?.mimetype ?? '',
                filename: normalizedContent.documentMessage?.fileName ?? undefined,
                omitted: true,
                sizeBytes: (0, inbound_media_cap_1.coerceDeclaredSize)(subMessage?.fileLength),
            };
        }
        const normalizedContent = b.normalizeMessageContent(content) ?? content;
        const subMessage = normalizedContent.imageMessage ??
            normalizedContent.videoMessage ??
            normalizedContent.audioMessage ??
            normalizedContent.documentMessage ??
            normalizedContent.stickerMessage;
        const mimetype = subMessage?.mimetype ?? '';
        const filename = normalizedContent.documentMessage?.fileName ?? undefined;
        const maxBytes = (0, inbound_media_cap_1.inboundMediaMaxBytes)();
        const declared = (0, inbound_media_cap_1.coerceDeclaredSize)(subMessage?.fileLength);
        if (declared > maxBytes) {
            this.host.logger.warn('Inbound media declared size exceeds MEDIA_DOWNLOAD_MAX_BYTES; skipped download', {
                msgId: msg.key.id,
                sizeBytes: declared,
            });
            return { mimetype, filename, omitted: true, sizeBytes: declared };
        }
        try {
            const buf = await this.downloadInboundMediaCapped(msg, maxBytes);
            if (buf === null) {
                this.host.logger.warn('Inbound media download aborted (over MEDIA_DOWNLOAD_MAX_BYTES or past MEDIA_DOWNLOAD_TIMEOUT_MS); emitting omitted marker', { msgId: msg.key.id });
                return { mimetype, filename, omitted: true, sizeBytes: maxBytes };
            }
            return (0, inbound_media_cap_1.capInboundMedia)({
                mimetype,
                filename,
                sizeBytes: buf.byteLength,
                toBase64: () => buf.toString('base64'),
            });
        }
        catch (err) {
            this.host.logger.debug('Failed to download inbound media; emitting message without media', {
                error: err instanceof Error ? err.message : String(err),
                msgId: msg.key.id,
            });
            return undefined;
        }
    }
    async mapMessage(msg, contentType, opts) {
        const b = await this.host.loadLib();
        const content = msg.message ?? {};
        const normalized = b.normalizeMessageContent(content) ?? content;
        const body = (0, baileys_message_mapper_1.extractBaileysBody)(normalized);
        const location = (0, baileys_message_mapper_1.extractBaileysLocation)(normalized, contentType);
        const media = await this.resolveInboundMedia(msg, contentType, content, b, opts?.skipMediaDownload === true);
        const context = (0, baileys_message_mapper_1.extractBaileysContext)(normalized);
        return (0, baileys_message_mapper_1.buildIncomingMessageFromBaileys)({
            id: msg.key.id ?? '',
            remoteJid: msg.key.remoteJid,
            fromMe: msg.key.fromMe === true,
            participant: msg.key.participant ?? undefined,
            body,
            contentType,
            isPtt: normalized.audioMessage?.ptt === true,
            timestamp: (0, baileys_history_1.toUnixSeconds)(msg.messageTimestamp),
            pushName: msg.pushName ?? undefined,
            selfJid: this.host.normalizedSelfJid(),
            media,
            location,
            quotedMessage: context.quotedMessage,
            ephemeralDuration: context.ephemeralDuration,
            mentionedJids: context.mentionedJids,
            backgroundArgb: context.backgroundArgb,
            font: context.font,
        }, jid => this.host.toNeutralJid(jid));
    }
    toEditUnixSeconds(timestampMs, fallback) {
        if (timestampMs == null)
            return (0, baileys_history_1.toUnixSeconds)(fallback);
        const milliseconds = typeof timestampMs === 'number' ? timestampMs : timestampMs.toNumber();
        return Number.isFinite(milliseconds) ? Math.floor(milliseconds / 1000) : (0, baileys_history_1.toUnixSeconds)(fallback);
    }
}
exports.BaileysEvents = BaileysEvents;
//# sourceMappingURL=baileys-events.js.map