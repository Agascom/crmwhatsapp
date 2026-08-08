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
var BulkMessageService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BulkMessageService = void 0;
exports.resolveFinalBatchStatus = resolveFinalBatchStatus;
exports.sanitizeBatchError = sanitizeBatchError;
exports.resolveMaxConcurrentBatches = resolveMaxConcurrentBatches;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const crypto_1 = require("crypto");
const message_batch_entity_1 = require("./entities/message-batch.entity");
const message_entity_1 = require("./entities/message.entity");
const engine_registry_service_1 = require("../../engine/engine-registry.service");
const message_service_1 = require("./message.service");
const send_pacing_service_1 = require("./send-pacing.service");
const session_ownership_service_1 = require("../session/session-ownership.service");
const hooks_1 = require("../../core/hooks");
const media_cap_util_1 = require("./media-cap.util");
const ssrf_guard_1 = require("../../common/security/ssrf-guard");
const template_render_1 = require("../../common/utils/template-render");
const configuration_1 = require("../../config/configuration");
function resolveFinalBatchStatus(cancelled, stoppedOnError, progress) {
    if (cancelled)
        return message_batch_entity_1.BatchStatus.CANCELLED;
    if (stoppedOnError)
        return message_batch_entity_1.BatchStatus.FAILED;
    return progress.failed > 0 && progress.sent === 0 ? message_batch_entity_1.BatchStatus.FAILED : message_batch_entity_1.BatchStatus.COMPLETED;
}
function sanitizeBatchError(error) {
    if (error instanceof ssrf_guard_1.SsrfBlockedError) {
        return { code: 'SEND_BLOCKED', message: ssrf_guard_1.SSRF_BLOCKED_CLIENT_MESSAGE };
    }
    if ((0, send_pacing_service_1.isPacingLimitedError)(error)) {
        return { code: send_pacing_service_1.SEND_PACING_LIMITED, message: error instanceof Error ? error.message : String(error) };
    }
    return { code: 'SEND_FAILED', message: error instanceof Error ? error.message : String(error) };
}
const DEFAULT_MAX_CONCURRENT_BATCHES = 50;
function resolveMaxConcurrentBatches() {
    return (0, configuration_1.resolveNonNegativeIntEnv)(process.env.BULK_MAX_CONCURRENT_BATCHES, DEFAULT_MAX_CONCURRENT_BATCHES);
}
let BulkMessageService = BulkMessageService_1 = class BulkMessageService {
    batchRepository;
    engines;
    messageService;
    hookManager;
    pacing;
    ownership;
    logger = new common_1.Logger(BulkMessageService_1.name);
    processingBatches = new Map();
    inFlightBatches = 0;
    constructor(batchRepository, engines, messageService, hookManager, pacing, ownership) {
        this.batchRepository = batchRepository;
        this.engines = engines;
        this.messageService = messageService;
        this.hookManager = hookManager;
        this.pacing = pacing;
        this.ownership = ownership;
    }
    async onApplicationBootstrap() {
        const processing = await this.batchRepository.find({ where: { status: message_batch_entity_1.BatchStatus.PROCESSING } });
        const orphaned = await this.ownedByThisNode(processing);
        for (const batch of orphaned) {
            await this.failOrphanedBatch(batch);
        }
        if (orphaned.length > 0) {
            this.logger.warn(`Marked ${orphaned.length} orphaned PROCESSING batch(es) FAILED on startup (interrupted by a restart)`);
        }
        const skipped = processing.length - orphaned.length;
        if (skipped > 0) {
            this.logger.log(`Left ${skipped} PROCESSING batch(es) alone: their sessions are held by another node`);
        }
    }
    async failOrphanedBatch(batch) {
        batch.status = message_batch_entity_1.BatchStatus.FAILED;
        this.stripBatchMediaPayloads(batch.messages);
        await this.batchRepository.save(batch);
    }
    async reapProcessingBatches(sessionId, reason) {
        const processing = await this.batchRepository.find({ where: { status: message_batch_entity_1.BatchStatus.PROCESSING, sessionId } });
        for (const batch of processing) {
            await this.failOrphanedBatch(batch);
        }
        if (processing.length > 0) {
            this.logger.warn(`Marked ${processing.length} PROCESSING batch(es) FAILED for session ${sessionId} (${reason})`);
        }
        return processing.length;
    }
    async ownedByThisNode(batches) {
        if (!this.ownership || batches.length === 0)
            return batches;
        const claimable = new Set(await this.ownership.claimable([...new Set(batches.map(b => b.sessionId))]));
        return batches.filter(batch => claimable.has(batch.sessionId));
    }
    async createBatch(sessionId, dto) {
        this.engines.require(sessionId, () => new common_1.BadRequestException(`Session '${sessionId}' is not active`));
        const seenEntries = new Set();
        const messages = [];
        for (const message of dto.messages) {
            const fingerprint = (0, crypto_1.createHash)('sha256')
                .update(JSON.stringify([message.chatId, message.type, message.content, message.variables]))
                .digest('base64');
            if (seenEntries.has(fingerprint))
                continue;
            seenEntries.add(fingerprint);
            messages.push(message);
        }
        for (const { content } of messages) {
            this.assertContentMediaWithinCap(content);
        }
        const batchId = dto.batchId || `batch_${(0, crypto_1.randomUUID)().split('-')[0]}`;
        const existing = await this.batchRepository.findOne({ where: { batchId, sessionId } });
        if (existing) {
            throw new common_1.BadRequestException(`Batch ID '${batchId}' already exists`);
        }
        const maxConcurrentBatches = resolveMaxConcurrentBatches();
        if (maxConcurrentBatches > 0 && this.inFlightBatches >= maxConcurrentBatches) {
            throw new common_1.BadRequestException(`Too many bulk batches in progress (max ${maxConcurrentBatches}); retry shortly`);
        }
        const options = {
            delayBetweenMessages: dto.options?.delayBetweenMessages ?? 3000,
            randomizeDelay: dto.options?.randomizeDelay ?? true,
            stopOnError: dto.options?.stopOnError ?? false,
        };
        const progress = {
            total: messages.length,
            sent: 0,
            failed: 0,
            pending: messages.length,
            cancelled: 0,
        };
        const batch = this.batchRepository.create({
            batchId,
            sessionId,
            status: message_batch_entity_1.BatchStatus.PENDING,
            messages: messages,
            options,
            progress,
            results: [],
            currentIndex: 0,
        });
        this.inFlightBatches++;
        try {
            await this.batchRepository.save(batch);
        }
        catch (error) {
            this.inFlightBatches--;
            throw error;
        }
        this.logger.log(`Created batch ${batchId} with ${messages.length} messages` +
            (messages.length === dto.messages.length
                ? ''
                : ` (${dto.messages.length - messages.length} exact duplicate entr${dto.messages.length - messages.length === 1 ? 'y' : 'ies'} dropped)`));
        this.processBatch(batch.id, true).catch(err => {
            this.logger.error(`Batch ${batchId} processing error: ${String(err)}`);
        });
        return batch;
    }
    async getBatchStatus(sessionId, batchId) {
        const batch = await this.batchRepository.findOne({
            where: { batchId, sessionId },
        });
        if (!batch) {
            throw new common_1.NotFoundException(`Batch '${batchId}' not found`);
        }
        return batch;
    }
    async cancelBatch(sessionId, batchId) {
        const batch = await this.batchRepository.findOne({
            where: { batchId, sessionId },
        });
        if (!batch) {
            throw new common_1.NotFoundException(`Batch '${batchId}' not found`);
        }
        if (batch.status === message_batch_entity_1.BatchStatus.COMPLETED ||
            batch.status === message_batch_entity_1.BatchStatus.CANCELLED ||
            batch.status === message_batch_entity_1.BatchStatus.FAILED) {
            throw new common_1.BadRequestException(`Batch '${batchId}' is already ${batch.status}`);
        }
        this.processingBatches.set(batch.id, false);
        batch.status = message_batch_entity_1.BatchStatus.CANCELLED;
        batch.progress.cancelled = batch.progress.pending;
        batch.progress.pending = 0;
        batch.completedAt = new Date();
        this.stripBatchMediaPayloads(batch.messages);
        const cancelledRows = await this.batchRepository.update({ id: batch.id, status: (0, typeorm_2.In)([message_batch_entity_1.BatchStatus.PENDING, message_batch_entity_1.BatchStatus.PROCESSING]) }, {
            status: batch.status,
            progress: batch.progress,
            completedAt: batch.completedAt,
            messages: batch.messages,
        });
        if (!cancelledRows.affected) {
            const fresh = await this.batchRepository.findOne({ where: { id: batch.id }, select: { status: true } });
            throw new common_1.BadRequestException(`Batch '${batchId}' is already ${fresh?.status ?? 'gone'}`);
        }
        this.logger.log(`Cancelled batch ${batchId}`);
        return batch;
    }
    async processBatch(batchDbId, reserved = false) {
        let batch = null;
        try {
            batch = await this.batchRepository.findOne({ where: { id: batchDbId } });
            if (!batch)
                return;
            if (this.processingBatches.get(batch.id) === false || batch.status === message_batch_entity_1.BatchStatus.CANCELLED) {
                this.logger.log(`Batch ${batch.batchId} was cancelled before processing started; nothing was sent`);
                return;
            }
            this.processingBatches.set(batch.id, true);
            await this.executeBatch(batch);
        }
        finally {
            if (reserved)
                this.inFlightBatches--;
            if (batch)
                this.processingBatches.delete(batch.id);
        }
    }
    async executeBatch(batch) {
        if (!(await this.markBatchProcessing(batch)))
            return;
        const engine = this.engines.get(batch.sessionId);
        if (!engine) {
            await this.failBatchWithoutEngine(batch);
            return;
        }
        const results = batch.results || [];
        const state = { results, stoppedOnError: false, cancelledByDb: false };
        await this.processBatchMessages(batch, engine, state);
        await this.finalizeBatch(batch, state);
    }
    async markBatchProcessing(batch) {
        batch.status = message_batch_entity_1.BatchStatus.PROCESSING;
        batch.startedAt = new Date();
        const started = await this.batchRepository.update({ id: batch.id, status: (0, typeorm_2.Not)(message_batch_entity_1.BatchStatus.CANCELLED) }, { status: message_batch_entity_1.BatchStatus.PROCESSING, startedAt: batch.startedAt });
        if (!started.affected) {
            this.logger.log(`Batch ${batch.batchId} was cancelled before processing started; nothing was sent`);
            return false;
        }
        return true;
    }
    async failBatchWithoutEngine(batch) {
        batch.status = message_batch_entity_1.BatchStatus.FAILED;
        batch.completedAt = new Date();
        this.stripBatchMediaPayloads(batch.messages);
        await this.batchRepository.update({ id: batch.id, status: (0, typeorm_2.Not)(message_batch_entity_1.BatchStatus.CANCELLED) }, {
            status: message_batch_entity_1.BatchStatus.FAILED,
            completedAt: batch.completedAt,
            messages: batch.messages,
        });
    }
    async processBatchMessages(batch, engine, state) {
        for (let i = batch.currentIndex; i < batch.messages.length; i++) {
            if (!(await this.processBatchMessage(batch, engine, i, state)))
                break;
        }
    }
    async processBatchMessage(batch, engine, i, state) {
        const { results } = state;
        if (!this.processingBatches.get(batch.id)) {
            this.logger.log(`Batch ${batch.batchId} cancelled at index ${i}`);
            return false;
        }
        const msg = batch.messages[i];
        const result = {
            chatId: msg.chatId,
            status: message_batch_entity_1.BatchMessageStatus.PENDING,
        };
        let content = msg.content;
        let blockedByPlugin = false;
        try {
            content = this.applyVariables(msg.content, msg.variables);
            await this.pacing.assertSendAllowed(batch.sessionId, msg.chatId);
            const gate = await this.hookManager.execute('message:sending', { sessionId: batch.sessionId, input: content, type: msg.type }, { sessionId: batch.sessionId, source: 'BulkMessageService' });
            if (!gate.continue) {
                blockedByPlugin = true;
                throw new common_1.BadRequestException('Message sending blocked by plugin');
            }
            content = gate.data.input;
            this.assertContentMediaWithinCap(content);
            let messageResult;
            try {
                messageResult = await this.sendMessage(engine, msg.chatId, msg.type, content);
            }
            catch (engineError) {
                if ((0, send_pacing_service_1.countsTowardSendBreaker)(engineError)) {
                    this.pacing.recordSendFailure(batch.sessionId);
                }
                throw engineError;
            }
            this.pacing.recordSendSuccess(batch.sessionId);
            result.status = message_batch_entity_1.BatchMessageStatus.SENT;
            result.messageId = messageResult.id;
            result.sentAt = new Date();
            batch.progress.sent++;
            batch.progress.pending--;
            await this.persistSentMessage(batch.sessionId, msg.chatId, msg.type, content, messageResult);
            this.logger.debug(`Batch ${batch.batchId}: Sent message ${i + 1}/${batch.messages.length} to ${msg.chatId}`);
        }
        catch (error) {
            result.status = message_batch_entity_1.BatchMessageStatus.FAILED;
            const sanitized = sanitizeBatchError(error);
            result.error = sanitized;
            batch.progress.failed++;
            batch.progress.pending--;
            if (!blockedByPlugin && !(0, send_pacing_service_1.isPacingLimitedError)(error)) {
                await this.hookManager.execute('message:failed', { sessionId: batch.sessionId, error: sanitized.message, input: content, type: msg.type }, { sessionId: batch.sessionId, source: 'BulkMessageService' });
            }
            this.logger.warn(`Batch ${batch.batchId}: Failed message ${i + 1} to ${msg.chatId}: ${sanitized.message}`);
            if (batch.options.stopOnError) {
                batch.status = message_batch_entity_1.BatchStatus.FAILED;
                state.stoppedOnError = true;
                results.push(result);
                return false;
            }
        }
        results.push(result);
        batch.currentIndex = i + 1;
        batch.results = results;
        if (i % 10 === 0 || i === batch.messages.length - 1) {
            const progressSaved = await this.batchRepository.update({ id: batch.id, status: (0, typeorm_2.Not)(message_batch_entity_1.BatchStatus.CANCELLED) }, { progress: batch.progress, results, currentIndex: batch.currentIndex });
            if (!progressSaved.affected) {
                state.cancelledByDb = true;
                this.logger.log(`Batch ${batch.batchId} cancelled (DB) at index ${i}`);
                return false;
            }
        }
        if (i < batch.messages.length - 1 && this.processingBatches.get(batch.id)) {
            const delay = this.calculateDelay(batch.options);
            await this.sleep(delay);
        }
        return true;
    }
    async finalizeBatch(batch, state) {
        const { results } = state;
        if (!state.cancelledByDb) {
            const fresh = await this.batchRepository.findOne({ where: { id: batch.id }, select: { status: true } });
            if (fresh?.status === message_batch_entity_1.BatchStatus.CANCELLED) {
                state.cancelledByDb = true;
            }
        }
        const cancelled = state.cancelledByDb || !this.processingBatches.get(batch.id);
        batch.status = resolveFinalBatchStatus(cancelled, state.stoppedOnError, batch.progress);
        if (cancelled) {
            batch.progress.cancelled = batch.progress.pending;
            batch.progress.pending = 0;
        }
        batch.completedAt = new Date();
        batch.results = results;
        this.stripBatchMediaPayloads(batch.messages);
        if (batch.status === message_batch_entity_1.BatchStatus.CANCELLED) {
            await this.batchRepository.save(batch);
        }
        else {
            const finalized = await this.batchRepository.update({ id: batch.id, status: (0, typeorm_2.Not)(message_batch_entity_1.BatchStatus.CANCELLED) }, {
                status: batch.status,
                progress: batch.progress,
                results,
                currentIndex: batch.currentIndex,
                completedAt: batch.completedAt,
                messages: batch.messages,
            });
            if (!finalized.affected) {
                batch.status = message_batch_entity_1.BatchStatus.CANCELLED;
                this.logger.log(`Batch ${batch.batchId} was cancelled just before completion; keeping CANCELLED`);
            }
        }
        this.logger.log(`Batch ${batch.batchId} completed: ${batch.progress.sent} sent, ${batch.progress.failed} failed`);
    }
    assertContentMediaWithinCap(content) {
        for (const media of [content?.image, content?.video, content?.audio, content?.document]) {
            const base64 = (0, media_cap_util_1.stripBase64DataUri)(media?.base64);
            if (media?.base64 !== undefined && !base64 && !media.url) {
                throw new common_1.BadRequestException('Either url or base64 must be provided for bulk media');
            }
            (0, media_cap_util_1.assertBase64WithinMediaCap)(base64);
        }
    }
    stripBatchMediaPayloads(messages) {
        for (const m of messages ?? []) {
            for (const key of ['image', 'video', 'audio', 'document']) {
                const media = m.content[key];
                if (media && typeof media === 'object' && 'base64' in media) {
                    delete media.base64;
                }
            }
        }
    }
    applyVariables(content, variables) {
        if (!variables)
            return content;
        const replaceVars = (str) => (0, template_render_1.renderTemplate)(str, variables);
        const processValue = (value) => {
            if (typeof value === 'string') {
                return replaceVars(value);
            }
            if (Array.isArray(value)) {
                return value.map(processValue);
            }
            if (typeof value === 'object' && value !== null) {
                const result = {};
                for (const [k, v] of Object.entries(value)) {
                    result[k] = processValue(v);
                }
                return result;
            }
            return value;
        };
        return processValue(content);
    }
    async persistSentMessage(sessionId, chatId, type, content, result) {
        const media = content.image ?? content.video ?? content.audio ?? content.document;
        const persistType = type === 'audio' && content.audio?.ptt ? 'voice' : type;
        try {
            await this.messageService.saveOutgoingMessage(sessionId, {
                waMessageId: result.id,
                chatId,
                body: content.text ?? content.caption ?? '',
                type: persistType,
                timestamp: result.timestamp,
                status: message_entity_1.MessageStatus.SENT,
                metadata: media
                    ? {
                        media: {
                            mimetype: media.mimetype,
                            data: (0, media_cap_util_1.stripBase64DataUri)(media.base64) || media.url,
                            filename: media.filename,
                        },
                    }
                    : undefined,
            });
        }
        catch (error) {
            this.logger.warn(`Batch message persisted-after-send failed: ${String(error)}`);
        }
    }
    sendMessage(engine, chatId, type, content) {
        switch (type) {
            case 'text':
                return engine.sendTextMessage(chatId, content.text || '');
            case 'image':
                return engine.sendImageMessage(chatId, {
                    mimetype: content.image?.mimetype || 'image/jpeg',
                    data: (0, media_cap_util_1.stripBase64DataUri)(content.image?.base64) || content.image?.url || '',
                    caption: content.caption,
                });
            case 'video':
                return engine.sendVideoMessage(chatId, {
                    mimetype: content.video?.mimetype || 'video/mp4',
                    data: (0, media_cap_util_1.stripBase64DataUri)(content.video?.base64) || content.video?.url || '',
                    caption: content.caption,
                });
            case 'audio':
                return engine.sendAudioMessage(chatId, {
                    mimetype: content.audio?.mimetype || (content.audio?.ptt ? 'audio/ogg; codecs=opus' : 'audio/mpeg'),
                    data: (0, media_cap_util_1.stripBase64DataUri)(content.audio?.base64) || content.audio?.url || '',
                    ptt: content.audio?.ptt,
                });
            case 'document':
                return engine.sendDocumentMessage(chatId, {
                    mimetype: content.document?.mimetype || 'application/octet-stream',
                    data: (0, media_cap_util_1.stripBase64DataUri)(content.document?.base64) || content.document?.url || '',
                    filename: content.document?.filename,
                    caption: content.caption,
                });
            default:
                return Promise.reject(new Error(`Unsupported message type: ${type}`));
        }
    }
    calculateDelay(options) {
        let delay = options.delayBetweenMessages;
        if (options.randomizeDelay) {
            delay += Math.random() * 2000;
        }
        return delay;
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};
exports.BulkMessageService = BulkMessageService;
exports.BulkMessageService = BulkMessageService = BulkMessageService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(message_batch_entity_1.MessageBatch, 'data')),
    __param(5, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        engine_registry_service_1.EngineRegistry,
        message_service_1.MessageService,
        hooks_1.HookManager,
        send_pacing_service_1.SendPacingService,
        session_ownership_service_1.SessionOwnershipService])
], BulkMessageService);
//# sourceMappingURL=bulk-message.service.js.map