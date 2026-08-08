"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WEB_VERSION_SETTLE_MS = exports.WA_VERSION_REGISTRY_URL = void 0;
exports.__resetWebVersionCache = __resetWebVersionCache;
exports.pickSettledWebVersion = pickSettledWebVersion;
exports.resolveCurrentWebVersion = resolveCurrentWebVersion;
exports.resolveWebVersionPin = resolveWebVersionPin;
exports.getEffectiveWebVersionInfo = getEffectiveWebVersionInfo;
const logger_service_1 = require("../common/services/logger.service");
const logger = (0, logger_service_1.createLogger)('WebVersion');
exports.WA_VERSION_REGISTRY_URL = 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/versions.json';
const DEFAULT_REMOTE_TEMPLATE = 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html';
const FAILURE_BACKOFF_MS = 60_000;
exports.WEB_VERSION_SETTLE_MS = 12 * 60 * 60 * 1000;
let cachedCurrentVersion;
let inFlight = null;
let lastFailureAt = 0;
let warnedRemoteTrust = false;
function __resetWebVersionCache() {
    cachedCurrentVersion = undefined;
    inFlight = null;
    lastFailureAt = 0;
    warnedRemoteTrust = false;
}
function warnRemoteTrustOnce(pin) {
    if (warnedRemoteTrust)
        return;
    warnedRemoteTrust = true;
    logger.warn('WhatsApp Web build pinned to remote HTML served into the web.whatsapp.com origin WITHOUT an integrity check', {
        action: 'web_version_remote_pin',
        webVersion: pin.webVersion,
        remotePath: pin.webVersionCache.remotePath,
        optOut: 'set WWEBJS_WEB_VERSION=off for the first-party build served by WhatsApp, or point WWEBJS_WEB_VERSION_REMOTE_PATH at an operator-controlled copy',
    });
}
function buildRemotePin(version) {
    const template = process.env.WWEBJS_WEB_VERSION_REMOTE_PATH?.trim() || DEFAULT_REMOTE_TEMPLATE;
    return {
        webVersion: version,
        webVersionCache: { type: 'remote', remotePath: template.replace('{version}', version) },
    };
}
function pickSettledWebVersion(versions, now, currentVersion) {
    if (!Array.isArray(versions))
        return currentVersion;
    const settledCutoff = now - exports.WEB_VERSION_SETTLE_MS;
    let best = null;
    for (const raw of versions) {
        if (!raw || typeof raw !== 'object')
            continue;
        const e = raw;
        if (typeof e.version !== 'string' || !/^\d/.test(e.version))
            continue;
        if (e.beta === true)
            continue;
        const released = typeof e.released === 'string' ? Date.parse(e.released) : NaN;
        if (!Number.isFinite(released) || released > settledCutoff)
            continue;
        const expire = typeof e.expire === 'string' ? Date.parse(e.expire) : NaN;
        if (Number.isFinite(expire) && expire <= now)
            continue;
        if (!best || best.released < released)
            best = { version: e.version, released };
    }
    return best?.version ?? currentVersion;
}
async function resolveCurrentWebVersion(fetcher = fetch) {
    if (typeof cachedCurrentVersion === 'string')
        return cachedCurrentVersion;
    if (inFlight)
        return inFlight;
    if (lastFailureAt && Date.now() - lastFailureAt < FAILURE_BACKOFF_MS)
        return null;
    inFlight = (async () => {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 5000);
            try {
                const res = await fetcher(exports.WA_VERSION_REGISTRY_URL, { signal: controller.signal });
                if (!res.ok)
                    throw new Error(`HTTP ${res.status}`);
                const json = (await res.json());
                const rawCurrent = typeof json.currentVersion === 'string' && /^\d/.test(json.currentVersion) ? json.currentVersion : null;
                const picked = pickSettledWebVersion(json.versions, Date.now(), rawCurrent);
                if (picked) {
                    cachedCurrentVersion = picked;
                    return picked;
                }
                lastFailureAt = Date.now();
                return null;
            }
            finally {
                clearTimeout(timer);
            }
        }
        catch {
            lastFailureAt = Date.now();
            return null;
        }
        finally {
            inFlight = null;
        }
    })();
    return inFlight;
}
async function resolveWebVersionPin(fetcher = fetch) {
    const raw = process.env.WWEBJS_WEB_VERSION?.trim();
    const lc = raw?.toLowerCase();
    if (raw && lc !== 'off' && lc !== 'latest' && lc !== 'auto') {
        const pin = buildRemotePin(raw);
        warnRemoteTrustOnce(pin);
        return pin;
    }
    if (lc === 'off')
        return undefined;
    const current = await resolveCurrentWebVersion(fetcher);
    if (!current)
        return undefined;
    const pin = buildRemotePin(current);
    warnRemoteTrustOnce(pin);
    return pin;
}
function getEffectiveWebVersionInfo() {
    const raw = process.env.WWEBJS_WEB_VERSION?.trim();
    const lc = raw?.toLowerCase();
    if (raw && lc !== 'off' && lc !== 'latest' && lc !== 'auto')
        return { version: raw, source: 'pinned' };
    if (lc === 'off')
        return { version: null, source: 'native' };
    return { version: cachedCurrentVersion ?? null, source: 'auto' };
}
//# sourceMappingURL=wa-web-version.js.map