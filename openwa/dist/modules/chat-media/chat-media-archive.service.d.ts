import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Message } from '../message/entities/message.entity';
import { StorageService } from '../../common/storage/storage.service';
export declare const CHAT_MEDIA_PREFIX = "chat-media/";
export declare const DEFAULT_ARCHIVE_MAX_BYTES: number;
export declare class ChatMediaArchiveService implements OnModuleInit, OnModuleDestroy {
    private readonly repository;
    private readonly storageService;
    private readonly configService;
    private readonly logger;
    private purgeTimer?;
    private orphanSweepTimer?;
    private readonly orphanFirstSeenAt;
    constructor(repository: Repository<Message>, storageService: StorageService, configService: ConfigService);
    get enabled(): boolean;
    onModuleInit(): void;
    onModuleDestroy(): void;
    archive(row: Pick<Message, 'id' | 'sessionId' | 'metadata'>): Promise<string | null>;
    getMedia(sessionId: string, chatId: string, waMessageId: string): Promise<{
        path: string;
        mimetype: string;
    } | null>;
    purgeExpired(now: number): Promise<number>;
    sweepOrphanedMedia(now?: number): Promise<number>;
}
