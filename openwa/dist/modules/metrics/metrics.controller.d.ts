import type { Request } from 'express';
import { MetricsService } from './metrics.service';
export declare class MetricsController {
    private readonly metricsService;
    constructor(metricsService: MetricsService);
    scrape(req: Request): Promise<string>;
}
