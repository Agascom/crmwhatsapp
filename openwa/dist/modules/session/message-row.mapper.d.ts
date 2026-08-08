import type { IncomingMessage } from '../../engine/interfaces/whatsapp-engine.interface';
export declare const MEDIA_MESSAGE_TYPES: Set<string>;
export declare const OMITTED_MEDIA: {
    readonly mimetype: "";
    readonly omitted: true;
};
export declare function buildMessageMetadata(message: Pick<IncomingMessage, 'media' | 'quotedMessage' | 'call' | 'type'>, synthesizeOmittedMedia?: boolean): Record<string, unknown> | undefined;
export declare function storableWaMessageId(id: string | undefined): string | undefined;
