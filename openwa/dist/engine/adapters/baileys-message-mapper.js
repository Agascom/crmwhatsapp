"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapBaileysMessageType = mapBaileysMessageType;
exports.extractBaileysBody = extractBaileysBody;
exports.extractBaileysLocation = extractBaileysLocation;
exports.extractBaileysContext = extractBaileysContext;
exports.mapBaileysStatus = mapBaileysStatus;
exports.buildIncomingMessageFromBaileys = buildIncomingMessageFromBaileys;
const wa_id_1 = require("../identity/wa-id");
function mapBaileysMessageType(contentType, isPtt = false) {
    switch (contentType) {
        case 'conversation':
        case 'extendedTextMessage':
            return 'text';
        case 'imageMessage':
            return 'image';
        case 'videoMessage':
            return 'video';
        case 'audioMessage':
            return isPtt ? 'voice' : 'audio';
        case 'documentMessage':
        case 'documentWithCaptionMessage':
            return 'document';
        case 'stickerMessage':
            return 'sticker';
        case 'locationMessage':
        case 'liveLocationMessage':
            return 'location';
        case 'contactMessage':
        case 'contactsArrayMessage':
            return 'contact';
        case 'pollCreationMessage':
        case 'pollCreationMessageV2':
        case 'pollCreationMessageV3':
            return 'poll';
        case 'interactiveMessage':
        case 'buttonsMessage':
        case 'templateMessage':
        case 'interactiveResponseMessage':
            return 'text';
        case 'placeholderMessage':
            return 'masked';
        default:
            return 'unknown';
    }
}
function extractBaileysBody(content) {
    return (content.conversation ??
        content.extendedTextMessage?.text ??
        content.imageMessage?.caption ??
        content.videoMessage?.caption ??
        content.documentMessage?.caption ??
        content.interactiveMessage?.body?.text ??
        content.buttonsMessage?.contentText ??
        content.templateMessage?.hydratedTemplate?.hydratedContentText ??
        content.templateMessage?.hydratedFourRowTemplate?.hydratedContentText ??
        content.interactiveResponseMessage?.body?.text ??
        '');
}
function extractBaileysLocation(content, contentType) {
    if (contentType !== 'locationMessage' && contentType !== 'liveLocationMessage') {
        return undefined;
    }
    const lm = content.locationMessage ?? content.liveLocationMessage;
    if (!lm) {
        return undefined;
    }
    const staticLm = content.locationMessage;
    return {
        latitude: lm.degreesLatitude ?? 0,
        longitude: lm.degreesLongitude ?? 0,
        description: staticLm?.name ?? undefined,
        address: staticLm?.address ?? undefined,
    };
}
function extractBaileysContext(content) {
    const subForContext = content.extendedTextMessage ??
        content.imageMessage ??
        content.videoMessage ??
        content.audioMessage ??
        content.documentMessage ??
        content.stickerMessage ??
        content.locationMessage;
    const extText = content.extendedTextMessage;
    const contextInfo = subForContext?.contextInfo;
    const context = {
        ephemeralDuration: contextInfo?.expiration ?? undefined,
        mentionedJids: contextInfo?.mentionedJid ?? undefined,
        backgroundArgb: typeof extText?.backgroundArgb === 'number' ? extText.backgroundArgb : undefined,
        font: typeof extText?.font === 'number' ? extText.font : undefined,
    };
    if (contextInfo?.quotedMessage && contextInfo.stanzaId) {
        const qm = contextInfo.quotedMessage;
        const qBody = qm.conversation ??
            qm.extendedTextMessage?.text ??
            qm.imageMessage?.caption ??
            qm.videoMessage?.caption ??
            qm.documentMessage?.caption ??
            '';
        context.quotedMessage = { id: contextInfo.stanzaId, body: qBody };
    }
    return context;
}
function mapBaileysStatus(status) {
    switch (status) {
        case 0:
            return 'failed';
        case 1:
            return 'pending';
        case 2:
            return 'sent';
        case 3:
            return 'delivered';
        case 4:
            return 'read';
        case 5:
            return 'read';
        default:
            return null;
    }
}
function buildIncomingMessageFromBaileys(fields, normalizeJid = jid => jid) {
    const rawChatId = fields.remoteJid;
    const isGroup = rawChatId.endsWith('@g.us');
    const isStatusBroadcast = rawChatId === 'status@broadcast';
    const chatId = normalizeJid(rawChatId);
    const self = normalizeJid(fields.selfJid ?? '');
    const incoming = {
        id: fields.id,
        from: fields.fromMe ? self : chatId,
        to: fields.fromMe ? chatId : self,
        chatId,
        body: fields.body,
        type: mapBaileysMessageType(fields.contentType, fields.isPtt),
        timestamp: fields.timestamp,
        fromMe: fields.fromMe,
        isGroup,
        kind: (0, wa_id_1.chatKind)(chatId),
        isStatusBroadcast,
    };
    if ((isGroup || isStatusBroadcast) && fields.participant) {
        incoming.author = normalizeJid(fields.participant);
    }
    const senderJid = fields.participant ?? rawChatId;
    if (senderJid.endsWith('@lid')) {
        incoming.isLidSender = true;
    }
    if (fields.pushName) {
        incoming.contact = { pushName: fields.pushName };
    }
    if (fields.backgroundArgb !== undefined && Number.isFinite(fields.backgroundArgb)) {
        incoming.backgroundColor = `#${(fields.backgroundArgb & 0xffffff).toString(16).padStart(6, '0')}`;
    }
    if (fields.font !== undefined) {
        incoming.font = fields.font;
    }
    if (fields.media) {
        incoming.media = fields.media;
    }
    if (fields.location) {
        incoming.location = fields.location;
    }
    if (fields.quotedMessage) {
        incoming.quotedMessage = fields.quotedMessage;
    }
    if (fields.ephemeralDuration && fields.ephemeralDuration > 0) {
        incoming.ephemeralDuration = fields.ephemeralDuration;
    }
    if (fields.mentionedJids && fields.mentionedJids.length > 0) {
        incoming.mentionedIds = fields.mentionedJids.map(normalizeJid);
    }
    return incoming;
}
//# sourceMappingURL=baileys-message-mapper.js.map