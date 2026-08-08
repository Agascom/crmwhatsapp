"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngressService = void 0;
exports.extractConversationId = extractConversationId;
const node_crypto_1 = require("node:crypto");
const ingress_signature_1 = require("./ingress-signature");
const ingress_preflight_1 = require("./ingress-preflight");
const ingress_ack_1 = require("./ingress-ack");
class IngressService {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async handle(req) {
        const instance = await this.deps.instances.resolve(req.pluginId, req.instanceId);
        if (!instance || !instance.enabled)
            return { status: 404, body: 'unknown instance' };
        const route = this.deps.manifestRoute(req.pluginId, req.route);
        if (!route)
            return { status: 404, body: 'unknown route' };
        if (req.method === 'GET' && route.challenge) {
            const token = req.query[route.challenge.tokenParam];
            const echo = req.query[route.challenge.echoParam];
            if (token && instance.verifyToken && (0, ingress_signature_1.safeEqualStr)(token, instance.verifyToken)) {
                return { status: 200, body: echo ?? '' };
            }
            return { status: 403, body: 'challenge failed' };
        }
        if (Buffer.byteLength(req.rawBody, 'utf8') > route.maxBodyBytes)
            return { status: 413, body: 'payload too large' };
        const verdict = (0, ingress_signature_1.verifyIngressSignature)(route.signature, {
            rawBody: req.rawBody,
            headers: req.headers,
            secret: instance.secret,
            now: this.deps.now(),
            instanceId: req.instanceId,
        });
        if (!verdict.ok)
            return { status: 401, body: verdict.reason ?? 'signature verification failed' };
        const preflight = (0, ingress_preflight_1.evaluatePreflight)(route, instance.sessionScope, this.deps.sessionStatus);
        if (preflight) {
            this.deps.log?.('ingress_preflight_rejected', {
                pluginId: req.pluginId,
                instanceId: req.instanceId,
                route: req.route,
                status: preflight.status,
                sessionScope: instance.sessionScope,
            });
            return { status: preflight.status, body: preflight.body };
        }
        const defaultDedupHeader = route.signature.scheme === 'standard-webhooks' ? 'webhook-id' : 'x-delivery';
        const dedupHeader = (route.dedupHeader ?? route.signature.dedupHeader ?? defaultDedupHeader).toLowerCase();
        const deliveryId = req.headers[dedupHeader] ?? deriveDeliveryId(req);
        const payload = { headers: req.headers, query: req.query, body: req.rawBody, rawBody: req.rawBody };
        const isNew = await this.deps.events.recordOrSkip({
            instanceId: req.instanceId,
            pluginId: req.pluginId,
            providerDeliveryId: deliveryId,
            route: req.route,
            payload,
            payloadHash: (0, node_crypto_1.createHash)('sha256').update(req.rawBody).digest('hex'),
            sessionId: instance.sessionScope,
        });
        if (!isNew)
            return { status: 200, body: 'duplicate' };
        const providerConversationId = extractConversationId(route.conversationId, req.headers, req.rawBody);
        const jobData = {
            pluginId: req.pluginId,
            instanceId: req.instanceId,
            route: req.route,
            method: req.method,
            deliveryId,
            sessionId: instance.sessionScope ?? undefined,
            providerConversationId,
            payload,
        };
        const ack = (0, ingress_ack_1.renderAck)(route.response?.ack, {
            rawBody: req.rawBody,
            timestamp: String(Math.floor(this.deps.now() / 1000)),
            id: deliveryId,
        });
        if (route.response) {
            void this.deps.enqueue(jobData, deliveryId).catch(err => {
                this.deps.log?.('ingress_enqueue_unhandled', {
                    pluginId: req.pluginId,
                    instanceId: req.instanceId,
                    deliveryId,
                    error: err instanceof Error ? err.message : String(err),
                });
            });
        }
        else {
            await this.deps.enqueue(jobData, deliveryId);
        }
        return ack;
    }
}
exports.IngressService = IngressService;
function deriveDeliveryId(req) {
    return (0, node_crypto_1.createHash)('sha256').update([req.pluginId, req.instanceId, req.route, req.rawBody].join('\0')).digest('hex');
}
function extractConversationId(spec, headers, rawBody) {
    if (!spec)
        return undefined;
    if (spec.header) {
        const v = headers[spec.header.toLowerCase()];
        if (v)
            return v;
    }
    if (spec.jsonPointer) {
        try {
            let node = JSON.parse(rawBody);
            for (const seg of spec.jsonPointer.split('/').filter(Boolean)) {
                node = node?.[seg];
            }
            if (typeof node === 'string')
                return node;
            if (typeof node === 'number' || typeof node === 'boolean')
                return String(node);
        }
        catch {
            return undefined;
        }
    }
    return undefined;
}
//# sourceMappingURL=ingress.service.js.map