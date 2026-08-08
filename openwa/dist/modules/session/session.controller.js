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
exports.SessionController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const session_service_1 = require("./session.service");
const dto_1 = require("./dto");
const audit_service_1 = require("../audit/audit.service");
const audit_log_entity_1 = require("../audit/entities/audit-log.entity");
const auth_decorators_1 = require("../auth/decorators/auth.decorators");
const api_key_entity_1 = require("../auth/entities/api-key.entity");
let SessionController = class SessionController {
    sessionService;
    auditService;
    constructor(sessionService, auditService) {
        this.sessionService = sessionService;
        this.auditService = auditService;
    }
    transformSession(session) {
        return dto_1.SessionResponseDto.fromEntity(session, this.sessionService.isActive(session.id));
    }
    async create(dto) {
        const session = await this.sessionService.create(dto);
        await this.auditService.logInfo(audit_log_entity_1.AuditAction.SESSION_CREATED, {
            sessionId: session.id,
            sessionName: session.name,
        });
        return this.transformSession(session);
    }
    async findAll(apiKey, limit, offset) {
        const sessions = await this.sessionService.findAll(apiKey?.allowedSessions, {
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
        });
        return sessions.map(s => this.transformSession(s));
    }
    async findOne(id) {
        const session = await this.sessionService.findOne(id);
        return this.transformSession(session);
    }
    async getConfig(id) {
        return this.sessionService.getConfig(id);
    }
    async updateConfig(id, dto) {
        const config = await this.sessionService.updateConfig(id, dto);
        await this.auditService.logInfo(audit_log_entity_1.AuditAction.SESSION_CONFIG_UPDATED, {
            sessionId: id,
            metadata: { ...config },
        });
        return config;
    }
    async delete(id) {
        const session = await this.sessionService.findOne(id);
        await this.sessionService.delete(id);
        await this.auditService.logInfo(audit_log_entity_1.AuditAction.SESSION_DELETED, {
            sessionId: id,
            sessionName: session.name,
        });
    }
    async start(id) {
        const session = await this.sessionService.start(id);
        await this.auditService.logInfo(audit_log_entity_1.AuditAction.SESSION_STARTED, {
            sessionId: session.id,
            sessionName: session.name,
        });
        return this.transformSession(session);
    }
    async stop(id) {
        const session = await this.sessionService.stop(id);
        await this.auditService.logInfo(audit_log_entity_1.AuditAction.SESSION_STOPPED, {
            sessionId: session.id,
            sessionName: session.name,
        });
        return this.transformSession(session);
    }
    async logout(id) {
        const session = await this.sessionService.logout(id);
        await this.auditService.logInfo(audit_log_entity_1.AuditAction.SESSION_LOGGED_OUT, {
            sessionId: session.id,
            sessionName: session.name,
        });
        return this.transformSession(session);
    }
    async forceKill(id) {
        const session = await this.sessionService.forceKill(id);
        await this.auditService.logInfo(audit_log_entity_1.AuditAction.SESSION_FORCE_KILLED, {
            sessionId: session.id,
            sessionName: session.name,
        });
        return this.transformSession(session);
    }
    async getQRCode(id) {
        const qrCode = await this.sessionService.getQRCode(id);
        await this.auditService.logInfo(audit_log_entity_1.AuditAction.SESSION_QR_GENERATED, {
            sessionId: id,
        });
        return qrCode;
    }
    async requestPairingCode(id, dto) {
        return this.sessionService.requestPairingCode(id, dto.phoneNumber);
    }
    async getGroups(id, limit, offset) {
        return this.sessionService.getGroups(id, {
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
        });
    }
    async getChats(id, limit, offset) {
        return this.sessionService.getChats(id, {
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
        });
    }
    async markChatRead(id, dto) {
        const success = await this.sessionService.sendSeen(id, dto.chatId);
        return { success };
    }
    async subscribeToPresence(id, dto) {
        await this.sessionService.subscribeToPresence(id, dto.chatId);
        return { success: true };
    }
    async getPresence(id, chatId) {
        const presence = await this.sessionService.getPresence(id, chatId);
        return presence ? { ...presence, observedAt: new Date(presence.observedAt) } : null;
    }
    async markChatUnread(id, dto) {
        const success = await this.sessionService.markUnread(id, dto.chatId);
        return { success };
    }
    async clearChatMessages(id, chatId) {
        const success = await this.sessionService.clearChatMessages(id, chatId);
        return { success };
    }
    async archiveChat(id, dto) {
        const success = await this.sessionService.archiveChat(id, dto.chatId, dto.archive);
        return { success };
    }
    async deleteChat(id, dto) {
        const success = await this.sessionService.deleteChat(id, dto.chatId);
        return { success };
    }
    async sendChatState(id, dto) {
        await this.sessionService.sendChatState(id, dto.chatId, dto.state);
        return { success: true };
    }
    async getStats(apiKey) {
        return this.sessionService.getStats(apiKey?.allowedSessions);
    }
};
exports.SessionController = SessionController;
__decorate([
    (0, common_1.Post)(),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, auth_decorators_1.RequireUnscopedKey)(),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new WhatsApp session' }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'Session created',
        type: dto_1.SessionResponseDto,
    }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Session name already exists' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.CreateSessionDto]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'List all sessions' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'List of sessions',
        type: [dto_1.SessionResponseDto],
    }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, description: 'Max sessions to return (1-1000, default 1000)' }),
    (0, swagger_1.ApiQuery)({ name: 'offset', required: false, description: 'Number of sessions to skip (for paging)' }),
    __param(0, (0, auth_decorators_1.CurrentApiKey)()),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [api_key_entity_1.ApiKey, String, String]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get session by ID' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Session details',
        type: dto_1.SessionResponseDto,
    }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Session not found' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)(':id/config'),
    (0, swagger_1.ApiOperation)({ summary: 'Get the tunable configuration for a session' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Effective session configuration',
        type: dto_1.SessionConfigResponseDto,
    }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Session not found' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "getConfig", null);
__decorate([
    (0, common_1.Patch)(':id/config'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({
        summary: 'Update the tunable configuration for a session',
        description: 'Merges the supplied keys into the session config; omitted keys are left unchanged and an ' +
            'explicit null clears a key back to its default. No restart is required or performed. ' +
            '`autoRejectCalls` is re-read on every incoming call, so it applies immediately; the two ' +
            'reconnect settings are read once per start and therefore apply on the next start.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Updated session configuration',
        type: dto_1.SessionConfigResponseDto,
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'A supplied value is outside its accepted range' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Session not found' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.UpdateSessionConfigDto]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "updateConfig", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a session' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({ status: 204, description: 'Session deleted' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Session not found' }),
    (0, swagger_1.ApiResponse)({
        status: 409,
        description: 'A credential teardown for the same session name is still in flight (retryable — the body ' +
            "carries `code: 'SESSION_NAME_TEARDOWN_PENDING'`; wait for it to settle and retry), OR " +
            "another node currently holds this session's live engine and deleting it here would strip a " +
            'session the owner is running. No destructive side effect runs before either refusal.',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "delete", null);
__decorate([
    (0, common_1.Post)(':id/start'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Start a session and initialize WhatsApp connection',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Session started',
        type: dto_1.SessionResponseDto,
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Session already started' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Session not found' }),
    (0, swagger_1.ApiResponse)({
        status: 409,
        description: 'A credential teardown for the same session name is still in flight (e.g. a prior logout ' +
            'that owns destructive cleanup). Retryable — the body carries `code: ' +
            'SESSION_NAME_TEARDOWN_PENDING`; wait for it to settle and retry. No destructive side ' +
            'effect runs before this refusal. Also returned when another node currently holds this ' +
            "session's engine: only the owner may start it, and the claim is refused before any engine " +
            'is launched, so no second connection to the account is opened.',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "start", null);
__decorate([
    (0, common_1.Post)(':id/stop'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Stop a session and disconnect WhatsApp' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Session stopped',
        type: dto_1.SessionResponseDto,
    }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Session not found' }),
    (0, swagger_1.ApiResponse)({
        status: 409,
        description: "Another node currently holds this session's live engine (multi-node deployments): stopping " +
            'it here would report the session down while the owner keeps running it, so the request is ' +
            'refused. Retry against the owning node, or once its lease has lapsed.',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "stop", null);
__decorate([
    (0, common_1.Post)(':id/logout'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Log out of WhatsApp (unlinks this device) and stop the session',
        description: 'Attempts an engine-native unlink of this companion device, then tears the session down ' +
            'locally. `200` means the engine-native unlink operation completed AND the required local ' +
            'credential cleanup completed — for Baileys a valid companion identity, an acknowledged ' +
            '`remove-companion-device` IQ response, and removal of the on-disk auth dir; for ' +
            'whatsapp-web.js the native `Client.logout()` promise settled. `200` is NOT an independent ' +
            'observation that the handset UI no longer shows the linked device. Because a completed ' +
            'unlink wipes the stored credentials, reconnecting after a `200` always requires a fresh QR ' +
            'scan or pairing code.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Unlink operation and required local cleanup completed; session is stopped and `phone` is ' +
            'cleared. Recorded in the audit log as `session_logged_out`.',
        content: {
            'application/json': {
                schema: { $ref: '#/components/schemas/SessionResponseDto' },
                example: {
                    id: '8f3c2b1a-9d4e-4c7a-8b2f-1e6d5a4c3b2a',
                    name: 'my-bot',
                    status: 'disconnected',
                    phone: null,
                    pushName: null,
                    connectedAt: null,
                    lastActive: '2026-06-25T09:01:55.000Z',
                    createdAt: '2026-06-20T11:30:00.000Z',
                    updatedAt: '2026-06-25T09:11:00.000Z',
                    lastError: null,
                },
            },
        },
    }),
    (0, swagger_1.ApiResponse)({
        status: 400,
        description: 'Session is not started (no engine to send through); the row is left untouched',
    }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Session not found' }),
    (0, swagger_1.ApiResponse)({
        status: 502,
        description: 'Session was stopped locally, but the logout operation is incomplete (no send, no ' +
            'acknowledgement, timeout/transport error, or local-cleanup failure). Retryable — the ' +
            "body carries `code: 'SESSION_LOGOUT_INCOMPLETE'`; `phone` is cleared and no success audit " +
            'is written. Start the session again and retry the logout.',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "logout", null);
__decorate([
    (0, common_1.Post)(':id/force-kill'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Force-kill a stuck session (SIGKILL its wedged engine, then tear it down)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Session force-killed',
        type: dto_1.SessionResponseDto,
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Session is not started' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Session not found' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "forceKill", null);
__decorate([
    (0, common_1.Get)(':id/qr'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Get QR code for session authentication' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'QR code data',
        type: dto_1.QRCodeResponseDto,
    }),
    (0, swagger_1.ApiResponse)({
        status: 400,
        description: 'QR code not ready or session already authenticated',
    }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Session not found' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "getQRCode", null);
__decorate([
    (0, common_1.Post)(':id/pairing-code'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Request an 8-char pairing code to link via phone number (alternative to QR)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Pairing code generated', type: dto_1.PairingCodeResponseDto }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Session not started or already authenticated' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Session not found' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.RequestPairingCodeDto]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "requestPairingCode", null);
__decorate([
    (0, common_1.Get)(':id/groups'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all groups for a session' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'List of groups the session is a member of',
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Session not ready' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Session not found' }),
    (0, swagger_1.ApiResponse)({
        status: 503,
        description: 'WhatsApp did not answer the group-list query. Deliberately not reported as an empty list — ' +
            'the engine returns the same empty value for "you are in no groups", and a caller cannot tell ' +
            'those apart from the body.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, description: 'Max groups to return (1–1000, default 1000)' }),
    (0, swagger_1.ApiQuery)({ name: 'offset', required: false, description: 'Number of groups to skip (for paging)' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "getGroups", null);
__decorate([
    (0, common_1.Get)(':id/chats'),
    (0, swagger_1.ApiOperation)({ summary: 'Get active chats for a session' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'List of active chats (most recent first)', type: [dto_1.ChatSummaryDto] }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Session not ready' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Session not found' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, description: 'Max chats to return (1–1000, default 1000)' }),
    (0, swagger_1.ApiQuery)({ name: 'offset', required: false, description: 'Number of chats to skip (for paging)' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "getChats", null);
__decorate([
    (0, common_1.Post)(':id/chats/read'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Mark a chat as read/seen' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Chat marked as read successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Session not ready' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Session not found' }),
    (0, swagger_1.ApiResponse)({
        status: 503,
        description: 'WhatsApp did not answer within the request budget. The change may or may not have been applied — ' +
            'the gateway stopped waiting for a confirmation that never came.',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.MarkChatReadDto]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "markChatRead", null);
__decorate([
    (0, common_1.Post)(':id/presence/subscribe'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: "Subscribe to a chat's presence",
        description: 'Asks WhatsApp to start reporting who is online or typing in this chat. Updates arrive as the ' +
            '`presence.update` webhook and socket event — there is no synchronous answer, because presence ' +
            'cannot be queried from either engine, only received.\n\n' +
            'The subscription belongs to the connection: it does **not** survive a restart or an automatic ' +
            'reconnect, and must be re-issued. Subscribe per chat rather than to everything — WhatsApp emits ' +
            'an update on every transition, so a broad subscription is a firehose.\n\n' +
            'whatsapp-web.js cannot do this at all (it exposes no presence subscribe and emits no presence ' +
            'event) and answers `501`.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Subscribed; updates now arrive as presence.update events' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Session not started' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Session not found' }),
    (0, swagger_1.ApiResponse)({ status: 501, description: 'The active engine cannot observe presence (whatsapp-web.js)' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.SubscribePresenceDto]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "subscribeToPresence", null);
__decorate([
    (0, common_1.Get)(':id/presence/:chatId'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.VIEWER),
    (0, swagger_1.ApiOperation)({
        summary: "Read a chat's last reported presence",
        description: 'Serves the most recent report received since the chat was subscribed. Returns `null` when ' +
            'nothing has been reported — either the chat was never subscribed, or nothing has changed ' +
            'since. That is a normal state, not a missing resource, so it is `200` with a null body rather ' +
            'than a `404`.\n\n' +
            'Held in memory and never persisted: presence is short-lived, and answering "typing" from ' +
            'before a restart would be worse than answering nothing.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'chatId', description: 'Chat ID as subscribed' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Last reported presence, or null', type: dto_1.ChatPresenceResponseDto }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Session not found' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Param)('chatId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "getPresence", null);
__decorate([
    (0, common_1.Post)(':id/chats/unread'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Mark a chat as unread' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Chat marked as unread successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Session not ready' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Session not found' }),
    (0, swagger_1.ApiResponse)({
        status: 503,
        description: 'WhatsApp did not answer within the request budget. The change may or may not have been applied — ' +
            'the gateway stopped waiting for a confirmation that never came.',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.MarkChatReadDto]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "markChatUnread", null);
__decorate([
    (0, common_1.Delete)(':id/chats/:chatId/messages'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Delete every message in a chat, keeping the chat itself' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'chatId', description: "Chat JID, e.g. 1234567890-123@g.us (URL-encode the '@')" }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Returns `{ success }`. `false` means the engine declined to act — an unknown chat, or on the ' +
            'Baileys engine a chat with no known history, since the change is keyed to its last message.',
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Session not ready' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Session not found' }),
    (0, swagger_1.ApiResponse)({
        status: 503,
        description: 'WhatsApp did not answer within the request budget. The change may or may not have been applied — ' +
            'the gateway stopped waiting for a confirmation that never came.',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Param)('chatId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "clearChatMessages", null);
__decorate([
    (0, common_1.Post)(':id/chats/archive'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Archive or unarchive a chat' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Returns `{ success }`. `false` means the engine declined to act — on the Baileys engine a ' +
            'chat with no known history cannot be archived, since the change is keyed to its last message.',
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Session not ready' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Session not found' }),
    (0, swagger_1.ApiResponse)({
        status: 503,
        description: 'WhatsApp did not answer within the request budget. The change may or may not have been applied — ' +
            'the gateway stopped waiting for a confirmation that never came.',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.ArchiveChatDto]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "archiveChat", null);
__decorate([
    (0, common_1.Post)(':id/chats/delete'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a chat from the chat list (e.g. a group you have left)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Chat deleted successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Session not ready' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Session not found' }),
    (0, swagger_1.ApiResponse)({
        status: 503,
        description: 'WhatsApp did not answer within the request budget. The change may or may not have been applied — ' +
            'the gateway stopped waiting for a confirmation that never came.',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.DeleteChatDto]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "deleteChat", null);
__decorate([
    (0, common_1.Post)(':id/chats/typing'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: "Send a typing/recording presence indicator to a chat (or clear it with 'paused')" }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Presence sent' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Session not found' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.SendChatStateDto]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "sendChatState", null);
__decorate([
    (0, common_1.Get)('stats/overview'),
    (0, swagger_1.ApiOperation)({
        summary: 'Get session statistics for multi-session monitoring',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Session statistics including counts and memory usage',
    }),
    __param(0, (0, auth_decorators_1.CurrentApiKey)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [api_key_entity_1.ApiKey]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "getStats", null);
exports.SessionController = SessionController = __decorate([
    (0, swagger_1.ApiTags)('sessions'),
    (0, common_1.Controller)('sessions'),
    (0, auth_decorators_1.SessionScoped)(),
    __metadata("design:paramtypes", [session_service_1.SessionService,
        audit_service_1.AuditService])
], SessionController);
//# sourceMappingURL=session.controller.js.map