import type { IWhatsAppEngine } from './interfaces/whatsapp-engine.interface';
export declare class EngineRegistry {
    private readonly engines;
    readonly initializing: Set<string>;
    get(id: string): IWhatsAppEngine | undefined;
    set(id: string, engine: IWhatsAppEngine): void;
    has(id: string): boolean;
    delete(id: string): boolean;
    clear(): void;
    get size(): number;
    keys(): IterableIterator<string>;
    entries(): Array<[string, IWhatsAppEngine]>;
    [Symbol.iterator](): IterableIterator<[string, IWhatsAppEngine]>;
    isLive(id: string, engine: IWhatsAppEngine): boolean;
    deleteIfLive(id: string, engine: IWhatsAppEngine): boolean;
    require(id: string, onMissing?: () => Error): IWhatsAppEngine;
    activeIds(): string[];
}
