"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WwebjsProfile = void 0;
const engine_refused_error_1 = require("../../common/errors/engine-refused.error");
const wwebjs_messaging_1 = require("./wwebjs-messaging");
class WwebjsProfile {
    host;
    constructor(host) {
        this.host = host;
    }
    client() {
        return this.host.getClient();
    }
    async setProfileName(name) {
        this.host.ensureReady();
        const ok = await this.client().setDisplayName(name);
        if (!ok) {
            throw new engine_refused_error_1.EngineRefusedError('the engine rejected the profile name change');
        }
        this.host.logger.log('Updated profile name');
    }
    async setProfileStatus(status) {
        this.host.ensureReady();
        await this.client().setStatus(status);
        this.host.logger.log('Updated profile status');
    }
    async setProfilePicture(media) {
        this.host.ensureReady();
        const messageMedia = await (0, wwebjs_messaging_1.toMessageMedia)(media);
        const ok = await this.client().setProfilePicture(messageMedia);
        if (!ok) {
            throw new engine_refused_error_1.EngineRefusedError('the engine rejected the profile picture change');
        }
        this.host.logger.log('Updated profile picture');
    }
}
exports.WwebjsProfile = WwebjsProfile;
//# sourceMappingURL=wwebjs-profile.js.map