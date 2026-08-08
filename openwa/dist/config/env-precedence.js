"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BLANK_SHADOWED_ENV_KEYS = void 0;
exports.clearBlankEnv = clearBlankEnv;
exports.recordOsEnvKeys = recordOsEnvKeys;
exports.isOsProvidedEnv = isOsProvidedEnv;
exports.recordPinnedEnvKeys = recordPinnedEnvKeys;
exports.isEnvPinned = isEnvPinned;
exports.BLANK_SHADOWED_ENV_KEYS = [
    'ENGINE_TYPE',
    'DATABASE_TYPE',
    'DATABASE_HOST',
    'DATABASE_PORT',
    'DATABASE_USERNAME',
    'DATABASE_NAME',
    'DATABASE_PASSWORD',
    'POSTGRES_SCHEMA',
    'STORAGE_TYPE',
    'STORAGE_LOCAL_PATH',
    'S3_BUCKET',
    'S3_ENDPOINT',
    'S3_REGION',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
    'S3_ACCESS_KEY',
    'S3_SECRET_KEY',
    'CHAT_MEDIA_ARCHIVE_ENABLED',
    'CHAT_MEDIA_ARCHIVE_MAX_BYTES',
    'CHAT_MEDIA_ARCHIVE_TTL_DAYS',
    'CHAT_MEDIA_ORPHAN_SWEEP_INTERVAL_MS',
    'CHAT_MEDIA_ORPHAN_GRACE_MS',
    'SEND_PACING_ENABLED',
    'SEND_PACING_WARMUP_SCHEDULE',
    'SEND_PACING_COLD_DAILY_CAP',
    'SEND_PACING_BREAKER_THRESHOLD',
    'SEND_PACING_BREAKER_COOLDOWN_MS',
    'MEDIA_CONVERSION_ENABLED',
    'FFMPEG_PATH',
    'MEDIA_CONVERSION_TIMEOUT_MS',
    'MEDIA_CONVERSION_MAX_OUTPUT_BYTES',
    'MEDIA_CONVERSION_CONCURRENCY',
    'NODE_ID',
    'NODE_URL',
    'SESSION_LEASE_TTL_MS',
    'SESSION_LEASE_HEARTBEAT_MS',
    'SESSION_TAKEOVER_SWEEP_MS',
    'SESSION_PROXY_TIMEOUT_MS',
    'AUTOMATION_MAX_PER_SESSION',
    'WEBHOOK_CONTACT_DETAILS',
    'BAILEYS_MARK_ONLINE_ON_CONNECT',
    'BAILEYS_SYNC_FULL_HISTORY',
    'ALLOW_UNSIGNED_INGRESS',
    'STORE_EPHEMERAL_MESSAGES',
    'RESOLVE_LID_TO_PHONE',
    'SIMULATE_TYPING',
    'MCP_ENABLED',
    'SEARCH_ENABLED',
    'SERVE_DASHBOARD',
    'CACHE_ENABLED',
    'DATABASE_LOGGING',
    'MAIN_DATABASE_SYNCHRONIZE',
    'REDIS_ENABLED',
    'REDIS_HOST',
    'REDIS_PORT',
    'PUPPETEER_HEADLESS',
    'SESSION_DATA_PATH',
    'PUPPETEER_ARGS',
    'RATE_LIMIT_SHORT_TTL',
    'RATE_LIMIT_SHORT_LIMIT',
    'RATE_LIMIT_MEDIUM_TTL',
    'RATE_LIMIT_MEDIUM_LIMIT',
    'RATE_LIMIT_LONG_TTL',
    'RATE_LIMIT_LONG_LIMIT',
    'AUTO_START_SESSIONS',
    'BODY_SIZE_LIMIT',
    'API_MASTER_KEY',
    'TRUSTED_PROXIES',
    'CSP_UPGRADE_INSECURE_REQUESTS',
    'WWEBJS_WEB_VERSION',
    'WWEBJS_WEB_VERSION_REMOTE_PATH',
    'WWEBJS_AUTH_TIMEOUT_MS',
];
function clearBlankEnv(env, keys) {
    for (const key of keys) {
        const value = env[key];
        if (value !== undefined && value.trim() === '') {
            delete env[key];
        }
    }
}
let osEnvKeys = null;
function recordOsEnvKeys(env = process.env) {
    osEnvKeys = new Set(Object.keys(env));
}
function isOsProvidedEnv(key) {
    return osEnvKeys === null || osEnvKeys.has(key);
}
let pinnedEnvKeys = null;
function recordPinnedEnvKeys(env = process.env) {
    pinnedEnvKeys = new Set(Object.keys(env));
}
function isEnvPinned(key) {
    return pinnedEnvKeys !== null && pinnedEnvKeys.has(key);
}
//# sourceMappingURL=env-precedence.js.map