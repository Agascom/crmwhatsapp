import { MediaInput } from '../interfaces/whatsapp-engine.interface';
import { type WwebjsEngineHost } from './wwebjs-host';
export declare class WwebjsProfile {
    private readonly host;
    constructor(host: WwebjsEngineHost);
    private client;
    setProfileName(name: string): Promise<void>;
    setProfileStatus(status: string): Promise<void>;
    setProfilePicture(media: MediaInput): Promise<void>;
}
