"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PluginHostServices = void 0;
class PluginHostServices {
    moduleRef;
    constructor(moduleRef) {
        this.moduleRef = moduleRef;
    }
    getMessageService() {
        const mod = require('../../modules/message/message.service');
        return this.moduleRef.get(mod.MessageService, { strict: false });
    }
    getSessionService() {
        const mod = require('../../modules/session/session.service');
        return this.moduleRef.get(mod.SessionService, { strict: false });
    }
    getConversationMappingService() {
        const mod = require('../../modules/integration/conversation-mapping.service');
        return this.moduleRef.get(mod.ConversationMappingService, { strict: false });
    }
    getPluginInstanceService() {
        const mod = require('../../modules/integration/plugin-instance.service');
        return this.moduleRef.get(mod.PluginInstanceService, { strict: false });
    }
    getSearchRegistry() {
        try {
            const mod = require('../../modules/search/search-provider.registry');
            return this.moduleRef.get(mod.SearchProviderRegistry, { strict: false });
        }
        catch {
            return undefined;
        }
    }
}
exports.PluginHostServices = PluginHostServices;
//# sourceMappingURL=plugin-host-services.js.map