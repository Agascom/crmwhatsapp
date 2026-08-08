"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RECONNECT_DELAY_CAP_MS = exports.RECONNECT_LOOP_ALERT_INTERVAL_ATTEMPTS = exports.RECONNECT_STABILITY_RESET_MS = void 0;
exports.clampReconnectDelay = clampReconnectDelay;
exports.decideReconnect = decideReconnect;
exports.RECONNECT_STABILITY_RESET_MS = 300_000;
exports.RECONNECT_LOOP_ALERT_INTERVAL_ATTEMPTS = 5;
exports.RECONNECT_DELAY_CAP_MS = 3_600_000;
function clampNumber(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
function clampReconnectDelay(rawDelay, baseDelay) {
    return clampNumber(Number.isFinite(rawDelay) ? rawDelay : baseDelay, 0, exports.RECONNECT_DELAY_CAP_MS);
}
function decideReconnect(state, now = Date.now(), jitter = Math.random() * 1000) {
    let stabilityReset = false;
    if (state.lastAttemptAt !== undefined && now - state.lastAttemptAt >= exports.RECONNECT_STABILITY_RESET_MS) {
        state.attempts = 0;
        stabilityReset = true;
    }
    if (state.attempts >= state.maxAttempts) {
        return {
            kind: 'exhausted',
            reason: state.maxAttempts === 0
                ? 'Auto-reconnect is disabled (max attempts set to 0); the session was left disconnected — restart it manually.'
                : `Reconnection failed after ${state.attempts} attempts — restart the session.`,
        };
    }
    const delayMs = clampReconnectDelay(state.baseDelay * Math.pow(2, state.attempts) + jitter, state.baseDelay);
    state.attempts++;
    state.lastAttemptAt = now;
    return {
        kind: 'schedule',
        delayMs,
        attempt: state.attempts,
        loopAlert: state.attempts > 0 && state.attempts % exports.RECONNECT_LOOP_ALERT_INTERVAL_ATTEMPTS === 0,
        stabilityReset,
    };
}
//# sourceMappingURL=reconnect-policy.js.map