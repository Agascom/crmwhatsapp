import type { WASocket } from '@whiskeysockets/baileys';
import { MediaInput, StatusPostOptions, StatusResult } from '../interfaces/whatsapp-engine.interface';
export interface BaileysStatusHost {
    ensureReady(): void;
    getSocket(): WASocket;
    toEngineJid(jid: string): string;
    normalizedSelfJid(): string;
    toUnixSeconds(ts: number | {
        toNumber(): number;
    } | null | undefined): number;
}
export declare class BaileysStatus {
    private readonly host;
    constructor(host: BaileysStatusHost);
    private sock;
    postTextStatus(text: string, options: StatusPostOptions): Promise<StatusResult>;
    postImageStatus(media: MediaInput, options: StatusPostOptions): Promise<StatusResult>;
    postVideoStatus(media: MediaInput, options: StatusPostOptions): Promise<StatusResult>;
    postVoiceStatus(media: MediaInput, options: StatusPostOptions): Promise<StatusResult>;
    private postMediaStatus;
    deleteStatus(statusId: string): Promise<void>;
    private postStatus;
    private toStatusResult;
}
