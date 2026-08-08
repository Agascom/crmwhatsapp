"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sqliteDataMainPathCollision = sqliteDataMainPathCollision;
exports.validateEnv = validateEnv;
const path_1 = require("path");
const MAIN_DB_DEFAULT_PATH = './data/main.sqlite';
function sqliteDataMainPathCollision(config) {
    const read = (key) => {
        const value = config[key];
        return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
    };
    const dbType = read('DATABASE_TYPE');
    if (dbType !== undefined && dbType !== 'sqlite')
        return null;
    const dataDbName = read('DATABASE_NAME');
    if (!dataDbName)
        return null;
    const mainDbPath = read('MAIN_DATABASE_NAME') || MAIN_DB_DEFAULT_PATH;
    if ((0, path_1.resolve)(dataDbName) === (0, path_1.resolve)(mainDbPath)) {
        return `DATABASE_NAME must not point at the main database file (${mainDbPath}); use a separate file`;
    }
    return null;
}
function validateEnv(config) {
    const errors = [];
    const str = (key) => {
        const value = config[key];
        return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
    };
    const dbType = str('DATABASE_TYPE');
    if (dbType && dbType !== 'sqlite' && dbType !== 'postgres') {
        errors.push(`DATABASE_TYPE must be "sqlite" or "postgres" (got "${dbType}")`);
    }
    const checkEnum = (key, allowed) => {
        const value = str(key);
        if (value !== undefined && !allowed.includes(value)) {
            errors.push(`${key} must be one of ${allowed.map(v => `"${v}"`).join(', ')} (got "${value}")`);
        }
    };
    checkEnum('ENGINE_TYPE', ['whatsapp-web.js', 'baileys']);
    checkEnum('STORAGE_TYPE', ['local', 's3']);
    if (dbType === 'postgres') {
        for (const key of ['DATABASE_HOST', 'DATABASE_USERNAME', 'DATABASE_PASSWORD']) {
            if (!str(key)) {
                errors.push(`${key} is required when DATABASE_TYPE=postgres`);
            }
        }
        if (config['DATABASE_SYNCHRONIZE'] === 'true') {
            errors.push('DATABASE_SYNCHRONIZE=true is not allowed with DATABASE_TYPE=postgres: the Postgres data connection always runs migrations, and synchronize would drop the migration-created body_ts tsvector column that /search depends on (returns 501 on every restart). Set DATABASE_SYNCHRONIZE=false (the production default) and manage the schema via migrations.');
        }
        const pgSchema = str('POSTGRES_SCHEMA');
        if (pgSchema !== undefined) {
            if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(pgSchema)) {
                errors.push(`POSTGRES_SCHEMA must be a valid Postgres identifier (a letter or underscore, then letters/digits/underscores, max 63 chars; got ${JSON.stringify(pgSchema)})`);
            }
            else if (pgSchema.toLowerCase().startsWith('pg_')) {
                errors.push(`POSTGRES_SCHEMA must not use the reserved "pg_" prefix (got ${JSON.stringify(pgSchema)})`);
            }
        }
    }
    else {
        const collision = sqliteDataMainPathCollision(config);
        if (collision) {
            errors.push(collision);
        }
        const dataDbName = str('DATABASE_NAME');
        if (dataDbName && !dataDbName.includes('/') && !dataDbName.includes('\\') && !/\.(sqlite|db)$/i.test(dataDbName)) {
            errors.push(`DATABASE_NAME must be a file path under the data volume for SQLite (e.g. ./data/openwa.sqlite); got ${JSON.stringify(dataDbName)}. A bare name is the PostgreSQL DB name — leave DATABASE_NAME unset for SQLite to use the default ./data/openwa.sqlite.`);
        }
    }
    const DECIMAL_INTEGER = /^\d+$/;
    const checkPort = (key) => {
        const raw = str(key);
        if (raw === undefined)
            return;
        const n = DECIMAL_INTEGER.test(raw) ? Number(raw) : NaN;
        if (!Number.isInteger(n) || n < 1 || n > 65535) {
            errors.push(`${key} must be an integer port in [1, 65535] (got "${raw}")`);
        }
    };
    checkPort('PORT');
    checkPort('DATABASE_PORT');
    checkPort('REDIS_PORT');
    const checkNonNegativeInt = (key) => {
        const raw = str(key);
        if (raw === undefined)
            return;
        const n = DECIMAL_INTEGER.test(raw) ? Number(raw) : NaN;
        if (!Number.isInteger(n) || n < 0) {
            errors.push(`${key} must be a non-negative integer (got "${raw}")`);
        }
    };
    for (const key of [
        'RATE_LIMIT_SHORT_TTL',
        'RATE_LIMIT_MEDIUM_TTL',
        'RATE_LIMIT_LONG_TTL',
        'WEBHOOK_RETRY_DELAY',
        'DATABASE_POOL_SIZE',
        'DATABASE_STATEMENT_TIMEOUT_MS',
        'DATABASE_IDLE_TIMEOUT_MS',
        'DATABASE_CONNECTION_TIMEOUT_MS',
        'REDIS_CONNECT_TIMEOUT_MS',
        'MAX_CONCURRENT_SESSIONS',
        'INGRESS_INSTANCE_TTL',
        'WEBHOOK_DISPATCH_MAX_QUEUED',
        'STATS_CACHE_TTL_MS',
        'WEBHOOK_MAX_PER_SESSION',
        'AUTOMATION_MAX_PER_SESSION',
        'WEBHOOK_MEDIA_INLINE_MAX_BYTES',
        'EXPORT_INLINE_MEDIA_BUDGET_BYTES',
    ]) {
        checkNonNegativeInt(key);
    }
    const checkPositiveInt = (key) => {
        const raw = str(key);
        if (raw === undefined)
            return;
        const n = DECIMAL_INTEGER.test(raw) ? Number(raw) : NaN;
        if (!Number.isInteger(n) || n < 1) {
            errors.push(`${key} must be a positive integer (got "${raw}")`);
        }
    };
    for (const key of [
        'RATE_LIMIT_SHORT_LIMIT',
        'RATE_LIMIT_MEDIUM_LIMIT',
        'RATE_LIMIT_LONG_LIMIT',
        'WS_RATE_LIMIT_FRAME_PER_SECOND',
        'WS_RATE_LIMIT_FRAME_BURST',
        'WS_RATE_LIMIT_HANDSHAKE_MAX',
        'WS_RATE_LIMIT_HANDSHAKE_WINDOW_MS',
        'WS_MAX_SOCKETS_PER_KEY',
        'WEBHOOK_TIMEOUT',
        'INGRESS_INSTANCE_LIMIT',
        'REQUEST_TIMEOUT_MS',
        'HEADERS_TIMEOUT_MS',
        'KEEPALIVE_TIMEOUT_MS',
        'WEBHOOK_DISPATCH_CONCURRENCY',
        'WEBHOOK_MAX_PAYLOAD_BYTES',
        'INFLIGHT_BODY_BUDGET_BYTES',
        'MEDIA_CONVERSION_TIMEOUT_MS',
        'MEDIA_CONVERSION_MAX_OUTPUT_BYTES',
        'MEDIA_CONVERSION_CONCURRENCY',
        'SESSION_LEASE_TTL_MS',
        'SESSION_LEASE_HEARTBEAT_MS',
        'SESSION_TAKEOVER_SWEEP_MS',
        'SESSION_PROXY_TIMEOUT_MS',
    ]) {
        checkPositiveInt(key);
    }
    const leaseTtlMs = Number(str('SESSION_LEASE_TTL_MS') ?? '60000');
    const heartbeatMs = Number(str('SESSION_LEASE_HEARTBEAT_MS') ?? '20000');
    if (Number.isInteger(leaseTtlMs) && Number.isInteger(heartbeatMs) && heartbeatMs * 2 >= leaseTtlMs) {
        errors.push(`SESSION_LEASE_HEARTBEAT_MS (${heartbeatMs}) must be less than half of SESSION_LEASE_TTL_MS (${leaseTtlMs}) ` +
            'so a renewal that is late or fails once still lands inside the lease');
    }
    const nodeUrl = str('NODE_URL');
    if (nodeUrl) {
        let parsed;
        try {
            parsed = new URL(nodeUrl);
        }
        catch {
            parsed = undefined;
        }
        if (!parsed || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
            errors.push(`NODE_URL must be an absolute http(s) URL (got "${nodeUrl}")`);
        }
        else if (parsed.username || parsed.password) {
            errors.push('NODE_URL must not embed credentials — the forwarder cannot send a URL with a userinfo component');
        }
    }
    const checkBool = (key) => {
        const raw = config[key];
        if (raw === undefined)
            return;
        if (typeof raw !== 'string') {
            errors.push(`${key} must be "true" or "false"`);
            return;
        }
        if (raw.trim() === '')
            return;
        if (raw !== 'true' && raw !== 'false') {
            errors.push(`${key} must be "true" or "false" (got ${JSON.stringify(raw)})`);
        }
    };
    for (const key of [
        'QUEUE_ENABLED',
        'MCP_ENABLED',
        'SERVE_DASHBOARD',
        'AUTO_START_SESSIONS',
        'STATUS_SEED_ON_READY',
        'STORE_EPHEMERAL_MESSAGES',
        'RESOLVE_LID_TO_PHONE',
        'SIMULATE_TYPING',
        'SEARCH_ENABLED',
        'REDIS_ENABLED',
        'PLUGIN_DOWNLOAD_ALLOW_INSECURE_REDIRECTS',
        'SEND_PACING_ENABLED',
        'MEDIA_CONVERSION_ENABLED',
        'CHAT_MEDIA_ARCHIVE_ENABLED',
        'DATABASE_SSL',
        'DATABASE_SSL_REJECT_UNAUTHORIZED',
        'MAIN_DATABASE_SYNCHRONIZE',
        'ALLOW_UNSIGNED_INGRESS',
        'ALLOW_DEV_API_KEY',
        'WEBHOOK_SSRF_PROTECT',
        'WEBHOOK_CONTACT_DETAILS',
        'BAILEYS_SYNC_FULL_HISTORY',
        'BAILEYS_MARK_ONLINE_ON_CONNECT',
        'POSTGRES_BUILTIN',
        'REDIS_BUILTIN',
        'MINIO_BUILTIN',
        'CACHE_ENABLED',
        'DATABASE_LOGGING',
    ]) {
        checkBool(key);
    }
    const LENIENT_BOOL_VALUES = new Set(['true', '1', 'yes', 'false', '0', 'no']);
    const lenientBoolKey = 'MEDIA_DOWNLOAD_ENABLED';
    const lenientRaw = config[lenientBoolKey];
    if (lenientRaw !== undefined) {
        if (typeof lenientRaw !== 'string') {
            errors.push(`${lenientBoolKey} must be one of true/false/1/0/yes/no`);
        }
        else {
            const normalized = lenientRaw.trim().toLowerCase();
            if (normalized !== '' && !LENIENT_BOOL_VALUES.has(normalized)) {
                errors.push(`${lenientBoolKey} must be one of true/false/1/0/yes/no (got ${JSON.stringify(lenientRaw)}) — ` +
                    'an unrecognised value silently means ENABLED');
            }
        }
    }
    const provider = config['SEARCH_PROVIDER'];
    if (provider !== undefined && provider !== '' && !['auto', 'builtin-fts', 'none'].includes(provider)) {
        errors.push(`SEARCH_PROVIDER must be one of: auto, builtin-fts, none (got ${JSON.stringify(provider)})`);
    }
    if (errors.length > 0) {
        throw new Error(`Invalid environment configuration:\n  - ${errors.join('\n  - ')}`);
    }
    return config;
}
//# sourceMappingURL=env.validation.js.map