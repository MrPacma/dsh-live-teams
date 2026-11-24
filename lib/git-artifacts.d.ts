export type BaseInfo = {
  readonly ref: string;
  readonly sha: string;
};
/** The branch and tip a piece of work is based on. `undefined` in a repository with no commits. */
export declare function baseInfo(workspacePath: string): Promise<BaseInfo | undefined>;
export type BuiltCommit = {
  readonly headSha: string;
  readonly treeSha: string;
  readonly commitPaths: readonly string[];
  readonly mergeBaseSha?: string;
};
export type CommitRequest = {
  readonly paths: readonly string[];
  readonly message: string;
  readonly author: {
    readonly name: string;
    readonly email: string;
  };
};
/**
 * Build one commit from exactly these paths, parented on `base`.
 *
 * The tree is the *base tree* with the submitted paths replaced: a commit built from scratch would
 * delete everything the submission did not mention, which the first probe of this module caught by
 * showing four changed paths where two were submitted. Blobs are written with `hash-object -w`,
 * directories assembled bottom-up with `mktree`, and `commit-tree` writes the commit — no index, no
 * checkout, no branch moved.
 *
 * A submitted path that is missing from disk is a deletion when the base had it, and a refusal when
 * it did not: a submission cannot claim a file that never existed.
 */
export declare function commitPaths(workspacePath: string, base: BaseInfo | undefined, request: CommitRequest): Promise<BuiltCommit | undefined>;
/** Keep a built commit reachable, so `git gc` cannot take the reviewed artifact away. */
export declare function pinCommit(workspacePath: string, ref: string, sha: string): Promise<boolean>;
/** The current tip of a branch, for the acceptance precondition. */
export declare function refTip(workspacePath: string, ref: string): Promise<string | undefined>;
/**
 * Integrate by compare-and-swap: advance the branch only if it is still where the review left it.
 *
 * The working tree already holds the work, so nothing is checked out and nothing is merged. The
 * old-value argument is what makes this safe: a base that moved underneath the decision fails here
 * instead of silently rewriting history or absorbing a review that no longer applies.
 */
export type IntegrationOutcome = 'integrated' | 'stale' | 'index-failed';
export declare function integrateCommit(workspacePath: string, ref: string, headSha: string, expectedTip: string | undefined, commitPaths?: readonly string[]): Promise<IntegrationOutcome>;
/** Paths a commit changes relative to a base, for a reviewer that wants the list. */
export declare function commitPathsOf(workspacePath: string, from: string, to: string): Promise<string[] | undefined>;