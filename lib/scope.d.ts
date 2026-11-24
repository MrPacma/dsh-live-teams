/**
 * Declared task scope: what a task says it may touch, and how two declarations are
 * compared. The comparison is deliberately conservative — it reports an overlap when
 * a declaration *could* collide, because a missed overlap costs somebody's edits while
 * a reported one costs throughput (B30).
 */
export declare const MAX_PATHS = 32;
/**
 * Work that writes code, and therefore needs the isolation Gate C has not built yet
 * (ADR 0008; design §22), and the same set the parallel-write rules apply to. `work` is
 * listed because a generic kind does not promise it is documentation — the safe reading
 * of an unknown is "it writes", and the refusals name the kinds that are exempt.
 */
export declare const CODING_KINDS: ReadonlySet<string>;
/**
 * Paths that every task effectively shares, so touching one collides with any active
 * writer: manifests and lockfiles, repository internals, CI configuration and build
 * entry points. The deployment may extend this list with `sharedPaths`.
 */
export declare const SHARED_PATH_DEFAULTS: readonly string[];
/** Normalise one entry, or refuse it. Returns undefined for an unusable value. */
export declare function normalizeScopePath(value: unknown): string | undefined;
/** Normalise a whole declaration; undefined when any entry is unusable, or on duplicates. */
export declare function normalizeScope(paths: unknown): string[] | undefined;
/**
 * The literal prefix a pattern can be reduced to: everything before the first segment
 * that contains a wildcard. `src/**\/*.ts` reduces to `src`, `a/b*` to `a`.
 */
export declare function literalPrefix(entry: string): string;
/**
 * True when the two entries could touch the same file. Segment-boundary prefixes only,
 * so `a/b` and `a/bc` stay apart; a wildcard reduces to its literal prefix, which makes
 * this report overlaps that a particular run would not have produced.
 */
export declare function scopesIntersect(left: string, right: string): boolean;
export type ScopeOverlap = {
  left: string;
  right: string;
  shared: boolean;
};
export type ScopeConflict = {
  kind: 'overlap';
  left: string;
  right: string;
} | {
  kind: 'shared';
  left: string;
  right: string;
};
/**
 * Compare two declarations. Shared hotspots are reported separately from concrete
 * overlaps: the lead's action differs — one is "narrow the scope or serialise the two
 * tasks", the other is "these files are shared by everything".
 */
export declare function scopeConflict(left: readonly string[], right: readonly string[], shared?: readonly string[]): ScopeConflict | undefined;
/** Changed paths that fall outside a declaration. */
export declare function outsideScope(changed: readonly string[], declared: readonly string[]): string[];
/** Two declarations that a reviewer can compare without re-reading the contract. */
export declare function scopeSummary(paths: readonly string[] | undefined): string;
export declare function resolveWorkspacePath(workspacePath: string, entry: string): string;