"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageMutationProjector = void 0;
class MessageMutationProjector {
    messageRepository;
    eventsGateway;
    webhookService;
    messageMutations;
    logger;
    constructor(messageRepository, eventsGateway, webhookService, messageMutations, logger) {
        this.messageRepository = messageRepository;
        this.eventsGateway = eventsGateway;
        this.webhookService = webhookService;
        this.messageMutations = messageMutations;
        this.logger = logger;
    }
    applyReactionQueued(id, event) {
        this.enqueueMessageMutation(id, event.messageId, () => this.applyReaction(id, event));
    }
    applyMessageEditQueued(id, message) {
        this.enqueueMessageMutation(id, message.messageId, () => this.applyMessageEdit(id, message));
    }
    enqueueMessageMutation(id, messageId, work) {
        this.messageMutations.enqueue(`${id}:${messageId}`, work);
    }
    async applyReaction(id, event) {
        try {
            if (!event.messageId)
                return;
            const msg = await this.messageRepository.findOne({ where: { sessionId: id, waMessageId: event.messageId } });
            let reactions;
            if (msg) {
                const metadata = msg.metadata || {};
                reactions = metadata.reactions || {};
                if (!event.reaction) {
                    delete reactions[event.senderId];
                }
                else {
                    reactions[event.senderId] = event.reaction;
                }
                metadata.reactions = reactions;
                await this.messageRepository.update({ sessionId: id, waMessageId: event.messageId }, {
                    metadata,
                });
            }
            const payload = reactions ? { ...event, reactions } : { ...event };
            this.eventsGateway.emitMessageReaction(id, payload);
            void this.webhookService.dispatch(id, 'message.reaction', payload);
        }
        catch (err) {
            this.logger.error(`Failed to update message reaction: ${event.messageId}`, String(err));
        }
    }
    async applyMessageEdit(id, message) {
        try {
            await this.messageRepository.update({ sessionId: id, waMessageId: message.messageId }, { body: message.body });
        }
        catch (err) {
            this.logger.error(`Failed to update edited message: ${message.messageId}`, String(err));
        }
        const editedPayload = message;
        this.eventsGateway.emitMessageEdited(id, editedPayload);
        void this.webhookService.dispatch(id, 'message.edited', editedPayload);
    }
    async recordOutboundMessageEdit(sessionId, messageId, body) {
        await new Promise(resolve => {
            this.enqueueMessageMutation(sessionId, messageId, async () => {
                try {
                    await this.messageRepository.update({ sessionId, waMessageId: messageId }, { body });
                }
                catch (err) {
                    this.logger.warn(`Failed to update stored body of edited message ${messageId}`, { error: String(err) });
                }
                finally {
                    resolve();
                }
            });
        });
    }
}
exports.MessageMutationProjector = MessageMutationProjector;
//# sourceMappingURL=message-mutation-projector.js.map