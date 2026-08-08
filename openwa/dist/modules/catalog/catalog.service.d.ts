import { EngineRegistry } from '../../engine/engine-registry.service';
import type { Catalog, Product, PaginatedProducts, MessageResult } from '../../engine/interfaces/whatsapp-engine.interface';
import { SendPacingService } from '../message/send-pacing.service';
export declare class CatalogService {
    private readonly engines;
    private readonly pacing;
    constructor(engines: EngineRegistry, pacing: SendPacingService);
    getCatalog(sessionId: string): Promise<Catalog | null>;
    getProducts(sessionId: string, page?: number, limit?: number): Promise<PaginatedProducts>;
    getProduct(sessionId: string, productId: string): Promise<Product | null>;
    sendProduct(sessionId: string, chatId: string, productId: string, body?: string): Promise<MessageResult>;
    sendCatalog(sessionId: string, chatId: string, body?: string): Promise<MessageResult>;
}
