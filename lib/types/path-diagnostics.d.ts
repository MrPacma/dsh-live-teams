export type PathWarning = {
    code: 'path-no-match' | 'path-scan-incomplete';
    pattern: string;
    message: string;
};
/** Advisory only. Never follows symlinks, executes commands, or makes a contract invalid. */
export declare function diagnosePaths(workspace: string, declared: readonly string[] | undefined, options?: {
    maxEntries?: number;
    maxMillis?: number;
}): Promise<PathWarning[]>;
