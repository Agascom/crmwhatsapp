import type * as BaileysLib from '@whiskeysockets/baileys';
import type { WACallEvent, WAMessage, WAMessageKey, WASocket } from '@whiskeysockets/baileys';
import { EngineEventCallbacks, PresenceState, IncomingMessage } from '../interfaces/whatsapp-engine.interface';
import type { ConcurrencyLimiter } from '../../common/utils/concurrency-limiter';
import { type createLogger } from '../../common/services/logger.service';
interface RawPresence {
    lastKnownPresence?: PresenceState;
    lastSeen?: number;
    groupOnlineCount?: number;
}
export interface BaileysEventsHost {
    getSocket(): WASocket;
    getSocketOrNull(): WASocket | null;
    readonly logger: ReturnType<typeof createLogger>;
    toNeutralJid(jid: string): string;
    normalizedSelfJid(): string;
    loadLib(): Promise<typeof BaileysLib>;
    readonly connectedAt: number;
    readonly inboundLimiter: ConcurrencyLimiter;
    recordKeyLidMappings(key: Pick<WAMessageKey, 'remoteJid' | 'remoteJidAlt' | 'participant' | 'participantAlt'>): void;
    recordMessage(msg: WAMessage): void;
    recordMessageEdit(chatId: string, messageId: string, text: string): void;
    putStoredMessage(msg: WAMessage): Promise<void> | undefined;
    getOnMessage(): EngineEventCallbacks['onMessage'];
    getOnMessageCreate(): EngineEventCallbacks['onMessageCreate'];
    getOnMessageRevoked(): EngineEventCallbacks['onMessageRevoked'];
    getOnMessageEdited(): EngineEventCallbacks['onMessageEdited'];
    getOnMessageReaction(): EngineEventCallbacks['onMessageReaction'];
    getOnMessageAck(): EngineEventCallbacks['onMessageAck'];
    getOnGroupEvent(): EngineEventCallbacks['onGroupEvent'];
    getOnCall(): EngineEventCallbacks['onCall'];
    getOnPresenceUpdate(): EngineEventCallbacks['onPresenceUpdate'];
    getOnCallOutcome(): EngineEventCallbacks['onCallOutcome'];
}
export declare class BaileysEvents {
    private readonly host;
    private static readonly LIVE_CALL_TTL_MS;
    readonly liveCalls: Map<string, {
        callFrom: string;
        expiresAt: number;
        from: string;
        isVideo: boolean;
        isGroup: boolean;
    }>;
    constructor(host: BaileysEventsHost);
    handleMessagesUpsert(event: {
        messages: WAMessage[];
        type: string;
    }): void;
    logContactEvent(event: string, records?: Array<{
        id?: string;
        name?: string;
        notify?: string;
        verifiedName?: string;
        lid?: string;
        jid?: string;
    }>): void;
    private processInboundMessage;
    handleMessagesUpdate(updates: Array<{
        key?: {
            id?: string | null;
        };
        update?: {
            status?: number | null;
        };
    }>): void;
    handleGroupParticipantsUpdate(event: {
        id?: string;
        author?: string;
        authorPn?: string;
        participants?: unknown[];
        action?: string;
    }): void;
    handleGroupsUpdate(updates: Array<{
        id?: string;
        subject?: string;
        desc?: string;
        announce?: boolean;
        restrict?: boolean;
        author?: string;
        authorPn?: string;
        participants?: unknown;
        creation?: unknown;
        subjectTime?: unknown;
        owner?: unknown;
        size?: unknown;
    }>): void;
    handleCallEvents(calls: WACallEvent[]): void;
    private reportCallOutcome;
    handlePresenceUpdate(update: {
        id?: string;
        presences?: Record<string, RawPresence>;
    }): void;
    private cacheLiveCall;
    rejectCall(callId: string): Promise<void>;
    private toNeutralGroupParticipantId;
    private downloadInboundMediaCapped;
    private resolveInboundMedia;
    mapMessage(msg: WAMessage, contentType: string | undefined, opts?: {
        skipMediaDownload?: boolean;
    }): Promise<IncomingMessage>;
    private toEditUnixSeconds;
}
export {};
