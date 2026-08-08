import { EngineRegistry } from '../../engine/engine-registry.service';
import { ListOptions } from '../../common/utils/paginate';
export declare class ContactService {
    private readonly engines;
    constructor(engines: EngineRegistry);
    private getEngine;
    getContacts(sessionId: string, opts?: ListOptions): Promise<import("../../engine/interfaces/whatsapp-engine.interface").Contact[]>;
    getContactById(sessionId: string, contactId: string): Promise<import("../../engine/interfaces/whatsapp-engine.interface").Contact>;
    checkNumberExists(sessionId: string, number: string): Promise<boolean>;
    getNumberId(sessionId: string, number: string): Promise<string | null>;
    resolveContactPhone(sessionId: string, contactId: string): Promise<string | null>;
    getProfilePicture(sessionId: string, contactId: string): Promise<string | null>;
    private static readonly PROFILE_PICTURES_MAX_IDS;
    private static readonly PROFILE_PICTURE_LOOKUP_TIMEOUT_MS;
    getProfilePictures(sessionId: string, ids: string[]): Promise<Record<string, string | null>>;
    blockContact(sessionId: string, contactId: string): Promise<void>;
    private assertAddressable;
    private isBareNumber;
    private toAddressableId;
    upsertContact(sessionId: string, contactId: string, firstName: string, lastName?: string): Promise<void>;
    deleteContact(sessionId: string, contactId: string): Promise<void>;
    unblockContact(sessionId: string, contactId: string): Promise<void>;
}
