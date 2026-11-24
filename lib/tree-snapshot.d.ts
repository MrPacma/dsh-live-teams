/**
 * A cheap fingerprint of a workspace tree, for the scope record in `files` mode (B32).
 *
 * Pure filesystem work — no git, no shelling out — so the task store can use it without
 * taking on the git adapter, and so it can be tested against a plain temporary folder.
 * Size and mtime, not content: the question is whether a file moved while an attempt ran,
 * and hashing every file of a workspace on every claim is a cost nobody agreed to. Content
 * digests live in the submission artifact, where they belong.
 */
/** Directories that are never a member's work: build output, caches, the team's own state. */
export declare const SNAPSHOT_EXCLUDED: Set<string>;
export declare const MAX_SNAPSHOT_FILES = 20000;
export type TreeSnapshot = Readonly<Record<string, string>>;
/**
 * A cheap fingerprint of the whole tree: path → `size:mtime`.
 *
 * Size and mtime, not content: the question here is "did this file move while the attempt
 * ran", and hashing every file of a workspace on every claim would be a cost nobody agreed
 * to. Content digests live in the submission artifact, where they belong.
 *
 * `undefined` means the tree was too large to watch, which is reported as `unchecked` with a
 * reason rather than as "nothing changed".
 */
export declare function snapshotTree(workspacePath: string): Promise<TreeSnapshot | undefined>;
/** Paths added, changed or removed between two snapshots, sorted for a stable record. */
export declare function diffSnapshots(before: TreeSnapshot, after: TreeSnapshot): string[];