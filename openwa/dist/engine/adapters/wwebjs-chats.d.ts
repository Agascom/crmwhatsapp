import { ChatSummary, ChatState } from '../interfaces/whatsapp-engine.interface';
import { WwebjsMessaging } from './wwebjs-messaging';
import { type WwebjsEngineHost } from './wwebjs-host';
export declare class WwebjsChats {
    private readonly host;
    private readonly messaging;
    constructor(host: WwebjsEngineHost, messaging: WwebjsMessaging);
    private client;
    getChats(): Promise<ChatSummary[]>;
    sendSeen(chatId: string): Promise<boolean>;
    clearChatMessages(chatId: string): Promise<boolean>;
    archiveChat(chatId: string, archive: boolean): Promise<boolean>;
    markUnread(chatId: string): Promise<boolean>;
    deleteChat(chatId: string): Promise<boolean>;
    sendChatState(chatId: string, state: ChatState): Promise<void>;
}
