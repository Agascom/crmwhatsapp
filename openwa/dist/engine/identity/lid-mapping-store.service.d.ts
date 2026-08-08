import { OnModuleInit } from '@nestjs/common';
import { Repository } from 'typeorm';
import { LidMapping } from './lid-mapping.entity';
export declare const LID_MAPPING_CACHE_DEFAULT = 5000;
export interface LidMappingStore {
    getCached(lid: string): string | null | undefined;
    lidsForPhone(phone: string): string[];
    remember(lid: string, phone: string | null, sessionId?: string): Promise<void>;
}
export declare class LidMappingStoreService implements LidMappingStore, OnModuleInit {
    private readonly repo;
    private readonly logger;
    private readonly lidToPhone;
    private readonly phoneToLids;
    private readonly pendingLookups;
    private readonly maxCachedLids;
    constructor(repo: Repository<LidMapping>);
    onModuleInit(): Promise<void>;
    reload(): Promise<void>;
    getCached(lid: string): string | null | undefined;
    lidsForPhone(phone: string): string[];
    remember(lid: string, phone: string | null, sessionId?: string): Promise<void>;
    private warmFromTable;
    private index;
    private evictIfOverCap;
}
