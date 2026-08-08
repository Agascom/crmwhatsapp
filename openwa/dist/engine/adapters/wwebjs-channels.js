"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WwebjsChannels = void 0;
const engine_not_supported_error_1 = require("../../common/errors/engine-not-supported.error");
const engine_refused_error_1 = require("../../common/errors/engine-refused.error");
const channel_not_found_error_1 = require("../../common/errors/channel-not-found.error");
class WwebjsChannels {
    host;
    constructor(host) {
        this.host = host;
    }
    client() {
        return this.host.getClient();
    }
    async getSubscribedChannels() {
        this.host.ensureReady();
        const channels = await this.client().getChannels();
        if (!channels) {
            return [];
        }
        return channels.map((ch) => ({
            id: (typeof ch.id === 'object' ? (ch.id._serialized ?? ch.id.$1) : String(ch.id)) || '',
            name: String(ch.name || ''),
            description: ch.description ? String(ch.description) : undefined,
            inviteCode: ch.inviteCode ? String(ch.inviteCode) : undefined,
            subscriberCount: ch.subscriberCount ? Number(ch.subscriberCount) : undefined,
            verified: ch.verified ? Boolean(ch.verified) : undefined,
        }));
    }
    async createChannel(name, description) {
        this.host.ensureReady();
        const result = await this.client().createChannel(name, description === undefined ? {} : { description });
        if (typeof result === 'string' || !result?.nid) {
            throw new engine_refused_error_1.EngineRefusedError(typeof result === 'string' ? result : `Failed to create the channel '${name}'`);
        }
        const channelId = result.nid._serialized ?? result.nid.$1;
        if (!channelId) {
            throw new engine_refused_error_1.EngineRefusedError(`Channel '${name}' was created but its id was unreadable — refusing to return it`);
        }
        return {
            id: String(channelId),
            name: String(result.title ?? name),
            ...(description === undefined ? {} : { description }),
            ...(result.inviteLink ? { inviteCode: result.inviteLink.split('/').pop() } : {}),
        };
    }
    async deleteChannel(channelId) {
        this.host.ensureReady();
        const ok = await this.client().deleteChannel(channelId);
        if (!ok) {
            throw new engine_refused_error_1.EngineRefusedError(`Failed to delete channel ${channelId}`);
        }
    }
    async muteChannel(channelId, mute) {
        this.host.ensureReady();
        if (!channelId.endsWith('@newsletter')) {
            throw new channel_not_found_error_1.ChannelNotFoundError(channelId);
        }
        const chat = (await this.client().getChatById(channelId));
        const act = mute ? chat?.mute : chat?.unmute;
        if (!act) {
            throw new channel_not_found_error_1.ChannelNotFoundError(channelId);
        }
        const ok = await act.call(chat);
        if (!ok) {
            throw new engine_refused_error_1.EngineRefusedError(`Failed to ${mute ? 'mute' : 'unmute'} channel ${channelId}`);
        }
    }
    async getChannelById(channelId) {
        this.host.ensureReady();
        const channels = await this.getSubscribedChannels();
        return channels.find(c => c.id === channelId) ?? null;
    }
    async subscribeToChannel(_inviteCode) {
        this.host.ensureReady();
        throw new engine_not_supported_error_1.EngineNotSupportedError('subscribeToChannel');
    }
    async unsubscribeFromChannel(channelId) {
        this.host.ensureReady();
        const ok = await this.client().unsubscribeFromChannel(channelId);
        if (!ok) {
            throw new engine_refused_error_1.EngineRefusedError(`Failed to unsubscribe from channel ${channelId}`);
        }
        this.host.logger.log(`Unsubscribed from channel: ${channelId}`);
    }
    async getChannelMessages(channelId, limit = 50) {
        this.host.ensureReady();
        const channels = await this.client().getChannels();
        const channel = channels?.find(c => (typeof c.id === 'object' ? c.id._serialized : c.id) === channelId);
        if (!channel) {
            throw new channel_not_found_error_1.ChannelNotFoundError(channelId);
        }
        const safeLimit = Number.isFinite(limit) && limit >= 1 ? Math.trunc(limit) : 50;
        const messages = await channel.fetchMessages({ limit: safeLimit });
        return (messages ?? []).map(msg => ({
            id: (typeof msg.id === 'object' ? (msg.id?._serialized ?? msg.id?.$1) : msg.id) || '',
            body: String(msg.body || ''),
            timestamp: Number(msg.timestamp),
            hasMedia: Boolean(msg.hasMedia),
            mediaUrl: msg.mediaUrl ? String(msg.mediaUrl) : undefined,
        }));
    }
}
exports.WwebjsChannels = WwebjsChannels;
//# sourceMappingURL=wwebjs-channels.js.map