export declare function listLocalFiles(localPath: string): Promise<string[]>;
export declare function iterateLocalFiles(localPath: string, prefix?: string): AsyncGenerator<string>;
export declare function getLocalFile(localPath: string, filePath: string): Promise<Buffer>;
export declare function putLocalFile(localPath: string, filePath: string, data: Buffer): Promise<void>;
export declare function deleteLocalFile(localPath: string, filePath: string): Promise<void>;
