import { MailboxService, MessageDelivery } from "./mailbox.js";
import { TaskAttempt, TaskStore, TeamTask } from "./task-store.js";
import { MemberRecord, TeamState } from "./team-store.js";
/**
 * The dispatcher is a reconciler, not an event handler: callers pass it wake-up
 * signals, and every pass recomputes its decisions from durable state. A missed
 * signal therefore cannot lose work, and a duplicated one cannot duplicate it.
 *
 * It has exactly two actions — retry a delivery that never reached its member, and
 * start an assigned task whose gate is open — and it never chooses a member, never
 * moves ownership, never edits a contract and never escalates.
 */
export declare const DISPATCH_REASONS: readonly ["dispatch-paused", "attempt-revoking", "human-gate", "task-not-ready", "no-assignee", "dependency-open", "coding-not-isolated", "human-intervened", "task-settled-during-pass", "paths-undeclared", "paths-overlap", "paths-shared", "attempt-active", "member-unknown", "member-paused", "member-busy", "no-session", "ok"];
export type DispatchReason = (typeof DISPATCH_REASONS)[number];
export type DispatchVerdict = 'assign' | 'active' | 'wait' | 'refused';
export interface DispatchEvaluation {
  taskId: string;
  title: string;
  status: TeamTask['status'];
  assignee?: string;
  decision: DispatchVerdict;
  reason: DispatchReason;
  detail: string;
  /** A `preferredTaskKinds` mismatch is reported, never enforced: the lead named the member. */
  warning?: string;
  /**
   * The active attempt has been silent long enough to be worth showing (F3). Detection only: the
   * human decides whether to open the Session, direct the member or revoke the attempt.
   */
  stalled?: {
    at: number;
    reason: 'unacknowledged' | 'idle';
    detail: string;
  };
}
export type CodingDispatch = 'manual' | 'automatic';
/** The assignment message for one attempt; also its dedupe key across passes. */
export declare function assignmentThread(taskId: string, attemptId: string): string;
type GateInput = {
  task: TeamTask;
  /** Candidate tasks; `universe` is what dependencies are resolved against. */
  tasks: readonly TeamTask[];
  universe?: readonly TeamTask[];
  attempts: readonly TaskAttempt[];
  team: TeamState;
  paused: boolean;
  /** `manual` (the default) refuses to start coding work on its own. */
  coding: CodingDispatch;
  /** Paths every task effectively shares; extends the built-in list. */
  sharedPaths?: readonly string[];
  memberOf: (memberId: string) => MemberRecord | undefined;
  preferredKindsOf?: (memberId: string) => readonly string[];
};
/**
 * The gate. The first blocker wins and its name *is* what the human reads, so the
 * states that need a person are reported as what they are before the generic ones.
 */
export declare function evaluateTask(input: GateInput): DispatchEvaluation;
export type DispatchProjection = {
  paused: boolean;
  coding: CodingDispatch;
  pausedBy?: string;
  pausedReason?: string;
  evaluations: DispatchEvaluation[];
  counts: Record<DispatchVerdict, number>;
};
export type ProjectionInput = Omit<GateInput, 'task' | 'paused' | 'coding'> & {
  dispatch: {
    mode: 'auto' | 'paused';
    coding?: CodingDispatch;
    by?: string;
    reason?: string;
  };
};
export declare function projectDispatch(input: ProjectionInput): DispatchProjection;
export declare function assignmentText(task: TeamTask, attempt: TaskAttempt, team: TeamState, workspacePath: string): string;
export type DispatchAudit = (event: Record<string, unknown> & {
  kind: string;
}) => Promise<void>;
export type ReconcileResult = {
  trigger: string;
  paused: boolean;
  evaluated: number;
  started: {
    taskId: string;
    attemptId: string;
    memberId: string;
    messageId?: string;
    detail: string;
  }[];
  /** Attempts this pass marked as human-intervened. */
  intervened: {
    taskId: string;
    attemptId: string;
    memberId: string;
  }[];
  /**
   * Attempts this pass found silent and recorded as stalled (F3). Detection only: nothing is
   * revoked, nothing is reassigned. The human sees it and decides.
   */
  stalled: {
    taskId: string;
    attemptId: string;
    memberId: string;
    reason: 'unacknowledged' | 'idle';
    detail: string;
  }[];
  woke: {
    deliveryId: string;
    messageId: string;
    state: MessageDelivery['state'];
  }[];
  blocked: {
    taskId: string;
    reason: DispatchReason;
    detail: string;
  }[];
  skipped: {
    taskId: string;
    reason: DispatchReason;
    detail: string;
  }[];
  failures: string[];
};
export type DispatcherPorts = {
  workspacePath: string;
  teamId: string;
  /** Reads current team state. */
  readTeam: () => Promise<TeamState>;
  taskStore: Pick<TaskStore, 'listTasks' | 'readAttempts' | 'claimTask' | 'markHumanIntervention' | 'closeTerminalAttempts' | 'pruneSnapshots' | 'markAttemptStalled' | 'reconcilePendingIntegrations'>;
  mailbox: Pick<MailboxService, 'listMessages' | 'listDeliveries' | 'sendFromScheduler' | 'retryExpiredLeases' | 'retryDelivery' | 'deliver' | 'healOrphanMessages'>;
  appendAudit: DispatchAudit;
  recoverReviewReturns?: () => Promise<void>;
  recoverSubmissionNotifications?: () => Promise<void>;
  recoverLifecycleNotifications?: () => Promise<void>;
  recoverObsoleteAssignments?: () => Promise<void>;
  /**
   * Replace a member's Session when its measured cost crosses a configured limit. Runs inside the
   * pass — not on its own timer — so the single-flight latch and the shutdown path already cover it,
   * and a member replaced here can be dispatched in the same pass.
   */
  rotation?: () => Promise<void>;
  /** Whether this deployment starts coding work on its own; `manual` by default. */
  codingDispatch?: CodingDispatch;
  /** Extra shared hotspots, on top of the built-in list. */
  sharedPaths?: readonly string[];
  /**
   * Is the member's Session running right now? `undefined` means this composition cannot tell, and
   * only the state-based signal (an assignment never acknowledged) is used.
   */
  sessionStatus?: (sessionId: string) => Promise<'running' | 'idle' | 'unknown'>;
  /** How long silence may last before it is shown. Ten minutes by default. */
  stalledAfterMs?: number;
  /** The tip of a branch, for reconciling an interrupted integration. */
  gitTip?: (ref: string) => Promise<string | undefined>;
  /**
   * Did a human write into this Session after `since`? `undefined` means this
   * composition cannot observe it, which is reported once instead of being read as
   * "no human was here".
   */
  humanActivity?: (sessionId: string, since: number) => Promise<boolean | undefined>;
  /** False when the team (or the binding) is not active; nothing is dispatched. */
  enabled?: () => boolean;
  /** Why the pass refused to run; a silent refusal reads as "nothing to do". */
  inactiveReason?: () => string;
  preferredKindsOf?: (memberId: string) => readonly string[];
  logger?: (message: string) => void;
  now?: () => number;
  sweepIntervalMs?: number;
  maxActionsPerPass?: number;
};
export type Dispatcher = {
  reconcile: (trigger: string) => Promise<ReconcileResult>;
  /** Wake-up signal from the audit stream; filtered to the events that can change a decision. */
  notice: (event: {
    kind?: unknown;
  }) => void;
  start: () => void;
  /** Stop accepting passes and wait for the one in flight, so disposal never races a write. */
  stop: () => Promise<void>;
};
/**
 * Read a live Agent's status the way the reconciler needs it.
 *
 * `unknown` is a real answer, not a fallback to `idle`: a Session the host cannot observe must not be
 * reported as finished work, because "idle and nothing submitted" is exactly the silence the stalled
 * detector marks. One function for both callers (the stalled detector and the rotation gate), so the
 * two cannot drift into disagreeing about whether a member is working.
 */
export declare function sessionStatusFromAgent(agent: unknown): 'running' | 'idle' | 'unknown';
export declare function createDispatcher(ports: DispatcherPorts): Dispatcher;
export {};