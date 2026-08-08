import { CallService } from './call.service';
export declare class CallController {
    private readonly callService;
    constructor(callService: CallService);
    reject(sessionId: string, callId: string): Promise<{
        success: boolean;
    }>;
}
