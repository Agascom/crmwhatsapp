"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyHttpTimeouts = applyHttpTimeouts;
function applyHttpTimeouts(server, cfg) {
    const requestTimeoutMs = Math.floor(cfg.requestTimeoutMs);
    const keepAliveTimeoutMs = Math.floor(cfg.keepAliveTimeoutMs);
    const requestedHeadersMs = Math.floor(cfg.headersTimeoutMs);
    const headersTimeoutMs = requestedHeadersMs > keepAliveTimeoutMs ? requestedHeadersMs : keepAliveTimeoutMs + 1000;
    server.requestTimeout = requestTimeoutMs;
    server.headersTimeout = headersTimeoutMs;
    server.keepAliveTimeout = keepAliveTimeoutMs;
    return { requestTimeoutMs, headersTimeoutMs, keepAliveTimeoutMs };
}
//# sourceMappingURL=http-timeouts.js.map