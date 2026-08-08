import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { SessionService } from '../session/session.service';
import { EngineRegistry } from '../../engine/engine-registry.service';
import { MessageProjector } from '../session/message-projector.service';
import { SendTextMessageDto, SendMediaMessageDto, SendAudioMessageDto, MessageResponseDto } from './dto';
import { SendTemplateMessageDto } from './dto/send-template.dto';
import { Message, MessageStatus } from './entities/message.entity';
import { HookManager } from '../../core/hooks';
import { SendPacingService } from './send-pacing.service';
import { TemplateService } from '../template/template.service';
import { LidMappingStoreService } from '../../engine/identity/lid-mapping-store.service';
import { ChatMediaArchiveService } from '../chat-media/chat-media-archive.service';
import { StorageService } from '../../common/storage/storage.service';
export interface GetMessagesOptions {
    chatId?: string;
    from?: string;
    limit?: number;
    offset?: number;
}
export declare const DEFAULT_TEMPLATE_RENDER_MAX_CHARS: number;
export declare const DEFAULT_PIN_DURATION_SECONDS = 86400;
export declare class MessageService {
    private readonly messageRepository;
    private readonly sessionService;
    private readonly engines;
    private readonly messageProjector;
    private readonly hookManager;
    private readonly templateService;
    private readonly lidMappingStore;
    private readonly pacing;
    private readonly configService?;
    private readonly chatMediaArchive?;
    private readonly storageService?;
    private readonly logger;
    constructor(messageRepository: Repository<Message>, sessionService: SessionService, engines: EngineRegistry, messageProjector: MessageProjector, hookManager: HookManager, templateService: TemplateService, lidMappingStore: LidMappingStoreService, pacing: SendPacingService, configService?: ConfigService | undefined, chatMediaArchive?: ChatMediaArchiveService | undefined, storageService?: StorageService | undefined);
    sendText(sessionId: string, dto: SendTextMessageDto): Promise<MessageResponseDto>;
    private applySendingGate;
    private failSend;
    sendTemplate(sessionId: string, dto: SendTemplateMessageDto): Promise<MessageResponseDto>;
    sendImage(sessionId: string, dto: SendMediaMessageDto): Promise<MessageResponseDto>;
    sendVideo(sessionId: string, dto: SendMediaMessageDto): Promise<MessageResponseDto>;
    sendAudio(sessionId: string, dto: SendAudioMessageDto): Promise<MessageResponseDto>;
    sendDocument(sessionId: string, dto: SendMediaMessageDto): Promise<MessageResponseDto>;
    getMessages(sessionId: string, options?: GetMessagesOptions): Promise<{
        messages: Message[];
        total: number;
    }>;
    private resolveJidCandidates;
    sendLocation(sessionId: string, dto: {
        chatId: string;
        latitude: number;
        longitude: number;
        description?: string;
        address?: string;
    }): Promise<MessageResponseDto>;
    sendContact(sessionId: string, dto: {
        chatId: string;
        contactName: string;
        contactNumber: string;
    }): Promise<MessageResponseDto>;
    sendPoll(sessionId: string, dto: {
        chatId: string;
        name: string;
        options: string[];
        allowMultipleAnswers?: boolean;
    }): Promise<MessageResponseDto>;
    sendSticker(sessionId: string, dto: SendMediaMessageDto): Promise<MessageResponseDto>;
    reply(sessionId: string, dto: {
        chatId: string;
        quotedMessageId: string;
        text: string;
    }): Promise<MessageResponseDto>;
    forward(sessionId: string, dto: {
        fromChatId: string;
        toChatId: string;
        messageId: string;
    }): Promise<MessageResponseDto>;
    saveIncomingMessage(sessionId: string, data: Partial<Message>): Promise<Message>;
    saveOutgoingMessage(sessionId: string, data: {
        waMessageId?: string;
        chatId: string;
        body?: string;
        type: string;
        timestamp?: number;
        status?: MessageStatus;
        metadata?: Record<string, unknown>;
    }): Promise<Message>;
    private emitPersisted;
    private saveFailedMessage;
    private persistSentState;
    reactToMessage(sessionId: string, dto: {
        chatId: string;
        messageId: string;
        emoji: string;
    }): Promise<void>;
    getMessageReactions(sessionId: string, chatId: string, messageId: string): Promise<import("../../engine/interfaces/whatsapp-engine.interface").MessageReaction[]>;
    getChatMedia(sessionId: string, chatId: string, messageId: string): Promise<{
        buffer: Buffer;
        mimetype: string;
    }>;
    private static readonly MAX_CHAT_HISTORY_LIMIT;
    private static readonly MAX_DEEP_CHAT_HISTORY_LIMIT;
    getChatHistory(sessionId: string, chatId: string, limit?: number, includeMedia?: boolean, deep?: boolean, signal?: AbortSignal): Promise<import("../../engine/interfaces/whatsapp-engine.interface").IncomingMessage[]>;
    pinMessage(sessionId: string, dto: {
        chatId: string;
        messageId: string;
        durationSeconds?: number;
    }): Promise<{
        success: boolean;
    }>;
    unpinMessage(sessionId: string, dto: {
        chatId: string;
        messageId: string;
    }): Promise<{
        success: boolean;
    }>;
    starMessage(sessionId: string, dto: {
        chatId: string;
        messageId: string;
        star: boolean;
    }): Promise<{
        success: boolean;
    }>;
    votePoll(sessionId: string, dto: {
        chatId: string;
        pollMessageId: string;
        options: string[];
    }): Promise<{
        success: boolean;
    }>;
    deleteMessage(sessionId: string, dto: {
        chatId: string;
        messageId: string;
        forEveryone?: boolean;
    }): Promise<void>;
    editMessage(sessionId: string, dto: {
        chatId: string;
        messageId: string;
        body: string;
    }): Promise<MessageResponseDto>;
    private getEngine;
    private simulateTypingIfEnabled;
    private toClientFacingError;
    private buildMediaInput;
}
