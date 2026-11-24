import { realpathSync } from "node:fs";
import { ERROR_CODES, LiveTeamsError } from "./errors.js";
// src/binding.ts
/**
* Workspace membership rules for binding a Session to a member.
*
* A member is a member *of a workspace*, so a Session that works somewhere else
* must not become part of that team: its scoped context, its controls and the
* work it performs would all describe a different directory. The Session header
* carries a working directory and not a workspace identity, so the comparison is
* on the canonical cwd.
*/
/** Resolve symlinked temporary directories to one comparable form. */
function canonicalPath(value) {
	try {
		return realpathSync.native(value);
	} catch {
		return value;
	}
}
/**
* Verify that a Session may become a member of this team's workspace.
*
* @returns the descriptor, so the caller does not inspect twice.
* @throws LiveTeamsError `SESSION_NOT_FOUND`, `CAPABILITY_UNAVAILABLE` for a
*   subagent-owned Session, or `SESSION_WRONG_WORKSPACE` on a cwd mismatch.
*/
function assertSessionDescriptorInTeamWorkspace(options, descriptor) {
	const sessionId = descriptor.sessionId;
	if (descriptor.subagentOwned) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `Session "${sessionId}" is owned by subagent routing`, { auditDetail: "workspace guard: a subagent-owned Session cannot be a member" });
	const sessionCwd = descriptor.cwd;
	if (sessionCwd === void 0 || sessionCwd.length === 0) throw new LiveTeamsError(ERROR_CODES.SESSION_WRONG_WORKSPACE, `Session "${sessionId}" has no working directory to compare`, { auditDetail: "workspace guard: the Session header carries no cwd" });
	if (canonicalPath(sessionCwd) !== canonicalPath(options.workspacePath)) throw new LiveTeamsError(ERROR_CODES.SESSION_WRONG_WORKSPACE, `Session "${sessionId}" works in "${sessionCwd}", not in the team workspace "${options.workspacePath}"`, { auditDetail: `workspace guard: Session ${sessionCwd}, team ${options.workspacePath}` });
	return descriptor;
}
async function assertSessionInTeamWorkspace(options, sessionId) {
	const descriptor = await options.bridge.inspect(sessionId);
	if (descriptor === void 0) throw new LiveTeamsError(ERROR_CODES.SESSION_NOT_FOUND, `Session "${sessionId}" does not exist`, { auditDetail: "workspace guard: inspect returned no Session" });
	return assertSessionDescriptorInTeamWorkspace(options, descriptor);
}
export { assertSessionDescriptorInTeamWorkspace, assertSessionInTeamWorkspace, canonicalPath };
