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
exports.SendPacingService = exports.SEND_PACING_LIMITED = void 0;
exports.isPacingLimitedError = isPacingLimitedError;
exports.countsTowardSendBreaker = countsTowardSendBreaker;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const message_entity_1 = require("./entities/message.entity");
const session_entity_1 = require("../session/entities/session.entity");
const send_pacing_config_1 = require("./send-pacing.config");
const send_pacing_metrics_1 = require("../../common/metrics/send-pacing-metrics");
const logger_service_1 = require("../../common/services/logger.service");
const engine_refused_error_1 = require("../../common/errors/engine-refused.error");
const ssrf_guard_1 = require("../../common/security/ssrf-guard");
const audit_service_1 = require("../audit/audit.service");
const audit_log_entity_1 = require("../audit/entities/audit-log.entity");
exports.SEND_PACING_LIMITED = 'SEND_PACING_LIMITED';
function isPacingLimitedError(error) {
    if (!(error instanceof common_1.HttpException))
        return false;
    const body = error.getResponse();
    return typeof body === 'object' && body !== null && body.code === exports.SEND_PACING_LIMITED;
}
function countsTowardSendBreaker(error) {
    if (error instanceof engine_refused_error_1.EngineRefusedError)
        return true;
    if (error instanceof ssrf_guard_1.SsrfBlockedError)
        return false;
    if (error instanceof common_1.HttpException) {
        const status = error.getStatus();
        const NOT_IMPLEMENTED = common_1.HttpStatus.NOT_IMPLEMENTED;
        const SERVICE_UNAVAILABLE = common_1.HttpStatus.SERVICE_UNAVAILABLE;
        return !((status >= 400 && status < 500) || status === NOT_IMPLEMENTED || status === SERVICE_UNAVAILABLE);
    }
    return true;
}
const REFUSAL_AUDIT_WINDOW_MS = 60_000;
const MAX_REFUSAL_KEYS = 1000;
let SendPacingService = class SendPacingService {
    messageRepository;
    sessionRepository;
    configService;
    auditService;
    logger = (0, logger_service_1.createLogger)('SendPacingService');
    breakers = new Map();
    groupReachoutTally = new Map();
    refusalSamples = new Map();
    constructor(messageRepository, sessionRepository, configService, auditService) {
        this.messageRepository = messageRepository;
        this.sessionRepository = sessionRepository;
        this.configService = configService;
        this.auditService = auditService;
    }
    async assertSendAllowed(sessionId, chatId) {
        const config = (0, send_pacing_config_1.resolveSendPacingConfig)(this.configService);
        if (!config.enabled)
            return;
        this.assertBreakerClosed(sessionId, config);
        await this.assertUnderDailyCap(sessionId, config);
        await this.assertUnderColdCap(sessionId, chatId, config);
    }
    async assertReachoutAllowed(sessionId, contactIds) {
        const config = (0, send_pacing_config_1.resolveSendPacingConfig)(this.configService);
        if (!config.enabled)
            return;
        this.assertBreakerClosed(sessionId, config);
        if (config.coldSchedule.length === 0 || contactIds.length === 0)
            return;
        const unique = [...new Set(contactIds)];
        const variantsByContact = new Map(unique.map(id => [id, dialectVariants(id)]));
        const knownRows = await this.messageRepository
            .createQueryBuilder('m')
            .select('DISTINCT m.chatId', 'chatId')
            .where('m.sessionId = :sessionId', { sessionId })
            .andWhere('m.chatId IN (:...ids)', { ids: [...new Set([...variantsByContact.values()].flat())] })
            .getRawMany();
        const knownIds = new Set(knownRows.map(row => row.chatId));
        const coldCount = unique.filter(id => !variantsByContact.get(id).some(v => knownIds.has(v))).length;
        if (coldCount === 0)
            return;
        const session = await this.sessionRepository.findOne({ where: { id: sessionId } });
        if (!session)
            return;
        const dayStart = startOfUtcDay(new Date());
        const ageDays = Math.floor((dayStart.getTime() - startOfUtcDay(session.createdAt).getTime()) / DAY_MS);
        const allowance = this.allowanceForAge(config.coldSchedule, ageDays);
        const usedToday = (await this.countColdReachoutsToday(sessionId, dayStart)) + this.groupReachoutsToday(sessionId, dayStart);
        if (usedToday + coldCount <= allowance) {
            this.addGroupReachouts(sessionId, dayStart, coldCount);
            return;
        }
        this.refuse('cold_daily_cap', sessionId, secondsUntilNextUtcDay(), {
            reason: `Reaching ${coldCount} new contact(s) would exceed the daily allowance of ${allowance} ` +
                `new conversation(s) for a session ${ageDays} day(s) old (${usedToday} already used)`,
            allowance,
            coldToday: usedToday,
            coldCount,
        });
    }
    groupReachoutsToday(sessionId, dayStart) {
        const tally = this.groupReachoutTally.get(sessionId);
        return tally && tally.dayStartMs === dayStart.getTime() ? tally.count : 0;
    }
    addGroupReachouts(sessionId, dayStart, n) {
        const dayStartMs = dayStart.getTime();
        const tally = this.groupReachoutTally.get(sessionId);
        if (tally && tally.dayStartMs === dayStartMs)
            tally.count += n;
        else
            this.groupReachoutTally.set(sessionId, { dayStartMs, count: n });
    }
    recordSendFailure(sessionId) {
        const config = (0, send_pacing_config_1.resolveSendPacingConfig)(this.configService);
        if (!config.enabled)
            return;
        const breaker = this.breakerFor(sessionId);
        breaker.consecutiveFailures += 1;
        if (breaker.openedAt === null && breaker.consecutiveFailures >= config.breakerThreshold) {
            breaker.openedAt = Date.now();
            this.logger.warn(`Send breaker tripped after ${breaker.consecutiveFailures} consecutive failures`, {
                sessionId,
                consecutiveFailures: breaker.consecutiveFailures,
                cooldownMs: config.breakerCooldownMs,
                action: 'send_breaker_tripped',
            });
            void this.auditService?.logWarn(audit_log_entity_1.AuditAction.SEND_BREAKER_TRIPPED, {
                sessionId,
                metadata: { consecutiveFailures: breaker.consecutiveFailures, cooldownMs: config.breakerCooldownMs },
                errorMessage: `Send breaker tripped after ${breaker.consecutiveFailures} consecutive send failures`,
            });
        }
    }
    recordSendSuccess(sessionId) {
        const config = (0, send_pacing_config_1.resolveSendPacingConfig)(this.configService);
        if (!config.enabled)
            return;
        const breaker = this.breakers.get(sessionId);
        if (!breaker)
            return;
        this.breakers.delete(sessionId);
    }
    allowanceForAge(schedule, ageDays) {
        const index = Math.min(Math.max(ageDays, 0), schedule.length - 1);
        return schedule[index];
    }
    breakerFor(sessionId) {
        const existing = this.breakers.get(sessionId);
        if (existing)
            return existing;
        const created = { consecutiveFailures: 0, openedAt: null };
        this.breakers.set(sessionId, created);
        return created;
    }
    assertBreakerClosed(sessionId, config) {
        const breaker = this.breakers.get(sessionId);
        if (!breaker?.openedAt)
            return;
        const elapsed = Date.now() - breaker.openedAt;
        if (elapsed >= config.breakerCooldownMs) {
            this.breakers.delete(sessionId);
            return;
        }
        this.refuse('breaker_open', sessionId, Math.ceil((config.breakerCooldownMs - elapsed) / 1000), {
            reason: 'Sends are paused after a run of consecutive send failures',
        });
    }
    async assertUnderDailyCap(sessionId, config) {
        const session = await this.sessionRepository.findOne({ where: { id: sessionId } });
        if (!session)
            return;
        const dayStart = startOfUtcDay(new Date());
        const ageDays = Math.floor((dayStart.getTime() - startOfUtcDay(session.createdAt).getTime()) / DAY_MS);
        const allowance = this.allowanceForAge(config.warmupSchedule, ageDays);
        const sentToday = await this.messageRepository.count({
            where: { sessionId, direction: message_entity_1.MessageDirection.OUTGOING, createdAt: (0, typeorm_2.MoreThanOrEqual)(dayStart) },
        });
        if (sentToday < allowance)
            return;
        this.refuse('daily_cap', sessionId, secondsUntilNextUtcDay(), {
            reason: `Daily send allowance of ${allowance} reached for a session ${ageDays} day(s) old`,
            allowance,
            sentToday,
        });
    }
    auditRefusal(sessionId, rule, retryAfterSeconds, message) {
        const now = Date.now();
        const prior = this.refusalSamples.get(sessionId);
        if (prior && now - prior.since < REFUSAL_AUDIT_WINDOW_MS) {
            prior.count += 1;
            return;
        }
        const suppressed = prior?.count ?? 0;
        this.refusalSamples.delete(sessionId);
        this.refusalSamples.set(sessionId, { count: 0, since: now });
        while (this.refusalSamples.size > MAX_REFUSAL_KEYS) {
            const oldest = this.refusalSamples.keys().next().value;
            if (oldest === undefined)
                break;
            this.refusalSamples.delete(oldest);
        }
        void this.auditService?.logWarn(audit_log_entity_1.AuditAction.SEND_PACING_BLOCKED, {
            sessionId,
            metadata: { rule, retryAfterSeconds, suppressed },
            errorMessage: message,
        });
    }
    async assertUnderColdCap(sessionId, chatId, config) {
        if (!chatId || config.coldSchedule.length === 0)
            return;
        const hasHistory = await this.messageRepository.exists({
            where: dialectVariants(chatId).map(id => ({ sessionId, chatId: id })),
        });
        if (hasHistory)
            return;
        const session = await this.sessionRepository.findOne({ where: { id: sessionId } });
        if (!session)
            return;
        const dayStart = startOfUtcDay(new Date());
        const ageDays = Math.floor((dayStart.getTime() - startOfUtcDay(session.createdAt).getTime()) / DAY_MS);
        const allowance = this.allowanceForAge(config.coldSchedule, ageDays);
        const coldToday = (await this.countColdReachoutsToday(sessionId, dayStart)) + this.groupReachoutsToday(sessionId, dayStart);
        if (coldToday < allowance)
            return;
        this.refuse('cold_daily_cap', sessionId, secondsUntilNextUtcDay(), {
            reason: `Daily allowance of ${allowance} new conversation(s) reached for a session ${ageDays} day(s) old`,
            allowance,
            coldToday,
        });
    }
    countColdReachoutsToday(sessionId, dayStart) {
        return (this.messageRepository
            .createQueryBuilder('m')
            .select(`COUNT(DISTINCT REPLACE(m."chatId", '@s.whatsapp.net', '@c.us'))`, 'count')
            .where('m.sessionId = :sessionId', { sessionId })
            .andWhere('m.direction = :direction', { direction: message_entity_1.MessageDirection.OUTGOING })
            .andWhere('m.createdAt >= :dayStart', { dayStart })
            .andWhere(`NOT EXISTS (SELECT 1 FROM "messages" p WHERE p."sessionId" = :sessionId AND p."chatId" IN (${DIALECT_PAIR('m')}) AND p."createdAt" < :dayStart)`)
            .andWhere(`NOT EXISTS (SELECT 1 FROM "messages" i WHERE i."sessionId" = :sessionId AND i."chatId" IN (${DIALECT_PAIR('m')}) AND i."direction" = :incoming AND i."createdAt" < (SELECT MIN(o."createdAt") FROM "messages" o WHERE o."sessionId" = :sessionId AND o."chatId" IN (${DIALECT_PAIR('m')}) AND o."direction" = :direction AND o."createdAt" >= :dayStart))`, { incoming: message_entity_1.MessageDirection.INCOMING })
            .getRawOne()
            .then(row => Number(row?.count ?? 0)));
    }
    refuse(reason, sessionId, retryAfterSeconds, detail) {
        (0, send_pacing_metrics_1.incrementSendPacingRefusals)(reason);
        this.logger.warn(`Send refused by the pacing governor: ${detail.reason}`, {
            ...detail,
            sessionId,
            rule: reason,
            retryAfterSeconds,
            action: 'send_paced',
        });
        this.auditRefusal(sessionId, reason, retryAfterSeconds, detail.reason);
        throw new common_1.HttpException({
            statusCode: common_1.HttpStatus.TOO_MANY_REQUESTS,
            error: 'Too Many Requests',
            message: detail.reason,
            code: exports.SEND_PACING_LIMITED,
            retryAfterSeconds,
        }, common_1.HttpStatus.TOO_MANY_REQUESTS);
    }
};
exports.SendPacingService = SendPacingService;
exports.SendPacingService = SendPacingService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(message_entity_1.Message, 'data')),
    __param(1, (0, typeorm_1.InjectRepository)(session_entity_1.Session, 'data')),
    __param(2, (0, common_1.Optional)()),
    __param(3, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        config_1.ConfigService,
        audit_service_1.AuditService])
], SendPacingService);
const DAY_MS = 86_400_000;
const DIALECT_PAIR = (alias) => `REPLACE(${alias}."chatId", '@s.whatsapp.net', '@c.us'), REPLACE(${alias}."chatId", '@c.us', '@s.whatsapp.net')`;
function dialectVariants(chatId) {
    const lower = chatId.toLowerCase();
    if (lower.endsWith('@c.us')) {
        return [chatId, chatId.slice(0, chatId.length - '@c.us'.length) + '@s.whatsapp.net'];
    }
    if (lower.endsWith('@s.whatsapp.net')) {
        return [chatId, chatId.slice(0, chatId.length - '@s.whatsapp.net'.length) + '@c.us'];
    }
    if (/^\d{5,}$/.test(chatId.trim())) {
        const digits = chatId.trim();
        return [digits, `${digits}@c.us`, `${digits}@s.whatsapp.net`];
    }
    return [chatId];
}
function startOfUtcDay(at) {
    return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
}
function secondsUntilNextUtcDay() {
    const now = Date.now();
    return Math.max(1, Math.ceil((startOfUtcDay(new Date(now)).getTime() + DAY_MS - now) / 1000));
}
//# sourceMappingURL=send-pacing.service.js.map