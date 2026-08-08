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
exports.MessageProjector = exports.ACK_RECONCILE_DELAY_MS = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const session_entity_1 = require("./entities/session.entity");
const message_entity_1 = require("../message/entities/message.entity");
const engine_registry_service_1 = require("../../engine/engine-registry.service");
const keyed_mutation_queue_1 = require("../../common/utils/keyed-mutation-queue");
const session_lid_resolver_service_1 = require("./session-lid-resolver.service");
const message_row_mapper_1 = require("./message-row.mapper");
const message_mutation_projector_1 = require("./message-mutation-projector");
const message_history_projector_1 = require("./message-history-projector");
const unique_constraint_util_1 = require("../../common/utils/unique-constraint.util");
const feature_flags_1 = require("../../config/feature-flags");
const status_store_service_1 = require("../status-store/status-store.service");
const chat_media_archive_service_1 = require("../chat-media/chat-media-archive.service");
const automation_rules_service_1 = require("../automation/automation-rules.service");
const incoming_status_1 = require("../status-store/incoming-status");
const logger_service_1 = require("../../common/services/logger.service");
const events_gateway_1 = require("../events/events.gateway");
const webhook_service_1 = require("../webhook/webhook.service");
const hooks_1 = require("../../core/hooks");
const message_status_util_1 = require("../message/message-status.util");
exports.ACK_RECONCILE_DELAY_MS = 750;
let MessageProjector = class MessageProjector {
    messageRepository;
    sessionRepository;
    engines;
    eventsGateway;
    webhookService;
    hookManager;
    statusStore;
    lidResolver;
    configService;
    chatMediaArchive;
    automationRules;
    logger = (0, logger_service_1.createLogger)('MessageProjector');
    messageMutations = new keyed_mutation_queue_1.KeyedMutationQueue((key, err) => {
        this.logger.error(`Unexpected failure applying message mutation: ${key}`, String(err));
    });
    mutationProjector;
    constructor(messageRepository, sessionRepository, engines, eventsGateway, webhookService, hookManager, statusStore, lidResolver, configService, chatMediaArchive, automationRules) {
        this.messageRepository = messageRepository;
        this.sessionRepository = sessionRepository;
        this.engines = engines;
        this.eventsGateway = eventsGateway;
        this.webhookService = webhookService;
        this.hookManager = hookManager;
        this.statusStore = statusStore;
        this.lidResolver = lidResolver;
        this.configService = configService;
        this.chatMediaArchive = chatMediaArchive;
        this.automationRules = automationRules;
        this.mutationProjector = new message_mutation_projector_1.MessageMutationProjector(this.messageRepository, this.eventsGateway, this.webhookService, this.messageMutations, this.logger);
    }
    handleInboundMessage(id, engine, message) {
        if (!this.engines.isLive(id, engine))
            return;
        if (message.isStatusBroadcast) {
            this.ingestInboundStatus(id, engine, message);
            return;
        }
        if (this.shouldSkipEphemeralMessage(id, message))
            return;
        this.logger.debug(`Message received from ${message.from}`, {
            sessionId: id,
            messageId: message.id,
            from: message.from,
            action: 'message_received',
        });
        void this.sessionRepository.update(id, { lastActiveAt: new Date() }).catch(() => undefined);
        const messageData = { ...message };
        void this.hookManager
            .execute('message:received', messageData, {
            sessionId: id,
            source: 'Engine',
        })
            .then(({ data: finalMessage }) => this.projectInboundMessage(id, engine, finalMessage))
            .catch(err => this.logger.error(`onMessage handler failed for ${id}`, String(err)));
    }
    ingestInboundStatus(id, engine, message) {
        if (message.fromMe)
            return;
        const status = (0, incoming_status_1.buildIncomingStatus)(message);
        if (status) {
            void this.statusStore
                .ingest(id, status)
                .then(({ row, created }) => {
                if (!this.engines.isLive(id, engine))
                    return;
                if (created)
                    this.dispatchStatusReceived(id, row);
            })
                .catch(err => this.logger.warn('Status ingest failed', {
                sessionId: id,
                error: err instanceof Error ? err.message : String(err),
            }));
        }
    }
    shouldSkipEphemeralMessage(id, message) {
        if (!(0, feature_flags_1.resolveFeatureFlags)(this.configService).storeEphemeralMessages &&
            message.ephemeralDuration &&
            message.ephemeralDuration > 0) {
            this.logger.debug('Skipping ephemeral message', {
                sessionId: id,
                messageId: message.id,
                chatId: message.chatId,
                ephemeralDuration: message.ephemeralDuration,
            });
            return true;
        }
        return false;
    }
    async projectInboundMessage(id, engine, finalMessage) {
        const incoming = finalMessage;
        if ((0, feature_flags_1.resolveFeatureFlags)(this.configService).resolveLidToPhone && incoming.isLidSender && !incoming.fromMe) {
            incoming.senderPhone = await this.lidResolver.resolveSenderPhone(id, incoming.author ?? incoming.from);
        }
        const outcome = await this.persistInboundMessage(id, engine, incoming);
        if (!outcome)
            return;
        this.dispatchInboundMessage(id, finalMessage, outcome);
    }
    async persistInboundMessage(id, engine, incoming) {
        const metadata = (0, message_row_mapper_1.buildMessageMetadata)(incoming);
        const chatName = incoming.contact?.pushName ?? incoming.contact?.name ?? undefined;
        const dbMessage = this.messageRepository.create({
            sessionId: id,
            waMessageId: (0, message_row_mapper_1.storableWaMessageId)(incoming.id),
            chatId: incoming.chatId,
            chatName,
            author: incoming.author,
            from: incoming.from,
            to: incoming.to,
            body: incoming.body,
            type: incoming.type,
            direction: incoming.fromMe ? message_entity_1.MessageDirection.OUTGOING : message_entity_1.MessageDirection.INCOMING,
            timestamp: incoming.timestamp,
            status: message_entity_1.MessageStatus.SENT,
            metadata,
        });
        if (!this.engines.isLive(id, engine))
            return null;
        let isNewMessage = true;
        let persisted = false;
        try {
            const result = await this.messageRepository.insert(dbMessage);
            Object.assign(dbMessage, result.identifiers[0] ?? {}, result.generatedMaps?.[0] ?? {});
            persisted = true;
        }
        catch (err) {
            if ((0, unique_constraint_util_1.isUniqueConstraintError)(err)) {
                isNewMessage = false;
            }
            else {
                this.logger.error(`Failed to save incoming message ${incoming.id} to database`, String(err));
            }
        }
        if (!isNewMessage) {
            return null;
        }
        return { dbMessage, persisted };
    }
    dispatchInboundMessage(id, finalMessage, outcome) {
        const { dbMessage, persisted } = outcome;
        if (persisted) {
            void this.hookManager
                .execute('message:persisted', { sessionId: id, message: dbMessage }, { sessionId: id, source: 'SessionService' })
                .catch(() => undefined);
            void this.chatMediaArchive?.archive(dbMessage).catch(() => undefined);
        }
        void this.webhookService.dispatch(id, 'message.received', finalMessage);
        void this.automationRules?.evaluateInbound(id, finalMessage).catch(() => undefined);
        this.eventsGateway.emitMessage(id, finalMessage);
    }
    handleOwnSendEcho(id, engine, message) {
        if (!this.engines.isLive(id, engine))
            return;
        if (!message.fromMe) {
            return;
        }
        if (message.isStatusBroadcast) {
            return;
        }
        this.logger.debug(`Message sent to ${message.to}`, {
            sessionId: id,
            messageId: message.id,
            to: message.to,
            action: 'message_sent',
        });
        void this.sessionRepository.update(id, { lastActiveAt: new Date() }).catch(() => undefined);
        const messageData = { ...message };
        void this.hookManager
            .execute('message:sent', messageData, {
            sessionId: id,
            source: 'Engine',
        })
            .then(async ({ data: finalMessage }) => {
            const outgoing = finalMessage;
            const metadata = (0, message_row_mapper_1.buildMessageMetadata)(outgoing, true);
            const mayPersist = (0, feature_flags_1.resolveFeatureFlags)(this.configService).storeEphemeralMessages ||
                !(outgoing.ephemeralDuration && outgoing.ephemeralDuration > 0);
            if (mayPersist) {
                const dbMessage = this.messageRepository.create({
                    sessionId: id,
                    waMessageId: (0, message_row_mapper_1.storableWaMessageId)(outgoing.id),
                    chatId: outgoing.chatId,
                    from: outgoing.from,
                    to: outgoing.to,
                    body: outgoing.body,
                    type: outgoing.type,
                    direction: message_entity_1.MessageDirection.OUTGOING,
                    timestamp: outgoing.timestamp,
                    status: message_entity_1.MessageStatus.SENT,
                    metadata,
                });
                if (!this.engines.isLive(id, engine))
                    return;
                let persisted = false;
                try {
                    const result = await this.messageRepository.insert(dbMessage);
                    Object.assign(dbMessage, result.identifiers[0] ?? {}, result.generatedMaps?.[0] ?? {});
                    persisted = true;
                }
                catch (err) {
                    if (!(0, unique_constraint_util_1.isUniqueConstraintError)(err)) {
                        this.logger.error(`Failed to save outgoing message ${outgoing.id} to database`, String(err));
                    }
                }
                if (persisted) {
                    void this.hookManager
                        .execute('message:persisted', { sessionId: id, message: dbMessage }, { sessionId: id, source: 'SessionService' })
                        .catch(() => undefined);
                }
            }
            void this.webhookService.dispatch(id, 'message.sent', finalMessage);
            this.eventsGateway.emitMessageSent(id, finalMessage);
        })
            .catch(err => this.logger.error(`onMessageCreate handler failed for ${id}`, String(err)));
    }
    handleMessageAck(id, engine, messageId, status) {
        if (!this.engines.isLive(id, engine))
            return;
        this.logger.debug(`Message ack: ${messageId} -> ${status}`, {
            sessionId: id,
            messageId,
            status,
            action: 'message_ack',
        });
        const messageStatus = (0, message_status_util_1.deliveryStatusToMessageStatus)(status);
        if (messageStatus) {
            const advanceAck = () => this.messageRepository
                .update({ sessionId: id, waMessageId: messageId, status: (0, typeorm_2.In)((0, message_status_util_1.ackStatusTransitionFrom)(messageStatus)) }, { status: messageStatus })
                .then(result => result.affected ?? 0);
            const logNoop = () => this.logger.debug(`Message ack ${messageId}: no status row advanced to ${messageStatus} (${status})`, {
                sessionId: id,
                messageId,
                status,
                action: 'message_ack_noop',
            });
            const onAckError = (err) => this.logger.error(`Failed to advance ack for ${messageId}`, String(err));
            void advanceAck()
                .then(affected => {
                if (affected > 0)
                    return;
                const timer = setTimeout(() => {
                    void advanceAck()
                        .then(retried => {
                        if (retried === 0)
                            logNoop();
                    })
                        .catch(onAckError);
                }, exports.ACK_RECONCILE_DELAY_MS);
                timer.unref?.();
            })
                .catch(onAckError);
        }
        const ackPayload = { id: messageId, messageId, status, ack: (0, message_status_util_1.deliveryStatusToAck)(status) };
        this.eventsGateway.emitMessageAck(id, ackPayload);
        void this.webhookService.dispatch(id, 'message.ack', ackPayload);
        if (status === 'failed') {
            void this.webhookService.dispatch(id, 'message.failed', { ...ackPayload });
        }
        void this.hookManager.execute('message:ack', { messageId, status, ack: (0, message_status_util_1.deliveryStatusToAck)(status) }, { sessionId: id, source: 'Engine' });
    }
    handleMessageRevoked(id, engine, message) {
        if (!this.engines.isLive(id, engine))
            return;
        this.logger.debug(`Message revoked: ${message.id}`, {
            sessionId: id,
            messageId: message.id,
            action: 'message_revoked',
        });
        const revokedWaMessageId = message.revokedId ?? message.id;
        void this.messageRepository
            .update({ sessionId: id, waMessageId: revokedWaMessageId }, { body: '', type: 'revoked' })
            .catch(err => {
            this.logger.error(`Failed to update revoked message: ${revokedWaMessageId}`, String(err));
        });
        const revokedPayload = message;
        void this.webhookService.dispatch(id, 'message.revoked', revokedPayload);
        this.eventsGateway.emitMessageRevoked(id, revokedPayload);
    }
    persistHistoryMessages(id, messages) {
        return (0, message_history_projector_1.persistHistoryMessages)(this.messageRepository, this.configService, id, messages, this.logger);
    }
    applyReactionQueued(id, event) {
        this.mutationProjector.applyReactionQueued(id, event);
    }
    applyMessageEditQueued(id, message) {
        this.mutationProjector.applyMessageEditQueued(id, message);
    }
    enqueueMessageMutation(id, messageId, work) {
        this.mutationProjector.enqueueMessageMutation(id, messageId, work);
    }
    recordOutboundMessageEdit(sessionId, messageId, body) {
        return this.mutationProjector.recordOutboundMessageEdit(sessionId, messageId, body);
    }
    dispatchStatusReceived(sessionId, row) {
        const payload = {
            sessionId,
            statusId: row.waStatusId,
            contact: {
                id: row.contactJid,
                ...(row.contactName ? { name: row.contactName } : {}),
                ...(row.contactPushName ? { pushName: row.contactPushName } : {}),
            },
            type: row.type,
            ...(row.caption ? { caption: row.caption } : {}),
            hasMedia: Boolean(row.mediaPath) && !row.mediaOmitted,
            mediaOmitted: row.mediaOmitted,
            ...(row.omitReason ? { omitReason: row.omitReason } : {}),
            postedAt: row.postedAt,
            expiresAt: row.expiresAt,
        };
        void this.webhookService.dispatch(sessionId, 'status.received', payload);
        this.eventsGateway.emitStatusReceived(sessionId, payload);
    }
};
exports.MessageProjector = MessageProjector;
exports.MessageProjector = MessageProjector = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(message_entity_1.Message, 'data')),
    __param(1, (0, typeorm_1.InjectRepository)(session_entity_1.Session, 'data')),
    __param(8, (0, common_1.Optional)()),
    __param(9, (0, common_1.Optional)()),
    __param(10, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        engine_registry_service_1.EngineRegistry,
        events_gateway_1.EventsGateway,
        webhook_service_1.WebhookService,
        hooks_1.HookManager,
        status_store_service_1.StatusStoreService,
        session_lid_resolver_service_1.SessionLidResolver,
        config_1.ConfigService,
        chat_media_archive_service_1.ChatMediaArchiveService,
        automation_rules_service_1.AutomationRulesService])
], MessageProjector);
//# sourceMappingURL=message-projector.service.js.map