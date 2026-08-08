import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Repository } from 'typeorm';
import { IngressEvent } from './entities/ingress-event.entity';
import { IntegrationDeliveryFailure } from './entities/integration-delivery-failure.entity';
export declare class IntegrationRetentionService implements OnModuleInit, OnModuleDestroy {
    private readonly eventRepository;
    private readonly failureRepository;
    private readonly logger;
    private cleanupTimer?;
    constructor(eventRepository: Repository<IngressEvent>, failureRepository: Repository<IntegrationDeliveryFailure>);
    onModuleInit(): void;
    onModuleDestroy(): void;
    pruneOlderThan(eventsDays: number, failuresDays?: number | null): Promise<{
        events: number;
        failures: number;
    }>;
}
