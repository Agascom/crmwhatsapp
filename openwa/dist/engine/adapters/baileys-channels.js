"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaileysChannels = void 0;
exports.wmexRefusalCode = wmexRefusalCode;
const channel_not_found_error_1 = require("../../common/errors/channel-not-found.error");
const baileys_groups_1 = require("./baileys-groups");
const baileys_query_deadline_1 = require("./baileys-query-deadline");
function wmexRefusalCode(error) {
    const err = error;
    if (typeof err?.data === 'number') {
        return err.data;
    }
    if (err?.data !== null && typeof err?.data === 'object' && typeof err.output?.statusCode === 'number') {
        return err.output.statusCode;
    }
    return undefined;
}
class BaileysChannels {
    host;
    queryBudgetMs;
    constructor(host, queryBudgetMs = baileys_query_deadline_1.BAILEYS_QUERY_BUDGET_MS) {
        this.host = host;
        this.queryBudgetMs = queryBudgetMs;
    }
    bounded(work, operation) {
        return (0, baileys_query_deadline_1.withQueryDeadline)(work, this.queryBudgetMs, `WhatsApp did not answer ${operation} in time`);
    }
    sock() {
        return this.host.getSocket();
    }
    async getChannelById(channelId) {
        this.host.ensureReady();
        const meta = await this.bounded(this.sock().newsletterMetadata('jid', channelId), 'the channel lookup');
        return meta ? this.toChannel(meta) : null;
    }
    async subscribeToChannel(inviteCode) {
        this.host.ensureReady();
        const meta = await this.bounded(this.sock().newsletterMetadata('invite', inviteCode), 'the invite lookup');
        if (!meta) {
            throw new channel_not_found_error_1.ChannelNotFoundError(inviteCode);
        }
        await this.bounded(this.sock().newsletterFollow(meta.id), 'the channel subscribe');
        return this.toChannel(meta);
    }
    async createChannel(name, description) {
        this.host.ensureReady();
        const meta = await (0, baileys_groups_1.mapServerRefusal)('Creating the channel', () => this.sock().newsletterCreate(name, description), wmexRefusalCode);
        return this.toChannel(meta);
    }
    async deleteChannel(channelId) {
        this.host.ensureReady();
        await (0, baileys_groups_1.mapServerRefusal)('Deleting the channel', () => this.bounded(this.sock().newsletterDelete(channelId), 'the channel delete'), wmexRefusalCode);
    }
    async muteChannel(channelId, mute) {
        this.host.ensureReady();
        await (0, baileys_groups_1.mapServerRefusal)(mute ? 'Muting the channel' : 'Unmuting the channel', () => this.bounded(mute ? this.sock().newsletterMute(channelId) : this.sock().newsletterUnmute(channelId), mute ? 'the channel mute' : 'the channel unmute'), wmexRefusalCode);
    }
    async unsubscribeFromChannel(channelId) {
        this.host.ensureReady();
        await this.bounded(this.sock().newsletterUnfollow(channelId), 'the channel unsubscribe');
    }
    toChannel(meta) {
        const createdAt = meta.creation_time ?? meta.thread_metadata?.creation_time;
        return {
            id: meta.id,
            name: meta.name,
            ...(meta.description ? { description: meta.description } : {}),
            ...(meta.invite ? { inviteCode: meta.invite } : {}),
            ...(meta.subscribers !== undefined ? { subscriberCount: meta.subscribers } : {}),
            ...(meta.picture?.url ? { picture: meta.picture.url } : {}),
            ...(meta.verification ? { verified: meta.verification === 'VERIFIED' } : {}),
            ...(createdAt !== undefined ? { createdAt } : {}),
        };
    }
}
exports.BaileysChannels = BaileysChannels;
//# sourceMappingURL=baileys-channels.js.map