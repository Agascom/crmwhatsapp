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
exports.LabelController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const label_response_dto_1 = require("./dto/label-response.dto");
const label_service_1 = require("./label.service");
const add_label_dto_1 = require("./dto/add-label.dto");
const upsert_label_dto_1 = require("./dto/upsert-label.dto");
const auth_decorators_1 = require("../auth/decorators/auth.decorators");
const api_key_entity_1 = require("../auth/entities/api-key.entity");
let LabelController = class LabelController {
    labelService;
    constructor(labelService) {
        this.labelService = labelService;
    }
    async findAll(sessionId) {
        return this.labelService.getLabels(sessionId);
    }
    async findOne(sessionId, labelId) {
        return this.labelService.getLabelById(sessionId, labelId);
    }
    async getChatsByLabel(sessionId, labelId) {
        return this.labelService.getChatsByLabel(sessionId, labelId);
    }
    async upsertLabel(sessionId, labelId, dto) {
        await this.labelService.upsertLabel(sessionId, labelId, dto);
        return { success: true };
    }
    async deleteLabel(sessionId, labelId) {
        await this.labelService.deleteLabel(sessionId, labelId);
        return { success: true };
    }
    async getChatLabels(sessionId, chatId) {
        return this.labelService.getChatLabels(sessionId, chatId);
    }
    async addLabelToChat(sessionId, chatId, body) {
        await this.labelService.addLabelToChat(sessionId, chatId, body.labelId);
        return { success: true };
    }
    async removeLabelFromChat(sessionId, chatId, labelId) {
        await this.labelService.removeLabelFromChat(sessionId, chatId, labelId);
        return { success: true };
    }
};
exports.LabelController = LabelController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get all labels (WhatsApp Business only)' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'List of labels', type: [label_response_dto_1.LabelDto] }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Session not ready or not a business account' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Session not found' }),
    __param(0, (0, common_1.Param)('sessionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], LabelController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':labelId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a specific label by ID' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'labelId', description: 'Label ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Label details', type: label_response_dto_1.LabelDto }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Label not found' }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('labelId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], LabelController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)(':labelId/chats'),
    (0, swagger_1.ApiOperation)({
        summary: 'Get every chat carrying a label',
        description: 'whatsapp-web.js only. Baileys exposes label writes but no label query of any kind, so it ' + 'answers `501`.',
    }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'labelId', description: 'Label ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Chats carrying the label', type: [label_response_dto_1.LabelChatDto] }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Session not started' }),
    (0, swagger_1.ApiResponse)({ status: 501, description: 'The active engine cannot list chats by label (Baileys)' }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('labelId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], LabelController.prototype, "getChatsByLabel", null);
__decorate([
    (0, common_1.Put)(':labelId'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Create or update a label',
        description: 'Baileys only. `PUT` rather than `POST` because the label id is chosen by the caller: WhatsApp ' +
            'carries one `label_edit` write keyed on that id, so whether this creates or updates depends ' +
            'purely on whether the id already exists, and there is no server-assigned id to return.\n\n' +
            '**Choose an unused id to create.** Reusing one silently rewrites that label rather than ' +
            'failing, because the protocol has no create-only form. Fields left out are left alone.\n\n' +
            'whatsapp-web.js can read and assign labels but cannot edit one, and answers `501`.',
    }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'labelId', description: 'Label ID — caller-chosen' }),
    (0, swagger_1.ApiBody)({ type: upsert_label_dto_1.UpsertLabelDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Label created or updated', type: label_response_dto_1.LabelAckResponseDto }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Session not started, or validation failed' }),
    (0, swagger_1.ApiResponse)({ status: 501, description: 'The active engine cannot edit labels (whatsapp-web.js)' }),
    (0, swagger_1.ApiResponse)({
        status: 503,
        description: 'WhatsApp did not answer within the request budget. The change may or may not have been applied — ' +
            'the gateway stopped waiting for a confirmation that never came.',
    }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('labelId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, upsert_label_dto_1.UpsertLabelDto]),
    __metadata("design:returntype", Promise)
], LabelController.prototype, "upsertLabel", null);
__decorate([
    (0, common_1.Delete)(':labelId'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Delete a label',
        description: 'Baileys only. The label disappears from every chat it was on. whatsapp-web.js cannot edit ' +
            'labels and answers `501`.',
    }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'labelId', description: 'Label ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Label deleted', type: label_response_dto_1.LabelAckResponseDto }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Session not started' }),
    (0, swagger_1.ApiResponse)({ status: 501, description: 'The active engine cannot edit labels (whatsapp-web.js)' }),
    (0, swagger_1.ApiResponse)({
        status: 503,
        description: 'WhatsApp did not answer within the request budget. The change may or may not have been applied — ' +
            'the gateway stopped waiting for a confirmation that never came.',
    }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('labelId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], LabelController.prototype, "deleteLabel", null);
__decorate([
    (0, common_1.Get)('chat/:chatId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get labels for a specific chat' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'chatId', description: 'Chat ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'List of labels for the chat', type: [label_response_dto_1.LabelDto] }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('chatId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], LabelController.prototype, "getChatLabels", null);
__decorate([
    (0, common_1.Post)('chat/:chatId'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Add a label to a chat' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'chatId', description: 'Chat ID' }),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                labelId: { type: 'string', description: 'Label ID to add' },
            },
            required: ['labelId'],
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Label added to chat', type: label_response_dto_1.LabelAckResponseDto }),
    (0, swagger_1.ApiResponse)({
        status: 422,
        description: 'Labels require a WhatsApp Business account, or the chat type has no labels',
    }),
    (0, swagger_1.ApiResponse)({
        status: 503,
        description: 'WhatsApp did not answer within the request budget. The change may or may not have been applied — ' +
            'the gateway stopped waiting for a confirmation that never came.',
    }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('chatId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, add_label_dto_1.AddLabelDto]),
    __metadata("design:returntype", Promise)
], LabelController.prototype, "addLabelToChat", null);
__decorate([
    (0, common_1.Delete)('chat/:chatId/:labelId'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Remove a label from a chat' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'chatId', description: 'Chat ID' }),
    (0, swagger_1.ApiParam)({ name: 'labelId', description: 'Label ID to remove' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Label removed from chat', type: label_response_dto_1.LabelAckResponseDto }),
    (0, swagger_1.ApiResponse)({
        status: 422,
        description: 'Labels require a WhatsApp Business account, or the chat type has no labels',
    }),
    (0, swagger_1.ApiResponse)({
        status: 503,
        description: 'WhatsApp did not answer within the request budget. The change may or may not have been applied — ' +
            'the gateway stopped waiting for a confirmation that never came.',
    }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('chatId')),
    __param(2, (0, common_1.Param)('labelId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], LabelController.prototype, "removeLabelFromChat", null);
exports.LabelController = LabelController = __decorate([
    (0, swagger_1.ApiTags)('labels'),
    (0, common_1.Controller)('sessions/:sessionId/labels'),
    __metadata("design:paramtypes", [label_service_1.LabelService])
], LabelController);
//# sourceMappingURL=label.controller.js.map