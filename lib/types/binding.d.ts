import type { SessionBridge, SessionDescriptor } from './session-bridge.js';
/** Resolve symlinked temporary directories to one comparable form. */
export declare function canonicalPath(value: string): string;
export type WorkspaceGuardOptions = {
    bridge: Pick<SessionBridge, 'inspect'>;
    workspacePath: string;
};
/**
 * Verify that a Session may become a member of this team's workspace.
 *
 * @returns the descriptor, so the caller does not inspect twice.
 * @throws LiveTeamsError `SESSION_NOT_FOUND`, `CAPABILITY_UNAVAILABLE` for a
 *   subagent-owned Session, or `SESSION_WRONG_WORKSPACE` on a cwd mismatch.
 */
export declare function assertSessionDescriptorInTeamWorkspace(options: Pick<WorkspaceGuardOptions, 'workspacePath'>, descriptor: SessionDescriptor): SessionDescriptor;
export declare function assertSessionInTeamWorkspace(options: WorkspaceGuardOptions, sessionId: string): Promise<SessionDescriptor>;
