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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppWebJsAdapter = exports.probeOnboardingModal = exports.buildProxyLaunchConfig = exports.isSupportedProxyUrl = exports.wwebjsAckToDeliveryStatus = exports.extractWwebjsCall = exports.loadRemoteMedia = exports.isHttpUrl = exports.extractLinkedParentJID = exports.resolveAuthTimeoutMs = exports.READY_RECONCILE_BRIDGE_RELOAD_GRACE_MS = exports.READY_RECONCILE_TIMEOUT_MS = void 0;
exports.isExecutionContextDestroyedError = isExecutionContextDestroyedError;
const events_1 = require("events");
const whatsapp_web_js_1 = require("whatsapp-web.js");
const qrcode = __importStar(require("qrcode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const whatsapp_engine_interface_1 = require("../interfaces/whatsapp-engine.interface");
const engine_not_supported_error_1 = require("../../common/errors/engine-not-supported.error");
const wa_web_version_1 = require("../wa-web-version");
const engine_init_timeout_1 = require("../engine-init-timeout");
Object.defineProperty(exports, "resolveAuthTimeoutMs", { enumerable: true, get: function () { return engine_init_timeout_1.resolveAuthTimeoutMs; } });
const chromium_profile_hygiene_1 = require("./chromium-profile-hygiene");
const wa_id_1 = require("../identity/wa-id");
const logger_service_1 = require("../../common/services/logger.service");
const engine_not_ready_error_1 = require("../../common/errors/engine-not-ready.error");
const call_not_found_error_1 = require("../../common/errors/call-not-found.error");
const channel_media_not_supported_error_1 = require("../../common/errors/channel-media-not-supported.error");
const wwebjs_groups_1 = require("./wwebjs-groups");
const wwebjs_message_events_1 = require("./wwebjs-message-events");
const wwebjs_messaging_1 = require("./wwebjs-messaging");
const wwebjs_contacts_1 = require("./wwebjs-contacts");
const wwebjs_profile_1 = require("./wwebjs-profile");
const wwebjs_labels_1 = require("./wwebjs-labels");
const wwebjs_channels_1 = require("./wwebjs-channels");
const wwebjs_status_1 = require("./wwebjs-status");
const wwebjs_chats_1 = require("./wwebjs-chats");
const wwebjs_catalog_1 = require("./wwebjs-catalog");
const wwebjs_proxy_1 = require("./wwebjs-proxy");
const wwebjs_onboarding_1 = require("./wwebjs-onboarding");
const wwebjs_group_events_1 = require("./wwebjs-group-events");
const wwebjs_backport_check_1 = require("./wwebjs-backport-check");
const inbound_media_cap_1 = require("./inbound-media-cap");
const concurrency_limiter_1 = require("../../common/utils/concurrency-limiter");
function isExecutionContextDestroyedError(reason) {
    return /execution context was destroyed/i.test(reason);
}
const READY_RECONCILE_INTERVAL_MS = 2000;
exports.READY_RECONCILE_TIMEOUT_MS = 90_000;
exports.READY_RECONCILE_BRIDGE_RELOAD_GRACE_MS = 45_000;
const WA_STATE_RESTRICTIONS = {
    TOS_BLOCK: 'tos_block',
    SMB_TOS_BLOCK: 'tos_block',
    PROXYBLOCK: 'proxy_block',
};
const ONBOARDING_MODAL_INTERVAL_MS = 5_000;
const ONBOARDING_MODAL_MAX_LIFETIME_MS = 5 * 60_000;
const ONBOARDING_MODAL_PROBE_TIMEOUT_MS = 5_000;
const ONBOARDING_MODAL_MAX_DISMISS_CLICKS = 5;
var wwebjs_groups_2 = require("./wwebjs-groups");
Object.defineProperty(exports, "extractLinkedParentJID", { enumerable: true, get: function () { return wwebjs_groups_2.extractLinkedParentJID; } });
var wwebjs_messaging_2 = require("./wwebjs-messaging");
Object.defineProperty(exports, "isHttpUrl", { enumerable: true, get: function () { return wwebjs_messaging_2.isHttpUrl; } });
Object.defineProperty(exports, "loadRemoteMedia", { enumerable: true, get: function () { return wwebjs_messaging_2.loadRemoteMedia; } });
Object.defineProperty(exports, "extractWwebjsCall", { enumerable: true, get: function () { return wwebjs_messaging_2.extractWwebjsCall; } });
Object.defineProperty(exports, "wwebjsAckToDeliveryStatus", { enumerable: true, get: function () { return wwebjs_messaging_2.wwebjsAckToDeliveryStatus; } });
var wwebjs_proxy_2 = require("./wwebjs-proxy");
Object.defineProperty(exports, "isSupportedProxyUrl", { enumerable: true, get: function () { return wwebjs_proxy_2.isSupportedProxyUrl; } });
Object.defineProperty(exports, "buildProxyLaunchConfig", { enumerable: true, get: function () { return wwebjs_proxy_2.buildProxyLaunchConfig; } });
var wwebjs_onboarding_2 = require("./wwebjs-onboarding");
Object.defineProperty(exports, "probeOnboardingModal", { enumerable: true, get: function () { return wwebjs_onboarding_2.probeOnboardingModal; } });
class WhatsAppWebJsAdapter extends events_1.EventEmitter {
    config;
    client = null;
    status = whatsapp_engine_interface_1.EngineStatus.DISCONNECTED;
    qrCode = null;
    phoneNumber = null;
    pushName = null;
    callbacks = {};
    readyReconcileTimer = null;
    readyReconcileStartedAt = 0;
    readyReconcileProbeInFlight = false;
    lastProbeStateConnected = false;
    readyReconcileReloadAttempted = false;
    onboardingWatcherTimer = null;
    onboardingWatcherStartedAt = 0;
    onboardingWatcherStarted = false;
    onboardingDismissClicks = 0;
    static LIVE_CALL_TTL_MS = 2 * 60_000;
    liveCalls = new Map();
    stuckAuthRecoveryAttempted = false;
    tearingDown = false;
    logoutInitiated = false;
    credentialTeardownStarted = false;
    disconnectReported = false;
    constructor(config) {
        super();
        this.config = config;
        this.host = {
            ensureReady: () => this.ensureReady(),
            getClient: () => this.client,
            logger: this.logger,
            isPageTransportError: error => this.isPageTransportError(error),
            reportIfPageTransportError: (error, context) => this.reportIfPageTransportError(error, context),
            ensureNotChannelRecipient: chatId => this.ensureNotChannelRecipient(chatId),
            getNumberId: number => this.getNumberId(number),
            capInboundMediaFor: (msg, maxBytesOverride) => this.capInboundMediaFor(msg, maxBytesOverride),
            config: this.config,
            getCallbacks: () => this.callbacks,
            getSelfWid: () => this.client?.info?.wid?._serialized,
        };
        this.groups = new wwebjs_groups_1.WwebjsGroups(this.host);
        this.messaging = new wwebjs_messaging_1.WwebjsMessaging(this.host);
        this.contacts = new wwebjs_contacts_1.WwebjsContacts(this.host);
        this.profile = new wwebjs_profile_1.WwebjsProfile(this.host);
        this.labels = new wwebjs_labels_1.WwebjsLabels(this.host);
        this.channels = new wwebjs_channels_1.WwebjsChannels(this.host);
        this.statuses = new wwebjs_status_1.WwebjsStatus(this.host);
        this.chats = new wwebjs_chats_1.WwebjsChats(this.host, this.messaging);
        this.catalog = new wwebjs_catalog_1.WwebjsCatalog(this.host);
    }
    logger = (0, logger_service_1.createLogger)('WhatsAppWebJsAdapter');
    inboundLimiter = new concurrency_limiter_1.ConcurrencyLimiter((0, inbound_media_cap_1.inboundMediaConcurrency)(), (0, inbound_media_cap_1.inboundMediaConcurrency)());
    host;
    groups;
    messaging;
    contacts;
    profile;
    labels;
    channels;
    statuses;
    chats;
    catalog;
    async capInboundMediaFor(msg, maxBytesOverride) {
        if (!(0, inbound_media_cap_1.isMediaDownloadEnabled)()) {
            return (0, wwebjs_messaging_1.declaredOnlyMedia)(msg);
        }
        const maxBytes = maxBytesOverride ?? (0, inbound_media_cap_1.inboundMediaMaxBytes)();
        const data = msg._data;
        const declared = (0, inbound_media_cap_1.coerceDeclaredSize)(data?.size);
        if (declared > maxBytes) {
            this.logger.warn('Inbound media declared size exceeds the cap; skipped download', {
                msgId: msg.id._serialized,
                sizeBytes: declared,
                maxBytes,
            });
            return (0, wwebjs_messaging_1.declaredOnlyMedia)(msg);
        }
        let resolveBounded = () => undefined;
        const boundedReady = new Promise(resolve => {
            resolveBounded = resolve;
        });
        const slotHeld = this.inboundLimiter.run(() => {
            const download = msg.downloadMedia();
            resolveBounded((0, inbound_media_cap_1.withInboundDownloadTimeout)(download, (0, inbound_media_cap_1.inboundMediaTimeoutMs)(), () => this.logger.warn('Inbound media download timed out (MEDIA_DOWNLOAD_TIMEOUT_MS); emitting message without media', {
                msgId: msg.id._serialized,
            })));
            return download.then(() => undefined, () => undefined);
        });
        void slotHeld.catch(() => {
            this.logger.warn('Inbound media limiter saturated; emitting message without media', {
                msgId: msg.id._serialized,
            });
            resolveBounded(null);
        });
        const media = await boundedReady;
        if (!media) {
            return (0, wwebjs_messaging_1.declaredOnlyMedia)(msg);
        }
        const capped = (0, inbound_media_cap_1.capInboundMedia)({
            mimetype: media.mimetype,
            filename: media.filename || undefined,
            sizeBytes: Buffer.byteLength(media.data, 'base64'),
            toBase64: () => media.data,
        });
        if (capped.omitted) {
            this.logger.warn('Inbound media exceeds MEDIA_DOWNLOAD_MAX_BYTES; dropped payload, kept envelope', {
                msgId: msg.id._serialized,
                sizeBytes: capped.sizeBytes,
            });
        }
        return capped;
    }
    async initialize(callbacks) {
        this.callbacks = callbacks;
        this.setStatus(whatsapp_engine_interface_1.EngineStatus.INITIALIZING);
        if ((0, wwebjs_backport_check_1.isBackportMissing)()) {
            this.logger.error(wwebjs_backport_check_1.BACKPORT_MISSING_MESSAGE);
        }
        try {
            const puppeteerArgs = this.config.puppeteer?.args
                ? [...this.config.puppeteer.args]
                : [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                ];
            let proxyAuthentication;
            if (this.config.proxy) {
                if ((0, wwebjs_proxy_1.isSupportedProxyUrl)(this.config.proxy.url)) {
                    const proxyLaunch = (0, wwebjs_proxy_1.buildProxyLaunchConfig)(this.config.proxy.url);
                    puppeteerArgs.push(`--proxy-server=${proxyLaunch.serverArg}`);
                    proxyAuthentication = proxyLaunch.proxyAuthentication;
                    if (proxyLaunch.socksAuthUnsupported) {
                        this.logger.warn(`Proxy for session ${this.config.sessionId} has credentials on a SOCKS proxy, but Chromium ` +
                            `cannot authenticate SOCKS proxies. Use an IP-authorized proxy or an HTTP/HTTPS proxy instead.`);
                    }
                    this.logger.log(`Using proxy: ${proxyLaunch.serverArg}`);
                }
                else {
                    this.logger.warn(`Ignoring invalid proxy URL for session ${this.config.sessionId}`);
                }
            }
            puppeteerArgs.push(`--openwa-session=${this.config.sessionId}`);
            const versionPin = await (0, wa_web_version_1.resolveWebVersionPin)();
            if (this.tearingDown) {
                this.setStatus(whatsapp_engine_interface_1.EngineStatus.DISCONNECTED);
                return;
            }
            if (versionPin) {
                this.logger.log(`Pinning WhatsApp Web version ${versionPin.webVersion}`);
            }
            const authTimeoutMs = (0, engine_init_timeout_1.resolveAuthTimeoutMs)();
            if (authTimeoutMs) {
                this.logger.log(`Using auth timeout ${authTimeoutMs}ms`);
            }
            this.client = new whatsapp_web_js_1.Client({
                authStrategy: new whatsapp_web_js_1.LocalAuth({
                    clientId: this.config.sessionId,
                    dataPath: path.resolve(this.config.sessionDataPath),
                }),
                puppeteer: {
                    headless: this.config.puppeteer?.headless ?? true,
                    args: puppeteerArgs,
                    handleSIGINT: false,
                    handleSIGTERM: false,
                    handleSIGHUP: false,
                    ...(this.config.puppeteer?.executablePath ? { executablePath: this.config.puppeteer.executablePath } : {}),
                },
                ...(authTimeoutMs !== undefined ? { authTimeoutMs } : {}),
                ...(proxyAuthentication ? { proxyAuthentication } : {}),
                ...(versionPin ?? {}),
            });
            this.setupEventHandlers();
            if (this.tearingDown) {
                this.client = null;
                this.setStatus(whatsapp_engine_interface_1.EngineStatus.DISCONNECTED);
                return;
            }
            await (0, chromium_profile_hygiene_1.killOrphanedChromiumProcesses)(this.config.sessionId, this.logger);
            await (0, chromium_profile_hygiene_1.removeStaleSingletonFiles)(this.config.sessionId, this.config.sessionDataPath, this.logger);
            await this.client.initialize();
            this.attachPuppeteerLifecycleListeners();
        }
        catch (error) {
            this.setStatus(whatsapp_engine_interface_1.EngineStatus.FAILED);
            const reason = error instanceof Error ? error.message : String(error);
            let surfacedReason = reason;
            if (isExecutionContextDestroyedError(reason)) {
                this.logger.warn(`"${reason}" during initialize. If this followed an OpenWA upgrade that changed the ` +
                    `Chromium/Chrome binary (v0.8.12 amd64 switched Debian Chromium → Chrome for Testing), the ` +
                    `session's browser profile is likely stale — delete the profile dir ` +
                    `"${path.join(path.resolve(this.config.sessionDataPath), `session-${this.config.sessionId}`)}" ` +
                    `and start again to re-scan. If no upgrade happened, Puppeteer also raises this on a page ` +
                    `navigation or renderer crash (check for memory pressure or a WhatsApp Web reload). ` +
                    `See docs/12-troubleshooting-faq.md.`);
                surfacedReason =
                    `${reason} WhatsApp Web's page context was destroyed during startup. If this followed an ` +
                        `upgrade, the session's browser profile is likely stale — see docs/12-troubleshooting-faq.md.`;
            }
            this.callbacks.onError?.(surfacedReason);
            throw error;
        }
    }
    setupEventHandlers() {
        if (!this.client)
            return;
        this.client.on('qr', async (qr) => {
            if (this.tearingDown || this.disconnectReported || this.status === whatsapp_engine_interface_1.EngineStatus.FAILED || !this.client) {
                return;
            }
            const sourceClient = this.client;
            try {
                const encodedQr = await qrcode.toDataURL(qr);
                if (this.client !== sourceClient ||
                    this.tearingDown ||
                    this.disconnectReported ||
                    this.getStatus() === whatsapp_engine_interface_1.EngineStatus.FAILED) {
                    return;
                }
                this.qrCode = encodedQr;
                this.setStatus(whatsapp_engine_interface_1.EngineStatus.QR_READY);
                this.callbacks.onQRCode?.(this.qrCode);
            }
            catch (error) {
                this.logger.error('Error generating QR code', String(error));
            }
        });
        this.client.on('authenticated', () => {
            if (this.tearingDown ||
                this.disconnectReported ||
                this.status === whatsapp_engine_interface_1.EngineStatus.AUTHENTICATING ||
                this.status === whatsapp_engine_interface_1.EngineStatus.READY ||
                this.status === whatsapp_engine_interface_1.EngineStatus.FAILED) {
                return;
            }
            this.setStatus(whatsapp_engine_interface_1.EngineStatus.AUTHENTICATING);
            this.qrCode = null;
            this.scheduleReadyReconcile();
        });
        this.client.on('ready', () => {
            if (this.client.eventsAttached === false) {
                this.logger.warn('Ignoring premature ready: the message event bridge is not attached yet', {
                    sessionId: this.config.sessionId,
                    action: 'premature_ready_ignored',
                });
                return;
            }
            this.markReadyFromClientInfo();
        });
        (0, wwebjs_message_events_1.registerWwebjsMessageEvents)(this.client, this.host);
        this.client.on('group_join', notification => this.handleGroupNotification('join', notification));
        this.client.on('group_leave', notification => this.handleGroupNotification('leave', notification));
        this.client.on('group_update', notification => this.handleGroupNotification('update', notification));
        this.client.on('call', call => this.handleIncomingCall(call));
        this.client.on('disconnected', reason => {
            if (reason === 'LOGOUT' && !this.logoutInitiated && !this.credentialTeardownStarted) {
                this.credentialTeardownStarted = true;
                this.callbacks.onCredentialTeardownStarted?.(this.clearLocalAuth());
            }
            if (this.tearingDown || this.disconnectReported)
                return;
            this.clearReadyReconcile();
            if (reason === 'LOGOUT') {
                this.logger.warn('WhatsApp unlinked this device (LOGOUT). whatsapp-web.js is deleting the stored credentials ' +
                    'for this session, so reconnecting cannot restore the link — the session comes back with a ' +
                    'fresh QR and must be re-scanned. If this was not expected, check Linked devices on the phone.');
            }
            this.setStatus(whatsapp_engine_interface_1.EngineStatus.DISCONNECTED);
            const restriction = WA_STATE_RESTRICTIONS[reason];
            if (restriction) {
                this.callbacks.onAccountRestriction?.({ kind: restriction, code: reason });
            }
            this.callbacks.onDisconnected?.(reason);
        });
        this.client.on('auth_failure', (message) => {
            this.clearReadyReconcile();
            this.setStatus(whatsapp_engine_interface_1.EngineStatus.FAILED);
            this.callbacks.onError?.(message ? `Authentication failed: ${message}` : 'Authentication failed');
        });
    }
    createChannel(name, description) {
        return this.channels.createChannel(name, description);
    }
    deleteChannel(channelId) {
        return this.channels.deleteChannel(channelId);
    }
    muteChannel(channelId, mute) {
        return this.channels.muteChannel(channelId, mute);
    }
    getChatsByLabel(labelId) {
        return this.labels.getChatsByLabel(labelId);
    }
    async upsertLabel(_label) {
        throw new engine_not_supported_error_1.EngineNotSupportedError('upsertLabel');
    }
    async deleteLabel(_labelId) {
        throw new engine_not_supported_error_1.EngineNotSupportedError('deleteLabel');
    }
    async subscribeToPresence(_chatId) {
        throw new engine_not_supported_error_1.EngineNotSupportedError('subscribeToPresence');
    }
    handleGroupNotification(kind, notification) {
        try {
            if (!notification.chatId) {
                return;
            }
            const payload = {
                kind,
                groupId: notification.chatId,
                actorId: notification.author || undefined,
                participantIds: (0, wwebjs_group_events_1.wwebjsGroupRecipientIds)(notification),
                timestamp: typeof notification.timestamp === 'number' && notification.timestamp > 0
                    ? Math.floor(notification.timestamp)
                    : Math.floor(Date.now() / 1000),
            };
            if (kind === 'update') {
                payload.changes = (0, wwebjs_group_events_1.wwebjsGroupUpdateChanges)(notification);
            }
            this.callbacks.onGroupEvent?.(payload);
        }
        catch (error) {
            this.logger.error(`Error processing group_${kind} notification`, String(error));
        }
    }
    handleIncomingCall(call) {
        try {
            if (this.tearingDown || !call?.id || !call.from) {
                return;
            }
            if (call.fromMe) {
                return;
            }
            if (!this.cacheLiveCall(call.id, call)) {
                return;
            }
            const payload = {
                callId: call.id,
                from: call.from ?? '',
                isVideo: call.isVideo === true,
                isGroup: call.isGroup === true,
                timestamp: typeof call.timestamp === 'number' && call.timestamp > 0
                    ? Math.floor(call.timestamp)
                    : Math.floor(Date.now() / 1000),
            };
            this.callbacks.onCall?.(payload);
        }
        catch (error) {
            this.logger.error('Error processing call event', String(error));
        }
    }
    cacheLiveCall(callId, call) {
        const now = Date.now();
        for (const [id, entry] of this.liveCalls) {
            if (entry.expiresAt <= now) {
                this.liveCalls.delete(id);
            }
        }
        const isNewCall = !this.liveCalls.has(callId);
        this.liveCalls.set(callId, { call, expiresAt: now + WhatsAppWebJsAdapter.LIVE_CALL_TTL_MS });
        return isNewCall;
    }
    async rejectCall(callId) {
        const entry = this.liveCalls.get(callId);
        this.liveCalls.delete(callId);
        if (!entry || entry.expiresAt <= Date.now()) {
            throw new call_not_found_error_1.CallNotFoundError(callId);
        }
        await entry.call.reject();
    }
    attachPuppeteerLifecycleListeners() {
        if (!this.client)
            return;
        const { pupBrowser, pupPage } = this.client;
        pupBrowser?.on('disconnected', () => this.handlePuppeteerDeath('Browser process closed or crashed'));
        pupPage?.on('error', () => this.handlePuppeteerDeath('Page crashed'));
        pupPage?.on('close', () => this.handlePuppeteerDeath('Page closed'));
    }
    handlePuppeteerDeath(reason) {
        if (this.tearingDown || this.status === whatsapp_engine_interface_1.EngineStatus.DISCONNECTED || this.status === whatsapp_engine_interface_1.EngineStatus.FAILED) {
            return;
        }
        this.clearReadyReconcile();
        this.setStatus(whatsapp_engine_interface_1.EngineStatus.DISCONNECTED);
        this.callbacks.onDisconnected?.(reason);
    }
    static PAGE_TRANSPORT_ERROR_PATTERN = /protocol error|target closed|targetclosederror|detached frame|session closed|connection closed/i;
    isPageTransportError(error) {
        const message = error instanceof Error ? error.message : String(error);
        return WhatsAppWebJsAdapter.PAGE_TRANSPORT_ERROR_PATTERN.test(message);
    }
    reportIfPageTransportError(error, context) {
        if (!this.isPageTransportError(error)) {
            return;
        }
        this.logger.warn(`Page transport error during ${context} — treating the session as dead`, {
            error: error instanceof Error ? error.message : String(error),
        });
        this.handlePuppeteerDeath(`Page transport error during ${context}`);
    }
    markReadyFromClientInfo() {
        if ([whatsapp_engine_interface_1.EngineStatus.READY, whatsapp_engine_interface_1.EngineStatus.DISCONNECTED, whatsapp_engine_interface_1.EngineStatus.FAILED, whatsapp_engine_interface_1.EngineStatus.ACTION_REQUIRED].includes(this.status))
            return;
        this.clearReadyReconcile();
        try {
            const info = this.client?.info;
            this.phoneNumber = info?.wid?.user || null;
            this.pushName = info?.pushname || null;
            this.setStatus(whatsapp_engine_interface_1.EngineStatus.READY);
            this.callbacks.onReady?.(this.phoneNumber || '', this.pushName || '');
        }
        catch (error) {
            this.logger.error('Error getting client info', String(error));
            this.setStatus(whatsapp_engine_interface_1.EngineStatus.READY);
            this.callbacks.onReady?.('', '');
        }
        this.startOnboardingWatcher();
    }
    scheduleReadyReconcile() {
        this.clearReadyReconcile();
        this.readyReconcileStartedAt = Date.now();
        const tick = () => {
            if (!this.client || this.status !== whatsapp_engine_interface_1.EngineStatus.AUTHENTICATING) {
                this.clearReadyReconcile();
                return;
            }
            if (Date.now() - this.readyReconcileStartedAt >= exports.READY_RECONCILE_TIMEOUT_MS) {
                const bridgeDead = this.lastProbeStateConnected &&
                    this.client?.eventsAttached === false;
                if (bridgeDead) {
                    this.logger.error('WhatsApp Web stayed connected but its event bridge never attached within the readiness ' +
                        'deadline — inbound messages would be silently lost, so the session is marked failed. ' +
                        'The saved credentials were kept; restart the session to relaunch the browser.', undefined, { sessionId: this.config.sessionId, action: 'ready_reconcile_bridge_dead' });
                    this.clearReadyReconcile();
                    this.setStatus(whatsapp_engine_interface_1.EngineStatus.FAILED);
                    this.callbacks.onError?.('WhatsApp Web is connected but its event bridge never attached, so inbound messages would be ' +
                        'lost. The saved session was kept — restart the session to relaunch the browser.');
                    return;
                }
                this.logger.warn('Timed out waiting for WhatsApp Web runtime readiness after authentication — the saved session ' +
                    'is stuck after the QR scan (usually the auto-selected WhatsApp Web build is incompatible). ' +
                    'Clearing it to re-pair; pin a known-good version via WWEBJS_WEB_VERSION (see ' +
                    'docs/12-troubleshooting-faq.md) if it keeps recurring.', { sessionId: this.config.sessionId, action: 'ready_reconcile_timeout' });
                this.clearReadyReconcile();
                void this.recoverFromStuckAuth();
                return;
            }
            this.readyReconcileTimer = setTimeout(tick, READY_RECONCILE_INTERVAL_MS);
            this.readyReconcileTimer.unref?.();
            if (this.readyReconcileProbeInFlight)
                return;
            this.readyReconcileProbeInFlight = true;
            void this.isClientRuntimeReady()
                .then(ready => {
                if (ready && this.client && this.status === whatsapp_engine_interface_1.EngineStatus.AUTHENTICATING) {
                    this.logger.warn('WhatsApp Web ready event was missed; reconciling from connected runtime state');
                    this.markReadyFromClientInfo();
                }
                else if (this.status === whatsapp_engine_interface_1.EngineStatus.AUTHENTICATING) {
                    this.maybeReloadDeadBridge();
                }
            })
                .catch(error => this.logger.debug('Ready reconciliation probe failed', { error: String(error) }))
                .finally(() => {
                this.readyReconcileProbeInFlight = false;
            });
        };
        this.readyReconcileTimer = setTimeout(tick, READY_RECONCILE_INTERVAL_MS);
        this.readyReconcileTimer.unref?.();
    }
    clearReadyReconcile() {
        if (this.readyReconcileTimer) {
            clearTimeout(this.readyReconcileTimer);
            this.readyReconcileTimer = null;
        }
        this.readyReconcileStartedAt = 0;
        this.readyReconcileProbeInFlight = false;
        this.lastProbeStateConnected = false;
        this.readyReconcileReloadAttempted = false;
    }
    startOnboardingWatcher() {
        if (this.onboardingWatcherStarted)
            return;
        this.onboardingWatcherStarted = true;
        this.onboardingWatcherStartedAt = Date.now();
        const tick = () => {
            if (!this.client || this.status !== whatsapp_engine_interface_1.EngineStatus.READY || this.tearingDown || this.disconnectReported) {
                this.clearOnboardingWatcher();
                return;
            }
            if (Date.now() - this.onboardingWatcherStartedAt >= ONBOARDING_MODAL_MAX_LIFETIME_MS) {
                this.clearOnboardingWatcher();
                return;
            }
            this.onboardingWatcherTimer = setTimeout(tick, ONBOARDING_MODAL_INTERVAL_MS);
            this.onboardingWatcherTimer.unref?.();
            void this.dismissOnboardingModalIfNeeded();
        };
        this.onboardingWatcherTimer = setTimeout(tick, ONBOARDING_MODAL_INTERVAL_MS);
        this.onboardingWatcherTimer.unref?.();
    }
    clearOnboardingWatcher() {
        if (this.onboardingWatcherTimer) {
            clearTimeout(this.onboardingWatcherTimer);
            this.onboardingWatcherTimer = null;
        }
        this.onboardingWatcherStartedAt = 0;
    }
    async dismissOnboardingModalIfNeeded() {
        if (!this.client)
            return;
        const page = this.client.pupPage;
        const labels = (0, wwebjs_onboarding_1.resolveOnboardingContinueLabels)();
        const headingOptionalFor = labels.filter(label => label !== wwebjs_onboarding_1.ONBOARDING_DEFAULT_CONTINUE_LABEL);
        let timeout;
        try {
            const result = await Promise.race([
                page?.evaluate(wwebjs_onboarding_1.probeOnboardingModal, { labels, headingOptionalFor }),
                new Promise((_, reject) => {
                    timeout = setTimeout(() => reject(new Error('onboarding modal probe timed out')), ONBOARDING_MODAL_PROBE_TIMEOUT_MS);
                    timeout.unref?.();
                }),
            ]);
            if (!result?.dismissed)
                return;
            this.onboardingDismissClicks += 1;
            this.logger.log('Dismissed the WhatsApp Web onboarding modal', {
                sessionId: this.config.sessionId,
                attempt: this.onboardingDismissClicks,
                action: 'onboarding_modal_dismissed',
            });
            if (this.onboardingDismissClicks >= ONBOARDING_MODAL_MAX_DISMISS_CLICKS) {
                this.reportActionRequired(`WhatsApp is still showing its onboarding modal after ${this.onboardingDismissClicks} ` +
                    "attempts to dismiss it. Open WhatsApp Web on the account holder's own browser and click " +
                    'through the "What\'s new" screen, or the companion device will be unlinked. Then restart ' +
                    'the session (stop, then start) — acknowledging the modal does not return it to ready on its own.');
            }
        }
        catch {
            this.logger.debug('Onboarding modal probe could not reach the page; ignoring', {
                sessionId: this.config.sessionId,
                action: 'onboarding_modal_probe_skipped',
            });
        }
        finally {
            if (timeout)
                clearTimeout(timeout);
        }
    }
    reportActionRequired(reason) {
        this.clearOnboardingWatcher();
        if (this.status !== whatsapp_engine_interface_1.EngineStatus.READY)
            return;
        this.setStatus(whatsapp_engine_interface_1.EngineStatus.ACTION_REQUIRED);
        this.callbacks.onActionRequired?.(reason);
        this.logger.warn(reason, { sessionId: this.config.sessionId, action: 'onboarding_modal_fallback' });
    }
    async recoverFromStuckAuth() {
        const claim = this.callbacks.claimStuckAuthRecovery;
        let granted;
        if (claim) {
            try {
                granted = claim();
            }
            catch {
                granted = false;
            }
        }
        else {
            granted = !this.stuckAuthRecoveryAttempted;
            this.stuckAuthRecoveryAttempted = true;
        }
        if (!granted) {
            this.setStatus(whatsapp_engine_interface_1.EngineStatus.FAILED);
            this.callbacks.onError?.('WhatsApp Web could not reach readiness after re-pairing. Pin WWEBJS_WEB_VERSION to a known-good build and try again.');
            return;
        }
        const client = this.client;
        this.client = null;
        await this.clearLocalAuth();
        this.setStatus(whatsapp_engine_interface_1.EngineStatus.DISCONNECTED);
        this.callbacks.onDisconnected?.('Saved session could not be restored; cleared for re-pairing');
        if (typeof client?.destroy === 'function')
            void client.destroy().catch(() => undefined);
    }
    async clearLocalAuth() {
        const dir = path.join(path.resolve(this.config.sessionDataPath), `session-${this.config.sessionId}`);
        await fs.promises
            .rm(dir, { recursive: true, force: true, maxRetries: 4 })
            .then(() => {
            this.logger.warn(`Deleted this session's stored WhatsApp credentials at ${dir}. That was the only copy, so the ` +
                'next start cannot restore the link and comes back with a fresh QR to scan.', { sessionId: this.config.sessionId, dir, action: 'auth_cleared' });
        })
            .catch((error) => {
            this.logger.warn(`Could not clear stale auth at ${dir}`, {
                sessionId: this.config.sessionId,
                dir,
                error: String(error),
            });
        });
    }
    async isClientRuntimeReady() {
        if (!this.client)
            return false;
        const connected = (await this.client.getState()) === whatsapp_web_js_1.WAState.CONNECTED;
        this.lastProbeStateConnected = connected;
        if (!connected)
            return false;
        if (!this.client.info?.wid?.user)
            return false;
        if (this.client.eventsAttached === false)
            return false;
        const page = this.client.pupPage;
        const hasWWebJS = await page?.evaluate(() => typeof window.WWebJS !== 'undefined');
        return hasWWebJS === true;
    }
    maybeReloadDeadBridge() {
        if (this.readyReconcileReloadAttempted)
            return;
        if (!this.client || !this.lastProbeStateConnected)
            return;
        const client = this.client;
        if (client.eventsAttached !== false)
            return;
        if (Date.now() - this.readyReconcileStartedAt < exports.READY_RECONCILE_BRIDGE_RELOAD_GRACE_MS)
            return;
        this.readyReconcileReloadAttempted = true;
        this.logger.warn('WhatsApp Web is connected but its event bridge never attached; reloading the page to reinject', {
            sessionId: this.config.sessionId,
            action: 'event_bridge_reload',
        });
        const page = client.pupPage;
        void page?.reload?.()?.catch((error) => this.logger.warn('Event-bridge reload failed', {
            sessionId: this.config.sessionId,
            error: String(error),
        }));
    }
    setStatus(status) {
        if (status === whatsapp_engine_interface_1.EngineStatus.DISCONNECTED) {
            this.disconnectReported = true;
        }
        this.status = status;
        this.callbacks.onStateChanged?.(status);
        this.emit('stateChanged', status);
    }
    beginClientTeardown() {
        this.tearingDown = true;
        this.liveCalls.clear();
        const client = this.client;
        if (!client)
            return null;
        this.clearReadyReconcile();
        this.clearOnboardingWatcher();
        if (this.status !== whatsapp_engine_interface_1.EngineStatus.DISCONNECTED) {
            this.setStatus(whatsapp_engine_interface_1.EngineStatus.DISCONNECTED);
        }
        return client;
    }
    finishClientTeardown(client) {
        if (this.client === client) {
            this.client = null;
        }
        this.clearReadyReconcile();
        this.clearOnboardingWatcher();
    }
    async disconnect() {
        const client = this.beginClientTeardown();
        if (!client)
            return;
        try {
            await client.destroy();
        }
        catch (error) {
            this.logger.warn('Destroy client failed:', { error: String(error) });
        }
        finally {
            this.finishClientTeardown(client);
        }
    }
    async logout() {
        this.logoutInitiated = true;
        const client = this.beginClientTeardown();
        if (!client) {
            throw new Error('No live WhatsApp Web client — the unlink was not sent');
        }
        try {
            await client.logout();
        }
        catch (error) {
            this.logger.warn('Logout failed:', { error: String(error) });
            try {
                await client.destroy();
            }
            catch (destroyError) {
                this.logger.warn('Client destroy also failed during logout fallback', { error: String(destroyError) });
            }
            throw error;
        }
        finally {
            this.finishClientTeardown(client);
        }
    }
    async destroy() {
        const client = this.beginClientTeardown();
        if (!client)
            return;
        try {
            await client.destroy();
        }
        finally {
            this.finishClientTeardown(client);
        }
    }
    async forceDestroy() {
        const client = this.beginClientTeardown();
        if (!client)
            return;
        try {
            const proc = client.pupBrowser?.process?.();
            proc?.kill?.('SIGKILL');
        }
        catch (err) {
            this.logger.warn('forceDestroy: failed to kill the browser process', { error: String(err) });
        }
        try {
            await client.destroy();
        }
        catch (err) {
            this.logger.warn('forceDestroy: client.destroy() failed after the kill (continuing)', { error: String(err) });
        }
        finally {
            this.finishClientTeardown(client);
        }
    }
    getStatus() {
        return this.status;
    }
    async probeLiveness() {
        if (this.status !== whatsapp_engine_interface_1.EngineStatus.READY || !this.client)
            return false;
        let timeout;
        try {
            const state = await Promise.race([
                this.client.getState(),
                new Promise((_, reject) => {
                    timeout = setTimeout(() => reject(new Error('liveness probe timed out')), 10_000);
                    timeout.unref?.();
                }),
            ]);
            return state === whatsapp_web_js_1.WAState.CONNECTED;
        }
        catch {
            return false;
        }
        finally {
            if (timeout)
                clearTimeout(timeout);
        }
    }
    getQRCode() {
        return this.qrCode;
    }
    async requestPairingCode(phoneNumber) {
        if (!this.client) {
            throw new engine_not_ready_error_1.EngineNotReadyError();
        }
        return this.client.requestPairingCode(phoneNumber);
    }
    getPhoneNumber() {
        return this.phoneNumber;
    }
    getPushName() {
        return this.pushName;
    }
    sendTextMessage(chatId, text, mentions, options) {
        return this.messaging.sendTextMessage(chatId, text, mentions, options);
    }
    sendImageMessage(chatId, media) {
        return this.messaging.sendImageMessage(chatId, media);
    }
    sendVideoMessage(chatId, media) {
        return this.messaging.sendVideoMessage(chatId, media);
    }
    sendAudioMessage(chatId, media) {
        return this.messaging.sendAudioMessage(chatId, media);
    }
    sendDocumentMessage(chatId, media) {
        return this.messaging.sendDocumentMessage(chatId, media);
    }
    getContacts() {
        return this.contacts.getContacts();
    }
    getContactById(contactId) {
        return this.contacts.getContactById(contactId);
    }
    getNumberId(number) {
        return this.contacts.getNumberId(number);
    }
    checkNumberExists(number) {
        return this.contacts.checkNumberExists(number);
    }
    resolveContactPhone(contactId) {
        return this.contacts.resolveContactPhone(contactId);
    }
    getGroups() {
        return this.groups.getGroups();
    }
    sendLocationMessage(chatId, location) {
        return this.messaging.sendLocationMessage(chatId, location);
    }
    sendContactMessage(chatId, contact) {
        return this.messaging.sendContactMessage(chatId, contact);
    }
    sendStickerMessage(chatId, media) {
        return this.messaging.sendStickerMessage(chatId, media);
    }
    sendPollMessage(chatId, poll) {
        return this.messaging.sendPollMessage(chatId, poll);
    }
    replyToMessage(chatId, quotedMsgId, text) {
        return this.messaging.replyToMessage(chatId, quotedMsgId, text);
    }
    forwardMessage(fromChatId, toChatId, messageId) {
        return this.messaging.forwardMessage(fromChatId, toChatId, messageId);
    }
    getGroupInfo(groupId) {
        return this.groups.getGroupInfo(groupId);
    }
    createGroup(name, participants) {
        return this.groups.createGroup(name, participants);
    }
    addParticipants(groupId, participants) {
        return this.groups.addParticipants(groupId, participants);
    }
    removeParticipants(groupId, participants) {
        return this.groups.removeParticipants(groupId, participants);
    }
    promoteParticipants(groupId, participants) {
        return this.groups.promoteParticipants(groupId, participants);
    }
    demoteParticipants(groupId, participants) {
        return this.groups.demoteParticipants(groupId, participants);
    }
    leaveGroup(groupId) {
        return this.groups.leaveGroup(groupId);
    }
    setGroupSubject(groupId, subject) {
        return this.groups.setGroupSubject(groupId, subject);
    }
    setGroupDescription(groupId, description) {
        return this.groups.setGroupDescription(groupId, description);
    }
    reactToMessage(chatId, messageId, emoji) {
        return this.messaging.reactToMessage(chatId, messageId, emoji);
    }
    getMessageReactions(chatId, messageId) {
        return this.messaging.getMessageReactions(chatId, messageId);
    }
    getLabels() {
        return this.labels.getLabels();
    }
    getLabelById(labelId) {
        return this.labels.getLabelById(labelId);
    }
    getChatLabels(chatId) {
        return this.labels.getChatLabels(chatId);
    }
    addLabelToChat(chatId, labelId) {
        return this.labels.addLabelToChat(chatId, labelId);
    }
    removeLabelFromChat(chatId, labelId) {
        return this.labels.removeLabelFromChat(chatId, labelId);
    }
    getSubscribedChannels() {
        return this.channels.getSubscribedChannels();
    }
    getChannelById(channelId) {
        return this.channels.getChannelById(channelId);
    }
    subscribeToChannel(_inviteCode) {
        return this.channels.subscribeToChannel(_inviteCode);
    }
    unsubscribeFromChannel(channelId) {
        return this.channels.unsubscribeFromChannel(channelId);
    }
    getChannelMessages(channelId, limit = 50) {
        return this.channels.getChannelMessages(channelId, limit);
    }
    getChatHistory(chatId, limit = 50, includeMedia = false, mediaMaxBytes, signal) {
        return this.messaging.getChatHistory(chatId, limit, includeMedia, mediaMaxBytes, signal);
    }
    starMessage(chatId, messageId, star) {
        return this.messaging.starMessage(chatId, messageId, star);
    }
    pinMessage(chatId, messageId, durationSeconds) {
        return this.messaging.pinMessage(chatId, messageId, durationSeconds);
    }
    votePoll(chatId, pollMessageId, options) {
        return this.messaging.votePoll(chatId, pollMessageId, options);
    }
    unpinMessage(chatId, messageId) {
        return this.messaging.unpinMessage(chatId, messageId);
    }
    deleteMessage(chatId, messageId, forEveryone = true) {
        return this.messaging.deleteMessage(chatId, messageId, forEveryone);
    }
    editMessage(chatId, messageId, body) {
        return this.messaging.editMessage(chatId, messageId, body);
    }
    getProfilePicture(contactId) {
        return this.contacts.getProfilePicture(contactId);
    }
    blockContact(contactId) {
        return this.contacts.blockContact(contactId);
    }
    upsertContact(contactId, firstName, lastName) {
        return this.contacts.upsertContact(contactId, firstName, lastName);
    }
    deleteContact(contactId) {
        return this.contacts.deleteContact(contactId);
    }
    unblockContact(contactId) {
        return this.contacts.unblockContact(contactId);
    }
    setProfileName(name) {
        return this.profile.setProfileName(name);
    }
    setProfileStatus(status) {
        return this.profile.setProfileStatus(status);
    }
    setProfilePicture(media) {
        return this.profile.setProfilePicture(media);
    }
    getGroupInviteCode(groupId) {
        return this.groups.getGroupInviteCode(groupId);
    }
    revokeGroupInviteCode(groupId) {
        return this.groups.revokeGroupInviteCode(groupId);
    }
    getGroupJoinInfo(inviteCode) {
        return this.groups.getGroupJoinInfo(inviteCode);
    }
    joinGroupViaInviteCode(inviteCode) {
        return this.groups.joinGroupViaInviteCode(inviteCode);
    }
    setGroupMessagesAdminsOnly(groupId, adminsOnly) {
        return this.groups.setGroupMessagesAdminsOnly(groupId, adminsOnly);
    }
    setGroupInfoAdminsOnly(groupId, adminsOnly) {
        return this.groups.setGroupInfoAdminsOnly(groupId, adminsOnly);
    }
    setGroupMemberAddMode(groupId, mode) {
        return this.groups.setGroupMemberAddMode(groupId, mode);
    }
    setGroupPicture(groupId, media) {
        return this.groups.setGroupPicture(groupId, media);
    }
    deleteGroupPicture(groupId) {
        return this.groups.deleteGroupPicture(groupId);
    }
    setGroupEphemeral(groupId, durationSec) {
        return this.groups.setGroupEphemeral(groupId, durationSec);
    }
    getContactStatuses() {
        return this.statuses.getContactStatuses();
    }
    getContactStatus(contactId) {
        return this.statuses.getContactStatus(contactId);
    }
    postTextStatus(text, options) {
        return this.statuses.postTextStatus(text, options);
    }
    postImageStatus(media, options) {
        return this.statuses.postImageStatus(media, options);
    }
    postVideoStatus(media, options) {
        return this.statuses.postVideoStatus(media, options);
    }
    postVoiceStatus(media, options) {
        return this.statuses.postVoiceStatus(media, options);
    }
    deleteStatus(statusId) {
        return this.statuses.deleteStatus(statusId);
    }
    getCatalog() {
        return this.catalog.getCatalog();
    }
    getProducts(_options) {
        return this.catalog.getProducts(_options);
    }
    getProduct(_productId) {
        return this.catalog.getProduct(_productId);
    }
    sendProduct(_chatId, _productId, _body) {
        return this.catalog.sendProduct(_chatId, _productId, _body);
    }
    sendCatalog(_chatId, _body) {
        return this.catalog.sendCatalog(_chatId, _body);
    }
    getChats() {
        return this.chats.getChats();
    }
    sendSeen(chatId) {
        return this.chats.sendSeen(chatId);
    }
    archiveChat(chatId, archive) {
        return this.chats.archiveChat(chatId, archive);
    }
    clearChatMessages(chatId) {
        return this.chats.clearChatMessages(chatId);
    }
    markUnread(chatId) {
        return this.chats.markUnread(chatId);
    }
    deleteChat(chatId) {
        return this.chats.deleteChat(chatId);
    }
    sendChatState(chatId, state) {
        return this.chats.sendChatState(chatId, state);
    }
    ensureReady() {
        if (this.status !== whatsapp_engine_interface_1.EngineStatus.READY || !this.client) {
            throw new engine_not_ready_error_1.EngineNotReadyError();
        }
    }
    ensureNotChannelRecipient(chatId) {
        if ((0, wa_id_1.isChannelJid)(chatId)) {
            throw new channel_media_not_supported_error_1.ChannelMediaNotSupportedError();
        }
    }
}
exports.WhatsAppWebJsAdapter = WhatsAppWebJsAdapter;
//# sourceMappingURL=whatsapp-web-js.adapter.js.map