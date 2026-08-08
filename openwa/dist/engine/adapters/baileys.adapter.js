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
exports.BaileysAdapter = exports.createProxyAgent = void 0;
const path = __importStar(require("path"));
const baileys_channels_1 = require("./baileys-channels");
const baileys_catalog_1 = require("./baileys-catalog");
const baileys_contacts_1 = require("./baileys-contacts");
const baileys_events_1 = require("./baileys-events");
const baileys_groups_1 = require("./baileys-groups");
const baileys_history_1 = require("./baileys-history");
const baileys_lifecycle_1 = require("./baileys-lifecycle");
const baileys_messaging_1 = require("./baileys-messaging");
const baileys_status_1 = require("./baileys-status");
const engine_not_supported_error_1 = require("../../common/errors/engine-not-supported.error");
const common_1 = require("@nestjs/common");
const logger_service_1 = require("../../common/services/logger.service");
const baileys_session_store_1 = require("./baileys-session-store");
const inbound_media_cap_1 = require("./inbound-media-cap");
const concurrency_limiter_1 = require("../../common/utils/concurrency-limiter");
const baileys_query_deadline_1 = require("./baileys-query-deadline");
var baileys_lifecycle_2 = require("./baileys-lifecycle");
Object.defineProperty(exports, "createProxyAgent", { enumerable: true, get: function () { return baileys_lifecycle_2.createProxyAgent; } });
class BaileysAdapter {
    config;
    logger = (0, logger_service_1.createLogger)('BaileysAdapter');
    inboundLimiter = new concurrency_limiter_1.ConcurrencyLimiter((0, inbound_media_cap_1.inboundMediaConcurrency)(), (0, inbound_media_cap_1.inboundMediaConcurrency)());
    authPath;
    sessionStore;
    groups;
    messaging;
    contacts;
    statusOps;
    channels;
    catalog;
    history;
    events;
    lifecycle;
    callbacks = {};
    get sock() {
        return this.lifecycle.sock;
    }
    set sock(value) {
        this.lifecycle.sock = value;
    }
    get connectedAt() {
        return this.lifecycle.connectedAt;
    }
    get liveCalls() {
        return this.events.liveCalls;
    }
    loadLib() {
        return this.lifecycle.loadLib();
    }
    constructor(config) {
        this.config = config;
        this.authPath = path.join(config.authDir, config.sessionId);
        this.sessionStore = new baileys_session_store_1.BaileysSessionStore(config.lidMappingStore, config.sessionId);
        const connectedAt = () => this.connectedAt;
        this.events = new baileys_events_1.BaileysEvents({
            getSocket: () => this.sock,
            getSocketOrNull: () => this.sock,
            logger: this.logger,
            toNeutralJid: jid => this.sessionStore.toNeutralJid(jid),
            normalizedSelfJid: () => this.normalizedSelfJid(),
            loadLib: () => this.loadLib(),
            get connectedAt() {
                return connectedAt();
            },
            inboundLimiter: this.inboundLimiter,
            recordKeyLidMappings: key => this.sessionStore.recordKeyLidMappings(key),
            recordMessage: msg => this.sessionStore.recordMessage(msg),
            recordMessageEdit: (chatId, messageId, text) => this.sessionStore.recordMessageEdit(chatId, messageId, text),
            putStoredMessage: msg => this.config.messageStore?.put(this.config.dbSessionId, msg),
            getOnMessage: () => this.callbacks.onMessage,
            getOnMessageCreate: () => this.callbacks.onMessageCreate,
            getOnMessageRevoked: () => this.callbacks.onMessageRevoked,
            getOnMessageEdited: () => this.callbacks.onMessageEdited,
            getOnMessageReaction: () => this.callbacks.onMessageReaction,
            getOnMessageAck: () => this.callbacks.onMessageAck,
            getOnGroupEvent: () => this.callbacks.onGroupEvent,
            getOnCall: () => this.callbacks.onCall,
            getOnPresenceUpdate: () => this.callbacks.onPresenceUpdate,
            getOnCallOutcome: () => this.callbacks.onCallOutcome,
        });
        this.groups = new baileys_groups_1.BaileysGroups({
            ensureReady: () => this.ensureReady(),
            getSocket: () => this.sock,
            logger: this.logger,
            toNeutralJid: jid => this.sessionStore.toNeutralJid(jid),
            toEngineJid: jid => this.sessionStore.toEngineJid(jid),
            normalizedSelfJid: () => this.normalizedSelfJid(),
        });
        this.messaging = new baileys_messaging_1.BaileysMessaging({
            ensureReady: () => this.ensureReady(),
            getSocket: () => this.sock,
            logger: this.logger,
            toNeutralJid: jid => this.sessionStore.toNeutralJid(jid),
            toEngineJid: jid => this.sessionStore.toEngineJid(jid),
            normalizedSelfJid: () => this.normalizedSelfJid(),
            getEphemeralExpiration: chatId => this.sessionStore.getEphemeralExpiration(chatId),
            toUnixSeconds: baileys_history_1.toUnixSeconds,
            loadLib: () => this.loadLib(),
            putStoredMessage: msg => this.config.messageStore?.put(this.config.dbSessionId, msg),
            getStoredMessage: messageId => this.config.messageStore?.getMessage(this.config.dbSessionId, messageId),
            recordLidMapping: (lid, pn) => this.sessionStore.addLidMappings([{ lid: `${lid.split('@')[0].split(':')[0]}@lid`, pn }]),
            getOnMessageCreate: () => this.callbacks.onMessageCreate,
            mapMessage: (msg, contentType, opts) => this.events.mapMessage(msg, contentType, opts),
        });
        this.contacts = new baileys_contacts_1.BaileysContacts({
            ensureReady: () => this.ensureReady(),
            getSocket: () => this.sock,
            logger: this.logger,
            normalizedSelfJid: () => this.normalizedSelfJid(),
            listContacts: () => this.sessionStore.listContacts(),
            findContact: contactId => this.sessionStore.findContact(contactId),
            resolvePhone: contactId => this.sessionStore.resolvePhone(contactId),
            listChats: () => this.sessionStore.listChats(),
            lastMessage: chatId => this.sessionStore.lastMessage(chatId),
            toEngineJid: jid => this.sessionStore.toEngineJid(jid),
        });
        this.statusOps = new baileys_status_1.BaileysStatus({
            ensureReady: () => this.ensureReady(),
            getSocket: () => this.sock,
            toEngineJid: jid => this.sessionStore.toEngineJid(jid),
            normalizedSelfJid: () => this.normalizedSelfJid(),
            toUnixSeconds: baileys_history_1.toUnixSeconds,
        });
        this.channels = new baileys_channels_1.BaileysChannels({
            ensureReady: () => this.ensureReady(),
            getSocket: () => this.sock,
        });
        this.catalog = new baileys_catalog_1.BaileysCatalog({
            ensureReady: () => this.ensureReady(),
            getSocket: () => this.sock,
            logger: this.logger,
            normalizedSelfJid: () => this.normalizedSelfJid(),
        });
        this.history = new baileys_history_1.BaileysHistory({
            getSocket: () => this.sock,
            logger: this.logger,
            toNeutralJid: jid => this.sessionStore.toNeutralJid(jid),
            normalizedSelfJid: () => this.normalizedSelfJid(),
            loadLib: () => this.loadLib(),
            recordMessage: msg => this.sessionStore.recordMessage(msg),
            upsertContacts: records => this.sessionStore.upsertContacts(records),
            upsertChats: records => this.sessionStore.upsertChats(records),
            extractEphemeralDuration: msg => this.sessionStore.extractEphemeralDuration(msg),
            getOnHistoryMessages: () => this.callbacks.onHistoryMessages,
        });
        this.lifecycle = new baileys_lifecycle_1.BaileysLifecycle({
            logger: this.logger,
            authPath: this.authPath,
            config: this.config,
            liveCalls: this.events.liveCalls,
            extractPhone: id => this.extractPhone(id),
            upsertContacts: records => this.sessionStore.upsertContacts(records),
            upsertChats: records => this.sessionStore.upsertChats(records),
            addLidMappings: mappings => this.sessionStore.addLidMappings(mappings),
            handleMessagesUpsert: event => this.events.handleMessagesUpsert(event),
            handleMessagesUpdate: updates => this.events.handleMessagesUpdate(updates),
            logContactEvent: (event, records) => this.events.logContactEvent(event, records),
            handleGroupParticipantsUpdate: event => this.events.handleGroupParticipantsUpdate(event),
            handleGroupsUpdate: updates => this.events.handleGroupsUpdate(updates),
            handleCallEvents: calls => this.events.handleCallEvents(calls),
            handlePresenceUpdate: update => this.events.handlePresenceUpdate(update),
            captureHistoryMessages: messages => this.history.captureHistoryMessages(messages),
            hydrateNames: () => this.history.hydrateNames(),
            getOnQRCode: () => this.callbacks.onQRCode,
            getOnReady: () => this.callbacks.onReady,
            getOnDisconnected: () => this.callbacks.onDisconnected,
            getOnError: () => this.callbacks.onError,
            getOnStateChanged: () => this.callbacks.onStateChanged,
            getOnCredentialTeardownStarted: () => this.callbacks.onCredentialTeardownStarted,
            getOnAccountRestriction: () => this.callbacks.onAccountRestriction,
        });
    }
    async initialize(callbacks) {
        this.callbacks = callbacks;
        return this.lifecycle.initialize();
    }
    disconnect() {
        return this.lifecycle.disconnect();
    }
    async logout() {
        return this.lifecycle.logout();
    }
    destroy() {
        return this.lifecycle.destroy();
    }
    forceDestroy() {
        return this.lifecycle.forceDestroy();
    }
    getStatus() {
        return this.lifecycle.getStatus();
    }
    async probeLiveness() {
        return this.lifecycle.probeLiveness();
    }
    getQRCode() {
        return this.lifecycle.getQRCode();
    }
    async requestPairingCode(phoneNumber) {
        return this.lifecycle.requestPairingCode(phoneNumber);
    }
    getPhoneNumber() {
        return this.lifecycle.getPhoneNumber();
    }
    getPushName() {
        return this.lifecycle.getPushName();
    }
    async sendTextMessage(chatId, text, mentions, options) {
        return this.messaging.sendTextMessage(chatId, text, mentions, options);
    }
    async checkNumberExists(number) {
        return this.messaging.checkNumberExists(number);
    }
    async getNumberId(number) {
        return this.messaging.getNumberId(number);
    }
    async sendChatState(chatId, state) {
        return this.messaging.sendChatState(chatId, state);
    }
    async sendImageMessage(chatId, media) {
        return this.messaging.sendImageMessage(chatId, media);
    }
    async sendVideoMessage(chatId, media) {
        return this.messaging.sendVideoMessage(chatId, media);
    }
    async sendAudioMessage(chatId, media) {
        return this.messaging.sendAudioMessage(chatId, media);
    }
    async sendDocumentMessage(chatId, media) {
        return this.messaging.sendDocumentMessage(chatId, media);
    }
    async sendStickerMessage(chatId, media) {
        return this.messaging.sendStickerMessage(chatId, media);
    }
    async sendLocationMessage(chatId, location) {
        return this.messaging.sendLocationMessage(chatId, location);
    }
    async sendContactMessage(chatId, contact) {
        return this.messaging.sendContactMessage(chatId, contact);
    }
    async sendPollMessage(chatId, poll) {
        return this.messaging.sendPollMessage(chatId, poll);
    }
    async replyToMessage(chatId, quotedMsgId, text) {
        return this.messaging.replyToMessage(chatId, quotedMsgId, text);
    }
    async forwardMessage(fromChatId, toChatId, messageId) {
        return this.messaging.forwardMessage(fromChatId, toChatId, messageId);
    }
    async reactToMessage(chatId, messageId, emoji) {
        return this.messaging.reactToMessage(chatId, messageId, emoji);
    }
    async deleteMessage(chatId, messageId, forEveryone = true) {
        return this.messaging.deleteMessage(chatId, messageId, forEveryone);
    }
    async starMessage(chatId, messageId, star) {
        return this.messaging.starMessage(chatId, messageId, star);
    }
    async pinMessage(chatId, messageId, durationSeconds) {
        return this.messaging.pinMessage(chatId, messageId, durationSeconds);
    }
    async unpinMessage(chatId, messageId) {
        return this.messaging.unpinMessage(chatId, messageId);
    }
    async editMessage(chatId, messageId, body) {
        return this.messaging.editMessage(chatId, messageId, body);
    }
    async getGroups() {
        return this.groups.getGroups();
    }
    async getGroupInfo(groupId) {
        return this.groups.getGroupInfo(groupId);
    }
    async createGroup(name, participants) {
        return this.groups.createGroup(name, participants);
    }
    async addParticipants(groupId, participants) {
        return this.groups.addParticipants(groupId, participants);
    }
    async removeParticipants(groupId, participants) {
        return this.groups.removeParticipants(groupId, participants);
    }
    async promoteParticipants(groupId, participants) {
        return this.groups.promoteParticipants(groupId, participants);
    }
    async demoteParticipants(groupId, participants) {
        return this.groups.demoteParticipants(groupId, participants);
    }
    async leaveGroup(groupId) {
        return this.groups.leaveGroup(groupId);
    }
    async setGroupSubject(groupId, subject) {
        return this.groups.setGroupSubject(groupId, subject);
    }
    async setGroupDescription(groupId, description) {
        return this.groups.setGroupDescription(groupId, description);
    }
    async getGroupInviteCode(groupId) {
        return this.groups.getGroupInviteCode(groupId);
    }
    async revokeGroupInviteCode(groupId) {
        return this.groups.revokeGroupInviteCode(groupId);
    }
    getGroupJoinInfo(inviteCode) {
        return this.groups.getGroupJoinInfo(inviteCode);
    }
    async joinGroupViaInviteCode(inviteCode) {
        return this.groups.joinGroupViaInviteCode(inviteCode);
    }
    async setGroupMessagesAdminsOnly(groupId, adminsOnly) {
        return this.groups.setGroupMessagesAdminsOnly(groupId, adminsOnly);
    }
    async setGroupInfoAdminsOnly(groupId, adminsOnly) {
        return this.groups.setGroupInfoAdminsOnly(groupId, adminsOnly);
    }
    async setGroupMemberAddMode(groupId, mode) {
        return this.groups.setGroupMemberAddMode(groupId, mode);
    }
    async setGroupPicture(groupId, media) {
        return this.groups.setGroupPicture(groupId, media);
    }
    async deleteGroupPicture(groupId) {
        return this.groups.deleteGroupPicture(groupId);
    }
    async setGroupEphemeral(groupId, durationSec) {
        return this.groups.setGroupEphemeral(groupId, durationSec);
    }
    async getProfilePicture(contactId) {
        return this.contacts.getProfilePicture(contactId);
    }
    async blockContact(contactId) {
        return this.contacts.blockContact(contactId);
    }
    async upsertContact(contactId, firstName, lastName) {
        return this.contacts.upsertContact(contactId, firstName, lastName);
    }
    async deleteContact(contactId) {
        return this.contacts.deleteContact(contactId);
    }
    async unblockContact(contactId) {
        return this.contacts.unblockContact(contactId);
    }
    async setProfileName(name) {
        return this.contacts.setProfileName(name);
    }
    async setProfileStatus(status) {
        return this.contacts.setProfileStatus(status);
    }
    async setProfilePicture(media) {
        return this.contacts.setProfilePicture(media);
    }
    async getContacts() {
        return this.contacts.getContacts();
    }
    async getContactById(contactId) {
        return this.contacts.getContactById(contactId);
    }
    async resolveContactPhone(contactId) {
        return this.contacts.resolveContactPhone(contactId);
    }
    async getChats() {
        return this.contacts.getChats();
    }
    async subscribeToPresence(chatId) {
        return this.messaging.subscribeToPresence(chatId);
    }
    async sendSeen(chatId) {
        return this.contacts.sendSeen(chatId);
    }
    async markUnread(chatId) {
        return this.contacts.markUnread(chatId);
    }
    async deleteChat(chatId) {
        return this.contacts.deleteChat(chatId);
    }
    async archiveChat(chatId, archive) {
        return this.contacts.archiveChat(chatId, archive);
    }
    async clearChatMessages(chatId) {
        return this.contacts.clearChatMessages(chatId);
    }
    getMessageReactions(_chatId, _messageId) {
        return this.unsupported('getMessageReactions');
    }
    getChatsByLabel(_labelId) {
        return this.unsupported('getChatsByLabel');
    }
    votePoll(_chatId, _pollMessageId, _options) {
        return this.unsupported('votePoll');
    }
    getChatHistory(_chatId, _limit, _includeMedia, _mediaMaxBytes, _signal) {
        return this.unsupported('getChatHistory');
    }
    getLabels() {
        return this.unsupported('getLabels');
    }
    getLabelById(_labelId) {
        return this.unsupported('getLabelById');
    }
    getChatLabels(_chatId) {
        return this.unsupported('getChatLabels');
    }
    async addLabelToChat(chatId, labelId) {
        this.ensureReady();
        await (0, baileys_query_deadline_1.withQueryDeadline)(this.sock.addChatLabel(this.sessionStore.toEngineJid(chatId), labelId), baileys_query_deadline_1.BAILEYS_QUERY_BUDGET_MS, 'WhatsApp did not confirm the chat label add in time');
    }
    async removeLabelFromChat(chatId, labelId) {
        this.ensureReady();
        await (0, baileys_query_deadline_1.withQueryDeadline)(this.sock.removeChatLabel(this.sessionStore.toEngineJid(chatId), labelId), baileys_query_deadline_1.BAILEYS_QUERY_BUDGET_MS, 'WhatsApp did not confirm the chat label removal in time');
    }
    async upsertLabel(label) {
        this.ensureReady();
        await (0, baileys_query_deadline_1.withQueryDeadline)(this.sock.addLabel(this.ownJidForAppState(), { id: label.id, name: label.name, color: label.color }), baileys_query_deadline_1.BAILEYS_QUERY_BUDGET_MS, 'WhatsApp did not confirm the label save in time');
    }
    async deleteLabel(labelId) {
        this.ensureReady();
        await (0, baileys_query_deadline_1.withQueryDeadline)(this.sock.addLabel(this.ownJidForAppState(), { id: labelId, deleted: true }), baileys_query_deadline_1.BAILEYS_QUERY_BUDGET_MS, 'WhatsApp did not confirm the label delete in time');
    }
    ownJidForAppState() {
        return this.sock?.user?.id ?? 'status@broadcast';
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
    getSubscribedChannels() {
        return this.unsupported('getSubscribedChannels');
    }
    async getChannelById(channelId) {
        return this.channels.getChannelById(channelId);
    }
    async subscribeToChannel(inviteCode) {
        return this.channels.subscribeToChannel(inviteCode);
    }
    async unsubscribeFromChannel(channelId) {
        return this.channels.unsubscribeFromChannel(channelId);
    }
    getChannelMessages(_channelId, _limit) {
        return this.unsupported('getChannelMessages');
    }
    getContactStatuses() {
        return this.unsupported('getContactStatuses');
    }
    getContactStatus(_contactId) {
        return this.unsupported('getContactStatus');
    }
    postTextStatus(text, options) {
        return this.statusOps.postTextStatus(text, options);
    }
    postImageStatus(media, options) {
        return this.statusOps.postImageStatus(media, options);
    }
    postVideoStatus(media, options) {
        return this.statusOps.postVideoStatus(media, options);
    }
    postVoiceStatus(media, options) {
        return this.statusOps.postVoiceStatus(media, options);
    }
    async deleteStatus(statusId) {
        return this.statusOps.deleteStatus(statusId);
    }
    getCatalog() {
        return this.catalog.getCatalog();
    }
    getProducts(options) {
        return this.catalog.getProducts(options);
    }
    getProduct(productId) {
        return this.catalog.getProduct(productId);
    }
    async sendProduct(chatId, productId, body) {
        const product = await this.catalog.getProduct(productId);
        if (!product) {
            throw new common_1.NotFoundException(`Product ${productId} not found in the session catalog`);
        }
        return this.messaging.sendProductMessage(chatId, product, body);
    }
    sendCatalog(_chatId, _body) {
        return this.unsupported('sendCatalog');
    }
    async rejectCall(callId) {
        return this.events.rejectCall(callId);
    }
    normalizedSelfJid() {
        const phone = this.extractPhone(this.sock?.user?.id);
        return phone ? `${phone}@s.whatsapp.net` : '';
    }
    unsupported(method) {
        return Promise.reject(new engine_not_supported_error_1.EngineNotSupportedError(method));
    }
    ensureReady() {
        this.lifecycle.ensureReady();
    }
    extractPhone(id) {
        if (!id) {
            return null;
        }
        return id.split(':')[0].split('@')[0] || null;
    }
}
exports.BaileysAdapter = BaileysAdapter;
//# sourceMappingURL=baileys.adapter.js.map