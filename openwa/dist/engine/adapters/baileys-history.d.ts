import type * as BaileysLib from '@whiskeysockets/baileys';
import type { Chat, Contact as BaileysContact, WAMessage, WASocket } from '@whiskeysockets/baileys';
import { EngineEventCallbacks } from '../interfaces/whatsapp-engine.interface';
import { type createLogger } from '../../common/services/logger.service';
export interface BaileysHistoryHost {
    getSocket(): WASocket;
    readonly logger: ReturnType<typeof createLogger>;
    toNeutralJid(jid: string): string;
    normalizedSelfJid(): string;
    loadLib(): Promise<typeof BaileysLib>;
    recordMessage(msg: WAMessage): void;
    upsertContacts(records: Partial<BaileysContact>[]): void;
    upsertChats(records: Partial<Chat>[]): void;
    extractEphemeralDuration(msg: WAMessage): number | undefined;
    getOnHistoryMessages(): EngineEventCallbacks['onHistoryMessages'];
}
export declare function toUnixSeconds(ts: number | {
    toNumber(): number;
} | null | undefined): number;
export declare class BaileysHistory {
    private readonly host;
    constructor(host: BaileysHistoryHost);
    private sock;
    captureHistoryMessages(messages: WAMessage[]): Promise<void>;
    hydrateNames(): Promise<void>;
    private mapHistoryMessage;
}
