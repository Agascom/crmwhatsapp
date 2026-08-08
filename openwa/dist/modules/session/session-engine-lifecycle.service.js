"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionEngineLifecycle = exports.EngineInitTimeoutError = void 0;
exports.resolveReconnectConfig = resolveReconnectConfig;
exports.resolveMaxConcurrentSessions = resolveMaxConcurrentSessions;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const session_entity_1 = require("./entities/session.entity");
const engine_factory_1 = require("../../engine/engine.factory");
const engine_registry_service_1 = require("../../engine/engine-registry.service");
const reconnect_policy_1 = require("./reconnect-policy");
const session_liveness_watchdog_service_1 = require("./session-liveness-watchdog.service");
const message_projector_service_1 = require("./message-projector.service");
const session_error_store_service_1 = require("./session-error-store.service");
const session_restriction_store_service_1 = require("./session-restriction-store.service");
const presence_store_service_1 = require("./presence-store.service");
const audit_service_1 = require("../audit/audit.service");
const audit_log_entity_1 = require("../audit/entities/audit-log.entity");
const engine_init_timeout_1 = require("../../engine/engine-init-timeout");
const status_store_service_1 = require("../status-store/status-store.service");
const logger_service_1 = require("../../common/services/logger.service");
const shutdown_service_1 = require("../../common/services/shutdown.service");
const session_reconnect_metrics_1 = require("../../common/metrics/session-reconnect-metrics");
const events_gateway_1 = require("../events/events.gateway");
const webhook_service_1 = require("../webhook/webhook.service");
const hooks_1 = require("../../core/hooks");
const session_lifecycle_fences_1 = require("./session-lifecycle-fences");
const session_status_broadcaster_1 = require("./session-status-broadcaster");
const session_engine_leaf_events_1 = require("./session-engine-leaf-events");
const session_engine_event_wiring_1 = require("./session-engine-event-wiring");
const session_engine_controls_1 = require("./session-engine-controls");
const session_ownership_service_1 = require("./session-ownership.service");
const isStatusSeedOnReadyEnabled = () => process.env.STATUS_SEED_ON_READY === 'true';
const RECONNECT_BASE_DELAY_MIN_MS = 1000;
const RECONNECT_BASE_DELAY_MAX_MS = 300_000;
const RECONNECT_MAX_ATTEMPTS_CAP = 20;
const clampNumber = (n, min, max) => Math.min(Math.max(n, min), max);
function resolveReconnectConfig(config) {
    const baseRaw = Number(config?.reconnectBaseDelay);
    const baseDelay = clampNumber(Number.isFinite(baseRaw) ? baseRaw : 5000, RECONNECT_BASE_DELAY_MIN_MS, RECONNECT_BASE_DELAY_MAX_MS);
    const attemptsRaw = Number(config?.maxReconnectAttempts);
    const maxAttempts = Number.isFinite(attemptsRaw)
        ? Math.floor(clampNumber(attemptsRaw, 0, RECONNECT_MAX_ATTEMPTS_CAP))
        : Number.POSITIVE_INFINITY;
    return { maxAttempts, baseDelay };
}
function resolveMaxConcurrentSessions(configService) {
    const configured = configService?.get('sessions.maxConcurrent', 0) ?? 0;
    if (!Number.isFinite(configured) || configured <= 0)
        return null;
    return Math.floor(configured);
}
class EngineInitTimeoutError extends Error {
    timeoutMs;
    constructor(timeoutMs) {
        super(`engine.initialize() timed out after ${timeoutMs}ms`);
        this.timeoutMs = timeoutMs;
        this.name = 'EngineInitTimeoutError';
    }
}
exports.EngineInitTimeoutError = EngineInitTimeoutError;
const ENGINE_AUTH_TIMEOUT = 'auth timeout';
const ENGINE_AUTH_TIMEOUT_MESSAGE = 'WhatsApp Web authentication timed out. Verify the session proxy URL and network egress can reach ' +
    'WhatsApp; for slow first boots, raise WWEBJS_AUTH_TIMEOUT_MS.';
function isAuthTimeoutRejection(err) {
    return err === ENGINE_AUTH_TIMEOUT || (err instanceof Error && err.message === ENGINE_AUTH_TIMEOUT);
}
const TERMINAL_UNLINK_REASONS = new Set(['LOGOUT', 'UNPAIRED', 'UNPAIRED_IDLE', 'logged out']);
let SessionEngineLifecycle = class SessionEngineLifecycle {
    sessionRepository;
    dataSource;
    engineFactory;
    engineRegistry;
    watchdog;
    messages;
    sessionErrors;
    sessionRestrictions;
    presence;
    eventsGateway;
    webhookService;
    hookManager;
    statusStore;
    configService;
    shutdownService;
    auditService;
    ownership;
    logger = (0, logger_service_1.createLogger)('SessionEngineLifecycle');
    get engines() {
        return this.engineRegistry;
    }
    fences;
    broadcaster;
    leafEvents;
    eventWiring;
    wiringHost;
    controls;
    reconnectStates = new Map();
    get lastDispatchedStatus() {
        return this.broadcaster.lastDispatchedStatus;
    }
    stoppingSessions = new Set();
    get initializingSessions() {
        return this.engineRegistry.initializing;
    }
    pendingTeardowns = new Map();
    pendingInitialStatuses = new Map();
    stuckAuthRecoveryUsed = new Set();
    constructor(sessionRepository, dataSource, engineFactory, engineRegistry, watchdog, messages, sessionErrors, sessionRestrictions, presence, eventsGateway, webhookService, hookManager, statusStore, configService, shutdownService, auditService, ownership) {
        this.sessionRepository = sessionRepository;
        this.dataSource = dataSource;
        this.engineFactory = engineFactory;
        this.engineRegistry = engineRegistry;
        this.watchdog = watchdog;
        this.messages = messages;
        this.sessionErrors = sessionErrors;
        this.sessionRestrictions = sessionRestrictions;
        this.presence = presence;
        this.eventsGateway = eventsGateway;
        this.webhookService = webhookService;
        this.hookManager = hookManager;
        this.statusStore = statusStore;
        this.configService = configService;
        this.shutdownService = shutdownService;
        this.auditService = auditService;
        this.ownership = ownership;
        this.fences = new session_lifecycle_fences_1.SessionLifecycleFences({
            engines: this.engineRegistry,
            pendingTeardowns: this.pendingTeardowns,
            pendingInitialStatuses: this.pendingInitialStatuses,
            logger: this.logger,
        });
        this.broadcaster = new session_status_broadcaster_1.SessionStatusBroadcaster({
            sessionRepository: this.sessionRepository,
            eventsGateway: this.eventsGateway,
            webhookService: this.webhookService,
            logger: this.logger,
        });
        this.leafEvents = new session_engine_leaf_events_1.SessionEngineLeafEvents({
            sessionRepository: this.sessionRepository,
            eventsGateway: this.eventsGateway,
            webhookService: this.webhookService,
            configService: this.configService,
            statusStore: this.statusStore,
            logger: this.logger,
        });
        this.eventWiring = new session_engine_event_wiring_1.SessionEngineEventWiring({ logger: this.logger });
        this.wiringHost = {
            isLiveEngine: (id, engine) => this.isLiveEngine(id, engine),
            ownsSession: id => this.ownsSession(id),
            handleEngineReady: (id, engine, phone, pushName) => this.handleEngineReady(id, engine, phone, pushName),
            handleEngineDisconnected: (id, engine, reason) => this.handleEngineDisconnected(id, engine, reason),
            updateStatus: (id, status) => this.updateStatus(id, status),
            cancelReconnect: id => this.cancelReconnect(id),
            evictAndForceDestroy: (id, engine) => this.evictAndForceDestroy(id, engine),
            trackPendingCredentialTeardown: (sessionName, raw) => this.trackPendingCredentialTeardown(sessionName, raw),
            reportRestrictionLifted: (id, lifted) => this.reportRestrictionLifted(id, lifted),
            claimStuckAuthRecovery: (id, engine) => {
                if (!this.isLiveEngine(id, engine))
                    return false;
                if (this.stuckAuthRecoveryUsed.has(id))
                    return false;
                this.stuckAuthRecoveryUsed.add(id);
                return true;
            },
            messages: this.messages,
            sessionErrors: this.sessionErrors,
            sessionRestrictions: this.sessionRestrictions,
            presence: this.presence,
            auditService: this.auditService,
            webhookService: this.webhookService,
            eventsGateway: this.eventsGateway,
            hookManager: this.hookManager,
            leafEvents: this.leafEvents,
        };
        this.controls = new session_engine_controls_1.SessionEngineControls({
            ownsSession: (id) => this.ownsSession(id),
            sessionRepository: this.sessionRepository,
            engineFactory: this.engineFactory,
            engines: this.engineRegistry,
            sessionErrors: this.sessionErrors,
            sessionRestrictions: this.sessionRestrictions,
            presence: this.presence,
            hookManager: this.hookManager,
            configService: this.configService,
            logger: this.logger,
            dataSource: () => this.dataSource,
            fences: this.fences,
            broadcaster: this.broadcaster,
            cancelReconnect: id => this.cancelReconnect(id),
            initializeEngine: (id, session) => this.initializeEngine(id, session),
            isSessionRetired: id => this.isSessionRetired(id),
            purgeAuthDirsIfDeleted: (id, name) => this.purgeAuthDirsIfDeleted(id, name),
            updateStatus: (id, status) => this.updateStatus(id, status),
            stoppingSessions: this.stoppingSessions,
            reconnectStates: this.reconnectStates,
            stuckAuthRecoveryUsed: this.stuckAuthRecoveryUsed,
            initializingSessions: this.initializingSessions,
        });
    }
    start(id) {
        return this.controls.start(id);
    }
    stop(id) {
        return this.controls.stop(id);
    }
    logout(id) {
        return this.controls.logout(id);
    }
    forceKill(id) {
        return this.controls.forceKill(id);
    }
    delete(id) {
        return this.controls.delete(id);
    }
    shutdown() {
        return this.controls.shutdown();
    }
    stopOrphanEngines(sessionIds) {
        return this.controls.stopOrphanEngines(sessionIds);
    }
    teardownEngineSafely(sessionId, engine, teardown, label, sessionName) {
        return this.fences.teardownEngineSafely(sessionId, engine, teardown, label, sessionName);
    }
    trackPendingCredentialTeardown(sessionName, raw) {
        this.fences.trackPendingCredentialTeardown(sessionName, raw);
    }
    awaitPendingTeardown(sessionName) {
        return this.fences.awaitPendingTeardown(sessionName);
    }
    evictAndForceDestroy(id, engine) {
        this.fences.evictAndForceDestroy(id, engine);
    }
    markStopping(id) {
        this.stoppingSessions.add(id);
    }
    isEngineActive(id) {
        if (this.engines.has(id) || this.initializingSessions.has(id))
            return true;
        const reconnect = this.reconnectStates.get(id);
        return reconnect != null && (reconnect.timer !== null || reconnect.attempts > 0);
    }
    seedStatuses(sessionId, engine) {
        return this.leafEvents.seedStatuses(sessionId, engine);
    }
    isLiveEngine(id, engine) {
        return this.engines.isLive(id, engine);
    }
    ownsSession(id) {
        return (0, session_ownership_service_1.nodeOwnsSession)(this.ownership, id);
    }
    async initializeEngine(id, session) {
        this.logger.log(`Initializing engine for session: ${session.name}`, {
            sessionId: id,
            action: 'engine_init',
            proxyEnabled: !!session.proxyUrl,
        });
        const engine = this.engineFactory.create({
            sessionId: session.name,
            dbSessionId: id,
            proxyUrl: session.proxyUrl || undefined,
            proxyType: session.proxyType || undefined,
        });
        this.engines.set(id, engine);
        this.presence.clear(id);
        this.sessionErrors.clear(id);
        const initialStatusPromise = this.updateStatus(id, session_entity_1.SessionStatus.INITIALIZING);
        this.pendingInitialStatuses.set(id, { engine, promise: initialStatusPromise });
        try {
            await initialStatusPromise;
        }
        finally {
            const pending = this.pendingInitialStatuses.get(id);
            if (pending && pending.engine === engine && pending.promise === initialStatusPromise) {
                this.pendingInitialStatuses.delete(id);
            }
        }
        if (!this.isLiveEngine(id, engine)) {
            return;
        }
        if (this.stoppingSessions.has(id)) {
            return;
        }
        const initPromise = engine.initialize(this.eventWiring.buildCallbacks(id, engine, session.name, this.wiringHost));
        const engineInitTimeoutMs = (0, engine_init_timeout_1.resolveEngineInitTimeoutMs)();
        initPromise.catch(() => undefined);
        let initTimer;
        try {
            await Promise.race([
                initPromise,
                new Promise((_, reject) => {
                    initTimer = setTimeout(() => reject(new EngineInitTimeoutError(engineInitTimeoutMs)), engineInitTimeoutMs);
                }),
            ]);
        }
        catch (err) {
            if (err instanceof EngineInitTimeoutError) {
                this.logger.error(`Engine initialization timed out for session ${session.name}`, undefined, {
                    sessionId: id,
                    action: 'engine_init_timeout',
                });
                this.sessionErrors.set(id, err.message);
                this.engines.delete(id);
                await this.teardownEngineSafely(id, engine, e => e.forceDestroy(), 'force-destroy');
                await this.updateStatus(id, session_entity_1.SessionStatus.DISCONNECTED);
                throw new common_1.HttpException(`Engine initialization timed out after ${err.timeoutMs}ms — the browser process did not complete ` +
                    'startup in time (often a container memory/resource limit or a stalled Chromium, not a network ' +
                    'issue). Retry the session; for chronically slow first boots, raise WWEBJS_AUTH_TIMEOUT_MS.', common_1.HttpStatus.GATEWAY_TIMEOUT);
            }
            else if (isAuthTimeoutRejection(err)) {
                throw new common_1.HttpException(ENGINE_AUTH_TIMEOUT_MESSAGE, common_1.HttpStatus.GATEWAY_TIMEOUT);
            }
            throw err;
        }
        finally {
            if (initTimer)
                clearTimeout(initTimer);
        }
    }
    handleEngineReady(id, engine, phone, pushName) {
        if (!this.isLiveEngine(id, engine))
            return;
        this.logger.log(`Session ready: ${phone}`, {
            sessionId: id,
            phone,
            pushName,
            action: 'ready',
        });
        void this.webhookService.dispatch(id, 'session.authenticated', { sessionId: id, phone, pushName });
        this.eventsGateway.emitSessionAuthenticated(id, { phone, pushName });
        void this.hookManager.execute('session:ready', { phone, pushName }, {
            sessionId: id,
            source: 'Engine',
        });
        const reconnectState = this.reconnectStates.get(id);
        if (reconnectState) {
            reconnectState.attempts = 0;
        }
        this.watchdog.clear(id);
        this.sessionErrors.clear(id);
        const liftedByReady = this.sessionRestrictions.clearIfDisprovedByReady(id);
        if (liftedByReady) {
            this.reportRestrictionLifted(id, liftedByReady);
        }
        this.stuckAuthRecoveryUsed.delete(id);
        void this.sessionRepository
            .update(id, {
            status: session_entity_1.SessionStatus.READY,
            phone,
            pushName,
            connectedAt: new Date(),
            lastActiveAt: new Date(),
        })
            .catch(err => this.logger.warn('Failed to persist session ready state', {
            sessionId: id,
            error: err instanceof Error ? err.message : String(err),
        }));
        if (isStatusSeedOnReadyEnabled()) {
            void this.seedStatuses(id, engine);
        }
        else {
            this.logger.debug('Status backfill on session ready is disabled', {
                sessionId: id,
                action: 'status_seed_on_ready_disabled',
            });
        }
    }
    reportRestrictionLifted(id, lifted) {
        this.logger.log(`The ${lifted.kind} restriction on this session is no longer in force`, {
            sessionId: id,
            kind: lifted.kind,
            code: lifted.code,
            action: 'account_restriction_lifted',
        });
        void this.webhookService.dispatch(id, 'session.restriction', {
            sessionId: id,
            active: false,
            kind: lifted.kind,
            code: lifted.code,
            expiresAt: null,
        });
        this.eventsGateway.emitSessionRestriction(id, {
            active: false,
            kind: lifted.kind,
            code: lifted.code,
            expiresAt: null,
        });
        void this.auditService?.logInfo(audit_log_entity_1.AuditAction.SESSION_RESTRICTION_LIFTED, {
            sessionId: id,
            metadata: { kind: lifted.kind, code: lifted.code },
        });
    }
    async handleEngineDisconnected(id, engine, reason) {
        if (!this.isLiveEngine(id, engine))
            return;
        let session;
        try {
            session = await this.sessionRepository.findOne({ where: { id } });
        }
        catch (err) {
            this.logger.error('Failed to reload the session for reconnect scheduling', String(err), {
                sessionId: id,
                action: 'reconnect_schedule_error',
            });
            return;
        }
        if (!session)
            return;
        if (!this.isLiveEngine(id, engine))
            return;
        this.logger.warn(`Session disconnected: ${reason}`, {
            sessionId: id,
            reason,
            action: 'disconnected',
        });
        if (TERMINAL_UNLINK_REASONS.has(reason)) {
            void this.auditService?.logWarn(audit_log_entity_1.AuditAction.SESSION_DISCONNECTED, {
                sessionId: id,
                metadata: { reason },
                errorMessage: `WhatsApp unlinked this device (${reason}); the session must be re-paired with a fresh QR`,
            });
        }
        void this.webhookService.dispatch(id, 'session.disconnected', { sessionId: id, reason });
        this.eventsGateway.emitSessionDisconnected(id, { reason });
        void this.hookManager.execute('session:disconnected', { reason }, {
            sessionId: id,
            source: 'Engine',
        });
        void this.updateStatus(id, session_entity_1.SessionStatus.DISCONNECTED);
        if (!this.isLiveEngine(id, engine))
            return;
        this.scheduleReconnect(id, session);
    }
    scheduleReconnect(id, session) {
        if (this.shutdownService?.isShuttingDown()) {
            this.logger.log(`Skipping reconnect during shutdown for session: ${session.name}`, { sessionId: id });
            return;
        }
        const state = this.reconnectStates.get(id);
        if (!state)
            return;
        const decision = (0, reconnect_policy_1.decideReconnect)(state);
        if (decision.kind === 'exhausted') {
            this.logger.error(`Max reconnect attempts reached for session: ${session.name}`, undefined, {
                sessionId: id,
                attempts: state.attempts,
                action: 'reconnect_failed',
            });
            this.sessionErrors.set(id, decision.reason);
            if (this.ownsSession(id))
                void this.updateStatus(id, session_entity_1.SessionStatus.FAILED);
            const deadEngine = this.engines.get(id);
            if (deadEngine) {
                this.evictAndForceDestroy(id, deadEngine);
            }
            this.cancelReconnect(id);
            return;
        }
        const delay = decision.delayMs;
        const maxAttemptsLabel = Number.isFinite(state.maxAttempts) ? String(state.maxAttempts) : '∞';
        this.logger.log(`Scheduling reconnect attempt ${decision.attempt}/${maxAttemptsLabel} in ${Math.round(delay / 1000)}s`, {
            sessionId: id,
            attempt: decision.attempt,
            delayMs: delay,
            action: 'reconnect_scheduled',
        });
        (0, session_reconnect_metrics_1.incrementSessionReconnectAttempts)();
        if (decision.loopAlert) {
            this.logger.warn(`Session is reconnect-looping: attempt ${decision.attempt} scheduled`, {
                sessionId: id,
                attempts: decision.attempt,
                nextDelayMs: delay,
                action: 'reconnect_loop',
            });
            (0, session_reconnect_metrics_1.incrementSessionReconnectLoopAlerts)();
            void this.webhookService.dispatch(id, 'session.reconnect_loop', {
                sessionId: id,
                attempts: decision.attempt,
                nextDelayMs: delay,
            });
        }
        if (state.timer)
            clearTimeout(state.timer);
        state.timer = setTimeout(() => {
            void this.executeReconnect(id, session, state);
        }, delay);
    }
    async isSessionRetired(id) {
        if (this.stoppingSessions.has(id)) {
            return true;
        }
        return (await this.sessionRepository.findOne({ where: { id } })) == null;
    }
    async purgeAuthDirsIfDeleted(id, name) {
        try {
            if ((await this.sessionRepository.findOne({ where: { id } })) != null)
                return;
            if ((await this.sessionRepository.findOne({ where: { name } })) != null)
                return;
            await this.engineFactory.purgeSessionData(name);
        }
        catch (error) {
            this.logger.warn('Failed to re-purge session auth dirs after a start/delete race', {
                sessionId: id,
                action: 'engine_repurge_failed',
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async executeReconnect(id, session, state) {
        if (this.stoppingSessions.has(id)) {
            return;
        }
        try {
            const oldEngine = this.engines.get(id);
            if (oldEngine) {
                const destroyed = await this.teardownEngineSafely(id, oldEngine, e => e.destroy(), 'destroy');
                if (!destroyed) {
                    await this.teardownEngineSafely(id, oldEngine, e => e.forceDestroy(), 'force-destroy');
                }
                this.engines.deleteIfLive(id, oldEngine);
            }
            await this.awaitPendingTeardown(session.name);
            await this.initializeEngine(id, session);
            let retired;
            try {
                retired = await this.isSessionRetired(id);
            }
            catch {
                retired = false;
            }
            if (retired) {
                const resurrected = this.engines.get(id);
                if (resurrected) {
                    await this.teardownEngineSafely(id, resurrected, e => e.destroy(), 'destroy');
                    this.engines.deleteIfLive(id, resurrected);
                }
                await this.purgeAuthDirsIfDeleted(id, session.name);
                return;
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Reconnect attempt ${state.attempts} failed`, errorMessage, {
                sessionId: id,
                action: 'reconnect_error',
            });
            const halfBuilt = this.engines.get(id);
            if (halfBuilt) {
                this.evictAndForceDestroy(id, halfBuilt);
            }
            this.scheduleReconnect(id, session);
        }
    }
    cancelReconnect(id) {
        const state = this.reconnectStates.get(id);
        if (state?.timer) {
            clearTimeout(state.timer);
            state.timer = null;
        }
        this.reconnectStates.delete(id);
    }
    updateStatus(id, status) {
        return this.broadcaster.updateStatus(id, status);
    }
};
exports.SessionEngineLifecycle = SessionEngineLifecycle;
exports.SessionEngineLifecycle = SessionEngineLifecycle = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(session_entity_1.Session, 'data')),
    __param(1, (0, typeorm_1.InjectDataSource)('data')),
    __param(13, (0, common_1.Optional)()),
    __param(14, (0, common_1.Optional)()),
    __param(15, (0, common_1.Optional)()),
    __param(16, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.DataSource,
        engine_factory_1.EngineFactory,
        engine_registry_service_1.EngineRegistry,
        session_liveness_watchdog_service_1.SessionLivenessWatchdog,
        message_projector_service_1.MessageProjector,
        session_error_store_service_1.SessionErrorStore,
        session_restriction_store_service_1.SessionRestrictionStore,
        presence_store_service_1.PresenceStore,
        events_gateway_1.EventsGateway,
        webhook_service_1.WebhookService,
        hooks_1.HookManager,
        status_store_service_1.StatusStoreService,
        config_1.ConfigService,
        shutdown_service_1.ShutdownService,
        audit_service_1.AuditService,
        session_ownership_service_1.SessionOwnershipService])
], SessionEngineLifecycle);
//# sourceMappingURL=session-engine-lifecycle.service.js.map