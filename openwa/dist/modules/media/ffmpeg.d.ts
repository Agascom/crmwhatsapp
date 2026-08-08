export declare class FfmpegConversionError extends Error {
    readonly detail: string;
    constructor(message: string, detail?: string);
}
export interface FfmpegRunOptions {
    ffmpegPath: string;
    timeoutMs: number;
    maxOutputBytes: number;
}
export declare function buildFfmpegArgs(inputPath: string, outputPath: string, encodeArgs: string[]): string[];
export declare function voiceEncodeArgs(): string[];
export declare function videoEncodeArgs(): string[];
export declare function runFfmpeg(input: Buffer, inputExtension: string, outputExtension: string, encodeArgs: string[], options: FfmpegRunOptions): Promise<Buffer>;
export declare function probeFfmpeg(ffmpegPath: string, timeoutMs?: number): Promise<boolean>;
