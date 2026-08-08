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
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
exports.resolveSeedApiKey = resolveSeedApiKey;
exports.bannerKeyLine = bannerKeyLine;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const crypto_1 = require("crypto");
const ip_1 = require("../../common/utils/ip");
const api_key_hash_1 = require("./api-key-hash");
const api_key_entity_1 = require("./entities/api-key.entity");
const logger_service_1 = require("../../common/services/logger.service");
const bootstrap_key_file_1 = require("./bootstrap-key-file");
const api_key_usage_tracker_service_1 = require("./api-key-usage-tracker.service");
const events_gateway_1 = require("../events/events.gateway");
const ordering_lock_1 = require("../integration/ordering-lock");
function resolveSeedApiKey() {
    if (process.env.API_MASTER_KEY) {
        return process.env.API_MASTER_KEY;
    }
    if (process.env.ALLOW_DEV_API_KEY === 'true') {
        return 'dev-admin-key';
    }
    return `owa_k1_${(0, crypto_1.randomBytes)(32).toString('hex')}`;
}
function bannerKeyLine(displayKey, isNewKey) {
    if (isNewKey)
        return displayKey;
    if (displayKey.startsWith('('))
        return displayKey;
    return `${displayKey.slice(0, 8)}… (full key in data/.api-key or the dashboard)`;
}
let AuthService = class AuthService {
    static { AuthService_1 = this; }
    apiKeyRepository;
    usageTracker;
    moduleRef;
    logger = (0, logger_service_1.createLogger)('AuthService');
    adminCapabilityLock = new ordering_lock_1.KeyedAsyncLock();
    static ADMIN_CAPABILITY_LOCK_KEY = 'admin-capability';
    constructor(apiKeyRepository, usageTracker, moduleRef) {
        this.apiKeyRepository = apiKeyRepository;
        this.usageTracker = usageTracker;
        this.moduleRef = moduleRef;
    }
    async onModuleInit() {
        const count = await this.apiKeyRepository.count();
        let displayKey;
        let isNewKey = false;
        if (count === 0) {
            displayKey = resolveSeedApiKey();
            await this.seedApiKey(displayKey, 'Default Admin Key', api_key_entity_1.ApiKeyRole.ADMIN);
            isNewKey = true;
            try {
                (0, bootstrap_key_file_1.writeBootstrapKey)(displayKey);
            }
            catch (err) {
                this.logger.warn('Could not save API key file', { error: String(err) });
            }
        }
        else {
            displayKey = (await this.readLiveBootstrapKey()) ?? '(check dashboard for keys)';
        }
        const apiBaseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 2785}`;
        const dashboardUrl = process.env.DASHBOARD_URL || apiBaseUrl;
        this.logger.log('');
        this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        this.logger.log('');
        this.logger.log('  🟢 Welcome to OpenWA - WhatsApp API Gateway');
        this.logger.log('');
        this.logger.log(`  📊 Dashboard: ${dashboardUrl}`);
        this.logger.log(`  📚 API Docs:  ${apiBaseUrl}/api/docs`);
        this.logger.log('');
        if (isNewKey) {
            this.logger.log('  🔑 API Key (newly created):');
        }
        else {
            this.logger.log('  🔑 API Key:');
        }
        this.logger.log(`     ${bannerKeyLine(displayKey, isNewKey)}`);
        this.logger.log('');
        this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        this.logger.log('');
    }
    async onModuleDestroy() {
        await this.usageTracker.flushOnShutdown();
    }
    async readLiveBootstrapKey() {
        const rawKey = (0, bootstrap_key_file_1.readBootstrapKey)(this.logger);
        if (!rawKey)
            return null;
        const stored = await this.apiKeyRepository.findOne({ where: { keyHash: this.hashKey(rawKey) } });
        const live = Boolean(stored && stored.isActive && (!stored.expiresAt || stored.expiresAt > new Date()));
        if (live)
            return rawKey;
        if (!stored) {
            const byPrefix = await this.apiKeyRepository.findOne({ where: { keyPrefix: rawKey.substring(0, 12) } });
            if (byPrefix) {
                this.logger.warn('Bootstrap API key file does not match any stored key hash — API_KEY_PEPPER changed since the key was seeded? The key itself is still live, so the file is kept; restore the original pepper or rotate the key to repair.', { keyPrefix: byPrefix.keyPrefix, action: 'bootstrap_key_pepper_mismatch' });
                return null;
            }
        }
        (0, bootstrap_key_file_1.removeBootstrapKey)('it no longer resolves to an active key', this.logger);
        return null;
    }
    removeBootstrapKeyFileIfMatching(apiKey) {
        const fileKey = (0, bootstrap_key_file_1.readBootstrapKey)(this.logger);
        if (!fileKey || this.hashKey(fileKey) !== apiKey.keyHash)
            return;
        (0, bootstrap_key_file_1.removeBootstrapKey)('its key was revoked or deleted', this.logger);
    }
    async seedApiKey(rawKey, name, role) {
        const keyHash = this.hashKey(rawKey);
        const keyPrefix = rawKey.substring(0, 12);
        const apiKey = this.apiKeyRepository.create({
            name,
            keyHash,
            keyPrefix,
            role,
        });
        return this.apiKeyRepository.save(apiKey);
    }
    async createApiKey(dto) {
        const rawKey = `owa_k1_${(0, crypto_1.randomBytes)(32).toString('hex')}`;
        const keyHash = this.hashKey(rawKey);
        const keyPrefix = rawKey.substring(0, 12);
        const apiKey = this.apiKeyRepository.create({
            name: dto.name,
            keyHash,
            keyPrefix,
            role: dto.role || api_key_entity_1.ApiKeyRole.OPERATOR,
            allowedIps: dto.allowedIps || null,
            allowedSessions: dto.allowedSessions || null,
            expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        });
        const saved = await this.apiKeyRepository.save(apiKey);
        this.logger.log(`API key created: ${saved.name}`, {
            keyId: saved.id,
            role: saved.role,
            action: 'api_key_created',
        });
        return { apiKey: saved, rawKey };
    }
    async findAll() {
        return this.apiKeyRepository.find({
            order: { createdAt: 'DESC' },
        });
    }
    async findOne(id) {
        const apiKey = await this.apiKeyRepository.findOne({ where: { id } });
        if (!apiKey) {
            throw new common_1.NotFoundException(`API key with id '${id}' not found`);
        }
        return apiKey;
    }
    async update(id, dto) {
        const apiKey = await this.findOne(id);
        const removesOrSchedulesLastAdmin = (dto.role !== undefined && dto.role !== api_key_entity_1.ApiKeyRole.ADMIN) ||
            (dto.expiresAt !== undefined && dto.expiresAt !== null) ||
            (dto.allowedSessions !== undefined && dto.allowedSessions.length > 0);
        const applyAndSave = async () => {
            const target = await this.findOne(id);
            if (removesOrSchedulesLastAdmin) {
                await this.assertNotLastUsableAdmin(target);
            }
            const before = {
                role: target.role,
                allowedIps: target.allowedIps,
                allowedSessions: target.allowedSessions,
                expiresAt: target.expiresAt,
            };
            if (dto.name)
                target.name = dto.name;
            if (dto.role)
                target.role = dto.role;
            if (dto.allowedIps !== undefined)
                target.allowedIps = dto.allowedIps;
            if (dto.allowedSessions !== undefined)
                target.allowedSessions = dto.allowedSessions;
            if (dto.expiresAt !== undefined)
                target.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
            const saved = await this.apiKeyRepository.save(target);
            const ordered = (v) => (v ? [...v].sort() : v);
            const authzChanged = saved.role !== before.role ||
                saved.expiresAt?.getTime() !== before.expiresAt?.getTime() ||
                JSON.stringify(ordered(saved.allowedIps)) !== JSON.stringify(ordered(before.allowedIps)) ||
                JSON.stringify(ordered(saved.allowedSessions)) !== JSON.stringify(ordered(before.allowedSessions));
            if (authzChanged) {
                this.evictActiveSockets(id, 'authorization_changed');
            }
            return saved;
        };
        return removesOrSchedulesLastAdmin && apiKey.role === api_key_entity_1.ApiKeyRole.ADMIN
            ? this.adminCapabilityLock.run(AuthService_1.ADMIN_CAPABILITY_LOCK_KEY, applyAndSave)
            : applyAndSave();
    }
    async delete(id) {
        const apiKey = await this.findOne(id);
        const removeKey = async () => {
            const target = await this.findOne(id);
            await this.assertNotLastUsableAdmin(target);
            this.usageTracker.forget(id);
            await this.apiKeyRepository.remove(target);
            this.removeBootstrapKeyFileIfMatching(target);
        };
        if (apiKey.role === api_key_entity_1.ApiKeyRole.ADMIN) {
            await this.adminCapabilityLock.run(AuthService_1.ADMIN_CAPABILITY_LOCK_KEY, removeKey);
        }
        else {
            await removeKey();
        }
        this.evictActiveSockets(id, 'deleted');
        this.logger.log(`API key deleted: ${apiKey.name}`, {
            keyId: id,
            action: 'api_key_deleted',
        });
    }
    async revoke(id) {
        const apiKey = await this.findOne(id);
        const revokeKey = async () => {
            const target = await this.findOne(id);
            await this.assertNotLastUsableAdmin(target);
            this.usageTracker.forget(id);
            target.isActive = false;
            const saved = await this.apiKeyRepository.save(target);
            this.removeBootstrapKeyFileIfMatching(target);
            return saved;
        };
        const saved = apiKey.role === api_key_entity_1.ApiKeyRole.ADMIN
            ? await this.adminCapabilityLock.run(AuthService_1.ADMIN_CAPABILITY_LOCK_KEY, revokeKey)
            : await revokeKey();
        this.evictActiveSockets(id, 'revoked');
        return saved;
    }
    static isUsableAdmin(key, now = new Date()) {
        return (key.role === api_key_entity_1.ApiKeyRole.ADMIN &&
            key.isActive &&
            (!key.expiresAt || key.expiresAt > now) &&
            (!key.allowedSessions || key.allowedSessions.length === 0));
    }
    async assertNotLastUsableAdmin(target) {
        const now = new Date();
        if (!AuthService_1.isUsableAdmin(target, now))
            return;
        const otherUsableAdmins = await this.apiKeyRepository.count({
            where: [
                { id: (0, typeorm_2.Not)(target.id), role: api_key_entity_1.ApiKeyRole.ADMIN, isActive: true, expiresAt: (0, typeorm_2.IsNull)(), allowedSessions: (0, typeorm_2.IsNull)() },
                { id: (0, typeorm_2.Not)(target.id), role: api_key_entity_1.ApiKeyRole.ADMIN, isActive: true, expiresAt: (0, typeorm_2.IsNull)(), allowedSessions: (0, typeorm_2.Equal)('') },
                {
                    id: (0, typeorm_2.Not)(target.id),
                    role: api_key_entity_1.ApiKeyRole.ADMIN,
                    isActive: true,
                    expiresAt: (0, typeorm_2.MoreThan)(now),
                    allowedSessions: (0, typeorm_2.IsNull)(),
                },
                {
                    id: (0, typeorm_2.Not)(target.id),
                    role: api_key_entity_1.ApiKeyRole.ADMIN,
                    isActive: true,
                    expiresAt: (0, typeorm_2.MoreThan)(now),
                    allowedSessions: (0, typeorm_2.Equal)(''),
                },
            ],
        });
        if (otherUsableAdmins === 0) {
            throw new common_1.ConflictException('Cannot remove the last active admin key');
        }
    }
    evictActiveSockets(keyId, reason = 'revoked') {
        try {
            const gateway = this.moduleRef.get(events_gateway_1.EventsGateway, { strict: false });
            if (gateway) {
                gateway.evictApiKey(keyId, reason);
            }
        }
        catch (error) {
            this.logger.warn(`Failed to evict WebSocket sockets for key ${keyId}`, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async validateApiKey(rawKey, clientIp, sessionId) {
        const keyHash = this.hashKey(rawKey?.trim());
        const apiKey = await this.apiKeyRepository.findOne({ where: { keyHash } });
        if (!apiKey) {
            throw new common_1.UnauthorizedException('Invalid API key');
        }
        if (!apiKey.isActive) {
            throw new common_1.UnauthorizedException('API key is revoked');
        }
        if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
            throw new common_1.UnauthorizedException('API key has expired');
        }
        if (apiKey.allowedIps && apiKey.allowedIps.length > 0) {
            if (!clientIp) {
                throw new common_1.UnauthorizedException('Client IP could not be determined');
            }
            if (!this.isIpAllowed(clientIp, apiKey.allowedIps)) {
                this.logger.warn(`IP not allowed: ${clientIp}`, {
                    keyId: apiKey.id,
                    action: 'ip_rejected',
                });
                throw new common_1.UnauthorizedException('IP address not allowed');
            }
        }
        if (apiKey.allowedSessions && apiKey.allowedSessions.length > 0 && sessionId) {
            if (!apiKey.allowedSessions.includes(sessionId)) {
                throw new common_1.UnauthorizedException('API key not authorized for this session');
            }
        }
        await this.usageTracker.record(apiKey);
        return apiKey;
    }
    hashKey(rawKey) {
        return (0, api_key_hash_1.hashApiKey)(rawKey, process.env.API_KEY_PEPPER);
    }
    isIpAllowed(clientIp, allowedIps) {
        return allowedIps.some(entry => (0, ip_1.ipMatches)(clientIp, entry));
    }
    hasPermission(apiKey, requiredRole) {
        const roleHierarchy = {
            [api_key_entity_1.ApiKeyRole.VIEWER]: 1,
            [api_key_entity_1.ApiKeyRole.OPERATOR]: 2,
            [api_key_entity_1.ApiKeyRole.ADMIN]: 3,
        };
        return roleHierarchy[apiKey.role] >= roleHierarchy[requiredRole];
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(api_key_entity_1.ApiKey, 'main')),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        api_key_usage_tracker_service_1.ApiKeyUsageTracker,
        core_1.ModuleRef])
], AuthService);
//# sourceMappingURL=auth.service.js.map