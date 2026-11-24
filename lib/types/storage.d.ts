export declare function withProcessLock<T>(key: string, operation: () => Promise<T>): Promise<T>;
export declare function atomicWrite(filePath: string, contents: string | Uint8Array): Promise<void>;
export declare function atomicWriteJson(filePath: string, value: unknown): Promise<void>;
export declare function readJson(filePath: string): Promise<unknown>;
export declare function fileExists(filePath: string): Promise<boolean>;
export declare function clone<T>(value: T): T;
export declare const CURRENT_SCHEMA_VERSION = 1;
/**
 * The tasks file has its own version, because it has its own shape.
 *
 * 2 — tasks carry `awaitsDecision` (a submission is in and nobody has decided on it). The flag was
 * added after a live stand showed a task that could be neither accepted nor closed: the store and
 * the panel both derived the answer from the status, and a returned task is `in_progress` while its
 * submission is still on the table.
 *
 * One constant for every file made the team store expect a version it never wrote, and the host
 * integration tests caught it. A version belongs to a file.
 */
export declare const TASKS_SCHEMA_VERSION = 2;
