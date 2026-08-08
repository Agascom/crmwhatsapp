export declare const MESSAGE_TEXT_MAX_LENGTH = 4096;
export declare class CustomLinkPreviewDto {
    url: string;
    title: string;
    description?: string;
}
export declare class SendTextMessageDto {
    chatId: string;
    text: string;
    mentions?: string[];
    linkPreview?: boolean;
    customLinkPreview?: CustomLinkPreviewDto;
}
export declare const SEND_TEXT_BODY_EXAMPLES: {
    minimal: {
        summary: string;
        value: {
            chatId: string;
            text: string;
        };
    };
    withMentions: {
        summary: string;
        value: {
            chatId: string;
            text: string;
            mentions: string[];
        };
    };
};
export declare class SendMediaMessageDto {
    chatId: string;
    url?: string;
    base64?: string;
    mimetype?: string;
    filename?: string;
    caption?: string;
    mentions?: string[];
}
export declare const SEND_IMAGE_BODY_EXAMPLES: {
    fromUrl: {
        summary: string;
        value: {
            chatId: string;
            url: string;
        };
    };
};
export declare const SEND_VIDEO_BODY_EXAMPLES: {
    fromUrl: {
        summary: string;
        value: {
            chatId: string;
            url: string;
        };
    };
};
export declare const SEND_AUDIO_BODY_EXAMPLES: {
    fromUrl: {
        summary: string;
        value: {
            chatId: string;
            url: string;
        };
    };
};
export declare const SEND_DOCUMENT_BODY_EXAMPLES: {
    fromUrl: {
        summary: string;
        value: {
            chatId: string;
            url: string;
        };
    };
};
export declare const SEND_STICKER_BODY_EXAMPLES: {
    fromUrl: {
        summary: string;
        value: {
            chatId: string;
            url: string;
        };
    };
};
export declare class SendAudioMessageDto extends SendMediaMessageDto {
    ptt?: boolean;
}
export declare class MessageResponseDto {
    messageId: string;
    timestamp: number;
}
