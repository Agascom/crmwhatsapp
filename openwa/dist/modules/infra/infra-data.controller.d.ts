import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { SessionService } from '../session/session.service';
import { LidMappingStoreService } from '../../engine/identity/lid-mapping-store.service';
import { SessionOwnershipService } from '../session/session-ownership.service';
import type { MigrationTables, TableCounts } from './migration-tables.types';
export interface SessionOwnershipRow {
    id: string;
    nodeId: string | null;
    claimedAt: unknown;
    leaseExpiresAt: unknown;
    nodeUrl: string | null;
}
export declare function restoreSessionOwnership(preserved: SessionOwnershipRow[] | null, insert: (text: string, params: unknown[]) => Promise<unknown>, readAt: Date, now?: Date): Promise<void>;
export declare class InfraDataController {
    private readonly configService;
    private readonly dataDataSource;
    private readonly auditService?;
    private readonly sessionService?;
    private readonly lidMappingStore?;
    private readonly ownership?;
    private readonly logger;
    private importInFlight;
    constructor(configService: ConfigService, dataDataSource: DataSource, auditService?: AuditService | undefined, sessionService?: SessionService | undefined, lidMappingStore?: LidMappingStoreService | undefined, ownership?: SessionOwnershipService | undefined);
    exportData(): Promise<{
        exportedAt: string;
        dataDbType: string;
        tables: MigrationTables;
        counts: {
            sessions: number;
            webhooks: number;
            messages: number;
            messageBatches: number;
            templates: number;
            baileysStoredMessages: number;
            lidMappings: number;
            pluginInstances: number;
            conversationMappings: number;
            ingressEvents: number;
            webhookDeliveryFailures: number;
            integrationDeliveryFailures: number;
            statusUpdates: number;
            automationRules: number;
        };
        skippedTables: string[];
        omittedInlineMedia: {
            messages: number;
            messageBatches: number;
        };
    }>;
    importData(data: {
        tables: Partial<MigrationTables>;
        force?: boolean;
        stopOrphans?: boolean;
    }): Promise<{
        imported: boolean;
        counts: TableCounts;
        warnings: string[];
        notices: string[];
        restartRequired: boolean;
        orphanedEngines: string[];
        stoppedOrphanEngines: string[];
        failedOrphanEngines: string[];
    }>;
    private runImport;
}
