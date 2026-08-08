"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("./config/load-env");
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const swagger_1 = require("@nestjs/swagger");
const helmet_1 = __importDefault(require("helmet"));
const app_module_1 = require("./app.module");
const shutdown_service_1 = require("./common/services/shutdown.service");
const logger_service_1 = require("./common/services/logger.service");
const swagger_config_1 = require("./config/swagger.config");
const process_error_monitor_1 = require("./config/process-error-monitor");
const bootstrap_fatal_1 = require("./config/bootstrap-fatal");
const storage_root_1 = require("./config/storage-root");
const http_timeouts_1 = require("./config/http-timeouts");
const inflight_body_budget_1 = require("./config/inflight-body-budget");
const app_validation_1 = require("./config/app-validation");
const request_context_middleware_1 = require("./common/middleware/request-context.middleware");
const dashboard_csp_1 = require("./config/dashboard-csp");
const bootstrap_security_1 = require("./config/bootstrap-security");
const bull_board_auth_middleware_1 = require("./common/security/bull-board-auth.middleware");
const auth_service_1 = require("./modules/auth/auth.service");
const audit_service_1 = require("./modules/audit/audit.service");
const express_1 = require("express");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
const redis_io_adapter_1 = require("./modules/events/redis-io.adapter");
let appInstance;
async function bootstrap() {
    const requestedLevel = process.env.LOG_LEVEL?.trim().toLowerCase();
    if (requestedLevel && Object.values(logger_service_1.LogLevel).includes(requestedLevel)) {
        logger_service_1.LoggerService.setLogLevel(requestedLevel);
    }
    const bootstrapLogger = (0, logger_service_1.createLogger)('Bootstrap');
    (0, process_error_monitor_1.registerUnhandledRejectionHandler)(bootstrapLogger);
    (0, process_error_monitor_1.registerUncaughtExceptionMonitor)(bootstrapLogger);
    (0, bootstrap_security_1.assertNoDefaultSecretsInProduction)({
        nodeEnv: process.env.NODE_ENV,
        databaseType: process.env.DATABASE_TYPE,
        databasePassword: process.env.DATABASE_PASSWORD,
        postgresBuiltIn: process.env.POSTGRES_BUILTIN,
        databaseHost: process.env.DATABASE_HOST,
        storageType: process.env.STORAGE_TYPE,
        minioBuiltIn: process.env.MINIO_BUILTIN,
        s3Endpoint: process.env.S3_ENDPOINT,
        s3AccessKey: process.env.S3_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY,
        s3SecretKey: process.env.S3_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY,
        apiMasterKey: process.env.API_MASTER_KEY,
        allowDevApiKey: process.env.ALLOW_DEV_API_KEY,
        redisPassword: process.env.REDIS_PASSWORD,
    });
    if ((0, bootstrap_security_1.isApiKeyPepperMissingInProduction)(process.env.NODE_ENV, process.env.API_KEY_PEPPER)) {
        bootstrapLogger.warn('API_KEY_PEPPER is not set in production: stored API-key hashes use plain SHA-256. ' +
            'Set API_KEY_PEPPER and re-issue keys to enable HMAC hashing.');
    }
    process.env.STORAGE_LOCAL_PATH = (0, storage_root_1.resolveStorageRoot)({
        configured: process.env.STORAGE_LOCAL_PATH,
        logger: bootstrapLogger,
    });
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { bodyParser: false });
    appInstance = app;
    app.useWebSocketAdapter(new redis_io_adapter_1.RedisIoAdapter(app));
    const inflightBudgetBytes = (0, inflight_body_budget_1.resolveInflightBodyBudgetBytes)(process.env.INFLIGHT_BODY_BUDGET_BYTES, process.env.BODY_SIZE_LIMIT);
    app.use((0, inflight_body_budget_1.createInflightBodyBudget)(inflightBudgetBytes).middleware);
    const bodyLimit = (0, bootstrap_security_1.resolveBodyLimit)(process.env.BODY_SIZE_LIMIT);
    bootstrapLogger.log(`Request body caps: ${bodyLimit} per request, ${inflightBudgetBytes} bytes aggregate in flight`);
    app.use((0, express_1.json)({
        limit: bodyLimit,
        inflate: false,
        verify: (req, _res, buf) => {
            req.rawBody = buf;
        },
    }));
    app.use((0, express_1.urlencoded)({
        extended: true,
        limit: bodyLimit,
        inflate: false,
        verify: (req, _res, buf) => {
            req.rawBody = buf;
        },
    }));
    app.use(request_context_middleware_1.requestContextMiddleware);
    app.enableShutdownHooks(Object.values(common_1.ShutdownSignal).filter(s => s !== common_1.ShutdownSignal.SIGTERM && s !== common_1.ShutdownSignal.SIGINT));
    const shutdownService = app.get(shutdown_service_1.ShutdownService);
    shutdownService.setShutdownCallback(async () => {
        await app.close();
    });
    let signalReceived = false;
    for (const signal of ['SIGTERM', 'SIGINT']) {
        process.on(signal, () => {
            if (signalReceived) {
                process.exit(130);
            }
            signalReceived = true;
            shutdownService.shutdown();
        });
    }
    app.use((req, res, next) => {
        res.locals.cspNonce = (0, crypto_1.randomBytes)(18).toString('base64url');
        next();
    });
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
                scriptSrc: ["'self'", (_req, res) => `'nonce-${res.locals.cspNonce}'`],
                imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
                mediaSrc: ["'self'", 'data:', 'blob:', 'https:'],
                connectSrc: ["'self'"],
                fontSrc: ["'self'", 'https://fonts.gstatic.com'],
                objectSrc: ["'none'"],
                upgradeInsecureRequests: (0, bootstrap_security_1.isUpgradeInsecureRequestsEnabled)(process.env.CSP_UPGRADE_INSECURE_REQUESTS, process.env.NODE_ENV)
                    ? []
                    : null,
            },
        },
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
        },
        noSniff: true,
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
        crossOriginResourcePolicy: { policy: 'cross-origin' },
    }));
    if (app_module_1.dashboardServingEnabled && app_module_1.dashboardBuildPresent) {
        const dashboardIndex = (0, fs_1.readFileSync)((0, path_1.join)(app_module_1.DASHBOARD_DIST, 'index.html'), 'utf8');
        app.use((req, res, next) => {
            const excluded = req.path.startsWith('/api/') ||
                req.path === '/api' ||
                req.path.startsWith('/socket.io/') ||
                req.path === '/socket.io' ||
                req.path.startsWith('/mcp/') ||
                req.path === '/mcp' ||
                req.path.startsWith('/assets/');
            const documentRequest = req.method === 'GET' &&
                !excluded &&
                ((req.headers.accept ?? '').includes('text/html') || (0, path_1.extname)(req.path) === '');
            if (!documentRequest)
                return next();
            res.setHeader('Cache-Control', 'no-store');
            res.type('html').send((0, dashboard_csp_1.injectDashboardCspNonce)(dashboardIndex, res.locals.cspNonce));
        });
    }
    const corsPolicy = (0, bootstrap_security_1.resolveCorsPolicy)(process.env.CORS_ORIGINS, process.env.NODE_ENV);
    if (process.env.NODE_ENV === 'production' && corsPolicy.origins.length === 0 && !corsPolicy.allowAnyOrigin) {
        console.warn('[Bootstrap] No explicit CORS_ORIGINS in production (wildcard "*" is refused): cross-origin browser ' +
            'requests will be blocked. Set CORS_ORIGINS to your dashboard origin(s).');
    }
    app.enableCors({
        origin: (origin, callback) => {
            if (!origin)
                return callback(null, true);
            if (corsPolicy.allowAnyOrigin || corsPolicy.origins.includes(origin)) {
                callback(null, true);
            }
            else {
                callback(null, false);
            }
        },
        credentials: corsPolicy.credentials,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'X-API-Key', 'Authorization', 'X-Request-ID'],
        exposedHeaders: [
            'X-RateLimit-Limit-short',
            'X-RateLimit-Remaining-short',
            'X-RateLimit-Reset-short',
            'X-RateLimit-Limit-medium',
            'X-RateLimit-Remaining-medium',
            'X-RateLimit-Reset-medium',
            'X-RateLimit-Limit-long',
            'X-RateLimit-Remaining-long',
            'X-RateLimit-Reset-long',
            'X-RateLimit-Limit-instance',
            'X-RateLimit-Remaining-instance',
            'X-RateLimit-Reset-instance',
            'Retry-After-short',
            'Retry-After-medium',
            'Retry-After-long',
            'Retry-After-instance',
        ],
        maxAge: 86400,
    });
    (0, app_validation_1.applyGlobalValidation)(app);
    const swaggerEnabled = (0, bootstrap_security_1.isSwaggerEnabled)(process.env.ENABLE_SWAGGER, process.env.NODE_ENV);
    if (swaggerEnabled) {
        const config = (0, swagger_config_1.createSwaggerConfig)();
        const document = swagger_1.SwaggerModule.createDocument(app, config);
        (0, swagger_config_1.dropUnexpressibleOperations)(document);
        (0, swagger_config_1.exemptPublicOperations)(document);
        swagger_1.SwaggerModule.setup('api/docs', app, document);
    }
    const bullBoardAuth = new bull_board_auth_middleware_1.BullBoardAuthMiddleware(app.get(auth_service_1.AuthService), app.get(config_1.ConfigService), app.get(audit_service_1.AuditService));
    app.use('/api/admin/queues', (req, res, next) => {
        void bullBoardAuth.use(req, res, next);
    });
    const appliedHttpTimeouts = (0, http_timeouts_1.applyHttpTimeouts)(app.getHttpServer(), app.get(config_1.ConfigService).get('http'));
    bootstrapLogger.log(`HTTP server timeouts applied: requestTimeout=${appliedHttpTimeouts.requestTimeoutMs}ms ` +
        `headersTimeout=${appliedHttpTimeouts.headersTimeoutMs}ms keepAliveTimeout=${appliedHttpTimeouts.keepAliveTimeoutMs}ms`);
    const port = process.env.PORT || 2785;
    await app.listen(port);
    const publicUrl = process.env.BASE_URL || `http://localhost:${port}`;
    console.log(`🚀 OpenWA is running on: ${publicUrl}`);
    if (swaggerEnabled) {
        console.log(`📚 Swagger docs: ${publicUrl}/api/docs`);
    }
    if (!app_module_1.dashboardServingEnabled) {
        console.log('🖥️  Dashboard: serving disabled (SERVE_DASHBOARD=false); API only');
    }
    else if (app_module_1.dashboardBuildPresent) {
        console.log(`🖥️  Dashboard: serving bundled UI at ${publicUrl}`);
    }
    else {
        console.warn(`⚠️  Dashboard: no build at ${app_module_1.DASHBOARD_DIST} - UI disabled (API still serves /api). ` +
            'Run `npm run build:all` to bundle it, or use the Vite dev server (`npm run dev`).');
    }
    if ((0, bootstrap_security_1.isDashboardCspUpgradeTrapLikely)({
        nodeEnv: process.env.NODE_ENV,
        cspEnv: process.env.CSP_UPGRADE_INSECURE_REQUESTS,
        dashboardServed: app_module_1.dashboardServingEnabled && app_module_1.dashboardBuildPresent,
    })) {
        console.warn('⚠️  Dashboard: CSP upgrade-insecure-requests is ON (production default). If this instance is ' +
            "reached over plain HTTP, the browser will upgrade the UI's scripts to https:// and the " +
            'dashboard will render blank. Behind a TLS proxy? Ignore this. Serving direct HTTP? Set ' +
            'CSP_UPGRADE_INSECURE_REQUESTS=false.');
    }
}
void (0, bootstrap_fatal_1.runBootstrapOrExit)(bootstrap, {
    logger: (0, logger_service_1.createLogger)('Bootstrap'),
    closeApp: () => (appInstance ? appInstance.close() : Promise.resolve()),
});
//# sourceMappingURL=main.js.map