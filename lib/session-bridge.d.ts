import { LiveTeamsError } from "./errors.js";
export interface SessionDescriptor {
  sessionId: string;
  workspaceId: string | undefined;
  cwd: string | undefined;
  title: string | undefined;
  status: 'idle' | 'running' | 'unknown';
  live: boolean;
  subagentOwned: boolean;
  seq: number;
  agentPreset: string | undefined;
  /**
   * DSH's Session-list projection keeps a Session blank until its first
   * `turn/start`, and the session list hides blank Sessions: the Workspace
   * browser adopts one as its provisional "New session" row and never lists it
   * (`sessionVisible` / `connectWorkspace` in @deepseek-ai/dsh-client-ui-workspace).
   *
   * Only `list` reports this flag, so `undefined` means "not reported", never
   * "known to be visible".
   */
  blank?: boolean;
}
/**
 * The model a Session runs, as the human picked it in the composer.
 *
 * A Session carries its own selection: `agent/model/selection` records a pending choice and every
 * `request/header` records the one the last turn actually sent. Rotation has to carry it, because
 * `session.create` accepts no selection at all — a new Session silently starts on the deployment
 * default instead of the model the human chose for that member.
 */
export interface ModelSelection {
  readonly provider: string;
  readonly model: string;
  readonly reasoningEffort?: string;
}
/**
 * The selection this Session would use next.
 *
 * A pending `model/selection` wins over the last request: it is the choice the next turn will send.
 * Otherwise the newest `request/header` says what the last turn actually used, with one subtlety
 * copied from DSH's own fold — when the adapter defaulted the effort, `adapterDefaults.reasoningEffort`
 * is true and the effort in the config is not a human choice, so it is left out instead of being
 * frozen into an explicit value the human never picked.
 */
export declare function modelSelectionOf(events: readonly unknown[]): ModelSelection | undefined;
export interface SessionController {
  create(payload: Record<string, unknown>): Promise<unknown>;
  /**
   * Removed in DSH 0.2.2-rc.1. Kept optional so this bridge still works on older hosts; new
   * hosts are served through `SessionQuerySource.load`.
   */
  inspect?(sessionId: string): Promise<unknown>;
  list?(request: Record<string, unknown>, signal?: AbortSignal): Promise<unknown>;
  rename(payload: {
    sessionId: string;
    title: string;
  }): Promise<unknown>;
  prompt(payload: {
    requestId: string;
    sessionId: string;
    mode: 'queue' | 'steer';
    content: readonly unknown[];
  }, signal: AbortSignal): Promise<unknown>;
  cancel(payload: {
    sessionId: string;
  }): void;
  updateQueue?(payload: {
    sessionId: string;
    itemId: string;
    action: {
      kind: 'remove';
    };
  }): Promise<unknown>;
}
export type SessionExecutionReceipt = {
  state: 'pending' | 'started' | 'completed' | 'failed' | 'unobservable';
  turn?: number;
  inputSeq?: number;
  reason?: string;
};
export type QueueRemovalReceipt = {
  state: 'removed' | 'not-pending' | 'unobservable' | 'refused';
  itemId?: string;
  reason?: string;
};
export interface SessionBridge {
  removeQueuedRequest(sessionId: string, requestId: string): Promise<QueueRemovalReceipt>;
  create(request: {
    sessionId?: string;
    workspaceId?: string;
    cwd?: string;
    agentPreset?: string;
  }): Promise<SessionDescriptor>;
  inspect(sessionId: string): Promise<SessionDescriptor | undefined>;
  /**
   * Observe an exact prompt's turn using metadata only, not generic agent liveness.
   */
  observeRequest(sessionId: string, requestId: string): Promise<SessionExecutionReceipt>;
  /**
   * The prompt size of this Session's latest turn, or `undefined` when the host records no usage.
   * A rotation limit is only applied to a measured Session.
   */
  contextTokens(sessionId: string): Promise<number | undefined>;
  /** The model this Session would use next, or `undefined` when it never named one. */
  modelSelection(sessionId: string): Promise<ModelSelection | undefined>;
  observeHumanActivity(sessionId: string, since: number, knownRequestIds: readonly string[]): Promise<boolean | undefined>;
  validateAttachment(sessionId: string, workspaceId: string): Promise<SessionDescriptor>;
  rename(sessionId: string, title: string): Promise<{
    title: string;
    seq: number | undefined;
  }>;
  selectModel(sessionId: string, selection: unknown): never;
  deliver(sessionId: string, envelope: {
    requestId: string;
    mode: 'queue' | 'steer';
    content: readonly unknown[];
  }): Promise<{
    accepted: true;
  }>;
  interrupt(sessionId: string, reason: string): Promise<{
    accepted: true;
  }>;
  reconcile(sessionIds: readonly string[]): Promise<SessionDescriptor[]>;
}
/**
 * The prompt size of a Session's latest turn, read from the Session's own usage record.
 *
 * `totalTokens` on an `assistant/message` is the size of the context that call sent — input, plus
 * cached input, plus output — not a per-turn delta, so the newest one is the current window. Rotation
 * reads it as "how much would the next turn re-send". Older hosts and some routes record no usage at
 * all; `undefined` then means unmeasured, and no size limit is applied rather than a guessed one.
 */
export declare function contextTokensOf(events: readonly unknown[]): number | undefined;
export declare function toBridgeError(error: unknown): LiveTeamsError;
/**
 * The host's cold-safe Session reader.
 *
 * DSH 0.2.2-rc.1 moved inspection off `sessionController` onto `ctx.sessionQuery.load`, which
 * returns `{ header, inheritedEventCount, events }`. The bridge normalizes both shapes, so a
 * deployment may upgrade without losing member validation or delivery observation.
 */
export interface SessionQuerySource {
  load?(sessionId: string, signal?: AbortSignal): Promise<unknown>;
}
export interface SessionBridgeDeps {
  controller: SessionController | null | undefined;
  agents?: {
    get?: (sessionId: string) => unknown;
  };
  /**
   * The query service may be provided after this plugin mounts (it is mounted by a later
   * composition row), so a function is accepted and resolved per call.
   */
  sessionQuery?: SessionQuerySource | (() => SessionQuerySource | undefined);
  /**
   * The live Session service. A freshly created Session is live before any cold-read service is
   * reachable, so this is the authoritative fallback for member creation and live observation.
   */
  liveSession?: (sessionId: string) => unknown;
}
export declare function createSessionBridge({ controller, agents, sessionQuery, liveSession }: SessionBridgeDeps): SessionBridge;