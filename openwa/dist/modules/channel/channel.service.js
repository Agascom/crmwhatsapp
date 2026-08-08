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
var ChannelService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelService = void 0;
const common_1 = require("@nestjs/common");
const engine_registry_service_1 = require("../../engine/engine-registry.service");
let ChannelService = class ChannelService {
    static { ChannelService_1 = this; }
    engines;
    static MAX_CHANNEL_HISTORY_LIMIT = 100;
    constructor(engines) {
        this.engines = engines;
    }
    getEngine(sessionId) {
        return this.engines.require(sessionId);
    }
    getSubscribedChannels(sessionId) {
        return this.getEngine(sessionId).getSubscribedChannels();
    }
    async getChannelById(sessionId, channelId) {
        const channel = await this.getEngine(sessionId).getChannelById(channelId);
        if (!channel) {
            throw new common_1.NotFoundException(`Channel ${channelId} not found`);
        }
        return channel;
    }
    getChannelMessages(sessionId, channelId, limit = 50) {
        const safeLimit = Number.isFinite(limit)
            ? Math.min(Math.max(Math.trunc(limit), 1), ChannelService_1.MAX_CHANNEL_HISTORY_LIMIT)
            : 50;
        return this.getEngine(sessionId).getChannelMessages(channelId, safeLimit);
    }
    createChannel(sessionId, name, description) {
        return this.getEngine(sessionId).createChannel(name, description);
    }
    deleteChannel(sessionId, channelId) {
        return this.getEngine(sessionId).deleteChannel(channelId);
    }
    muteChannel(sessionId, channelId, mute) {
        return this.getEngine(sessionId).muteChannel(channelId, mute);
    }
    subscribeToChannel(sessionId, inviteCode) {
        return this.getEngine(sessionId).subscribeToChannel(inviteCode);
    }
    unsubscribeFromChannel(sessionId, channelId) {
        return this.getEngine(sessionId).unsubscribeFromChannel(channelId);
    }
};
exports.ChannelService = ChannelService;
exports.ChannelService = ChannelService = ChannelService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [engine_registry_service_1.EngineRegistry])
], ChannelService);
//# sourceMappingURL=channel.service.js.map