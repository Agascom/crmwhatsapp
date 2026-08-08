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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatSummaryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const CHAT_KINDS = ['individual', 'group', 'channel', 'status', 'broadcast', 'unknown'];
class ChatSummaryDto {
    id;
    name;
    isGroup;
    kind;
    unreadCount;
    timestamp;
    lastMessage;
}
exports.ChatSummaryDto = ChatSummaryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '628111@c.us' }),
    __metadata("design:type", String)
], ChatSummaryDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Alice' }),
    __metadata("design:type", String)
], ChatSummaryDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Retained for back-compat; true for @g.us chats.', example: false }),
    __metadata("design:type", Boolean)
], ChatSummaryDto.prototype, "isGroup", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: CHAT_KINDS, description: 'User-facing chat kind.', example: 'individual' }),
    __metadata("design:type", String)
], ChatSummaryDto.prototype, "kind", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], ChatSummaryDto.prototype, "unreadCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Unix seconds of the last activity.', example: 1700000010 }),
    __metadata("design:type", Number)
], ChatSummaryDto.prototype, "timestamp", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'hi' }),
    __metadata("design:type", String)
], ChatSummaryDto.prototype, "lastMessage", void 0);
//# sourceMappingURL=chat-summary.dto.js.map