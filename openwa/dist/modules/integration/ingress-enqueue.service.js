"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngressEnqueueService = void 0;
exports.resolveIngressJobOptions = resolveIngressJobOptions;
exports.buildIngressDeadLetterRow = buildIngressDeadLetterRow;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const plugin_loader_service_1 = require("../../core/plugins/plugin-loader.service");
const queue_names_1 = require("../queue/queue-names");
const logger_service_1 = require("../../common/services/logger.service");
const configuration_1 = require("../../config/configuration");
function resolveIngressJobOptions() {
    const attempts = Number(process.env.INGRESS_MAX_ATTEMPTS);
    return {
        attempts: Number.isInteger(attempts) && attempts >= 1 ? attempts : 3,
        backoff: { type: 'exponential', delay: (0, configuration_1.resolveNonNegativeIntEnv)(process.env.INGRESS_RETRY_DELAY_MS, 5000) },
    };
}
function buildIngressDeadLetterRow(data, error) {
    return {
        direction: 'inbound',
        pluginId: data.pluginId,
        instanceId: data.instanceId,
        sessionId: data.sessionId ?? null,
        deliveryId: data.deliveryId,
        attempts: 1,
        lastError: error ?? 'inline ingress dispatch failed',
        payload: {
            route: data.route,
            method: data.method,
            providerConversationId: data.providerConversationId,
            ingress: data.payload,
        },
        redriven: false,
    };
}
let IngressEnqueueService = class IngressEnqueueService {
    loader;
    config;
    ingressQueue;
    logger = (0, logger_service_1.createLogger)('IngressEnqueueService');
    constructor(loader, config, ingressQueue) {
        this.loader = loader;
        this.config = config;
        this.ingressQueue = ingressQueue;
    }
    onApplicationBootstrap() {
        if (process.env.QUEUE_ENABLED === 'true' && !this.ingressQueue) {
            throw new Error(`QUEUE_ENABLED=true but the '${queue_names_1.QUEUE_NAMES.INGRESS}' BullMQ queue did not resolve — ` +
                'IntegrationModule must import QueueModule (see the QUEUE_ENABLED conditional in integration.module.ts). ' +
                'Refusing to boot: ingress deliveries would silently dispatch inline, defeating the queued-dispatch contract.');
        }
    }
    async enqueue(data, jobId) {
        const queueEnabled = this.config.get('queue.enabled', false);
        const useQueue = queueEnabled && !!this.ingressQueue;
        if (useQueue && this.ingressQueue) {
            try {
                await this.ingressQueue.add('ingress', data, { jobId, ...resolveIngressJobOptions() });
                return { outcome: 'queued' };
            }
            catch (err) {
                this.logger.error('Ingress queue add failed; dispatching inline', err instanceof Error ? err.message : String(err), {
                    pluginId: data.pluginId,
                    instanceId: data.instanceId,
                    route: data.route,
                    deliveryId: data.deliveryId,
                    action: 'ingress_queue_add_failed',
                });
            }
        }
        try {
            await this.loader.dispatchWebhookForInstance(data);
            return { outcome: 'dispatched' };
        }
        catch (err) {
            const error = err instanceof Error ? err.message : String(err);
            this.logger.error('Inline ingress dispatch failed', error, {
                pluginId: data.pluginId,
                instanceId: data.instanceId,
                route: data.route,
                deliveryId: data.deliveryId,
                action: 'ingress_inline_dispatch_failed',
            });
            return { outcome: 'failed', error };
        }
    }
};
exports.IngressEnqueueService = IngressEnqueueService;
exports.IngressEnqueueService = IngressEnqueueService = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Optional)()),
    __param(2, (0, bullmq_1.InjectQueue)(queue_names_1.QUEUE_NAMES.INGRESS)),
    __metadata("design:paramtypes", [plugin_loader_service_1.PluginLoaderService,
        config_1.ConfigService,
        bullmq_2.Queue])
], IngressEnqueueService);
//# sourceMappingURL=ingress-enqueue.service.js.map