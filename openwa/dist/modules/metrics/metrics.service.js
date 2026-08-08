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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsService = exports.METRICS_RENDER_TTL_MS = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const constantTimeEqual_1 = require("../../common/security/constantTimeEqual");
const stats_service_1 = require("../stats/stats.service");
const webhook_delivery_metrics_1 = require("../../common/metrics/webhook-delivery-metrics");
const session_reconnect_metrics_1 = require("../../common/metrics/session-reconnect-metrics");
const session_restriction_metrics_1 = require("../../common/metrics/session-restriction-metrics");
const send_pacing_metrics_1 = require("../../common/metrics/send-pacing-metrics");
const request_metrics_1 = require("../../common/metrics/request-metrics");
exports.METRICS_RENDER_TTL_MS = 5000;
let MetricsService = class MetricsService {
    config;
    statsService;
    cachedRender = null;
    constructor(config, statsService) {
        this.config = config;
        this.statsService = statsService;
    }
    get token() {
        return (this.config.get('METRICS_TOKEN') ?? '').trim();
    }
    assertScrapeAuthorized(authorizationHeader) {
        const expected = this.token;
        if (!expected) {
            throw new common_1.NotFoundException('Metrics endpoint is disabled (set METRICS_TOKEN to enable)');
        }
        const provided = (authorizationHeader ?? '').replace(/^Bearer\s+/i, '').trim();
        if (!provided || !this.safeEqual(provided, expected)) {
            throw new common_1.UnauthorizedException('Invalid metrics token');
        }
    }
    safeEqual(a, b) {
        return (0, constantTimeEqual_1.constantTimeEqual)(a, b);
    }
    async render() {
        const now = Date.now();
        if (this.cachedRender && now - this.cachedRender.at < exports.METRICS_RENDER_TTL_MS) {
            return this.cachedRender.text;
        }
        const overview = await this.statsService.getOverview();
        const mem = process.memoryUsage();
        const lines = [];
        const gauge = (name, help, value, labels = '') => {
            lines.push(`# HELP ${name} ${help}`);
            lines.push(`# TYPE ${name} gauge`);
            lines.push(`${name}${labels} ${value}`);
        };
        gauge('openwa_up', 'Whether the OpenWA process is up (always 1 when scraped).', 1);
        gauge('openwa_process_uptime_seconds', 'Process uptime in seconds.', Math.round(process.uptime()));
        gauge('openwa_process_resident_memory_bytes', 'Resident set size in bytes.', mem.rss);
        gauge('openwa_process_heap_used_bytes', 'V8 heap used in bytes.', mem.heapUsed);
        gauge('openwa_sessions_total', 'Total number of configured sessions.', overview.sessions.total);
        gauge('openwa_sessions_active', 'Number of READY (active) sessions.', overview.sessions.active);
        lines.push('# HELP openwa_sessions Number of sessions by status.');
        lines.push('# TYPE openwa_sessions gauge');
        for (const [status, count] of Object.entries(overview.sessions.byStatus)) {
            lines.push(`openwa_sessions{status="${this.escapeLabel(status)}"} ${count}`);
        }
        lines.push('# HELP openwa_messages_total Current stored messages by direction.');
        lines.push('# TYPE openwa_messages_total gauge');
        lines.push(`openwa_messages_total{direction="outgoing"} ${overview.messages.sent}`);
        lines.push(`openwa_messages_total{direction="incoming"} ${overview.messages.received}`);
        lines.push('# HELP openwa_messages_failed_total Current stored messages in FAILED state.');
        lines.push('# TYPE openwa_messages_failed_total gauge');
        lines.push(`openwa_messages_failed_total ${overview.messages.failed}`);
        lines.push('# HELP openwa_webhook_delivery_failures_total Webhook deliveries that terminally failed (all retries exhausted) since process start.');
        lines.push('# TYPE openwa_webhook_delivery_failures_total counter');
        lines.push(`openwa_webhook_delivery_failures_total ${(0, webhook_delivery_metrics_1.getWebhookDeliveryFailuresTotal)()}`);
        lines.push('# HELP openwa_session_reconnect_attempts_total Reconnect attempts scheduled across all sessions since process start.');
        lines.push('# TYPE openwa_session_reconnect_attempts_total counter');
        lines.push(`openwa_session_reconnect_attempts_total ${(0, session_reconnect_metrics_1.getSessionReconnectAttemptsTotal)()}`);
        lines.push('# HELP openwa_session_reconnect_loop_alerts_total Reconnect-loop alerts emitted since process start.');
        lines.push('# TYPE openwa_session_reconnect_loop_alerts_total counter');
        lines.push(`openwa_session_reconnect_loop_alerts_total ${(0, session_reconnect_metrics_1.getSessionReconnectLoopAlertsTotal)()}`);
        lines.push('# HELP openwa_sessions_restricted Sessions whose account WhatsApp is currently restricting.');
        lines.push('# TYPE openwa_sessions_restricted gauge');
        lines.push(`openwa_sessions_restricted ${(0, session_restriction_metrics_1.getRestrictedSessionCount)()}`);
        const refusals = (0, send_pacing_metrics_1.getSendPacingRefusals)();
        if (refusals.size > 0) {
            lines.push('# HELP openwa_send_pacing_refusals_total Sends refused by the pacing governor since process start.');
            lines.push('# TYPE openwa_send_pacing_refusals_total counter');
            for (const [reason, count] of refusals) {
                lines.push(`openwa_send_pacing_refusals_total{reason="${this.escapeLabel(reason)}"} ${count}`);
            }
        }
        lines.push(...(0, request_metrics_1.renderHttpRequestMetrics)());
        const text = lines.join('\n') + '\n';
        this.cachedRender = { at: now, text };
        return text;
    }
    escapeLabel(value) {
        return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
    }
};
exports.MetricsService = MetricsService;
exports.MetricsService = MetricsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        stats_service_1.StatsService])
], MetricsService);
//# sourceMappingURL=metrics.service.js.map