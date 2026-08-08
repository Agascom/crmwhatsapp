import { Channel, ChannelMessage } from '../interfaces/whatsapp-engine.interface';
import { type WwebjsEngineHost } from './wwebjs-host';
export declare class WwebjsChannels {
    private readonly host;
    constructor(host: WwebjsEngineHost);
    private client;
    getSubscribedChannels(): Promise<Channel[]>;
    createChannel(name: string, description?: string): Promise<Channel>;
    deleteChannel(channelId: string): Promise<void>;
    muteChannel(channelId: string, mute: boolean): Promise<void>;
    getChannelById(channelId: string): Promise<Channel | null>;
    subscribeToChannel(_inviteCode: string): Promise<Channel>;
    unsubscribeFromChannel(channelId: string): Promise<void>;
    getChannelMessages(channelId: string, limit?: number): Promise<ChannelMessage[]>;
}
