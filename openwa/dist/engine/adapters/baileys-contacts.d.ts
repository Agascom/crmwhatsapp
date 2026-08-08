import type { WAMessageKey, WASocket } from '@whiskeysockets/baileys';
import { ChatSummary, Contact, MediaInput } from '../interfaces/whatsapp-engine.interface';
import { type createLogger } from '../../common/services/logger.service';
export interface BaileysContactsHost {
    ensureReady(): void;
    getSocket(): WASocket;
    readonly logger: ReturnType<typeof createLogger>;
    normalizedSelfJid(): string;
    listContacts(): Contact[];
    findContact(contactId: string): Contact | null;
    resolvePhone(contactId: string): string | null;
    listChats(): ChatSummary[];
    lastMessage(chatId: string): {
        key: WAMessageKey;
        timestamp: number;
    } | null;
    toEngineJid(jid: string): string;
}
export declare class BaileysContacts {
    private readonly host;
    private readonly queryBudgetMs;
    constructor(host: BaileysContactsHost, queryBudgetMs?: number);
    private confirmed;
    private sock;
    getProfilePicture(contactId: string): Promise<string | null>;
    upsertContact(contactId: string, firstName: string, lastName?: string): Promise<void>;
    deleteContact(contactId: string): Promise<void>;
    blockContact(contactId: string): Promise<void>;
    unblockContact(contactId: string): Promise<void>;
    setProfileName(name: string): Promise<void>;
    setProfileStatus(status: string): Promise<void>;
    setProfilePicture(media: MediaInput): Promise<void>;
    getContacts(): Promise<Contact[]>;
    getContactById(contactId: string): Promise<Contact | null>;
    resolveContactPhone(contactId: string): Promise<string | null>;
    getChats(): Promise<ChatSummary[]>;
    sendSeen(chatId: string): Promise<boolean>;
    markUnread(chatId: string): Promise<boolean>;
    clearChatMessages(chatId: string): Promise<boolean>;
    archiveChat(chatId: string, archive: boolean): Promise<boolean>;
    deleteChat(chatId: string): Promise<boolean>;
}
