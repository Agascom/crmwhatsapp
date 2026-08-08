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
exports.ChannelController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const channel_response_dto_1 = require("./dto/channel-response.dto");
const channel_service_1 = require("./channel.service");
const subscribe_channel_dto_1 = require("./dto/subscribe-channel.dto");
const create_channel_dto_1 = require("./dto/create-channel.dto");
const mute_channel_dto_1 = require("./dto/mute-channel.dto");
const auth_decorators_1 = require("../auth/decorators/auth.decorators");
const api_key_entity_1 = require("../auth/entities/api-key.entity");
let ChannelController = class ChannelController {
    channelService;
    constructor(channelService) {
        this.channelService = channelService;
    }
    async findAll(sessionId) {
        return this.channelService.getSubscribedChannels(sessionId);
    }
    async findOne(sessionId, channelId) {
        return this.channelService.getChannelById(sessionId, channelId);
    }
    async getMessages(sessionId, channelId, limit) {
        const parsed = limit !== undefined ? parseInt(limit, 10) : NaN;
        return this.channelService.getChannelMessages(sessionId, channelId, Number.isNaN(parsed) ? undefined : parsed);
    }
    async create(sessionId, dto) {
        return this.channelService.createChannel(sessionId, dto.name, dto.description);
    }
    async remove(sessionId, channelId) {
        await this.channelService.deleteChannel(sessionId, channelId);
        return { success: true };
    }
    async mute(sessionId, channelId, dto) {
        await this.channelService.muteChannel(sessionId, channelId, dto.mute);
        return { success: true };
    }
    async subscribe(sessionId, body) {
        return this.channelService.subscribeToChannel(sessionId, body.inviteCode);
    }
    async unsubscribe(sessionId, channelId) {
        await this.channelService.unsubscribeFromChannel(sessionId, channelId);
        return { success: true };
    }
};
exports.ChannelController = ChannelController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get all subscribed channels/newsletters' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'List of subscribed channels', type: [channel_response_dto_1.ChannelDto] }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Session not ready' }),
    (0, swagger_1.ApiResponse)({
        status: 501,
        description: 'Not supported by the active engine: the Baileys adapter cannot list subscribed channels.',
    }),
    __param(0, (0, common_1.Param)('sessionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ChannelController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':channelId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a specific channel by ID' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'channelId', description: 'Channel ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Channel details', type: channel_response_dto_1.ChannelDto }),
    (0, swagger_1.ApiResponse)({
        status: 503,
        description: 'WhatsApp did not answer within the request budget — the operation may or may not have applied.',
    }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Channel not found' }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('channelId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ChannelController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)(':channelId/messages'),
    (0, swagger_1.ApiOperation)({ summary: 'Get messages from a channel' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'channelId', description: 'Channel ID' }),
    (0, swagger_1.ApiQuery)({
        name: 'limit',
        required: false,
        type: Number,
        description: 'Max messages to return (default 50, max 100)',
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'List of channel messages', type: [channel_response_dto_1.ChannelMessageDto] }),
    (0, swagger_1.ApiResponse)({
        status: 501,
        description: 'Not supported by the active engine: the Baileys adapter cannot read channel messages.',
    }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('channelId')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], ChannelController.prototype, "getMessages", null);
__decorate([
    (0, common_1.Post)(),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, swagger_1.ApiOperation)({
        summary: 'Create a channel',
        description: 'The account becomes the channel owner, which is what makes deleting it possible later — ' +
            'neither engine can delete a channel it does not own.',
    }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiBody)({ type: create_channel_dto_1.CreateChannelDto }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'The created channel', type: channel_response_dto_1.ChannelDto }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Session not started, or validation failed' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'The engine refused — channel creation may be disabled for this account' }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_channel_dto_1.CreateChannelDto]),
    __metadata("design:returntype", Promise)
], ChannelController.prototype, "create", null);
__decorate([
    (0, common_1.Post)(':channelId/delete'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Delete a channel this account owns',
        description: 'Irreversible, and every subscriber loses the channel. Deliberately NOT `DELETE ' +
            '/channels/:channelId` — that route unsubscribes, and the two must not be reachable by the ' +
            'same request with a slip of the wrist. Only the owner can delete.',
    }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'channelId', description: 'Channel ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Channel deleted', type: channel_response_dto_1.ChannelAckResponseDto }),
    (0, swagger_1.ApiResponse)({
        status: 503,
        description: 'WhatsApp did not answer within the request budget — the operation may or may not have applied.',
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Session not started' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'The engine refused — not found, or this account does not own it' }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('channelId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ChannelController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':channelId/mute'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Mute or unmute a channel',
        description: "Silences the channel's notifications for this account. The subscription is untouched.",
    }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'channelId', description: 'Channel ID' }),
    (0, swagger_1.ApiBody)({ type: mute_channel_dto_1.MuteChannelDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Channel muted or unmuted', type: channel_response_dto_1.ChannelAckResponseDto }),
    (0, swagger_1.ApiResponse)({
        status: 503,
        description: 'WhatsApp did not answer within the request budget — the operation may or may not have applied.',
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Session not started, or validation failed' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'The engine refused' }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('channelId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, mute_channel_dto_1.MuteChannelDto]),
    __metadata("design:returntype", Promise)
], ChannelController.prototype, "mute", null);
__decorate([
    (0, common_1.Post)('subscribe'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Subscribe to a channel using invite code' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                inviteCode: {
                    type: 'string',
                    description: 'Channel invite code (from channel link)',
                    example: 'ABC123xyz',
                },
            },
            required: ['inviteCode'],
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Successfully subscribed to channel', type: channel_response_dto_1.ChannelDto }),
    (0, swagger_1.ApiResponse)({
        status: 503,
        description: 'WhatsApp did not answer within the request budget — the operation may or may not have applied.',
    }),
    (0, swagger_1.ApiResponse)({
        status: 501,
        description: 'Not supported by the active engine: whatsapp-web.js cannot subscribe by invite code.',
    }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, subscribe_channel_dto_1.SubscribeChannelDto]),
    __metadata("design:returntype", Promise)
], ChannelController.prototype, "subscribe", null);
__decorate([
    (0, common_1.Delete)(':channelId'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Unsubscribe from a channel' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'channelId', description: 'Channel ID to unsubscribe from' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Successfully unsubscribed from channel', type: channel_response_dto_1.ChannelAckResponseDto }),
    (0, swagger_1.ApiResponse)({
        status: 503,
        description: 'WhatsApp did not answer within the request budget — the operation may or may not have applied.',
    }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('channelId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ChannelController.prototype, "unsubscribe", null);
exports.ChannelController = ChannelController = __decorate([
    (0, swagger_1.ApiTags)('channels'),
    (0, common_1.Controller)('sessions/:sessionId/channels'),
    __metadata("design:paramtypes", [channel_service_1.ChannelService])
], ChannelController);
//# sourceMappingURL=channel.controller.js.map