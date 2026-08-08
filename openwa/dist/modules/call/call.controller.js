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
exports.CallController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const call_response_dto_1 = require("./dto/call-response.dto");
const call_service_1 = require("./call.service");
const auth_decorators_1 = require("../auth/decorators/auth.decorators");
const api_key_entity_1 = require("../auth/entities/api-key.entity");
let CallController = class CallController {
    callService;
    constructor(callService) {
        this.callService = callService;
    }
    async reject(sessionId, callId) {
        await this.callService.rejectCall(sessionId, callId);
        return { success: true };
    }
};
exports.CallController = CallController;
__decorate([
    (0, common_1.Post)(':callId/reject'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Reject a ringing incoming call' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'callId', description: 'Call ID from the call.received event' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Call rejected', type: call_response_dto_1.CallAckResponseDto }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Session is not started' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Call not found or no longer ringing' }),
    (0, swagger_1.ApiResponse)({
        status: 503,
        description: 'WhatsApp did not answer within the request budget. The change may or may not have been applied — ' +
            'the gateway stopped waiting for a confirmation that never came.',
    }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('callId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], CallController.prototype, "reject", null);
exports.CallController = CallController = __decorate([
    (0, swagger_1.ApiTags)('calls'),
    (0, common_1.Controller)('sessions/:sessionId/calls'),
    __metadata("design:paramtypes", [call_service_1.CallService])
], CallController);
//# sourceMappingURL=call.controller.js.map