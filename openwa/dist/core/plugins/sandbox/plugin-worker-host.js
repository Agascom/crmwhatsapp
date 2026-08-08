"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PluginWorkerHost = void 0;
const SEND_CAP_VERBS = new Set(['messages.sendText', 'messages.reply', 'conversation.send']);
const SEND_CAP_TIMEOUT_FACTOR = 4;
class PluginWorkerHost {
    channel;
    capDispatcher;
    onHookSubscribe;
    onWebhookSubscribe;
    onLog;
    runWithHookGuard;
    maxInFlightCaps;
    onSearchProviderRegister;
    onExit;
    capTimeoutMs;
    nextId = 1;
    ready = false;
    dead = false;
    readyWaiters = [];
    pending = new Map();
    hookPending = new Map();
    webhookPending = new Map();
    healthPending = new Map();
    searchPending = new Map();
    inFlightHookEvents = new Map();
    inFlightCaps = 0;
    terminated = false;
    constructor(channel, capDispatcher, onHookSubscribe, onWebhookSubscribe, onLog, runWithHookGuard, maxInFlightCaps, onSearchProviderRegister, onExit, capTimeoutMs) {
        this.channel = channel;
        this.capDispatcher = capDispatcher;
        this.onHookSubscribe = onHookSubscribe;
        this.onWebhookSubscribe = onWebhookSubscribe;
        this.onLog = onLog;
        this.runWithHookGuard = runWithHookGuard;
        this.maxInFlightCaps = maxInFlightCaps;
        this.onSearchProviderRegister = onSearchProviderRegister;
        this.onExit = onExit;
        this.capTimeoutMs = capTimeoutMs;
        this.channel.onMessage(message => this.handleMessage(message));
        this.channel.onExit(code => this.handleExit(code));
    }
    incInFlightHook(event) {
        this.inFlightHookEvents.set(event, (this.inFlightHookEvents.get(event) ?? 0) + 1);
    }
    decInFlightHook(event) {
        const count = this.inFlightHookEvents.get(event);
        if (count === undefined)
            return;
        if (count <= 1)
            this.inFlightHookEvents.delete(event);
        else
            this.inFlightHookEvents.set(event, count - 1);
    }
    dispatchHook(options) {
        if (this.dead)
            return Promise.resolve({ continue: true });
        const id = this.nextId++;
        this.incInFlightHook(options.event);
        return new Promise(resolve => {
            const settle = (result) => {
                this.decInFlightHook(options.event);
                resolve(result);
            };
            const timer = setTimeout(() => {
                this.hookPending.delete(id);
                options.onTimeout?.();
                settle({ continue: true });
            }, options.timeoutMs);
            this.hookPending.set(id, { resolve: settle, timer });
            this.channel.postMessage({
                kind: 'hook',
                id,
                event: options.event,
                data: options.data,
                sessionId: options.sessionId,
                source: options.source,
                config: options.config,
            });
        });
    }
    dispatchWebhook(options) {
        if (this.dead)
            return Promise.resolve({ ok: false, status: 502 });
        const id = this.nextId++;
        return new Promise(resolve => {
            const timer = setTimeout(() => {
                this.webhookPending.delete(id);
                options.onTimeout?.();
                resolve({ ok: false, status: 504 });
            }, options.timeoutMs);
            this.webhookPending.set(id, { resolve, timer });
            this.channel.postMessage({
                kind: 'webhook',
                id,
                instanceId: options.instanceId,
                route: options.route,
                method: options.method,
                headers: options.headers,
                query: options.query,
                body: options.body,
                rawBody: options.rawBody,
                verified: options.verified,
                deliveryId: options.deliveryId,
                sessionId: options.sessionId,
                config: options.config,
            });
        });
    }
    dispatchSearch(options) {
        if (this.dead)
            return Promise.resolve({ ok: false, error: 'plugin worker is no longer running' });
        const id = this.nextId++;
        return new Promise(resolve => {
            const timer = setTimeout(() => {
                this.searchPending.delete(id);
                resolve({ ok: false, error: 'search timed out' });
            }, options.timeoutMs);
            this.searchPending.set(id, { resolve, timer });
            this.channel.postMessage({ kind: 'search', id, query: options.query });
        });
    }
    load(mainPath, context, timeoutMs) {
        return new Promise((resolve, reject) => {
            if (this.dead)
                return reject(new Error('plugin worker is no longer running'));
            if (this.ready)
                return resolve();
            const waiter = {
                resolve,
                reject,
            };
            if (timeoutMs !== undefined) {
                waiter.timer = setTimeout(() => {
                    const index = this.readyWaiters.indexOf(waiter);
                    if (index !== -1)
                        this.readyWaiters.splice(index, 1);
                    reject(new Error(`plugin worker load timed out after ${timeoutMs}ms`));
                }, timeoutMs);
            }
            this.readyWaiters.push(waiter);
            this.channel.postMessage(context ? { kind: 'load', mainPath, context } : { kind: 'load', mainPath });
        });
    }
    runLifecycle(method, timeoutMs) {
        return new Promise((resolve, reject) => {
            if (this.dead)
                return reject(new Error('plugin worker is no longer running'));
            const id = this.nextId++;
            const entry = {
                resolve,
                reject,
            };
            if (timeoutMs !== undefined) {
                entry.timer = setTimeout(() => {
                    this.pending.delete(id);
                    reject(new Error(`plugin worker lifecycle '${method}' timed out after ${timeoutMs}ms`));
                }, timeoutMs);
            }
            this.pending.set(id, entry);
            this.channel.postMessage({ kind: 'lifecycle', id, method });
        });
    }
    sendConfigChange(config) {
        if (this.dead)
            return;
        this.channel.postMessage({ kind: 'config-change', config });
    }
    healthCheck(timeoutMs) {
        if (this.dead)
            return Promise.resolve({ healthy: false, message: 'plugin worker is no longer running' });
        const id = this.nextId++;
        return new Promise(resolve => {
            const timer = setTimeout(() => {
                this.healthPending.delete(id);
                resolve({ healthy: false, message: 'health check timed out' });
            }, timeoutMs);
            this.healthPending.set(id, { resolve, timer });
            this.channel.postMessage({ kind: 'health-check', id });
        });
    }
    terminate() {
        this.terminated = true;
        return this.channel.terminate();
    }
    handleMessage(message) {
        switch (message.kind) {
            case 'ready':
                this.ready = true;
                this.drain(this.readyWaiters, w => {
                    if (w.timer)
                        clearTimeout(w.timer);
                    w.resolve();
                });
                break;
            case 'error': {
                const error = new Error(message.error);
                this.drain(this.readyWaiters, w => {
                    if (w.timer)
                        clearTimeout(w.timer);
                    w.reject(error);
                });
                break;
            }
            case 'lifecycle-result': {
                const waiter = this.pending.get(message.id);
                if (!waiter)
                    return;
                this.pending.delete(message.id);
                if (waiter.timer)
                    clearTimeout(waiter.timer);
                if (message.ok)
                    waiter.resolve();
                else
                    waiter.reject(new Error(message.error));
                break;
            }
            case 'cap':
                void this.handleCapRequest(message);
                break;
            case 'hook-subscribe':
                this.onHookSubscribe?.(message.event, message.priority);
                break;
            case 'webhook-subscribe':
                this.onWebhookSubscribe?.(message.route);
                break;
            case 'log':
                this.onLog?.(message.level, message.message, message.meta);
                break;
            case 'hook-result': {
                const waiter = this.hookPending.get(message.id);
                if (!waiter)
                    return;
                this.hookPending.delete(message.id);
                clearTimeout(waiter.timer);
                const result = { continue: message.continue };
                if (message.data !== undefined)
                    result.data = message.data;
                if (message.error !== undefined)
                    result.error = message.error;
                waiter.resolve(result);
                break;
            }
            case 'webhook-result': {
                const waiter = this.webhookPending.get(message.id);
                if (!waiter)
                    return;
                this.webhookPending.delete(message.id);
                clearTimeout(waiter.timer);
                waiter.resolve({
                    ok: message.error == null,
                    status: message.status,
                    headers: message.headers,
                    body: message.body,
                    error: message.error,
                });
                break;
            }
            case 'health-result': {
                const waiter = this.healthPending.get(message.id);
                if (!waiter)
                    return;
                this.healthPending.delete(message.id);
                clearTimeout(waiter.timer);
                waiter.resolve({ healthy: message.healthy, message: message.message });
                break;
            }
            case 'search-provider-register':
                this.onSearchProviderRegister?.();
                break;
            case 'search-result': {
                const waiter = this.searchPending.get(message.id);
                if (!waiter)
                    return;
                this.searchPending.delete(message.id);
                clearTimeout(waiter.timer);
                if (message.ok)
                    waiter.resolve({ ok: true, results: message.results });
                else
                    waiter.resolve({ ok: false, error: message.error });
                break;
            }
        }
    }
    async handleCapRequest(message) {
        if (this.maxInFlightCaps !== undefined && this.inFlightCaps >= this.maxInFlightCaps) {
            this.channel.postMessage({
                kind: 'cap-result',
                id: message.id,
                ok: false,
                error: `capability call rejected: too many concurrent capability calls (limit ${this.maxInFlightCaps})`,
            });
            return;
        }
        if (!this.capDispatcher) {
            this.channel.postMessage({ kind: 'cap-result', id: message.id, ok: false, error: 'no capability dispatcher' });
            return;
        }
        this.inFlightCaps++;
        try {
            const dispatcher = this.capDispatcher;
            const run = () => dispatcher(message.verb, message.args);
            const inFlight = [...this.inFlightHookEvents.keys()];
            const work = this.runWithHookGuard && inFlight.length > 0 ? this.runWithHookGuard(inFlight, run) : run();
            const result = await this.withCapTimeout(message.verb, work);
            this.channel.postMessage({ kind: 'cap-result', id: message.id, ok: true, result });
        }
        catch (error) {
            this.channel.postMessage({
                kind: 'cap-result',
                id: message.id,
                ok: false,
                error: error instanceof Error ? error.message : String(error),
            });
        }
        finally {
            this.inFlightCaps--;
        }
    }
    withCapTimeout(verb, work) {
        if (this.capTimeoutMs === undefined)
            return work;
        const timeoutMs = SEND_CAP_VERBS.has(verb) ? this.capTimeoutMs * SEND_CAP_TIMEOUT_FACTOR : this.capTimeoutMs;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                work.then(() => this.onLog?.('warn', `capability '${verb}' settled after the ${timeoutMs}ms host timeout; its late result was discarded`, { action: 'sandbox_cap_late_settle', verb }), (error) => this.onLog?.('warn', `capability '${verb}' failed after the ${timeoutMs}ms host timeout: ${error instanceof Error ? error.message : String(error)}`, { action: 'sandbox_cap_late_settle', verb }));
                reject(new Error(`capability '${verb}' timed out after ${timeoutMs}ms`));
            }, timeoutMs);
            work.then(result => {
                clearTimeout(timer);
                resolve(result);
            }, (error) => {
                clearTimeout(timer);
                reject(error instanceof Error ? error : new Error(String(error)));
            });
        });
    }
    handleExit(code) {
        this.dead = true;
        const error = new Error(`plugin worker exited unexpectedly (code ${code})`);
        this.drain(this.readyWaiters, w => {
            if (w.timer)
                clearTimeout(w.timer);
            w.reject(error);
        });
        this.pending.forEach(waiter => {
            if (waiter.timer)
                clearTimeout(waiter.timer);
            waiter.reject(error);
        });
        this.pending.clear();
        this.healthPending.forEach(({ resolve, timer }) => {
            clearTimeout(timer);
            resolve({ healthy: false, message: 'plugin worker exited' });
        });
        this.healthPending.clear();
        this.hookPending.forEach(({ resolve, timer }) => {
            clearTimeout(timer);
            resolve({ continue: true });
        });
        this.hookPending.clear();
        this.webhookPending.forEach(({ resolve, timer }) => {
            clearTimeout(timer);
            resolve({ ok: false, status: 502 });
        });
        this.webhookPending.clear();
        this.searchPending.forEach(({ resolve, timer }) => {
            clearTimeout(timer);
            resolve({ ok: false, error: 'plugin worker exited' });
        });
        this.searchPending.clear();
        this.onExit?.(code, this.terminated);
    }
    drain(waiters, fn) {
        const current = waiters.splice(0, waiters.length);
        current.forEach(fn);
    }
}
exports.PluginWorkerHost = PluginWorkerHost;
//# sourceMappingURL=plugin-worker-host.js.map