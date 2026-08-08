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
exports.SessionService = exports.EngineInitTimeoutError = exports.resolveMaxConcurrentSessions = exports.resolveReconnectConfig = exports.SESSION_WATCHDOG_MAX_FAILURES = exports.SESSION_WATCHDOG_PROBE_TIMEOUT_MS = exports.SESSION_WATCHDOG_INTERVAL_MS = exports.ACK_RECONCILE_DELAY_MS = exports.clampReconnectDelay = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const session_entity_1 = require("./entities/session.entity");
const message_entity_1 = require("../message/entities/message.entity");
const engine_registry_service_1 = require("../../engine/engine-registry.service");
const session_lid_resolver_service_1 = require("./session-lid-resolver.service");
const session_liveness_watchdog_service_1 = require("./session-liveness-watchdog.service");
const session_error_store_service_1 = require("./session-error-store.service");
const session_restriction_store_service_1 = require("./session-restriction-store.service");
const presence_store_service_1 = require("./presence-store.service");
const session_engine_lifecycle_service_1 = require("./session-engine-lifecycle.service");
const session_ownership_service_1 = require("./session-ownership.service");
const paginate_1 = require("../../common/utils/paginate");
const unique_constraint_util_1 = require("../../common/utils/unique-constraint.util");
const feature_flags_1 = require("../../config/feature-flags");
const logger_service_1 = require("../../common/services/logger.service");
const hooks_1 = require("../../core/hooks");
var reconnect_policy_1 = require("./reconnect-policy");
Object.defineProperty(exports, "clampReconnectDelay", { enumerable: true, get: function () { return reconnect_policy_1.clampReconnectDelay; } });
var message_projector_service_1 = require("./message-projector.service");
Object.defineProperty(exports, "ACK_RECONCILE_DELAY_MS", { enumerable: true, get: function () { return message_projector_service_1.ACK_RECONCILE_DELAY_MS; } });
var session_liveness_watchdog_service_2 = require("./session-liveness-watchdog.service");
Object.defineProperty(exports, "SESSION_WATCHDOG_INTERVAL_MS", { enumerable: true, get: function () { return session_liveness_watchdog_service_2.SESSION_WATCHDOG_INTERVAL_MS; } });
Object.defineProperty(exports, "SESSION_WATCHDOG_PROBE_TIMEOUT_MS", { enumerable: true, get: function () { return session_liveness_watchdog_service_2.SESSION_WATCHDOG_PROBE_TIMEOUT_MS; } });
Object.defineProperty(exports, "SESSION_WATCHDOG_MAX_FAILURES", { enumerable: true, get: function () { return session_liveness_watchdog_service_2.SESSION_WATCHDOG_MAX_FAILURES; } });
var session_engine_lifecycle_service_2 = require("./session-engine-lifecycle.service");
Object.defineProperty(exports, "resolveReconnectConfig", { enumerable: true, get: function () { return session_engine_lifecycle_service_2.resolveReconnectConfig; } });
Object.defineProperty(exports, "resolveMaxConcurrentSessions", { enumerable: true, get: function () { return session_engine_lifecycle_service_2.resolveMaxConcurrentSessions; } });
Object.defineProperty(exports, "EngineInitTimeoutError", { enumerable: true, get: function () { return session_engine_lifecycle_service_2.EngineInitTimeoutError; } });
let SessionService = class SessionService {
    sessionRepository;
    messageRepository;
    dataSource;
    engineRegistry;
    lidResolver;
    watchdog;
    sessionErrors;
    sessionRestrictions;
    presence;
    hookManager;
    engineLifecycle;
    configService;
    ownership;
    logger = (0, logger_service_1.createLogger)('SessionService');
    get engines() {
        return this.engineRegistry;
    }
    constructor(sessionRepository, messageRepository, dataSource, engineRegistry, lidResolver, watchdog, sessionErrors, sessionRestrictions, presence, hookManager, engineLifecycle, configService, ownership) {
        this.sessionRepository = sessionRepository;
        this.messageRepository = messageRepository;
        this.dataSource = dataSource;
        this.engineRegistry = engineRegistry;
        this.lidResolver = lidResolver;
        this.watchdog = watchdog;
        this.sessionErrors = sessionErrors;
        this.sessionRestrictions = sessionRestrictions;
        this.presence = presence;
        this.hookManager = hookManager;
        this.engineLifecycle = engineLifecycle;
        this.configService = configService;
        this.ownership = ownership;
    }
    async onModuleInit() {
        const activeStatuses = [
            session_entity_1.SessionStatus.READY,
            session_entity_1.SessionStatus.INITIALIZING,
            session_entity_1.SessionStatus.QR_READY,
            session_entity_1.SessionStatus.AUTHENTICATING,
            session_entity_1.SessionStatus.ACTION_REQUIRED,
        ];
        const claimable = this.ownership?.claimableWhere() ?? [{}];
        const result = await this.sessionRepository.update(claimable.map(clause => ({ ...clause, status: (0, typeorm_2.In)(activeStatuses) })), { status: session_entity_1.SessionStatus.DISCONNECTED });
        if (result.affected && result.affected > 0) {
            this.logger.log(`Reset ${result.affected} session(s) to disconnected on startup`, {
                action: 'startup_reset',
                affected: result.affected,
                nodeId: this.ownership?.nodeId,
            });
        }
    }
    async onApplicationBootstrap() {
        this.watchdog.start((id, engine, reason) => this.engineLifecycle.handleEngineDisconnected(id, engine, reason));
        this.ownership?.onLeaseLoss(async (ids) => void (await this.engineLifecycle.stopOrphanEngines(ids)));
        this.ownership?.setEngineLiveness(id => this.engineLifecycle.isEngineActive(id));
        this.ownership?.startHeartbeat();
        if (!(0, feature_flags_1.resolveFeatureFlags)(this.configService).autoStartSessions)
            return;
        const claimable = this.ownership?.claimableWhere() ?? [{}];
        const sessions = await this.sessionRepository.find({
            where: claimable.map(clause => ({ ...clause, phone: (0, typeorm_2.Not)((0, typeorm_2.IsNull)()), status: session_entity_1.SessionStatus.DISCONNECTED })),
        });
        if (sessions.length === 0)
            return;
        this.logger.log(`Auto-starting ${sessions.length} previously authenticated session(s)`, {
            action: 'auto_start',
            count: sessions.length,
        });
        for (let i = 0; i < sessions.length; i++) {
            const session = sessions[i];
            try {
                await this.start(session.id);
                this.logger.log(`Auto-started session: ${session.name}`, {
                    sessionId: session.id,
                    action: 'auto_start_success',
                });
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                this.logger.error(`Auto-start failed for session: ${session.name}`, errorMessage, {
                    sessionId: session.id,
                    action: 'auto_start_failed',
                });
            }
            if (i < sessions.length - 1) {
                await this.delay(2000);
            }
        }
    }
    async onModuleDestroy() {
        this.watchdog.stop();
        this.ownership?.stopHeartbeat();
        await this.engineLifecycle.shutdown();
        await this.ownership?.releaseAll();
    }
    async create(dto) {
        const existing = await this.sessionRepository.findOne({
            where: { name: dto.name },
        });
        if (existing) {
            throw new common_1.ConflictException(`Session with name '${dto.name}' already exists`);
        }
        const session = this.sessionRepository.create({
            name: dto.name,
            config: dto.config || {},
            proxyUrl: dto.proxyUrl || null,
            proxyType: dto.proxyType || null,
            status: session_entity_1.SessionStatus.CREATED,
        });
        let saved;
        try {
            saved = await this.dataSource.transaction(async (manager) => {
                return await manager.save(session);
            });
        }
        catch (err) {
            if ((0, unique_constraint_util_1.isUniqueConstraintError)(err)) {
                throw new common_1.ConflictException(`Session with name '${dto.name}' already exists`);
            }
            throw err;
        }
        this.logger.log(`Session created: ${saved.name}`, {
            sessionId: saved.id,
            action: 'create',
        });
        await this.hookManager.execute('session:created', saved, {
            sessionId: saved.id,
            source: 'SessionService',
        });
        return saved;
    }
    async findAll(allowedSessions, opts = {}) {
        const { limit, offset } = (0, paginate_1.resolveListWindow)(opts.limit, opts.offset);
        const options = { order: { createdAt: 'DESC' }, take: limit, skip: offset };
        if (allowedSessions && allowedSessions.length > 0) {
            options.where = { id: (0, typeorm_2.In)(allowedSessions) };
        }
        const sessions = await this.sessionRepository.find(options);
        return sessions.map(session => this.attachRuntimeState(session));
    }
    async findOne(id) {
        const session = await this.sessionRepository.findOne({ where: { id } });
        if (!session) {
            throw new common_1.NotFoundException(`Session with id '${id}' not found`);
        }
        return this.attachRuntimeState(session);
    }
    attachRuntimeState(session) {
        return this.sessionRestrictions.attachTo(this.sessionErrors.attachTo(session));
    }
    async findByName(name) {
        const session = await this.sessionRepository.findOne({ where: { name } });
        if (!session) {
            throw new common_1.NotFoundException(`Session with name '${name}' not found`);
        }
        return session;
    }
    projectConfig(config) {
        const { maxAttempts, baseDelay } = (0, session_engine_lifecycle_service_1.resolveReconnectConfig)(config);
        return {
            autoRejectCalls: config?.autoRejectCalls === true,
            maxReconnectAttempts: Number.isFinite(maxAttempts) ? maxAttempts : null,
            reconnectBaseDelay: baseDelay,
        };
    }
    async getConfig(id) {
        const session = await this.findOne(id);
        return this.projectConfig(session.config ?? {});
    }
    async updateConfig(id, dto) {
        const session = await this.findOne(id);
        const config = { ...(session.config ?? {}) };
        for (const key of ['autoRejectCalls', 'maxReconnectAttempts', 'reconnectBaseDelay']) {
            const value = dto[key];
            if (value === undefined)
                continue;
            if (value === null) {
                delete config[key];
            }
            else {
                config[key] = value;
            }
        }
        await this.sessionRepository.update(id, { config: config });
        return this.projectConfig(config);
    }
    async delete(id) {
        this.engineLifecycle.markStopping(id);
        if (this.ownership)
            await this.assertNotHeldElsewhere(id);
        await this.engineLifecycle.delete(id);
        await this.ownership?.release(id);
    }
    async assertNotHeldElsewhere(id) {
        if (await this.ownership?.isHeldByOtherNode(id)) {
            throw new common_1.ConflictException(`Session ${id} is running on another node`);
        }
    }
    async start(id) {
        if (this.ownership && !(await this.ownership.claim(id))) {
            await this.findOne(id);
            throw new common_1.ConflictException(`Session ${id} is running on another node`);
        }
        try {
            return await this.engineLifecycle.start(id);
        }
        catch (error) {
            await this.releaseUnlessEngineActive(id);
            throw error;
        }
    }
    async stop(id) {
        this.engineLifecycle.markStopping(id);
        if (this.ownership)
            await this.assertNotHeldElsewhere(id);
        const session = await this.engineLifecycle.stop(id);
        await this.releaseUnlessEngineActive(id);
        return session;
    }
    async logout(id) {
        try {
            const session = await this.engineLifecycle.logout(id);
            await this.releaseUnlessEngineActive(id);
            return session;
        }
        catch (error) {
            await this.releaseUnlessEngineActive(id);
            throw error;
        }
    }
    async forceKill(id) {
        try {
            const session = await this.engineLifecycle.forceKill(id);
            await this.releaseUnlessEngineActive(id);
            return session;
        }
        catch (error) {
            await this.releaseUnlessEngineActive(id);
            throw error;
        }
    }
    async releaseUnlessEngineActive(id) {
        if (!this.ownership || this.engineLifecycle.isEngineActive(id)) {
            return;
        }
        await this.ownership.release(id);
    }
    async getQRCode(id) {
        const session = await this.findOne(id);
        const engine = this.engines.get(id);
        if (!engine) {
            throw new common_1.BadRequestException('Session is not started. Call POST /sessions/:id/start first.');
        }
        const qrCode = engine.getQRCode();
        if (!qrCode) {
            if (session.status === session_entity_1.SessionStatus.READY) {
                throw new common_1.BadRequestException('Session is already authenticated, no QR code needed');
            }
            throw new common_1.BadRequestException('QR code is not ready yet. Please wait...');
        }
        return {
            qrCode,
            status: session.status,
        };
    }
    async requestPairingCode(id, phoneNumber) {
        const session = await this.findOne(id);
        const engine = this.engines.get(id);
        if (!engine) {
            throw new common_1.BadRequestException('Session is not started. Call POST /sessions/:id/start first.');
        }
        if (session.status === session_entity_1.SessionStatus.READY) {
            throw new common_1.BadRequestException('Session is already authenticated, no pairing needed');
        }
        const pairingCode = await engine.requestPairingCode(phoneNumber);
        return { pairingCode, status: session.status };
    }
    getEngine(id) {
        return this.engines.get(id);
    }
    async getGroups(id, opts = {}) {
        await this.findOne(id);
        const engine = this.engines.get(id);
        if (!engine) {
            throw new common_1.BadRequestException('Session is not started');
        }
        const groups = await engine.getGroups();
        const mapped = groups.map(g => ({
            id: g.id,
            name: g.name,
            linkedParentJID: g.linkedParentJID,
        }));
        return (0, paginate_1.paginate)(mapped, opts.limit, opts.offset);
    }
    async getChats(id, opts = {}) {
        await this.findOne(id);
        const engine = this.engines.get(id);
        if (!engine) {
            throw new common_1.BadRequestException('Session is not started');
        }
        const chats = [...(await engine.getChats())].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        return (0, paginate_1.paginate)(chats, opts.limit, opts.offset);
    }
    async subscribeToPresence(id, chatId) {
        await this.findOne(id);
        const engine = this.engines.get(id);
        if (!engine) {
            throw new common_1.BadRequestException('Session is not started');
        }
        return engine.subscribeToPresence(chatId);
    }
    async getPresence(id, chatId) {
        await this.findOne(id);
        return this.presence.get(id, chatId);
    }
    async sendSeen(id, chatId) {
        await this.findOne(id);
        const engine = this.engines.get(id);
        if (!engine) {
            throw new common_1.BadRequestException('Session is not started');
        }
        return engine.sendSeen(chatId);
    }
    async markUnread(id, chatId) {
        await this.findOne(id);
        const engine = this.engines.get(id);
        if (!engine) {
            throw new common_1.BadRequestException('Session is not started');
        }
        return engine.markUnread(chatId);
    }
    async clearChatMessages(id, chatId) {
        await this.findOne(id);
        const engine = this.engines.get(id);
        if (!engine) {
            throw new common_1.BadRequestException('Session is not started');
        }
        return engine.clearChatMessages(chatId);
    }
    async archiveChat(id, chatId, archive) {
        await this.findOne(id);
        const engine = this.engines.get(id);
        if (!engine) {
            throw new common_1.BadRequestException('Session is not started');
        }
        return engine.archiveChat(chatId, archive);
    }
    async deleteChat(id, chatId) {
        await this.findOne(id);
        const engine = this.engines.get(id);
        if (!engine) {
            throw new common_1.BadRequestException('Session is not started');
        }
        return engine.deleteChat(chatId);
    }
    async sendChatState(id, chatId, state) {
        await this.findOne(id);
        const engine = this.engines.get(id);
        if (!engine) {
            throw new common_1.BadRequestException('Session is not started');
        }
        await engine.sendChatState(chatId, state);
    }
    async getStats(allowedSessions) {
        const scope = allowedSessions && allowedSessions.length > 0 ? allowedSessions : null;
        const qb = this.sessionRepository
            .createQueryBuilder('session')
            .select('session.status', 'status')
            .addSelect('COUNT(session.id)', 'count');
        if (scope) {
            qb.where('session.id IN (:...scope)', { scope });
        }
        const rows = await qb.groupBy('session.status').getRawMany();
        const byStatus = {};
        let total = 0;
        for (const row of rows) {
            const count = Number(row.count) || 0;
            byStatus[row.status] = count;
            total += count;
        }
        const memory = process.memoryUsage();
        return {
            total,
            active: scope ? [...this.engines.keys()].filter(id => scope.includes(id)).length : this.engines.size,
            ready: byStatus[session_entity_1.SessionStatus.READY] || 0,
            disconnected: byStatus[session_entity_1.SessionStatus.DISCONNECTED] || 0,
            byStatus,
            memoryUsage: {
                heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
                heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
                rss: Math.round(memory.rss / 1024 / 1024),
            },
        };
    }
    getActiveCount() {
        return this.engines.size;
    }
    isActive(id) {
        return this.engines.has(id);
    }
    getActiveSessionIds() {
        return this.engines.activeIds();
    }
    async stopOrphanEngines(sessionIds) {
        return this.engineLifecycle.stopOrphanEngines(sessionIds);
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};
exports.SessionService = SessionService;
exports.SessionService = SessionService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(session_entity_1.Session, 'data')),
    __param(1, (0, typeorm_1.InjectRepository)(message_entity_1.Message, 'data')),
    __param(2, (0, typeorm_1.InjectDataSource)('data')),
    __param(11, (0, common_1.Optional)()),
    __param(12, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource,
        engine_registry_service_1.EngineRegistry,
        session_lid_resolver_service_1.SessionLidResolver,
        session_liveness_watchdog_service_1.SessionLivenessWatchdog,
        session_error_store_service_1.SessionErrorStore,
        session_restriction_store_service_1.SessionRestrictionStore,
        presence_store_service_1.PresenceStore,
        hooks_1.HookManager,
        session_engine_lifecycle_service_1.SessionEngineLifecycle,
        config_1.ConfigService,
        session_ownership_service_1.SessionOwnershipService])
], SessionService);
//# sourceMappingURL=session.service.js.map