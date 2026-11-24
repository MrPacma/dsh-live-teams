import { ToolDefinition } from "@deepseek-ai/dsh-tools";
import { MailboxService } from "./mailbox.js";
import { MemberRecord, TeamState } from "./team-store.js";
import { TaskStore } from "./task-store.js";
export declare const MEMBER_TOOL_NAMES: readonly ["live_team_send", "live_team_ack_message", "live_team_context", "live_team_status", "live_team_brief", "live_team_member_note", "live_team_grant", "live_team_dispatch", "live_team_create_task", "live_team_read_task", "live_team_list_tasks", "live_team_claim_task", "live_team_ack_task", "live_team_submit", "live_team_review", "live_team_update_task", "live_team_accept_task", "live_team_revise_task", "live_team_revoke_task", "live_team_cancel_task", "live_team_resume_task"];
export type MemberToolsBinding = {
  readonly mailbox: MailboxService;
  readonly teamId: string;
  readonly teamName: string;
  readonly member: MemberRecord;
  readonly team: TeamState;
  readonly workspacePath?: string;
  readonly live: (member: MemberRecord) => boolean;
  readonly taskStore?: TaskStore;
  readonly setMemberNote?: (memberId: string, note: string, actor: string) => Promise<{
    memberId: string;
    note: string;
  }>;
  readonly appendAudit?: (event: unknown) => Promise<void>;
  readonly updateContactGrant?: (from: string, to: string, action: 'add' | 'remove', actor: string) => Promise<{
    grants: {
      from: string;
      to: string;
      grantedBy: string;
      at: number;
    }[];
  }>;
  /** Flip the dispatch switch under the tool's own lead check (B29). */
  readonly setDispatch?: (request: {
    mode: 'auto' | 'paused';
    actor: string;
    reason?: string;
  }) => Promise<{
    from: string;
    to: string;
  }>;
};
export type MemberToolsResolver = (sessionId: string) => Promise<MemberToolsBinding | undefined>;
type ToolRegistry = {
  register: (tool: ToolDefinition) => unknown;
};
export type MemberToolsOptions = {
  includeContext?: boolean;
  includeContact?: boolean;
  includeTasks?: boolean;
  includeSubmissions?: boolean;
  includeReview?: boolean;
  includeAcceptance?: boolean;
  includeDispatch?: boolean;
};
/** Mount B13 only when the optional tools service is present. */
export declare function registerMemberToolsIfAvailable(registry: ToolRegistry | undefined, resolve: MemberToolsResolver, options?: MemberToolsOptions | boolean, legacyB18?: boolean, legacyB19?: boolean, legacyB20?: boolean): boolean;
/** Register the member-tool surface. Object options prevent positional flag drift as gates grow. */
export declare function registerMemberTools(registry: ToolRegistry, resolve: MemberToolsResolver, options?: MemberToolsOptions | boolean, legacyB18?: boolean, legacyB19?: boolean, legacyB20?: boolean): void;
export type { ToolRegistry };