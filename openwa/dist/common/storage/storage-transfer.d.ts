import { Readable, PassThrough } from 'stream';
import { LoggerService } from '../services/logger.service';
export declare function createExportStream(listFiles: () => Promise<string[]>, getFile: (filePath: string) => Promise<Buffer>, logger: LoggerService): Promise<PassThrough>;
export declare function importFromStream(inputStream: Readable, putFile: (filePath: string, data: Buffer) => Promise<void>, logger: LoggerService): Promise<number>;
