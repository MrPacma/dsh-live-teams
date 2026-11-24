export declare function withProcessLock<T>(key: string, operation: () => Promise<T>): Promise<T>;
export declare function atomicWrite(filePath: string, contents: string | Uint8Array): Promise<void>;
export declare function atomicWriteJson(filePath: string, value: unknown): Promise<void>;
export declare function readJson(filePath: string): Promise<unknown>;
export declare function fileExists(filePath: string): Promise<boolean>;
export declare function clone<T>(value: T): T;
export declare const CURRENT_SCHEMA_VERSION = 1;