"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseBodyLimitBytes = parseBodyLimitBytes;
exports.resolveInflightBodyBudgetBytes = resolveInflightBodyBudgetBytes;
exports.createInflightBodyBudget = createInflightBodyBudget;
const bootstrap_security_1 = require("./bootstrap-security");
const DEFAULT_BUDGET_MULTIPLIER = 4;
const UNIT_BYTES = {
    b: 1,
    kb: 1024,
    mb: 1024 ** 2,
    gb: 1024 ** 3,
    tb: 1024 ** 4,
    pb: 1024 ** 5,
};
const FALLBACK_LIMIT_BYTES = 25 * UNIT_BYTES.mb;
const STALL_TIMEOUT_MS = 15_000;
const STALL_POLL_MS = 5_000;
const UNDECLARED_OPENING_RESERVATION_BYTES = 1024 * 1024;
function parseBodyLimitBytes(limit) {
    const match = /^(\d+(?:\.\d+)?)\s?(b|kb|mb|gb|tb|pb)?$/i.exec(limit.trim());
    if (!match)
        return FALLBACK_LIMIT_BYTES;
    return Math.floor(parseFloat(match[1]) * UNIT_BYTES[(match[2] ?? 'b').toLowerCase()]);
}
function resolveInflightBodyBudgetBytes(budgetEnv, bodyLimitEnv) {
    const raw = budgetEnv?.trim();
    if (raw) {
        const explicit = Number(raw);
        if (Number.isInteger(explicit) && explicit > 0)
            return explicit;
    }
    return DEFAULT_BUDGET_MULTIPLIER * parseBodyLimitBytes((0, bootstrap_security_1.resolveBodyLimit)(bodyLimitEnv));
}
function createInflightBodyBudget(budgetBytes, options) {
    let inFlightBytes = 0;
    const retryAfter = String(options?.retryAfterSeconds ?? 1);
    const undeclaredReservation = Math.max(1, Math.min(UNDECLARED_OPENING_RESERVATION_BYTES, budgetBytes));
    const rejectBusy = (req, res) => {
        if (res.headersSent || res.writableEnded) {
            req.destroy();
            return;
        }
        res
            .status(503)
            .set('Retry-After', retryAfter)
            .set('Connection', 'close')
            .json({ statusCode: 503, message: 'Too much request body data in flight; retry later' });
    };
    const rejectCompressed = (req, res) => {
        if (res.headersSent || res.writableEnded) {
            req.destroy();
            return;
        }
        res.status(415).set('Connection', 'close').json({
            statusCode: 415,
            message: 'Compressed request bodies are not supported',
            error: 'Unsupported Media Type',
        });
    };
    const middleware = (req, res, next) => {
        const declared = parseDeclaredLength(req.headers['content-length']);
        let reserved = declared ?? (req.headers['transfer-encoding'] !== undefined ? undeclaredReservation : 0);
        const bodyIndicated = req.headers['transfer-encoding'] !== undefined || !Number.isNaN(Number(req.headers['content-length']));
        const encoding = (req.headers['content-encoding'] ?? '').trim().toLowerCase();
        if (bodyIndicated && encoding !== '' && encoding !== 'identity') {
            rejectCompressed(req, res);
            return;
        }
        if (inFlightBytes + reserved > budgetBytes) {
            rejectBusy(req, res);
            return;
        }
        inFlightBytes += reserved;
        let released = false;
        let stallTimer;
        const disarmStallReaper = () => {
            if (stallTimer === undefined)
                return;
            clearInterval(stallTimer);
            stallTimer = undefined;
        };
        const release = () => {
            if (released)
                return;
            released = true;
            disarmStallReaper();
            inFlightBytes -= reserved;
        };
        res.on('finish', release);
        res.on('close', release);
        res.on('error', release);
        req.on('close', release);
        req.on('error', release);
        if (reserved > 0) {
            const socket = req.socket;
            const startBytes = socket.bytesRead;
            let lastBytes = startBytes;
            let lastProgress = Date.now();
            const reconcileUndeclared = (readNow) => {
                const actual = Math.max(undeclaredReservation, readNow - startBytes);
                if (actual === reserved)
                    return;
                inFlightBytes += actual - reserved;
                reserved = actual;
                if (inFlightBytes > budgetBytes) {
                    release();
                    req.destroy();
                }
            };
            stallTimer = setInterval(() => {
                if (req.complete) {
                    disarmStallReaper();
                    return;
                }
                const readNow = socket.bytesRead;
                if (readNow !== lastBytes) {
                    if (declared === undefined)
                        reconcileUndeclared(readNow);
                    lastBytes = readNow;
                    lastProgress = Date.now();
                    if (declared !== undefined && readNow - startBytes >= declared)
                        disarmStallReaper();
                    return;
                }
                if (Date.now() - lastProgress >= STALL_TIMEOUT_MS) {
                    release();
                    req.destroy();
                }
            }, STALL_POLL_MS);
            stallTimer.unref();
            req.on('end', disarmStallReaper);
        }
        next();
    };
    return { middleware, currentBytes: () => inFlightBytes };
}
function parseDeclaredLength(raw) {
    if (raw === undefined)
        return undefined;
    const n = Number(raw.trim());
    return Number.isSafeInteger(n) && n >= 0 ? n : undefined;
}
//# sourceMappingURL=inflight-body-budget.js.map