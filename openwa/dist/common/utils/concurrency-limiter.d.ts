export declare class ConcurrencyLimiter {
    private readonly max;
    private readonly maxQueued;
    private active;
    private readonly waiters;
    private closed;
    constructor(max: number, maxQueued?: number);
    get activeCount(): number;
    get queuedCount(): number;
    close(): void;
    run<T>(task: () => Promise<T>): Promise<T>;
}
