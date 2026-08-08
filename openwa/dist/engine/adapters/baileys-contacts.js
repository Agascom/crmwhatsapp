"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaileysContacts = void 0;
const baileys_messaging_1 = require("./baileys-messaging");
const baileys_query_deadline_1 = require("./baileys-query-deadline");
const engine_transport_error_1 = require("../../common/errors/engine-transport.error");
class BaileysContacts {
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
    async getProfilePicture(contactId) {
        this.host.ensureReady();
        try {
            const url = await (0, baileys_query_deadline_1.withQueryDeadline)(this.sock().profilePictureUrl(contactId, 'image'), this.queryBudgetMs, 'WhatsApp did not answer the profile picture lookup in time');
            return url ?? null;
        }
        catch (err) {
            if (err instanceof engine_transport_error_1.EngineTransportError) {
                throw err;
            }
            this.host.logger.debug('profilePictureUrl failed; no picture or hidden', {
                contactId,
                error: err instanceof Error ? err.message : String(err),
            });
            return null;
        }
    }
    async upsertContact(contactId, firstName, lastName = '') {
        this.host.ensureReady();
        const fullName = [firstName, lastName].filter(Boolean).join(' ');
        await this.confirmed(this.sock().addOrEditContact(this.host.toEngineJid(contactId), {
            firstName,
            fullName,
            saveOnPrimaryAddressbook: false,
        }), 'the contact save');
    }
    async deleteContact(contactId) {
        this.host.ensureReady();
        await this.confirmed(this.sock().removeContact(this.host.toEngineJid(contactId)), 'the contact removal');
    }
    async blockContact(contactId) {
        this.host.ensureReady();
        await this.confirmed(this.sock().updateBlockStatus(contactId, 'block'), 'the block');
    }
    async unblockContact(contactId) {
        this.host.ensureReady();
        await this.confirmed(this.sock().updateBlockStatus(contactId, 'unblock'), 'the unblock');
    }
    async setProfileName(name) {
        this.host.ensureReady();
        await this.confirmed(this.sock().updateProfileName(name), 'the profile name change');
    }
    async setProfileStatus(status) {
        this.host.ensureReady();
        await this.confirmed(this.sock().updateProfileStatus(status), 'the profile status change');
    }
    async setProfilePicture(media) {
        this.host.ensureReady();
        const selfJid = this.host.normalizedSelfJid();
        if (!selfJid) {
            throw new Error('cannot set the profile picture: the own JID is not known yet');
        }
        const { data } = await (0, baileys_messaging_1.resolveMediaBuffer)(media);
        await this.confirmed(this.sock().updateProfilePicture(selfJid, data), 'the profile picture change');
    }
    async getContacts() {
        this.host.ensureReady();
        return this.host.listContacts();
    }
    async getContactById(contactId) {
        this.host.ensureReady();
        return this.host.findContact(contactId);
    }
    async resolveContactPhone(contactId) {
        this.host.ensureReady();
        return this.host.resolvePhone(contactId);
    }
    async getChats() {
        this.host.ensureReady();
        return this.host.listChats();
    }
    async sendSeen(chatId) {
        this.host.ensureReady();
        const last = this.host.lastMessage(chatId);
        if (!last) {
            return false;
        }
        await this.confirmed(this.sock().readMessages([last.key]), 'the read receipt');
        return true;
    }
    async markUnread(chatId) {
        this.host.ensureReady();
        const last = this.host.lastMessage(chatId);
        if (!last) {
            return false;
        }
        await this.confirmed(this.sock().chatModify({ markRead: false, lastMessages: [{ key: last.key, messageTimestamp: last.timestamp }] }, this.host.toEngineJid(chatId)), 'the unread mark');
        return true;
    }
    async clearChatMessages(chatId) {
        this.host.ensureReady();
        const last = this.host.lastMessage(chatId);
        if (!last) {
            return false;
        }
        await this.confirmed(this.sock().chatModify({ clear: true, lastMessages: [{ key: last.key, messageTimestamp: last.timestamp }] }, this.host.toEngineJid(chatId)), 'the chat clear');
        return true;
    }
    async archiveChat(chatId, archive) {
        this.host.ensureReady();
        const last = this.host.lastMessage(chatId);
        if (!last) {
            return false;
        }
        await this.confirmed(this.sock().chatModify({ archive, lastMessages: [{ key: last.key, messageTimestamp: last.timestamp }] }, this.host.toEngineJid(chatId)), 'the archive change');
        return true;
    }
    async deleteChat(chatId) {
        this.host.ensureReady();
        const last = this.host.lastMessage(chatId);
        if (!last) {
            return false;
        }
        await this.confirmed(this.sock().chatModify({ delete: true, lastMessages: [{ key: last.key, messageTimestamp: last.timestamp }] }, this.host.toEngineJid(chatId)), 'the chat delete');
        return true;
    }
}
exports.BaileysContacts = BaileysContacts;
//# sourceMappingURL=baileys-contacts.js.map