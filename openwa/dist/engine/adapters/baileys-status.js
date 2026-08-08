"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaileysStatus = void 0;
const common_1 = require("@nestjs/common");
const baileys_messaging_1 = require("./baileys-messaging");
class BaileysStatus {
    host;
    constructor(host) {
        this.host = host;
    }
    sock() {
        return this.host.getSocket();
    }
    postTextStatus(text, options) {
        return this.postStatus({ text }, options);
    }
    postImageStatus(media, options) {
        return this.postMediaStatus('image', media, options);
    }
    postVideoStatus(media, options) {
        return this.postMediaStatus('video', media, options);
    }
    postVoiceStatus(media, options) {
        return this.postMediaStatus('voice', media, options);
    }
    async postMediaStatus(kind, media, options) {
        this.host.ensureReady();
        const { data, mimetype } = await (0, baileys_messaging_1.resolveMediaBuffer)(media);
        const content = kind === 'image'
            ? { image: data, caption: options.caption, mimetype }
            : kind === 'video'
                ? { video: data, caption: options.caption, mimetype }
                : { audio: data, mimetype, ptt: true };
        return this.postStatus(content, options);
    }
    async deleteStatus(statusId) {
        this.host.ensureReady();
        await this.sock().sendMessage('status@broadcast', {
            delete: {
                remoteJid: 'status@broadcast',
                fromMe: true,
                id: statusId,
                participant: this.host.toEngineJid(this.host.normalizedSelfJid()),
            },
        });
    }
    async postStatus(content, options) {
        this.host.ensureReady();
        if (!options.recipients?.length) {
            throw new common_1.BadRequestException('recipients is required to post a status on the Baileys engine');
        }
        const statusJidList = options.recipients.map(r => this.host.toEngineJid(r));
        const sent = await this.sock().sendMessage('status@broadcast', content, {
            statusJidList,
            backgroundColor: options.backgroundColor,
            font: options.font,
        });
        return this.toStatusResult(sent);
    }
    toStatusResult(sent) {
        const ts = sent?.messageTimestamp ? new Date(this.host.toUnixSeconds(sent.messageTimestamp) * 1000) : new Date();
        return {
            statusId: sent?.key?.id ?? '',
            timestamp: ts,
            expiresAt: new Date(ts.getTime() + 24 * 3_600_000),
        };
    }
}
exports.BaileysStatus = BaileysStatus;
//# sourceMappingURL=baileys-status.js.map