import { MemberRecord, TeamState } from "./team-store.js";
import { SessionDescriptor } from "./session-bridge.js";
import { RoleRegistry } from "./roles.js";
import { MailboxService, MessageDelivery, MessageKind, TeamMessage } from "./mailbox.js";
import { ReadTaskResult, TaskStore, TeamTask } from "./task-store.js";
import { DispatchEvaluation } from "./dispatch.js";
export declare const LIVE_TEAMS_MEMBERS_ROUTE = "/api/live-teams/members";
export declare const LIVE_TEAMS_CANDIDATES_ROUTE = "/api/live-teams/candidates";
export declare const LIVE_TEAMS_MEMBER_ROLE_ROUTE = "/api/live-teams/members/role";
export declare const LIVE_TEAMS_MEMBER_AVAILABILITY_ROUTE = "/api/live-teams/members/availability";
export declare const LIVE_TEAMS_MEMBER_NAME_ROUTE = "/api/live-teams/members/name";
export declare const LIVE_TEAMS_MEMBER_REMOVE_ROUTE = "/api/live-teams/members/remove";
export declare const LIVE_TEAMS_MEMBER_CREATE_SESSION_ROUTE = "/api/live-teams/members/create-session";
export declare const LIVE_TEAMS_MEMBER_INTERRUPT_ROUTE = "/api/live-teams/member/interrupt";
export declare const LIVE_TEAMS_ROLES_ROUTE = "/api/live-teams/roles";
export declare const LIVE_TEAMS_ROLES_OPEN_ROUTE = "/api/live-teams/roles/open";
export declare const LIVE_TEAMS_ROLES_OVERRIDE_ROUTE = "/api/live-teams/roles/override";
export declare const LIVE_TEAMS_TEAM_ROUTE = "/api/live-teams/team";
export declare const LIVE_TEAMS_TEAM_ENABLE_ROUTE = "/api/live-teams/team/enable";
export declare const LIVE_TEAMS_TEAM_DISABLE_ROUTE = "/api/live-teams/team/disable";
export declare const LIVE_TEAMS_TEAM_NAME_ROUTE = "/api/live-teams/team/name";
export declare const LIVE_TEAMS_TEAM_CANDIDATES_ROUTE = "/api/live-teams/team/candidates";
export declare const LIVE_TEAMS_TEAM_ADOPT_ROUTE = "/api/live-teams/team/adopt";
export declare const LIVE_TEAMS_MESSAGES_ROUTE = "/api/live-teams/messages";
export declare const LIVE_TEAMS_ATTENTION_ROUTE = "/api/live-teams/attention";
export declare const LIVE_TEAMS_MESSAGES_ACKNOWLEDGE_ROUTE = "/api/live-teams/messages/acknowledge";
export declare const LIVE_TEAMS_JOURNAL_ROUTE = "/api/live-teams/journal";
export declare const LIVE_TEAMS_TEAM_LEAD_ROUTE = "/api/live-teams/team/lead";
export declare const LIVE_TEAMS_TEAM_BRIEFING_OPEN_ROUTE = "/api/live-teams/team/briefing/open";
export declare const LIVE_TEAMS_MEMBER_GRANT_ROUTE = "/api/live-teams/member/grant";
export declare const LIVE_TEAMS_DISPATCH_ROUTE = "/api/live-teams/dispatch";
export declare const LIVE_TEAMS_TEAM_ROTATION_ROUTE = "/api/live-teams/team/rotation";
export declare const LIVE_TEAMS_TASKS_ROUTE = "/api/live-teams/tasks";
export declare const LIVE_TEAMS_TASK_ROUTE = "/api/live-teams/task";
export declare const LIVE_TEAMS_TASK_ACCEPT_ROUTE = "/api/live-teams/task/accept";
export declare const LIVE_TEAMS_TASK_NOTIFY_SUBMISSION_ROUTE = "/api/live-teams/task/notify-submission";
export declare const LIVE_TEAMS_TASK_NOTIFY_REVIEW_ROUTE = "/api/live-teams/task/notify-review";
export declare const LIVE_TEAMS_TASK_REVISE_ROUTE = "/api/live-teams/task/revise";
export declare const LIVE_TEAMS_TASK_CANCEL_ROUTE = "/api/live-teams/task/cancel";
export declare const LIVE_TEAMS_TASK_RESUME_ROUTE = "/api/live-teams/task/resume";
/** The human's own control over work: create it, change its contract, release a held attempt. */
export declare const LIVE_TEAMS_TASK_CREATE_ROUTE = "/api/live-teams/task/create";
export declare const LIVE_TEAMS_TASK_UPDATE_ROUTE = "/api/live-teams/task/update";
export declare const LIVE_TEAMS_TASK_REVOKE_ROUTE = "/api/live-teams/task/revoke";
type HeaderValue = string | readonly string[] | undefined;
type RequestHeaders = Record<string, HeaderValue>;
type BodyValue = string | Uint8Array | AsyncIterable<Uint8Array | string>;
export type LiveTeamsRequest = {
  readonly method?: string;
  readonly headers: RequestHeaders;
  readonly socket: {
    readonly remoteAddress?: string;
  };
  readonly url?: string;
  readonly body?: BodyValue;
};
export type LiveTeamsResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
};
type ExactRoute = {
  kind: 'exact';
  path: string;
  handler: (request: LiveTeamsRequest, response: LiveTeamsResponse) => void | Promise<void>;
};
export type LiveTeamsWebServer = {
  readonly port: number;
  register(route: ExactRoute): () => void;
};
export type LiveTeamsRouteContext = {
  readonly webServer: LiveTeamsWebServer;
};
/** The registry is deliberately queried only for the bound Session's liveness. */
export type LiveAgentRegistry = {
  get(sessionId: string): unknown;
};
export type LiveTeamsMutation = {
  readonly kind: 'role' | 'availability' | 'name';
  readonly memberId: string;
  readonly value: string;
  readonly expectedRevision: number;
};
export type LiveTeamsRemoveMemberRequest = {
  readonly memberId: string;
  readonly expectedRevision: number;
};
export type LiveTeamsRemoveMemberResult = {
  readonly state: TeamState;
  readonly removed: MemberRecord;
};
export type LiveTeamsTitleResult = LiveTeamsSessionTitleResult;
export type LiveTeamsMutationResult = {
  readonly state: TeamState;
  readonly member: MemberRecord;
  readonly from: string;
  readonly to: string;
  readonly sessionTitle?: LiveTeamsTitleResult;
};
export type LiveTeamsCreateMemberRequest = {
  readonly sessionId: string;
  readonly displayName: string;
  readonly role: string;
  readonly memberId?: string;
  readonly expectedRevision: number;
};
export type LiveTeamsSessionTitleResult = {
  readonly from: string | null;
  readonly to: string;
  readonly reason: 'member-added' | 'member-renamed';
  readonly renamed: boolean;
};
export type LiveTeamsCreateMemberResult = {
  readonly state: TeamState;
  readonly member: MemberRecord;
  readonly sessionTitle?: LiveTeamsSessionTitleResult;
};
export type LiveTeamsCreateSessionMemberRequest = {
  readonly sessionId: string;
  readonly displayName: string;
  readonly role: string;
  readonly expectedRevision: number;
};
export type LiveTeamsCreateSessionMemberResult = {
  readonly state: TeamState;
  readonly member: MemberRecord;
  readonly sessionTitle?: LiveTeamsSessionTitleResult;
};
export type LiveTeamsCandidate = {
  readonly sessionId: string;
  readonly title: string | null;
  readonly cwd: string;
  readonly live: boolean;
  readonly status: 'idle' | 'running' | 'unknown';
};
export type LiveTeamsJournalCategory = 'message' | 'delivery' | 'task' | 'review' | 'contact' | 'team' | 'member' | 'other';
export type JournalCategory = LiveTeamsJournalCategory;
export type JournalRefs = {
  readonly taskId?: string;
  readonly taskTitle?: string;
  readonly messageId?: string;
  readonly round?: number;
};
export type LiveTeamsJournalEntry = {
  readonly id: string;
  readonly kind: string;
  readonly category: LiveTeamsJournalCategory;
  readonly at: number;
  readonly actor?: string;
  readonly actorName?: string;
  readonly summary: string;
  readonly refs: JournalRefs;
  readonly detail?: string;
  /**
   * Everything the row knows, resolved for a person: who, to whom, which task, which attempt.
   * The summary is one line; this is what the row unfolds into.
   */
  fields?: {
    label: string;
    value: string;
  }[];
  /**
   * The summary split into plain and emphasised runs. The server knows exactly which words are
   * people's names, so the panel does not have to guess them back out of a sentence.
   */
  summaryParts?: {
    text: string;
    strong?: boolean;
  }[];
};
export type JournalEntry = LiveTeamsJournalEntry;
export type LiveTeamsJournal = {
  readonly teamId: string;
  readonly entries: LiveTeamsJournalEntry[];
};
export type LiveTeamsAuditRecord = {
  readonly kind: 'briefing/updated';
  readonly actor: string;
  readonly length: number;
  readonly at: number;
} | {
  readonly kind: 'member/note';
  readonly memberId: string;
  readonly note: string;
  readonly actor: string;
  readonly at: number;
} | {
  readonly kind: 'team/lead';
  readonly memberId: string;
  readonly actor: MutationActor;
  readonly at: number;
} | {
  /** The lead name was cleared; there is no member to name. */
  readonly kind: 'team/lead-cleared';
  readonly actor: MutationActor;
  readonly at: number;
} | {
  readonly kind: 'member/interrupted';
  readonly memberId: string;
  readonly sessionId: string;
  readonly actor: MutationActor;
  readonly at: number;
} | {
  /**
   * The host refused to interrupt — the member was idle, unbound, or the interrupt failed.
   * Recorded because an operator action that changes nothing is still an operator action,
   * and without this the panel's "nothing happened" is indistinguishable from a lost click
   * (F18 of the third live run).
   */
  readonly kind: 'member/interrupt-refused';
  readonly memberId: string;
  readonly sessionId?: string;
  readonly reason: string;
  readonly actor: MutationActor;
  readonly at: number;
} | {
  readonly kind: 'team/adopted';
  readonly teamId: string;
  readonly fromTeamId: string;
  readonly name: string;
  readonly memberCount: number;
  readonly at: number;
  readonly actor: MutationActor;
} | {
  readonly kind: 'member/role-changed' | 'member/availability-changed' | 'member/name-changed';
  readonly memberId: string;
  readonly from: string;
  readonly to: string;
  readonly at: number;
  readonly actor: MutationActor;
  readonly expectedRevision: number;
  readonly appliedRevision: number;
} | {
  readonly kind: 'member/added';
  readonly memberId: string;
  readonly sessionId: string;
  readonly displayName: string;
  readonly role: string;
  readonly at: number;
  readonly actor: MutationActor;
  readonly expectedRevision: number;
  readonly appliedRevision: number;
} | {
  readonly kind: 'member/removed';
  readonly memberId: string;
  readonly displayName: string;
  readonly role: string;
  readonly sessionId: string | null;
  readonly at: number;
  readonly actor: MutationActor;
  readonly expectedRevision: number;
  readonly appliedRevision: number;
} | {
  readonly kind: 'session/titled';
  readonly sessionId: string;
  readonly from: string | null;
  readonly to: string;
  readonly reason: 'member-added' | 'member-renamed';
  readonly at: number;
  readonly actor: MutationActor;
} | {
  readonly kind: 'team/enabled' | 'team/disabled';
  readonly teamId: string;
  readonly name?: string;
  readonly at: number;
  readonly actor: MutationActor;
} | {
  readonly kind: 'team/renamed';
  readonly teamId: string;
  readonly from: string;
  readonly to: string;
  readonly at: number;
  readonly actor: MutationActor;
};
export type LiveTeamsRoleSummary = {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly aliases: string[];
  readonly source: 'global' | 'workspace';
  readonly overridden: boolean;
};
export type LiveTeamsRoles = {
  readonly roles: LiveTeamsRoleSummary[];
  readonly globalDirectory: string;
  readonly workspaceDirectory: string;
  readonly workspaceDirectoryExists: boolean;
  readonly openAvailable: boolean;
  readonly globalOpenAvailable: boolean;
};
export type LiveTeamsRoleOpenRequest = {
  readonly scope: 'global' | 'workspace';
  readonly id?: string;
};
export type LiveTeamsTeamStatus = {
  readonly enabled: boolean;
  /** What the plugin found when it asked the host for the surfaces it calls. */
  readonly compatibility?: {
    readonly verdict: 'compatible' | 'degraded' | 'incompatible';
    readonly hostVersion?: string;
    readonly missing: readonly string[];
    readonly absent: readonly string[];
    readonly detail: string;
  };
  readonly briefing?: string;
  readonly openAvailable?: boolean;
  readonly teamId: string;
  readonly teamName: string;
  readonly workspacePath: string;
  readonly revision?: number;
  readonly memberCount: number;
};
export type LiveTeamsAdoptionCandidate = {
  readonly teamId: string;
  readonly name?: string;
  readonly memberCount?: number;
  readonly updatedAt?: number;
  readonly usable?: boolean;
  readonly reason?: string;
};
export type LiveTeamsTeamCandidates = {
  readonly teamId: string;
  readonly workspacePath: string;
  readonly candidates: readonly LiveTeamsAdoptionCandidate[];
};
export type LiveTeamsTaskRouteSummary = {
  readonly type: 'report';
  readonly to: string | 'human';
  readonly toName?: string;
} | {
  readonly type: 'review';
  readonly reviewer: string;
  readonly reviewerName?: string;
} | {
  readonly type: 'interactive';
  readonly then: LiveTeamsTaskRouteSummary;
} | {
  readonly type: 'custom';
  readonly description: string;
};
export type LiveTeamsTaskSummary = {
  readonly reviewReturn?: NonNullable<TeamTask['reviewReturn']>;
  readonly id: string;
  readonly title: string;
  readonly status: TeamTask['status'];
  /** A submission is in and nobody has decided on it: the lead or the human owes an accept or a return. */
  readonly awaitsDecision?: boolean;
  readonly assignee?: string;
  readonly assigneeName?: string;
  readonly route?: LiveTeamsTaskRouteSummary;
  readonly round?: number;
  readonly roundLimit?: number;
  readonly updatedAt: number;
  readonly archivedPath?: string;
  readonly documentMissing?: true;
  readonly dependsOn?: readonly string[];
  /**
   * Dependencies that are not `completed`, in contract order. A client must be
   * able to tell a claimable task from a blocked one without joining two lists,
   * and a dependency that died is included on purpose: it blocks forever.
   */
  readonly blockedBy?: readonly LiveTeamsTaskBlocker[];
};
export type LiveTeamsTaskBlocker = {
  readonly id: string;
  readonly title: string;
  readonly status: TeamTask['status'];
};
/**
 * The dispatch projection: for every task, the decision the reconciler would take
 * and the reason for it, in the same words the journal uses. One source answers
 * both the lead's question ("why is this not running?") and the panel's chip.
 */
export type LiveTeamsDispatch = {
  readonly teamId: string;
  readonly paused: boolean;
  /** `manual` means coding work is never started automatically (design §22, Gate C). */
  readonly coding: 'manual' | 'automatic';
  readonly pausedBy?: string;
  readonly pausedReason?: string;
  readonly counts: Record<'assign' | 'active' | 'wait' | 'refused', number>;
  readonly tasks: readonly DispatchEvaluation[];
};
export type LiveTeamsTasks = {
  readonly teamId: string;
  readonly tasks: LiveTeamsTaskSummary[];
};
export type LiveTeamsTaskDetail = ReadTaskResult & {
  readonly documentMissing?: true;
};
export type LiveTeamsRouteOptions = {
  /** Resolve a request to the workspace/team context. Undefined means invalid request. */
  readonly resolveRequest?: (request: LiveTeamsRequest, sessionId?: string) => Promise<LiveTeamsRouteOptions | undefined>;
  /** Read lifecycle state without creating a team. */
  readonly teamStatus?: () => Promise<LiveTeamsTeamStatus>;
  readonly enableTeam?: (name?: string, createNew?: boolean) => Promise<LiveTeamsTeamStatus>;
  readonly disableTeam?: () => Promise<LiveTeamsTeamStatus>;
  readonly renameTeam?: (name: string, expectedRevision: number) => Promise<{
    status: LiveTeamsTeamStatus;
    from: string;
  }>;
  readonly requestSessionId?: string;
  readonly teamEnabled?: () => Promise<boolean>;
  readonly teamId: string;
  /** Human-readable team name shown in the interface; falls back to the id. */
  readonly teamName?: string;
  readonly workspacePath: string;
  readonly agents?: LiveAgentRegistry;
  /** Read the current state without creating or mutating it. Runtime shape is validated here. */
  readonly readState?: () => Promise<unknown>;
  /** Apply one compare-and-set mutation. A REVISION_CONFLICT result is retried once. */
  readonly applyMutation?: (request: LiveTeamsMutation) => Promise<LiveTeamsMutationResult>;
  /** Discover cold-readable Sessions; the route applies workspace and ownership filtering. */
  readonly listCandidates?: () => Promise<readonly SessionDescriptor[]>;
  /** Create one member after the provider has performed the workspace guard. */
  readonly createMember?: (request: LiveTeamsCreateMemberRequest) => Promise<LiveTeamsCreateMemberResult>;
  /** Create and bind a new Session-backed member in the team's workspace. */
  readonly createSessionMember?: (request: LiveTeamsCreateSessionMemberRequest) => Promise<LiveTeamsCreateSessionMemberResult>;
  /** Resolve whether the team's canonical workspace is registered in DSH. */
  readonly workspaceRegistered?: () => boolean | Promise<boolean>;
  /** Remove one member record without touching its Session. */
  readonly removeMember?: (request: LiveTeamsRemoveMemberRequest) => Promise<LiveTeamsRemoveMemberResult>;
  /** Append the audit record before a successful mutation is reported to the caller. */
  readonly appendAudit?: (event: LiveTeamsAuditRecord) => Promise<void>;
  /** Read the existing append-only audit; this route never writes to it. */
  readonly readEvents?: (after?: number) => Promise<{
    events: readonly unknown[];
    torn: string | null;
    nextOffset?: number;
    truncated?: boolean;
  }>;
  /** Cancel one currently-running member turn through the existing Session bridge. */
  readonly interrupt?: (sessionId: string, reason: string) => Promise<{
    accepted: true;
  }>;
  /** Discover legacy team directories for adoption. */
  readonly listTeamCandidates?: () => Promise<readonly LiveTeamsAdoptionCandidate[]>;
  /** Adopt a legacy team into this workspace's derived id. */
  readonly adoptTeam?: (teamId: string, replaceEmptyDerived: boolean) => Promise<{
    status: LiveTeamsTeamStatus;
    adoptedFrom: string;
  }>;
  /** Apply a Session title after membership state commits. */
  readonly titleSession?: (request: {
    sessionId: string;
    displayName: string;
    reason: 'member-added' | 'member-renamed';
    previousTitle?: string;
  }) => Promise<LiveTeamsSessionTitleResult | undefined>;
  /** Report best-effort title/audit failures without changing membership success. */
  readonly logger?: {
    warn?: (message: string) => void;
  };
  readonly roles?: RoleRegistry;
  readonly readRoles?: () => Promise<RoleRegistry>;
  readonly roleRegistry?: () => Promise<RoleRegistry>;
  readonly canOpenWorkspacePath?: () => boolean | Promise<boolean>;
  readonly openWorkspacePath?: (request: {
    path: string;
    action: 'reveal' | 'open';
  }, signal: AbortSignal) => Promise<unknown>;
  readonly copyRoleOverride?: (id: string) => Promise<{
    id: string;
    path: string;
  }>;
  /** Human-facing mailbox for the bound team. */
  readonly mailbox?: MailboxService;
  /** The host-compatibility verdict, so the panel can say why the team is off. */
  readonly compatibility?: () => LiveTeamsTeamStatus['compatibility'];
  /** Durable B19-B22 task store for the human task surface. */
  readonly taskStore?: TaskStore;
  /** `undefined` clears the name; the team falls back to whoever holds the `lead` role. */
  readonly setLead?: (memberId: string | undefined, expectedRevision: number) => Promise<{
    state: TeamState;
    leadMemberId?: string;
  }>;
  readonly setContactGrant?: (from: string, to: string, action: 'add' | 'remove', actor: string) => Promise<{
    grants: {
      from: string;
      to: string;
      grantedBy: string;
      at: number;
    }[];
  }>;
  /** Read the dispatch projection; never mutates and never creates a team. */
  readonly readDispatch?: () => Promise<LiveTeamsDispatch | undefined>;
  /** Flip the dispatch switch under the actor's own authority; the store refuses a no-op. */
  readonly setDispatch?: (request: {
    mode: 'auto' | 'paused';
    reason?: string;
    actor: string;
  }) => Promise<{
    from: string;
    to: string;
  }>;
  /** Rotation limits in force for this team, with where they came from. */
  readonly readRotation?: () => Promise<LiveTeamsRotation | undefined>;
  /** Set this team's rotation overrides; the human's own surface, like dispatch. */
  readonly setRotation?: (request: LiveTeamsRotationRequest & {
    actor: string;
  }) => Promise<LiveTeamsRotation>;
};
export type LiveTeamsRotation = {
  readonly enabled: boolean;
  readonly maxContextTokens: number;
  readonly maxCompletedTasks: number;
  readonly cooldownMs: number;
  readonly maxRotationsPerPass: number;
  /** `team` when the panel has overrides in force, `profile` when the deployment row decides. */
  readonly source: 'team' | 'profile';
  readonly revision: number;
};
export type LiveTeamsRotationRequest = {
  readonly enabled?: boolean;
  readonly maxContextTokens?: number;
  readonly maxCompletedTasks?: number;
  readonly expectedRevision: number;
};
export type LiveTeamsSnapshotMember = {
  memberId: string;
  permittedContacts: readonly string[];
  displayName: string;
  role: string;
  availability: string;
  sessionId: string | null;
  live: boolean;
  status: 'idle' | 'running' | 'unknown';
  bindingGeneration: number;
  contractRevision: number;
};
export type LiveTeamsSnapshot = {
  teamId: string;
  leadMemberId?: string;
  /** Human-readable team name when one is configured; the id otherwise. */
  teamName: string;
  workspacePath: string;
  revision: number;
  members: LiveTeamsSnapshotMember[];
};
export type LiveTeamsCandidates = {
  teamId: string;
  /**
   * The name the Sessions above were titled with, so a client can undo the
   * `<member> - <team>` suffix without asking a second endpoint. The two
   * endpoints that report a team name must never disagree: `/team` answers from
   * the persisted state, so this one does too.
   */
  teamName: string;
  workspacePath: string;
  revision: number;
  candidates: LiveTeamsCandidate[];
};
/**
 * Who is waiting for the human, in one entry per member.
 *
 * This exists because the inbox was the wrong shape for the question the human
 * actually asks — "does anyone need me?" — and the answer must be reachable from
 * any Session, not only from the Team tab.
 */
export type LiveTeamsAttentionEntry = {
  memberId: string;
  name: string;
  /** Session to open on click; `null` when the member lost its binding. */
  sessionId: string | null;
  /** Unread human-addressed deliveries from this member. */
  waiting: number;
  /** Arrival of the oldest unread one: how long they have been waiting. */
  since: number;
  /** Kind of the newest unread message, so the chip can say what it is. */
  kind: MessageKind;
};
export type LiveTeamsAttention = {
  teamId: string;
  attention: LiveTeamsAttentionEntry[];
};
export type LiveTeamsRequestContext = {
  readonly remoteAddress: string | undefined;
  readonly host: string | undefined;
  readonly secFetchSite?: string;
  readonly expectedPort: number;
};
/**
 * Who a mutation is attributed to: a request that carried browser evidence, or one that did not.
 * Both exist and the journal says which — see `actorOf`.
 */
export type MutationActor = 'human:desktop' | 'local:unverified';
/** Mirrors the shipped community-market read authority fence. */
export declare function liveTeamsRequestAllowed(context: LiveTeamsRequestContext): boolean;
/**
 * Who a mutation is attributed to, decided by what the request actually proves.
 *
 * The fence (`liveTeamsRequestAllowed`) keeps the network and a cross-site page out, but it cannot
 * tell a browser from `curl` on the same machine: any local process can send the same headers, and a
 * member is a full Session with a shell. Pretending otherwise put "the human accepted this" into the
 * journal for work a process did.
 *
 * So the audit says which of the two it saw. `human:desktop` means the request carried the evidence
 * only a same-origin page sends — `Sec-Fetch-Site: same-origin` and an `Origin` whose host is the
 * `Host` it was sent to. Everything else is `local:unverified`: it may well be the human's own
 * script, and the journal does not claim to know. This is attribution, not authentication; making it
 * authentication needs a credential the panel holds and a local process cannot read (see
 * `docs/implementation/open-questions-to-dsh.md`).
 */
export declare function actorOf(context: {
  host: string | undefined;
  origin: string | undefined;
  secFetchSite: string | undefined;
}): 'human:desktop' | 'local:unverified';
/**
 * One entry per member who has something the human has not read yet.
 *
 * Only deliveries the human has not acknowledged count: an acknowledged delivery
 * is the record that the human saw it, and that is the only thing that makes the
 * chip stop asking. `since` is the *oldest* unread arrival, because "waiting
 * since 11:33" is the number that matters, not the newest.
 */
export declare function projectLiveTeamsAttention(state: TeamState, messages: readonly TeamMessage[], deliveries: readonly MessageDelivery[]): LiveTeamsAttention;
export declare function projectLiveTeamsSnapshot(state: TeamState, options: Pick<LiveTeamsRouteOptions, 'teamId' | 'teamName' | 'workspacePath' | 'agents'>, tasks?: readonly TeamTask[]): LiveTeamsSnapshot;
export declare function projectLiveTeamsCandidates(state: TeamState, descriptors: readonly SessionDescriptor[], options: Pick<LiveTeamsRouteOptions, 'teamId' | 'teamName' | 'workspacePath'>): LiveTeamsCandidates;
export declare function registerLiveTeamsRoutes(ctx: LiveTeamsRouteContext, options: LiveTeamsRouteOptions): () => void;
export {};