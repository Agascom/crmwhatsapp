import type * as BaileysLib from '@whiskeysockets/baileys';
import type { WAMessage, WASocket } from '@whiskeysockets/baileys';
import { CustomLinkPreview, ChatState, ContactCard, EngineEventCallbacks, IncomingMessage, LocationInput, MediaInput, MessageResult, PollInput, Product } from '../interfaces/whatsapp-engine.interface';
import { type createLogger } from '../../common/services/logger.service';
export interface BaileysMessagingHost {
    ensureReady(): void;
    getSocket(): WASocket;
    readonly logger: ReturnType<typeof createLogger>;
    toNeutralJid(jid: string): string;
    toEngineJid(jid: string): string;
    normalizedSelfJid(): string;
    getEphemeralExpiration(chatId: string): number | undefined;
    toUnixSeconds(ts: number | {
        toNumber(): number;
    } | null | undefined): number;
    loadLib(): Promise<typeof BaileysLib>;
    putStoredMessage(msg: WAMessage): Promise<void> | undefined;
    getStoredMessage(messageId: string): Promise<WAMessage | null> | undefined;
    recordLidMapping(lid: string, pn: string): void;
    getOnMessageCreate(): EngineEventCallbacks['onMessageCreate'];
    mapMessage(msg: WAMessage, contentType: string | undefined, opts?: {
        skipMediaDownload?: boolean;
    }): Promise<IncomingMessage>;
}
export declare function resolveMediaBuffer(media: MediaInput): Promise<{
    data: Buffer;
    mimetype: string;
}>;
export declare class BaileysMessaging {
    private readonly host;
    private readonly queryBudgetMs;
    constructor(host: BaileysMessagingHost, queryBudgetMs?: number);
    private confirmed;
    private sock;
    sendTextMessage(chatId: string, text: string, mentions?: string[], sendOptions?: {
        linkPreview?: boolean;
        customPreview?: CustomLinkPreview;
    }): Promise<MessageResult>;
    checkNumberExists(number: string): Promise<boolean>;
    getNumberId(number: string): Promise<string | null>;
    sendChatState(chatId: string, state: ChatState): Promise<void>;
    subscribeToPresence(chatId: string): Promise<void>;
    sendProductMessage(chatId: string, product: Product, body?: string): Promise<MessageResult>;
    sendImageMessage(chatId: string, media: MediaInput): Promise<MessageResult>;
    sendVideoMessage(chatId: string, media: MediaInput): Promise<MessageResult>;
    sendAudioMessage(chatId: string, media: MediaInput): Promise<MessageResult>;
    sendDocumentMessage(chatId: string, media: MediaInput): Promise<MessageResult>;
    sendStickerMessage(chatId: string, media: MediaInput): Promise<MessageResult>;
    sendLocationMessage(chatId: string, location: LocationInput): Promise<MessageResult>;
    sendContactMessage(chatId: string, contact: ContactCard): Promise<MessageResult>;
    sendPollMessage(chatId: string, poll: PollInput): Promise<MessageResult>;
    replyToMessage(chatId: string, quotedMsgId: string, text: string): Promise<MessageResult>;
    forwardMessage(fromChatId: string, toChatId: string, messageId: string): Promise<MessageResult>;
    reactToMessage(chatId: string, messageId: string, emoji: string): Promise<void>;
    deleteMessage(chatId: string, messageId: string, forEveryone?: boolean): Promise<void>;
    editMessage(chatId: string, messageId: string, body: string): Promise<MessageResult>;
    private withMentions;
    private toDeliverableJid;
    private withEphemeral;
    private sendContent;
    private emitOwnSendEcho;
    private requireStored;
    private assertStoredInChat;
    starMessage(chatId: string, messageId: string, star: boolean): Promise<void>;
    pinMessage(chatId: string, messageId: string, durationSeconds: number): Promise<void>;
    unpinMessage(chatId: string, messageId: string): Promise<void>;
}
