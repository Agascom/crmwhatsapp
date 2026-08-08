import { type Client, type Message } from 'whatsapp-web.js';
import { type EngineEventCallbacks, type IncomingMessage } from '../interfaces/whatsapp-engine.interface';
import { type createLogger } from '../../common/services/logger.service';
import { type WhatsAppWebJsConfig } from './whatsapp-web-js.adapter';
export interface WwebjsEngineHost {
    ensureReady(): void;
    getClient(): Client;
    readonly logger: ReturnType<typeof createLogger>;
    isPageTransportError(error: unknown): boolean;
    reportIfPageTransportError(error: unknown, context: string): void;
    ensureNotChannelRecipient(chatId: string): void;
    getNumberId(number: string): Promise<string | null>;
    capInboundMediaFor(msg: Message, maxBytesOverride?: number): Promise<IncomingMessage['media'] | undefined>;
    readonly config: WhatsAppWebJsConfig;
    getCallbacks(): EngineEventCallbacks;
    getSelfWid(): string | undefined;
}
