"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionEngineControls = void 0;
const common_1 = require("@nestjs/common");
const session_entity_1 = require("./entities/session.entity");
const message_entity_1 = require("../message/entities/message.entity");
const message_batch_entity_1 = require("../message/entities/message-batch.entity");
const webhook_entity_1 = require("../webhook/entities/webhook.entity");
const template_entity_1 = require("../template/entities/template.entity");
const baileys_stored_message_entity_1 = require("../../engine/adapters/baileys-stored-message.entity");
const session_engine_lifecycle_service_1 = require("./session-engine-lifecycle.service");
class SessionEngineControls {
    host;
    sessionRepository;
    engineFactory;
    engines;
    sessionErrors;
    sessionRestrictions;
    presence;
    hookManager;
    configService;
    logger;
    fences;
    broadcaster;
    stoppingSessions;
    reconnectStates;
    stuckAuthRecoveryUsed;
    initializingSessions;
    constructor(host) {
        this.host = host;
        this.sessionRepository = host.sessionRepository;
        this.engineFactory = host.engineFactory;
        this.engines = host.engines;
        this.sessionErrors = host.sessionErrors;
        this.sessionRestrictions = host.sessionRestrictions;
        this.presence = host.presence;
        this.hookManager = host.hookManager;
        this.configService = host.configService;
        this.logger = host.logger;
        this.fences = host.fences;
        this.broadcaster = host.broadcaster;
        this.stoppingSessions = host.stoppingSessions;
        this.reconnectStates = host.reconnectStates;
        this.stuckAuthRecoveryUsed = host.stuckAuthRecoveryUsed;
        this.initializingSessions = host.initializingSessions;
    }
    async requireSession(id) {
        const session = await this.sessionRepository.findOne({ where: { id } });
        if (!session) {
            throw new common_1.NotFoundException(`Session with id '${id}' not found`);
        }
        return this.sessionRestrictions.attachTo(this.sessionErrors.attachTo(session));
    }
    async start(id) {
        if (this.initializingSessions.has(id)) {
            throw new common_1.BadRequestException('Session is already starting');
        }
        this.initializingSessions.add(id);
        try {
            const session = await this.requireSession(id);
            if (this.engines.has(id)) {
                throw new common_1.BadRequestException('Session is already started');
            }
            const maxConcurrentSessions = (0, session_engine_lifecycle_service_1.resolveMaxConcurrentSessions)(this.configService);
            if (maxConcurrentSessions !== null) {
                const activeIds = new Set(this.engines.activeIds());
                activeIds.delete(id);
                if (activeIds.size >= maxConcurrentSessions) {
                    throw new common_1.BadRequestException(`Maximum concurrent sessions reached (${maxConcurrentSessions})`);
                }
            }
            await this.fences.awaitPendingTeardown(session.name);
            this.stoppingSessions.delete(id);
            this.host.cancelReconnect(id);
            await this.hookManager.execute('session:starting', { sessionId: id }, {
                sessionId: id,
                source: 'SessionService',
            });
            const { maxAttempts, baseDelay } = (0, session_engine_lifecycle_service_1.resolveReconnectConfig)(session.config);
            this.reconnectStates.set(id, { attempts: 0, timer: null, maxAttempts, baseDelay });
            this.stuckAuthRecoveryUsed.delete(id);
            try {
                await this.host.initializeEngine(id, session);
            }
            catch (err) {
                const orphan = this.engines.get(id);
                if (orphan) {
                    this.engines.delete(id);
                    this.sessionErrors.set(id, err instanceof Error ? err.message : String(err));
                    await this.fences.teardownEngineSafely(id, orphan, e => e.forceDestroy(), 'force-destroy');
                    if (this.host.ownsSession(id)) {
                        await this.host.updateStatus(id, session_entity_1.SessionStatus.FAILED).catch(() => undefined);
                    }
                }
                this.host.cancelReconnect(id);
                throw err;
            }
            if (await this.host.isSessionRetired(id)) {
                const resurrected = this.engines.get(id);
                if (resurrected) {
                    await this.fences.teardownEngineSafely(id, resurrected, e => e.destroy(), 'destroy');
                    this.engines.deleteIfLive(id, resurrected);
                }
                await this.host.purgeAuthDirsIfDeleted(id, session.name);
            }
            return this.requireSession(id);
        }
        finally {
            this.initializingSessions.delete(id);
        }
    }
    async stop(id) {
        const session = await this.requireSession(id);
        this.stoppingSessions.add(id);
        this.host.cancelReconnect(id);
        const engine = this.engines.get(id);
        if (engine) {
            await this.fences.awaitInitialStatus(id, engine);
            await this.fences.teardownEngineSafely(id, engine, e => e.disconnect(), 'disconnect');
            this.engines.deleteIfLive(id, engine);
        }
        this.logger.log(`Session stopped: ${session.name}`, {
            sessionId: id,
            action: 'stop',
        });
        await this.host.updateStatus(id, session_entity_1.SessionStatus.DISCONNECTED);
        return this.requireSession(id);
    }
    async logout(id) {
        const session = await this.requireSession(id);
        const engine = this.engines.get(id);
        if (!engine) {
            throw new common_1.BadRequestException('Session is not started. Call POST /sessions/:id/start first.');
        }
        this.stoppingSessions.add(id);
        this.host.cancelReconnect(id);
        await this.fences.awaitInitialStatus(id, engine);
        const unlinked = await this.fences.teardownEngineSafely(id, engine, e => e.logout(), 'logout', session.name);
        this.engines.deleteIfLive(id, engine);
        await this.host.updateStatus(id, session_entity_1.SessionStatus.DISCONNECTED);
        if (!unlinked) {
            this.logger.warn(`Session stopped locally but the logout operation did not complete: ${session.name}`, {
                sessionId: id,
                action: 'logout_incomplete',
            });
            await this.sessionRepository.update(id, { phone: null });
            throw new common_1.BadGatewayException({
                statusCode: common_1.HttpStatus.BAD_GATEWAY,
                message: 'Session was stopped locally, but the logout operation is incomplete — the device may ' +
                    'still be linked. Start the session and retry the logout.',
                error: 'Bad Gateway',
                code: 'SESSION_LOGOUT_INCOMPLETE',
            });
        }
        await this.sessionRepository.update(id, { phone: null });
        this.logger.log(`Session logged out: ${session.name}`, {
            sessionId: id,
            action: 'logout',
        });
        return this.requireSession(id);
    }
    async forceKill(id) {
        const session = await this.requireSession(id);
        const engine = this.engines.get(id);
        if (!engine) {
            throw new common_1.BadRequestException('Session is not started. Call POST /sessions/:id/start first.');
        }
        this.stoppingSessions.add(id);
        this.host.cancelReconnect(id);
        await this.fences.awaitInitialStatus(id, engine);
        await this.fences.teardownEngineSafely(id, engine, e => e.forceDestroy(), 'force-destroy');
        this.engines.deleteIfLive(id, engine);
        this.logger.warn(`Session force-killed: ${session.name}`, {
            sessionId: id,
            action: 'force_kill',
        });
        await this.host.updateStatus(id, session_entity_1.SessionStatus.DISCONNECTED);
        return this.requireSession(id);
    }
    async delete(id) {
        const session = await this.requireSession(id);
        await this.fences.awaitPendingTeardown(session.name);
        this.stoppingSessions.add(id);
        this.host.cancelReconnect(id);
        let parentDeleted = false;
        try {
            const engine = this.engines.get(id);
            if (engine) {
                await this.fences.awaitInitialStatus(id, engine);
                await this.fences.teardownEngineSafely(id, engine, e => e.forceDestroy(), 'force-destroy');
                this.engines.deleteIfLive(id, engine);
            }
            try {
                await this.fences.awaitPendingTeardown(session.name);
            }
            catch (fenceError) {
                if (engine) {
                    await this.host.updateStatus(id, session_entity_1.SessionStatus.DISCONNECTED).catch(() => undefined);
                }
                throw fenceError;
            }
            await this.hookManager.execute('session:deleted', {
                id: session.id,
                name: session.name,
                phone: session.phone,
                pushName: session.pushName,
            }, {
                sessionId: id,
                source: 'SessionService',
            });
            await this.host.dataSource().transaction(async (manager) => {
                await manager.delete(message_entity_1.Message, { sessionId: id });
                await manager.delete(message_batch_entity_1.MessageBatch, { sessionId: id });
                await manager.delete(webhook_entity_1.Webhook, { sessionId: id });
                await manager.delete(template_entity_1.Template, { sessionId: id });
                await manager.delete(baileys_stored_message_entity_1.BaileysStoredMessage, { sessionId: id });
                await manager.remove(session);
            });
            parentDeleted = true;
            this.logger.log(`Session deleted: ${session.name}`, {
                sessionId: id,
                action: 'delete',
            });
            await this.engineFactory.purgeSessionData(session.name);
        }
        finally {
            this.stoppingSessions.delete(id);
            if (parentDeleted) {
                this.broadcaster.clear(id);
                this.sessionErrors.clear(id);
                this.sessionRestrictions.clear(id);
                this.presence.clear(id);
                this.stuckAuthRecoveryUsed.delete(id);
            }
        }
    }
    async shutdown() {
        for (const [, state] of this.reconnectStates) {
            if (state.timer) {
                clearTimeout(state.timer);
            }
        }
        this.reconnectStates.clear();
        await Promise.allSettled([...this.engines].map(([sessionId, engine]) => this.fences.destroyEngineSafely(sessionId, engine)));
        this.engines.clear();
    }
    async stopOrphanEngines(sessionIds) {
        const stopped = [];
        const notRunning = [];
        const failed = [];
        if (sessionIds.length === 0)
            return { stopped, notRunning, failed };
        await Promise.allSettled(sessionIds.map(async (id) => {
            this.stoppingSessions.add(id);
            this.host.cancelReconnect(id);
            const engine = this.engines.get(id);
            if (!engine) {
                notRunning.push(id);
                return;
            }
            try {
                const tornDown = await this.fences.destroyEngineSafely(id, engine);
                this.engines.deleteIfLive(id, engine);
                if (tornDown) {
                    stopped.push(id);
                }
                else {
                    failed.push(id);
                }
            }
            catch (err) {
                this.logger.error(`Failed to stop orphan engine for session ${id}`, String(err), {
                    sessionId: id,
                    action: 'stop_orphan_failed',
                });
                this.engines.deleteIfLive(id, engine);
                failed.push(id);
            }
        }));
        return { stopped, notRunning, failed };
    }
}
exports.SessionEngineControls = SessionEngineControls;
//# sourceMappingURL=session-engine-controls.js.map