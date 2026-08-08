import type { HookManager } from '../hooks';
import type { LidMappingStore } from '../../engine/identity/lid-mapping-store.service';
import { createLogger } from '../../common/services/logger.service';
import type { MessageService } from '../../modules/message/message.service';
import { type ConversationMediaType } from './conversation-send-facade';
import { PluginHostServices } from './plugin-host-services';
import { PluginStorageService } from './plugin-storage.service';
import { type PluginContext, type PluginInstance } from './plugin.interfaces';
export declare function dispatchConversationMedia(svc: Pick<MessageService, 'sendImage' | 'sendVideo' | 'sendAudio' | 'sendDocument'>, sessionId: string, opts: {
    chatId: string;
    url: string;
    type: ConversationMediaType;
    caption?: string;
}): Promise<unknown>;
export declare class PluginCapabilityContext {
    private readonly logger;
    private readonly hostServices;
    private readonly hookManager;
    private readonly pluginStorage;
    private readonly lidMappingStore?;
    private readonly hookSession;
    constructor(logger: ReturnType<typeof createLogger>, hostServices: PluginHostServices, hookManager: HookManager, pluginStorage: PluginStorageService, lidMappingStore?: LidMappingStore | undefined);
    private assertPermission;
    private assertSessionAllowed;
    private isHookActive;
    private assertSessionActive;
    private resolveEngine;
    private resolveEngineRead;
    private isSessionGone;
    createPluginContext(plugin: PluginInstance): PluginContext;
    private buildPluginLogger;
    private buildMessagesCapability;
    private buildEngineReadCapability;
    private buildNetCapability;
    private buildConversationsCapability;
    private buildHandoverCapability;
    private buildMappingsCapability;
}
