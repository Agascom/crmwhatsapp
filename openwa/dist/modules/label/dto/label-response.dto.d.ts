export declare class LabelDto {
    id: string;
    name: string;
    hexColor: string;
}
export declare class LabelChatDto {
    id: string;
    name: string;
    isGroup: boolean;
    kind: string;
    unreadCount: number;
    timestamp: number;
    lastMessage?: string;
}
export declare class LabelAckResponseDto {
    success: boolean;
}
