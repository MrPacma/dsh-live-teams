import { ModelSelection } from "./session-bridge.js";
import { MemberRecord, TeamState } from "./team-store.js";
export interface RotationConfig {
  readonly enabled: boolean;
  /** Rotate once the member's last observed prompt reached this many tokens. `0` disables. */
  readonly maxContextTokens: number;
  /** Rotate after this many completed tasks on the current member id. `0` disables. */
  readonly maxCompletedTasks: number;
  /** Quiet period after a refused or failed rotation, so a broken member is not retried every pass. */
  readonly cooldownMs: number;
  /** How many members one pass may rotate. One by default: each rotation creates a Session. */
  readonly maxRotationsPerPass: number;
}
/**
 * The defaults are the numbers this team actually reached. 150k is roughly one task's worth of
 * context on top of a fresh Session, so a member rotates at the point where the transcript starts
 * costing more than the work; five accepted tasks is the point where the previous task's evidence
 * stops being read and starts being re-sent.
 */
export declare const DEFAULT_ROTATION_CONFIG: RotationConfig;
export type RotationReason = 'max-context-tokens' | 'max-completed-tasks';
export type RotationSkip = 'disabled' | 'no-session' | 'paused' | 'active-attempt' | 'open-tasks' | 'session-running' | 'undelivered-messages' | 'below-threshold';
export interface RotationDecisionInput {
  readonly config: RotationConfig;
  readonly member: Pick<MemberRecord, 'sessionId' | 'availability'>;
  readonly completedTasks: number;
  readonly openTasks: number;
  readonly activeAttempt: boolean;
  readonly sessionStatus: 'running' | 'idle' | 'unknown';
  readonly undeliveredMessages: number;
  /** The member's last observed prompt size, or `undefined` when this host cannot measure it. */
  readonly contextTokens: number | undefined;
}
export type RotationDecision = {
  readonly rotate: true;
  readonly reason: RotationReason;
  readonly detail: string;
} | {
  readonly rotate: false;
  readonly skipped: RotationSkip;
};
export interface RotationFacts {
  readonly completedTasks: number;
  readonly openTasks: number;
  readonly activeAttempt: boolean;
  readonly sessionStatus: 'running' | 'idle' | 'unknown';
  readonly undeliveredMessages: number;
  /** The old Session's agent preset, copied so the replacement works the same way. */
  readonly agentPreset?: string | undefined;
  /**
   * The old Session's model choice. A Session carries its own model, and `session.create` accepts
   * none: without this a rotated member silently falls back to the deployment default, which is the
   * one visible way rotation could change the quality of the work.
   */
  readonly modelSelection?: ModelSelection | undefined;
  /** The old Session's current title, so the retired one keeps the name the human knows. */
  readonly sessionTitle?: string | undefined;
}
export interface RotationOutcome {
  readonly previousMemberId: string;
  readonly memberId: string;
  readonly previousSessionId: string;
  readonly sessionId: string;
  readonly reason: RotationReason;
  readonly detail: string;
  readonly completedTasks: number;
  readonly contextTokens?: number | undefined;
  /** The model carried onto the replacement Session, when the old one named one. */
  readonly model?: ModelSelection | undefined;
  /** The title the retired Session now carries, when it was stamped. */
  readonly retiredTitle?: string | undefined;
}
export interface RotationCommit {
  readonly member: MemberRecord;
  readonly previous: MemberRecord;
}
export interface RotationPorts {
  readonly teamId: string;
  readonly workspaceId: string;
  readonly config: RotationConfig;
  /** The effective config for this team: deployment row plus whatever the human set in the panel. */
  readonly configOf?: ((team: TeamState) => RotationConfig) | undefined;
  readonly readTeam: () => Promise<TeamState>;
  readonly commit: (request: {
    expectedRevision: number;
    mutate: (state: TeamState) => RotationCommit;
  }) => Promise<{
    state: TeamState;
    value: RotationCommit;
  }>;
  readonly factsOf: (member: MemberRecord) => Promise<RotationFacts>;
  readonly measureContextTokens: (sessionId: string) => Promise<number | undefined>;
  readonly createSession: (request: {
    sessionId: string;
    workspaceId: string;
    agentPreset?: string;
  }) => Promise<void>;
  /**
   * Record a model selection on the replacement Session.
   *
   * Implemented as the same session event DSH's own composer writes, and deliberately *not* through
   * `sessionController.selectModel`: that call also persists the selection as the deployment-wide
   * default model, so copying one member's model would silently re-model every other Session in the
   * profile. Returns false when the host exposes no such seam.
   */
  readonly applyModelSelection?: ((sessionId: string, selection: ModelSelection) => Promise<boolean>) | undefined;
  /**
   * Stamp the replaced Session so the two Sessions are distinguishable in the session list.
   *
   * Returns the title that was applied, or `undefined` when nothing was renamed (already stamped, no
   * title service, or the base was refused). Called only after the membership commit: a rotation that
   * was refused must not rename a Session that stays a member.
   */
  readonly retireTitle?: ((request: {
    sessionId: string;
    displayName: string;
    previousTitle?: string;
    at: number;
  }) => Promise<string | undefined>) | undefined;
  readonly newSessionId: () => string;
  readonly audit: (event: Record<string, unknown>) => Promise<void>;
  /** Wire the new Session into the host's session→binding map before its first turn. */
  readonly onRotated?: ((outcome: RotationOutcome) => void) | undefined;
  readonly titleSession?: ((sessionId: string, displayName: string) => Promise<void>) | undefined;
  readonly logger?: ((message: string) => void) | undefined;
  readonly now?: (() => number) | undefined;
}
export interface RotationService {
  readonly config: RotationConfig;
  /** One pass: at most `maxRotationsPerPass` rotations, never throwing at the caller. */
  readonly check: () => Promise<readonly RotationOutcome[]>;
}
/**
 * Normalize the `rotation` config row.
 *
 * Like `codingDispatch`, this fails closed: a typo must not start replacing Sessions. Unknown keys
 * are ignored rather than refused, because a profile written for a newer build should still mount.
 */
export declare function readRotationConfig(value: unknown): {
  config: RotationConfig;
  warnings: readonly string[];
};
/**
 * Apply a team's overrides on top of the deployment row.
 *
 * Only defined, well-formed keys are taken. The store already validated the block when it was
 * written; this second check exists because `team.json` is a file on disk and a hand edit must not
 * be able to switch a limit off by writing `null` or a string.
 */
export declare function effectiveRotationConfig(base: RotationConfig, override: unknown): RotationConfig;
/**
 * Whether this member should be replaced now.
 *
 * Every refusal is named, because "rotation did not happen" is otherwise indistinguishable from a
 * broken plugin: the pass reports the reason instead of staying silent.
 */
export declare function decideRotation(input: RotationDecisionInput): RotationDecision;
export declare function createRotationService(ports: RotationPorts): RotationService;