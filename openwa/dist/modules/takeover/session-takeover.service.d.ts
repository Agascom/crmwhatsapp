import { OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionOwnershipService } from '../session/session-ownership.service';
import { SessionService } from '../session/session.service';
import { BulkMessageService } from '../message/bulk-message.service';
export declare class SessionTakeoverService implements OnApplicationBootstrap, OnModuleDestroy {
    private readonly sessionService;
    private readonly ownership;
    private readonly bulkMessages;
    private readonly configService?;
    private readonly logger;
    private sweepTimer?;
    private sweepInFlight;
    constructor(sessionService: SessionService, ownership: SessionOwnershipService, bulkMessages: BulkMessageService, configService?: ConfigService | undefined);
    onApplicationBootstrap(): void;
    onModuleDestroy(): void;
    sweep(): Promise<void>;
    private isEligible;
}
