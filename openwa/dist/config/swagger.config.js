"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PUBLIC_PATHS = exports.METRICS_BEARER_SCHEME = exports.API_KEY_SECURITY_SCHEME = void 0;
exports.dropUnexpressibleOperations = dropUnexpressibleOperations;
exports.exemptPublicOperations = exemptPublicOperations;
exports.createSwaggerConfig = createSwaggerConfig;
const swagger_1 = require("@nestjs/swagger");
exports.API_KEY_SECURITY_SCHEME = 'X-API-Key';
exports.METRICS_BEARER_SCHEME = 'metrics-bearer';
exports.PUBLIC_PATHS = [
    '/api/health',
    '/api/health/live',
    '/api/health/ready',
    '/api/infra/health',
    '/api/ingress/{pluginId}/{instanceId}/{path}',
];
const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace', 'search'];
const OPENAPI_3_PATH_ITEM_FIELDS = new Set([
    '$ref',
    'summary',
    'description',
    'get',
    'put',
    'post',
    'delete',
    'options',
    'head',
    'patch',
    'trace',
    'servers',
    'parameters',
]);
function dropUnexpressibleOperations(document) {
    for (const item of Object.values(document.paths ?? {})) {
        for (const field of Object.keys(item)) {
            if (!OPENAPI_3_PATH_ITEM_FIELDS.has(field) && !field.startsWith('x-')) {
                delete item[field];
            }
        }
    }
    return document;
}
function exemptPublicOperations(document) {
    for (const path of exports.PUBLIC_PATHS) {
        const item = document.paths?.[path];
        if (!item)
            continue;
        for (const method of HTTP_METHODS) {
            const op = item[method];
            if (op)
                op.security = [];
        }
    }
    return document;
}
function createSwaggerConfig() {
    const { version } = require('../../package.json');
    return (new swagger_1.DocumentBuilder()
        .setTitle('OpenWA API')
        .setDescription('Open Source WhatsApp API Gateway - Free, Self-Hosted HTTP API\n\n' +
        '**Gateway-wide responses.** Two statuses are returned by middleware before routing, ' +
        'so any operation can emit them:\n\n' +
        '- `415 Unsupported Media Type` — the request body carries a `Content-Encoding` other ' +
        'than `identity`. The aggregate in-flight body cap counts wire bytes, so a compressed ' +
        'body would be admitted on its compressed size and then inflated past the memory it is ' +
        'meant to bound. Send the body uncompressed.\n' +
        '- `503 Service Unavailable` with `Retry-After` — the gateway already has too much ' +
        'request body data in flight. The body is not read; retry after the given delay.')
        .setVersion(version)
        .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, exports.API_KEY_SECURITY_SCHEME)
        .addBearerAuth({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'opaque',
        description: 'METRICS_TOKEN for the GET /api/metrics scrape endpoint',
    }, exports.METRICS_BEARER_SCHEME)
        .addSecurityRequirements(exports.API_KEY_SECURITY_SCHEME)
        .setContact('OpenWA', 'https://github.com/rmyndharis/OpenWA', 'yudhi@rmyndharis.com')
        .addTag('sessions', 'WhatsApp session management')
        .addTag('messages', 'Send and manage messages')
        .addTag('webhooks', 'Webhook configuration')
        .addTag('contacts', 'Contact management')
        .addTag('groups', 'Group management')
        .addTag('labels', 'Label management (WhatsApp Business)')
        .addTag('channels', 'Channel/Newsletter management')
        .addTag('catalog', 'Product catalog (WhatsApp Business)')
        .addTag('status', 'Status/Stories')
        .addTag('calls', 'Call handling')
        .addTag('profile', 'Own profile management')
        .addTag('search', 'Global message search')
        .addTag('statistics', 'Usage statistics')
        .addTag('templates', 'Message templates')
        .addTag('plugins', 'Plugin management')
        .addTag('settings', 'Application settings')
        .addTag('infrastructure', 'Infrastructure & datastore management')
        .addTag('integration', 'Integration Fabric (provider webhooks & instances)')
        .addTag('auth', 'API key management')
        .addTag('audit', 'Audit log')
        .addTag('metrics', 'Prometheus metrics')
        .addTag('health', 'Health check endpoints')
        .addServer('/', 'This instance (the origin serving these docs)')
        .addServer('http://{host}:{port}', 'Another instance (set host and port)', {
        host: { default: 'localhost' },
        port: { default: '2785', description: 'PORT env var' },
    })
        .build());
}
//# sourceMappingURL=swagger.config.js.map