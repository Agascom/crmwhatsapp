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
exports.BaileysLifecycle = void 0;
exports.createProxyAgent = createProxyAgent;
const fs = __importStar(require("fs"));
const qrcode = __importStar(require("qrcode"));
const https_proxy_agent_1 = require("https-proxy-agent");
const socks_proxy_agent_1 = require("socks-proxy-agent");
const whatsapp_engine_interface_1 = require("../interfaces/whatsapp-engine.interface");
const engine_not_ready_error_1 = require("../../common/errors/engine-not-ready.error");
const baileys_logger_1 = require("./baileys-logger");
const BAILEYS_BROWSER = [
    process.env.BAILEYS_BROWSER_NAME?.trim() || 'OpenWA',
    'Chrome',
    '120.0.0',
];
const BAILEYS_LOGOUT_ACK_TIMEOUT_MS = 8_000;
function createProxyAgent(proxyUrl) {
    const { protocol } = new URL(proxyUrl);
    if (protocol === 'http:' || protocol === 'https:') {
        return new https_proxy_agent_1.HttpsProxyAgent(proxyUrl);
    }
    if (protocol === 'socks4:' || protocol === 'socks5:') {
        return new socks_proxy_agent_1.SocksProxyAgent(proxyUrl);
    }
    throw new Error(`Unsupported proxy protocol for the baileys engine: ${protocol}`);
}
class BaileysLifecycle {
    host;
    static RECONNECT_STABILITY_RESET_MS = 5 * 60_000;
    sock = null;
    connectedAt = 0;
    status = whatsapp_engine_interface_1.EngineStatus.DISCONNECTED;
    qrCode = null;
    phoneNumber = null;
    pushName = null;
    intentionalClose = false;
    connecting = false;
    reconnectAttempts = 0;
    reconnectTimer;
    lastConnectionCloseAt = 0;
    lib;
    constructor(host) {
        this.host = host;
    }
    async loadLib() {
        return (this.lib ??= await import('@whiskeysockets/baileys'));
    }
    async initialize() {
        if (this.intentionalClose) {
            return;
        }
        try {
            await this.connect();
        }
        catch (err) {
            this.setStatus(whatsapp_engine_interface_1.EngineStatus.FAILED);
            this.host.getOnError()?.(err instanceof Error ? err.message : String(err));
            throw err;
        }
    }
    async connect() {
        if (this.connecting) {
            return;
        }
        this.connecting = true;
        try {
            await this.connectInner();
        }
        finally {
            this.connecting = false;
        }
    }
    async connectInner() {
        this.setStatus(whatsapp_engine_interface_1.EngineStatus.INITIALIZING);
        let proxyAgent;
        if (this.host.config.proxyUrl) {
            proxyAgent = createProxyAgent(this.host.config.proxyUrl);
            const { protocol, host } = new URL(this.host.config.proxyUrl);
            this.host.logger.log(`Using proxy: ${protocol}//${host}`, { sessionId: this.host.config.sessionId });
        }
        const b = await this.loadLib();
        const { state, saveCreds } = await b.useMultiFileAuthState(this.host.authPath);
        const { version } = await b.fetchLatestBaileysVersion();
        const baileysLogger = (0, baileys_logger_1.createBaileysLogger)();
        state.keys = b.makeCacheableSignalKeyStore(state.keys, baileysLogger);
        if (this.intentionalClose) {
            return;
        }
        const previous = this.sock;
        if (previous) {
            try {
                previous.ev.removeAllListeners('connection.update');
                previous.ev.removeAllListeners('creds.update');
                previous.ev.removeAllListeners('messages.upsert');
                previous.ev.removeAllListeners('messages.update');
                previous.ev.removeAllListeners('contacts.upsert');
                previous.ev.removeAllListeners('contacts.update');
                previous.ev.removeAllListeners('chats.upsert');
                previous.ev.removeAllListeners('chats.update');
                previous.ev.removeAllListeners('messaging-history.set');
                previous.ev.removeAllListeners('lid-mapping.update');
                previous.ev.removeAllListeners('group-participants.update');
                previous.ev.removeAllListeners('groups.update');
                previous.ev.removeAllListeners('call');
                previous.ev.removeAllListeners('presence.update');
                void previous.end(undefined);
            }
            catch {
            }
        }
        const sock = b.default({
            auth: state,
            version,
            browser: BAILEYS_BROWSER,
            printQRInTerminal: false,
            agent: proxyAgent,
            fetchAgent: proxyAgent,
            shouldSyncHistoryMessage: () => true,
            syncFullHistory: process.env.BAILEYS_SYNC_FULL_HISTORY === 'true',
            markOnlineOnConnect: process.env.BAILEYS_MARK_ONLINE_ON_CONNECT !== 'false',
            getMessage: async (key) => {
                if (!key.id) {
                    return undefined;
                }
                const stored = await this.host.config.messageStore?.getMessage(this.host.config.dbSessionId, key.id);
                return stored?.message ?? undefined;
            },
            logger: baileysLogger,
        });
        this.sock = sock;
        sock.ev.on('creds.update', () => void saveCreds());
        sock.ev.on('connection.update', update => this.handleConnectionUpdate(update));
        sock.ev.on('messages.upsert', event => this.host.handleMessagesUpsert(event));
        sock.ev.on('messages.update', updates => this.host.handleMessagesUpdate(updates));
        sock.ev.on('contacts.upsert', contacts => {
            this.host.logContactEvent('contacts.upsert', contacts);
            this.host.upsertContacts(contacts);
        });
        sock.ev.on('contacts.update', updates => {
            this.host.logContactEvent('contacts.update', updates);
            this.host.upsertContacts(updates);
        });
        sock.ev.on('chats.upsert', chats => {
            this.host.logger.debug('Baileys chats event', {
                action: 'baileys_chats',
                event: 'upsert',
                count: chats?.length ?? 0,
            });
            this.host.upsertChats(chats);
        });
        sock.ev.on('chats.update', updates => {
            this.host.logger.debug('Baileys chats event', {
                action: 'baileys_chats',
                event: 'update',
                count: updates?.length ?? 0,
            });
            this.host.upsertChats(updates);
        });
        sock.ev.on('group-participants.update', event => this.host.handleGroupParticipantsUpdate(event));
        sock.ev.on('groups.update', updates => this.host.handleGroupsUpdate(updates));
        sock.ev.on('messaging-history.set', history => {
            this.host.upsertContacts(history.contacts);
            this.host.upsertChats(history.chats);
            this.host.addLidMappings(history.lidPnMappings ?? []);
            void this.host.captureHistoryMessages(history.messages ?? []);
            this.host.logger.debug('History sync received', {
                action: 'baileys_history_set',
                sessionId: this.host.config.sessionId,
                syncType: history.syncType,
                isLatest: history.isLatest,
                progress: history.progress,
                chats: history.chats?.length ?? 0,
                messages: history.messages?.length ?? 0,
                contacts: history.contacts?.length ?? 0,
                namedContacts: history.contacts?.filter(c => c.name || c.notify).length ?? 0,
                lidContacts: history.contacts?.filter(c => c.lid).length ?? 0,
                lidPnMappings: history.lidPnMappings?.length ?? 0,
            });
        });
        sock.ev.on('lid-mapping.update', ({ lid, pn }) => this.host.addLidMappings([{ lid, pn }]));
        sock.ev.on('call', calls => this.host.handleCallEvents(calls));
        sock.ev.on('presence.update', update => this.host.handlePresenceUpdate(update));
    }
    handleConnectionUpdate(update) {
        const { connection, qr, lastDisconnect, reachoutTimeLock } = update;
        if (reachoutTimeLock) {
            this.reportReachoutTimelock(reachoutTimeLock);
        }
        if (qr) {
            void this.handleQrCode(qr);
        }
        if (connection === 'connecting') {
            this.setStatus(whatsapp_engine_interface_1.EngineStatus.INITIALIZING);
        }
        if (connection === 'open') {
            this.qrCode = null;
            this.phoneNumber = this.host.extractPhone(this.sock?.user?.id);
            this.pushName = this.sock?.user?.name ?? null;
            this.reconnectAttempts = 0;
            this.connectedAt = Math.floor(Date.now() / 1000) - 10;
            this.setStatus(whatsapp_engine_interface_1.EngineStatus.READY);
            this.host.getOnReady()?.(this.phoneNumber ?? '', this.pushName ?? '');
            void this.probeAccountRestriction();
            void this.host.hydrateNames();
        }
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output
                ?.statusCode;
            if (this.intentionalClose) {
                this.setStatus(whatsapp_engine_interface_1.EngineStatus.DISCONNECTED);
                return;
            }
            if (statusCode === this.lib?.DisconnectReason.loggedOut) {
                void this.handleRemoteLoggedOut();
                return;
            }
            if (statusCode === (this.lib?.DisconnectReason.connectionReplaced ?? 440)) {
                this.setStatus(whatsapp_engine_interface_1.EngineStatus.FAILED);
                this.host.liveCalls.clear();
                this.host.getOnError()?.('Connection replaced by another instance (440) — stop the other instance, then start this session again');
                return;
            }
            if (statusCode === (this.lib?.DisconnectReason.forbidden ?? 403)) {
                this.setStatus(whatsapp_engine_interface_1.EngineStatus.FAILED);
                this.host.liveCalls.clear();
                this.host.getOnError()?.('Account rejected by WhatsApp (403) — the number is likely banned or blocked; reconnecting will not help');
                return;
            }
            this.host.logger.log('Baileys connection dropped; reconnecting', { statusCode });
            this.setStatus(whatsapp_engine_interface_1.EngineStatus.INITIALIZING);
            if (this.reconnectTimer) {
                return;
            }
            const now = Date.now();
            if (now - this.lastConnectionCloseAt > BaileysLifecycle.RECONNECT_STABILITY_RESET_MS) {
                this.reconnectAttempts = 0;
            }
            this.lastConnectionCloseAt = now;
            this.scheduleReconnect();
        }
    }
    reportReachoutTimelock(state) {
        const report = this.host.getOnAccountRestriction();
        if (!report)
            return;
        if (!state.isActive) {
            report(null);
            return;
        }
        const endsAt = state.timeEnforcementEnds?.getTime();
        report({
            kind: 'reachout_timelock',
            code: state.enforcementType ?? 'DEFAULT',
            expiresAt: typeof endsAt === 'number' && Number.isFinite(endsAt) ? endsAt : undefined,
        });
    }
    async probeAccountRestriction() {
        try {
            await this.sock?.fetchAccountReachoutTimelock();
        }
        catch (error) {
            this.host.logger.debug('Could not read the account restriction state', {
                action: 'baileys_restriction_probe_failed',
                sessionId: this.host.config.sessionId,
                error: String(error),
            });
        }
    }
    scheduleReconnect() {
        if (this.intentionalClose || this.reconnectTimer) {
            return;
        }
        this.reconnectAttempts += 1;
        const delay = Math.min(60_000, 1_000 * 2 ** (this.reconnectAttempts - 1)) + Math.floor(Math.random() * 1000);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = undefined;
            if (this.intentionalClose) {
                return;
            }
            void this.connect().catch(err => {
                this.host.logger.warn('Baileys reconnect attempt failed; will retry', {
                    attempt: this.reconnectAttempts,
                    error: err instanceof Error ? err.message : String(err),
                });
                this.scheduleReconnect();
            });
        }, delay);
    }
    async handleQrCode(qr) {
        try {
            this.qrCode = await qrcode.toDataURL(qr);
            this.setStatus(whatsapp_engine_interface_1.EngineStatus.QR_READY);
            this.host.getOnQRCode()?.(this.qrCode);
        }
        catch (error) {
            this.host.logger.error('Error generating QR code', String(error));
        }
    }
    disconnect() {
        this.intentionalClose = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
        void this.sock?.end(undefined);
        this.sock = null;
        this.host.liveCalls.clear();
        this.setStatus(whatsapp_engine_interface_1.EngineStatus.DISCONNECTED);
        return Promise.resolve();
    }
    async logout() {
        this.intentionalClose = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
        const sourceSock = this.sock;
        if (!sourceSock) {
            throw new Error('No live WhatsApp socket — the unlink was not sent');
        }
        try {
            const b = await this.loadLib();
            const jid = sourceSock.user?.id;
            if (!jid) {
                throw new Error('No linked companion identity — the unlink was not sent');
            }
            const response = await sourceSock.query({
                tag: 'iq',
                attrs: { to: b.S_WHATSAPP_NET, type: 'set', id: sourceSock.generateMessageTag(), xmlns: 'md' },
                content: [{ tag: 'remove-companion-device', attrs: { jid, reason: 'user_initiated' } }],
            }, BAILEYS_LOGOUT_ACK_TIMEOUT_MS);
            if (!response) {
                throw new Error('WhatsApp did not acknowledge the unlink request');
            }
            this.localSocketShutdown(sourceSock);
            await this.host.config.messageStore?.clearSession(this.host.config.dbSessionId).catch(() => undefined);
            await this.clearAuthState();
        }
        catch (err) {
            this.localSocketShutdown(sourceSock);
            throw err;
        }
    }
    localSocketShutdown(sourceSock) {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
        try {
            void sourceSock.end(undefined);
        }
        catch {
        }
        this.host.liveCalls.clear();
        if (this.sock === sourceSock) {
            this.sock = null;
        }
        this.setStatus(whatsapp_engine_interface_1.EngineStatus.DISCONNECTED);
    }
    async handleRemoteLoggedOut() {
        this.setStatus(whatsapp_engine_interface_1.EngineStatus.DISCONNECTED);
        const dead = this.sock;
        this.sock = null;
        this.host.liveCalls.clear();
        void dead?.end(undefined);
        const cleanup = (async () => {
            try {
                await this.clearAuthState();
            }
            catch (err) {
                this.setStatus(whatsapp_engine_interface_1.EngineStatus.FAILED);
                this.host.getOnError()?.(`Logged out by WhatsApp, but the local credential cleanup failed: ${err instanceof Error ? err.message : String(err)}`);
                return;
            }
            this.host.getOnDisconnected()?.('logged out');
        })();
        this.host.getOnCredentialTeardownStarted()?.(cleanup);
        await cleanup;
    }
    async clearAuthState() {
        try {
            await fs.promises.rm(this.host.authPath, { recursive: true, force: true });
            this.host.logger.log('Cleared Baileys auth state', { authPath: this.host.authPath });
        }
        catch (err) {
            this.host.logger.warn('Failed to clear Baileys auth state', {
                error: err instanceof Error ? err.message : String(err),
            });
            throw err;
        }
    }
    destroy() {
        this.intentionalClose = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
        void this.sock?.end(undefined);
        this.sock = null;
        this.host.liveCalls.clear();
        this.setStatus(whatsapp_engine_interface_1.EngineStatus.DISCONNECTED);
        return Promise.resolve();
    }
    forceDestroy() {
        return this.destroy();
    }
    getStatus() {
        return this.status;
    }
    async probeLiveness() {
        return this.status === whatsapp_engine_interface_1.EngineStatus.READY && this.sock != null;
    }
    getQRCode() {
        return this.qrCode;
    }
    async requestPairingCode(phoneNumber) {
        if (!this.sock) {
            throw new engine_not_ready_error_1.EngineNotReadyError('Cannot request a pairing code before the engine is initialized.');
        }
        return this.sock.requestPairingCode(phoneNumber);
    }
    getPhoneNumber() {
        return this.phoneNumber;
    }
    getPushName() {
        return this.pushName;
    }
    ensureReady() {
        if (this.status !== whatsapp_engine_interface_1.EngineStatus.READY || !this.sock) {
            throw new engine_not_ready_error_1.EngineNotReadyError();
        }
    }
    setStatus(status) {
        if (this.status === status) {
            return;
        }
        this.status = status;
        this.host.getOnStateChanged()?.(status);
    }
}
exports.BaileysLifecycle = BaileysLifecycle;
//# sourceMappingURL=baileys-lifecycle.js.map