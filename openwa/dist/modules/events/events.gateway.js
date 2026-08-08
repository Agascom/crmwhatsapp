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
var EventsGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventsGateway = void 0;
exports.isSessionSubscriptionAllowed = isSessionSubscriptionAllowed;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth/auth.service");
const audit_service_1 = require("../audit/audit.service");
const audit_log_entity_1 = require("../audit/entities/audit-log.entity");
const bootstrap_security_1 = require("../../config/bootstrap-security");
const ip_1 = require("../../common/utils/ip");
const ws_rate_limit_1 = require("./ws-rate-limit");
function resolveWsCorsOrigin() {
    const policy = (0, bootstrap_security_1.resolveCorsPolicy)(process.env.CORS_ORIGINS, process.env.NODE_ENV);
    return policy.allowAnyOrigin ? true : policy.origins;
}
function readTrustedProxies() {
    return (process.env.TRUSTED_PROXIES ?? '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
}
const ws_messages_dto_1 = require("./dto/ws-messages.dto");
function isSessionSubscriptionAllowed(allowedSessions, sessionId) {
    if (!allowedSessions || allowedSessions.length === 0) {
        return true;
    }
    if (sessionId === '*') {
        return false;
    }
    return allowedSessions.includes(sessionId);
}
const EVICTION_MESSAGES = {
    revoked: 'API key has been revoked',
    deleted: 'API key has been deleted',
    authorization_changed: 'API key authorization changed; please reconnect',
    expired: 'API key has expired',
};
let EventsGateway = class EventsGateway {
    static { EventsGateway_1 = this; }
    authService;
    auditService;
    server;
    logger = new common_1.Logger('EventsGateway');
    socketsByKeyId = new Map();
    expirySweepTimer;
    rateLimits;
    frameLimiter;
    handshakeLimiter;
    violations = new Map();
    static VIOLATION_AUDIT_WINDOW_MS = 60_000;
    static MAX_VIOLATION_KEYS = 10_000;
    constructor(authService, auditService) {
        this.authService = authService;
        this.auditService = auditService;
        this.rateLimits = (0, ws_rate_limit_1.readWsRateLimitConfig)();
        this.frameLimiter = new ws_rate_limit_1.TokenBucketLimiter(this.rateLimits.framePerSecond, this.rateLimits.frameBurst);
        this.handshakeLimiter = new ws_rate_limit_1.SlidingWindowLimiter(this.rateLimits.handshakeMax, this.rateLimits.handshakeWindowMs);
    }
    afterInit() {
        this.logger.log('WebSocket Gateway initialized');
        this.expirySweepTimer = setInterval(() => {
            try {
                this.sweepExpiredApiKeys();
            }
            catch (error) {
                this.logger.error('Failed to sweep expired WebSocket API keys', error instanceof Error ? error.stack : error);
            }
        }, 60_000);
        this.expirySweepTimer.unref?.();
    }
    onModuleDestroy() {
        if (this.expirySweepTimer)
            clearInterval(this.expirySweepTimer);
        this.expirySweepTimer = undefined;
    }
    sweepExpiredApiKeys(now = Date.now()) {
        for (const [keyId, sockets] of Array.from(this.socketsByKeyId.entries())) {
            const expired = Array.from(sockets).some(client => {
                const expiresAt = client.data?.apiKey?.expiresAt;
                if (!expiresAt)
                    return false;
                const expiry = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();
                return Number.isFinite(expiry) && expiry <= now;
            });
            if (expired)
                this.evictApiKey(keyId, 'expired');
        }
    }
    resolveClientIp(client) {
        const handshake = client.handshake;
        const req = {
            ip: handshake.address,
            socket: { remoteAddress: handshake.address },
            headers: handshake.headers ?? {},
        };
        return (0, ip_1.resolveClientIp)(req, readTrustedProxies());
    }
    trackSocket(keyId, client) {
        let sockets = this.socketsByKeyId.get(keyId);
        if (!sockets) {
            sockets = new Set();
            this.socketsByKeyId.set(keyId, sockets);
        }
        sockets.add(client);
    }
    untrackSocket(client) {
        const keyId = client.data?.apiKey?.id;
        if (!keyId)
            return;
        const sockets = this.socketsByKeyId.get(keyId);
        if (!sockets)
            return;
        sockets.delete(client);
        if (sockets.size === 0) {
            this.socketsByKeyId.delete(keyId);
        }
    }
    evictApiKey(keyId, reason = 'revoked') {
        const sockets = this.socketsByKeyId.get(keyId);
        if (!sockets || sockets.size === 0)
            return;
        this.logger.log(`Evicting ${sockets.size} WebSocket connection(s) (${reason}) for key ${keyId}`);
        this.socketsByKeyId.delete(keyId);
        const message = EVICTION_MESSAGES[reason];
        for (const client of sockets) {
            client.emit('message', this.createError('UNAUTHORIZED', message));
            client.disconnect(true);
        }
    }
    async handleConnection(client) {
        const clientIp = this.resolveClientIp(client);
        if (!this.handshakeLimiter.allow(clientIp)) {
            this.logger.warn(`Client ${client.id} rejected: handshake rate limit exceeded (ip: ${clientIp})`);
            this.noteRateLimitViolation('handshake', { ipAddress: clientIp });
            client.emit('message', this.createError('RATE_LIMITED', 'Too many connection attempts, retry later'));
            client.disconnect();
            return;
        }
        const handshakeAuth = client.handshake.auth;
        const apiKey = handshakeAuth?.apiKey || client.handshake.headers['x-api-key'];
        if (!apiKey) {
            this.logger.warn(`Client ${client.id} rejected: No API key provided`);
            void this.auditService.logWarn(audit_log_entity_1.AuditAction.API_KEY_AUTH_FAILED, {
                ipAddress: clientIp,
                metadata: { surface: 'websocket' },
                errorMessage: 'missing API key',
            });
            client.emit('message', this.createError('UNAUTHORIZED', 'API key required'));
            client.disconnect();
            return;
        }
        try {
            const validKey = await this.authService.validateApiKey(apiKey, clientIp);
            const existing = this.socketsByKeyId.get(validKey.id);
            if (existing && existing.size >= this.rateLimits.maxSocketsPerKey) {
                this.logger.warn(`Client ${client.id} rejected: socket cap reached for key ${validKey.id} (${this.rateLimits.maxSocketsPerKey})`);
                this.noteRateLimitViolation('sockets', { apiKeyId: validKey.id, ipAddress: clientIp });
                client.emit('message', this.createError('RATE_LIMITED', `Too many concurrent connections for this API key (max ${this.rateLimits.maxSocketsPerKey})`));
                client.disconnect();
                return;
            }
            client.data.apiKey = validKey;
            client.data.rawApiKey = apiKey;
            this.trackSocket(validKey.id, client);
            this.handshakeLimiter.refund(clientIp);
            this.logger.log(`Client connected: ${client.id} (key: ${validKey.name})`);
        }
        catch (error) {
            this.logger.warn(`Client ${client.id} rejected: Auth error`, {
                error: error instanceof Error ? error.message : String(error),
            });
            void this.auditService.logWarn(audit_log_entity_1.AuditAction.API_KEY_AUTH_FAILED, {
                ipAddress: clientIp,
                metadata: { surface: 'websocket' },
                errorMessage: error instanceof Error ? error.message : String(error),
            });
            client.emit('message', this.createError('UNAUTHORIZED', 'Authentication failed'));
            client.disconnect();
        }
    }
    handleDisconnect(client) {
        this.untrackSocket(client);
        this.logger.log(`Client disconnected: ${client.id}`);
    }
    handleMessage(client, message) {
        const frameSubject = client.data?.apiKey?.id ?? this.resolveClientIp(client);
        if (!this.frameLimiter.allow(frameSubject)) {
            const requestId = message?.requestId;
            this.noteRateLimitViolation('frame', {
                apiKeyId: client.data?.apiKey?.id,
                ipAddress: this.resolveClientIp(client),
            });
            const error = this.createError('RATE_LIMITED', 'Frame rate limit exceeded, slow down', requestId);
            client.emit('message', error);
            return error;
        }
        switch (message.type) {
            case 'subscribe':
                return this.handleSubscribe(client, message);
            case 'unsubscribe':
                return this.handleUnsubscribe(client, message);
            case 'ping':
                return this.handlePing(client, message.requestId);
            default:
                return this.createError('INVALID_MESSAGE', `Unknown message type`, message.requestId);
        }
    }
    async handleSubscribe(client, message) {
        const { sessionId, events, requestId } = message;
        if (!sessionId || typeof sessionId !== 'string') {
            return this.createError('INVALID_SESSION', 'sessionId is required', requestId);
        }
        const rawApiKey = client.data.rawApiKey;
        const clientIp = this.resolveClientIp(client);
        let subscriberKey;
        try {
            subscriberKey = rawApiKey ? await this.authService.validateApiKey(rawApiKey, clientIp) : null;
        }
        catch {
            subscriberKey = null;
        }
        if (!subscriberKey) {
            client.emit('message', this.createError('UNAUTHORIZED', 'API key is no longer valid', requestId));
            client.disconnect();
            return this.createError('UNAUTHORIZED', 'API key is no longer valid', requestId);
        }
        if (!isSessionSubscriptionAllowed(subscriberKey.allowedSessions, sessionId)) {
            return this.createError('FORBIDDEN_SESSION', 'API key is not authorized for this session', requestId);
        }
        if (!events || !Array.isArray(events) || events.length === 0) {
            return this.createError('INVALID_EVENTS', 'events array is required', requestId);
        }
        const validEvents = events.filter(e => e === '*' || ws_messages_dto_1.SUBSCRIBABLE_EVENTS.includes(e));
        if (validEvents.length === 0) {
            return this.createError('INVALID_EVENTS', `No valid events. Valid: ${ws_messages_dto_1.SUBSCRIBABLE_EVENTS.join(', ')}, *`, requestId);
        }
        const rooms = [];
        for (const event of validEvents) {
            const room = (0, ws_messages_dto_1.buildRoomName)(sessionId, event);
            void client.join(room);
            rooms.push(room);
        }
        this.logger.debug(`Client ${client.id} subscribed to: ${rooms.join(', ')}`);
        return {
            type: 'subscribed',
            sessionId,
            events: validEvents,
            requestId,
            timestamp: new Date().toISOString(),
        };
    }
    handleUnsubscribe(client, message) {
        const { sessionId, requestId } = message;
        const clientRooms = Array.from(client.rooms);
        const sessionPrefix = `session:${sessionId}:`;
        for (const room of clientRooms) {
            if (room.startsWith(sessionPrefix) || (sessionId === '*' && room.startsWith('session:'))) {
                void client.leave(room);
            }
        }
        this.logger.debug(`Client ${client.id} unsubscribed from session: ${sessionId}`);
        return {
            type: 'unsubscribed',
            sessionId,
            requestId,
            timestamp: new Date().toISOString(),
        };
    }
    handlePing(_client, requestId) {
        return {
            type: 'pong',
            requestId,
            timestamp: new Date().toISOString(),
        };
    }
    createError(code, message, requestId) {
        return {
            type: 'error',
            code,
            message,
            requestId,
            timestamp: new Date().toISOString(),
        };
    }
    noteRateLimitViolation(kind, subject) {
        const mapKey = `${kind}:${subject.apiKeyId ?? subject.ipAddress ?? 'unknown'}`;
        const now = Date.now();
        const prior = this.violations.get(mapKey);
        if (prior && now - prior.since < EventsGateway_1.VIOLATION_AUDIT_WINDOW_MS) {
            prior.count += 1;
            return;
        }
        const suppressed = prior?.count ?? 0;
        this.violations.delete(mapKey);
        this.violations.set(mapKey, { count: 0, since: now });
        while (this.violations.size > EventsGateway_1.MAX_VIOLATION_KEYS) {
            const oldest = this.violations.keys().next().value;
            if (oldest === undefined)
                break;
            this.violations.delete(oldest);
        }
        void this.auditService.logWarn(audit_log_entity_1.AuditAction.RATE_LIMIT_EXCEEDED, {
            apiKey: subject.apiKeyId ? { id: subject.apiKeyId } : undefined,
            ipAddress: subject.ipAddress,
            metadata: { surface: 'websocket', kind, suppressed },
            errorMessage: `websocket ${kind} rate limit exceeded`,
        });
    }
    emitToRooms(sessionId, event, data) {
        const eventMessage = {
            type: 'event',
            payload: { event, sessionId, data },
            timestamp: new Date().toISOString(),
        };
        this.server
            .to((0, ws_messages_dto_1.buildRoomName)(sessionId, event))
            .to((0, ws_messages_dto_1.buildRoomName)(sessionId, '*'))
            .to((0, ws_messages_dto_1.buildRoomName)('*', event))
            .to((0, ws_messages_dto_1.buildRoomName)('*', '*'))
            .emit('message', eventMessage);
    }
    emitSessionStatus(sessionId, status, data) {
        this.emitToRooms(sessionId, 'session.status', { status, ...data });
    }
    emitSessionAuthenticated(sessionId, data) {
        this.emitToRooms(sessionId, 'session.authenticated', data);
    }
    emitSessionDisconnected(sessionId, data) {
        this.emitToRooms(sessionId, 'session.disconnected', data);
    }
    emitSessionRestriction(sessionId, data) {
        this.emitToRooms(sessionId, 'session.restriction', data);
    }
    emitCallAccepted(sessionId, data) {
        this.emitToRooms(sessionId, 'call.accepted', data);
    }
    emitCallRejected(sessionId, data) {
        this.emitToRooms(sessionId, 'call.rejected', data);
    }
    emitCallMissed(sessionId, data) {
        this.emitToRooms(sessionId, 'call.missed', data);
    }
    emitPresenceUpdate(sessionId, data) {
        this.emitToRooms(sessionId, 'presence.update', data);
    }
    emitQRCode(sessionId, qrCode) {
        this.emitToRooms(sessionId, 'session.qr', { qrCode });
    }
    emitMessage(sessionId, message) {
        this.emitToRooms(sessionId, 'message.received', message);
    }
    emitMessageSent(sessionId, message) {
        this.emitToRooms(sessionId, 'message.sent', message);
    }
    emitMessageAck(sessionId, data) {
        this.emitToRooms(sessionId, 'message.ack', data);
    }
    emitMessageRevoked(sessionId, message) {
        this.emitToRooms(sessionId, 'message.revoked', message);
    }
    emitMessageReaction(sessionId, data) {
        this.emitToRooms(sessionId, 'message.reaction', data);
    }
    emitMessageEdited(sessionId, data) {
        this.emitToRooms(sessionId, 'message.edited', data);
    }
    emitGroupJoin(sessionId, data) {
        this.emitToRooms(sessionId, 'group.join', data);
    }
    emitGroupLeave(sessionId, data) {
        this.emitToRooms(sessionId, 'group.leave', data);
    }
    emitGroupUpdate(sessionId, data) {
        this.emitToRooms(sessionId, 'group.update', data);
    }
    emitCallReceived(sessionId, data) {
        this.emitToRooms(sessionId, 'call.received', data);
    }
    emitStatusReceived(sessionId, data) {
        this.emitToRooms(sessionId, 'status.received', data);
    }
};
exports.EventsGateway = EventsGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], EventsGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('message'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], EventsGateway.prototype, "handleMessage", null);
exports.EventsGateway = EventsGateway = EventsGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: resolveWsCorsOrigin(),
        },
        namespace: '/events',
    }),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        audit_service_1.AuditService])
], EventsGateway);
//# sourceMappingURL=events.gateway.js.map