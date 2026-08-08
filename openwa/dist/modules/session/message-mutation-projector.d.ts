import { Repository } from 'typeorm';
import { Message } from '../message/entities/message.entity';
import { KeyedMutationQueue } from '../../common/utils/keyed-mutation-queue';
import { LoggerService } from '../../common/services/logger.service';
import { EventsGateway } from '../events/events.gateway';
import { WebhookService } from '../webhook/webhook.service';
import { ReactionEvent, EditedMessage } from '../../engine/interfaces/whatsapp-engine.interface';
export declare class MessageMutationProjector {
    private readonly messageRepository;
    private readonly eventsGateway;
    private readonly webhookService;
    private readonly messageMutations;
    private readonly logger;
    constructor(messageRepository: Repository<Message>, eventsGateway: EventsGateway, webhookService: WebhookService, messageMutations: KeyedMutationQueue, logger: LoggerService);
    applyReactionQueued(id: string, event: ReactionEvent): void;
    applyMessageEditQueued(id: string, message: EditedMessage): void;
    enqueueMessageMutation(id: string, messageId: string, work: () => Promise<void>): void;
    private applyReaction;
    private applyMessageEdit;
    recordOutboundMessageEdit(sessionId: string, messageId: string, body: string): Promise<void>;
}
