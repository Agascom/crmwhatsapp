"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WwebjsChats = void 0;
const whatsapp_web_js_1 = require("whatsapp-web.js");
const wa_id_1 = require("../identity/wa-id");
class WwebjsChats {
    host;
    messaging;
    constructor(host, messaging) {
        this.host = host;
        this.messaging = messaging;
    }
    client() {
        return this.host.getClient();
    }
    async getChats() {
        this.host.ensureReady();
        const chats = await this.client().getChats();
        const summaries = [];
        let skipped = 0;
        for (const chat of chats) {
            const id = chat.id?._serialized;
            if (!id) {
                skipped++;
                continue;
            }
            summaries.push({
                id,
                name: chat.name || id,
                isGroup: Boolean(chat.isGroup),
                kind: (0, wa_id_1.chatKind)(id),
                unreadCount: chat.unreadCount || 0,
                timestamp: chat.timestamp || 0,
                lastMessage: chat.lastMessage?.type === whatsapp_web_js_1.MessageTypes.LOCATION ? '📍' : chat.lastMessage?.body || undefined,
            });
        }
        if (skipped > 0) {
            this.host.logger.warn(`Skipped ${skipped} chat(s) without a serialized id`);
        }
        return summaries;
    }
    async sendSeen(chatId) {
        this.host.ensureReady();
        try {
            const chat = await this.client().getChatById(chatId);
            return await chat.sendSeen();
        }
        catch (error) {
            this.host.logger.error(`Error marking chat ${chatId} as read`, String(error));
            return false;
        }
    }
    async clearChatMessages(chatId) {
        this.host.ensureReady();
        try {
            const chat = await this.client().getChatById(chatId);
            return await chat.clearMessages();
        }
        catch (error) {
            this.host.logger.error(`Error clearing messages in chat ${chatId}`, String(error));
            return false;
        }
    }
    async archiveChat(chatId, archive) {
        this.host.ensureReady();
        try {
            if (archive) {
                await this.client().archiveChat(chatId);
            }
            else {
                await this.client().unarchiveChat(chatId);
            }
            return true;
        }
        catch (error) {
            this.host.logger.error(`Error ${archive ? 'archiving' : 'unarchiving'} chat ${chatId}`, String(error));
            return false;
        }
    }
    async markUnread(chatId) {
        this.host.ensureReady();
        if ((0, wa_id_1.isChannelJid)(chatId)) {
            return false;
        }
        try {
            const chat = await this.client().getChatById(chatId);
            await chat.markUnread();
            return true;
        }
        catch (error) {
            this.host.logger.error(`Error marking chat ${chatId} as unread`, String(error));
            return false;
        }
    }
    async deleteChat(chatId) {
        this.host.ensureReady();
        if ((0, wa_id_1.isChannelJid)(chatId)) {
            return false;
        }
        try {
            const chat = await this.client().getChatById(chatId);
            return await chat.delete();
        }
        catch (error) {
            this.host.logger.error(`Error deleting chat ${chatId}`, String(error));
            return false;
        }
    }
    async sendChatState(chatId, state) {
        this.host.ensureReady();
        if ((0, wa_id_1.isChannelJid)(chatId)) {
            return;
        }
        try {
            const to = await this.messaging.resolveSendId(chatId);
            const chat = await this.client().getChatById(to);
            if (state === 'typing') {
                await chat.sendStateTyping();
            }
            else if (state === 'recording') {
                await chat.sendStateRecording();
            }
            else {
                await chat.clearState();
            }
        }
        catch (error) {
            this.host.logger.warn(`Could not set chat state '${state}' for ${chatId} (best-effort)`, {
                error: String(error),
            });
        }
    }
}
exports.WwebjsChats = WwebjsChats;
//# sourceMappingURL=wwebjs-chats.js.map