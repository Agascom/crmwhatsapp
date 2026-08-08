"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConcurrencyLimiter = void 0;
class ConcurrencyLimiter {
    max;
    maxQueued;
    active = 0;
    waiters = [];
    closed = false;
    constructor(max, maxQueued = Infinity) {
        this.max = max;
        this.maxQueued = maxQueued;
        this.max = Math.max(1, Math.floor(max));
        this.maxQueued = Math.max(0, Math.floor(maxQueued));
    }
    get activeCount() {
        return this.active;
    }
    get queuedCount() {
        return this.waiters.length;
    }
    close() {
        this.closed = true;
        const parked = this.waiters.splice(0);
        for (const wake of parked) {
            wake(new Error('ConcurrencyLimiter closed'));
        }
    }
    async run(task) {
        if (this.closed) {
            throw new Error('ConcurrencyLimiter closed');
        }
        if (this.active < this.max) {
            this.active++;
        }
        else {
            if (this.waiters.length >= this.maxQueued) {
                throw new Error('ConcurrencyLimiter queue full');
            }
            await new Promise((resolve, reject) => this.waiters.push(error => (error ? reject(error) : resolve())));
        }
        try {
            return await task();
        }
        finally {
            const next = this.waiters.shift();
            if (next) {
                next();
            }
            else {
                this.active--;
            }
        }
    }
}
exports.ConcurrencyLimiter = ConcurrencyLimiter;
//# sourceMappingURL=concurrency-limiter.js.map