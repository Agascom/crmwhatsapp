import { EngineRegistry } from '../../engine/engine-registry.service';
export declare class CallService {
    private readonly engines;
    constructor(engines: EngineRegistry);
    private getEngine;
    rejectCall(sessionId: string, callId: string): Promise<void>;
}
