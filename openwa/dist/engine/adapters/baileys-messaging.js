"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaileysMessaging = void 0;
exports.resolveMediaBuffer = resolveMediaBuffer;
const safe_link_preview_1 = require("./safe-link-preview");
const baileys_groups_1 = require("./baileys-groups");
const vcard_1 = require("./vcard");
const load_remote_media_1 = require("../../common/media/load-remote-media");
const common_1 = require("@nestjs/common");
const engine_refused_error_1 = require("../../common/errors/engine-refused.error");
const message_not_found_error_1 = require("../../common/errors/message-not-found.error");
const engine_transport_error_1 = require("../../common/errors/engine-transport.error");
const baileys_query_deadline_1 = require("./baileys-query-deadline");
async function resolveMediaBuffer(media) {
    if (Buffer.isBuffer(media.data)) {
        return { data: media.data, mimetype: media.mimetype };
    }
    if (/^https?:\/\//i.test(media.data)) {
        const fetched = await (0, load_remote_media_1.loadRemoteMediaBuffer)(media.data);
        const callerMimetype = media.mimetype && media.mimetype !== 'application/octet-stream' ? media.mimetype : null;
        return { data: fetched.data, mimetype: callerMimetype ?? fetched.mimetype };
    }
    return { data: Buffer.from(media.data, 'base64'), mimetype: media.mimetype };
}
class BaileysMessaging {
    host;
    queryBudgetMs;
    constructor(host, queryBudgetMs = baileys_query_deadline_1.BAILEYS_QUERY_BUDGET_MS) {
        this.host = host;
        this.queryBudgetMs = queryBudgetMs;
    }
    confirmed(work, operation) {
        return (0, baileys_query_deadline_1.withQueryDeadline)(work, this.queryBudgetMs, `WhatsApp did not confirm ${operation} in time`);
    }
    sock() {
        return this.host.getSocket();
    }
    async sendTextMessage(chatId, text, mentions, sendOptions) {
        this.host.ensureReady();
        const jid = await this.toDeliverableJid(chatId);
        const options = {
            ...(this.withEphemeral(jid) ?? {}),
            getUrlInfo: (text) => (0, safe_link_preview_1.generateSafeLinkPreview)(text),
        };
        const content = {
            text,
            ...this.withMentions(mentions),
            ...(sendOptions?.linkPreview === true ? {} : { linkPreview: null }),
            ...(sendOptions?.customPreview
                ? {
                    linkPreview: {
                        'matched-text': sendOptions.customPreview.url,
                        'canonical-url': sendOptions.customPreview.url,
                        title: sendOptions.customPreview.title,
                        ...(sendOptions.customPreview.description ? { description: sendOptions.customPreview.description } : {}),
                    },
                }
                : {}),
        };
        const sent = await this.sock().sendMessage(jid, content, options);
        if (sent) {
            void this.host.putStoredMessage(sent)?.catch(err => this.host.logger.warn('Failed to persist sent message to store', {
                error: err instanceof Error ? err.message : String(err),
            }));
            void this.emitOwnSendEcho(sent);
        }
        return {
            id: sent?.key?.id ?? '',
            timestamp: this.host.toUnixSeconds(sent?.messageTimestamp),
        };
    }
    async checkNumberExists(number) {
        return (await this.getNumberId(number)) !== null;
    }
    async getNumberId(number) {
        this.host.ensureReady();
        const results = await this.sock().onWhatsApp(number);
        if (results === undefined) {
            throw new engine_transport_error_1.EngineTransportError('WhatsApp did not answer the number-check query');
        }
        const hit = results[0];
        return hit?.exists ? this.host.toNeutralJid(hit.jid) : null;
    }
    async sendChatState(chatId, state) {
        this.host.ensureReady();
        const presence = state === 'typing' ? 'composing' : state === 'recording' ? 'recording' : 'paused';
        try {
            await this.sock().sendPresenceUpdate(presence, await this.toDeliverableJid(chatId));
        }
        catch (error) {
            this.host.logger.warn(`Could not set chat state '${state}' for ${chatId} (best-effort)`, {
                error: String(error),
            });
        }
    }
    async subscribeToPresence(chatId) {
        this.host.ensureReady();
        await this.sock().presenceSubscribe(await this.toDeliverableJid(chatId));
    }
    async sendProductMessage(chatId, product, body) {
        this.host.ensureReady();
        if (!product.imageUrl) {
            throw new common_1.BadRequestException(`Product ${product.id} has no image — a product card requires one`);
        }
        const content = {
            product: {
                productId: product.id,
                title: product.name,
                description: product.description,
                currencyCode: product.currency,
                priceAmount1000: Math.round(product.price * 1000),
                retailerId: product.retailerId,
                url: product.url || undefined,
                productImage: { url: product.imageUrl },
            },
            businessOwnerJid: this.host.toEngineJid(this.host.normalizedSelfJid()),
            body,
        };
        return this.sendContent(chatId, content);
    }
    async sendImageMessage(chatId, media) {
        this.host.ensureReady();
        const { data, mimetype } = await resolveMediaBuffer(media);
        return this.sendContent(chatId, {
            image: data,
            caption: media.caption,
            mimetype,
            ...this.withMentions(media.mentions),
        });
    }
    async sendVideoMessage(chatId, media) {
        this.host.ensureReady();
        const { data, mimetype } = await resolveMediaBuffer(media);
        return this.sendContent(chatId, {
            video: data,
            caption: media.caption,
            mimetype,
            ...this.withMentions(media.mentions),
        });
    }
    async sendAudioMessage(chatId, media) {
        this.host.ensureReady();
        const { data, mimetype } = await resolveMediaBuffer(media);
        return this.sendContent(chatId, { audio: data, mimetype, ptt: media.ptt ?? false });
    }
    async sendDocumentMessage(chatId, media) {
        this.host.ensureReady();
        const { data, mimetype } = await resolveMediaBuffer(media);
        return this.sendContent(chatId, {
            document: data,
            mimetype,
            fileName: media.filename ?? 'file',
            caption: media.caption,
            ...this.withMentions(media.mentions),
        });
    }
    async sendStickerMessage(chatId, media) {
        this.host.ensureReady();
        const { data } = await resolveMediaBuffer(media);
        return this.sendContent(chatId, { sticker: data });
    }
    async sendLocationMessage(chatId, location) {
        this.host.ensureReady();
        return this.sendContent(chatId, {
            location: {
                degreesLatitude: location.latitude,
                degreesLongitude: location.longitude,
                name: location.description,
                address: location.address,
            },
        });
    }
    async sendContactMessage(chatId, contact) {
        this.host.ensureReady();
        return this.sendContent(chatId, {
            contacts: { displayName: contact.name, contacts: [{ vcard: (0, vcard_1.buildVCard)(contact) }] },
        });
    }
    async sendPollMessage(chatId, poll) {
        this.host.ensureReady();
        return this.sendContent(chatId, {
            poll: {
                name: poll.name,
                values: poll.options,
                selectableCount: poll.allowMultipleAnswers ? 0 : 1,
            },
        });
    }
    async replyToMessage(chatId, quotedMsgId, text) {
        this.host.ensureReady();
        const quoted = await this.requireStored(quotedMsgId);
        return this.sendContent(chatId, { text }, { quoted });
    }
    async forwardMessage(fromChatId, toChatId, messageId) {
        this.host.ensureReady();
        const forward = await this.requireStored(messageId);
        return this.sendContent(toChatId, { forward });
    }
    async reactToMessage(chatId, messageId, emoji) {
        this.host.ensureReady();
        const target = await this.requireStored(messageId);
        this.assertStoredInChat(target, chatId, messageId);
        await this.sock().sendMessage(await this.toDeliverableJid(chatId), { react: { text: emoji, key: target.key } });
    }
    async deleteMessage(chatId, messageId, forEveryone = true) {
        this.host.ensureReady();
        const target = await this.requireStored(messageId);
        this.assertStoredInChat(target, chatId, messageId);
        if (forEveryone) {
            await this.sock().sendMessage(await this.toDeliverableJid(chatId), { delete: target.key });
            return;
        }
        await this.confirmed(this.sock().chatModify({
            deleteForMe: {
                deleteMedia: true,
                key: target.key,
                timestamp: this.host.toUnixSeconds(target.messageTimestamp),
            },
        }, this.host.toEngineJid(chatId)), 'the delete-for-me');
    }
    async editMessage(chatId, messageId, body) {
        this.host.ensureReady();
        const target = await this.requireStored(messageId);
        if (target.key.fromMe !== true) {
            throw new engine_refused_error_1.EngineRefusedError(`the edit of message ${messageId} was rejected — only the account's own messages can be edited`);
        }
        this.assertStoredInChat(target, chatId, messageId);
        const jid = await this.toDeliverableJid(chatId);
        const sent = await this.sock().sendMessage(jid, { text: body, edit: target.key });
        return { id: sent?.key?.id ?? messageId, timestamp: this.host.toUnixSeconds(sent?.messageTimestamp) };
    }
    withMentions(mentions) {
        return mentions?.length ? { mentions: (0, baileys_groups_1.toEngineParticipants)(mentions, jid => this.host.toEngineJid(jid)) } : {};
    }
    async toDeliverableJid(chatId) {
        if (!chatId.endsWith('@c.us') && !chatId.endsWith('@s.whatsapp.net')) {
            return chatId;
        }
        try {
            const pn = this.host.toEngineJid(chatId);
            const lid = await this.sock().signalRepository?.lidMapping?.getLIDForPN(pn);
            if (lid)
                this.host.recordLidMapping(lid, pn);
            return lid ?? chatId;
        }
        catch {
            return chatId;
        }
    }
    withEphemeral(chatId, options) {
        const ephemeralExpiration = this.host.getEphemeralExpiration(chatId);
        if (ephemeralExpiration === undefined) {
            return options;
        }
        return { ...options, ephemeralExpiration };
    }
    async sendContent(chatId, content, options) {
        const jid = await this.toDeliverableJid(chatId);
        const merged = this.withEphemeral(jid, options);
        const sent = merged
            ? await this.sock().sendMessage(jid, content, merged)
            : await this.sock().sendMessage(jid, content);
        if (sent) {
            void this.host.putStoredMessage(sent)?.catch(err => this.host.logger.warn('Failed to persist sent message to store', {
                error: err instanceof Error ? err.message : String(err),
            }));
            void this.emitOwnSendEcho(sent);
        }
        return { id: sent?.key?.id ?? '', timestamp: this.host.toUnixSeconds(sent?.messageTimestamp) };
    }
    async emitOwnSendEcho(sent) {
        const onMessageCreate = this.host.getOnMessageCreate();
        if (!onMessageCreate)
            return;
        try {
            const b = await this.host.loadLib();
            if (!sent.message || !sent.key?.remoteJid)
                return;
            const normalizedRoot = b.normalizeMessageContent(sent.message) ?? sent.message;
            const contentType = b.getContentType(normalizedRoot);
            if (!contentType || contentType === 'protocolMessage' || contentType === 'reactionMessage')
                return;
            const neutral = await this.host.mapMessage(sent, contentType, { skipMediaDownload: true });
            onMessageCreate(neutral);
        }
        catch (err) {
            this.host.logger.warn('Failed to emit own-send echo', {
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
    async requireStored(messageId) {
        const found = await this.host.getStoredMessage(messageId);
        if (!found?.key) {
            throw new message_not_found_error_1.MessageNotFoundError(messageId);
        }
        return found;
    }
    assertStoredInChat(target, chatId, messageId) {
        if (this.host.toNeutralJid(target.key.remoteJid ?? '') !== this.host.toNeutralJid(chatId)) {
            throw new message_not_found_error_1.MessageNotFoundError(messageId, chatId);
        }
    }
    async starMessage(chatId, messageId, star) {
        this.host.ensureReady();
        const target = await this.requireStored(messageId);
        this.assertStoredInChat(target, chatId, messageId);
        await this.confirmed(this.sock().chatModify({ star: { messages: [{ id: target.key.id, fromMe: target.key.fromMe ?? false }], star } }, this.host.toEngineJid(chatId)), 'the star change');
    }
    async pinMessage(chatId, messageId, durationSeconds) {
        this.host.ensureReady();
        const target = await this.requireStored(messageId);
        this.assertStoredInChat(target, chatId, messageId);
        const { proto } = await this.host.loadLib();
        await this.sock().sendMessage(await this.toDeliverableJid(chatId), {
            pin: target.key,
            type: proto.PinInChat.Type.PIN_FOR_ALL,
            time: durationSeconds,
        });
    }
    async unpinMessage(chatId, messageId) {
        this.host.ensureReady();
        const target = await this.requireStored(messageId);
        this.assertStoredInChat(target, chatId, messageId);
        const { proto } = await this.host.loadLib();
        await this.sock().sendMessage(await this.toDeliverableJid(chatId), {
            pin: target.key,
            type: proto.PinInChat.Type.UNPIN_FOR_ALL,
        });
    }
}
exports.BaileysMessaging = BaileysMessaging;
//# sourceMappingURL=baileys-messaging.js.map