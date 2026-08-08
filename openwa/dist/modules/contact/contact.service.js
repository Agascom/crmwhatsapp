"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ContactService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactService = void 0;
const common_1 = require("@nestjs/common");
const engine_registry_service_1 = require("../../engine/engine-registry.service");
const paginate_1 = require("../../common/utils/paginate");
const wa_id_1 = require("../../engine/identity/wa-id");
let ContactService = class ContactService {
    static { ContactService_1 = this; }
    engines;
    constructor(engines) {
        this.engines = engines;
    }
    getEngine(sessionId) {
        return this.engines.require(sessionId);
    }
    getContacts(sessionId, opts = {}) {
        return this.getEngine(sessionId)
            .getContacts()
            .then(contacts => (0, paginate_1.paginate)(contacts, opts.limit, opts.offset));
    }
    async getContactById(sessionId, contactId) {
        const contact = await this.getEngine(sessionId).getContactById(contactId);
        if (!contact) {
            throw new common_1.NotFoundException(`Contact ${contactId} not found`);
        }
        return contact;
    }
    checkNumberExists(sessionId, number) {
        return this.getEngine(sessionId).checkNumberExists(number);
    }
    getNumberId(sessionId, number) {
        return this.getEngine(sessionId).getNumberId(number);
    }
    resolveContactPhone(sessionId, contactId) {
        return this.getEngine(sessionId).resolveContactPhone(contactId);
    }
    getProfilePicture(sessionId, contactId) {
        return this.getEngine(sessionId).getProfilePicture(contactId);
    }
    static PROFILE_PICTURES_MAX_IDS = 50;
    static PROFILE_PICTURE_LOOKUP_TIMEOUT_MS = 8000;
    async getProfilePictures(sessionId, ids) {
        const engine = this.getEngine(sessionId);
        const capped = ids.slice(0, ContactService_1.PROFILE_PICTURES_MAX_IDS);
        const pictures = {};
        const CHUNK = 5;
        for (let i = 0; i < capped.length; i += CHUNK) {
            const chunk = capped.slice(i, i + CHUNK);
            const results = await Promise.all(chunk.map((id) => {
                return new Promise(resolve => {
                    const timer = setTimeout(() => resolve([id, null]), ContactService_1.PROFILE_PICTURE_LOOKUP_TIMEOUT_MS);
                    engine.getProfilePicture(id).then(url => {
                        clearTimeout(timer);
                        resolve([id, url]);
                    }, () => {
                        clearTimeout(timer);
                        resolve([id, null]);
                    });
                });
            }));
            for (const [id, url] of results) {
                pictures[id] = url;
            }
        }
        return pictures;
    }
    blockContact(sessionId, contactId) {
        return this.getEngine(sessionId).blockContact(contactId);
    }
    assertAddressable(contactId) {
        const kind = (0, wa_id_1.parseWaId)(contactId).kind;
        if (kind === 'user' || this.isBareNumber(contactId))
            return;
        if (kind === 'lid') {
            throw new common_1.BadRequestException(`Contact ${contactId} is a privacy id (@lid) with no known phone number; the addressbook is keyed by phone number, so pass a phone-based contact id instead`);
        }
        throw new common_1.BadRequestException(`Contact ${contactId} does not name a person; the addressbook is keyed by phone number, so pass a phone-based contact id instead`);
    }
    isBareNumber(contactId) {
        return (0, wa_id_1.parseWaId)(contactId).kind === 'unknown' && /^\d{5,}$/.test(contactId.trim());
    }
    toAddressableId(contactId) {
        return this.isBareNumber(contactId) ? `${contactId.trim()}@c.us` : contactId;
    }
    upsertContact(sessionId, contactId, firstName, lastName) {
        this.assertAddressable(contactId);
        return this.getEngine(sessionId).upsertContact(this.toAddressableId(contactId), firstName, lastName);
    }
    deleteContact(sessionId, contactId) {
        this.assertAddressable(contactId);
        return this.getEngine(sessionId).deleteContact(this.toAddressableId(contactId));
    }
    unblockContact(sessionId, contactId) {
        return this.getEngine(sessionId).unblockContact(contactId);
    }
};
exports.ContactService = ContactService;
exports.ContactService = ContactService = ContactService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [engine_registry_service_1.EngineRegistry])
], ContactService);
//# sourceMappingURL=contact.service.js.map