import { Chat, Client, Message } from 'whatsapp-web.js';
export interface SerializedWid {
    _serialized?: string;
    $1?: string;
}
export declare function readWid(wid: SerializedWid | string | null | undefined): string | undefined;
export interface GroupMetadataRaw {
    parentGroup?: SerializedWid | string | null;
    linkedParentGroup?: SerializedWid | string | null;
    linkedParent?: SerializedWid | string | null;
    announce?: boolean;
    restrict?: boolean;
    ephemeralDuration?: number;
    memberAddMode?: string | boolean;
}
export interface GroupChat extends Omit<Chat, 'isReadOnly' | 'getLabels'> {
    participants: Array<{
        id: {
            _serialized: string;
            user: string;
        };
        name?: string;
        isAdmin: boolean;
        isSuperAdmin: boolean;
    }>;
    description?: string;
    owner?: {
        _serialized: string;
    };
    createdAt?: number;
    isReadOnly?: boolean;
    isAnnounce?: boolean;
    groupMetadata?: GroupMetadataRaw;
    addParticipants(ids: string[], options?: Record<string, unknown>): Promise<Record<string, {
        code: number;
        message: string;
        isInviteV4Sent: boolean;
    }> | string>;
    removeParticipants(ids: string[]): Promise<{
        status: number;
    }>;
    promoteParticipants(ids: string[]): Promise<{
        status: number;
    }>;
    demoteParticipants(ids: string[]): Promise<{
        status: number;
    }>;
    leave(): Promise<void>;
    setSubject(subject: string): Promise<boolean>;
    setDescription(desc: string): Promise<boolean>;
    getLabels(): Promise<Array<{
        id: string;
        name: string;
        hexColor: string;
    }>>;
    addLabel(id: string): Promise<void>;
    removeLabel(id: string): Promise<void>;
    getInviteCode(): Promise<string>;
    revokeInvite(): Promise<string>;
    setMessagesAdminsOnly(adminsOnly?: boolean): Promise<boolean>;
    setInfoAdminsOnly(adminsOnly?: boolean): Promise<boolean>;
    setAddMembersAdminsOnly(adminsOnly?: boolean): Promise<boolean>;
    setPicture(media: unknown): Promise<boolean>;
    deletePicture(): Promise<boolean>;
}
export interface MessageWithReactions extends Omit<Message, 'hasReaction' | 'getReactions' | 'react'> {
    react(emoji: string): Promise<void>;
    hasReaction?: boolean;
    getReactions(): Promise<Array<{
        id: string;
        senders: Array<{
            senderId: string;
            reaction: string;
            timestamp: number;
        }>;
    }>>;
}
export interface BusinessClient extends Omit<Client, 'subscribeToChannel' | 'unsubscribeFromChannel' | 'getLabels' | 'getLabelById' | 'getChannels' | 'getChatsByLabelId' | 'createChannel' | 'deleteChannel'> {
    getLabels(): Promise<Array<{
        id: string;
        name: string;
        hexColor: string;
    }>>;
    getLabelById(id: string): Promise<{
        id: string;
        name: string;
        hexColor: string;
    } | null>;
    getChatsByLabelId(labelId: string): Promise<Array<{
        id?: {
            _serialized?: string;
        };
        name?: string;
        isGroup?: boolean;
        unreadCount?: number;
        timestamp?: number;
    } | undefined>>;
    getChannels(): Promise<WwjsChannelData[]>;
    subscribeToChannel(channelId: string): Promise<boolean>;
    createChannel(title: string, options?: {
        description?: string;
    }): Promise<{
        title?: string;
        nid: {
            _serialized?: string;
            $1?: string;
        };
        inviteLink?: string;
    } | string>;
    deleteChannel(channelId: string): Promise<boolean>;
    unsubscribeFromChannel(id: string, options?: Record<string, unknown>): Promise<boolean>;
}
export interface WwjsChannelData {
    id: {
        _serialized?: string;
        $1?: string;
    } | string;
    name?: string;
    description?: string;
    inviteCode?: string;
    subscriberCount?: number;
    verified?: boolean;
    fetchMessages(opts: {
        limit: number;
    }): Promise<WwjsChannelMessage[]>;
}
export interface WwjsChannelMessage {
    id: SerializedWid | string;
    body?: string;
    type?: string;
    timestamp?: number;
    hasMedia?: boolean;
    mediaUrl?: string;
}
export interface GroupCreateResult {
    gid: {
        _serialized: string;
    };
}
