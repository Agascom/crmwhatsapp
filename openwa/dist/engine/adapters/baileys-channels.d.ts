import type { WASocket } from '@whiskeysockets/baileys';
import { Channel } from '../interfaces/whatsapp-engine.interface';
export interface BaileysChannelsHost {
    ensureReady(): void;
    getSocket(): WASocket;
}
export declare function wmexRefusalCode(error: unknown): number | undefined;
export declare class BaileysChannels {
    private readonly host;
    private readonly queryBudgetMs;
    constructor(host: BaileysChannelsHost, queryBudgetMs?: number);
    private bounded;
    private sock;
    getChannelById(channelId: string): Promise<Channel | null>;
    subscribeToChannel(inviteCode: string): Promise<Channel>;
    createChannel(name: string, description?: string): Promise<Channel>;
    deleteChannel(channelId: string): Promise<void>;
    muteChannel(channelId: string, mute: boolean): Promise<void>;
    unsubscribeFromChannel(channelId: string): Promise<void>;
    private toChannel;
}
