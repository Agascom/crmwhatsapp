"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionEngineEventWiring = void 0;
const session_entity_1 = require("./entities/session.entity");
const audit_log_entity_1 = require("../audit/entities/audit-log.entity");
const whatsapp_engine_interface_1 = require("../../engine/interfaces/whatsapp-engine.interface");
class SessionEngineEventWiring {
    logger;
    constructor(deps) {
        this.logger = deps.logger;
    }
    buildCallbacks(id, engine, sessionName, host) {
        const persistStatus = (status) => {
            if (!host.ownsSession(id)) {
                this.logger.warn('Skipped an engine status write for a session this node no longer owns', {
                    sessionId: id,
                    status,
                    action: 'status_write_skipped_not_owned',
                });
                return;
            }
            void host.updateStatus(id, status);
        };
        return {
            onQRCode: (qr) => {
                if (!host.isLiveEngine(id, engine))
                    return;
                this.logger.log('QR code generated', {
                    sessionId: id,
                    action: 'qr_generated',
                });
                void host.webhookService.dispatch(id, 'session.qr', { sessionId: id, qr });
                host.eventsGateway.emitQRCode(id, qr);
                void host.hookManager.execute('session:qr', { sessionId: id }, {
                    sessionId: id,
                    source: 'Engine',
                });
                persistStatus(session_entity_1.SessionStatus.QR_READY);
            },
            onReady: (phone, pushName) => host.handleEngineReady(id, engine, phone, pushName),
            onMessage: (message) => host.messages.handleInboundMessage(id, engine, message),
            onHistoryMessages: (messages) => {
                if (!host.isLiveEngine(id, engine))
                    return;
                void host.messages
                    .persistHistoryMessages(id, messages)
                    .catch(err => this.logger.error(`Failed to persist history messages for ${id}`, String(err)));
            },
            onMessageCreate: (message) => host.messages.handleOwnSendEcho(id, engine, message),
            onMessageAck: (messageId, status) => host.messages.handleMessageAck(id, engine, messageId, status),
            onMessageRevoked: (message) => host.messages.handleMessageRevoked(id, engine, message),
            onMessageReaction: (event) => {
                if (!host.isLiveEngine(id, engine))
                    return;
                if (!event.messageId) {
                    this.logger.warn('Ignoring message reaction without a target message id', {
                        sessionId: id,
                        action: 'message_reaction_ignored',
                    });
                    return;
                }
                this.logger.debug(`Message reaction received: ${event.messageId} -> ${event.reaction}`, {
                    sessionId: id,
                    messageId: event.messageId,
                    action: 'message_reaction_received',
                });
                host.messages.applyReactionQueued(id, event);
            },
            onMessageEdited: (message) => {
                if (!host.isLiveEngine(id, engine))
                    return;
                if (!message.messageId) {
                    this.logger.warn('Ignoring message edit without a target message id', {
                        sessionId: id,
                        action: 'message_edit_ignored',
                    });
                    return;
                }
                this.logger.debug(`Message edited: ${message.messageId}`, {
                    sessionId: id,
                    messageId: message.messageId,
                    action: 'message_edited',
                });
                host.messages.applyMessageEditQueued(id, message);
            },
            onGroupEvent: (event) => {
                if (!host.isLiveEngine(id, engine))
                    return;
                this.logger.debug(`Group event: ${event.kind} in ${event.groupId}`, {
                    sessionId: id,
                    groupId: event.groupId,
                    kind: event.kind,
                    action: 'group_event',
                });
                host.leafEvents.dispatchGroupEvent(id, event);
            },
            onCall: (event) => {
                if (!host.isLiveEngine(id, engine))
                    return;
                this.logger.log(`Incoming call from ${event.from}`, {
                    sessionId: id,
                    callId: event.callId,
                    isVideo: event.isVideo,
                    isGroup: event.isGroup,
                    action: 'call_received',
                });
                const payload = { ...event };
                host.eventsGateway.emitCallReceived(id, payload);
                void host.webhookService.dispatch(id, 'call.received', payload);
                void host.leafEvents.maybeAutoRejectCall(id, engine, event.callId);
            },
            onDisconnected: (reason) => {
                if (!host.isLiveEngine(id, engine))
                    return;
                void host.handleEngineDisconnected(id, engine, reason);
            },
            onStateChanged: (engineState) => {
                if (!host.isLiveEngine(id, engine))
                    return;
                const statusMap = {
                    [whatsapp_engine_interface_1.EngineStatus.DISCONNECTED]: session_entity_1.SessionStatus.DISCONNECTED,
                    [whatsapp_engine_interface_1.EngineStatus.INITIALIZING]: session_entity_1.SessionStatus.INITIALIZING,
                    [whatsapp_engine_interface_1.EngineStatus.QR_READY]: session_entity_1.SessionStatus.QR_READY,
                    [whatsapp_engine_interface_1.EngineStatus.AUTHENTICATING]: session_entity_1.SessionStatus.AUTHENTICATING,
                    [whatsapp_engine_interface_1.EngineStatus.READY]: session_entity_1.SessionStatus.READY,
                    [whatsapp_engine_interface_1.EngineStatus.ACTION_REQUIRED]: session_entity_1.SessionStatus.ACTION_REQUIRED,
                    [whatsapp_engine_interface_1.EngineStatus.FAILED]: session_entity_1.SessionStatus.FAILED,
                };
                const newStatus = statusMap[engineState];
                if (newStatus) {
                    persistStatus(newStatus);
                }
            },
            onActionRequired: (reason) => {
                if (!host.isLiveEngine(id, engine))
                    return;
                this.logger.warn(`Session requires operator action: ${reason}`, {
                    sessionId: id,
                    reason,
                    action: 'action_required',
                });
                host.sessionErrors.set(id, reason);
                void host.hookManager.execute('session:error', { reason }, { sessionId: id, source: 'Engine' });
            },
            onCallOutcome: (event) => {
                if (!host.isLiveEngine(id, engine))
                    return;
                this.logger.log(`Call ${event.outcome}: ${event.callId}`, {
                    sessionId: id,
                    callId: event.callId,
                    outcome: event.outcome,
                    action: 'call_outcome',
                });
                const payload = { sessionId: id, ...event };
                if (event.outcome === 'accepted') {
                    host.eventsGateway.emitCallAccepted(id, payload);
                    void host.webhookService.dispatch(id, 'call.accepted', payload);
                }
                else if (event.outcome === 'rejected') {
                    host.eventsGateway.emitCallRejected(id, payload);
                    void host.webhookService.dispatch(id, 'call.rejected', payload);
                }
                else {
                    host.eventsGateway.emitCallMissed(id, payload);
                    void host.webhookService.dispatch(id, 'call.missed', payload);
                }
            },
            onPresenceUpdate: (event) => {
                if (!host.isLiveEngine(id, engine))
                    return;
                if (!host.presence.record(id, event))
                    return;
                const payload = { sessionId: id, ...event };
                host.eventsGateway.emitPresenceUpdate(id, payload);
                void host.webhookService.dispatch(id, 'presence.update', payload);
            },
            onAccountRestriction: (restriction) => {
                if (!host.isLiveEngine(id, engine))
                    return;
                if (!restriction) {
                    const lifted = host.sessionRestrictions.clear(id);
                    if (lifted)
                        host.reportRestrictionLifted(id, lifted);
                    return;
                }
                if (!host.sessionRestrictions.set(id, restriction))
                    return;
                this.logger.warn(`WhatsApp restricted this session's account: ${restriction.kind}`, {
                    sessionId: id,
                    kind: restriction.kind,
                    code: restriction.code,
                    expiresAt: restriction.expiresAt,
                    action: 'account_restricted',
                });
                const payload = {
                    active: true,
                    kind: restriction.kind,
                    code: restriction.code,
                    expiresAt: restriction.expiresAt ? new Date(restriction.expiresAt).toISOString() : null,
                };
                void host.webhookService.dispatch(id, 'session.restriction', { sessionId: id, ...payload });
                host.eventsGateway.emitSessionRestriction(id, payload);
                void host.auditService?.logWarn(audit_log_entity_1.AuditAction.SESSION_RESTRICTED, {
                    sessionId: id,
                    metadata: {
                        kind: restriction.kind,
                        code: restriction.code,
                        expiresAt: restriction.expiresAt ? new Date(restriction.expiresAt).toISOString() : null,
                    },
                    errorMessage: `WhatsApp restricted this account: ${restriction.kind} (${restriction.code})`,
                });
            },
            onError: (reason) => {
                if (!host.isLiveEngine(id, engine))
                    return;
                this.logger.error(`Session engine failed: ${reason}`, undefined, {
                    sessionId: id,
                    reason,
                    action: 'engine_error',
                });
                host.sessionErrors.set(id, reason);
                host.cancelReconnect(id);
                void host.hookManager.execute('session:error', { reason }, {
                    sessionId: id,
                    source: 'Engine',
                });
                persistStatus(session_entity_1.SessionStatus.FAILED);
                host.evictAndForceDestroy(id, engine);
            },
            onCredentialTeardownStarted: (operation) => {
                host.trackPendingCredentialTeardown(sessionName, operation);
            },
            claimStuckAuthRecovery: () => host.claimStuckAuthRecovery(id, engine),
        };
    }
}
exports.SessionEngineEventWiring = SessionEngineEventWiring;
//# sourceMappingURL=session-engine-event-wiring.js.map