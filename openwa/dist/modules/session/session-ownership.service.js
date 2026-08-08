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
exports.nodeOwnsSession = exports.SessionOwnershipService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const config_1 = require("@nestjs/config");
const node_os_1 = require("node:os");
const typeorm_2 = require("typeorm");
const session_entity_1 = require("./entities/session.entity");
const logger_service_1 = require("../../common/services/logger.service");
const date_transformer_1 = require("../../common/transformers/date.transformer");
function leaseParam(at) {
    return date_transformer_1.DateTransformer.to(at) ?? at;
}
let SessionOwnershipService = class SessionOwnershipService {
    sessions;
    configService;
    logger = (0, logger_service_1.createLogger)('SessionOwnershipService');
    heartbeat;
    owned = new Set();
    onLeaseLost;
    lossDetectionSuspended = 0;
    engineLiveness;
    constructor(sessions, configService) {
        this.sessions = sessions;
        this.configService = configService;
    }
    get nodeId() {
        return this.configService?.get('session.nodeId') || process.env.NODE_ID || (0, node_os_1.hostname)();
    }
    get nodeUrl() {
        return this.configService?.get('session.nodeUrl') || process.env.NODE_URL || '';
    }
    get leaseTtlMs() {
        return this.configService?.get('session.leaseTtlMs') ?? 60_000;
    }
    get heartbeatMs() {
        return this.configService?.get('session.leaseHeartbeatMs') ?? 20_000;
    }
    claimableWhere(now = new Date()) {
        return [{ nodeId: (0, typeorm_2.IsNull)() }, { nodeId: this.nodeId }, { leaseExpiresAt: (0, typeorm_2.LessThan)(now) }];
    }
    async claimable(ids) {
        if (ids.length === 0)
            return [];
        const rows = await this.sessions.find({
            where: this.claimableWhere().map(clause => ({ ...clause, id: (0, typeorm_2.In)(ids) })),
            select: { id: true },
        });
        return rows.map(row => row.id);
    }
    async claim(sessionId) {
        const now = new Date();
        const result = await this.sessions
            .createQueryBuilder()
            .update(session_entity_1.Session)
            .set({
            nodeId: this.nodeId,
            claimedAt: now,
            leaseExpiresAt: new Date(now.getTime() + this.leaseTtlMs),
            nodeUrl: this.nodeUrl || null,
        })
            .where('id = :id', { id: sessionId })
            .andWhere('("nodeId" IS NULL OR "nodeId" = :me OR "leaseExpiresAt" < :now)', {
            me: this.nodeId,
            now: leaseParam(now),
        })
            .execute();
        const claimed = (result.affected ?? 0) > 0;
        if (claimed)
            this.owned.add(sessionId);
        else
            this.logger.warn('Session is held by another node', { sessionId, nodeId: this.nodeId });
        return claimed;
    }
    async release(sessionId) {
        const now = new Date();
        this.owned.delete(sessionId);
        await this.sessions
            .createQueryBuilder()
            .update(session_entity_1.Session)
            .set({ nodeId: null, claimedAt: null, leaseExpiresAt: null, nodeUrl: null })
            .where('id = :id', { id: sessionId })
            .andWhere('("nodeId" = :me OR "leaseExpiresAt" < :now)', { me: this.nodeId, now: leaseParam(now) })
            .execute();
    }
    async releaseAll() {
        const ids = [...this.owned];
        this.owned.clear();
        if (ids.length === 0)
            return;
        await this.sessions
            .createQueryBuilder()
            .update(session_entity_1.Session)
            .set({ nodeId: null, claimedAt: null, leaseExpiresAt: null, nodeUrl: null })
            .where({ id: (0, typeorm_2.In)(ids), nodeId: this.nodeId })
            .execute();
        this.logger.log(`Released ${ids.length} session claim(s) on shutdown`, { nodeId: this.nodeId });
    }
    startHeartbeat() {
        if (this.heartbeat)
            return;
        this.heartbeat = setInterval(() => {
            void this.renew();
        }, this.heartbeatMs);
        this.heartbeat.unref?.();
    }
    stopHeartbeat() {
        if (!this.heartbeat)
            return;
        clearInterval(this.heartbeat);
        this.heartbeat = undefined;
    }
    onLeaseLoss(handler) {
        this.onLeaseLost = handler;
    }
    suspendLossDetection() {
        this.lossDetectionSuspended++;
        let released = false;
        return () => {
            if (released)
                return;
            released = true;
            this.lossDetectionSuspended--;
        };
    }
    setEngineLiveness(probe) {
        this.engineLiveness = probe;
    }
    async renew() {
        const held = [...this.owned];
        if (held.length === 0)
            return;
        const live = this.engineLiveness ? held.filter(id => this.engineLiveness(id)) : held;
        let kept;
        try {
            if (live.length > 0) {
                await this.sessions
                    .createQueryBuilder()
                    .update(session_entity_1.Session)
                    .set({ leaseExpiresAt: new Date(Date.now() + this.leaseTtlMs) })
                    .where({ id: (0, typeorm_2.In)(live), nodeId: this.nodeId })
                    .execute();
            }
            const rows = await this.sessions.find({ where: { id: (0, typeorm_2.In)(held), nodeId: this.nodeId }, select: { id: true } });
            kept = new Set(rows.map(row => row.id));
        }
        catch (error) {
            this.logger.warn('Failed to renew session leases', {
                nodeId: this.nodeId,
                error: error instanceof Error ? error.message : String(error),
            });
            return;
        }
        if (this.lossDetectionSuspended > 0)
            return;
        const lost = held.filter(id => !kept.has(id));
        if (lost.length === 0)
            return;
        for (const id of lost)
            this.owned.delete(id);
        this.logger.warn(`Lost the claim on ${lost.length} session(s); another node now holds them`, {
            nodeId: this.nodeId,
            sessionIds: lost,
        });
        try {
            await this.onLeaseLost?.(lost);
        }
        catch (error) {
            this.logger.error('Failed to release engines for lost sessions', error instanceof Error ? error.stack : '', {
                nodeId: this.nodeId,
                sessionIds: lost,
            });
        }
    }
    ownedByOtherLiveNode(session, now = new Date()) {
        if (!session.nodeId || session.nodeId === this.nodeId)
            return false;
        return session.leaseExpiresAt != null && session.leaseExpiresAt > now;
    }
    async lapsedHeldByOthers(now = new Date()) {
        return this.sessions
            .createQueryBuilder('session')
            .where('"nodeId" IS NOT NULL AND "nodeId" <> :me', { me: this.nodeId })
            .andWhere('"leaseExpiresAt" < :now', { now: leaseParam(now) })
            .getMany();
    }
    async isHeldByOtherNode(sessionId, now = new Date()) {
        const count = await this.sessions
            .createQueryBuilder('session')
            .where('id = :id', { id: sessionId })
            .andWhere('"nodeId" IS NOT NULL AND "nodeId" <> :me', { me: this.nodeId })
            .andWhere('"leaseExpiresAt" > :now', { now: leaseParam(now) })
            .getCount();
        return count > 0;
    }
    async heldByOtherNodes(now = new Date()) {
        const rows = await this.sessions
            .createQueryBuilder('session')
            .select('session.id', 'id')
            .where('"nodeId" IS NOT NULL AND "nodeId" <> :me', { me: this.nodeId })
            .andWhere('"leaseExpiresAt" > :now', { now: leaseParam(now) })
            .getRawMany();
        return rows.map(row => row.id);
    }
    ownedIds() {
        return [...this.owned];
    }
    owns(sessionId) {
        return this.owned.has(sessionId);
    }
};
exports.SessionOwnershipService = SessionOwnershipService;
exports.SessionOwnershipService = SessionOwnershipService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(session_entity_1.Session, 'data')),
    __param(1, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        config_1.ConfigService])
], SessionOwnershipService);
const nodeOwnsSession = (ownership, sessionId) => !ownership || ownership.owns(sessionId);
exports.nodeOwnsSession = nodeOwnsSession;
//# sourceMappingURL=session-ownership.service.js.map