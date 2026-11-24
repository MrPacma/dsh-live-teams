import { MemberRecord, TeamState } from "./team-store.js";
import { LiveTeamsRole } from "./roles.js";
import { TaskAttempt, TeamTask } from "./task-store.js";
export declare const MEMBERSHIP_CONTEXT_NAME = "live-teams:membership";
export declare const MEMBERSHIP_CONTEXT_ORDER = 125;
export declare function sessionIdOf(assemblyContext: unknown): string | undefined;
export type MembershipMember = Pick<MemberRecord, 'memberId' | 'displayName' | 'role' | 'availability' | 'bindingGeneration' | 'contractRevision' | 'note'> & {
  sessionId?: string;
  roles?: readonly string[];
  [key: string]: unknown;
};
export type RoleRegistrySync = {
  resolve: (value: string) => Pick<LiveTeamsRole, 'body'> | undefined;
};
export type MembershipScope = {
  teamId: string;
  /** Set when a human wrote into this member's Session mid-attempt (B31). */
  humanIntervenedAt?: number;
  teamName?: string;
  activeAttemptId?: string;
  activeTask?: TeamTask;
  tasks?: readonly TeamTask[];
  formalToolsAvailable?: boolean;
  roleRegistry?: RoleRegistrySync;
  teamState?: TeamState;
  workspacePath?: string;
  /** The model driving this Session, when the host can tell us. */
  route?: string;
  live?: (member: MemberRecord) => boolean;
  /**
   * The model driving this member's Session, when it can be read.
   *
   * The tool names a member sees depend on the route: a Session on `claude-code/*` reaches the team
   * tools through the MCP bridge of `dsh-oh-my-claude`, where they are `mcp__dsh__live_team_*`. A
   * context that names them without the prefix asks the model to translate, and the `ToolSearch`
   * line that loads their schemas needs the exact names.
   */
  routeOf?: (member: MemberRecord) => string | undefined;
  /**
   * Comments addressed to this member that it has not acknowledged. A comment is stored with
   * `wakePolicy: never`, so nothing wakes the Session for it — without this line the recipient never
   * learns it was written (external review, finding 13).
   */
  comments?: readonly {
    from: string;
    content: string;
    at: number;
  }[];
};
export declare function renderMembership(member: MembershipMember, scope: MembershipScope): string;
type SyncStore = {
  memberBySessionSync: (teamId: string, sessionId: string) => MembershipMember | undefined;
  teamStateSync?: (teamId: string) => TeamState | undefined;
  attemptSync?: (teamId: string, taskId: string) => Pick<TaskAttempt, 'id' | 'memberId' | 'sessionId' | 'bindingGeneration' | 'status' | 'humanIntervenedAt' | 'humanIntervenedContractRevision' | 'generation'> | undefined;
  activeTaskForMemberSync?: (teamId: string, memberId: string) => TeamTask | undefined;
  tasksSync?: (teamId: string) => readonly TeamTask[] | undefined;
};
export type MembershipContextBinding = {
  readonly store: SyncStore;
  readonly teamId: string;
  readonly teamName?: string | (() => string);
  readonly workspacePath?: string;
  readonly enabled?: () => boolean;
  readonly roleRegistry?: RoleRegistrySync;
  readonly live?: (member: MemberRecord) => boolean;
  readonly activeTaskForMemberSync?: (teamId: string, memberId: string) => TeamTask | undefined;
  readonly tasksSync?: (teamId: string) => readonly TeamTask[] | undefined;
  readonly attemptSync?: (teamId: string, taskId: string) => Pick<TaskAttempt, 'id' | 'memberId' | 'sessionId' | 'bindingGeneration' | 'status' | 'humanIntervenedAt' | 'humanIntervenedContractRevision' | 'generation'> | undefined;
  /** Unread comments for a member, read synchronously because the context is assembled that way. */
  readonly commentsSync?: (teamId: string, memberId: string) => readonly {
    from: string;
    content: string;
    at: number;
  }[];
  /** The model driving a member's Session, read synchronously because the context is assembled that way. */
  readonly routeOf?: (member: MemberRecord) => string | undefined;
};
export type MembershipContextOptions = {
  readonly store?: SyncStore;
  readonly teamId?: string;
  readonly teamName?: string | (() => string);
  readonly workspacePath?: string;
  readonly onError?: (error: unknown) => void;
  readonly formalToolsAvailable?: boolean;
  readonly roleRegistry?: RoleRegistrySync;
  readonly resolveSession?: (sessionId: string) => MembershipContextBinding | undefined;
  readonly enabled?: () => boolean;
  readonly live?: (member: MemberRecord) => boolean;
  readonly activeTaskForMemberSync?: (teamId: string, memberId: string) => TeamTask | undefined;
  readonly tasksSync?: (teamId: string) => readonly TeamTask[] | undefined;
  readonly attemptSync?: (teamId: string, taskId: string) => Pick<TaskAttempt, 'id' | 'memberId' | 'sessionId' | 'bindingGeneration' | 'status' | 'humanIntervenedAt' | 'humanIntervenedContractRevision' | 'generation'> | undefined;
  readonly commentsSync?: (teamId: string, memberId: string) => readonly {
    from: string;
    content: string;
    at: number;
  }[];
  readonly routeOf?: (member: MemberRecord) => string | undefined;
};
export type MembershipContextProvider = {
  name: string;
  order: number;
  teamId: string;
  text: (assemblyContext: unknown) => string;
  definition: () => {
    name: string;
    order: number;
    text: (assemblyContext: unknown) => string;
  };
};
export declare function createMembershipContextProvider(options: MembershipContextOptions): MembershipContextProvider;
export {};