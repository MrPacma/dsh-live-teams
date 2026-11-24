import { ToolRuntime } from "@deepseek-ai/dsh-tools";
import { MemberRecord, TeamStore } from "./team-store.js";
import { SessionBridge, SessionQuerySource, createSessionBridge } from "./session-bridge.js";
import { SessionCommandQueue } from "./command-queue.js";
import { MailboxService } from "./mailbox.js";
import { ReconcileResult } from "./dispatch.js";
import { MembershipContextProvider } from "./context-provider.js";
import { TaskStore } from "./task-store.js";
import { LiveTeamsDispatch, LiveTeamsWebServer } from "./routes.js";
export declare const name = "live-teams-host";
export declare const inject: readonly ["sessionController", "sessions", "agents", "systemPrompt", "workspaceRegistry"];
type WorkspaceEntry = {
  readonly path: string;
  readonly id: string;
  readonly title?: unknown;
  readonly sessionIds?: readonly unknown[];
};
type AgentRegistry = {
  readonly get?: (sessionId: string) => unknown;
  readonly isOwnedBy?: (sessionId: string, owner: unknown) => boolean;
};
type NativePathController = {
  readonly canOpenWorkspacePath?: () => boolean | Promise<boolean>;
  readonly openWorkspacePath?: (request: {
    path: string;
    action: 'reveal' | 'open';
  }, signal: AbortSignal) => Promise<unknown>;
};
type HostContext = {
  effect: (effect: () => (() => void), name?: string) => void;
  workspaceRegistry?: {
    list?: () => WorkspaceEntry[];
  };
  tools?: Pick<ToolRuntime, 'register'>;
  /** Optional service lookup: returns undefined instead of failing without inject. */
  get?: (name: string) => unknown;
  sessionController: Parameters<typeof createSessionBridge>[0]['controller'] & NativePathController;
  agents?: AgentRegistry;
  sessions?: {
    get?: (sessionId: string) => unknown;
  };
  /** Provided by the host through `ctx.inject`; not visible through a bare `ctx.get` here. */
  sessionQuery?: SessionQuerySource;
  systemPrompt: {
    context: (definition: ReturnType<MembershipContextProvider['definition']>) => unknown;
  };
  provide: (key: string, value: LiveTeamsService) => unknown;
  logger?: {
    warn?: (message: string) => void;
  };
  settingsController?: {
    canOpenAgentPresetDirectory?: () => boolean | Promise<boolean>;
  };
  webServer?: LiveTeamsWebServer;
  inject?: (deps: readonly string[], callback: (ctx: HostContext & {
    webServer: LiveTeamsWebServer;
  }) => void) => unknown;
};
export type PluginConfig = {
  enabled?: boolean;
  workspacePath?: string;
  workspaceId?: string;
  teamId?: string;
  teamName?: string; /** How often the dispatcher sweeps as a safety net; a signal wakes it sooner. */
  dispatchSweepMs?: number; /**
   * Whether the dispatcher may start *coding* work on its own. `manual` (the default)
   * keeps this product inside design §22, where the isolation it asked for is unavailable on this
   * host (ADR 0008 is rejected): research
   * and documentation tasks are dispatched, code is not. It is a deployment flag, not
   * a team switch, because Gate C is a property of the product rather than of a team.
   */
  codingDispatch?: 'manual' | 'automatic'; /** Shared hotspots, on top of the built-in list (B30). */
  sharedPaths?: string[];
  /**
   * B32: how the scope record observes the workspace. `auto` uses git in a work tree and a
   * tree fingerprint otherwise, so a folder that is not a repository is a first-class case.
   * The explicit values exist for a repository whose status is unusable, and for verifying
   * the fingerprint path inside a repository.
   */
  scopeMode?: 'auto' | 'git' | 'files';
  /**
   * Replace a member's Session when its measured cost crosses a limit (B43).
   *
   * Off by default and configurable through the profile row, because rotation changes the team's
   * composition — the same class of decision `codingDispatch` keeps manual. The limits are
   * documented in `rotation.ts` next to the numbers they default to.
   */
  rotation?: {
    enabled?: boolean;
    maxContextTokens?: number;
    maxCompletedTasks?: number;
    cooldownMs?: number;
    maxRotationsPerPass?: number;
  } | boolean;
};
export type LiveTeamsService = {
  teamId: string;
  workspacePath: string;
  bridge: SessionBridge;
  queue: SessionCommandQueue;
  mailbox: MailboxService;
  contextProvider: MembershipContextProvider;
  store: () => Promise<TeamStore>;
  taskStore: () => Promise<TaskStore>;
  /** The dispatch projection: what the reconciler would do, and why (B29). */
  readDispatch: () => Promise<LiveTeamsDispatch>;
  /** Run one reconcile pass now instead of waiting for a signal or the sweep. */
  reconcile: (trigger?: string) => Promise<ReconcileResult>;
  openMember: (sessionId: string) => Promise<MemberRecord | undefined>;
  bindMember: (request: {
    memberId: string;
    sessionId: string;
    expectedRevision: number;
  }) => Promise<MemberRecord>;
  readonly disposing: boolean;
};
/**
 * Mount one host instance.  The optional workspacePath is a deliberate pin:
 * with a pin the old single-workspace route shape is retained, while without it
 * every request is resolved through its Session's cwd.
 */
export declare function apply(ctx: HostContext, config?: PluginConfig): void;
export { apply as default };