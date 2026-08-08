export interface ReconnectAttemptState {
    attempts: number;
    maxAttempts: number;
    baseDelay: number;
    lastAttemptAt?: number;
}
export interface ReconnectExhausted {
    kind: 'exhausted';
    reason: string;
}
export interface ReconnectScheduled {
    kind: 'schedule';
    delayMs: number;
    attempt: number;
    loopAlert: boolean;
    stabilityReset: boolean;
}
export type ReconnectDecision = ReconnectExhausted | ReconnectScheduled;
export declare const RECONNECT_STABILITY_RESET_MS = 300000;
export declare const RECONNECT_LOOP_ALERT_INTERVAL_ATTEMPTS = 5;
export declare const RECONNECT_DELAY_CAP_MS = 3600000;
export declare function clampReconnectDelay(rawDelay: number, baseDelay: number): number;
export declare function decideReconnect(state: ReconnectAttemptState, now?: number, jitter?: number): ReconnectDecision;
