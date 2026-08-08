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
exports.IngressReconcilerService = void 0;
exports.resolveIngressReconcilerOptions = resolveIngressReconcilerOptions;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ingress_event_entity_1 = require("./entities/ingress-event.entity");
const integration_delivery_failure_entity_1 = require("./entities/integration-delivery-failure.entity");
const ingress_enqueue_service_1 = require("./ingress-enqueue.service");
const ingress_service_1 = require("./ingress.service");
const plugin_instance_service_1 = require("./plugin-instance.service");
const plugin_loader_service_1 = require("../../core/plugins/plugin-loader.service");
const logger_service_1 = require("../../common/services/logger.service");
const configuration_1 = require("../../config/configuration");
function resolveIngressReconcilerOptions(env = process.env) {
    const batch = Number(env.INGRESS_RECONCILE_BATCH_SIZE);
    const maxAttempts = Number(env.INGRESS_RECONCILE_MAX_ATTEMPTS);
    return {
        intervalMs: (0, configuration_1.resolveNonNegativeIntEnv)(env.INGRESS_RECONCILE_INTERVAL_MS, 60_000),
        graceMs: (0, configuration_1.resolveNonNegativeIntEnv)(env.INGRESS_RECONCILE_GRACE_MS, 60_000),
        batchSize: Number.isInteger(batch) && batch >= 1 ? batch : 50,
        maxAttempts: Number.isInteger(maxAttempts) && maxAttempts >= 1 ? maxAttempts : 5,
    };
}
let IngressReconcilerService = class IngressReconcilerService {
    events;
    failures;
    ingressEnqueue;
    loader;
    instances;
    logger = (0, logger_service_1.createLogger)('IngressReconcilerService');
    timer;
    sweeping = false;
    constructor(events, failures, ingressEnqueue, loader, instances) {
        this.events = events;
        this.failures = failures;
        this.ingressEnqueue = ingressEnqueue;
        this.loader = loader;
        this.instances = instances;
    }
    onModuleInit() {
        const opts = resolveIngressReconcilerOptions();
        if (opts.intervalMs <= 0) {
            this.logger.log('Ingress event reconciler disabled (INGRESS_RECONCILE_INTERVAL_MS <= 0)');
            return;
        }
        this.timer = setInterval(() => {
            this.sweep(opts).catch(err => this.logger.error('Ingress reconcile sweep failed', err instanceof Error ? err.stack : String(err)));
        }, opts.intervalMs);
        this.timer.unref?.();
    }
    onModuleDestroy() {
        if (this.timer)
            clearInterval(this.timer);
    }
    async sweep(opts, now = new Date()) {
        const stats = { scanned: 0, replayed: 0, failed: 0, skipped: 0 };
        if (this.sweeping)
            return stats;
        this.sweeping = true;
        try {
            const cutoff = new Date(now.getTime() - opts.graceMs);
            const rows = await this.events.find({
                where: { dispatchState: 'pending', createdAt: (0, typeorm_2.LessThan)(cutoff) },
                order: { createdAt: 'ASC' },
                take: opts.batchSize,
            });
            for (const row of rows) {
                if (row.lastDispatchAt && row.lastDispatchAt > cutoff) {
                    stats.skipped++;
                    continue;
                }
                if (!hasPayload(row)) {
                    this.logger.error('Ingress event is pending without a payload; cannot replay', undefined, {
                        pluginId: row.pluginId,
                        instanceId: row.instanceId,
                        deliveryId: row.providerDeliveryId,
                        action: 'ingress_reconcile_missing_payload',
                    });
                    stats.skipped++;
                    continue;
                }
                try {
                    const instance = await this.instances.resolve(row.pluginId, row.instanceId);
                    if (!instance || !instance.enabled) {
                        this.logger.log('Skipping ingress event for a disabled or deleted instance', {
                            pluginId: row.pluginId,
                            instanceId: row.instanceId,
                            deliveryId: row.providerDeliveryId,
                            action: 'ingress_reconcile_instance_ineligible',
                        });
                        stats.skipped++;
                        continue;
                    }
                    stats.scanned++;
                    const outcome = await this.reconcileRow(row, opts.maxAttempts, now);
                    if (outcome === 'replayed')
                        stats.replayed++;
                    else
                        stats.failed++;
                }
                catch (err) {
                    this.logger.error('Ingress reconcile row failed', err instanceof Error ? err.message : String(err), {
                        pluginId: row.pluginId,
                        instanceId: row.instanceId,
                        deliveryId: row.providerDeliveryId,
                        action: 'ingress_reconcile_row_failed',
                    });
                    stats.skipped++;
                }
            }
            return stats;
        }
        finally {
            this.sweeping = false;
        }
    }
    async reconcileRow(row, maxAttempts, now) {
        const jobData = this.jobDataFor(row);
        const { outcome, error } = await this.ingressEnqueue.enqueue(jobData, row.providerDeliveryId);
        if (outcome !== 'failed') {
            await this.events.update({ id: row.id }, { dispatchState: 'dispatched', lastDispatchAt: now, payload: null });
            await this.failures.update({
                direction: 'inbound',
                pluginId: row.pluginId,
                instanceId: row.instanceId,
                deliveryId: row.providerDeliveryId,
                redriven: false,
            }, { redriven: true });
            this.logger.log('Replayed stranded ingress event', {
                pluginId: row.pluginId,
                instanceId: row.instanceId,
                deliveryId: row.providerDeliveryId,
                outcome,
                action: 'ingress_event_replayed',
            });
            return 'replayed';
        }
        const attempts = (row.dispatchAttempts ?? 0) + 1;
        const terminal = attempts >= maxAttempts;
        if (terminal) {
            await this.ensureDeadLetterRow(jobData, attempts, error);
            await this.events.update({ id: row.id }, { dispatchAttempts: attempts, lastDispatchAt: now, dispatchState: 'failed', payload: null });
            this.logger.warn('Ingress event replay budget exhausted; event is dead-lettered', {
                pluginId: row.pluginId,
                instanceId: row.instanceId,
                deliveryId: row.providerDeliveryId,
                attempts,
                action: 'ingress_event_reconcile_exhausted',
            });
            return 'failed';
        }
        await this.events.update({ id: row.id }, { dispatchAttempts: attempts, lastDispatchAt: now });
        return 'failed';
    }
    jobDataFor(row) {
        const route = this.loader
            .getPlugin(row.pluginId)
            ?.manifest.ingress?.find(candidate => candidate.route === row.route);
        return {
            pluginId: row.pluginId,
            instanceId: row.instanceId,
            route: row.route,
            deliveryId: row.providerDeliveryId,
            sessionId: row.sessionId ?? undefined,
            providerConversationId: (0, ingress_service_1.extractConversationId)(route?.conversationId, row.payload.headers, row.payload.rawBody),
            payload: row.payload,
        };
    }
    async ensureDeadLetterRow(data, attempts, error) {
        const existing = await this.failures.count({
            where: {
                direction: 'inbound',
                pluginId: data.pluginId,
                instanceId: data.instanceId,
                deliveryId: data.deliveryId,
            },
        });
        if (existing > 0)
            return;
        await this.failures.save({ ...(0, ingress_enqueue_service_1.buildIngressDeadLetterRow)(data, error), attempts });
    }
};
exports.IngressReconcilerService = IngressReconcilerService;
exports.IngressReconcilerService = IngressReconcilerService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(ingress_event_entity_1.IngressEvent, 'data')),
    __param(1, (0, typeorm_1.InjectRepository)(integration_delivery_failure_entity_1.IntegrationDeliveryFailure, 'data')),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        ingress_enqueue_service_1.IngressEnqueueService,
        plugin_loader_service_1.PluginLoaderService,
        plugin_instance_service_1.PluginInstanceService])
], IngressReconcilerService);
function hasPayload(row) {
    return row.payload !== null;
}
//# sourceMappingURL=ingress-reconciler.service.js.map