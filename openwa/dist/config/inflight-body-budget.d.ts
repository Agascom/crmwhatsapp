import { Request, Response, NextFunction } from 'express';
export declare function parseBodyLimitBytes(limit: string): number;
export declare function resolveInflightBodyBudgetBytes(budgetEnv?: string, bodyLimitEnv?: string): number;
export interface InflightBodyBudgetOptions {
    retryAfterSeconds?: number;
}
export interface InflightBodyBudget {
    middleware: (req: Request, res: Response, next: NextFunction) => void;
    currentBytes: () => number;
}
export declare function createInflightBodyBudget(budgetBytes: number, options?: InflightBodyBudgetOptions): InflightBodyBudget;
