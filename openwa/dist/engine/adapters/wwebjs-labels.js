"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WwebjsLabels = void 0;
const wa_id_1 = require("../identity/wa-id");
const chat_labels_unsupported_error_1 = require("../../common/errors/chat-labels-unsupported.error");
const label_not_found_error_1 = require("../../common/errors/label-not-found.error");
const engine_transport_error_1 = require("../../common/errors/engine-transport.error");
class WwebjsLabels {
    host;
    constructor(host) {
        this.host = host;
    }
    client() {
        return this.host.getClient();
    }
    async getLabels() {
        this.host.ensureReady();
        const labels = await this.client().getLabels();
        if (!labels) {
            return [];
        }
        return labels.map(label => ({
            id: String(label.id),
            name: String(label.name),
            hexColor: String(label.hexColor),
        }));
    }
    async getChatsByLabel(labelId) {
        this.host.ensureReady();
        let chats;
        try {
            chats = await this.client().getChatsByLabelId(labelId);
        }
        catch (error) {
            if (this.host.isPageTransportError(error)) {
                this.host.reportIfPageTransportError(error, 'getChatsByLabel');
                throw new engine_transport_error_1.EngineTransportError(`Transport died while listing chats for label ${labelId}`);
            }
            this.host.logger.debug('getChatsByLabelId rejected; treating the label as not found', {
                labelId,
                error: error instanceof Error ? error.message : String(error),
            });
            throw new label_not_found_error_1.LabelNotFoundError(labelId);
        }
        const summaries = [];
        for (const chat of chats ?? []) {
            const id = chat?.id?._serialized;
            if (!id)
                continue;
            summaries.push({
                id,
                name: chat.name || id,
                isGroup: Boolean(chat.isGroup),
                kind: (0, wa_id_1.chatKind)(id),
                unreadCount: chat.unreadCount || 0,
                timestamp: chat.timestamp || 0,
            });
        }
        return summaries;
    }
    async getLabelById(labelId) {
        this.host.ensureReady();
        const label = await this.client().getLabelById(labelId);
        if (!label) {
            return null;
        }
        return {
            id: String(label.id),
            name: String(label.name),
            hexColor: String(label.hexColor),
        };
    }
    async getChatLabels(chatId) {
        this.host.ensureReady();
        if ((0, wa_id_1.isChannelJid)(chatId)) {
            return [];
        }
        const chat = await this.client().getChatById(chatId);
        const labels = await chat.getLabels();
        if (!labels) {
            return [];
        }
        return labels.map(label => ({
            id: String(label.id),
            name: String(label.name),
            hexColor: String(label.hexColor),
        }));
    }
    async addLabelToChat(chatId, labelId) {
        this.host.ensureReady();
        await this.changeChatLabel(chatId, labelId, true);
    }
    async removeLabelFromChat(chatId, labelId) {
        this.host.ensureReady();
        await this.changeChatLabel(chatId, labelId, false);
    }
    async changeChatLabel(chatId, labelId, add) {
        if ((0, wa_id_1.isChannelJid)(chatId)) {
            throw new chat_labels_unsupported_error_1.ChatLabelsUnsupportedError('Channels do not support chat labels.');
        }
        const ids = new Set((await this.getChatLabels(chatId)).map(label => label.id));
        if (add) {
            ids.add(labelId);
        }
        else {
            ids.delete(labelId);
        }
        try {
            await this.client().addOrRemoveLabels([...ids], [chatId]);
        }
        catch (error) {
            if (String(error instanceof Error ? error.message : error).includes('LT01')) {
                throw new chat_labels_unsupported_error_1.ChatLabelsUnsupportedError();
            }
            throw error;
        }
        this.host.logger.log(`${add ? 'Added' : 'Removed'} label ${labelId} ${add ? 'to' : 'from'} chat ${chatId}`);
    }
}
exports.WwebjsLabels = WwebjsLabels;
//# sourceMappingURL=wwebjs-labels.js.map