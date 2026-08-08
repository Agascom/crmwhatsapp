import type { Chat, Contact as BaileysContact, WAMessage, WAMessageKey } from '@whiskeysockets/baileys';
import { ChatSummary, Contact } from '../interfaces/whatsapp-engine.interface';
import type { LidMappingStore } from '../identity/lid-mapping-store.service';
export declare const SESSION_STORE_MAP_CAP_DEFAULT = 5000;
export declare class BaileysSessionStore {
    private readonly lidStore?;
    private readonly sessionId?;
    private readonly contacts;
    private readonly chats;
    private readonly lastMessages;
    private readonly lidToPn;
    private readonly ephemeralByChat;
    constructor(lidStore?: LidMappingStore | undefined, sessionId?: string | undefined);
    upsertContacts(records?: Partial<BaileysContact>[]): void;
    upsertChats(records?: Partial<Chat>[]): void;
    addLidMappings(mappings?: {
        lid?: string;
        pn?: string;
    }[]): void;
    recordKeyLidMappings(key: Pick<WAMessageKey, 'remoteJid' | 'remoteJidAlt' | 'participant' | 'participantAlt'>): void;
    private lidPnPair;
    private persistLidMapping;
    recordMessage(msg: WAMessage): void;
    recordMessageEdit(chatId: string, messageId: string, text: string): void;
    private recordEphemeralFromMessage;
    extractEphemeralDuration(msg: WAMessage): number | undefined;
    private contextExpiration;
    listContacts(): Contact[];
    findContact(id: string): Contact | null;
    listChats(): ChatSummary[];
    lastMessage(chatId: string): {
        key: WAMessageKey;
        timestamp: number;
    } | null;
    getEphemeralExpiration(chatId: string): number | undefined;
    resolvePhone(id: string): string | null;
    toNeutralJid(jid: string): string;
    toEngineJid(jid: string): string;
    private toNeutralContact;
    private toNeutralChat;
    private resolveContactName;
    private contactDisplayName;
    private toUnixSeconds;
}
