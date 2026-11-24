import { type ReviewReturn } from '../review-return-state.js';
export type { ReviewReturn } from '../review-return-state.js';
export type TeamMember = {
    memberId: string;
    note?: string;
    displayName: string;
    role: string;
    availability: string;
    sessionId: string | null;
    live: boolean;
    status: 'idle' | 'running' | 'unknown';
    bindingGeneration: number;
    contractRevision: number;
    permittedContacts?: string[];
};
export type TeamSnapshot = {
    teamName?: string;
    leadMemberId?: string;
    teamId: string;
    workspacePath: string;
    revision: number;
    members: TeamMember[];
};
export type MessageKind = 'message' | 'direction' | 'comment';
export type TeamInboxMessage = {
    id: string;
    from: string;
    fromName: string;
    kind: MessageKind;
    content: string;
    createdAt: number;
    delivery: {
        id: string;
        state: 'stored' | 'acknowledged';
        acknowledgedAt?: number;
    };
};
export type TeamInbox = {
    teamId: string;
    messages: TeamInboxMessage[];
};
/**
 * One member who is waiting for the human. Small on purpose: the chip that shows
 * this lives in the Session header of every Session and must not pull the inbox.
 */
export type TeamAttentionEntry = {
    memberId: string;
    name: string;
    sessionId: string | null;
    waiting: number;
    since: number;
    kind: MessageKind;
};
export type TeamAttention = {
    teamId: string;
    attention: TeamAttentionEntry[];
};
export type JournalCategory = 'message' | 'delivery' | 'task' | 'review' | 'contact' | 'team' | 'member' | 'other';
export type TeamJournalEntry = {
    id: string;
    kind: string;
    category: JournalCategory;
    at: number;
    actor?: string;
    actorName?: string;
    summary: string;
    refs: {
        taskId?: string;
        taskTitle?: string;
        messageId?: string;
        round?: number; /** Everything the row knows, resolved for a person: who, to whom, which task, which attempt. */
        fields?: {
            label: string;
            value: string;
        }[];
        /** The summary split into plain and emphasised runs: names are names, not words. */
        summaryParts?: {
            text: string;
            strong?: boolean;
        }[];
    };
    detail?: string;
};
export type TeamJournal = {
    teamId: string;
    entries: TeamJournalEntry[];
};
export type SendMessageResult = {
    messageId: string;
    recipients: string[];
    deliveries: Array<{
        id: string;
        recipient: string;
        state: string;
        failure?: string;
    }>;
};
export type TeamCandidate = {
    sessionId: string;
    title: string | null;
    cwd: string;
    live: boolean;
    status: 'idle' | 'running' | 'unknown';
};
export type TeamCandidates = {
    teamId: string;
    /** Name the listed Sessions are titled with, so `"<member> - <team>"` can be undone. */
    teamName: string;
    workspacePath: string;
    revision: number;
    candidates: TeamCandidate[];
};
export type TeamAdoptionCandidate = {
    teamId: string;
    name?: string;
    memberCount?: number;
    updatedAt?: number;
    usable?: boolean;
    reason?: string;
};
export type TeamAdoptionCandidates = {
    teamId: string;
    workspacePath: string;
    candidates: TeamAdoptionCandidate[];
};
export type TeamRole = {
    id: string;
    name: string;
    description?: string;
    aliases: string[];
    source: 'global' | 'workspace';
    overridden: boolean;
};
export type TeamRoles = {
    roles: TeamRole[];
    globalDirectory: string;
    workspaceDirectory: string;
    workspaceDirectoryExists: boolean;
    openAvailable: boolean;
    globalOpenAvailable: boolean;
};
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
export type TaskRouteSummary = {
    type: 'report';
    to: string | 'human';
    toName?: string;
} | {
    type: 'review';
    reviewer: string;
    reviewerName?: string;
} | {
    type: 'interactive';
    then: TaskRouteSummary;
} | {
    type: 'custom';
    description: string;
};
export type TeamTask = {
    reviewReturn?: ReviewReturn;
    id: string;
    teamId: string;
    title: string;
    kind: string;
    status: TaskStatus;
    assignee?: string;
    route?: TaskRoute;
    humanContact?: 'none' | 'expected' | 'required';
    activeAttemptId?: string;
    latestSubmissionId?: string;
    acceptedSubmissionId?: string;
    acceptance: string[];
    /** Checks and declared paths are part of the contract the human edits. */
    checks?: string[];
    paths?: string[];
    roundLimit: number;
    createdBy: string;
    createdAt: number;
    updatedAt: number;
    revision: number;
    archivedPath?: string;
    documentMissing?: boolean;
};
export type TaskSummary = {
    reviewReturn?: ReviewReturn;
    id: string;
    title: string;
    status: TaskStatus;
    assignee?: string;
    assigneeName?: string;
    route?: TaskRouteSummary;
    round?: number;
    roundLimit?: number;
    updatedAt: number;
    archivedPath?: string;
    documentMissing?: boolean;
    dependsOn?: string[];
    blockedBy?: Array<{
        id: string;
        title: string;
        status: TaskStatus;
    }>;
    /** A submission is in and nobody has decided on it. */
    awaitsDecision?: boolean;
    /** Declared write paths, so the contract form can be filled without a second read. */
    paths?: string[];
    checks?: string[];
};
export type SubmissionArtifact = {
    type: 'report';
    bodyRef: string;
    bodyDigest: string;
} | {
    type: 'files';
    paths: string[];
    manifestDigest: string;
};
export type SubmissionCheck = {
    command: string;
    status: 'passed' | 'failed';
    output?: string;
};
export type TeamSubmissionScope = {
    declared?: string[];
    changed?: string[];
    unexpected?: string[];
    sharedTree?: string[];
    state: 'clean' | 'violation' | 'shared-tree' | 'unchecked';
    /** B32: `git` in a work tree, `files` in a folder that is not a repository. */
    mode?: 'git' | 'files';
    reason?: 'no-repository' | 'too-many-files' | 'no-snapshot' | 'unreadable';
};
export type Submission = {
    id: string;
    taskId: string;
    attemptId: string;
    attemptGeneration: number;
    artifact: SubmissionArtifact;
    summary: string;
    checks: SubmissionCheck[];
    scope?: TeamSubmissionScope;
    createdAt: number;
    revision: number;
};
export type ReviewFinding = {
    severity: 'low' | 'medium' | 'high' | 'blocker';
    problem: string;
    requiredFix: string;
    artifactLocation?: string;
};
export type ReviewRound = {
    id: string;
    taskId: string;
    submissionId: string;
    reviewerMemberId: string;
    round: number;
    verdict: 'pass' | 'needs_revision' | 'escalate';
    findings: ReviewFinding[];
    evidence: SubmissionCheck[];
    createdAt: number;
    revision: number;
};
export type TeamTasks = {
    teamId: string;
    tasks: TaskSummary[];
};
export type TeamAttemptStatus = 'active' | 'revoking' | 'revoked' | 'completed' | 'failed';
export type TeamTaskAttempt = {
    id: string;
    memberId: string;
    sessionId: string;
    generation: number;
    status: TeamAttemptStatus;
    startedAt: number;
    humanIntervenedAt?: number;
};
export type TeamTaskDetail = {
    task: TeamTask;
    document: string;
    documentMissing?: true;
    submissions: Submission[];
    rounds: ReviewRound[];
    attempts: TeamTaskAttempt[];
};
export type AcceptTaskResult = {
    task: TeamTask;
    archivedPath: string;
};
export type CancelTaskResult = {
    task: TeamTask;
    archivedPath?: string;
    quiesced: boolean;
};
export type PathWarning = {
    code: 'path-no-match' | 'path-scan-incomplete';
    pattern: string;
    message: string;
};
export type ReviseTaskResult = {
    task: TeamTask;
};
/** The workspace folder action only exists after override created its folder. */
export declare function canOpenWorkspaceRoles(roles: Pick<TeamRoles, 'openAvailable' | 'workspaceDirectoryExists'>): boolean;
export type CreateSessionSuccess = {
    teamId: string;
    memberId: string;
    sessionId: string;
    revision: number;
    applied: true;
    retried: boolean;
    member: TeamMember;
};
export type MutationSuccess = {
    teamId: string;
    memberId: string;
    revision: number;
    applied: true;
    retried: boolean;
    member: TeamMember;
};
export type InterruptTurnSuccess = {
    memberId: string;
    interrupted: true;
    status: 'idle' | 'running' | 'unknown';
};
export type RemoveMemberSuccess = {
    teamId: string;
    memberId: string;
    revision: number;
    applied: true;
    retried: boolean;
    removed: {
        memberId: string;
        displayName: string;
        role: string;
        sessionId: string | null;
    };
};
export type MutationConflict = {
    revision: number;
    members: TeamMember[];
};
export declare class LiveTeamsApiError extends Error {
    readonly status: number;
    readonly error: string;
    readonly conflict: MutationConflict | null;
    constructor(status: number, error: string, conflict?: MutationConflict | null);
}
export type TeamStateStatus = {
    enabled: boolean;
    briefing?: string;
    openAvailable?: boolean;
    teamId: string;
    teamName: string;
    workspacePath: string;
    revision?: number;
    memberCount?: number;
    compatibility?: {
        verdict: 'compatible' | 'degraded' | 'incompatible';
        hostVersion?: string;
        missing: string[];
        absent: string[];
        detail: string;
    };
};
export declare function fetchTeamState(session?: string, signal?: AbortSignal): Promise<TeamStateStatus>;
export declare function enableTeam(name?: string, session?: string, createNew?: boolean): Promise<TeamStateStatus>;
export declare function disableTeam(session?: string): Promise<TeamStateStatus>;
export declare function renameTeam(name: string, expectedRevision: number, session?: string): Promise<TeamStateStatus>;
export declare function fetchTeamTasks(session?: string, includeArchived?: boolean, signal?: AbortSignal): Promise<TeamTasks>;
/** One task's dispatch verdict, in the same words the journal uses (B29). */
export type DispatchTaskVerdict = {
    taskId: string;
    title: string;
    status: string;
    assignee?: string;
    decision: 'assign' | 'active' | 'wait' | 'refused';
    reason: string;
    detail: string;
    warning?: string;
    /** F3: this attempt has been silent long enough to show. Detection only, never an auto-revoke. */
    stalled?: {
        at: number;
        reason: 'unacknowledged' | 'idle';
        detail: string;
    };
};
export type TeamDispatch = {
    teamId: string;
    paused: boolean;
    coding: 'manual' | 'automatic';
    pausedBy?: string;
    pausedReason?: string;
    counts: Record<'assign' | 'active' | 'wait' | 'refused', number>;
    tasks: DispatchTaskVerdict[];
};
export declare function fetchTeamDispatch(session?: string, signal?: AbortSignal): Promise<TeamDispatch>;
/** Only the human and the lead may flip this; the server decides which one the caller is. */
export declare function setTeamDispatch(mode: 'auto' | 'paused', reason?: string, session?: string): Promise<{
    from: string;
    to: string;
}>;
/**
 * Rotation limits in force for this team.
 *
 * `source` says whether the panel's overrides or the deployment row decide, so the card can show
 * "from profile" without pretending the numbers were chosen here.
 */
export type TeamRotation = {
    enabled: boolean;
    maxContextTokens: number;
    maxCompletedTasks: number;
    cooldownMs: number;
    maxRotationsPerPass: number;
    source: 'team' | 'profile';
    revision: number;
};
export declare function fetchTeamRotation(session?: string, signal?: AbortSignal): Promise<TeamRotation>;
/** The human's own surface, like dispatch: the host commits under the revision it was shown. */
export declare function setTeamRotation(request: {
    enabled?: boolean;
    maxContextTokens?: number;
    maxCompletedTasks?: number;
    expectedRevision: number;
}, session?: string): Promise<TeamRotation>;
export declare function fetchTeamTask(taskId: string, session?: string, signal?: AbortSignal): Promise<TeamTaskDetail>;
export declare function acceptTeamTask(taskId: string, note?: string, session?: string): Promise<AcceptTaskResult>;
/**
 * Close a task by hand, without a submission.
 *
 * Accept needs a submission awaiting a decision; a task whose work was done by hand, dropped, or
 * overtaken has none, and the panel offered no way to close it.
 */
export declare function cancelTeamTask(taskId: string, reason: string, session?: string): Promise<CancelTaskResult>;
export declare function resumeTeamTask(taskId: string, session?: string): Promise<ReviseTaskResult>;
export declare function reviseTeamTask(taskId: string, instructions: string, session?: string): Promise<ReviseTaskResult>;
export declare function fetchTeamRoles(session?: string, signal?: AbortSignal): Promise<TeamRoles>;
export declare function openTeamRoles(kind: 'global' | 'workspace', id?: string, session?: string): Promise<string>;
export declare function overrideTeamRole(id: string, session?: string): Promise<{
    id: string;
    path: string;
}>;
export declare function fetchTeamAdoptionCandidates(session?: string, signal?: AbortSignal): Promise<TeamAdoptionCandidates>;
export declare function adoptTeam(teamId: string, replaceEmptyDerived: boolean, session?: string): Promise<TeamStateStatus & {
    adoptedFrom: string;
}>;
export declare function fetchTeamCandidates(session?: string, signal?: AbortSignal): Promise<TeamCandidates>;
export declare function fetchTeamInbox(session?: string, limit?: number, signal?: AbortSignal): Promise<TeamInbox>;
/** Who is waiting for the human, one entry per member. Polled by the header chip. */
export declare function fetchTeamAttention(session?: string, signal?: AbortSignal): Promise<TeamAttention>;
/**
 * Clear a whole member's backlog in one request. The chip opens the Session the
 * human was taken to, so acknowledging 22 rows one by one would be busywork.
 */
export declare function acknowledgeTeamMessages(messageIds: readonly string[], session?: string): Promise<{
    messageIds: string[];
}>;
export declare function fetchTeamJournal(session?: string, limit?: number, signal?: AbortSignal): Promise<TeamJournal>;
export declare function sendTeamMessage(request: {
    to: string;
    kind: MessageKind;
    content: string;
    threadId?: string;
}, session?: string): Promise<SendMessageResult>;
export declare function acknowledgeTeamMessage(messageId: string, session?: string): Promise<{
    messageId: string;
    state: 'acknowledged';
}>;
export type TeamLead = {
    leadMemberId?: string;
    resolvedFrom: 'state' | 'role' | 'none';
};
export declare function openTeamBriefing(session?: string): Promise<string>;
export declare function fetchTeamLead(session?: string): Promise<TeamLead>;
export declare function setTeamLead(memberId: string, session?: string): Promise<{
    leadMemberId: string;
}>;
export declare function fetchTeamSnapshot(session?: string, signal?: AbortSignal): Promise<TeamSnapshot>;
export declare function changeMemberRole(memberId: string, role: string, expectedRevision: number, session?: string): Promise<MutationSuccess>;
export declare function changeMemberAvailability(memberId: string, availability: 'available' | 'paused', expectedRevision: number, session?: string): Promise<MutationSuccess>;
export declare function changeMemberDisplayName(memberId: string, displayName: string, expectedRevision: number, session?: string): Promise<MutationSuccess>;
/**
 * The body's `sessionId` names the Session that JOINS, so the request scope travels
 * in the query instead. Passing it through `withSession` overwrote the joining
 * Session with the caller's, and the server refused it as already a member.
 */
/**
 * The human's own control over work (review finding 4): the same operations the lead's tools call.
 * The panel used to read tasks, accept them and send them back — creating one, changing a contract or
 * releasing a held attempt meant asking the lead and waiting a model turn.
 */
export type TaskControlDraft = {
    title: string;
    kind: string;
    assignee: string;
    acceptance: string[];
    paths?: string[];
    checks?: string[];
    body?: string;
    why?: string;
    route?: {
        type: string;
        to?: string;
        reviewer?: string;
    };
    roundLimit?: number;
};
export declare function createTeamTask(draft: TaskControlDraft, session?: string): Promise<{
    task: TeamTask;
    documentPath: string;
    warnings: PathWarning[];
}>;
export declare function updateTeamTask(request: {
    taskId: string;
    acceptance?: string[];
    paths?: string[];
    checks?: string[];
    title?: string;
    assignee?: string;
    body?: string;
    expectedRevision?: number;
}, session?: string): Promise<{
    task: TeamTask;
    document: string;
    changed: string[];
    warnings: PathWarning[];
}>;
export declare function revokeTeamTask(request: {
    taskId: string;
    reason: string;
}, session?: string): Promise<{
    task: TeamTask;
    attempt: TeamTaskAttempt;
    quiesced: boolean;
    reassigned: boolean;
}>;
export declare function addTeamMember(request: {
    sessionId: string;
    displayName: string;
    role: string;
    memberId?: string;
    expectedRevision: number;
}, session?: string): Promise<MutationSuccess>;
export declare function createTeamSessionMember(request: {
    displayName: string;
    role: string;
    expectedRevision: number;
}, session?: string): Promise<CreateSessionSuccess>;
export declare function interruptTeamMember(memberId: string, session?: string): Promise<InterruptTurnSuccess>;
export type ContactGrant = {
    from: string;
    to: string;
    grantedBy: string;
    at: number;
};
export type ContactGrantResult = {
    grants: ContactGrant[];
    leadMemberId?: string;
};
export declare function grantTeamContact(request: {
    memberId: string;
    allow: string;
    action: 'add' | 'remove';
}, session?: string): Promise<ContactGrantResult>;
export declare function removeTeamMember(memberId: string, expectedRevision: number, session?: string): Promise<RemoveMemberSuccess>;
