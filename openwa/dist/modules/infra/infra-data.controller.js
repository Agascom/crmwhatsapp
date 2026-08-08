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
exports.InfraDataController = void 0;
exports.restoreSessionOwnership = restoreSessionOwnership;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const infra_response_dto_1 = require("./dto/infra-response.dto");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("typeorm");
const typeorm_2 = require("@nestjs/typeorm");
const auth_decorators_1 = require("../auth/decorators/auth.decorators");
const api_key_entity_1 = require("../auth/entities/api-key.entity");
const logger_service_1 = require("../../common/services/logger.service");
const db_errors_1 = require("../../common/utils/db-errors");
const audit_service_1 = require("../audit/audit.service");
const audit_log_entity_1 = require("../audit/entities/audit-log.entity");
const session_service_1 = require("../session/session.service");
const lid_mapping_store_service_1 = require("../../engine/identity/lid-mapping-store.service");
const session_ownership_service_1 = require("../session/session-ownership.service");
const table_importers_1 = require("./table-importers");
async function readSessionOwnership(queryRunner) {
    if (!(await queryRunner.hasColumn('sessions', 'nodeId')))
        return null;
    return (await queryRunner.query('SELECT id, "nodeId", "claimedAt", "leaseExpiresAt", "nodeUrl" FROM sessions WHERE "nodeId" IS NOT NULL'));
}
function carryLease(raw, readAt, now) {
    if (!(raw instanceof Date) && typeof raw !== 'string')
        return raw;
    if (typeof raw === 'string' && !raw.endsWith('Z'))
        return raw;
    const deadline = raw instanceof Date ? raw : new Date(raw);
    const remainingMs = deadline.getTime() - readAt.getTime();
    if (Number.isNaN(remainingMs) || remainingMs <= 0)
        return raw;
    const carried = new Date(Math.max(now.getTime() + remainingMs, deadline.getTime()));
    if (!Number.isFinite(carried.getTime()))
        return raw;
    return raw instanceof Date ? carried : carried.toISOString();
}
async function restoreSessionOwnership(preserved, insert, readAt, now = new Date()) {
    if (!preserved?.length)
        return;
    for (const row of preserved) {
        await insert('UPDATE sessions SET "nodeId" = $1, "claimedAt" = $2, "leaseExpiresAt" = $3, "nodeUrl" = $4 WHERE id = $5', [row.nodeId, row.claimedAt, carryLease(row.leaseExpiresAt, readAt, now), row.nodeUrl, row.id]);
    }
}
const SHARED_CONNECTION_DIALECTS = new Set(['better-sqlite3', 'sqlite']);
const DEFAULT_EXPORT_INLINE_MEDIA_BUDGET_BYTES = 8 * 1024 * 1024;
function exportInlineMediaBudgetBytes() {
    const parsed = Number.parseInt(process.env.EXPORT_INLINE_MEDIA_BUDGET_BYTES ?? '', 10);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : DEFAULT_EXPORT_INLINE_MEDIA_BUDGET_BYTES;
}
function isMediaPointer(data) {
    return /^https?:\/\//i.test(data);
}
function newestFirst(rows, at) {
    const key = (row) => {
        const value = at(row);
        return Number.isFinite(value) ? value : 0;
    };
    return [...rows].sort((a, b) => key(b) - key(a));
}
function createInlineMediaBudget() {
    const budget = exportInlineMediaBudgetBytes();
    let spent = 0;
    let dropped = 0;
    return {
        exceeds: (encodedBytes) => {
            if (spent + encodedBytes > budget) {
                dropped += 1;
                return true;
            }
            spent += encodedBytes;
            return false;
        },
        droppedPayloads: () => dropped,
    };
}
function stripInlineMediaPayload(row, exceedsBudget) {
    const raw = row.metadata;
    if (typeof raw !== 'string')
        return;
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        return;
    }
    if (typeof parsed !== 'object' || parsed === null)
        return;
    const bag = parsed;
    const media = bag.media;
    if (!media || typeof media.data !== 'string' || isMediaPointer(media.data))
        return;
    if (!exceedsBudget(Buffer.byteLength(media.data, 'utf8')))
        return;
    const { data, ...withoutPayload } = media;
    bag.media = {
        ...withoutPayload,
        omitted: true,
        sizeBytes: media.sizeBytes ?? Buffer.byteLength(data, 'base64'),
    };
    row.metadata = JSON.stringify(bag);
}
function stripBatchInlineMedia(row, exceedsBudget) {
    const raw = row.messages;
    if (typeof raw !== 'string')
        return;
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        return;
    }
    if (!Array.isArray(parsed))
        return;
    let stripped = false;
    for (const entry of parsed) {
        const content = entry?.content;
        if (typeof content !== 'object' || content === null)
            continue;
        for (const key of ['image', 'video', 'audio', 'document']) {
            const media = content[key];
            if (!media || typeof media !== 'object' || typeof media.base64 !== 'string')
                continue;
            if (!exceedsBudget(Buffer.byteLength(media.base64, 'utf8')))
                continue;
            delete media.base64;
            stripped = true;
        }
    }
    if (stripped)
        row.messages = JSON.stringify(parsed);
}
let InfraDataController = class InfraDataController {
    configService;
    dataDataSource;
    auditService;
    sessionService;
    lidMappingStore;
    ownership;
    logger = (0, logger_service_1.createLogger)('InfraDataController');
    importInFlight = false;
    constructor(configService, dataDataSource, auditService, sessionService, lidMappingStore, ownership) {
        this.configService = configService;
        this.dataDataSource = dataDataSource;
        this.auditService = auditService;
        this.sessionService = sessionService;
        this.lidMappingStore = lidMappingStore;
        this.ownership = ownership;
    }
    async exportData() {
        const sessions = await this.dataDataSource.query('SELECT * FROM sessions');
        const webhooks = await this.dataDataSource.query('SELECT * FROM webhooks');
        const skippedTables = [];
        const queryOptionalTable = async (table) => {
            try {
                return await this.dataDataSource.query(`SELECT * FROM ${table}`);
            }
            catch (error) {
                if (!(0, db_errors_1.isMissingTableError)(error))
                    throw error;
                skippedTables.push(table);
                this.logger.warn('Optional table does not exist in this DB; exporting without it', { table });
                return [];
            }
        };
        const inlineMediaBudget = createInlineMediaBudget();
        const exceedsBudget = inlineMediaBudget.exceeds;
        const messages = await queryOptionalTable('messages');
        for (const row of messages) {
            delete row.body_ts;
        }
        for (const row of newestFirst(messages, row => Number(row.timestamp))) {
            stripInlineMediaPayload(row, exceedsBudget);
        }
        const omittedMessageMedia = inlineMediaBudget.droppedPayloads();
        const messageBatches = await queryOptionalTable('message_batches');
        for (const row of newestFirst(messageBatches, row => Date.parse(row.created_at))) {
            stripBatchInlineMedia(row, exceedsBudget);
        }
        const templates = await queryOptionalTable('templates');
        const baileysStoredMessages = await queryOptionalTable('baileys_stored_messages');
        const lidMappings = await queryOptionalTable('lid_mappings');
        const pluginInstances = await queryOptionalTable('plugin_instances');
        const conversationMappings = await queryOptionalTable('conversation_mappings');
        const ingressEvents = await queryOptionalTable('ingress_events');
        const webhookDeliveryFailures = await queryOptionalTable('webhook_delivery_failures');
        const integrationDeliveryFailures = await queryOptionalTable('integration_delivery_failures');
        const statusUpdates = await queryOptionalTable('status_updates');
        const automationRules = await queryOptionalTable('automation_rules');
        const counts = {
            sessions: sessions.length,
            webhooks: webhooks.length,
            messages: messages.length,
            messageBatches: messageBatches.length,
            templates: templates.length,
            baileysStoredMessages: baileysStoredMessages.length,
            lidMappings: lidMappings.length,
            pluginInstances: pluginInstances.length,
            conversationMappings: conversationMappings.length,
            ingressEvents: ingressEvents.length,
            webhookDeliveryFailures: webhookDeliveryFailures.length,
            integrationDeliveryFailures: integrationDeliveryFailures.length,
            statusUpdates: statusUpdates.length,
            automationRules: automationRules.length,
        };
        await this.auditService?.logInfo(audit_log_entity_1.AuditAction.INFRA_DATA_EXPORTED, { metadata: { counts } });
        return {
            exportedAt: new Date().toISOString(),
            dataDbType: this.configService.get('dataDatabase.type', 'sqlite'),
            tables: {
                sessions,
                webhooks,
                messages,
                messageBatches,
                templates,
                baileysStoredMessages,
                lidMappings,
                pluginInstances,
                conversationMappings,
                ingressEvents,
                webhookDeliveryFailures,
                integrationDeliveryFailures,
                statusUpdates,
                automationRules,
            },
            counts,
            skippedTables,
            omittedInlineMedia: {
                messages: omittedMessageMedia,
                messageBatches: inlineMediaBudget.droppedPayloads() - omittedMessageMedia,
            },
        };
    }
    async importData(data) {
        if (this.importInFlight) {
            throw new common_1.ConflictException({
                statusCode: 409,
                error: 'Conflict',
                message: 'A data import is already running; wait for it to finish before starting another.',
                code: 'IMPORT_ALREADY_RUNNING',
            });
        }
        this.importInFlight = true;
        try {
            return await this.runImport(data);
        }
        finally {
            this.importInFlight = false;
        }
    }
    async runImport(data) {
        const warnings = [];
        const importedSessionIds = new Set((data.tables.sessions ?? []).map(s => s.id));
        const orphanedEngines = (this.sessionService?.getActiveSessionIds() ?? []).filter(id => !importedSessionIds.has(id));
        let stoppedOrphanEngines = [];
        let failedOrphanEngines = [];
        let restartRequired = false;
        const notices = [];
        const heldElsewhere = (await this.ownership?.heldByOtherNodes()) ?? [];
        if (heldElsewhere.length > 0) {
            restartRequired = true;
            notices.push(`${heldElsewhere.length} session(s) are running on another node and could not be reconciled from ` +
                `this request: ${heldElsewhere.join(', ')}. Their engines may still write into the restored ` +
                `tables — stop those nodes before relying on this import.`);
        }
        if (orphanedEngines.length > 0 && data.stopOrphans && this.sessionService) {
            const result = await this.sessionService.stopOrphanEngines(orphanedEngines);
            stoppedOrphanEngines = result.stopped;
            failedOrphanEngines = result.failed;
            if (failedOrphanEngines.length > 0) {
                restartRequired = true;
                notices.push(`Teardown failed for ${failedOrphanEngines.length} orphan engine(s): ${failedOrphanEngines.join(', ')} ` +
                    `(removed from the engine registry; a process restart guarantees cleanup).`);
            }
            if (result.notRunning.length > 0) {
                notices.push(`${result.notRunning.length} orphan session(s) had no live engine yet (still initializing): ` +
                    `${result.notRunning.join(', ')} — their start() will self-abort.`);
            }
        }
        else if (orphanedEngines.length > 0 && !data.force) {
            throw new common_1.ConflictException({
                statusCode: 409,
                error: 'Conflict',
                message: `Import would orphan ${orphanedEngines.length} running engine(s) for session(s) ` +
                    `${orphanedEngines.join(', ')} that the backup does not contain. Stop them first, retry with ` +
                    `stopOrphans=true (stops them inside this request), or retry with force=true ` +
                    `(a server restart is then required to stop the orphaned engines).`,
                code: 'IMPORT_WOULD_ORPHAN_ENGINES',
            });
        }
        else if (orphanedEngines.length > 0 && data.force) {
            restartRequired = true;
        }
        const engineStateAfterRollback = {
            restartRequired: failedOrphanEngines.length > 0,
            orphanedEngines,
            stoppedOrphanEngines,
            failedOrphanEngines,
        };
        const sharesOneConnection = SHARED_CONNECTION_DIALECTS.has(this.dataDataSource.options.type);
        const resumeLossDetection = sharesOneConnection ? this.ownership?.suspendLossDetection() : undefined;
        try {
            const queryRunner = this.dataDataSource.createQueryRunner();
            await queryRunner.connect();
            if (queryRunner.isTransactionActive) {
                throw new common_1.ConflictException({
                    statusCode: 409,
                    error: 'Conflict',
                    message: 'Another database transaction is in progress on this connection, so a restore could not be ' +
                        'made durable. Retry with no other data operation in flight.',
                    code: 'IMPORT_NESTED_TRANSACTION',
                });
            }
            await queryRunner.startTransaction();
            try {
                const clearTable = async (table) => {
                    try {
                        await queryRunner.query(`DELETE FROM ${table}`);
                    }
                    catch (err) {
                        if (!(0, db_errors_1.isMissingTableError)(err))
                            throw err;
                        this.logger.debug('Skipped clearing a table that does not exist during import', { table });
                    }
                };
                const isPostgres = this.dataDataSource.options.type === 'postgres';
                const insert = (text, params) => queryRunner.query(isPostgres ? text : text.replace(/\$\d+/g, '?'), isPostgres ? params : params.map(v => (typeof v === 'boolean' ? Number(v) : (v ?? null))));
                await queryRunner.query('DELETE FROM webhooks');
                await clearTable('messages');
                await clearTable('message_batches');
                await clearTable('templates');
                await clearTable('baileys_stored_messages');
                await clearTable('lid_mappings');
                await clearTable('plugin_instances');
                await clearTable('conversation_mappings');
                await clearTable('ingress_events');
                await clearTable('webhook_delivery_failures');
                await clearTable('integration_delivery_failures');
                await clearTable('status_updates');
                const preservedOwnership = await readSessionOwnership(queryRunner);
                const ownershipReadAt = new Date();
                await queryRunner.query('DELETE FROM sessions');
                const counts = Object.fromEntries(table_importers_1.TABLE_IMPORTERS.map(importer => [importer.key, 0]));
                for (const importer of table_importers_1.TABLE_IMPORTERS) {
                    const rows = data.tables[importer.key];
                    if (!rows?.length)
                        continue;
                    for (const untypedRow of rows) {
                        const row = untypedRow;
                        const skipWarning = importer.skip?.(row);
                        if (skipWarning != null) {
                            warnings.push(skipWarning);
                            continue;
                        }
                        try {
                            await insert(importer.sql, importer.map(row));
                            counts[importer.key]++;
                        }
                        catch (err) {
                            warnings.push(`Failed to import ${importer.label} ${importer.id(row)}: ${err instanceof Error ? err.message : String(err)}`);
                        }
                    }
                }
                try {
                    await restoreSessionOwnership(preservedOwnership, insert, ownershipReadAt);
                }
                catch (error) {
                    warnings.push(`Failed to restore session ownership: ${error instanceof Error ? error.message : String(error)}`);
                }
                if (warnings.length > 0) {
                    await queryRunner.rollbackTransaction();
                    return {
                        imported: false,
                        counts,
                        warnings,
                        notices,
                        ...engineStateAfterRollback,
                    };
                }
                const totalRestored = Object.values(counts).reduce((sum, n) => sum + n, 0);
                if (totalRestored === 0) {
                    await queryRunner.rollbackTransaction();
                    return {
                        imported: false,
                        counts,
                        warnings: ['Backup contained no rows to restore; refused to replace existing data. Check the file.'],
                        notices,
                        ...engineStateAfterRollback,
                    };
                }
                await queryRunner.commitTransaction();
                await this.lidMappingStore?.reload();
                await this.auditService?.logInfo(audit_log_entity_1.AuditAction.INFRA_DATA_IMPORTED, { metadata: { counts } });
                return {
                    imported: true,
                    counts,
                    warnings,
                    notices,
                    restartRequired,
                    orphanedEngines,
                    stoppedOrphanEngines,
                    failedOrphanEngines,
                };
            }
            catch (error) {
                await queryRunner.rollbackTransaction();
                throw error;
            }
            finally {
                await queryRunner.release();
            }
        }
        finally {
            resumeLossDetection?.();
        }
    }
};
exports.InfraDataController = InfraDataController;
__decorate([
    (0, common_1.Get)('export-data'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Export all data from Data DB for migration' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Exported data as JSON', type: infra_response_dto_1.InfraExportDataResponseDto }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], InfraDataController.prototype, "exportData", null);
__decorate([
    (0, common_1.Post)('import-data'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Import data to Data DB (replaces existing data)' }),
    (0, swagger_1.ApiBody)({
        description: 'Exported data from export-data endpoint',
        schema: {
            type: 'object',
            properties: {
                force: {
                    type: 'boolean',
                    description: 'Allow the replace to proceed even while engines are running for sessions the backup does not contain (they keep running until restart; see restartRequired). Prefer stopOrphans, which closes that window inside this request instead.',
                },
                stopOrphans: {
                    type: 'boolean',
                    description: 'Stop the running engines for sessions the backup does not contain, inside this request and before the replace runs. Supersedes force for the orphan case: with stopOrphans the engines no longer need a process restart to reconcile, so restartRequired stays false on the success path.',
                },
                tables: {
                    type: 'object',
                    description: 'Every one of the 14 migration tables is emptied before the restore runs, so a key omitted here is restored EMPTY rather than left untouched. Post the whole GET /api/infra/export-data payload, not a hand-built subset.',
                    properties: {
                        sessions: { type: 'array' },
                        webhooks: { type: 'array' },
                        messages: { type: 'array' },
                        messageBatches: { type: 'array' },
                        templates: { type: 'array' },
                        baileysStoredMessages: { type: 'array' },
                        lidMappings: { type: 'array' },
                        pluginInstances: { type: 'array' },
                        conversationMappings: { type: 'array' },
                        ingressEvents: { type: 'array' },
                        webhookDeliveryFailures: { type: 'array' },
                        integrationDeliveryFailures: { type: 'array' },
                        statusUpdates: { type: 'array' },
                        automationRules: { type: 'array' },
                    },
                },
            },
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Data imported successfully', type: infra_response_dto_1.InfraImportDataResponseDto }),
    (0, swagger_1.ApiResponse)({
        status: 409,
        description: 'Refused, with the reason in `code`. IMPORT_ALREADY_RUNNING: another import is running — wait for it. IMPORT_NESTED_TRANSACTION: another database transaction holds this connection, so a restore could not be made durable — retry with nothing else in flight. IMPORT_WOULD_ORPHAN_ENGINES: live engines exist for sessions the backup would remove — retry with stopOrphans=true to stop them in-request, or force=true to proceed and restart after. Only the last of these is retryable with stopOrphans; the others leave nothing to decide',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], InfraDataController.prototype, "importData", null);
exports.InfraDataController = InfraDataController = __decorate([
    (0, swagger_1.ApiTags)('infrastructure'),
    (0, common_1.Controller)('infra'),
    (0, auth_decorators_1.RequireUnscopedKey)(),
    __param(1, (0, typeorm_2.InjectDataSource)('data')),
    __param(2, (0, common_1.Optional)()),
    __param(3, (0, common_1.Optional)()),
    __param(4, (0, common_1.Optional)()),
    __param(5, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [config_1.ConfigService,
        typeorm_1.DataSource,
        audit_service_1.AuditService,
        session_service_1.SessionService,
        lid_mapping_store_service_1.LidMappingStoreService,
        session_ownership_service_1.SessionOwnershipService])
], InfraDataController);
//# sourceMappingURL=infra-data.controller.js.map