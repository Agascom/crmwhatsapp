import { Repository } from 'typeorm';
import { IntegrationDeliveryFailure } from './entities/integration-delivery-failure.entity';
import { IngressEvent } from './entities/ingress-event.entity';
import { IngressEnqueueService } from './ingress-enqueue.service';
export declare class RedriveService {
    private readonly repo;
    private readonly events;
    private readonly ingressEnqueue;
    private readonly lock;
    constructor(repo: Repository<IntegrationDeliveryFailure>, events: Repository<IngressEvent>, ingressEnqueue: IngressEnqueueService);
    redriveInstance(pluginId: string, instanceId: string, sessionIdFilter: string | null): Promise<{
        redriven: number;
        remaining: number;
        batchSize: number;
    }>;
    private redriveBatch;
}
