import type { ModuleRef } from '@nestjs/core';
import type { MessageService } from '../../modules/message/message.service';
import type { SessionService } from '../../modules/session/session.service';
import type { ConversationMappingService } from '../../modules/integration/conversation-mapping.service';
import type { PluginInstanceService } from '../../modules/integration/plugin-instance.service';
import type { SearchProviderRegistry } from '../../modules/search/search-provider.registry';
export declare class PluginHostServices {
    private readonly moduleRef;
    constructor(moduleRef: ModuleRef);
    getMessageService(): MessageService;
    getSessionService(): SessionService;
    getConversationMappingService(): ConversationMappingService;
    getPluginInstanceService(): PluginInstanceService;
    getSearchRegistry(): SearchProviderRegistry | undefined;
}
