/**
 * What changed in a workspace, for the declared-scope check (B30).
 *
 * The store never shells out itself: it takes a port, and the plugin supplies this
 * adapter. `undefined` means "not observable" — no git, not a repository, an
 * unparsable answer, or more changes than the cap — and is recorded as `unchecked`
 * rather than as a clean result.
 *
 * `--porcelain -z` is used because the output is byte-exact: entries are NUL separated,
 * a rename prints the *new* path first and the original as the next record, and no
 * quoting or escaping is applied to unusual file names.
 */
export declare const CHANGED_PATHS_LIMIT = 2000;
export declare function parsePorcelainZ(stdout: string): string[] | undefined;
/**
 * What the member *committed* during its attempt.
 *
 * `git status` shows uncommitted work only, so a member that commits — which is what a careful
 * engineer does, and what the repository's own conventions ask for — looked like it had changed
 * nothing, and a report submission was refused with "nothing changed under the declaration" (found
 * by a Builder on a real stand). The work is the union: what is still in the tree, and what was
 * committed since the attempt took its base.
 */
export declare function gitCommittedPaths(workspacePath: string, base: string): Promise<string[] | undefined>;
export declare function gitChangedPaths(workspacePath: string): Promise<string[] | undefined>;
/**
 * B32: which observation a workspace supports.
 *
 * `git` when the workspace is a work tree, `files` otherwise. A directory that is not a
 * repository is a first-class case (a plugin folder, a document, a research tree), not a
 * degraded one: the declaration is checked the same way, only the evidence differs.
 */
export type WorkspaceMode = 'git' | 'files';
export declare function workspaceMode(workspacePath: string): Promise<WorkspaceMode | undefined>;