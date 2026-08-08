import type { ChatKind } from '../../../engine/identity/wa-id';
export declare class ChatSummaryDto {
    id: string;
    name: string;
    isGroup: boolean;
    kind: ChatKind;
    unreadCount: number;
    timestamp: number;
    lastMessage?: string;
}
