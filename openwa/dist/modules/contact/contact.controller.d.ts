import { ContactService } from './contact.service';
import { UpsertContactDto } from './dto/upsert-contact.dto';
export declare class ContactController {
    private readonly contactService;
    constructor(contactService: ContactService);
    findAll(sessionId: string, limit?: string, offset?: string): Promise<import("../../engine/interfaces/whatsapp-engine.interface").Contact[]>;
    getProfilePictures(sessionId: string, ids?: string): Promise<{
        pictures: Record<string, string | null>;
    }>;
    findOne(sessionId: string, contactId: string): Promise<import("../../engine/interfaces/whatsapp-engine.interface").Contact>;
    checkNumber(sessionId: string, number: string): Promise<{
        number: string;
        exists: boolean;
        whatsappId: string | null;
    }>;
    getProfilePicture(sessionId: string, contactId: string): Promise<{
        url: string | null;
    }>;
    resolvePhone(sessionId: string, contactId: string): Promise<{
        contactId: string;
        phone: string | null;
    }>;
    upsertContact(sessionId: string, contactId: string, dto: UpsertContactDto): Promise<{
        success: boolean;
        message: string;
    }>;
    deleteContact(sessionId: string, contactId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    blockContact(sessionId: string, contactId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    unblockContact(sessionId: string, contactId: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
