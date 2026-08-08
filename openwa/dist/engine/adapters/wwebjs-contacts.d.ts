import { Contact } from '../interfaces/whatsapp-engine.interface';
import { type WwebjsEngineHost } from './wwebjs-host';
export declare class WwebjsContacts {
    private readonly host;
    constructor(host: WwebjsEngineHost);
    private client;
    getContacts(): Promise<Contact[]>;
    getContactById(contactId: string): Promise<Contact | null>;
    getNumberId(number: string): Promise<string | null>;
    checkNumberExists(number: string): Promise<boolean>;
    resolveContactPhone(contactId: string): Promise<string | null>;
    upsertContact(contactId: string, firstName: string, lastName?: string): Promise<void>;
    deleteContact(contactId: string): Promise<void>;
    blockContact(contactId: string): Promise<void>;
    unblockContact(contactId: string): Promise<void>;
    getProfilePicture(contactId: string): Promise<string | null>;
}
