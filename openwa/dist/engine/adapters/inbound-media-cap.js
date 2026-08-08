"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inboundMediaMaxBytes = inboundMediaMaxBytes;
exports.inboundMediaConcurrency = inboundMediaConcurrency;
exports.inboundMediaTimeoutMs = inboundMediaTimeoutMs;
exports.withInboundDownloadTimeout = withInboundDownloadTimeout;
exports.isMediaDownloadEnabled = isMediaDownloadEnabled;
exports.chatHistoryMediaBudgetBytes = chatHistoryMediaBudgetBytes;
exports.ingestMediaBudgetBytes = ingestMediaBudgetBytes;
exports.coerceDeclaredSize = coerceDeclaredSize;
exports.capInboundMedia = capInboundMedia;
const DEFAULT_INBOUND_MEDIA_MAX_BYTES = 50 * 1024 * 1024;
function inboundMediaMaxBytes() {
    const parsed = Number.parseInt(process.env.MEDIA_DOWNLOAD_MAX_BYTES ?? '', 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_INBOUND_MEDIA_MAX_BYTES;
}
const DEFAULT_INBOUND_MEDIA_CONCURRENCY = 4;
function inboundMediaConcurrency() {
    const parsed = Number.parseInt(process.env.INBOUND_MEDIA_CONCURRENCY ?? '', 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_INBOUND_MEDIA_CONCURRENCY;
}
const DEFAULT_INBOUND_MEDIA_TIMEOUT_MS = 30_000;
function inboundMediaTimeoutMs() {
    const parsed = Number.parseInt(process.env.MEDIA_DOWNLOAD_TIMEOUT_MS ?? '', 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_INBOUND_MEDIA_TIMEOUT_MS;
}
function withInboundDownloadTimeout(promise, timeoutMs, onTimeout) {
    let timer;
    const timeout = new Promise(resolve => {
        timer = setTimeout(() => {
            onTimeout?.();
            resolve(null);
        }, timeoutMs);
        timer.unref?.();
    });
    promise.catch(() => undefined);
    return Promise.race([promise, timeout]).finally(() => {
        if (timer)
            clearTimeout(timer);
    });
}
function isMediaDownloadEnabled() {
    const val = (process.env.MEDIA_DOWNLOAD_ENABLED ?? '').trim().toLowerCase();
    return val !== 'false' && val !== '0' && val !== 'no';
}
const DEFAULT_CHAT_HISTORY_MEDIA_BUDGET_BYTES = 25 * 1024 * 1024;
function chatHistoryMediaBudgetBytes() {
    const parsed = Number.parseInt(process.env.CHAT_HISTORY_MEDIA_BUDGET_BYTES ?? '', 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_CHAT_HISTORY_MEDIA_BUDGET_BYTES;
}
const INGEST_MEDIA_BUDGET_ITEMS = 4;
function ingestMediaBudgetBytes(perItemMaxBytes) {
    if (!Number.isFinite(perItemMaxBytes) || perItemMaxBytes <= 0)
        return chatHistoryMediaBudgetBytes();
    return Math.max(chatHistoryMediaBudgetBytes(), Math.ceil(perItemMaxBytes * INGEST_MEDIA_BUDGET_ITEMS * 1.37));
}
function coerceDeclaredSize(value) {
    if (typeof value === 'number')
        return Number.isFinite(value) ? value : 0;
    if (value && typeof value.toNumber === 'function') {
        const n = value.toNumber();
        return Number.isFinite(n) ? n : 0;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}
function capInboundMedia(args) {
    const max = args.maxBytes ?? inboundMediaMaxBytes();
    if (args.sizeBytes > max) {
        return { mimetype: args.mimetype, filename: args.filename, omitted: true, sizeBytes: args.sizeBytes };
    }
    return { mimetype: args.mimetype, filename: args.filename, data: args.toBase64() };
}
//# sourceMappingURL=inbound-media-cap.js.map