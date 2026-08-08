import { SessionStatus } from './entities/session.entity';
import { MessageProjector } from './message-projector.service';
import { SessionErrorStore } from './session-error-store.service';
import { SessionRestrictionStore } from './session-restriction-store.service';
import { PresenceStore } from './presence-store.service';
import { AuditService } from '../audit/audit.service';
import { EventsGateway } from '../events/events.gateway';
import { WebhookService } from '../webhook/webhook.service';
import { HookManager } from '../../core/hooks';
import { EngineEventCallbacks, IWhatsAppEngine, AccountRestriction } from '../../engine/interfaces/whatsapp-engine.interface';
import { type createLogger } from '../../common/services/logger.service';
import { SessionEngineLeafEvents } from './session-engine-leaf-events';
export interface SessionEngineWiringHost {
    isLiveEngine(id: string, engine: IWhatsAppEngine): boolean;
    ownsSession(id: string): boolean;
    handleEngineReady(id: string, engine: IWhatsAppEngine, phone: string, pushName: string): void;
    handleEngineDisconnected(id: string, engine: IWhatsAppEngine, reason: string): Promise<void>;
    updateStatus(id: string, status: SessionStatus): Promise<void>;
    cancelReconnect(id: string): void;
    evictAndForceDestroy(id: string, engine: IWhatsAppEngine): void;
    trackPendingCredentialTeardown(sessionName: string, raw: Promise<void>): void;
    reportRestrictionLifted(id: string, lifted: AccountRestriction): void;
    claimStuckAuthRecovery(id: string, engine: IWhatsAppEngine): boolean;
    messages: MessageProjector;
    sessionErrors: SessionErrorStore;
    sessionRestrictions: SessionRestrictionStore;
    presence: PresenceStore;
    auditService?: AuditService;
    webhookService: WebhookService;
    eventsGateway: EventsGateway;
    hookManager: HookManager;
    leafEvents: SessionEngineLeafEvents;
}
export declare class SessionEngineEventWiring {
    private readonly logger;
    constructor(deps: {
        logger: ReturnType<typeof createLogger>;
    });
    buildCallbacks(id: string, engine: IWhatsAppEngine, sessionName: string, host: SessionEngineWiringHost): EngineEventCallbacks;
}
