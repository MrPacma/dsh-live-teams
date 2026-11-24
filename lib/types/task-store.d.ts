import { type PathWarning } from './path-diagnostics.js';
import { type ReviewReturn } from './review-return-state.js';
import { type LifecycleNoticeIntent, type LifecycleNoticeRequest, type LifecycleNoticeFence } from './lifecycle-notice.js';
import { type Migration } from './migrations.js';
import { type TeamState } from './team-store.js';
export type TaskKind = 'work' | 'research' | 'requirements' | 'implementation' | 'verification' | 'review' | 'repair' | 'integration';
export type TaskStatus = 'draft' | 'ready' | 'claimed' | 'in_progress' | 'waiting' | 'needs_human' | 'completed' | 'failed' | 'cancelled';
export type TaskRoute = {
    type: 'report';
    to: string | 'human';
} | {
    type: 'review';
    reviewer: string;
} | {
    type: 'interactive';
    then: TaskRoute;
} | {
    type: 'custom';
    description: string;
};
/** The durable task shape deliberately leaves room for later Phase 4 fields. */
export type HumanContact = 'none' | 'expected' | 'required';
export type { ReviewReturn } from './review-return-state.js';
export interface ReviewReturnRequest {
    taskId: string;
    title: string;
    leadMemberId: string;
    leadSessionId?: string;
    leadBindingGeneration?: number;
    leadStillCurrent?: () => Promise<boolean>;
    intent: ReviewReturn;
    round: ReviewRound;
    /** Recheck the attempt capability immediately before an external enqueue. */
    stillCurrent: () => Promise<boolean>;
}
export interface TeamTask {
    /** Prospective durable handoff only; historical reviews have no return intent. */
    reviewReturn?: ReviewReturn;
    id: string;
    teamId: string;
    title: string;
    kind: TaskKind;
    status: TaskStatus;
    assignee?: string;
    route?: TaskRoute;
    humanContact?: HumanContact;
    activeAttemptId?: string;
    latestSubmissionId?: string;
    acceptedSubmissionId?: string;
    acceptance: string[];
    roundLimit: number;
    createdBy: string;
    createdAt: number;
    updatedAt: number;
    revision: number;
    /** Set after lead acceptance; the authored document then lives under archive/. */
    archivedPath?: string;
    /** Latest review round, populated by list projections when reviews exist. */
    round?: number;
    /**
     * Tasks in this team that must be `completed` before this one may be claimed.
     * Immutable in B26: changing them is contract editing (B27).
     */
    dependsOn?: string[];
    /**
     * Workspace-relative globs this task may touch (B30). The lead declares them; two
     * writing tasks with intersecting declarations do not run at the same time, and a
     * submission records what actually changed outside them.
     */
    paths?: string[];
    /**
     * Bumped only when the *work itself* is restated — creation, a contract update, an
     * acceptance, a revision — never by claiming, acknowledging, submitting or revoking.
     * A mark left by a human intervention is resolved by exactly that (B31), so a
     * revocation cannot silently un-suppress a task whose contract nobody rewrote.
     */
    contractRevision?: number;
    /**
     * The authored narrative of the contract. It used to live only in the rendered
     * document, which made the record a partial copy of its own contract and made
     * editing impossible without losing it (B27).
     */
    why?: string;
    body?: string;
    checks?: string[];
    /** True only in list projections when this task's authored document is absent. */
    documentMissing?: boolean;
    [key: string]: unknown;
    /**
     * Written just before an integration moves the branch, cleared by the write that finishes the
     * acceptance. A process that dies in between leaves it behind, which is how the reconciler can tell
     * "the branch moved but the task was never completed" from "nothing happened" (review finding 1).
     */
    integrationPending?: {
        baseRef: string;
        headSha: string;
        baseTipSha: string;
        at: number;
        reportedAt?: number;
    };
    /**
     * A submission is in and nobody has decided on it: the lead or the human owes an accept or a
     * return. Kept as a fact on the task rather than derived from the status, because the status also
     * says `in_progress` after a return — and both the store and the panel read the status and
     * concluded there was nothing to decide while a submission sat on the table (found on a real
     * stand: the human had only "Release attempt" and the lead's accept was refused).
     */
    awaitsDecision?: boolean;
    /** Prospective notification intent; mailbox/command rows retain the delivery receipt. */
    submissionNoticeId?: string;
    /** Prospective existing lifecycle handoffs; delivery records live in the mailbox outbox. */
    lifecycleNotices?: LifecycleNoticeIntent[];
}
export interface TaskAttempt {
    id: string;
    taskId: string;
    memberId: string;
    sessionId: string;
    bindingGeneration: number;
    generation: number;
    /**
     * `revoking` is durable on purpose: the capability is already invalid and the
     * session has been asked to stop, but quiescence has not been observed yet. A
     * crash mid-transaction then leaves an honest record, not an active-looking
     * attempt (B28).
     */
    status: 'active' | 'revoking' | 'revoked' | 'completed' | 'failed';
    startedAt: number;
    /**
     * When a human wrote into this member's Session directly, mid-attempt (B31), and the
     * task revision at that moment. The mark stops automatic dispatch until the contract
     * is formally restated — an update, an acceptance or a revision bumps the task
     * revision above this value, which is what resolves it.
     */
    humanIntervenedAt?: number;
    humanIntervenedContractRevision?: number;
    /**
     * When the reconciler first noticed that this attempt is not moving: the assignment was never
     * acknowledged, or the member's Session went idle with the work unfinished (F3 of the live pilot).
     * Recorded on the attempt so the notice survives restarts and is written once, not every pass.
     * Nothing is revoked on the strength of it — silence is not death, it is something to show.
     */
    stalled?: {
        at: number;
        reason: 'unacknowledged' | 'idle';
        detail: string;
    };
    /**
     * Phase 6: the branch and tip this attempt was based on, recorded when it claimed the task.
     * It is the acceptance precondition — integration refuses if the base moved since.
     */
    gitBase?: {
        ref: string;
        baseTipSha: string;
    };
    revision: number;
}
export interface AttemptsState {
    schemaVersion: number;
    revision: number;
    teamId: string;
    attempts: TaskAttempt[];
    [key: string]: unknown;
}
export interface ClaimTaskRequest {
    taskId: string;
    memberId: string;
    sessionId: string;
    bindingGeneration: number;
}
export interface ClaimTaskResult {
    task: TeamTask;
    attempt: TaskAttempt;
}
export interface AcknowledgeTaskRequest {
    taskId: string;
    memberId: string;
    /** Required: the fence of ADR 0005 is checked against the binding the caller presents. */
    sessionId: string;
    bindingGeneration: number;
}
export interface TasksState {
    schemaVersion: number;
    revision: number;
    teamId: string;
    tasks: TeamTask[];
    [key: string]: unknown;
}
/**
 * A contract edit. An absent key means "leave it"; `null` clears a field that is
 * allowed to be empty. Only the lead may send one, and only while the task is
 * `draft` or `ready` — see the B27 contract.
 */
export interface UpdateTaskRequest {
    taskId: string;
    actor: string;
    expectedRevision?: number;
    title?: string;
    kind?: TaskKind;
    assignee?: string | null;
    route?: TaskRoute | null;
    acceptance?: readonly string[];
    checks?: readonly string[];
    why?: string;
    body?: string;
    roundLimit?: number;
    humanContact?: HumanContact;
    dependsOn?: readonly string[] | null;
    paths?: readonly string[] | null;
}
export type UpdateTaskResult = {
    readonly task: TeamTask;
    readonly document: string;
    readonly changed: readonly string[];
    readonly warnings?: readonly PathWarning[];
};
/**
 * Take work away from its current attempt (B28).
 *
 * `nextAssignee` moves ownership inside the same transaction; the contract is not
 * touched, and the new owner claims the task themselves — the only path that has
 * ever created an attempt.
 */
export interface RevokeTaskRequest {
    taskId: string;
    actor: string;
    reason: string;
    nextAssignee?: string;
    expectedRevision?: number;
}
export type RevokeTaskResult = {
    readonly task: TeamTask;
    readonly attempt: TaskAttempt;
    readonly quiesced: boolean;
    readonly reassigned: boolean;
};
export interface CreateTaskRequest {
    title: string;
    kind: TaskKind;
    assignee?: string;
    route?: TaskRoute;
    acceptance: readonly string[];
    humanContact?: HumanContact;
    checks?: readonly string[];
    why?: string;
    body?: string;
    roundLimit?: number;
    dependsOn?: readonly string[];
    paths?: readonly string[];
    actor: string;
    expectedRevision?: number;
}
export type SubmissionArtifact = {
    type: 'report';
    bodyRef: string;
    bodyDigest: string;
    /**
     * Where the frozen bytes live, relative to the team directory. The digest proves *what* was
     * submitted; this makes it possible to read it back after the workspace moved on — the author can
     * rewrite the file at `bodyRef` the moment after submitting, and a reviewer that reads the path
     * would see the new text while the digest still describes the old one.
     */
    blobPath?: string;
} | {
    type: 'files';
    paths: string[];
    manifestDigest: string;
    /** One frozen copy per path, in the same order as `paths`. */
    blobs?: {
        path: string;
        digest: string;
        blobPath: string;
    }[];
};
export type SubmissionSourceArtifact = {
    type: 'report';
    bodyRef: string;
} | {
    type: 'files';
    paths: string[];
};
export type SubmissionCheck = {
    command: string;
    status: 'passed' | 'failed';
    output?: string;
};
/**
 * What the declaration was worth at submission time (B30). `unchecked` is a
 * first-class outcome: an unobservable workspace must not read as a clean one.
 */
export interface SubmissionScope {
    declared: string[];
    changed?: string[];
    unexpected?: string[];
    /**
     * Paths outside this declaration that another *active* task was writing at the same
     * time. The first parallel run showed that in one shared tree this is what most
     * "unexpected" changes are: a colleague working on their own package, not an
     * intrusion into this one. The name says what was observed.
     */
    sharedTree?: string[];
    state: 'clean' | 'violation' | 'shared-tree' | 'unchecked';
    /**
     * Where this record's evidence came from (B32): `git` in a work tree, `files` in a folder
     * that is not a repository. The record keeps its shape either way; the mode says what the
     * evidence is worth.
     */
    mode?: 'git' | 'files';
    /** Why the workspace could not be observed, when `state` is `unchecked`. */
    reason?: 'no-repository' | 'too-many-files' | 'no-snapshot' | 'unreadable';
    /**
     * Phase 6: the paths that went into the submission's commit — exactly what the member
     * submitted. `changed` stays the working tree's own story, so an edit outside the declaration
     * is still visible even though the reviewed artifact is a commit.
     */
    committed?: string[];
}
/**
 * The Git half of a submission (ADR 0006): the commit the plugin built from the submitted paths,
 * the base it was built on, and the boundary of the reviewed diff.
 */
export interface SubmissionGit {
    baseRef: string;
    baseTipSha: string;
    /**
     * Set when the recorded claim-time base had already moved by the time the submission was frozen
     * and the movement could not touch the declared paths: the commit is parented on the base as it
     * was at freeze time, and this names the base the attempt actually started from.
     */
    rebasedFrom?: string;
    headSha: string;
    mergeBaseSha?: string;
    commitPaths: string[];
}
/** A path whose workspace content no longer matches what the submission froze. */
export interface SubmissionDrift {
    path: string;
    expected: string;
    /** `null` when the file is gone. */
    actual: string | null;
}
export interface Submission {
    id: string;
    taskId: string;
    attemptId: string;
    attemptGeneration: number;
    artifact: SubmissionArtifact;
    /**
     * Phase 6: the commit this submission is reviewed as. It belongs to the submission, not to an
     * artifact shape — a coding task that submits a report still has a diff to review.
     */
    git?: SubmissionGit;
    summary: string;
    checks: SubmissionCheck[];
    scope?: SubmissionScope;
    createdAt: number;
    revision: number;
}
export type ReviewFinding = {
    severity: 'low' | 'medium' | 'high' | 'blocker';
    problem: string;
    requiredFix: string;
    artifactLocation?: string;
};
export type ReviewVerdict = 'pass' | 'needs_revision' | 'escalate';
export interface ReviewRound {
    id: string;
    taskId: string;
    submissionId: string;
    reviewerMemberId: string;
    round: number;
    verdict: ReviewVerdict;
    findings: ReviewFinding[];
    evidence: SubmissionCheck[];
    createdAt: number;
    revision: number;
}
export interface SubmissionsState {
    schemaVersion: number;
    revision: number;
    teamId: string;
    submissions: Submission[];
    [key: string]: unknown;
}
export interface ReviewsState {
    schemaVersion: number;
    revision: number;
    teamId: string;
    rounds: ReviewRound[];
    [key: string]: unknown;
}
export interface SubmitTaskRequest {
    taskId: string;
    memberId: string;
    sessionId: string;
    bindingGeneration: number;
    artifact: SubmissionSourceArtifact;
    summary: string;
    checks: readonly SubmissionCheck[];
}
export interface AcceptTaskRequest {
    taskId: string;
    actor: string;
    note?: string;
}
export interface AcceptTaskResult {
    notifications?: SubmissionNotificationReceipt[];
    task: TeamTask;
    archivedPath: string;
}
export interface ReviseTaskRequest {
    taskId: string;
    actor: string;
    instructions: string;
}
export interface ReviseTaskResult {
    notifications?: SubmissionNotificationReceipt[];
    task: TeamTask;
}
export interface ReviewTaskRequest {
    taskId: string;
    submissionId: string;
    reviewerMemberId: string;
    verdict: ReviewVerdict;
    findings?: readonly ReviewFinding[];
    evidence?: readonly SubmissionCheck[];
}
export interface ReviewTaskResult {
    notifications?: SubmissionNotificationReceipt[];
    round: ReviewRound;
    task: TeamTask;
}
export interface ReadTaskResult {
    task: TeamTask;
    document: string;
    /**
     * Submissions as they were frozen, plus a drift note per submission: paths whose workspace content
     * no longer matches the frozen bytes. A reviewer that reads the workspace path would otherwise
     * judge text the digest does not describe.
     */
    submissions: (Submission & {
        drift?: SubmissionDrift[];
    })[];
    rounds: ReviewRound[];
    /**
     * Every attempt this task ever had, oldest first. A task sitting in `claimed` with an
     * attempt nobody acknowledged is the state a human most needs to see, and reading the
     * journal for it was the only way before B31.
     */
    attempts: TaskAttempt[];
}
export interface CreateTaskResult {
    task: TeamTask;
    documentPath: string;
    warnings?: readonly PathWarning[];
}
export interface ListTasksOptions {
    includeArchived?: boolean;
}
export type SubmissionNotificationReceipt = {
    recipient?: string;
    purpose: 'lead-acceptance' | 'review' | 'review-return' | 'review-return-lead' | LifecycleNoticeIntent['kind'];
    state: 'queued' | 'pending' | 'failed' | 'unavailable' | 'superseded';
    messageId?: string;
    requestId?: string;
    sessionId?: string;
    bindingGeneration?: number;
    reason?: string;
};
export type SubmissionNotificationRequest = {
    taskId: string;
    submissionId: string;
    assignee: string;
    summary: string;
    recipient: string;
    purpose: 'lead-acceptance' | 'review';
    sessionId: string;
    bindingGeneration: number;
    stillCurrent: () => Promise<boolean>;
};
type TaskStoreOptions = {
    deliverLifecycleNotice?: (request: LifecycleNoticeRequest) => Promise<SubmissionNotificationReceipt>;
    deliverSubmissionNotice?: (request: SubmissionNotificationRequest) => Promise<SubmissionNotificationReceipt>;
    workspacePath: string;
    teamId: string;
    appendAudit?: (event: unknown) => Promise<void>;
    deliverEscalation?: (request: {
        leadMemberId: string;
        taskId: string;
        submissionId: string;
        round: ReviewRound;
        reviewerMemberId: string;
        problem: string;
        tried: string;
    }) => Promise<void>;
    deliverClosing?: (request: {
        assignee: string;
        taskId: string;
        note?: string;
    }) => Promise<void>;
    /**
     * Tell the reviewer that a submission is waiting.
     *
     * Handing the submission over is the member's job by contract, and a member that forgets leaves the
     * work sitting: on a real stand one submission waited six and a half minutes for a human to notice,
     * while the member that did message its reviewer was accepted in thirty-one seconds. The route is
     * frozen in the task's contract once work starts, so this can only go where the lead sent it.
     */
    deliverReviewRequest?: (request: {
        reviewer: string;
        assignee: string;
        taskId: string;
        submissionId: string;
        summary: string;
    }) => Promise<void>;
    /**
     * Tell the assignee that the task was closed by hand.
     *
     * Closing ends the attempt, and a member whose Session is waiting for a next task is never told by
     * the state change alone: acceptance has always delivered a closing message, and closing needs the
     * same, with the reason.
     */
    deliverCancellation?: (request: {
        assignee: string;
        taskId: string;
        reason: string;
    }) => Promise<void>;
    deliverDirection?: (request: {
        assignee: string;
        taskId: string;
        instructions: string;
    }) => Promise<void>;
    deliverReviewReturn?: (request: ReviewReturnRequest) => Promise<{
        messageId: string;
        requestId: string;
        pending?: boolean;
    }>;
    observeReviewReturn?: (request: ReviewReturnRequest) => Promise<{
        state: 'pending' | 'started' | 'completed' | 'failed' | 'unobservable';
        turn?: number;
        inputSeq?: number;
        reason?: string;
    }>;
    notifyReviewReturn?: (request: ReviewReturnRequest) => Promise<SubmissionNotificationReceipt | void>;
    /**
     * Ask a Session to stop. Absent means the store cannot interrupt, and a
     * revocation then refuses rather than pretending the session was stopped.
     */
    interruptSession?: (sessionId: string, reason: string) => Promise<void>;
    /** Observe that a Session is no longer running. `false` means "not observed in time". */
    awaitQuiescence?: (sessionId: string, timeoutMs: number) => Promise<boolean>;
    quiescenceTimeoutMs?: number;
    /**
     * What changed in the workspace at submission time (B30). `undefined` means "not
     * observable" — no git, or not a repository — and is recorded as `unchecked`
     * rather than as a clean result. The store never shells out itself.
     */
    changedPaths?: (workspacePath: string) => Promise<readonly string[] | undefined>;
    /**
     * What the member committed since the attempt's base. Optional: without it the scope sees the
     * working tree only, which is the behaviour that refused a member who committed its work.
     */
    committedPaths?: (workspacePath: string, base: string) => Promise<readonly string[] | undefined>;
    /**
     * B32: which observation this workspace supports. Absent means the composition cannot
     * tell, and a scope record says `unchecked (unreadable)` rather than reading as clean.
     */
    workspaceMode?: (workspacePath: string) => Promise<'git' | 'files' | undefined>;
    /** Migration steps to use; the module's registry by default, injectable so a test can add one. */
    migrations?: Readonly<Record<number, Migration>>;
    /** B32: a cheap fingerprint of the tree, taken at claim and at submit in `files` mode. */
    snapshotTree?: (workspacePath: string) => Promise<Readonly<Record<string, string>> | undefined>;
    /**
     * Phase 6 (ADR 0006): Git plumbing, injected the same way the changed-paths port is. The store
     * never shells out itself. Absent means submissions carry no Git artifact — a workspace without
     * a repository, or a composition that does not offer one.
     */
    git?: {
        base: (workspacePath: string) => Promise<{
            ref: string;
            sha: string;
        } | undefined>;
        tip: (workspacePath: string, ref: string) => Promise<string | undefined>;
        commit: (workspacePath: string, base: {
            ref: string;
            sha: string;
        } | undefined, request: {
            paths: readonly string[];
            message: string;
            author: {
                name: string;
                email: string;
            };
        }) => Promise<{
            headSha: string;
            treeSha: string;
            commitPaths: readonly string[];
            mergeBaseSha?: string;
        } | undefined>;
        pin: (workspacePath: string, ref: string, sha: string) => Promise<boolean>;
        integrate: (workspacePath: string, ref: string, headSha: string, expectedTip: string | undefined, commitPaths?: readonly string[]) => Promise<'integrated' | 'stale' | 'index-failed'>;
        /** Paths changed between two commits, for deciding whether a moved base can be refreshed safely. */
        changedBetween: (workspacePath: string, fromSha: string, toSha: string) => Promise<readonly string[] | undefined>;
    };
};
/**
 * The dependencies that still stand between a task and its claim, in the order
 * the contract lists them. A dependency in a terminal non-completed state is
 * included on purpose: it blocks forever and the human must see that.
 */
export declare function blockedBy(task: Pick<TeamTask, 'dependsOn'>, tasks: readonly TeamTask[]): Array<{
    id: string;
    title: string;
    status: TaskStatus;
}>;
export declare function routeText(route: TaskRoute | undefined, team: TeamState): string;
export declare function assignmentRouteText(route: TaskRoute | undefined, team: TeamState): string;
export declare function deriveRouteContacts(task: TeamTask, team: TeamState): string[];
/**
 * Who a member may address, from one rule.
 *
 * Three places need this answer: the mailbox decides whether to deliver, the injected context tells
 * the member who it may talk to, and the panel shows the same list. Each had its own copy, and the
 * panel's was the narrowest — it showed the lead "contact with colleagues is not allowed" while the
 * mailbox was happily delivering the lead's messages to everyone (found on a real stand).
 *
 * The rule itself: the lead may address every member; anyone else may address the lead, whoever a
 * grant names, and whoever an active task's route opens — the same set the mailbox enforces.
 */
export declare function permittedContacts(state: TeamState, memberId: string, tasks: readonly TeamTask[]): string[];
export declare function routeAllowsContact(task: TeamTask, from: string, to: string, team: TeamState): boolean;
export declare function taskDocumentPath(workspacePath: string, teamId: string, taskId: string): string;
declare function renderDocument(task: TeamTask, team: TeamState, fields?: {
    why?: string;
    checks?: readonly string[];
    body?: string;
    tasks?: readonly TeamTask[];
}): string;
export declare class TaskStore {
    private readonly location;
    private readonly workspacePath;
    private readonly appendAudit;
    private readonly deliverEscalation?;
    private readonly deliverClosing?;
    private readonly deliverReviewRequest?;
    private readonly deliverSubmissionNotice?;
    private readonly deliverLifecycleNotice?;
    private lifecycleCursor;
    private submissionNoticeCursor;
    private readonly deliverCancellation?;
    private readonly deliverDirection?;
    private readonly deliverReviewReturn?;
    private readonly observeReviewReturn?;
    private readonly notifyReviewReturn?;
    private readonly reviewReturnRuns;
    private reviewReturnCursor;
    private readonly interruptSession?;
    private readonly awaitQuiescence?;
    private readonly quiescenceTimeoutMs;
    private readonly changedPaths;
    private readonly committedPaths;
    private readonly git;
    private readonly migrations;
    private readonly workspaceMode;
    private readonly snapshotTree;
    /** `null` means "no port": the answer is cached because a store lives with one workspace. */
    private resolvedMode;
    constructor(options: TaskStoreOptions);
    get filePath(): string;
    get directoryPath(): string;
    open(): Promise<TasksState>;
    listTasks(options?: ListTasksOptions | boolean): Promise<TeamTask[]>;
    readTask(taskId: string): Promise<ReadTaskResult>;
    readAttempts(): Promise<AttemptsState>;
    readSubmissions(): Promise<SubmissionsState>;
    readReviews(): Promise<ReviewsState>;
    private ownedTaskForMember;
    activeTaskForMember(memberId: string): Promise<TeamTask | undefined>;
    activeTaskForMemberSync(memberId: string): TeamTask | undefined;
    /**
     * The latest attempt of one task, read synchronously for context assembly: the member
     * has to know that a human wrote into its Session mid-flight (B31).
     */
    latestAttemptForTaskSync(taskId: string): TaskAttempt | undefined;
    /**
     * Every task, read synchronously for context assembly. The authorization gate
     * scans all tasks — a reviewer holds a path to a task it is not the assignee of —
     * so the line a member reads about where it may send has to see the same set.
     */
    listTasksSync(): TeamTask[];
    /**
     * Close attempts whose task has already ended (F5 of the first live run).
     *
     * Both acceptance paths are supposed to close the attempt, but "supposed to" is how
     * the member stayed busy forever: a stale active attempt blocks every later task for
     * that member and keeps the intervention observer watching a finished Session. This
     * heals the class rather than the instance — a task in a terminal status cannot have
     * work in flight.
     */
    closeTerminalAttempts(): Promise<{
        closed: {
            attemptId: string;
            taskId: string;
            memberId: string;
            status: 'completed' | 'failed';
        }[];
    }>;
    /**
     * Record that a human wrote into this member's Session mid-attempt (B31). Idempotent:
     * the first observation wins, and the task revision at that moment is stored so that a
     * later formal restatement of the contract resolves the mark without a second write.
     */
    markHumanIntervention(attemptId: string, at: number): Promise<{
        attempt: TaskAttempt;
        changed: boolean;
    }>;
    private contractRevisionLocked;
    submitTask(request: SubmitTaskRequest): Promise<{
        submission: Submission;
        notifications: SubmissionNotificationReceipt[];
    }>;
    private lifecycleSnapshot;
    isLifecycleNoticeCurrent(fence: LifecycleNoticeFence): Promise<boolean>;
    private processLifecycleNotification;
    processLifecycleNotifications(taskId: string, kind: LifecycleNoticeIntent['kind']): Promise<SubmissionNotificationReceipt[]>;
    recoverLifecycleNotifications(limit?: number): Promise<void>;
    requestReviewNotification(taskId: string, roundId: string, actor: string): Promise<SubmissionNotificationReceipt[]>;
    private submissionNotificationSnapshot;
    isSubmissionNotificationCurrent(taskId: string, submissionId: string, recipient: string, purpose: string, sessionId?: string, bindingGeneration?: number): Promise<boolean>;
    processSubmissionNotification(taskId: string): Promise<SubmissionNotificationReceipt[]>;
    /** Recovery is opt-in per immutable submission, not a historical broadcast. */
    recoverSubmissionNotifications(limit?: number): Promise<void>;
    /** Explicit Lead/human-authorized repair for one existing immutable submission. */
    requestSubmissionNotification(taskId: string, submissionId: string, actor: string): Promise<SubmissionNotificationReceipt[]>;
    acceptTask(request: AcceptTaskRequest): Promise<AcceptTaskResult>;
    /**
     * Close a task by hand, without a submission.
     *
     * The model always had a `cancelled` status and no way to reach it: accept needs a submission
     * awaiting a decision, and a task whose work was done by hand, dropped, or overtaken has none. On a
     * live stand a human closed three such tasks by editing their titles — the state never changed, and
     * the panel offered only "Edit contract" and "Release attempt", neither of which closes anything.
     */
    cancelTask(request: {
        taskId: string;
        actor: string;
        reason: string;
        expectedRevision?: number;
    }): Promise<{
        task: TeamTask;
        archivedPath?: string;
        quiesced: boolean;
        notifications?: SubmissionNotificationReceipt[];
    }>;
    reviseTask(request: ReviseTaskRequest): Promise<ReviseTaskResult>;
    reviewTask(request: ReviewTaskRequest): Promise<ReviewTaskResult>;
    isReviewReturnLeadCurrent(taskId: string, roundId: string, recipient: string, noticeClass: string | undefined, sessionId?: string, bindingGeneration?: number): Promise<boolean>;
    private reviewReturnNotifications;
    private reviewReturnBlockLocked;
    isReviewReturnCurrent(taskId: string, identity: Pick<ReviewReturn, 'roundId' | 'submissionId' | 'attemptId' | 'generation' | 'assignee' | 'sessionId' | 'bindingGeneration'>): Promise<boolean>;
    blockReviewReturn(taskId: string, identity: Pick<ReviewReturn, 'roundId' | 'submissionId' | 'attemptId' | 'generation' | 'assignee' | 'sessionId' | 'bindingGeneration'>, reason: 'human-intervened' | 'intervention-unobservable'): Promise<void>;
    recoverReviewReturns(limit?: number): Promise<void>;
    /** Recover only explicit prospective intents, never old terminal review records. */
    processReviewReturn(taskId: string): Promise<void>;
    private runReviewReturn;
    /**
     * What the declaration was worth at submission time. Only a writing task that
     * declared paths is checked: with nothing declared there is nothing to violate, and
     * an unobservable workspace is reported as `unchecked` rather than as clean (B30).
     */
    /**
     * Integrate a submission's commit into its base, refusing when the base moved.
     *
     * Nothing is checked out and nothing is merged: the working tree already holds the work, so
     * integration is one compare-and-swap ref update. `STALE_BASE` is a refusal — nothing is written,
     * and the decision has to be made again against the current base (ADR 0006).
     */
    private integrateSubmission;
    /**
     * Record the intent to integrate, and return the task as it now stands.
     *
     * `Locked` on purpose: the callers (both acceptance paths) already hold the team lock, and taking it
     * again deadlocks the process — which is exactly what the git suite reported, as a thirty-second
     * hang rather than a failure.
     */
    private writeIntegrationPendingLocked;
    /** Forget the intent: either the integration did not happen, or the caller is about to finish it. */
    private clearIntegrationPendingLocked;
    /**
     * Where an archived document lives. New records store the path relative to the team directory;
     * records written before that change hold an absolute path and are still honoured.
     */
    private archivedPathOf;
    /**
     * Record that an active attempt is not moving, once. Idempotent by design: a second call with the
     * same reason is a no-op, so the reconciler may call it on every pass without filling the journal.
     * Returns `true` when this call was the one that recorded it.
     */
    markAttemptStalled(request: {
        attemptId: string;
        reason: 'unacknowledged' | 'idle';
        detail: string;
        actor: string;
    }): Promise<boolean>;
    /**
     * Keep a copy of submitted bytes, addressed by their digest. Returns the path relative to the team
     * directory, or `undefined` when the copy could not be written — a submission is never refused for
     * this, but it is then read back from the workspace and the drift check says so.
     */
    private storeBlob;
    /** The frozen bytes of a submission artifact, or `undefined` when no copy was kept. */
    readBlob(blobPath: string): Promise<Buffer | undefined>;
    /**
     * Reconcile an integration that was interrupted: the marker is on the task, and the branch tells
     * the rest of the story. Reports once, and clears the marker only when nothing happened — a branch
     * that is already at the reviewed commit means the acceptance still has to be finished, and that is
     * a decision, not a cleanup.
     */
    reconcilePendingIntegrations(request: {
        tipOf: (ref: string) => Promise<string | undefined>;
        actor: string;
    }): Promise<{
        taskId: string;
        state: 'moved' | 'untouched' | 'elsewhere';
        detail: string;
    }[]>;
    /**
     * Bring every state file this store owns forward to the current schema version.
     *
     * Reading tolerates an older version, but nothing brought it forward: a field added later stayed
     * missing until something happened to write the file again, and no record said the state had been
     * read at an older version. A state from the future is refused with both versions named.
     *
     * The file is copied before it is rewritten, and the migration is recorded in the journal: a
     * migration is the one operation that changes history, and it should be possible to say when it
     * happened and to go back.
     */
    migrate(): Promise<{
        files: {
            file: string;
            from: number;
            to: number;
            backup: string;
        }[];
    }>;
    /** B32: resolved once per store; the answer cannot change while a store lives. */
    private mode;
    private snapshotPathFor;
    /** Take the fingerprint a `files`-mode submission will be compared against. */
    private takeSnapshot;
    /** Delete fingerprints whose attempt is no longer running: garbage, not evidence. */
    pruneSnapshots(): Promise<number>;
    private checkScope;
    private freezeArtifact;
    /**
     * Edit the contract of one task (B27).
     *
     * Only while nobody is working on it: an attempt is bound to the contract its
     * assignee is working from, and a human decision owns every later transition.
     */
    updateTask(request: UpdateTaskRequest): Promise<UpdateTaskResult>;
    claimTask(request: ClaimTaskRequest): Promise<ClaimTaskResult>;
    /**
     * Take work away from its current attempt (B28, ADR 0005).
     *
     * The order matters and is the contract: the capability is invalidated and made
     * durable *before* the session is asked to stop, so a session that keeps running
     * cannot write anything; and `revoked` is only ever reported once quiescence has
     * actually been observed. When it has not, the attempt stays `revoking` and the
     * task goes to the human rather than claiming a stop that did not happen.
     */
    revokeTask(request: RevokeTaskRequest): Promise<RevokeTaskResult>;
    /** Mark the settled outcome: revoked and re-owned, or escalated to the human. */
    private settleRevocation;
    /** Explicitly release parked work; no attempt is minted until the normal claim path runs. */
    resumeTask(request: {
        taskId: string;
        actor: string;
        expectedRevision?: number;
    }): Promise<{
        task: TeamTask;
    }>;
    acknowledgeTask(request: AcknowledgeTaskRequest): Promise<{
        task: TeamTask;
    }>;
    createTask(request: CreateTaskRequest): Promise<CreateTaskResult>;
    private get teamId();
    private documentPath;
    private readOrCreateLocked;
    private readTasksIfPresentLocked;
    private readAttemptsIfPresentLocked;
    private readSubmissionsIfPresentLocked;
    private readReviewsIfPresentLocked;
    private readTeamLocked;
    private validateCreate;
    /**
     * The one place the contract rules live, shared by creation (B19) and editing
     * (B27): a second copy of them is how the writer and the reader start to
     * disagree about what a valid contract is.
     */
    private validateContract;
}
export declare function createTaskStore(options: TaskStoreOptions): TaskStore;
export { renderDocument };
