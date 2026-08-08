import { DeliveryStatus, IncomingMessage, MessageType } from '../interfaces/whatsapp-engine.interface';
export declare function mapBaileysMessageType(contentType: string | undefined, isPtt?: boolean): MessageType;
export interface BaileysBodyContent {
    conversation?: string | null;
    extendedTextMessage?: {
        text?: string | null;
    } | null;
    imageMessage?: {
        caption?: string | null;
    } | null;
    videoMessage?: {
        caption?: string | null;
    } | null;
    documentMessage?: {
        caption?: string | null;
    } | null;
    interactiveMessage?: {
        body?: {
            text?: string | null;
        } | null;
    } | null;
    buttonsMessage?: {
        contentText?: string | null;
    } | null;
    templateMessage?: {
        hydratedTemplate?: {
            hydratedContentText?: string | null;
        } | null;
        hydratedFourRowTemplate?: {
            hydratedContentText?: string | null;
        } | null;
    } | null;
    interactiveResponseMessage?: {
        body?: {
            text?: string | null;
        } | null;
    } | null;
}
export declare function extractBaileysBody(content: BaileysBodyContent): string;
export interface BaileysLocationContent {
    locationMessage?: {
        degreesLatitude?: number | null;
        degreesLongitude?: number | null;
        name?: string | null;
        address?: string | null;
    } | null;
    liveLocationMessage?: {
        degreesLatitude?: number | null;
        degreesLongitude?: number | null;
    } | null;
}
export declare function extractBaileysLocation(content: BaileysLocationContent, contentType: string | undefined): IncomingMessage['location'];
interface BaileysContextCarrier {
    contextInfo?: {
        stanzaId?: string | null;
        quotedMessage?: unknown;
        expiration?: number | null;
        mentionedJid?: string[] | null;
    } | null;
}
export interface BaileysContextContent {
    extendedTextMessage?: (BaileysContextCarrier & {
        backgroundArgb?: number | null;
        font?: number | null;
    }) | null;
    imageMessage?: BaileysContextCarrier | null;
    videoMessage?: BaileysContextCarrier | null;
    audioMessage?: BaileysContextCarrier | null;
    documentMessage?: BaileysContextCarrier | null;
    stickerMessage?: BaileysContextCarrier | null;
    locationMessage?: BaileysContextCarrier | null;
}
export interface BaileysMessageContext {
    quotedMessage?: IncomingMessage['quotedMessage'];
    ephemeralDuration?: number;
    mentionedJids?: string[];
    backgroundArgb?: number;
    font?: number;
}
export declare function extractBaileysContext(content: BaileysContextContent): BaileysMessageContext;
export declare function mapBaileysStatus(status: number | null | undefined): DeliveryStatus | null;
export interface BaileysIncomingFields {
    id: string;
    remoteJid: string;
    fromMe: boolean;
    participant?: string;
    body: string;
    contentType: string | undefined;
    isPtt?: boolean;
    timestamp: number;
    pushName?: string;
    selfJid?: string;
    media?: IncomingMessage['media'];
    location?: IncomingMessage['location'];
    quotedMessage?: IncomingMessage['quotedMessage'];
    ephemeralDuration?: number;
    mentionedJids?: string[];
    backgroundArgb?: number;
    font?: number;
}
export declare function buildIncomingMessageFromBaileys(fields: BaileysIncomingFields, normalizeJid?: (jid: string) => string): IncomingMessage;
export {};
