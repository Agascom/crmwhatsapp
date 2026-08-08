"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PluginLoaderService = void 0;
exports.resolvePluginMainPath = resolvePluginMainPath;
exports.pluginUpdateStagingDirName = pluginUpdateStagingDirName;
exports.pluginUpdateBackupDirName = pluginUpdateBackupDirName;
exports.buildSandboxWorkerEnv = buildSandboxWorkerEnv;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const lid_mapping_store_service_1 = require("../../engine/identity/lid-mapping-store.service");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const configuration_1 = require("../../config/configuration");
const logger_service_1 = require("../../common/services/logger.service");
const hooks_1 = require("../hooks");
const plugin_interfaces_1 = require("./plugin.interfaces");
const plugin_manifest_1 = require("./plugin-manifest");
const plugin_storage_service_1 = require("./plugin-storage.service");
const config_defaults_util_1 = require("./config-defaults.util");
const plugin_host_services_1 = require("./plugin-host-services");
const plugin_capability_context_1 = require("./plugin-capability-context");
const plugin_sandbox_bridge_1 = require("./plugin-sandbox-bridge");
const plugin_worker_host_1 = require("./sandbox/plugin-worker-host");
const worker_thread_channel_1 = require("./sandbox/worker-thread-channel");
const search_provider_registration_util_1 = require("./search-provider-registration.util");
const SANDBOX_MAX_OLD_GEN_MB = 256;
const SANDBOX_MAX_INFLIGHT_CAPS = 32;
const SANDBOX_CAP_TIMEOUT_MS = 30000;
const SANDBOX_ENV_ALLOWLIST = ['NODE_ENV', 'NODE_EXTRA_CA_CERTS', 'TZ'];
function resolvePluginMainPath(pluginsDir, pluginId, main) {
    const base = path.resolve(pluginsDir, pluginId);
    const mainPath = path.resolve(base, main);
    if (mainPath !== base && !mainPath.startsWith(base + path.sep)) {
        throw new Error(`Plugin ${pluginId} main path escapes the plugin directory`);
    }
    return mainPath;
}
function pluginUpdateStagingDirName(pluginId) {
    return `.${pluginId}.new`;
}
function pluginUpdateBackupDirName(pluginId) {
    return `.${pluginId}.bak`;
}
function buildSandboxWorkerEnv(source = process.env) {
    const env = {};
    for (const key of SANDBOX_ENV_ALLOWLIST) {
        if (source[key] !== undefined)
            env[key] = source[key];
    }
    env.NODE_ENV = source.NODE_ENV ?? 'production';
    return env;
}
const LEGACY_REMOVED_PLUGIN_IDS = new Set(['auto-reply', 'translation']);
function hasPluginPackages(dir) {
    try {
        return fs
            .readdirSync(dir, { withFileTypes: true })
            .some(entry => entry.isDirectory() &&
            !entry.name.startsWith('.') &&
            fs.existsSync(path.join(dir, entry.name, 'manifest.json')));
    }
    catch {
        return false;
    }
}
let PluginLoaderService = class PluginLoaderService {
    configService;
    hookManager;
    pluginStorage;
    moduleRef;
    lidMappingStore;
    logger = (0, logger_service_1.createLogger)('PluginLoaderService');
    plugins = new Map();
    enabling = new Set();
    sandboxHosts = new Map();
    lastSandboxHookError = new Map();
    pluginsDir;
    legacyPluginsDir;
    hostServices;
    capabilities;
    sandboxBridge;
    constructor(configService, hookManager, pluginStorage, moduleRef, lidMappingStore) {
        this.configService = configService;
        this.hookManager = hookManager;
        this.pluginStorage = pluginStorage;
        this.moduleRef = moduleRef;
        this.lidMappingStore = lidMappingStore;
        this.pluginsDir = this.configService.get('plugins.dir') ?? configuration_1.DEFAULT_PLUGINS_DIR;
        this.legacyPluginsDir = this.configService.get('plugins.legacyDir') ?? null;
        this.hostServices = new plugin_host_services_1.PluginHostServices(this.moduleRef);
        this.capabilities = new plugin_capability_context_1.PluginCapabilityContext(this.logger, this.hostServices, this.hookManager, this.pluginStorage, this.lidMappingStore);
        this.sandboxBridge = new plugin_sandbox_bridge_1.PluginSandboxBridge(this.logger, this.hookManager, this.capabilities, this.hostServices, this.configService, this.pluginStorage, this.plugins, this.sandboxHosts, this.lastSandboxHookError, this.pluginsDir, (capDispatcher, onHookSubscribe, onWebhookSubscribe, onLog, runWithHookGuard, onSearchProviderRegister, onWorkerExit) => this.createSandboxHost(capDispatcher, onHookSubscribe, onWebhookSubscribe, onLog, runWithHookGuard, onSearchProviderRegister, onWorkerExit), resolvePluginMainPath);
    }
    onModuleInit() {
        this.loadBuiltInPlugins();
        if (fs.existsSync(this.pluginsDir)) {
            this.loadPluginsFromDirectory(this.pluginsDir);
        }
        if (this.legacyPluginsDir && hasPluginPackages(this.legacyPluginsDir)) {
            this.logger.warn(`Loading plugins from the legacy directory ${this.legacyPluginsDir}: the default moved to ` +
                `${this.pluginsDir}, where the plugin registry and every new install already are. Move them ` +
                `(mv ${this.legacyPluginsDir}/* ${this.pluginsDir}/) or keep the old location by setting ` +
                `PLUGINS_DIR=${this.legacyPluginsDir}. In Docker this matters: a directory outside the data ` +
                `volume is destroyed on the next container recreate.`, { action: 'plugins_legacy_dir', legacyDir: this.legacyPluginsDir, pluginsDir: this.pluginsDir });
            this.loadPluginsFromDirectory(this.legacyPluginsDir);
        }
        this.logger.log(`Loaded ${this.plugins.size} plugins`, {
            action: 'plugins_loaded',
            count: this.plugins.size,
        });
        this.warnOnRegistryEntriesWithoutCode();
    }
    warnOnRegistryEntriesWithoutCode() {
        const orphaned = this.pluginStorage.getAllEntries().filter(e => !e.builtIn && !this.plugins.has(e.id));
        if (orphaned.length === 0)
            return;
        const missingDir = fs.existsSync(this.pluginsDir) ? '' : ' (that directory does not exist)';
        this.logger.warn(`The plugin registry lists ${orphaned.length} installed plugin(s) with no loaded code in ` +
            `${this.pluginsDir}${missingDir}: ${orphaned.map(e => e.id).join(', ')}. Their config and stored ` +
            `data are intact — reinstall them, or set PLUGINS_DIR to the directory that holds their code.`, { action: 'plugin_registry_without_code', count: orphaned.length, pluginsDir: this.pluginsDir });
    }
    async onApplicationBootstrap() {
        const restorable = this.getAllPlugins().filter(p => !p.builtIn && this.pluginStorage.getPluginEntry(p.manifest.id)?.enabledByOperator === true);
        for (const plugin of restorable) {
            const pluginId = plugin.manifest.id;
            try {
                await this.enablePlugin(pluginId);
            }
            catch (error) {
                this.logger.error(`Failed to restore plugin ${pluginId} on startup; it stays disabled until re-enabled`, error instanceof Error ? error.message : String(error), { pluginId, action: 'plugin_restore_failed' });
            }
        }
    }
    async onModuleDestroy() {
        const enabled = this.getAllPlugins().filter(p => p.status === plugin_interfaces_1.PluginStatus.ENABLED);
        for (const plugin of enabled) {
            try {
                await this.disablePlugin(plugin.manifest.id);
            }
            catch (error) {
                this.logger.error(`Failed to disable plugin ${plugin.manifest.id} during shutdown`, error instanceof Error ? error.message : String(error), { pluginId: plugin.manifest.id, action: 'plugin_shutdown_disable_failed' });
            }
        }
    }
    loadBuiltInPlugins() {
        this.logger.debug('Built-in plugins loading point (Phase 4)', {
            action: 'builtin_plugins_init',
        });
    }
    loadPluginsFromDirectory(dir) {
        this.recoverInterruptedUpdates(dir);
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory() || entry.name.startsWith('.'))
                continue;
            if (this.plugins.has(entry.name)) {
                this.logger.debug(`Skipped ${entry.name} in ${dir}: already loaded from another plugin directory`, {
                    pluginId: entry.name,
                    action: 'plugin_duplicate_dir_skipped',
                });
                continue;
            }
            const pluginPath = path.join(dir, entry.name);
            const manifestPath = path.join(pluginPath, 'manifest.json');
            if (!fs.existsSync(manifestPath)) {
                if (LEGACY_REMOVED_PLUGIN_IDS.has(entry.name)) {
                    this.logger.warn(`Skipped ${entry.name}: not a plugin (no manifest.json). Delete the directory to silence this, ` +
                        `or add a manifest.json if it is meant to load.`, { pluginPath, action: 'manifest_missing' });
                    this.pluginStorage.deletePluginEntry(entry.name);
                    this.logger.log(`Pruned stale registry entry for removed built-in plugin: ${entry.name}`, {
                        action: 'registry_ghost_pruned',
                    });
                    continue;
                }
                const registryEntry = this.pluginStorage.getPluginEntry(entry.name);
                if (registryEntry?.builtIn) {
                    this.logger.debug(`Skipped ${entry.name}: built-in plugin storage, not a package directory`, {
                        pluginPath,
                        pluginId: entry.name,
                        action: 'builtin_storage_dir_skipped',
                    });
                }
                else if (registryEntry) {
                    this.logger.warn(`Plugin ${entry.name} is installed but its code is missing from ${pluginPath} (no manifest.json) ` +
                        `while its stored data is still there. Reinstall it — its config and stored data are kept. ` +
                        `Plugin code kept outside the data volume does not survive a container recreate.`, { pluginPath, pluginId: entry.name, action: 'plugin_code_missing' });
                }
                else {
                    this.logger.warn(`Skipped ${entry.name}: not a plugin (no manifest.json). Delete the directory to silence this, ` +
                        `or add a manifest.json if it is meant to load.`, { pluginPath, action: 'manifest_missing' });
                }
                continue;
            }
            try {
                this.loadPlugin(pluginPath);
            }
            catch (error) {
                this.logger.error(`Failed to load plugin ${entry.name}`, error instanceof Error ? error.message : String(error), { pluginPath, action: 'plugin_load_failed' });
                this.pluginStorage.setPluginStatus(entry.name, plugin_interfaces_1.PluginStatus.ERROR);
            }
        }
    }
    recoverInterruptedUpdates(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (!entry.isDirectory())
                continue;
            const match = /^\.(.+)\.(?:bak|new)$/.exec(entry.name);
            if (!match)
                continue;
            const pluginId = match[1];
            const leftover = path.join(dir, entry.name);
            const liveDir = path.join(dir, pluginId);
            try {
                if (entry.name === pluginUpdateStagingDirName(pluginId)) {
                    fs.rmSync(leftover, { recursive: true, force: true });
                    this.logger.warn(`Dropped stale update staging for plugin ${pluginId}`, {
                        pluginId,
                        action: 'plugin_update_staging_pruned',
                    });
                }
                else if (!fs.existsSync(liveDir)) {
                    fs.renameSync(leftover, liveDir);
                    this.logger.warn(`Restored plugin ${pluginId} from its update backup — a previous update was interrupted mid-swap`, { pluginId, action: 'plugin_update_backup_restored' });
                }
                else {
                    fs.rmSync(leftover, { recursive: true, force: true });
                    this.logger.warn(`Dropped stale update backup for plugin ${pluginId}`, {
                        pluginId,
                        action: 'plugin_update_backup_pruned',
                    });
                }
            }
            catch (error) {
                this.logger.error(`Failed to reconcile the interrupted-update leftover ${entry.name}`, error instanceof Error ? error.message : String(error), { pluginId, action: 'plugin_update_recovery_failed' });
            }
        }
    }
    loadPlugin(pluginPath) {
        const manifestPath = path.join(pluginPath, 'manifest.json');
        const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
        const manifest = JSON.parse(manifestContent);
        (0, plugin_manifest_1.validatePluginManifest)(manifest);
        const mainPath = resolvePluginMainPath(path.dirname(pluginPath), path.basename(pluginPath), manifest.main);
        if (!fs.existsSync(mainPath) || !fs.statSync(mainPath).isFile()) {
            throw new Error(`Plugin ${manifest.id}: main file not found in the plugin directory: ${manifest.main}`);
        }
        (0, plugin_interfaces_1.validateIngressManifest)(manifest, this.configService.get('ingress.allowUnsigned', false));
        (0, plugin_interfaces_1.warnUnauthenticatedIngressRoutes)(manifest, this.logger);
        (0, plugin_interfaces_1.warnUnsignedTimestampRoutes)(manifest, this.logger);
        if (this.plugins.has(manifest.id)) {
            throw new Error(`Plugin ${manifest.id} is already loaded`);
        }
        const storedConfig = this.pluginStorage.getPluginConfig(manifest.id) ?? {};
        const storedSessions = this.pluginStorage.getPluginSessions(manifest.id) ?? undefined;
        const storedSessionConfig = this.pluginStorage.getPluginSessionConfig(manifest.id) ?? undefined;
        const pluginInstance = {
            manifest,
            status: plugin_interfaces_1.PluginStatus.INSTALLED,
            config: (0, config_defaults_util_1.seedConfigDefaults)(manifest.configSchema, storedConfig),
            instance: null,
            loadedAt: new Date(),
            builtIn: false,
            activeSessions: storedSessions,
            sessionConfig: storedSessionConfig,
        };
        this.plugins.set(manifest.id, pluginInstance);
        this.ensureRegistryEntry(manifest, false);
        this.logger.log(`Plugin loaded: ${manifest.name} v${manifest.version}`, {
            pluginId: manifest.id,
            type: manifest.type,
            action: 'plugin_loaded',
        });
        return pluginInstance;
    }
    ensureRegistryEntry(manifest, builtIn) {
        const existing = this.pluginStorage.getPluginEntry(manifest.id);
        const enabledByOperator = existing?.enabledByOperator ?? existing?.status === plugin_interfaces_1.PluginStatus.ENABLED;
        this.pluginStorage.setPluginEntry({
            id: manifest.id,
            type: manifest.type,
            name: manifest.name,
            version: manifest.version,
            status: plugin_interfaces_1.PluginStatus.INSTALLED,
            config: (0, config_defaults_util_1.seedConfigDefaults)(manifest.configSchema, existing?.config ?? {}),
            builtIn,
            installedAt: existing?.installedAt ?? new Date(),
            updatedAt: new Date(),
            activeSessions: existing?.activeSessions,
            sessionConfig: existing?.sessionConfig,
            enabledByOperator,
        });
    }
    setOperatorEnabled(pluginId, enabled) {
        this.pluginStorage.setPluginEnabledByOperator(pluginId, enabled);
    }
    getRegistryEntry(pluginId) {
        return this.pluginStorage.getPluginEntry(pluginId);
    }
    async enablePlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin ${pluginId} not found`);
        }
        if (plugin.status === plugin_interfaces_1.PluginStatus.ENABLED) {
            return;
        }
        if (plugin.manifest.type === plugin_interfaces_1.PluginType.ENGINE) {
            const activeEngine = this.configService.get('engine.type') ?? 'whatsapp-web.js';
            if (pluginId !== activeEngine) {
                throw new Error(`Engine "${pluginId}" is not the active engine ("${activeEngine}"). Set engine.type and restart to switch engines.`);
            }
        }
        if (this.enabling.has(pluginId)) {
            throw new Error(`Plugin ${pluginId} is already being enabled`);
        }
        this.enabling.add(pluginId);
        try {
            if (plugin.builtIn === false) {
                await this.sandboxBridge.enableSandboxed(pluginId, plugin);
            }
            else {
                await this.enableInProcess(pluginId, plugin);
            }
            plugin.status = plugin_interfaces_1.PluginStatus.ENABLED;
            plugin.enabledAt = new Date();
            plugin.error = undefined;
            this.pluginStorage.setPluginStatus(pluginId, plugin_interfaces_1.PluginStatus.ENABLED);
            this.logger.log(`Plugin enabled: ${plugin.manifest.name}`, {
                pluginId,
                action: 'plugin_enabled',
            });
        }
        catch (error) {
            plugin.status = plugin_interfaces_1.PluginStatus.ERROR;
            plugin.error = error instanceof Error ? error.message : String(error);
            this.pluginStorage.setPluginStatus(pluginId, plugin_interfaces_1.PluginStatus.ERROR);
            this.hookManager.unregisterPlugin(pluginId);
            throw error;
        }
        finally {
            this.enabling.delete(pluginId);
        }
    }
    async disablePlugin(pluginId, opts) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin ${pluginId} not found`);
        }
        if (plugin.status !== plugin_interfaces_1.PluginStatus.ENABLED) {
            return;
        }
        try {
            const host = this.sandboxHosts.get(pluginId);
            if (host) {
                await this.sandboxBridge.teardownSandboxed(pluginId, host, opts);
            }
            else {
                const context = this.capabilities.createPluginContext(plugin);
                if (plugin.instance?.onDisable) {
                    await plugin.instance.onDisable(context);
                }
            }
            this.hookManager.unregisterPlugin(pluginId);
            (0, search_provider_registration_util_1.unregisterPluginSearchProvider)(this.hostServices.getSearchRegistry(), pluginId);
            plugin.status = plugin_interfaces_1.PluginStatus.DISABLED;
            this.pluginStorage.setPluginStatus(pluginId, plugin_interfaces_1.PluginStatus.DISABLED);
            this.lastSandboxHookError.delete(pluginId);
            this.logger.log(`Plugin disabled: ${plugin.manifest.name}`, {
                pluginId,
                action: 'plugin_disabled',
            });
        }
        catch (error) {
            plugin.status = plugin_interfaces_1.PluginStatus.ERROR;
            plugin.error = error instanceof Error ? error.message : String(error);
            throw error;
        }
    }
    async unloadPlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin ${pluginId} not found`);
        }
        if (plugin.status === plugin_interfaces_1.PluginStatus.ENABLED) {
            await this.disablePlugin(pluginId, { unload: true });
        }
        if (plugin.instance?.onUnload) {
            const context = this.capabilities.createPluginContext(plugin);
            await plugin.instance.onUnload(context);
        }
        this.plugins.delete(pluginId);
        this.logger.log(`Plugin unloaded: ${plugin.manifest.name}`, {
            pluginId,
            action: 'plugin_unloaded',
        });
    }
    getPluginsDir() {
        return this.pluginsDir;
    }
    isBuiltIn(pluginId) {
        return this.pluginStorage.getPluginEntry(pluginId)?.builtIn ?? false;
    }
    async uninstallPlugin(pluginId) {
        if (this.pluginStorage.getPluginEntry(pluginId)?.builtIn) {
            throw new Error(`Cannot uninstall built-in plugin ${pluginId}`);
        }
        if (this.plugins.has(pluginId)) {
            await this.unloadPlugin(pluginId);
        }
        this.pluginStorage.deletePluginEntry(pluginId);
        const base = path.resolve(this.pluginsDir);
        const dir = path.resolve(base, pluginId);
        if (dir !== base && dir.startsWith(base + path.sep) && fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
        this.pluginStorage.deletePluginData(pluginId);
        this.logger.log(`Plugin uninstalled: ${pluginId}`, { pluginId, action: 'plugin_uninstalled' });
    }
    updatePluginConfig(pluginId, config) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin ${pluginId} not found`);
        }
        plugin.config = { ...plugin.config, ...config };
        this.pluginStorage.setPluginConfig(pluginId, plugin.config);
        if (plugin.status === plugin_interfaces_1.PluginStatus.ENABLED) {
            const sandboxHost = this.sandboxHosts.get(pluginId);
            if (sandboxHost) {
                sandboxHost.sendConfigChange(plugin.config);
            }
            else if (plugin.instance?.onConfigChange) {
                const context = this.capabilities.createPluginContext(plugin);
                void plugin.instance.onConfigChange(context, plugin.config);
            }
        }
        this.logger.debug(`Plugin config updated: ${pluginId}`, {
            pluginId,
            action: 'plugin_config_updated',
        });
    }
    setPluginSessions(pluginId, sessions) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin ${pluginId} not found`);
        }
        if (plugin.manifest.sessionScoped === false) {
            throw new Error(`Plugin ${pluginId} is global (not session-scoped) and cannot be activated per session`);
        }
        plugin.activeSessions = sessions;
        this.pluginStorage.setPluginSessions(pluginId, sessions);
        this.logger.log(`Plugin active sessions updated: ${pluginId}`, {
            pluginId,
            action: 'plugin_sessions_updated',
            sessions,
        });
        return plugin;
    }
    setPluginSessionConfig(pluginId, sessionId, config) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin ${pluginId} not found`);
        }
        if (plugin.manifest.sessionScoped === false) {
            throw new Error(`Plugin ${pluginId} is global (not session-scoped) and has no per-session config`);
        }
        const next = { ...(plugin.sessionConfig ?? {}) };
        if (config && Object.keys(config).length > 0) {
            next[sessionId] = config;
        }
        else {
            delete next[sessionId];
        }
        plugin.sessionConfig = next;
        this.pluginStorage.setPluginSessionConfig(pluginId, next);
        this.logger.debug(`Plugin session config updated: ${pluginId}`, {
            pluginId,
            action: 'plugin_session_config_updated',
            sessionId,
        });
        return plugin;
    }
    checkPluginHealth(pluginId) {
        return this.sandboxBridge.checkPluginHealth(pluginId);
    }
    dispatchWebhookForInstance(d) {
        return this.sandboxBridge.dispatchWebhookForInstance(d);
    }
    createSandboxHost(capDispatcher, onHookSubscribe, onWebhookSubscribe, onLog, runWithHookGuard, onSearchProviderRegister, onWorkerExit) {
        const workerEntry = path.join(__dirname, 'sandbox', 'worker-bootstrap.js');
        return new plugin_worker_host_1.PluginWorkerHost(new worker_thread_channel_1.WorkerThreadChannel({
            workerEntry,
            maxOldGenerationSizeMb: SANDBOX_MAX_OLD_GEN_MB,
            env: buildSandboxWorkerEnv(),
        }), capDispatcher, onHookSubscribe, onWebhookSubscribe, onLog, runWithHookGuard, SANDBOX_MAX_INFLIGHT_CAPS, onSearchProviderRegister, onWorkerExit, this.configService.get('plugins.capTimeoutMs') ?? SANDBOX_CAP_TIMEOUT_MS);
    }
    async enableInProcess(pluginId, plugin) {
        const context = this.capabilities.createPluginContext(plugin);
        if (!plugin.instance) {
            const mainPath = resolvePluginMainPath(this.pluginsDir, pluginId, plugin.manifest.main);
            const pluginModule = require(mainPath);
            if (pluginModule.default) {
                plugin.instance = new pluginModule.default();
            }
            else {
                throw new Error(`Plugin ${pluginId} does not export a default class`);
            }
        }
        if (plugin.instance.onLoad) {
            await plugin.instance.onLoad(context);
        }
        if (plugin.instance.onEnable) {
            await plugin.instance.onEnable(context);
        }
    }
    getPlugin(pluginId) {
        return this.plugins.get(pluginId);
    }
    getAllPlugins() {
        return Array.from(this.plugins.values());
    }
    getPluginsByType(type) {
        return this.getAllPlugins().filter(p => p.manifest.type === type);
    }
    getEnabledPlugins() {
        return this.getAllPlugins().filter(p => p.status === plugin_interfaces_1.PluginStatus.ENABLED);
    }
    isPluginEnabled(pluginId) {
        const plugin = this.plugins.get(pluginId);
        return plugin?.status === plugin_interfaces_1.PluginStatus.ENABLED;
    }
    registerBuiltInPlugin(manifest, instance, config = {}) {
        const effectiveConfig = { ...config, ...(this.pluginStorage.getPluginConfig(manifest.id) ?? {}) };
        const pluginInstance = {
            manifest,
            status: plugin_interfaces_1.PluginStatus.INSTALLED,
            config: effectiveConfig,
            instance,
            loadedAt: new Date(),
            builtIn: true,
            activeSessions: this.pluginStorage.getPluginSessions(manifest.id) ?? undefined,
            sessionConfig: this.pluginStorage.getPluginSessionConfig(manifest.id) ?? undefined,
        };
        this.plugins.set(manifest.id, pluginInstance);
        this.ensureRegistryEntry(manifest, true);
        this.logger.debug(`Built-in plugin registered: ${manifest.name}`, {
            pluginId: manifest.id,
            action: 'builtin_plugin_registered',
        });
    }
};
exports.PluginLoaderService = PluginLoaderService;
exports.PluginLoaderService = PluginLoaderService = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [config_1.ConfigService,
        hooks_1.HookManager,
        plugin_storage_service_1.PluginStorageService,
        core_1.ModuleRef,
        lid_mapping_store_service_1.LidMappingStoreService])
], PluginLoaderService);
//# sourceMappingURL=plugin-loader.service.js.map