import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { BlockList, isIP } from "node:net";
import path from "node:path";
import { ERROR_CODES, LiveTeamsError } from "./errors.js";
import { TEAM_ROOT, resolveLeadMemberId } from "./team-store.js";
import { canonicalPath } from "./binding.js";
import { messageDeliveryOutcome } from "./mailbox.js";
import { blockedBy, permittedContacts } from "./task-store.js";
import { parseReviewReturn } from "./review-return-state.js";
// src/routes.ts
const LIVE_TEAMS_MEMBERS_ROUTE = "/api/live-teams/members";
const LIVE_TEAMS_CANDIDATES_ROUTE = "/api/live-teams/candidates";
const LIVE_TEAMS_MEMBER_ROLE_ROUTE = "/api/live-teams/members/role";
const LIVE_TEAMS_MEMBER_AVAILABILITY_ROUTE = "/api/live-teams/members/availability";
const LIVE_TEAMS_MEMBER_NAME_ROUTE = "/api/live-teams/members/name";
const LIVE_TEAMS_MEMBER_REMOVE_ROUTE = "/api/live-teams/members/remove";
const LIVE_TEAMS_MEMBER_CREATE_SESSION_ROUTE = "/api/live-teams/members/create-session";
const LIVE_TEAMS_MEMBER_INTERRUPT_ROUTE = "/api/live-teams/member/interrupt";
const LIVE_TEAMS_ROLES_ROUTE = "/api/live-teams/roles";
const LIVE_TEAMS_ROLES_OPEN_ROUTE = "/api/live-teams/roles/open";
const LIVE_TEAMS_ROLES_OVERRIDE_ROUTE = "/api/live-teams/roles/override";
const LIVE_TEAMS_TEAM_ROUTE = "/api/live-teams/team";
const LIVE_TEAMS_TEAM_ENABLE_ROUTE = "/api/live-teams/team/enable";
const LIVE_TEAMS_TEAM_DISABLE_ROUTE = "/api/live-teams/team/disable";
const LIVE_TEAMS_TEAM_NAME_ROUTE = "/api/live-teams/team/name";
const LIVE_TEAMS_TEAM_CANDIDATES_ROUTE = "/api/live-teams/team/candidates";
const LIVE_TEAMS_TEAM_ADOPT_ROUTE = "/api/live-teams/team/adopt";
const LIVE_TEAMS_MESSAGES_ROUTE = "/api/live-teams/messages";
const LIVE_TEAMS_ATTENTION_ROUTE = "/api/live-teams/attention";
const LIVE_TEAMS_MESSAGES_ACKNOWLEDGE_ROUTE = "/api/live-teams/messages/acknowledge";
const LIVE_TEAMS_JOURNAL_ROUTE = "/api/live-teams/journal";
const LIVE_TEAMS_TEAM_LEAD_ROUTE = "/api/live-teams/team/lead";
const LIVE_TEAMS_TEAM_BRIEFING_OPEN_ROUTE = "/api/live-teams/team/briefing/open";
const LIVE_TEAMS_MEMBER_GRANT_ROUTE = "/api/live-teams/member/grant";
const LIVE_TEAMS_DISPATCH_ROUTE = "/api/live-teams/dispatch";
const LIVE_TEAMS_TASKS_ROUTE = "/api/live-teams/tasks";
const LIVE_TEAMS_TASK_ROUTE = "/api/live-teams/task";
const LIVE_TEAMS_TASK_ACCEPT_ROUTE = "/api/live-teams/task/accept";
const LIVE_TEAMS_TASK_NOTIFY_SUBMISSION_ROUTE = "/api/live-teams/task/notify-submission";
const LIVE_TEAMS_TASK_NOTIFY_REVIEW_ROUTE = "/api/live-teams/task/notify-review";
const LIVE_TEAMS_TASK_REVISE_ROUTE = "/api/live-teams/task/revise";
const LIVE_TEAMS_TASK_CANCEL_ROUTE = "/api/live-teams/task/cancel";
const LIVE_TEAMS_TASK_RESUME_ROUTE = "/api/live-teams/task/resume";
/** The human's own control over work: create it, change its contract, release a held attempt. */
const LIVE_TEAMS_TASK_CREATE_ROUTE = "/api/live-teams/task/create";
const LIVE_TEAMS_TASK_UPDATE_ROUTE = "/api/live-teams/task/update";
const LIVE_TEAMS_TASK_REVOKE_ROUTE = "/api/live-teams/task/revoke";
const MAX_MUTATION_BODY_BYTES = 8192;
var StateUnavailableError = class extends Error {};
function headerValue(value) {
	if (typeof value === "string") return value;
	return Array.isArray(value) && typeof value[0] === "string" ? value[0] : void 0;
}
function sendJson(response, status, value) {
	response.statusCode = status;
	response.setHeader("content-type", "application/json; charset=utf-8");
	response.setHeader("cache-control", "no-store");
	response.setHeader("x-content-type-options", "nosniff");
	response.end(JSON.stringify(value));
}
const loopbackAddresses = new BlockList();
loopbackAddresses.addSubnet("127.0.0.0", 8, "ipv4");
loopbackAddresses.addSubnet("::1", 128, "ipv6");
/** Mirrors the shipped community-market read authority fence. */
function liveTeamsRequestAllowed(context) {
	if (context.remoteAddress === void 0 || context.host === void 0) return false;
	const address = context.remoteAddress.replace(/^\[|\]$/gu, "").split("%", 1)[0] ?? "";
	const family = isIP(address);
	if (family === 0 || !loopbackAddresses.check(address, family === 4 ? "ipv4" : "ipv6")) return false;
	let authority;
	try {
		authority = new URL(`http://${context.host}`);
	} catch {
		return false;
	}
	if (authority.protocol !== "http:" || Number(authority.port || "80") !== context.expectedPort || authority.hostname !== "127.0.0.1" || context.secFetchSite === "cross-site") return false;
	return true;
}
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
function actorOf(context) {
	if (context.secFetchSite !== "same-origin") return "local:unverified";
	if (context.host === void 0 || context.origin === void 0) return "local:unverified";
	try {
		const origin = new URL(context.origin);
		const host = new URL(`http://${context.host}`);
		return origin.protocol === "http:" && origin.hostname === host.hostname && (origin.port || "80") === (host.port || "80") ? "human:desktop" : "local:unverified";
	} catch {
		return "local:unverified";
	}
}
function actorFor(request, expectedPort) {
	if (!authorityAllowed(request, expectedPort)) return "local:unverified";
	return actorOf({
		host: headerValue(request.headers.host),
		origin: headerValue(request.headers.origin),
		secFetchSite: headerValue(request.headers["sec-fetch-site"])
	});
}
function authorityAllowed(request, expectedPort) {
	const secFetchSite = headerValue(request.headers["sec-fetch-site"]);
	return liveTeamsRequestAllowed({
		remoteAddress: request.socket.remoteAddress,
		host: headerValue(request.headers.host),
		...secFetchSite === void 0 ? {} : { secFetchSite },
		expectedPort
	});
}
function record(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function requiredText(value) {
	return typeof value === "string" && value.length > 0 ? value : void 0;
}
function validInteger(value) {
	return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
function memberOf(value) {
	const candidate = record(value);
	const memberId = requiredText(candidate.memberId);
	const displayName = requiredText(candidate.displayName);
	const role = requiredText(candidate.role);
	const availability = requiredText(candidate.availability);
	const sessionIdValue = candidate.sessionId;
	const note = candidate.note;
	const bindingGeneration = candidate.bindingGeneration;
	const contractRevision = candidate.contractRevision;
	if (memberId === void 0 || displayName === void 0 || role === void 0 || availability === void 0 || sessionIdValue !== void 0 && requiredText(sessionIdValue) === void 0 || !validInteger(bindingGeneration) || !validInteger(contractRevision)) throw new StateUnavailableError("invalid member state");
	return {
		memberId,
		displayName,
		role,
		availability,
		...sessionIdValue === void 0 ? {} : { sessionId: String(sessionIdValue) },
		...note === void 0 ? {} : typeof note === "string" ? { note } : {},
		bindingGeneration,
		contractRevision
	};
}
function stateOf(value, options) {
	const candidate = record(value);
	const schemaVersion = candidate.schemaVersion;
	const revision = candidate.revision;
	const teamId = requiredText(candidate.teamId);
	const workspaceId = requiredText(candidate.workspaceId);
	const workspacePath = requiredText(candidate.workspacePath);
	const membersValue = candidate.members;
	const archivedMemberIds = candidate.archivedMemberIds;
	const createdAt = candidate.createdAt;
	const updatedAt = candidate.updatedAt;
	const name = candidate.name;
	const leadMemberId = candidate.leadMemberId;
	const rawContactGrants = candidate.contactGrants;
	if (name !== void 0 && (typeof name !== "string" || name.trim().length === 0 || Array.from(name.trim()).length > 64)) throw new StateUnavailableError("invalid team name");
	if (!validInteger(schemaVersion) || schemaVersion > 1 || !validInteger(revision) || teamId !== options.teamId || workspaceId === void 0 || workspacePath === void 0 || canonicalPath(workspacePath) !== canonicalPath(options.workspacePath) || !Array.isArray(membersValue) || !Array.isArray(archivedMemberIds) || !archivedMemberIds.every((memberId) => requiredText(memberId) !== void 0) || !validInteger(createdAt) || !validInteger(updatedAt)) throw new StateUnavailableError("invalid team state");
	const members = membersValue.map(memberOf);
	if (leadMemberId !== void 0 && (typeof leadMemberId !== "string" || !members.some((member) => member.memberId === leadMemberId))) throw new StateUnavailableError("invalid lead member");
	const contactGrants = rawContactGrants === void 0 ? void 0 : rawContactGrants;
	if (contactGrants !== void 0 && (!Array.isArray(contactGrants) || !contactGrants.every((grant) => grant !== null && typeof grant === "object" && typeof grant.from === "string" && typeof grant.to === "string" && typeof grant.grantedBy === "string" && validInteger(grant.at) && members.some((member) => member.memberId === grant.from) && (grant.to === "human" || grant.to === "team" || members.some((member) => member.memberId === grant.to))))) throw new StateUnavailableError("invalid contact grants");
	const memberIds = /* @__PURE__ */ new Set();
	for (const member of members) {
		if (memberIds.has(member.memberId)) throw new StateUnavailableError("duplicate member id");
		memberIds.add(member.memberId);
	}
	return {
		schemaVersion,
		revision,
		teamId,
		workspaceId,
		workspacePath,
		members,
		archivedMemberIds: [...archivedMemberIds],
		createdAt,
		updatedAt,
		...typeof name === "string" ? { name: name.trim() } : {},
		...typeof leadMemberId === "string" ? { leadMemberId } : {},
		...contactGrants === void 0 ? {} : { contactGrants }
	};
}
async function readTeamState(options) {
	if (options.readState !== void 0) return stateOf(await options.readState(), options);
	const file = path.join(path.resolve(options.workspacePath), TEAM_ROOT, "teams", options.teamId, "team.json");
	let parsed;
	try {
		parsed = JSON.parse(await readFile(file, "utf8"));
	} catch (error) {
		throw new StateUnavailableError(error instanceof Error ? error.message : String(error));
	}
	return stateOf(parsed, options);
}
function statusOf(agent) {
	try {
		const status = record(agent).status;
		return status === "idle" || status === "running" ? status : "unknown";
	} catch {
		return "unknown";
	}
}
function liveAgentOf(registry, sessionId) {
	if (registry === void 0) return void 0;
	try {
		return registry.get(sessionId);
	} catch {
		return;
	}
}
/**
* One entry per member who has something the human has not read yet.
*
* Only deliveries the human has not acknowledged count: an acknowledged delivery
* is the record that the human saw it, and that is the only thing that makes the
* chip stop asking. `since` is the *oldest* unread arrival, because "waiting
* since 11:33" is the number that matters, not the newest.
*/
function projectLiveTeamsAttention(state, messages, deliveries) {
	const checked = stateOf(state, {
		teamId: state.teamId,
		workspacePath: state.workspacePath
	});
	const byId = new Map(messages.map((message) => [message.id, message]));
	const grouped = /* @__PURE__ */ new Map();
	for (const delivery of deliveries) {
		if (delivery.recipient !== "human" || delivery.state !== "stored") continue;
		const message = byId.get(delivery.messageId);
		if (message === void 0 || message.from === "human" || message.from === "scheduler") continue;
		const prior = grouped.get(message.from);
		grouped.set(message.from, prior === void 0 ? {
			waiting: 1,
			since: message.createdAt,
			newestAt: message.createdAt,
			kind: message.kind
		} : {
			waiting: prior.waiting + 1,
			since: Math.min(prior.since, message.createdAt),
			newestAt: Math.max(prior.newestAt, message.createdAt),
			kind: message.createdAt >= prior.newestAt ? message.kind : prior.kind
		});
	}
	const attention = [...grouped.entries()].map(([memberId, entry]) => {
		const member = checked.members.find((candidate) => candidate.memberId === memberId);
		return {
			memberId,
			name: member?.displayName ?? memberId,
			sessionId: member?.sessionId ?? null,
			waiting: entry.waiting,
			since: entry.since,
			kind: entry.kind
		};
	}).sort((left, right) => left.since - right.since || (left.memberId < right.memberId ? -1 : 1));
	return {
		teamId: checked.teamId,
		attention
	};
}
/**
* The one answer to "what is this team called".
*
* The persisted name wins because the Session titles were derived from it; a
* configured name is only a default for a team that was never renamed, and the
* team id is the last resort. Two endpoints once answered this differently —
* `/team` said `B1 Check` while `/members` said `live-teams-workspace` — which
* is how the client ended up unable to strip its own title suffix.
*/
function teamNameOf(state, options) {
	const persisted = typeof state.name === "string" && state.name.trim().length > 0 ? state.name.trim() : void 0;
	if (persisted !== void 0) return persisted;
	const configured = options.teamName;
	return configured === void 0 || configured.length === 0 ? state.teamId : configured;
}
function projectLiveTeamsSnapshot(state, options, tasks = []) {
	const checked = stateOf(state, options);
	const members = checked.members.map((member) => {
		const sessionId = typeof member.sessionId === "string" && member.sessionId.length > 0 ? member.sessionId : null;
		const agent = sessionId === null ? void 0 : liveAgentOf(options.agents, sessionId);
		const live = agent !== void 0 && agent !== null;
		return {
			memberId: member.memberId,
			permittedContacts: permittedContacts(checked, member.memberId, tasks).filter((value, index, values) => value.length > 0 && values.indexOf(value) === index).map((target) => target === "human" || target === "team" ? target : checked.members.find((candidate) => candidate.memberId === target)?.displayName ?? target),
			displayName: member.displayName,
			role: member.role,
			availability: member.availability,
			sessionId,
			live,
			status: live ? statusOf(agent) : "unknown",
			bindingGeneration: member.bindingGeneration,
			contractRevision: member.contractRevision
		};
	}).sort((left, right) => left.memberId < right.memberId ? -1 : left.memberId > right.memberId ? 1 : 0);
	return {
		teamId: checked.teamId,
		...checked.leadMemberId === void 0 ? {} : { leadMemberId: checked.leadMemberId },
		teamName: teamNameOf(checked, options),
		workspacePath: checked.workspacePath,
		revision: checked.revision,
		members
	};
}
function mutationMember(state, memberId) {
	return state.members.find((member) => member.memberId === memberId);
}
function mutationConflict(error) {
	return error instanceof LiveTeamsError && error.code === ERROR_CODES.REVISION_CONFLICT;
}
async function appendSessionTitleAudit(options, sessionId, title, actor) {
	if (title === void 0 || !title.renamed || options.appendAudit === void 0) return;
	try {
		await options.appendAudit({
			kind: "session/titled",
			sessionId,
			from: title.from,
			to: title.to,
			reason: title.reason,
			at: Date.now(),
			actor
		});
	} catch (error) {
		options.logger?.warn?.(`live-teams: could not append Session title audit for "${sessionId}": ${String(error)}`);
	}
}
function invalidMutation(error) {
	return error instanceof LiveTeamsError && error.code === ERROR_CODES.CAPABILITY_UNAVAILABLE;
}
/**
* A refused mutation leaves no audit by design, so without this line the reason
* exists only in the response body. Write it to the host log as well.
*/
function logMutationFailure(options, operation, error) {
	if (typeof options.logger?.warn !== "function") return;
	if (error instanceof LiveTeamsError) {
		options.logger.warn(`live-teams: ${operation} refused (${error.code}): ${error.message}${error.auditDetail === void 0 ? "" : ` [${error.auditDetail}]`}`);
		return;
	}
	options.logger.warn(`live-teams: ${operation} failed: ${String(error)}`);
}
function createErrorStatus(error) {
	if (!(error instanceof LiveTeamsError)) return 500;
	if (error.code === ERROR_CODES.SESSION_NOT_FOUND || error.code === ERROR_CODES.SESSION_WRONG_WORKSPACE || error.code === ERROR_CODES.CAPABILITY_UNAVAILABLE) return 400;
	return 500;
}
function createErrorBody(error) {
	if (error instanceof LiveTeamsError && error.auditDetail === "workspace not registered") return { error: "live-teams workspace not registered" };
	if (error instanceof LiveTeamsError && error.code === ERROR_CODES.SESSION_NOT_FOUND) return { error: "live-teams session not found" };
	if (error instanceof LiveTeamsError && error.code === ERROR_CODES.SESSION_WRONG_WORKSPACE) return { error: "live-teams session not in workspace" };
	if (error instanceof LiveTeamsError && error.code === ERROR_CODES.CAPABILITY_UNAVAILABLE && error.auditDetail?.startsWith("workspace guard:") === true) return { error: "live-teams session not in workspace" };
	return { error: "live-teams invalid request" };
}
function safeTeamId(value) {
	return typeof value === "string" && value.length > 0 && value !== "." && value !== ".." && !value.includes("/") && !value.includes("\\\\");
}
function adoptionErrorStatus(error) {
	if (error instanceof LiveTeamsError && error.auditDetail === "derived team already exists") return 409;
	if (error instanceof LiveTeamsError && (error.code === ERROR_CODES.STATE_CORRUPT || error.code === ERROR_CODES.SCHEMA_UNSUPPORTED || error.auditDetail === "invalid adoption path" || error.auditDetail === "invalid candidate state" || error.auditDetail === "invalid candidate member" || error.auditDetail === "invalid archived member list")) return 400;
	return 500;
}
function projectLiveTeamsCandidates(state, descriptors, options) {
	const checked = stateOf(state, options);
	const bound = new Set(checked.members.flatMap((member) => typeof member.sessionId === "string" && member.sessionId.length > 0 ? [member.sessionId] : []));
	const seen = /* @__PURE__ */ new Set();
	const candidates = descriptors.filter((descriptor) => descriptor.sessionId.length > 0 && descriptor.cwd !== void 0 && canonicalPath(descriptor.cwd) === canonicalPath(checked.workspacePath) && !descriptor.subagentOwned && descriptor.blank !== true && !bound.has(descriptor.sessionId) && !seen.has(descriptor.sessionId)).map((descriptor) => {
		seen.add(descriptor.sessionId);
		return {
			sessionId: descriptor.sessionId,
			title: descriptor.title ?? null,
			cwd: descriptor.cwd,
			live: descriptor.live,
			status: descriptor.status
		};
	}).sort((left, right) => left.sessionId < right.sessionId ? -1 : left.sessionId > right.sessionId ? 1 : 0);
	return {
		teamId: checked.teamId,
		teamName: teamNameOf(checked, options),
		workspacePath: checked.workspacePath,
		revision: checked.revision,
		candidates
	};
}
async function readRequestBody(request) {
	if (typeof request.body === "string") {
		if (new TextEncoder().encode(request.body).byteLength > MAX_MUTATION_BODY_BYTES) throw new Error("body too large");
		return request.body;
	}
	if (request.body !== void 0 && typeof request.body !== "string" && Symbol.asyncIterator in Object(request.body)) {
		const chunks = [];
		let size = 0;
		for await (const chunk of request.body) {
			const bytes = typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk;
			size += bytes.byteLength;
			if (size > MAX_MUTATION_BODY_BYTES) throw new Error("body too large");
			chunks.push(bytes);
		}
		const result = new Uint8Array(size);
		let offset = 0;
		for (const chunk of chunks) {
			result.set(chunk, offset);
			offset += chunk.byteLength;
		}
		return new TextDecoder().decode(result);
	}
	if (request.body !== void 0 && typeof request.body !== "string" && !(Symbol.asyncIterator in Object(request.body))) {
		const body = new TextDecoder().decode(request.body);
		if (new TextEncoder().encode(body).byteLength > MAX_MUTATION_BODY_BYTES) throw new Error("body too large");
		return body;
	}
	const stream = request.body !== void 0 && typeof request.body !== "string" && Symbol.asyncIterator in Object(request.body) ? request.body : request;
	const chunks = [];
	let size = 0;
	for await (const chunk of stream) {
		const bytes = typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk;
		size += bytes.byteLength;
		if (size > MAX_MUTATION_BODY_BYTES) throw new Error("body too large");
		chunks.push(bytes);
	}
	const result = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return new TextDecoder().decode(result);
}
function codePointText(value) {
	if (typeof value !== "string") return void 0;
	const trimmed = value.trim();
	return trimmed.length > 0 && Array.from(trimmed).length <= 64 ? trimmed : void 0;
}
function parseCreateMember(body) {
	const candidate = record(JSON.parse(body));
	const sessionId = requiredText(candidate.sessionId);
	const displayName = codePointText(candidate.displayName);
	const role = codePointText(candidate.role);
	const memberIdValue = candidate.memberId;
	const memberId = memberIdValue === void 0 ? void 0 : requiredText(memberIdValue);
	const expectedRevision = candidate.expectedRevision;
	if (sessionId === void 0 || displayName === void 0 || role === void 0 || memberIdValue !== void 0 && memberId === void 0 || !validInteger(expectedRevision)) throw new Error("invalid member creation");
	return {
		sessionId,
		displayName,
		role,
		...memberId === void 0 ? {} : { memberId },
		expectedRevision
	};
}
function parseCreateSessionMember(body) {
	const candidate = record(JSON.parse(body));
	const displayName = codePointText(candidate.displayName);
	const role = codePointText(candidate.role);
	const expectedRevision = candidate.expectedRevision;
	if (displayName === void 0 || role === void 0 || !validInteger(expectedRevision)) throw new Error("invalid session member creation");
	return {
		displayName,
		role,
		expectedRevision,
		sessionId: `session-${randomUUID()}`
	};
}
function parseGrant(body) {
	const candidate = record(JSON.parse(body));
	const sessionId = requiredText(candidate.sessionId);
	const memberId = requiredText(candidate.memberId);
	const allow = requiredText(candidate.allow);
	if (sessionId === void 0 || memberId === void 0 || allow === void 0 || candidate.action !== "add" && candidate.action !== "remove") throw new Error("invalid contact grant");
	return {
		sessionId,
		memberId,
		allow,
		action: candidate.action
	};
}
function parseRemoveMember(body) {
	const candidate = record(JSON.parse(body));
	if (typeof candidate.memberId !== "string" || candidate.memberId.length === 0 || !validInteger(candidate.expectedRevision)) throw new Error("invalid member removal");
	return {
		memberId: candidate.memberId,
		expectedRevision: candidate.expectedRevision
	};
}
function parseMutation(body, kind) {
	const candidate = record(JSON.parse(body));
	const memberId = candidate.memberId;
	const expectedRevision = candidate.expectedRevision;
	if (typeof memberId !== "string" || memberId.length === 0 || !validInteger(expectedRevision)) throw new Error("invalid mutation");
	if (kind === "role") {
		if (typeof candidate.role !== "string") throw new Error("invalid role");
		const role = candidate.role.trim();
		if (role.length === 0 || Array.from(role).length > 64) throw new Error("invalid role");
		return {
			memberId,
			value: role,
			expectedRevision
		};
	}
	if (kind === "name") {
		if (typeof candidate.displayName !== "string") throw new Error("invalid display name");
		const displayName = candidate.displayName.trim();
		if (displayName.length === 0 || Array.from(displayName).length > 64) throw new Error("invalid display name");
		return {
			memberId,
			value: displayName,
			expectedRevision
		};
	}
	if (candidate.availability !== "available" && candidate.availability !== "paused") throw new Error("invalid availability");
	return {
		memberId,
		value: candidate.availability,
		expectedRevision
	};
}
function bodyContentType(request) {
	return headerValue(request.headers["content-type"])?.split(";", 1)[0]?.trim().toLowerCase();
}
function roleList(registry, openAvailable = false, globalOpenAvailable = false) {
	return {
		roles: registry.roles.map((role) => ({
			id: role.id,
			name: role.name,
			...role.description === void 0 ? {} : { description: role.description },
			aliases: [...role.aliases],
			source: role.source,
			overridden: role.overridden
		})),
		globalDirectory: registry.globalDirectory,
		workspaceDirectory: registry.workspaceDirectory,
		workspaceDirectoryExists: registry.workspaceDirectoryExists,
		openAvailable,
		globalOpenAvailable
	};
}
function safeInside(directory, candidate) {
	const root = path.resolve(directory);
	const resolved = path.resolve(candidate);
	return resolved === root || resolved.startsWith(`${root}${path.sep}`);
}
function parseRoleOpen(body) {
	const candidate = record(JSON.parse(body));
	const scope = candidate.scope;
	if (scope !== "global" && scope !== "workspace") throw new Error("invalid role scope");
	const id = candidate.id;
	if (id !== void 0 && (typeof id !== "string" || id.length === 0 || roleIdFromValue(id) === void 0)) throw new Error("invalid role id");
	return id === void 0 ? { scope } : {
		scope,
		id
	};
}
function roleIdFromValue(value) {
	return /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value) ? value : void 0;
}
async function currentRoles(options) {
	if (options.readRoles !== void 0) return options.readRoles();
	if (options.roles !== void 0) return options.roles;
	return options.roleRegistry === void 0 ? void 0 : options.roleRegistry();
}
async function handleRolesList(request, response, ctx, options) {
	if (!authorityAllowed(request, ctx.webServer.port)) {
		sendJson(response, 403, { error: "live-teams request authority rejected" });
		return;
	}
	if (request.method !== "GET") {
		sendJson(response, 405, { error: "live-teams method not allowed" });
		return;
	}
	const registry = await currentRoles(options);
	if (registry === void 0) {
		sendJson(response, 503, { error: "live-teams state unavailable" });
		return;
	}
	let openAvailable = false;
	if (options.canOpenWorkspacePath !== void 0) try {
		openAvailable = await options.canOpenWorkspacePath();
	} catch {
		openAvailable = false;
	}
	sendJson(response, 200, roleList(registry, openAvailable, openAvailable));
}
async function handleRolesOpen(request, response, ctx, options) {
	if (!authorityAllowed(request, ctx.webServer.port)) {
		sendJson(response, 403, { error: "live-teams request authority rejected" });
		return;
	}
	if (request.method !== "POST") {
		sendJson(response, 405, { error: "live-teams method not allowed" });
		return;
	}
	if (bodyContentType(request) !== "application/json") {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	const declaredLength = headerValue(request.headers["content-length"]);
	if (declaredLength !== void 0 && /^\d+$/u.test(declaredLength) && Number(declaredLength) > MAX_MUTATION_BODY_BYTES) {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	const registry = await currentRoles(options);
	if (registry === void 0 || options.canOpenWorkspacePath === void 0 || options.openWorkspacePath === void 0) {
		sendJson(response, 503, { error: "live-teams open unavailable" });
		return;
	}
	let parsed;
	try {
		parsed = parseRoleOpen(await requestBody(request));
	} catch {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	const directory = parsed.scope === "global" ? registry.globalDirectory : registry.workspaceDirectory;
	const role = parsed.id === void 0 ? void 0 : parsed.scope === "global" ? registry.globalRoleIds.has(parsed.id) ? parsed.id : void 0 : registry.roles.find((entry) => entry.id === parsed.id && entry.source === "workspace");
	if (parsed.id !== void 0 && role === void 0) {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	const target = parsed.id === void 0 ? directory : parsed.scope === "global" ? registry.globalRolePath(parsed.id) ?? path.join(directory, `${parsed.id}.md`) : path.join(directory, `${parsed.id}.md`);
	if (!safeInside(directory, target)) {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	let canOpen = false;
	try {
		canOpen = await options.canOpenWorkspacePath();
	} catch {
		canOpen = false;
	}
	if (!canOpen) {
		sendJson(response, 503, { error: "live-teams open unavailable" });
		return;
	}
	try {
		await options.openWorkspacePath({
			path: target,
			action: parsed.id === void 0 ? "reveal" : "open"
		}, new AbortController().signal);
	} catch {
		sendJson(response, 503, { error: "live-teams open unavailable" });
		return;
	}
	sendJson(response, 200, { opened: target });
}
async function handleRolesOverride(request, response, ctx, options) {
	if (!authorityAllowed(request, ctx.webServer.port)) {
		sendJson(response, 403, { error: "live-teams request authority rejected" });
		return;
	}
	if (request.method !== "POST") {
		sendJson(response, 405, { error: "live-teams method not allowed" });
		return;
	}
	if (bodyContentType(request) !== "application/json") {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	const declaredLength = headerValue(request.headers["content-length"]);
	if (declaredLength !== void 0 && /^\d+$/u.test(declaredLength) && Number(declaredLength) > MAX_MUTATION_BODY_BYTES) {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	const registry = await currentRoles(options);
	if (registry === void 0 || options.copyRoleOverride === void 0) {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	let id;
	try {
		const body = record(JSON.parse(await requestBody(request)));
		if (typeof body.id !== "string" || roleIdFromValue(body.id) === void 0) throw new Error("invalid id");
		id = body.id;
	} catch {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	if (!registry.globalRoleIds.has(id) || registry.globalRolePath(id) === void 0) {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	try {
		sendJson(response, 200, await options.copyRoleOverride(id));
	} catch (error) {
		if (error instanceof LiveTeamsError && error.code === ERROR_CODES.CAPABILITY_UNAVAILABLE && error.auditDetail === "role already overridden") {
			sendJson(response, 409, { error: "live-teams role already overridden" });
			return;
		}
		sendJson(response, 500, { error: "live-teams mutation failed" });
	}
}
async function handleCreateMember(request, response, ctx, options) {
	if (!authorityAllowed(request, ctx.webServer.port)) {
		sendJson(response, 403, { error: "live-teams request authority rejected" });
		return;
	}
	if (request.method !== "POST") {
		sendJson(response, 405, { error: "live-teams method not allowed" });
		return;
	}
	if (bodyContentType(request) !== "application/json") {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	const declaredLength = headerValue(request.headers["content-length"]);
	if (declaredLength !== void 0 && /^\d+$/u.test(declaredLength) && Number(declaredLength) > MAX_MUTATION_BODY_BYTES) {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	let parsed;
	try {
		const requestPayload = parseCreateMember(await requestBody(request));
		parsed = requestPayload.memberId === void 0 ? {
			...requestPayload,
			memberId: `m-${randomUUID()}`
		} : requestPayload;
	} catch {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	if (options.createMember === void 0 || options.appendAudit === void 0) {
		sendJson(response, 500, { error: "live-teams mutation failed" });
		return;
	}
	if (options.roles !== void 0 || options.readRoles !== void 0 || options.roleRegistry !== void 0) {
		let registry;
		try {
			registry = await currentRoles(options);
		} catch {
			sendJson(response, 503, { error: "live-teams state unavailable" });
			return;
		}
		const resolvedRole = registry?.resolve(parsed.role);
		if (resolvedRole === void 0) {
			sendJson(response, 400, { error: "live-teams unknown role" });
			return;
		}
		parsed = {
			...parsed,
			role: resolvedRole.id
		};
	}
	let state;
	try {
		state = await readTeamState(options);
	} catch {
		sendJson(response, 503, { error: "live-teams state unavailable" });
		return;
	}
	if (state.members.some((member) => member.sessionId === parsed.sessionId) || parsed.memberId !== void 0 && state.members.some((member) => member.memberId === parsed.memberId)) {
		logMutationFailure(options, `adding Session "${parsed.sessionId}" as a member`, new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, "that Session is already a member of this team"));
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	let retried = false;
	let applied;
	const originalExpectedRevision = parsed.expectedRevision;
	let expectedRevision = parsed.expectedRevision;
	for (let attempt = 0; attempt < 2; attempt += 1) {
		if (attempt > 0) retried = true;
		try {
			applied = await options.createMember({
				...parsed,
				expectedRevision
			});
			break;
		} catch (error) {
			if (!mutationConflict(error)) {
				const status = createErrorStatus(error);
				logMutationFailure(options, "adding a member", error);
				sendJson(response, status, status === 400 ? createErrorBody(error) : { error: "live-teams mutation failed" });
				return;
			}
			if (attempt === 1) break;
			try {
				state = await readTeamState(options);
			} catch {
				sendJson(response, 503, { error: "live-teams state unavailable" });
				return;
			}
			if (state.members.some((member) => member.sessionId === parsed.sessionId) || parsed.memberId !== void 0 && state.members.some((member) => member.memberId === parsed.memberId)) {
				sendJson(response, 400, { error: "live-teams invalid request" });
				return;
			}
			expectedRevision = state.revision;
		}
	}
	if (applied === void 0) {
		try {
			state = await readTeamState(options);
		} catch {
			sendJson(response, 503, { error: "live-teams state unavailable" });
			return;
		}
		sendJson(response, 409, {
			error: "live-teams revision conflict",
			revision: state.revision,
			members: projectLiveTeamsSnapshot(state, options).members
		});
		return;
	}
	const event = {
		kind: "member/added",
		memberId: applied.member.memberId,
		sessionId: parsed.sessionId,
		displayName: applied.member.displayName,
		role: applied.member.role,
		at: Date.now(),
		actor: actorFor(request, ctx.webServer.port),
		expectedRevision: originalExpectedRevision,
		appliedRevision: applied.state.revision
	};
	try {
		await options.appendAudit(event);
	} catch {
		sendJson(response, 500, { error: "live-teams mutation failed" });
		return;
	}
	await appendSessionTitleAudit(options, parsed.sessionId, applied.sessionTitle, actorFor(request, ctx.webServer.port));
	const member = projectLiveTeamsSnapshot(applied.state, options).members.find((entry) => entry.memberId === applied.member.memberId);
	if (member === void 0) {
		sendJson(response, 500, { error: "live-teams mutation failed" });
		return;
	}
	sendJson(response, 200, {
		teamId: options.teamId,
		memberId: applied.member.memberId,
		revision: applied.state.revision,
		applied: true,
		retried,
		member
	});
}
async function handleCreateSessionMember(request, response, ctx, options) {
	if (!authorityAllowed(request, ctx.webServer.port)) {
		sendJson(response, 403, { error: "live-teams request authority rejected" });
		return;
	}
	if (request.method !== "POST") {
		sendJson(response, 405, { error: "live-teams method not allowed" });
		return;
	}
	if (bodyContentType(request) !== "application/json") {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	const declaredLength = headerValue(request.headers["content-length"]);
	if (declaredLength !== void 0 && /^\d+$/u.test(declaredLength) && Number(declaredLength) > MAX_MUTATION_BODY_BYTES) {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	let parsed;
	try {
		parsed = parseCreateSessionMember(await requestBody(request));
	} catch {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	if (options.createSessionMember === void 0 || options.appendAudit === void 0) {
		sendJson(response, 500, { error: "live-teams mutation failed" });
		return;
	}
	if (options.workspaceRegistered !== void 0) try {
		if (!await options.workspaceRegistered()) {
			sendJson(response, 400, { error: "live-teams workspace not registered" });
			return;
		}
	} catch {
		sendJson(response, 400, { error: "live-teams workspace not registered" });
		return;
	}
	if (options.roles !== void 0 || options.readRoles !== void 0 || options.roleRegistry !== void 0) {
		let registry;
		try {
			registry = await currentRoles(options);
		} catch {
			sendJson(response, 503, { error: "live-teams state unavailable" });
			return;
		}
		const resolvedRole = registry?.resolve(parsed.role);
		if (resolvedRole === void 0) {
			sendJson(response, 400, { error: "live-teams unknown role" });
			return;
		}
		parsed = {
			...parsed,
			role: resolvedRole.id
		};
	}
	let state;
	try {
		state = await readTeamState(options);
	} catch {
		sendJson(response, 503, { error: "live-teams state unavailable" });
		return;
	}
	let retried = false;
	let applied;
	const originalExpectedRevision = parsed.expectedRevision;
	let expectedRevision = parsed.expectedRevision;
	for (let attempt = 0; attempt < 2; attempt += 1) {
		if (attempt > 0) retried = true;
		try {
			applied = await options.createSessionMember({
				...parsed,
				expectedRevision
			});
			break;
		} catch (error) {
			if (!mutationConflict(error)) {
				const status = error instanceof LiveTeamsError && error.auditDetail === "workspace not registered" ? 400 : createErrorStatus(error);
				logMutationFailure(options, "creating a member Session", error);
				sendJson(response, status, status === 400 ? createErrorBody(error) : { error: "live-teams mutation failed" });
				return;
			}
			if (attempt === 1) break;
			try {
				state = await readTeamState(options);
			} catch {
				sendJson(response, 503, { error: "live-teams state unavailable" });
				return;
			}
			expectedRevision = state.revision;
		}
	}
	if (applied === void 0) {
		try {
			state = await readTeamState(options);
		} catch {
			sendJson(response, 503, { error: "live-teams state unavailable" });
			return;
		}
		sendJson(response, 409, {
			error: "live-teams revision conflict",
			revision: state.revision,
			members: projectLiveTeamsSnapshot(state, options).members
		});
		return;
	}
	const sessionId = applied.member.sessionId;
	if (typeof sessionId !== "string" || sessionId.length === 0) {
		sendJson(response, 500, { error: "live-teams mutation failed" });
		return;
	}
	const event = {
		kind: "member/added",
		memberId: applied.member.memberId,
		sessionId,
		displayName: applied.member.displayName,
		role: applied.member.role,
		at: Date.now(),
		actor: actorFor(request, ctx.webServer.port),
		expectedRevision: originalExpectedRevision,
		appliedRevision: applied.state.revision
	};
	try {
		await options.appendAudit(event);
	} catch {
		sendJson(response, 500, { error: "live-teams mutation failed" });
		return;
	}
	await appendSessionTitleAudit(options, sessionId, applied.sessionTitle, actorFor(request, ctx.webServer.port));
	const member = projectLiveTeamsSnapshot(applied.state, options).members.find((entry) => entry.memberId === applied.member.memberId);
	if (member === void 0 || member.sessionId === null) {
		sendJson(response, 500, { error: "live-teams mutation failed" });
		return;
	}
	sendJson(response, 200, {
		teamId: options.teamId,
		memberId: member.memberId,
		sessionId: member.sessionId,
		revision: applied.state.revision,
		applied: true,
		retried,
		member
	});
}
async function handleRemoveMember(request, response, ctx, options) {
	if (!authorityAllowed(request, ctx.webServer.port)) {
		sendJson(response, 403, { error: "live-teams request authority rejected" });
		return;
	}
	if (request.method !== "POST") {
		sendJson(response, 405, { error: "live-teams method not allowed" });
		return;
	}
	if (bodyContentType(request) !== "application/json") {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	const declaredLength = headerValue(request.headers["content-length"]);
	if (declaredLength !== void 0 && /^\d+$/u.test(declaredLength) && Number(declaredLength) > MAX_MUTATION_BODY_BYTES) {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	let parsed;
	try {
		parsed = parseRemoveMember(await requestBody(request));
	} catch {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	if (options.removeMember === void 0 || options.appendAudit === void 0) {
		sendJson(response, 500, { error: "live-teams mutation failed" });
		return;
	}
	let state;
	try {
		state = await readTeamState(options);
	} catch {
		sendJson(response, 503, { error: "live-teams state unavailable" });
		return;
	}
	if (mutationMember(state, parsed.memberId) === void 0 || state.archivedMemberIds.includes(parsed.memberId)) {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	let retried = false;
	let applied;
	const originalExpectedRevision = parsed.expectedRevision;
	let expectedRevision = parsed.expectedRevision;
	for (let attempt = 0; attempt < 2; attempt += 1) {
		if (attempt > 0) retried = true;
		try {
			applied = await options.removeMember({
				memberId: parsed.memberId,
				expectedRevision
			});
			break;
		} catch (error) {
			if (!mutationConflict(error)) {
				if (invalidMutation(error)) sendJson(response, 400, { error: "live-teams invalid request" });
				else sendJson(response, 500, { error: "live-teams mutation failed" });
				return;
			}
			if (attempt === 1) break;
			try {
				state = await readTeamState(options);
			} catch {
				sendJson(response, 503, { error: "live-teams state unavailable" });
				return;
			}
			if (mutationMember(state, parsed.memberId) === void 0 || state.archivedMemberIds.includes(parsed.memberId)) {
				sendJson(response, 400, { error: "live-teams invalid request" });
				return;
			}
			expectedRevision = state.revision;
		}
	}
	if (applied === void 0) {
		try {
			state = await readTeamState(options);
		} catch {
			sendJson(response, 503, { error: "live-teams state unavailable" });
			return;
		}
		sendJson(response, 409, {
			error: "live-teams revision conflict",
			revision: state.revision,
			members: projectLiveTeamsSnapshot(state, options).members
		});
		return;
	}
	const removedSessionId = typeof applied.removed.sessionId === "string" ? applied.removed.sessionId : null;
	const event = {
		kind: "member/removed",
		memberId: applied.removed.memberId,
		displayName: applied.removed.displayName,
		role: applied.removed.role,
		sessionId: removedSessionId,
		at: Date.now(),
		actor: actorFor(request, ctx.webServer.port),
		expectedRevision: originalExpectedRevision,
		appliedRevision: applied.state.revision
	};
	try {
		await options.appendAudit(event);
	} catch {
		sendJson(response, 500, { error: "live-teams mutation failed" });
		return;
	}
	sendJson(response, 200, {
		teamId: options.teamId,
		memberId: applied.removed.memberId,
		revision: applied.state.revision,
		applied: true,
		retried,
		removed: {
			memberId: applied.removed.memberId,
			displayName: applied.removed.displayName,
			role: applied.removed.role,
			sessionId: removedSessionId
		}
	});
}
async function handleInterrupt(request, response, ctx, options) {
	if (!authorityAllowed(request, ctx.webServer.port)) {
		sendJson(response, 403, { error: "live-teams request authority rejected" });
		return;
	}
	if (request.method !== "POST") {
		sendJson(response, 405, { error: "live-teams method not allowed" });
		return;
	}
	if (bodyContentType(request) !== "application/json") {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	const declaredLength = headerValue(request.headers["content-length"]);
	if (declaredLength !== void 0 && /^\d+$/u.test(declaredLength) && Number(declaredLength) > MAX_MUTATION_BODY_BYTES) {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	let memberId;
	try {
		const body = record(JSON.parse(await requestBody(request)));
		memberId = requiredText(body.memberId);
		if (requiredText(body.sessionId) === void 0 || memberId === void 0) throw new Error("invalid interrupt");
	} catch {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	if (options.interrupt === void 0 || options.appendAudit === void 0) {
		sendJson(response, 500, { error: "live-teams mutation failed" });
		return;
	}
	let state;
	try {
		state = await readTeamState(options);
	} catch {
		sendJson(response, 503, { error: "live-teams state unavailable" });
		return;
	}
	const member = mutationMember(state, memberId);
	if (member === void 0) {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	if (typeof member.sessionId !== "string" || member.sessionId.length === 0) {
		await options.appendAudit?.({
			kind: "member/interrupt-refused",
			memberId,
			reason: "no-session",
			actor: actorFor(request, ctx.webServer.port),
			at: Date.now()
		});
		sendJson(response, 409, { error: "live-teams member has no running turn" });
		return;
	}
	const sessionId = member.sessionId;
	const before = statusOf(liveAgentOf(options.agents, sessionId));
	if (before !== "running") {
		await options.appendAudit?.({
			kind: "member/interrupt-refused",
			memberId,
			sessionId,
			reason: `idle (${before})`,
			actor: actorFor(request, ctx.webServer.port),
			at: Date.now()
		});
		sendJson(response, 409, { error: "live-teams member has no running turn" });
		return;
	}
	try {
		await options.interrupt(sessionId, "human:desktop interrupt turn");
	} catch {
		await options.appendAudit?.({
			kind: "member/interrupt-refused",
			memberId,
			sessionId,
			reason: "interrupt failed",
			actor: actorFor(request, ctx.webServer.port),
			at: Date.now()
		});
		sendJson(response, 500, { error: "live-teams mutation failed" });
		return;
	}
	const after = statusOf(liveAgentOf(options.agents, sessionId));
	try {
		await options.appendAudit?.({
			kind: "member/interrupted",
			memberId,
			sessionId,
			actor: actorFor(request, ctx.webServer.port),
			at: Date.now()
		});
	} catch {
		sendJson(response, 500, { error: "live-teams mutation failed" });
		return;
	}
	sendJson(response, 200, {
		memberId,
		interrupted: true,
		status: after
	});
}
async function handleMutation(request, response, ctx, options, kind) {
	if (!authorityAllowed(request, ctx.webServer.port)) {
		sendJson(response, 403, { error: "live-teams request authority rejected" });
		return;
	}
	if (request.method !== "POST") {
		sendJson(response, 405, { error: "live-teams method not allowed" });
		return;
	}
	if (bodyContentType(request) !== "application/json") {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	const declaredLength = headerValue(request.headers["content-length"]);
	if (declaredLength !== void 0 && /^\d+$/u.test(declaredLength) && Number(declaredLength) > MAX_MUTATION_BODY_BYTES) {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	let parsed;
	try {
		parsed = parseMutation(await requestBody(request), kind);
	} catch {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	if (options.applyMutation === void 0 || options.appendAudit === void 0) {
		sendJson(response, 500, { error: "live-teams mutation failed" });
		return;
	}
	if (kind === "role" && (options.roles !== void 0 || options.readRoles !== void 0 || options.roleRegistry !== void 0)) {
		let registry;
		try {
			registry = await currentRoles(options);
		} catch {
			sendJson(response, 503, { error: "live-teams state unavailable" });
			return;
		}
		const resolvedRole = registry?.resolve(parsed.value);
		if (resolvedRole === void 0) {
			sendJson(response, 400, { error: "live-teams unknown role" });
			return;
		}
		parsed = {
			...parsed,
			value: resolvedRole.id
		};
	}
	let state;
	try {
		state = await readTeamState(options);
	} catch {
		sendJson(response, 503, { error: "live-teams state unavailable" });
		return;
	}
	if (mutationMember(state, parsed.memberId) === void 0) {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	let retried = false;
	let applied;
	const originalExpectedRevision = parsed.expectedRevision;
	let expectedRevision = parsed.expectedRevision;
	for (let attempt = 0; attempt < 2; attempt += 1) {
		if (attempt > 0) retried = true;
		try {
			applied = await options.applyMutation({
				kind,
				memberId: parsed.memberId,
				value: parsed.value,
				expectedRevision
			});
			break;
		} catch (error) {
			if (!mutationConflict(error)) {
				if (invalidMutation(error)) sendJson(response, 400, { error: "live-teams invalid request" });
				else sendJson(response, 500, { error: "live-teams mutation failed" });
				return;
			}
			if (attempt === 1) break;
			try {
				state = await readTeamState(options);
			} catch {
				sendJson(response, 503, { error: "live-teams state unavailable" });
				return;
			}
			if (mutationMember(state, parsed.memberId) === void 0) {
				sendJson(response, 400, { error: "live-teams invalid request" });
				return;
			}
			expectedRevision = state.revision;
		}
	}
	if (applied === void 0) {
		try {
			state = await readTeamState(options);
		} catch {
			sendJson(response, 503, { error: "live-teams state unavailable" });
			return;
		}
		sendJson(response, 409, {
			error: "live-teams revision conflict",
			revision: state.revision,
			members: projectLiveTeamsSnapshot(state, options).members
		});
		return;
	}
	const event = {
		kind: kind === "role" ? "member/role-changed" : kind === "availability" ? "member/availability-changed" : "member/name-changed",
		memberId: parsed.memberId,
		from: applied.from,
		to: applied.to,
		at: Date.now(),
		actor: actorFor(request, ctx.webServer.port),
		expectedRevision: originalExpectedRevision,
		appliedRevision: applied.state.revision
	};
	try {
		await options.appendAudit(event);
	} catch {
		sendJson(response, 500, { error: "live-teams mutation failed" });
		return;
	}
	if (kind === "name") await appendSessionTitleAudit(options, applied.member.sessionId ?? "", applied.sessionTitle, actorFor(request, ctx.webServer.port));
	const member = projectLiveTeamsSnapshot(applied.state, options).members.find((entry) => entry.memberId === parsed.memberId);
	if (member === void 0) {
		sendJson(response, 500, { error: "live-teams mutation failed" });
		return;
	}
	sendJson(response, 200, {
		teamId: options.teamId,
		memberId: parsed.memberId,
		revision: applied.state.revision,
		applied: true,
		retried,
		member
	});
}
const requestBodies = /* @__PURE__ */ new WeakMap();
async function requestBody(request) {
	const key = request;
	const existing = requestBodies.get(key);
	if (existing !== void 0) return existing;
	const pending = readRequestBody(request);
	requestBodies.set(key, pending);
	return pending;
}
/**
* Which Session scopes this request — not which Session the request is about.
*
* Those are two different subjects, and one field cannot carry both: a body
* `sessionId` on `POST /api/live-teams/members` names the Session that JOINS the
* team, while the scope names the Session whose tab is asking. Reading the query
* first keeps them apart; the body form stays supported for the routes whose
* payload has no Session of its own.
*/
async function requestSessionId(request) {
	try {
		const raw = request.url === void 0 ? void 0 : new URL(request.url, "http://127.0.0.1").searchParams.get("session");
		const scoped = raw === null ? void 0 : requiredText(raw);
		if (scoped !== void 0) return scoped;
	} catch {}
	if (request.method === "GET") return void 0;
	try {
		return requiredText(record(JSON.parse(await requestBody(request))).sessionId);
	} catch {
		return;
	}
}
async function resolveOptions(request, options, sessionId) {
	if (options.resolveRequest === void 0) return options;
	return options.resolveRequest(request, sessionId);
}
async function withResolvedOptions(request, response, options, handler, requireEnabled = false) {
	let resolved;
	const sessionId = await requestSessionId(request);
	try {
		resolved = await resolveOptions(request, options, sessionId);
	} catch {
		resolved = void 0;
	}
	if (resolved === void 0 || options.resolveRequest !== void 0 && sessionId === void 0 && request.method === "GET") {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	if (requireEnabled && resolved.teamEnabled !== void 0) try {
		if (!await resolved.teamEnabled()) {
			sendJson(response, 503, { error: "live-teams team disabled" });
			return;
		}
	} catch {
		sendJson(response, 503, { error: "live-teams state unavailable" });
		return;
	}
	await handler(resolved);
}
function taskRouteSummary(route, state) {
	if (route === void 0) return void 0;
	if (route.type === "report") {
		if (route.to === "human") return {
			type: "report",
			to: "human"
		};
		const recipient = state.members.find((member) => member.memberId === route.to);
		return recipient === void 0 ? {
			type: "report",
			to: route.to
		} : {
			type: "report",
			to: route.to,
			toName: recipient.displayName
		};
	}
	if (route.type === "review") {
		const reviewer = state.members.find((member) => member.memberId === route.reviewer);
		return reviewer === void 0 ? {
			type: "review",
			reviewer: route.reviewer
		} : {
			type: "review",
			reviewer: route.reviewer,
			reviewerName: reviewer.displayName
		};
	}
	if (route.type === "interactive") {
		const nested = taskRouteSummary(route.then, state);
		return nested === void 0 ? void 0 : {
			type: "interactive",
			then: nested
		};
	}
	return {
		type: "custom",
		description: route.description
	};
}
function taskSummary(task, state, tasks = []) {
	const assignee = task.assignee === void 0 ? void 0 : state.members.find((member) => member.memberId === task.assignee);
	const route = taskRouteSummary(task.route, state);
	const blockers = blockedBy(task, tasks);
	return {
		id: task.id,
		title: task.title,
		status: task.status,
		...task.awaitsDecision === true ? { awaitsDecision: true } : {},
		...task.reviewReturn === void 0 ? {} : { reviewReturn: parseReviewReturn(task.reviewReturn) },
		...task.assignee === void 0 ? {} : { assignee: task.assignee },
		...assignee === void 0 ? {} : { assigneeName: assignee.displayName },
		...route === void 0 ? {} : { route },
		...task.round === void 0 ? {} : { round: task.round },
		roundLimit: task.roundLimit,
		updatedAt: task.updatedAt,
		...task.archivedPath === void 0 ? {} : { archivedPath: task.archivedPath },
		...task.documentMissing === true ? { documentMissing: true } : {},
		...task.dependsOn === void 0 ? {} : { dependsOn: task.dependsOn },
		...blockers.length === 0 ? {} : { blockedBy: blockers }
	};
}
function taskErrorStatus(error) {
	if (error instanceof LiveTeamsError && error.code === ERROR_CODES.STATE_CORRUPT) return 503;
	if (error instanceof LiveTeamsError && error.code === ERROR_CODES.CAPABILITY_UNAVAILABLE) return 400;
	return 500;
}
function taskErrorBody(error) {
	if (taskErrorStatus(error) === 503) return { error: "live-teams state unavailable" };
	if (error instanceof LiveTeamsError) return { error: error.message };
	return { error: "live-teams mutation failed" };
}
function journalCategory(kind) {
	const family = kind.split("/", 1)[0] ?? "";
	if (family === "message") return "message";
	if (family === "delivery") return "delivery";
	if (family === "task" || family === "attempt" || family === "submission") return "task";
	if (family === "review") return "review";
	if (family === "contact") return "contact";
	if (family === "team" || kind === "briefing/updated") return "team";
	if (family === "member" || kind === "session/titled") return "member";
	return "other";
}
function journalText(value) {
	return typeof value === "string" && value.trim().length > 0 ? value.trim() : void 0;
}
function journalActor(recordValue, members) {
	const actor = journalText(recordValue.actor);
	if (actor === void 0) return {};
	if (actor === "scheduler") return {
		actor,
		actorName: "scheduler"
	};
	if (actor === "human" || actor === "human:desktop") return {
		actor,
		actorName: "human"
	};
	const name = members.get(actor);
	return name === void 0 ? { actor } : {
		actor,
		actorName: name
	};
}
function journalVerb(kind) {
	return (kind.split("/")[1] ?? kind).replaceAll("-", " ");
}
function journalSummary(recordValue, kind, actorName, refs, nameOf, info) {
	const actor = actorName === void 0 ? "" : `${actorName} `;
	const task = refs.taskTitle ?? refs.taskId;
	const action = journalVerb(kind);
	const who = (value) => {
		const id = journalText(value);
		return id === void 0 ? void 0 : nameOf(id);
	};
	if (kind === "review/returned") return `${actor}${{
		pending: "review return queued",
		sending: "review notification delivery pending",
		delivered: "review notification delivered; launch unconfirmed",
		started: "Session launch confirmed",
		completed: "Session processed review request (not acceptance)",
		blocked: "automatic review return blocked",
		failed: "review return or launch failed",
		unconfirmed: "Session launch unconfirmed",
		superseded: "review return no longer current"
	}[String(recordValue.state)] ?? "review return state unknown"}${task === void 0 ? "" : ` · ${task}`}`;
	if (kind === "review/lead-notified") return `${actor}lead notified of review return${task === void 0 ? "" : ` · ${task}`}`;
	if (kind === "message/sent") return `${actor}sent ${journalText(recordValue.messageKind) ?? "message"} to ${who(recordValue.to) ?? "the team"}`;
	if (kind.startsWith("delivery/")) {
		const recipient = who(recordValue.recipient) ?? "someone";
		const sender = info?.from === void 0 ? void 0 : nameOf(info.from);
		const whose = sender === void 0 ? "a message" : `a message from ${sender}`;
		const failure = journalText(recordValue.reason) ?? journalText(recordValue.failure);
		if (kind === "delivery/failed") return `${whose} to ${recipient} failed${failure === void 0 ? "" : `: ${failure}`}`;
		if (kind === "delivery/acknowledged") return `${recipient} acknowledged ${whose}`;
		if (kind === "delivery/leased") return `${recipient} picked up ${whose}`;
		if (kind === "delivery/delivered") return `${whose} reached ${recipient}`;
		return `${whose} queued for ${recipient}`;
	}
	if (journalCategory(kind) === "task") return `${actor}${action}${task === void 0 ? "" : ` · ${task}`}`;
	if (journalCategory(kind) === "review") return `${actor}review ${refs.round === void 0 ? "" : `round ${refs.round} `}${journalText(recordValue.verdict) ?? action}${task === void 0 ? "" : ` · ${task}`}`;
	if (journalCategory(kind) === "contact") return `${actor}${action}${journalText(recordValue.from) === void 0 ? "" : ` · ${who(recordValue.from) ?? "someone"} → ${who(recordValue.to) ?? "target"}`}`;
	if (journalCategory(kind) === "member") return `${actor}${action}${journalText(recordValue.displayName) === void 0 && journalText(recordValue.memberId) === void 0 ? "" : ` · ${journalText(recordValue.displayName) ?? journalText(recordValue.memberId)}`}`;
	if (journalCategory(kind) === "team") {
		const from = journalText(recordValue.from);
		const to = journalText(recordValue.to);
		const transition = from === void 0 || to === void 0 ? journalText(recordValue.name) : `${from} → ${to}`;
		return `${actor}${action}${transition === void 0 ? "" : ` · ${transition}`}`;
	}
	const detail = journalText(recordValue.detail) ?? journalText(recordValue.note) ?? journalText(recordValue.content);
	return `${actor}${kind || "audit event"}${detail === void 0 ? "" : ` · ${detail}`}`;
}
function projectJournal(events, state, limit, messages = /* @__PURE__ */ new Map()) {
	const memberNames = new Map(state.members.map((member) => [member.memberId, member.displayName]));
	const nameOf = (id) => memberNames.get(id) ?? (id === "human" ? "the human" : id === "scheduler" ? "the scheduler" : id);
	const taskTitles = /* @__PURE__ */ new Map();
	for (const raw of events) {
		const value = record(raw);
		const createdTaskId = journalText(value.taskId) ?? (journalText(value.kind) === "task/created" ? journalText(value.id) : void 0);
		const title = journalText(value.taskTitle) ?? (journalText(value.kind) === "task/created" ? journalText(value.title) : void 0);
		if (createdTaskId !== void 0 && title !== void 0) taskTitles.set(createdTaskId, title);
	}
	const start = Math.max(0, events.length - limit);
	return events.slice(start).reverse().map((raw, offset) => {
		const value = record(raw);
		const kind = journalText(value.kind) ?? "unknown";
		const category = journalCategory(kind);
		const actor = journalActor(value, memberNames);
		const taskId = journalText(value.taskId) ?? (category === "task" ? journalText(value.id) : void 0);
		const taskTitle = journalText(value.taskTitle) ?? journalText(value.title) ?? (taskId === void 0 ? void 0 : taskTitles.get(taskId));
		const messageId = journalText(value.messageId);
		const round = typeof value.round === "number" && Number.isInteger(value.round) && value.round > 0 ? value.round : void 0;
		const refs = {
			...taskId === void 0 ? {} : { taskId },
			...taskTitle === void 0 ? {} : { taskTitle },
			...messageId === void 0 ? {} : { messageId },
			...round === void 0 ? {} : { round }
		};
		const at = typeof value.at === "number" && Number.isFinite(value.at) && value.at >= 0 ? value.at : 0;
		const info = messageId === void 0 ? void 0 : messages.get(messageId);
		const detail = kind === "message/sent" ? journalText(value.content) ?? journalText(value.body) ?? info?.content : void 0;
		const fields = [];
		if (actor.actorName !== void 0 || journalText(value.actor) !== void 0) fields.push({
			label: "Actor",
			value: `${actor.actorName ?? journalText(value.actor) ?? "—"}${journalText(value.actor) === void 0 ? "" : ` (${journalText(value.actor)})`}`
		});
		for (const [label, raw] of [
			["To", value.to],
			["From", value.from],
			["Member", value.memberId],
			["Recipient", value.recipient]
		]) {
			const id = journalText(raw);
			if (id !== void 0) fields.push({
				label,
				value: `${nameOf(id)}${nameOf(id) === id ? "" : ` (${id})`}`
			});
		}
		if (info !== void 0) fields.push({
			label: "Message from",
			value: `${nameOf(info.from)} (${info.from})`
		}, {
			label: "Message kind",
			value: info.kind
		});
		if (taskId !== void 0) fields.push({
			label: "Task",
			value: `${taskTitle ?? "—"} (${taskId})`
		});
		for (const [label, raw] of [
			["Attempt", value.attemptId],
			["Submission", value.submissionId],
			["Message", value.messageId],
			["Delivery", value.deliveryId]
		]) {
			const id = journalText(raw);
			if (id !== void 0) fields.push({
				label,
				value: id
			});
		}
		if (round !== void 0) fields.push({
			label: "Round",
			value: String(round)
		});
		if (kind === "review/returned" || kind === "review/lead-notified") {
			if (journalText(value.state) !== void 0) fields.push({
				label: "Return state",
				value: String(value.state)
			});
			for (const [label, field] of [
				["Review", "roundId"],
				["Request", "requestId"],
				["Turn", "turn"],
				["Input seq", "inputSeq"]
			]) if (typeof value[field] === "string" || typeof value[field] === "number") fields.push({
				label,
				value: String(value[field])
			});
		}
		const verdict = journalText(value.verdict);
		if (verdict !== void 0) fields.push({
			label: "Verdict",
			value: verdict
		});
		const reason = journalText(value.reason) ?? journalText(value.detail) ?? journalText(value.note);
		if (reason !== void 0) fields.push({
			label: "Why",
			value: reason
		});
		fields.push({
			label: "At",
			value: new Date(at).toISOString()
		});
		const summary = journalSummary(value, kind, actor.actorName, refs, nameOf, info).replaceAll(/\s+/gu, " ").trim() || "Team audit event";
		const namedIds = [
			value.to,
			value.from,
			value.recipient,
			value.memberId
		].map((raw) => journalText(raw)).filter((id) => id !== void 0);
		const summaryParts = splitByNames(summary, [
			actor.actorName ?? "",
			...info === void 0 ? [] : [nameOf(info.from), nameOf(info.to)],
			...namedIds.map(nameOf)
		]);
		const sourcePosition = start + (events.slice(start).length - 1 - offset);
		return {
			id: `journal-${sourcePosition}-${createHash("sha1").update(`${sourcePosition}:${JSON.stringify(raw)}`).digest("hex").slice(0, 16)}`,
			kind,
			category,
			at,
			...actor,
			summary,
			summaryParts,
			refs,
			fields,
			...detail === void 0 ? {} : { detail }
		};
	});
}
/** Split a summary so the names in it can be shown as names. Word boundaries keep a short name from
* matching inside a longer word. */
function splitByNames(text, names) {
	const unique = [...new Set(names.filter((name) => name.length > 0))].sort((left, right) => right.length - left.length);
	if (unique.length === 0) return [{ text }];
	const pattern = new RegExp(`\\b(${unique.map((name) => name.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&")).join("|")})\\b`, "gu");
	const parts = [];
	let cursor = 0;
	for (const match of text.matchAll(pattern)) {
		const start = match.index ?? 0;
		if (start > cursor) parts.push({ text: text.slice(cursor, start) });
		parts.push({
			text: match[0],
			strong: true
		});
		cursor = start + match[0].length;
	}
	if (cursor < text.length) parts.push({ text: text.slice(cursor) });
	return parts.length === 0 ? [{ text }] : parts;
}
function journalQuery(request) {
	try {
		const raw = request.url === void 0 ? void 0 : new URL(request.url, "http://127.0.0.1").searchParams.get("limit");
		if (raw === null || raw === void 0) return 100;
		if (!/^\d+$/u.test(raw)) return void 0;
		const value = Number(raw);
		return Number.isSafeInteger(value) && value >= 1 ? Math.min(500, value) : void 0;
	} catch {
		return;
	}
}
async function handleJournalList(request, response, ctx, options) {
	if (!authorityAllowed(request, ctx.webServer.port)) {
		sendJson(response, 403, { error: "live-teams request authority rejected" });
		return;
	}
	if (request.method !== "GET") {
		sendJson(response, 405, { error: "live-teams method not allowed" });
		return;
	}
	const limit = journalQuery(request);
	if (limit === void 0) {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	await withResolvedOptions(request, response, options, async (resolved) => {
		if (resolved.readEvents === void 0) {
			sendJson(response, 503, { error: "live-teams state unavailable" });
			return;
		}
		try {
			const state = await readTeamState(resolved);
			const after = journalOffset(request);
			if (after === null) {
				sendJson(response, 400, { error: "live-teams invalid request" });
				return;
			}
			const audit = await resolved.readEvents(after);
			const messages = /* @__PURE__ */ new Map();
			const kinds = new Set(audit.events.map((event) => journalText(record(event)?.kind) ?? ""));
			if (resolved.mailbox !== void 0 && (kinds.has("message/sent") || [...kinds].some((kind) => kind.startsWith("delivery/")))) try {
				for (const message of await resolved.mailbox.listMessages()) messages.set(message.id, {
					content: message.content,
					from: message.from,
					to: message.to,
					kind: message.kind
				});
			} catch {}
			sendJson(response, 200, {
				teamId: resolved.teamId,
				entries: projectJournal(audit.events, state, limit, messages),
				...audit.nextOffset === void 0 ? {} : { nextOffset: audit.nextOffset },
				...audit.truncated === true ? { truncated: true } : {}
			});
		} catch (error) {
			sendJson(response, error instanceof LiveTeamsError && error.code === ERROR_CODES.STATE_CORRUPT ? 503 : 500, { error: "live-teams state unavailable" });
		}
	}, true);
}
/**
* The journal cursor: the byte offset the previous read left off at.
* `undefined` means the caller has none; `null` means it sent a broken one (which is a 400, not a
* silent full read).
*/
function journalOffset(request) {
	try {
		const raw = new URL(request.url ?? "", "http://127.0.0.1").searchParams.get("after");
		if (raw === null || raw.length === 0) return void 0;
		const value = Number(raw);
		return Number.isInteger(value) && value >= 0 ? value : null;
	} catch {
		return null;
	}
}
function taskQuery(request, taskIdRequired) {
	try {
		const url = new URL(request.url ?? "", "http://127.0.0.1");
		const includeArchivedValue = url.searchParams.get("includeArchived");
		if (includeArchivedValue !== null && includeArchivedValue !== "true" && includeArchivedValue !== "false") return void 0;
		const taskId = url.searchParams.get("taskId");
		if (taskIdRequired && (taskId === null || requiredText(taskId) === void 0)) return void 0;
		return {
			includeArchived: includeArchivedValue === "true",
			...taskId === null ? {} : { taskId }
		};
	} catch {
		return;
	}
}
async function handleDispatch(request, response, ctx, options) {
	if (!authorityAllowed(request, ctx.webServer.port)) {
		sendJson(response, 403, { error: "live-teams request authority rejected" });
		return;
	}
	if (request.method === "GET") {
		await withResolvedOptions(request, response, options, async (resolved) => {
			if (resolved.readDispatch === void 0) {
				sendJson(response, 503, { error: "live-teams dispatch unavailable" });
				return;
			}
			try {
				const projection = await resolved.readDispatch();
				if (projection === void 0) {
					sendJson(response, 503, { error: "live-teams dispatch unavailable" });
					return;
				}
				sendJson(response, 200, projection);
			} catch (error) {
				sendJson(response, taskErrorStatus(error), taskErrorBody(error));
			}
		}, true);
		return;
	}
	if (request.method !== "POST" || bodyContentType(request) !== "application/json") {
		sendJson(response, request.method === "POST" ? 400 : 405, { error: request.method === "POST" ? "live-teams invalid request" : "live-teams method not allowed" });
		return;
	}
	let body;
	try {
		body = record(JSON.parse(await requestBody(request)));
	} catch {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	const mode = body.mode;
	const reason = body.reason;
	if (mode !== "auto" && mode !== "paused" || reason !== void 0 && typeof reason !== "string") {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	await withResolvedOptions(request, response, options, async (resolved) => {
		if (resolved.setDispatch === void 0) {
			sendJson(response, 503, { error: "live-teams dispatch unavailable" });
			return;
		}
		try {
			sendJson(response, 200, await resolved.setDispatch({
				mode,
				actor: actorFor(request, ctx.webServer.port),
				...reason === void 0 ? {} : { reason }
			}));
		} catch (error) {
			sendJson(response, taskErrorStatus(error), taskErrorBody(error));
		}
	}, true);
}
async function handleTasksList(request, response, ctx, options) {
	if (!authorityAllowed(request, ctx.webServer.port)) {
		sendJson(response, 403, { error: "live-teams request authority rejected" });
		return;
	}
	if (request.method !== "GET") {
		sendJson(response, 405, { error: "live-teams method not allowed" });
		return;
	}
	const query = taskQuery(request, false);
	if (query === void 0) {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	await withResolvedOptions(request, response, options, async (resolved) => {
		if (resolved.taskStore === void 0) {
			sendJson(response, 503, { error: "live-teams state unavailable" });
			return;
		}
		let state;
		try {
			state = await readTeamState(resolved);
		} catch {
			sendJson(response, 503, { error: "live-teams state unavailable" });
			return;
		}
		try {
			const listed = await resolved.taskStore.listTasks({ includeArchived: query.includeArchived });
			sendJson(response, 200, {
				teamId: resolved.teamId,
				tasks: listed.map((task) => taskSummary(task, state, listed))
			});
		} catch (error) {
			sendJson(response, taskErrorStatus(error), taskErrorStatus(error) === 503 ? { error: "live-teams state unavailable" } : { error: "live-teams snapshot unavailable" });
		}
	}, true);
}
async function handleTaskRead(request, response, ctx, options) {
	if (!authorityAllowed(request, ctx.webServer.port)) {
		sendJson(response, 403, { error: "live-teams request authority rejected" });
		return;
	}
	if (request.method !== "GET") {
		sendJson(response, 405, { error: "live-teams method not allowed" });
		return;
	}
	const query = taskQuery(request, true);
	if (query === void 0 || query.taskId === void 0) {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	const taskId = query.taskId;
	await withResolvedOptions(request, response, options, async (resolved) => {
		if (resolved.taskStore === void 0) {
			sendJson(response, 503, { error: "live-teams state unavailable" });
			return;
		}
		try {
			sendJson(response, 200, await resolved.taskStore.readTask(taskId));
		} catch (error) {
			sendJson(response, taskErrorStatus(error), taskErrorBody(error));
		}
	}, true);
}
/**
* The human's task surface (review finding 4): create a task, change a draft or ready contract,
* release an attempt. Until this existed the highest authority in the model had to write to the lead
* and wait a model turn to get work started, and a wedged attempt had no direct control path at all.
*
* The operations are the same ones the lead's tools call — no second implementation, no second set of
* rules. What differs is who is asking, and the audit says which of the two human actors it was.
*/
async function handleTaskControl(request, response, ctx, options, operation) {
	if (!authorityAllowed(request, ctx.webServer.port)) {
		sendJson(response, 403, { error: "live-teams request authority rejected" });
		return;
	}
	if (request.method !== "POST" || bodyContentType(request) !== "application/json") {
		sendJson(response, request.method === "POST" ? 400 : 405, { error: request.method === "POST" ? "live-teams invalid request" : "live-teams method not allowed" });
		return;
	}
	let body;
	try {
		body = record(JSON.parse(await requestBody(request)));
	} catch {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	const actor = actorFor(request, ctx.webServer.port);
	await withResolvedOptions(request, response, options, async (resolved) => {
		if (resolved.taskStore === void 0) {
			sendJson(response, 503, { error: "live-teams state unavailable" });
			return;
		}
		try {
			if (operation === "create") {
				const title = requiredText(body.title);
				const kind = requiredText(body.kind);
				const assignee = requiredText(body.assignee);
				const acceptance = stringList(body.acceptance);
				if (title === void 0 || kind === void 0 || assignee === void 0 || acceptance === void 0 || acceptance.length === 0) {
					sendJson(response, 400, { error: "live-teams invalid request" });
					return;
				}
				const why = requiredText(body.why);
				const taskBody = requiredText(body.body);
				const checks = stringList(body.checks);
				const paths = stringList(body.paths);
				const route = record(body.route);
				sendJson(response, 200, await resolved.taskStore.createTask({
					title,
					kind,
					assignee,
					acceptance,
					actor,
					...why === void 0 ? {} : { why },
					...taskBody === void 0 ? {} : { body: taskBody },
					...checks === void 0 ? {} : { checks },
					...paths === void 0 ? {} : { paths },
					...route === void 0 ? {} : { route },
					...typeof body.roundLimit === "number" ? { roundLimit: body.roundLimit } : {}
				}));
				return;
			}
			const taskId = requiredText(body.taskId);
			if (taskId === void 0) {
				sendJson(response, 400, { error: "live-teams invalid request" });
				return;
			}
			if (operation === "update") {
				sendJson(response, 200, await resolved.taskStore.updateTask({
					taskId,
					actor,
					...requiredText(body.title) === void 0 ? {} : { title: requiredText(body.title) },
					...requiredText(body.kind) === void 0 ? {} : { kind: requiredText(body.kind) },
					...requiredText(body.assignee) === void 0 ? {} : { assignee: requiredText(body.assignee) },
					...stringList(body.acceptance) === void 0 ? {} : { acceptance: stringList(body.acceptance) },
					...stringList(body.checks) === void 0 ? {} : { checks: stringList(body.checks) },
					...stringList(body.paths) === void 0 ? {} : { paths: stringList(body.paths) },
					...requiredText(body.body) === void 0 ? {} : { body: requiredText(body.body) },
					...typeof body.expectedRevision === "number" ? { expectedRevision: body.expectedRevision } : {}
				}));
				return;
			}
			const reason = requiredText(body.reason);
			if (reason === void 0) {
				sendJson(response, 400, { error: "live-teams invalid request" });
				return;
			}
			sendJson(response, 200, await resolved.taskStore.revokeTask({
				taskId,
				actor,
				reason
			}));
		} catch (error) {
			sendJson(response, taskErrorStatus(error), taskErrorBody(error));
		}
	}, true);
}
function stringList(value) {
	return Array.isArray(value) && value.every((entry) => typeof entry === "string") ? value : void 0;
}
async function handleTaskMutation(request, response, ctx, options, operation) {
	if (!authorityAllowed(request, ctx.webServer.port)) {
		sendJson(response, 403, { error: "live-teams request authority rejected" });
		return;
	}
	if (request.method !== "POST" || bodyContentType(request) !== "application/json") {
		sendJson(response, request.method === "POST" ? 400 : 405, { error: request.method === "POST" ? "live-teams invalid request" : "live-teams method not allowed" });
		return;
	}
	let body;
	try {
		body = record(JSON.parse(await requestBody(request)));
	} catch {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	const taskId = requiredText(body.taskId);
	const sessionId = requiredText(body.sessionId);
	const note = body.note;
	const instructions = body.instructions;
	const reason = body.reason;
	const expectedRevision = body.expectedRevision;
	if (expectedRevision !== void 0 && (typeof expectedRevision !== "number" || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0)) {
		sendJson(response, 400, { error: "live-teams invalid revision" });
		return;
	}
	if (operation === "cancel" && (typeof reason !== "string" || reason.trim().length === 0)) {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	if (operation === "notify-submission" && requiredText(body.submissionId) === void 0) {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	if (operation === "notify-review" && requiredText(body.roundId) === void 0) {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	if (taskId === void 0 || sessionId === void 0 || operation === "revise" && (typeof instructions !== "string" || instructions.trim().length === 0) || operation === "accept" && note !== void 0 && typeof note !== "string") {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	await withResolvedOptions(request, response, options, async (resolved) => {
		if (resolved.taskStore === void 0) {
			sendJson(response, 503, { error: "live-teams state unavailable" });
			return;
		}
		try {
			if (operation === "notify-review") sendJson(response, 200, { notifications: await resolved.taskStore.requestReviewNotification(taskId, requiredText(body.roundId), actorFor(request, ctx.webServer.port)) });
			else if (operation === "notify-submission") sendJson(response, 200, { notifications: await resolved.taskStore.requestSubmissionNotification(taskId, requiredText(body.submissionId), actorFor(request, ctx.webServer.port)) });
			else if (operation === "cancel") sendJson(response, 200, await resolved.taskStore.cancelTask({
				taskId,
				actor: actorFor(request, ctx.webServer.port),
				reason: reason.trim(),
				...expectedRevision === void 0 ? {} : { expectedRevision }
			}));
			else if (operation === "resume") sendJson(response, 200, await resolved.taskStore.resumeTask({
				taskId,
				actor: actorFor(request, ctx.webServer.port),
				...expectedRevision === void 0 ? {} : { expectedRevision }
			}));
			else if (operation === "accept") sendJson(response, 200, await resolved.taskStore.acceptTask({
				taskId,
				actor: actorFor(request, ctx.webServer.port),
				...note === void 0 ? {} : { note }
			}));
			else sendJson(response, 200, await resolved.taskStore.reviseTask({
				taskId,
				actor: actorFor(request, ctx.webServer.port),
				instructions
			}));
		} catch (error) {
			sendJson(response, taskErrorStatus(error), taskErrorBody(error));
		}
	}, true);
}
function leadResolution(state) {
	const resolved = resolveLeadMemberId(state);
	if (resolved === void 0) return { resolvedFrom: "none" };
	return {
		leadMemberId: resolved,
		resolvedFrom: state.leadMemberId === resolved ? "state" : "role"
	};
}
async function handleTeamLead(request, response, ctx, options) {
	if (!authorityAllowed(request, ctx.webServer.port)) {
		sendJson(response, 403, { error: "live-teams request authority rejected" });
		return;
	}
	if (request.method === "GET") {
		try {
			sendJson(response, 200, leadResolution(await readTeamState(options)));
		} catch {
			sendJson(response, 503, { error: "live-teams state unavailable" });
		}
		return;
	}
	if (request.method !== "POST" || bodyContentType(request) !== "application/json") {
		sendJson(response, request.method === "POST" ? 400 : 405, { error: request.method === "POST" ? "live-teams invalid request" : "live-teams method not allowed" });
		return;
	}
	let memberId;
	try {
		const body = record(JSON.parse(await requestBody(request)));
		if (body.sessionId === void 0) throw new Error("invalid lead");
		if (typeof body.memberId !== "string") throw new Error("invalid lead");
		memberId = body.memberId.length === 0 ? void 0 : requiredText(body.memberId);
	} catch {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	try {
		const state = await readTeamState(options);
		if (memberId !== void 0 && !state.members.some((member) => member.memberId === memberId)) {
			sendJson(response, 400, { error: "live-teams invalid request" });
			return;
		}
		if (options.setLead === void 0) {
			sendJson(response, 500, { error: "live-teams mutation failed" });
			return;
		}
		const expectedRevision = state.revision;
		const result = await options.setLead(memberId, expectedRevision);
		await options.appendAudit?.(memberId === void 0 ? {
			kind: "team/lead-cleared",
			actor: actorFor(request, ctx.webServer.port),
			at: Date.now()
		} : {
			kind: "team/lead",
			memberId,
			actor: actorFor(request, ctx.webServer.port),
			at: Date.now()
		});
		sendJson(response, 200, { ...result.leadMemberId === void 0 ? {} : { leadMemberId: result.leadMemberId } });
	} catch (error) {
		if (mutationConflict(error)) sendJson(response, 409, { error: "live-teams revision conflict" });
		else sendJson(response, 500, { error: "live-teams mutation failed" });
	}
}
async function handleBriefingOpen(request, response, ctx, options) {
	if (!authorityAllowed(request, ctx.webServer.port)) {
		sendJson(response, 403, { error: "live-teams request authority rejected" });
		return;
	}
	if (request.method !== "POST" || bodyContentType(request) !== "application/json") {
		sendJson(response, request.method === "POST" ? 400 : 405, { error: request.method === "POST" ? "live-teams invalid request" : "live-teams method not allowed" });
		return;
	}
	if (options.canOpenWorkspacePath === void 0 || options.openWorkspacePath === void 0) {
		sendJson(response, 503, { error: "live-teams open unavailable" });
		return;
	}
	let canOpen = false;
	try {
		canOpen = await options.canOpenWorkspacePath();
	} catch {
		canOpen = false;
	}
	if (!canOpen) {
		sendJson(response, 503, { error: "live-teams open unavailable" });
		return;
	}
	try {
		const file = path.join(options.workspacePath, ".dsh-live-teams", "BRIEF.md");
		await options.openWorkspacePath({
			path: file,
			action: "open"
		}, new AbortController().signal);
		sendJson(response, 200, { opened: file });
	} catch {
		sendJson(response, 503, { error: "live-teams open unavailable" });
	}
}
async function handleTeamStatus(request, response, ctx, options) {
	if (!authorityAllowed(request, ctx.webServer.port)) {
		sendJson(response, 403, { error: "live-teams request authority rejected" });
		return;
	}
	if (request.method !== "GET") {
		sendJson(response, 405, { error: "live-teams method not allowed" });
		return;
	}
	await withResolvedOptions(request, response, options, async (resolved) => {
		if (resolved.teamStatus === void 0) {
			sendJson(response, 503, { error: "live-teams state unavailable" });
			return;
		}
		try {
			const status = await resolved.teamStatus();
			let briefing = "";
			try {
				briefing = (await readFile(path.join(resolved.workspacePath, ".dsh-live-teams", "BRIEF.md"), "utf8")).trim();
			} catch {}
			let openAvailable = false;
			try {
				openAvailable = resolved.canOpenWorkspacePath === void 0 ? false : await resolved.canOpenWorkspacePath();
			} catch {
				openAvailable = false;
			}
			sendJson(response, 200, {
				...status,
				briefing,
				openAvailable
			});
		} catch {
			sendJson(response, 503, { error: "live-teams state unavailable" });
		}
	});
}
async function handleTeamEnable(request, response, ctx, options) {
	if (!authorityAllowed(request, ctx.webServer.port)) {
		sendJson(response, 403, { error: "live-teams request authority rejected" });
		return;
	}
	if (request.method !== "POST" || bodyContentType(request) !== "application/json") {
		sendJson(response, request.method === "POST" ? 400 : 405, { error: request.method === "POST" ? "live-teams invalid request" : "live-teams method not allowed" });
		return;
	}
	let name;
	let createNew = false;
	try {
		const body = record(JSON.parse(await requestBody(request)));
		if (body.name !== void 0 && codePointText(body.name) === void 0) throw new Error("invalid name");
		if (body.createNew !== void 0 && typeof body.createNew !== "boolean") throw new Error("invalid createNew");
		name = body.name === void 0 ? void 0 : codePointText(body.name);
		createNew = body.createNew === true;
		if (body.sessionId === void 0) throw new Error("missing session");
	} catch {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	await withResolvedOptions(request, response, options, async (resolved) => {
		if (resolved.enableTeam === void 0) {
			sendJson(response, 500, { error: "live-teams mutation failed" });
			return;
		}
		try {
			sendJson(response, 200, await resolved.enableTeam(name, createNew));
		} catch (error) {
			if (error instanceof LiveTeamsError && error.auditDetail === "existing team found") {
				sendJson(response, 409, {
					error: "live-teams existing team found",
					candidates: error.details.candidates ?? []
				});
				return;
			}
			sendJson(response, 500, { error: "live-teams mutation failed" });
		}
	});
}
async function handleTeamCandidates(request, response, ctx, options) {
	if (!authorityAllowed(request, ctx.webServer.port)) {
		sendJson(response, 403, { error: "live-teams request authority rejected" });
		return;
	}
	if (request.method !== "GET") {
		sendJson(response, 405, { error: "live-teams method not allowed" });
		return;
	}
	await withResolvedOptions(request, response, options, async (resolved) => {
		if (resolved.listTeamCandidates === void 0) {
			sendJson(response, 500, { error: "live-teams snapshot unavailable" });
			return;
		}
		try {
			sendJson(response, 200, {
				teamId: resolved.teamId,
				workspacePath: resolved.workspacePath,
				candidates: await resolved.listTeamCandidates()
			});
		} catch {
			sendJson(response, 503, { error: "live-teams state unavailable" });
		}
	});
}
async function handleTeamAdopt(request, response, ctx, options) {
	if (!authorityAllowed(request, ctx.webServer.port)) {
		sendJson(response, 403, { error: "live-teams request authority rejected" });
		return;
	}
	if (request.method !== "POST" || bodyContentType(request) !== "application/json") {
		sendJson(response, request.method === "POST" ? 400 : 405, { error: request.method === "POST" ? "live-teams invalid request" : "live-teams method not allowed" });
		return;
	}
	let candidateTeamId;
	let replaceEmptyDerived = false;
	try {
		const body = record(JSON.parse(await requestBody(request)));
		if (!safeTeamId(body.teamId)) throw new Error("invalid team id");
		if (body.replaceEmptyDerived !== void 0 && typeof body.replaceEmptyDerived !== "boolean") throw new Error("invalid replacement flag");
		if (body.sessionId === void 0) throw new Error("missing session");
		candidateTeamId = body.teamId;
		replaceEmptyDerived = body.replaceEmptyDerived === true;
	} catch {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	await withResolvedOptions(request, response, options, async (resolved) => {
		if (resolved.adoptTeam === void 0 || candidateTeamId === void 0) {
			sendJson(response, 500, { error: "live-teams mutation failed" });
			return;
		}
		try {
			const adopted = await resolved.adoptTeam(candidateTeamId, replaceEmptyDerived);
			sendJson(response, 200, {
				...adopted.status,
				adoptedFrom: adopted.adoptedFrom
			});
		} catch (error) {
			const status = adoptionErrorStatus(error);
			sendJson(response, status, status === 400 ? { error: "live-teams invalid request" } : status === 409 ? { error: "live-teams derived team already exists" } : { error: "live-teams mutation failed" });
		}
	});
}
async function handleTeamDisable(request, response, ctx, options) {
	if (!authorityAllowed(request, ctx.webServer.port)) {
		sendJson(response, 403, { error: "live-teams request authority rejected" });
		return;
	}
	if (request.method !== "POST") {
		sendJson(response, 405, { error: "live-teams method not allowed" });
		return;
	}
	if (bodyContentType(request) !== "application/json") {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	await withResolvedOptions(request, response, options, async (resolved) => {
		if (resolved.disableTeam === void 0) {
			sendJson(response, 500, { error: "live-teams mutation failed" });
			return;
		}
		try {
			sendJson(response, 200, await resolved.disableTeam());
		} catch {
			sendJson(response, 500, { error: "live-teams mutation failed" });
		}
	});
}
function messageKind(value) {
	return value === "message" || value === "direction" || value === "comment";
}
function mailboxErrorStatus(error) {
	if (error instanceof LiveTeamsError && error.code === ERROR_CODES.STATE_CORRUPT) return 503;
	if (error instanceof LiveTeamsError && (error.code === ERROR_CODES.CAPABILITY_UNAVAILABLE || error.code === ERROR_CODES.DELIVERY_REJECTED)) return 400;
	return 500;
}
function mailboxErrorBody(error) {
	const status = mailboxErrorStatus(error);
	if (status !== 400) return { error: status === 503 ? "live-teams state unavailable" : "live-teams mutation failed" };
	if (error instanceof LiveTeamsError) {
		const candidates = error.details.candidates;
		const recipients = error.details.recipients;
		if (Array.isArray(candidates) && candidates.every((value) => typeof value === "string")) return {
			error: "live-teams invalid request",
			candidates
		};
		if (Array.isArray(recipients) && recipients.every((value) => typeof value === "string")) return {
			error: "live-teams invalid request",
			recipients
		};
	}
	return { error: "live-teams invalid request" };
}
async function handleGrant(request, response, ctx, options) {
	if (!authorityAllowed(request, ctx.webServer.port)) {
		sendJson(response, 403, { error: "live-teams request authority rejected" });
		return;
	}
	if (request.method !== "POST" || bodyContentType(request) !== "application/json") {
		sendJson(response, request.method === "POST" ? 400 : 405, { error: request.method === "POST" ? "live-teams invalid request" : "live-teams method not allowed" });
		return;
	}
	let parsed;
	try {
		parsed = parseGrant(await requestBody(request));
	} catch {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	try {
		const state = await readTeamState(options);
		if (!state.members.some((member) => member.memberId === parsed.memberId) || !(state.members.some((member) => member.memberId === parsed.allow) || parsed.allow === "human" || parsed.allow === "team")) {
			sendJson(response, 400, { error: "live-teams invalid request" });
			return;
		}
		if (options.setContactGrant === void 0) {
			sendJson(response, 500, { error: "live-teams mutation failed" });
			return;
		}
		sendJson(response, 200, { grants: (await options.setContactGrant(parsed.memberId, parsed.allow, parsed.action, "human:desktop")).grants });
	} catch (error) {
		sendJson(response, mailboxErrorStatus(error), mailboxErrorBody(error));
	}
}
async function handleMessagesList(request, response, ctx, options) {
	if (!authorityAllowed(request, ctx.webServer.port)) {
		sendJson(response, 403, { error: "live-teams request authority rejected" });
		return;
	}
	if (request.method !== "GET") {
		sendJson(response, 405, { error: "live-teams method not allowed" });
		return;
	}
	if (options.mailbox === void 0) {
		sendJson(response, 503, { error: "live-teams state unavailable" });
		return;
	}
	let limit = 50;
	try {
		const raw = request.url === void 0 ? void 0 : new URL(request.url, "http://127.0.0.1").searchParams.get("limit");
		if (raw !== null && raw !== void 0) {
			if (!/^\d+$/u.test(raw)) throw new Error("invalid limit");
			limit = Math.min(200, Number(raw));
			if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("invalid limit");
		}
	} catch {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	try {
		const [messages, deliveries] = await Promise.all([options.mailbox.listMessages(), options.mailbox.listDeliveries()]);
		const memberNames = new Map((await readTeamState(options)).members.map((member) => [member.memberId, member.displayName]));
		const byMessage = new Map(messages.map((message) => [message.id, message]));
		const inbox = deliveries.filter((delivery) => delivery.recipient === "human").map((delivery) => {
			const message = byMessage.get(delivery.messageId);
			if (message === void 0) return void 0;
			const fromName = message.from === "human" ? "human" : memberNames.get(message.from) ?? message.from;
			const state = delivery.state === "acknowledged" ? "acknowledged" : "stored";
			return {
				id: message.id,
				from: message.from,
				fromName,
				kind: message.kind,
				content: message.content,
				createdAt: message.createdAt,
				delivery: {
					id: delivery.id,
					state,
					...delivery.acknowledgedAt === void 0 ? {} : { acknowledgedAt: delivery.acknowledgedAt }
				}
			};
		}).filter((entry) => entry !== void 0).sort((left, right) => right.createdAt - left.createdAt).slice(0, limit);
		sendJson(response, 200, {
			teamId: options.teamId,
			messages: inbox
		});
	} catch (error) {
		sendJson(response, mailboxErrorStatus(error), mailboxErrorBody(error));
	}
}
/**
* Who is waiting for the human.
*
* Deliberately small and cheap: the chip that renders it lives in the Session
* header of every Session, so it must not pull the whole inbox to answer one
* question.
*/
async function handleAttentionList(request, response, ctx, options) {
	if (!authorityAllowed(request, ctx.webServer.port)) {
		sendJson(response, 403, { error: "live-teams request authority rejected" });
		return;
	}
	if (request.method !== "GET") {
		sendJson(response, 405, { error: "live-teams method not allowed" });
		return;
	}
	if (options.mailbox === void 0) {
		sendJson(response, 503, { error: "live-teams state unavailable" });
		return;
	}
	try {
		const [state, messages, deliveries] = await Promise.all([
			readTeamState(options),
			options.mailbox.listMessages(),
			options.mailbox.listDeliveries()
		]);
		sendJson(response, 200, projectLiveTeamsAttention(state, messages, deliveries));
	} catch {
		sendJson(response, 503, { error: "live-teams state unavailable" });
	}
}
async function handleMessagesSend(request, response, ctx, options) {
	if (!authorityAllowed(request, ctx.webServer.port)) {
		sendJson(response, 403, { error: "live-teams request authority rejected" });
		return;
	}
	if (request.method !== "POST") {
		sendJson(response, 405, { error: "live-teams method not allowed" });
		return;
	}
	if (bodyContentType(request) !== "application/json" || options.mailbox === void 0) {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	let body;
	try {
		body = record(JSON.parse(await requestBody(request)));
	} catch {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	const to = requiredText(body.to);
	const kind = body.kind;
	const rawContent = body.content;
	const content = typeof rawContent === "string" ? rawContent.trim() : void 0;
	const threadId = body.threadId;
	if (body.sessionId === void 0 || to === void 0 || !messageKind(kind) || content === void 0 || content.length === 0 || Array.from(content).length > 8e3 || threadId !== void 0 && requiredText(threadId) === void 0) {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	let state;
	try {
		state = await readTeamState(options);
	} catch {
		sendJson(response, 503, { error: "live-teams state unavailable" });
		return;
	}
	try {
		const sent = await options.mailbox.sendFromHuman({
			to,
			kind,
			content,
			...threadId === void 0 ? {} : { threadId }
		});
		const names = new Map(state.members.map((member) => [member.memberId, member.displayName]));
		const deliveries = sent.deliveries.map((delivery) => {
			const outcome = messageDeliveryOutcome(delivery);
			return {
				id: delivery.id,
				recipient: delivery.recipient,
				name: delivery.recipient === "human" ? "human" : names.get(delivery.recipient) ?? delivery.recipient,
				state: delivery.state,
				outcome,
				...outcome === "failed" && delivery.failure !== void 0 ? { failure: delivery.failure } : {}
			};
		});
		sendJson(response, 200, {
			accepted: true,
			messageId: sent.message.id,
			delivered: deliveries.filter((delivery) => delivery.outcome === "delivered").length,
			inbox: deliveries.filter((delivery) => delivery.outcome === "inbox").length,
			pending: deliveries.filter((delivery) => delivery.outcome === "pending").length,
			failed: deliveries.filter((delivery) => delivery.outcome === "failed").length,
			recipients: sent.deliveries.map((delivery) => delivery.recipient),
			deliveries
		});
	} catch (error) {
		sendJson(response, mailboxErrorStatus(error), mailboxErrorBody(error));
	}
}
async function handleMessagesAcknowledge(request, response, ctx, options) {
	if (!authorityAllowed(request, ctx.webServer.port)) {
		sendJson(response, 403, { error: "live-teams request authority rejected" });
		return;
	}
	if (request.method !== "POST" || bodyContentType(request) !== "application/json" || options.mailbox === void 0) {
		sendJson(response, request.method === "POST" ? 400 : 405, { error: request.method === "POST" ? "live-teams invalid request" : "live-teams method not allowed" });
		return;
	}
	let messageId;
	let messageIds;
	try {
		const body = record(JSON.parse(await requestBody(request)));
		messageId = requiredText(body.messageId);
		if (Array.isArray(body.messageIds)) {
			const listed = body.messageIds.map((entry) => requiredText(entry));
			if (listed.some((entry) => entry === void 0) || listed.length === 0 || listed.length > 200) throw new Error("invalid acknowledgement");
			messageIds = listed;
		}
		if (body.sessionId === void 0 || messageId === void 0 && messageIds === void 0) throw new Error("invalid acknowledgement");
	} catch {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	try {
		if (messageIds !== void 0) {
			const acknowledged = [];
			for (const id of messageIds) acknowledged.push((await options.mailbox.acknowledge(id, "human")).delivery.messageId);
			sendJson(response, 200, {
				messageIds: acknowledged,
				state: "acknowledged"
			});
			return;
		}
		const acknowledged = await options.mailbox.acknowledge(messageId, "human");
		sendJson(response, 200, {
			messageId,
			state: acknowledged.delivery.state === "acknowledged" ? "acknowledged" : acknowledged.delivery.state
		});
	} catch (error) {
		sendJson(response, mailboxErrorStatus(error), mailboxErrorBody(error));
	}
}
async function handleTeamName(request, response, ctx, options) {
	if (!authorityAllowed(request, ctx.webServer.port)) {
		sendJson(response, 403, { error: "live-teams request authority rejected" });
		return;
	}
	if (request.method !== "POST" || bodyContentType(request) !== "application/json") {
		sendJson(response, request.method === "POST" ? 400 : 405, { error: request.method === "POST" ? "live-teams invalid request" : "live-teams method not allowed" });
		return;
	}
	let name, expectedRevision;
	try {
		const body = record(JSON.parse(await requestBody(request)));
		const parsedName = codePointText(body.name);
		if (parsedName === void 0 || !validInteger(body.expectedRevision) || body.sessionId === void 0) throw new Error("invalid team name");
		name = parsedName;
		expectedRevision = body.expectedRevision;
	} catch {
		sendJson(response, 400, { error: "live-teams invalid request" });
		return;
	}
	await withResolvedOptions(request, response, options, async (resolved) => {
		if (resolved.renameTeam === void 0) {
			sendJson(response, 500, { error: "live-teams mutation failed" });
			return;
		}
		let result;
		try {
			result = await resolved.renameTeam(name, expectedRevision);
		} catch (error) {
			if (mutationConflict(error)) {
				sendJson(response, 409, {
					error: "live-teams revision conflict",
					revision: resolved.teamStatus === void 0 ? expectedRevision : (await resolved.teamStatus()).revision ?? expectedRevision
				});
				return;
			}
			sendJson(response, 500, { error: "live-teams mutation failed" });
			return;
		}
		sendJson(response, 200, result.status);
	}, true);
}
function registerLiveTeamsRoutes(ctx, options) {
	const registered = [];
	registered.push(ctx.webServer.register({
		kind: "exact",
		path: LIVE_TEAMS_TEAM_ROUTE,
		handler: (request, response) => handleTeamStatus(request, response, ctx, options)
	}));
	registered.push(ctx.webServer.register({
		kind: "exact",
		path: LIVE_TEAMS_TEAM_BRIEFING_OPEN_ROUTE,
		handler: (request, response) => withResolvedOptions(request, response, options, (resolved) => handleBriefingOpen(request, response, ctx, resolved))
	}));
	registered.push(ctx.webServer.register({
		kind: "exact",
		path: LIVE_TEAMS_TEAM_LEAD_ROUTE,
		handler: (request, response) => withResolvedOptions(request, response, options, (resolved) => handleTeamLead(request, response, ctx, resolved), request.method === "POST")
	}));
	registered.push(ctx.webServer.register({
		kind: "exact",
		path: LIVE_TEAMS_TEAM_ENABLE_ROUTE,
		handler: (request, response) => handleTeamEnable(request, response, ctx, options)
	}));
	registered.push(ctx.webServer.register({
		kind: "exact",
		path: LIVE_TEAMS_TEAM_DISABLE_ROUTE,
		handler: (request, response) => handleTeamDisable(request, response, ctx, options)
	}));
	registered.push(ctx.webServer.register({
		kind: "exact",
		path: LIVE_TEAMS_TEAM_NAME_ROUTE,
		handler: (request, response) => handleTeamName(request, response, ctx, options)
	}));
	registered.push(ctx.webServer.register({
		kind: "exact",
		path: LIVE_TEAMS_TEAM_CANDIDATES_ROUTE,
		handler: (request, response) => handleTeamCandidates(request, response, ctx, options)
	}));
	registered.push(ctx.webServer.register({
		kind: "exact",
		path: LIVE_TEAMS_TEAM_ADOPT_ROUTE,
		handler: (request, response) => handleTeamAdopt(request, response, ctx, options)
	}));
	registered.push(ctx.webServer.register({
		kind: "exact",
		path: LIVE_TEAMS_MEMBER_GRANT_ROUTE,
		handler: (request, response) => withResolvedOptions(request, response, options, (resolved) => handleGrant(request, response, ctx, resolved), true)
	}));
	registered.push(ctx.webServer.register({
		kind: "exact",
		path: LIVE_TEAMS_JOURNAL_ROUTE,
		handler: (request, response) => handleJournalList(request, response, ctx, options)
	}));
	registered.push(ctx.webServer.register({
		kind: "exact",
		path: LIVE_TEAMS_TASKS_ROUTE,
		handler: (request, response) => handleTasksList(request, response, ctx, options)
	}));
	registered.push(ctx.webServer.register({
		kind: "exact",
		path: LIVE_TEAMS_TASK_ROUTE,
		handler: (request, response) => handleTaskRead(request, response, ctx, options)
	}));
	registered.push(ctx.webServer.register({
		kind: "exact",
		path: LIVE_TEAMS_TASK_NOTIFY_REVIEW_ROUTE,
		handler: (request, response) => handleTaskMutation(request, response, ctx, options, "notify-review")
	}));
	registered.push(ctx.webServer.register({
		kind: "exact",
		path: LIVE_TEAMS_TASK_NOTIFY_SUBMISSION_ROUTE,
		handler: (request, response) => handleTaskMutation(request, response, ctx, options, "notify-submission")
	}));
	registered.push(ctx.webServer.register({
		kind: "exact",
		path: LIVE_TEAMS_TASK_ACCEPT_ROUTE,
		handler: (request, response) => handleTaskMutation(request, response, ctx, options, "accept")
	}));
	registered.push(ctx.webServer.register({
		kind: "exact",
		path: LIVE_TEAMS_TASK_REVISE_ROUTE,
		handler: (request, response) => handleTaskMutation(request, response, ctx, options, "revise")
	}));
	registered.push(ctx.webServer.register({
		kind: "exact",
		path: LIVE_TEAMS_TASK_CANCEL_ROUTE,
		handler: (request, response) => handleTaskMutation(request, response, ctx, options, "cancel")
	}));
	registered.push(ctx.webServer.register({
		kind: "exact",
		path: LIVE_TEAMS_TASK_RESUME_ROUTE,
		handler: (request, response) => handleTaskMutation(request, response, ctx, options, "resume")
	}));
	registered.push(ctx.webServer.register({
		kind: "exact",
		path: LIVE_TEAMS_TASK_CREATE_ROUTE,
		handler: (request, response) => handleTaskControl(request, response, ctx, options, "create")
	}));
	registered.push(ctx.webServer.register({
		kind: "exact",
		path: LIVE_TEAMS_TASK_UPDATE_ROUTE,
		handler: (request, response) => handleTaskControl(request, response, ctx, options, "update")
	}));
	registered.push(ctx.webServer.register({
		kind: "exact",
		path: LIVE_TEAMS_TASK_REVOKE_ROUTE,
		handler: (request, response) => handleTaskControl(request, response, ctx, options, "revoke")
	}));
	registered.push(ctx.webServer.register({
		kind: "exact",
		path: LIVE_TEAMS_MESSAGES_ROUTE,
		handler: (request, response) => {
			if (request.method === "GET") return withResolvedOptions(request, response, options, (resolved) => handleMessagesList(request, response, ctx, resolved), true);
			return withResolvedOptions(request, response, options, (resolved) => handleMessagesSend(request, response, ctx, resolved), true);
		}
	}));
	registered.push(ctx.webServer.register({
		kind: "exact",
		path: LIVE_TEAMS_MESSAGES_ACKNOWLEDGE_ROUTE,
		handler: (request, response) => withResolvedOptions(request, response, options, (resolved) => handleMessagesAcknowledge(request, response, ctx, resolved), true)
	}));
	registered.push(ctx.webServer.register({
		kind: "exact",
		path: LIVE_TEAMS_ATTENTION_ROUTE,
		handler: (request, response) => withResolvedOptions(request, response, options, (resolved) => handleAttentionList(request, response, ctx, resolved), true)
	}));
	registered.push(ctx.webServer.register({
		kind: "exact",
		path: LIVE_TEAMS_DISPATCH_ROUTE,
		handler: (request, response) => handleDispatch(request, response, ctx, options)
	}));
	registered.push(ctx.webServer.register({
		kind: "exact",
		path: LIVE_TEAMS_ROLES_ROUTE,
		handler: (request, response) => withResolvedOptions(request, response, options, (resolved) => handleRolesList(request, response, ctx, resolved))
	}));
	registered.push(ctx.webServer.register({
		kind: "exact",
		path: LIVE_TEAMS_ROLES_OPEN_ROUTE,
		handler: (request, response) => withResolvedOptions(request, response, options, (resolved) => handleRolesOpen(request, response, ctx, resolved))
	}));
	registered.push(ctx.webServer.register({
		kind: "exact",
		path: LIVE_TEAMS_ROLES_OVERRIDE_ROUTE,
		handler: (request, response) => withResolvedOptions(request, response, options, (resolved) => handleRolesOverride(request, response, ctx, resolved))
	}));
	registered.push(ctx.webServer.register({
		kind: "exact",
		path: LIVE_TEAMS_MEMBER_CREATE_SESSION_ROUTE,
		handler: (request, response) => withResolvedOptions(request, response, options, (resolved) => handleCreateSessionMember(request, response, ctx, resolved), true)
	}));
	registered.push(ctx.webServer.register({
		kind: "exact",
		path: LIVE_TEAMS_MEMBER_ROLE_ROUTE,
		handler: (request, response) => withResolvedOptions(request, response, options, (resolved) => handleMutation(request, response, ctx, resolved, "role"), true)
	}));
	registered.push(ctx.webServer.register({
		kind: "exact",
		path: LIVE_TEAMS_MEMBER_AVAILABILITY_ROUTE,
		handler: (request, response) => withResolvedOptions(request, response, options, (resolved) => handleMutation(request, response, ctx, resolved, "availability"), true)
	}));
	registered.push(ctx.webServer.register({
		kind: "exact",
		path: LIVE_TEAMS_MEMBER_NAME_ROUTE,
		handler: (request, response) => withResolvedOptions(request, response, options, (resolved) => handleMutation(request, response, ctx, resolved, "name"), true)
	}));
	registered.push(ctx.webServer.register({
		kind: "exact",
		path: LIVE_TEAMS_MEMBER_REMOVE_ROUTE,
		handler: (request, response) => withResolvedOptions(request, response, options, (resolved) => handleRemoveMember(request, response, ctx, resolved), true)
	}));
	registered.push(ctx.webServer.register({
		kind: "exact",
		path: LIVE_TEAMS_MEMBER_INTERRUPT_ROUTE,
		handler: (request, response) => withResolvedOptions(request, response, options, (resolved) => handleInterrupt(request, response, ctx, resolved), true)
	}));
	registered.push(ctx.webServer.register({
		kind: "exact",
		path: LIVE_TEAMS_CANDIDATES_ROUTE,
		handler: async (request, response) => {
			if (!authorityAllowed(request, ctx.webServer.port)) {
				sendJson(response, 403, { error: "live-teams request authority rejected" });
				return;
			}
			if (request.method !== "GET") {
				sendJson(response, 405, { error: "live-teams method not allowed" });
				return;
			}
			const candidateSessionId = await requestSessionId(request);
			let candidateOptions;
			try {
				candidateOptions = await resolveOptions(request, options, candidateSessionId);
			} catch {
				candidateOptions = void 0;
			}
			if (candidateOptions === void 0 || options.resolveRequest !== void 0 && candidateSessionId === void 0) {
				sendJson(response, 400, { error: "live-teams invalid request" });
				return;
			}
			try {
				if (candidateOptions.teamEnabled !== void 0 && !await candidateOptions.teamEnabled()) {
					sendJson(response, 503, { error: "live-teams team disabled" });
					return;
				}
			} catch {
				sendJson(response, 503, { error: "live-teams state unavailable" });
				return;
			}
			if (candidateOptions.listCandidates === void 0) {
				sendJson(response, 500, { error: "live-teams snapshot unavailable" });
				return;
			}
			let state;
			try {
				state = await readTeamState(candidateOptions);
			} catch {
				sendJson(response, 503, { error: "live-teams state unavailable" });
				return;
			}
			try {
				sendJson(response, 200, projectLiveTeamsCandidates(state, await candidateOptions.listCandidates(), candidateOptions));
			} catch {
				sendJson(response, 500, { error: "live-teams snapshot unavailable" });
			}
		}
	}));
	registered.push(ctx.webServer.register({
		kind: "exact",
		path: LIVE_TEAMS_MEMBERS_ROUTE,
		handler: async (request, response) => {
			if (request.method === "POST") {
				await withResolvedOptions(request, response, options, (resolved) => handleCreateMember(request, response, ctx, resolved), true);
				return;
			}
			if (!authorityAllowed(request, ctx.webServer.port)) {
				sendJson(response, 403, { error: "live-teams request authority rejected" });
				return;
			}
			if (request.method !== "GET") {
				sendJson(response, 405, { error: "live-teams method not allowed" });
				return;
			}
			await withResolvedOptions(request, response, options, async (resolved) => {
				let state;
				try {
					state = await readTeamState(resolved);
				} catch {
					sendJson(response, 503, { error: "live-teams state unavailable" });
					return;
				}
				try {
					sendJson(response, 200, projectLiveTeamsSnapshot(state, resolved));
				} catch {
					sendJson(response, 500, { error: "live-teams snapshot unavailable" });
				}
			}, true);
		}
	}));
	let disposed = false;
	return () => {
		if (disposed) return;
		disposed = true;
		for (const dispose of registered) dispose();
	};
}
export { LIVE_TEAMS_ATTENTION_ROUTE, LIVE_TEAMS_CANDIDATES_ROUTE, LIVE_TEAMS_DISPATCH_ROUTE, LIVE_TEAMS_JOURNAL_ROUTE, LIVE_TEAMS_MEMBERS_ROUTE, LIVE_TEAMS_MEMBER_AVAILABILITY_ROUTE, LIVE_TEAMS_MEMBER_CREATE_SESSION_ROUTE, LIVE_TEAMS_MEMBER_GRANT_ROUTE, LIVE_TEAMS_MEMBER_INTERRUPT_ROUTE, LIVE_TEAMS_MEMBER_NAME_ROUTE, LIVE_TEAMS_MEMBER_REMOVE_ROUTE, LIVE_TEAMS_MEMBER_ROLE_ROUTE, LIVE_TEAMS_MESSAGES_ACKNOWLEDGE_ROUTE, LIVE_TEAMS_MESSAGES_ROUTE, LIVE_TEAMS_ROLES_OPEN_ROUTE, LIVE_TEAMS_ROLES_OVERRIDE_ROUTE, LIVE_TEAMS_ROLES_ROUTE, LIVE_TEAMS_TASKS_ROUTE, LIVE_TEAMS_TASK_ACCEPT_ROUTE, LIVE_TEAMS_TASK_CANCEL_ROUTE, LIVE_TEAMS_TASK_CREATE_ROUTE, LIVE_TEAMS_TASK_NOTIFY_REVIEW_ROUTE, LIVE_TEAMS_TASK_NOTIFY_SUBMISSION_ROUTE, LIVE_TEAMS_TASK_RESUME_ROUTE, LIVE_TEAMS_TASK_REVISE_ROUTE, LIVE_TEAMS_TASK_REVOKE_ROUTE, LIVE_TEAMS_TASK_ROUTE, LIVE_TEAMS_TASK_UPDATE_ROUTE, LIVE_TEAMS_TEAM_ADOPT_ROUTE, LIVE_TEAMS_TEAM_BRIEFING_OPEN_ROUTE, LIVE_TEAMS_TEAM_CANDIDATES_ROUTE, LIVE_TEAMS_TEAM_DISABLE_ROUTE, LIVE_TEAMS_TEAM_ENABLE_ROUTE, LIVE_TEAMS_TEAM_LEAD_ROUTE, LIVE_TEAMS_TEAM_NAME_ROUTE, LIVE_TEAMS_TEAM_ROUTE, actorOf, liveTeamsRequestAllowed, projectLiveTeamsAttention, projectLiveTeamsCandidates, projectLiveTeamsSnapshot, registerLiveTeamsRoutes };
