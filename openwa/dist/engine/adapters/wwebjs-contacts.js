"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WwebjsContacts = void 0;
const engine_transport_error_1 = require("../../common/errors/engine-transport.error");
const wa_id_1 = require("../identity/wa-id");
const whatsapp_web_js_types_1 = require("../types/whatsapp-web-js.types");
class WwebjsContacts {
    host;
    constructor(host) {
        this.host = host;
    }
    client() {
        return this.host.getClient();
    }
    async getContacts() {
        this.host.ensureReady();
        try {
            const contacts = await this.client().getContacts();
            return contacts.map(c => ({
                id: c.id._serialized,
                name: c.name || undefined,
                pushName: c.pushname || undefined,
                number: c.number,
                isMyContact: c.isMyContact,
                isBlocked: c.isBlocked,
            }));
        }
        catch (error) {
            this.host.reportIfPageTransportError(error, 'getContacts');
            throw error;
        }
    }
    async getContactById(contactId) {
        this.host.ensureReady();
        try {
            const contact = await this.client().getContactById(contactId);
            return {
                id: contact.id._serialized,
                name: contact.name || undefined,
                pushName: contact.pushname || undefined,
                number: contact.number,
                isMyContact: contact.isMyContact,
                isBlocked: contact.isBlocked,
            };
        }
        catch (error) {
            this.host.logger.warn(`Failed to get contact: ${contactId}`, { error: String(error) });
            return null;
        }
    }
    async getNumberId(number) {
        this.host.ensureReady();
        try {
            const numberId = await this.client().getNumberId(number);
            return (0, whatsapp_web_js_types_1.readWid)(numberId) ?? null;
        }
        catch (error) {
            this.host.reportIfPageTransportError(error, 'getNumberId');
            throw error;
        }
    }
    async checkNumberExists(number) {
        return (await this.getNumberId(number)) !== null;
    }
    async resolveContactPhone(contactId) {
        this.host.ensureReady();
        try {
            const [result] = await this.client().getContactLidAndPhone([contactId]);
            const pn = result?.pn;
            return pn ? pn.replace(/@c\.us$/i, '').replace(/\D/g, '') || null : null;
        }
        catch (error) {
            this.host.logger.debug(`resolveContactPhone failed for ${contactId}`, {
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }
    async upsertContact(contactId, firstName, lastName = '') {
        this.host.ensureReady();
        await this.client().saveOrEditAddressbookContact((0, wa_id_1.userPart)(contactId), firstName, lastName);
        this.host.logger.log(`Saved addressbook contact ${contactId}`);
    }
    async deleteContact(contactId) {
        this.host.ensureReady();
        await this.client().deleteAddressbookContact((0, wa_id_1.userPart)(contactId));
        this.host.logger.log(`Deleted addressbook contact ${contactId}`);
    }
    async blockContact(contactId) {
        this.host.ensureReady();
        const contact = await this.client().getContactById(contactId);
        await contact.block();
        this.host.logger.log(`Blocked contact ${contactId}`);
    }
    async unblockContact(contactId) {
        this.host.ensureReady();
        const contact = await this.client().getContactById(contactId);
        await contact.unblock();
        this.host.logger.log(`Unblocked contact ${contactId}`);
    }
    async getProfilePicture(contactId) {
        this.host.ensureReady();
        try {
            const url = await this.client().getProfilePicUrl(contactId);
            return url || null;
        }
        catch (error) {
            if (this.host.isPageTransportError(error)) {
                this.host.reportIfPageTransportError(error, 'getProfilePicture');
                throw new engine_transport_error_1.EngineTransportError(`Transport died while reading profile picture for ${contactId}`);
            }
            this.host.logger.warn(`Failed to get profile picture for ${contactId}: ${String(error)}`);
            return null;
        }
    }
}
exports.WwebjsContacts = WwebjsContacts;
//# sourceMappingURL=wwebjs-contacts.js.map