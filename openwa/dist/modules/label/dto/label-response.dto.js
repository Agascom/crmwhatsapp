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
exports.LabelAckResponseDto = exports.LabelChatDto = exports.LabelDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class LabelDto {
    id;
    name;
    hexColor;
}
exports.LabelDto = LabelDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Label id, assigned by WhatsApp.', example: '1' }),
    __metadata("design:type", String)
], LabelDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Label text.', example: 'Paid' }),
    __metadata("design:type", String)
], LabelDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Display colour as hex. The write path takes a colour INDEX (0-19) instead — neither engine ' +
            'exposes the index-to-hex mapping, so the two directions deliberately differ.',
        example: '#5bc0de',
    }),
    __metadata("design:type", String)
], LabelDto.prototype, "hexColor", void 0);
class LabelChatDto {
    id;
    name;
    isGroup;
    kind;
    unreadCount;
    timestamp;
    lastMessage;
}
exports.LabelChatDto = LabelChatDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Chat id in the engine's native format.", example: '628123456789@c.us' }),
    __metadata("design:type", String)
], LabelChatDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Chat title — contact name or group subject.', example: 'Ada Lovelace' }),
    __metadata("design:type", String)
], LabelChatDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Retained for back-compat; `kind` is the full discriminator.', example: false }),
    __metadata("design:type", Boolean)
], LabelChatDto.prototype, "isGroup", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'User-facing chat kind.', example: 'individual' }),
    __metadata("design:type", String)
], LabelChatDto.prototype, "kind", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Unread messages in this chat.', example: 0 }),
    __metadata("design:type", Number)
], LabelChatDto.prototype, "unreadCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Unix SECONDS of the most recent activity.', example: 1786000000 }),
    __metadata("design:type", Number)
], LabelChatDto.prototype, "timestamp", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Preview of the last message, when there is one.', example: 'See you then' }),
    __metadata("design:type", String)
], LabelChatDto.prototype, "lastMessage", void 0);
class LabelAckResponseDto {
    success;
}
exports.LabelAckResponseDto = LabelAckResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Always true — a failure is reported as a non-2xx status, not as false.', example: true }),
    __metadata("design:type", Boolean)
], LabelAckResponseDto.prototype, "success", void 0);
//# sourceMappingURL=label-response.dto.js.map