import { ConfigService } from '@nestjs/config';
import { Repository, DataSource } from 'typeorm';
import { Session, SessionStatus } from './entities/session.entity';
import { EngineFactory } from '../../engine/engine.factory';
import { EngineRegistry } from '../../engine/engine-registry.service';
import { type ReconnectAttemptState } from './reconnect-policy';
import { SessionLivenessWatchdog } from './session-liveness-watchdog.service';
import { MessageProjector } from './message-projector.service';
import { SessionErrorStore } from './session-error-store.service';
import { SessionRestrictionStore } from './session-restriction-store.service';
import { PresenceStore } from './presence-store.service';
import { AuditService } from '../audit/audit.service';
import { StatusStoreService } from '../status-store/status-store.service';
import { IWhatsAppEngine, AccountRestriction } from '../../engine/interfaces/whatsapp-engine.interface';
import { ShutdownService } from '../../common/services/shutdown.service';
import { EventsGateway } from '../events/events.gateway';
import { WebhookService } from '../webhook/webhook.service';
import { HookManager } from '../../core/hooks';
import { SessionOwnershipService } from './session-ownership.service';
export interface ReconnectState extends ReconnectAttemptState {
    timer: NodeJS.Timeout | null;
}
export declare function resolveReconnectConfig(config: {
    maxReconnectAttempts?: unknown;
    reconnectBaseDelay?: unknown;
} | null): {
    maxAttempts: number;
    baseDelay: number;
};
export declare function resolveMaxConcurrentSessions(configService?: Pick<ConfigService, 'get'>): number | null;
export declare class EngineInitTimeoutError extends Error {
    readonly timeoutMs: number;
    constructor(timeoutMs: number);
}
export declare class SessionEngineLifecycle {
    private readonly sessionRepository;
    private readonly dataSource;
    private readonly engineFactory;
    private readonly engineRegistry;
    private readonly watchdog;
    private readonly messages;
    private readonly sessionErrors;
    private readonly sessionRestrictions;
    private readonly presence;
    private readonly eventsGateway;
    private readonly webhookService;
    private readonly hookManager;
    private readonly statusStore;
    private readonly configService?;
    private readonly shutdownService?;
    private readonly auditService?;
    private readonly ownership?;
    private readonly logger;
    private get engines();
    private readonly fences;
    private readonly broadcaster;
    private readonly leafEvents;
    private readonly eventWiring;
    private readonly wiringHost;
    private readonly controls;
    private reconnectStates;
    private get lastDispatchedStatus();
    private stoppingSessions;
    private get initializingSessions();
    private readonly pendingTeardowns;
    private readonly pendingInitialStatuses;
    private readonly stuckAuthRecoveryUsed;
    constructor(sessionRepository: Repository<Session>, dataSource: DataSource, engineFactory: EngineFactory, engineRegistry: EngineRegistry, watchdog: SessionLivenessWatchdog, messages: MessageProjector, sessionErrors: SessionErrorStore, sessionRestrictions: SessionRestrictionStore, presence: PresenceStore, eventsGateway: EventsGateway, webhookService: WebhookService, hookManager: HookManager, statusStore: StatusStoreService, configService?: ConfigService | undefined, shutdownService?: ShutdownService | undefined, auditService?: AuditService | undefined, ownership?: SessionOwnershipService | undefined);
    start(id: string): Promise<Session>;
    stop(id: string): Promise<Session>;
    logout(id: string): Promise<Session>;
    forceKill(id: string): Promise<Session>;
    delete(id: string): Promise<void>;
    shutdown(): Promise<void>;
    stopOrphanEngines(sessionIds: string[]): Promise<{
        stopped: string[];
        notRunning: string[];
        failed: string[];
    }>;
    private teardownEngineSafely;
    private trackPendingCredentialTeardown;
    private awaitPendingTeardown;
    private evictAndForceDestroy;
    markStopping(id: string): void;
    isEngineActive(id: string): boolean;
    private seedStatuses;
    private isLiveEngine;
    private ownsSession;
    private initializeEngine;
    private handleEngineReady;
    reportRestrictionLifted(id: string, lifted: AccountRestriction): void;
    handleEngineDisconnected(id: string, engine: IWhatsAppEngine, reason: string): Promise<void>;
    private scheduleReconnect;
    private isSessionRetired;
    private purgeAuthDirsIfDeleted;
    private executeReconnect;
    private cancelReconnect;
    updateStatus(id: string, status: SessionStatus): Promise<void>;
}
