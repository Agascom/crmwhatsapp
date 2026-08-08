import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Repository } from 'typeorm';
import { ApiKey, ApiKeyRole } from './entities/api-key.entity';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto';
import { ApiKeyUsageTracker } from './api-key-usage-tracker.service';
export declare function resolveSeedApiKey(): string;
export declare function bannerKeyLine(displayKey: string, isNewKey: boolean): string;
export declare class AuthService implements OnModuleInit, OnModuleDestroy {
    private readonly apiKeyRepository;
    private readonly usageTracker;
    private readonly moduleRef;
    private readonly logger;
    private readonly adminCapabilityLock;
    private static readonly ADMIN_CAPABILITY_LOCK_KEY;
    constructor(apiKeyRepository: Repository<ApiKey>, usageTracker: ApiKeyUsageTracker, moduleRef: ModuleRef);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    private readLiveBootstrapKey;
    private removeBootstrapKeyFileIfMatching;
    private seedApiKey;
    createApiKey(dto: CreateApiKeyDto): Promise<{
        apiKey: ApiKey;
        rawKey: string;
    }>;
    findAll(): Promise<ApiKey[]>;
    findOne(id: string): Promise<ApiKey>;
    update(id: string, dto: UpdateApiKeyDto): Promise<ApiKey>;
    delete(id: string): Promise<void>;
    revoke(id: string): Promise<ApiKey>;
    private static isUsableAdmin;
    private assertNotLastUsableAdmin;
    private evictActiveSockets;
    validateApiKey(rawKey: string, clientIp?: string, sessionId?: string): Promise<ApiKey>;
    private hashKey;
    private isIpAllowed;
    hasPermission(apiKey: ApiKey, requiredRole: ApiKeyRole): boolean;
}
