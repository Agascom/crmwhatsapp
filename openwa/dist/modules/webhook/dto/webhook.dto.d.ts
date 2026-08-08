import { Webhook } from '../entities/webhook.entity';
import { WebhookFilters } from '../filters/filter-types';
export declare const WEBHOOK_RESERVED_EVENTS: readonly [];
export declare const WEBHOOK_EVENTS: readonly ["message.received", "message.sent", "message.ack", "message.failed", "message.revoked", "message.reaction", "message.edited", "status.received", "session.status", "session.qr", "session.authenticated", "session.disconnected", "session.reconnect_loop", "session.restriction", "presence.update", "group.join", "group.leave", "group.update", "call.received", "call.accepted", "call.rejected", "call.missed"];
export type WebhookEventType = (typeof WEBHOOK_EVENTS)[number];
export declare class CreateWebhookDto {
    url: string;
    events?: string[];
    secret?: string;
    headers?: Record<string, string>;
    filters?: WebhookFilters | null;
    retryCount?: number;
}
export declare class UpdateWebhookDto {
    url?: string;
    events?: string[];
    secret?: string;
    headers?: Record<string, string>;
    filters?: WebhookFilters | null;
    active?: boolean;
    retryCount?: number;
}
export declare class WebhookResponseDto {
    id: string;
    sessionId: string;
    url: string;
    events: string[];
    filters?: WebhookFilters | null;
    active: boolean;
    retryCount: number;
    lastTriggeredAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
    static fromEntity(entity: Webhook): WebhookResponseDto;
    static fromEntities(entities: Webhook[]): WebhookResponseDto[];
}
