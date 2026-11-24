import { promises, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { ERROR_CODES, LiveTeamsError } from "./errors.js";
import { atomicWriteJson, clone, fileExists, readJson, withProcessLock } from "./storage.js";
// src/team-store.ts
/**
* Replace one team id wherever it appears as a `teamId`, at any depth.
*
* Records repeat the id inside their own objects (`tasks[].teamId`,
* `messages[].teamId`, …) and the read paths validate each record, so a shallow
* rewrite is not enough.
*/
function restampTeamId(value, from, to) {
	if (Array.isArray(value)) {
		let changed = false;
		const next = value.map((entry) => {
			const result = restampTeamId(entry, from, to);
			if (result.changed) changed = true;
			return result.value;
		});
		return changed ? {
			value: next,
			changed: true
		} : {
			value,
			changed: false
		};
	}
	if (typeof value === "string") {
		const marker = `${path.sep}teams${path.sep}${from}${path.sep}`;
		return value.includes(marker) ? {
			value: value.split(marker).join(`${path.sep}teams${path.sep}${to}${path.sep}`),
			changed: true
		} : {
			value,
			changed: false
		};
	}
	if (value === null || typeof value !== "object") return {
		value,
		changed: false
	};
	let changed = false;
	const next = {};
	for (const [key, entry] of Object.entries(value)) {
		if (key === "teamId" && entry === from) {
			next[key] = to;
			changed = true;
			continue;
		}
		const result = restampTeamId(entry, from, to);
		if (result.changed) changed = true;
		next[key] = result.value;
	}
	return changed ? {
		value: next,
		changed: true
	} : {
		value,
		changed: false
	};
}
/**
* Re-stamp every sibling state file an adopted team directory carries.
*
* Adoption moves `teams/<candidate>` to `teams/<derived>`, and each store
* validates that the `teamId` inside its own files matches the team it was
* opened for. Re-stamping only `team.json` therefore leaves every other store
* unreadable. Observed live: after adopting `076467b6-…` as
* `live-teams-workspace`, `tasks.json`, `messages.json`, `deliveries.json`,
* `attempts.json`, `submissions.json`, `reviews.json` and `commands.json` still
* named the old id, so the Tasks and Messages panels answered
* `503 live-teams state unavailable` on every read.
*
* Preparation and writing are separate on purpose: a file that cannot be read
* refuses the adoption *before* anything is written, so a failed adoption never
* leaves a half-renamed candidate behind.
*/
async function prepareRestampedTeamState(directory, from, to) {
	const names = await promises.readdir(directory);
	const prepared = [];
	for (const name of names.filter((entry) => entry.endsWith(".json") && entry !== "team.json")) {
		let raw;
		try {
			raw = await readJson(path.join(directory, name));
		} catch (error) {
			throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, `cannot adopt a team whose ${name} is unreadable`, {
				auditDetail: `invalid adoption state file ${name}`,
				cause: error
			});
		}
		const restamped = restampTeamId(raw, from, to);
		if (restamped.changed) prepared.push({
			file: path.join(directory, name),
			value: restamped.value
		});
	}
	return prepared;
}
/**
* Names the transport and the product already use for actors that are not members. A member with one
* of these ids would send mail *as* that actor — `human` is trusted by the mailbox as a human
* instruction — so the store refuses to persist such a member at all. The check lives here, not on
* the HTTP boundary, because a route parser protects one door while the store protects every caller.
*/
const RESERVED_ACTOR_NAMES = [
	"human",
	"scheduler",
	"team",
	"system",
	"plugin",
	"reconciler",
	"mailbox",
	"live-teams",
	"live_teams"
];
function isReservedActorName(memberId) {
	return RESERVED_ACTOR_NAMES.includes(memberId.trim().toLowerCase());
}
/**
* Who leads this team: the recorded lead when it is still a member, otherwise the single member
* holding the lead role, otherwise nobody. One definition, because the roster a member is shown and
* the gate that admits its calls must agree — the expression used to be inlined in a dozen places,
* and the first change to the rule would have desynchronised them (external review, finding 7).
*/
function resolveLeadMemberId(team) {
	if (team.leadMemberId !== void 0 && team.members.some((member) => member.memberId === team.leadMemberId)) return team.leadMemberId;
	const leads = team.members.filter((member) => member.role === "lead");
	return leads.length === 1 ? leads[0]?.memberId : void 0;
}
const TEAM_ROOT = ".dsh-live-teams";
/**
* Make the state directory ignore itself.
*
* The plugin writes `.dsh-live-teams/` into the *user's* project, and whether that shows up as
* untracked depends on the project's own `.gitignore` — which is not ours to edit. A one-line
* `.gitignore` inside the directory makes it invisible to git everywhere, the way `.git/` is, so a
* `git add -A` in a project that never heard of this plugin cannot pick up a team's tasks, attempts
* and journal. Written only when missing: an existing file is the project's business, not ours.
*/
async function ensureSelfIgnoringRoot(root) {
	const marker = path.join(root, ".gitignore");
	try {
		if (await fileExists(marker)) return;
		await promises.writeFile(marker, "# Written by dsh-live-teams: team state is data, not source.\n*\n", "utf8");
	} catch {}
}
const DISABLED_MARKER = "disabled";
function canonicalWorkspacePath(value) {
	const resolved = path.resolve(value);
	try {
		return realpathSync.native(resolved);
	} catch {
		return resolved;
	}
}
function candidateId(value) {
	return value.length > 0 && value !== "." && value !== ".." && !value.includes("/") && !value.includes("\\");
}
function objectRecord(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function safeAdoptionPath(root, candidate) {
	const resolvedRoot = path.resolve(root);
	return path.resolve(candidate).startsWith(`${resolvedRoot}${path.sep}`);
}
function adoptionState(value) {
	const candidate = objectRecord(value);
	if (candidate === void 0 || !Number.isInteger(candidate.schemaVersion) || Number(candidate.schemaVersion) > 1 || !Number.isInteger(candidate.revision) || typeof candidate.teamId !== "string" || candidate.teamId.length === 0 || typeof candidate.workspaceId !== "string" || candidate.workspaceId.length === 0 || typeof candidate.workspacePath !== "string" || candidate.workspacePath.length === 0 || !Array.isArray(candidate.members) || !Array.isArray(candidate.archivedMemberIds) || !Number.isInteger(candidate.createdAt) || !Number.isInteger(candidate.updatedAt)) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, "invalid candidate state");
	const members = [];
	for (const raw of candidate.members) {
		const member = objectRecord(raw);
		if (member === void 0 || typeof member.memberId !== "string" || member.memberId.length === 0 || typeof member.displayName !== "string" || member.displayName.length === 0 || typeof member.role !== "string" || member.role.length === 0 || typeof member.availability !== "string" || member.availability.length === 0 || member.sessionId !== void 0 && (typeof member.sessionId !== "string" || member.sessionId.length === 0) || !Number.isInteger(member.bindingGeneration) || Number(member.bindingGeneration) < 0 || !Number.isInteger(member.contractRevision) || Number(member.contractRevision) < 0) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, "invalid candidate member");
		members.push(member);
	}
	if (!candidate.archivedMemberIds.every((id) => typeof id === "string" && id.length > 0)) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, "invalid archived member list");
	return candidate;
}
async function adoptionDirectoryOccupied(directory) {
	try {
		if (adoptionState(await readJson(path.join(directory, "team.json"))).members.length > 0) return {
			hasMembers: true,
			hasOtherAudit: true
		};
		let events = [];
		try {
			events = (await promises.readFile(path.join(directory, "events.jsonl"), "utf8")).split("\n").filter((line) => line.trim().length > 0).map((line) => JSON.parse(line));
		} catch (error) {
			if (error.code !== "ENOENT") return {
				hasMembers: true,
				hasOtherAudit: true
			};
		}
		return {
			hasMembers: false,
			hasOtherAudit: events.some((event) => {
				const kind = objectRecord(event)?.kind;
				return kind !== "team/enabled" && kind !== "team/disabled";
			})
		};
	} catch {
		return {
			hasMembers: true,
			hasOtherAudit: true
		};
	}
}
var TeamStore = class {
	defaults;
	locations = /* @__PURE__ */ new Map();
	constructor(defaults = {}) {
		this.defaults = defaults;
	}
	async open(request = {}) {
		const workspacePath = request.workspacePath ?? this.defaults.workspacePath;
		const workspaceId = request.workspaceId ?? this.defaults.workspaceId;
		if (!workspacePath || !workspaceId) throw new TypeError("workspacePath and workspaceId are required");
		const teamId = request.teamId ?? this.defaults.teamId ?? workspaceId;
		const initialName = request.name ?? this.defaults.name;
		const location = this.location(workspacePath, workspaceId, teamId);
		await withProcessLock(location.file, async () => {
			await promises.mkdir(location.directory, { recursive: true });
			await ensureSelfIgnoringRoot(path.resolve(workspacePath, TEAM_ROOT));
			if (!await fileExists(location.file)) {
				const now = Date.now();
				await atomicWriteJson(location.file, {
					schemaVersion: 1,
					revision: 0,
					teamId,
					workspaceId,
					workspacePath: path.resolve(workspacePath),
					...typeof initialName === "string" && initialName.length > 0 ? { name: initialName } : {},
					members: [],
					archivedMemberIds: [],
					createdAt: now,
					updatedAt: now
				});
			}
			await this.read(location);
		});
		this.locations.set(teamId, location);
		return this.read(location);
	}
	isDisabledSync(teamId) {
		try {
			readFileSync(path.join(this.requireLocation(teamId).directory, DISABLED_MARKER), "utf8");
			return true;
		} catch (error) {
			if (error.code === "ENOENT") return false;
			throw error;
		}
	}
	async readExisting(request = {}) {
		const workspacePath = request.workspacePath ?? this.defaults.workspacePath;
		const workspaceId = request.workspaceId ?? this.defaults.workspaceId;
		if (!workspacePath || !workspaceId) throw new TypeError("workspacePath and workspaceId are required");
		const teamId = request.teamId ?? this.defaults.teamId ?? workspaceId;
		const location = this.location(workspacePath, workspaceId, teamId);
		if (!await fileExists(location.file)) return void 0;
		this.locations.set(teamId, location);
		return this.read(location);
	}
	async isDisabled(teamId) {
		return fileExists(path.join(this.requireLocation(teamId).directory, DISABLED_MARKER));
	}
	/** Discover old team directories in this workspace without creating state. */
	async listAdoptionCandidates(request) {
		const teamsDirectory = path.resolve(request.workspacePath, TEAM_ROOT, "teams");
		let entries;
		try {
			entries = await promises.readdir(teamsDirectory, { withFileTypes: true });
		} catch (error) {
			if (error.code === "ENOENT") return [];
			throw error;
		}
		const candidates = [];
		for (const entry of entries) {
			if (!entry.isDirectory() || entry.name.startsWith(`${request.derivedTeamId}.`) || !candidateId(entry.name) || entry.name === request.derivedTeamId) continue;
			const directory = path.join(teamsDirectory, entry.name);
			try {
				const checked = adoptionState(await readJson(path.join(directory, "team.json")));
				candidates.push({
					teamId: entry.name,
					name: typeof checked.name === "string" && checked.name.trim().length > 0 ? checked.name.trim() : entry.name,
					memberCount: checked.members.length,
					updatedAt: checked.updatedAt
				});
			} catch {
				candidates.push({
					teamId: entry.name,
					usable: false,
					reason: "invalid state"
				});
			}
		}
		return candidates.sort((left, right) => {
			const leftUsable = left.usable !== false;
			if (leftUsable !== (right.usable !== false)) return leftUsable ? -1 : 1;
			const memberOrder = (right.memberCount ?? -1) - (left.memberCount ?? -1);
			if (memberOrder !== 0) return memberOrder;
			const updatedOrder = (right.updatedAt ?? -1) - (left.updatedAt ?? -1);
			if (updatedOrder !== 0) return updatedOrder;
			return left.teamId < right.teamId ? -1 : left.teamId > right.teamId ? 1 : 0;
		});
	}
	/** Adopt one old team into the workspace-derived directory. */
	async adoptTeam(request) {
		if (!candidateId(request.candidateTeamId) || !candidateId(request.derivedTeamId) || request.candidateTeamId === request.derivedTeamId) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, "invalid request", { auditDetail: "invalid adoption path" });
		const canonicalWorkspace = canonicalWorkspacePath(request.workspacePath);
		const teamsDirectory = path.join(canonicalWorkspace, TEAM_ROOT, "teams");
		const candidateDirectory = path.join(teamsDirectory, request.candidateTeamId);
		const derivedDirectory = path.join(teamsDirectory, request.derivedTeamId);
		if (!safeAdoptionPath(teamsDirectory, candidateDirectory) || !safeAdoptionPath(teamsDirectory, derivedDirectory)) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, "invalid request", { auditDetail: "invalid adoption path" });
		let candidateRealPath;
		try {
			candidateRealPath = realpathSync.native(candidateDirectory);
		} catch (error) {
			throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, "invalid request", {
				auditDetail: "invalid adoption path",
				cause: error
			});
		}
		if (!safeAdoptionPath(realpathSync.native(teamsDirectory), candidateRealPath)) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, "invalid request", { auditDetail: "invalid adoption path" });
		let candidateRaw;
		try {
			candidateRaw = await readJson(path.join(candidateDirectory, "team.json"));
		} catch (error) {
			throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, "invalid request", {
				auditDetail: "invalid candidate state",
				cause: error
			});
		}
		const candidate = adoptionState(candidateRaw);
		if (await fileExists(derivedDirectory)) {
			const occupied = await adoptionDirectoryOccupied(derivedDirectory);
			if (occupied.hasMembers || occupied.hasOtherAudit) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, "live-teams derived team already exists", { auditDetail: "derived team already exists" });
			if (!request.replaceEmptyDerived) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, "live-teams derived team already exists", { auditDetail: "derived team already exists" });
			const replaced = `${derivedDirectory}.${Date.now()}.replaced`;
			await promises.rename(derivedDirectory, replaced);
		}
		const rewritten = {
			...candidate,
			teamId: request.derivedTeamId,
			workspaceId: request.workspaceId,
			workspacePath: canonicalWorkspace
		};
		const restamped = await prepareRestampedTeamState(candidateDirectory, request.candidateTeamId, request.derivedTeamId);
		await atomicWriteJson(path.join(candidateDirectory, "team.json"), rewritten);
		for (const entry of restamped) await atomicWriteJson(entry.file, entry.value);
		await promises.rename(candidateDirectory, derivedDirectory);
		await promises.unlink(path.join(derivedDirectory, DISABLED_MARKER)).catch((error) => {
			if (error.code !== "ENOENT") throw error;
		});
		const location = this.location(canonicalWorkspace, request.workspaceId, request.derivedTeamId);
		this.locations.set(request.derivedTeamId, location);
		await this.appendEvent(request.derivedTeamId, {
			kind: "team/adopted",
			teamId: request.derivedTeamId,
			fromTeamId: request.candidateTeamId,
			name: typeof candidate.name === "string" && candidate.name.trim().length > 0 ? candidate.name.trim() : request.candidateTeamId,
			memberCount: candidate.members.length,
			at: Date.now(),
			actor: request.actor ?? "human:desktop"
		});
		return {
			state: rewritten,
			adoptedFrom: request.candidateTeamId
		};
	}
	/**
	* Adopt the workspace's own team when it sits under another workspace id.
	*
	* The registry mints a new id whenever an entry is re-created, and the team directory is
	* named by id — so after such an event the panel showed an empty team while the real one
	* (members, tasks, journal) sat right next to it, and only a human clicking "adopt" could
	* bring it back. The canonical path is the stable identity here; the id is a registry
	* variable, so it is adopted rather than treated as a reason to refuse.
	*
	* Deliberately conservative: only one usable candidate, only if it has members, only if it
	* declares this path, and never when the current directory already holds a live team. An
	* ambiguous set stays a human decision — the panel already offers the choice.
	*/
	async adoptByPath(request) {
		const canonical = canonicalWorkspacePath(request.workspacePath);
		const candidates = (await this.listAdoptionCandidates({
			workspacePath: request.workspacePath,
			derivedTeamId: request.teamId
		})).filter((candidate) => candidate.usable !== false && (candidate.memberCount ?? 0) > 0);
		if (candidates.length !== 1) return void 0;
		const candidate = candidates[0];
		try {
			const declared = await readJson(path.join(canonical, TEAM_ROOT, "teams", candidate.teamId, "team.json"));
			const declaredPath = typeof declared === "object" && declared !== null ? declared.workspacePath : void 0;
			if (typeof declaredPath === "string" && canonicalWorkspacePath(declaredPath) !== canonical) return void 0;
		} catch {
			return;
		}
		try {
			return {
				adoptedFrom: (await this.adoptTeam({
					workspacePath: canonical,
					workspaceId: request.workspaceId,
					derivedTeamId: request.teamId,
					candidateTeamId: candidate.teamId,
					replaceEmptyDerived: true,
					...request.actor === void 0 ? {} : { actor: request.actor }
				})).adoptedFrom,
				memberCount: candidate.memberCount ?? 0
			};
		} catch {
			return;
		}
	}
	async setDisabled(teamId, disabled) {
		const location = this.requireLocation(teamId);
		await withProcessLock(location.file, async () => {
			if (disabled) await promises.writeFile(path.join(location.directory, DISABLED_MARKER), "", {
				flag: "wx",
				mode: 384
			}).catch((error) => {
				if (error.code !== "EEXIST") throw error;
			});
			else await promises.unlink(path.join(location.directory, DISABLED_MARKER)).catch((error) => {
				if (error.code !== "ENOENT") throw error;
			});
		});
	}
	async renameTeam(teamId, expectedRevision, name) {
		const result = await this.commit(teamId, {
			expectedRevision,
			mutate: (state) => {
				const from = state.name ?? state.teamId;
				state.name = name;
				return from;
			}
		});
		return {
			state: result.state,
			from: result.value
		};
	}
	/**
	* Flip the dispatch switch. Authority belongs to the callers, exactly as it does
	* for `renameTeam`: the desktop route admits the human, and the lead-only tool
	* admits the lead. A request that changes nothing is refused rather than silently
	* accepted, so a double click cannot look like a state change that never happened.
	*/
	async setDispatchMode(teamId, mode, request, expectedRevision) {
		if (mode !== "auto" && mode !== "paused") throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `unknown dispatch mode: ${String(mode)}`);
		const result = await this.commit(teamId, {
			expectedRevision,
			mutate: (state) => {
				const from = readDispatchSwitch(state).mode;
				if (from === mode) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `dispatch is already ${mode}`);
				state.dispatch = {
					mode,
					by: request.actor,
					...request.reason === void 0 || request.reason.trim().length === 0 ? {} : { reason: request.reason.trim() },
					at: Date.now()
				};
				return from;
			}
		});
		return {
			state: result.state,
			from: result.value,
			to: mode
		};
	}
	async commit(teamId, request) {
		const location = this.requireLocation(teamId);
		if (!request || typeof request.mutate !== "function" || !Number.isInteger(request.expectedRevision)) throw new TypeError("expectedRevision and mutate are required");
		return withProcessLock(location.file, async () => {
			const current = await this.read(location);
			if (current.revision !== request.expectedRevision) throw new LiveTeamsError(ERROR_CODES.REVISION_CONFLICT, `expected revision ${request.expectedRevision}, actual ${current.revision}`);
			const working = clone(current);
			const value = await request.mutate(working);
			const impostor = working.members.find((member) => isReservedActorName(member.memberId));
			if (impostor !== void 0) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `"${impostor.memberId}" is a reserved actor name and cannot be a member id; ids the transport uses for the human, the scheduler and the team itself are refused`);
			working.revision = current.revision + 1;
			working.updatedAt = Date.now();
			await atomicWriteJson(location.file, working);
			return {
				state: working,
				value
			};
		});
	}
	async memberBySession(teamId, sessionId) {
		const member = (await this.read(this.requireLocation(teamId))).members.find((entry) => entry.sessionId === sessionId);
		return member === void 0 ? void 0 : clone(member);
	}
	async bindSession(teamId, memberId, sessionId, expectedRevision) {
		const result = await this.commit(teamId, {
			expectedRevision,
			mutate: (state) => {
				const member = state.members.find((entry) => entry.memberId === memberId);
				if (!member) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `member not found: ${memberId}`);
				const owner = state.members.find((entry) => entry.memberId !== memberId && entry.sessionId === sessionId);
				if (owner) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `session ${sessionId} is already bound to ${owner.memberId}`);
				member.sessionId = sessionId;
				member.bindingGeneration += 1;
				member.contractRevision = (member.contractRevision ?? 0) + 1;
				return member;
			}
		});
		return clone(result.value);
	}
	async unbindSession(teamId, memberId, expectedRevision) {
		const result = await this.commit(teamId, {
			expectedRevision,
			mutate: (state) => {
				const member = state.members.find((entry) => entry.memberId === memberId);
				if (!member) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `member not found: ${memberId}`);
				delete member.sessionId;
				member.bindingGeneration += 1;
				member.contractRevision = (member.contractRevision ?? 0) + 1;
				return member;
			}
		});
		return clone(result.value);
	}
	/**
	* Name the lead, or clear the name.
	*
	* Clearing is a real operation, not an empty request: it returns the team to the fallback rule —
	* whoever holds the `lead` role — which is what a team with one lead relies on anyway. The panel
	* offered "Not set" and the server refused it with a 400, so the option did nothing.
	*/
	async setLead(teamId, memberId, expectedRevision) {
		return (await this.commit(teamId, {
			expectedRevision,
			mutate: (state) => {
				if (memberId === void 0) {
					delete state.leadMemberId;
					return;
				}
				if (!state.members.some((entry) => entry.memberId === memberId)) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `member not found: ${memberId}`);
				state.leadMemberId = memberId;
			}
		})).state;
	}
	async updateContactGrant(teamId, from, to, action, grantedBy) {
		const location = this.requireLocation(teamId);
		for (let attempt = 0; attempt < 3; attempt += 1) {
			const current = await this.read(location);
			const grants = current.contactGrants ?? [];
			const exists = grants.some((grant) => grant.from === from && grant.to === to);
			if (action === "add" && exists || action === "remove" && !exists) return {
				state: clone(current),
				grants: clone(grants.filter((grant) => grant.from === from)),
				changed: false
			};
			try {
				const result = await this.commit(teamId, {
					expectedRevision: current.revision,
					mutate: (state) => {
						const next = state.contactGrants ?? [];
						if (action === "add") next.push({
							from,
							to,
							grantedBy,
							at: Date.now()
						});
						else state.contactGrants = next.filter((grant) => !(grant.from === from && grant.to === to));
						if (action === "add") state.contactGrants = next;
						if (state.contactGrants?.length === 0) delete state.contactGrants;
						return state.contactGrants?.filter((grant) => grant.from === from) ?? [];
					}
				});
				return {
					state: result.state,
					grants: clone(result.value),
					changed: true
				};
			} catch (error) {
				if (error instanceof LiveTeamsError && error.code === ERROR_CODES.REVISION_CONFLICT && attempt < 2) continue;
				throw error;
			}
		}
		throw new LiveTeamsError(ERROR_CODES.REVISION_CONFLICT, "contact grant revision conflict");
	}
	async setMemberNote(teamId, memberId, note, expectedRevision) {
		const result = await this.commit(teamId, {
			expectedRevision,
			mutate: (state) => {
				const member = state.members.find((entry) => entry.memberId === memberId);
				if (member === void 0) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `member not found: ${memberId}`);
				member.note = note;
				return member;
			}
		});
		return {
			state: result.state,
			member: clone(result.value)
		};
	}
	async removeMember(teamId, memberId, expectedRevision) {
		const result = await this.commit(teamId, {
			expectedRevision,
			mutate: (state) => {
				if (state.archivedMemberIds.includes(memberId)) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `member already archived: ${memberId}`);
				const index = state.members.findIndex((entry) => entry.memberId === memberId);
				if (index < 0) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `member not found: ${memberId}`);
				const removed = state.members[index];
				if (removed === void 0) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `member not found: ${memberId}`);
				state.members.splice(index, 1);
				state.archivedMemberIds.push(memberId);
				if (state.leadMemberId === memberId) delete state.leadMemberId;
				if (state.contactGrants !== void 0) {
					state.contactGrants = state.contactGrants.filter((grant) => grant.from !== memberId && grant.to !== memberId);
					if (state.contactGrants.length === 0) delete state.contactGrants;
				}
				return clone(removed);
			}
		});
		return {
			state: result.state,
			removed: result.value
		};
	}
	async appendEvent(teamId, event) {
		const location = this.requireLocation(teamId);
		return withProcessLock(location.eventsFile, async () => {
			await promises.mkdir(location.directory, { recursive: true });
			const handle = await promises.open(location.eventsFile, "a", 384);
			try {
				await handle.writeFile(`${JSON.stringify(event)}\n`, "utf8");
				await handle.sync();
			} finally {
				await handle.close();
			}
		});
	}
	/**
	* The audit, read from a byte offset when the caller has one.
	*
	* The journal grows forever and the panel re-reads it every few seconds; reading the whole file was
	* the one part of polling that got worse with age (a ten-times-longer journal meant seventeen
	* megabytes a minute). The file is append-only, so an offset is a safe cursor: the caller passes
	* back the offset this returned and pays only for what is new. Without an offset the tail is read —
	* never the whole history, which nobody reads in a panel anyway.
	*/
	async readEvents(teamId, after) {
		const location = this.requireLocation(teamId);
		if (!await fileExists(location.eventsFile)) return {
			events: [],
			torn: null,
			nextOffset: 0,
			truncated: false
		};
		const size = (await promises.stat(location.eventsFile)).size;
		const from = after !== void 0 && after >= 0 && after <= size ? after : Math.max(0, size - 262144);
		const truncated = after === void 0 && from > 0;
		const handle = await promises.open(location.eventsFile, "r");
		let contents;
		try {
			const length = size - from;
			const buffer = Buffer.alloc(length);
			await handle.read(buffer, 0, length, from);
			contents = buffer.toString("utf8");
			if (from > 0) {
				const boundary = Buffer.alloc(1);
				await handle.read(boundary, 0, 1, from - 1);
				if (boundary[0] !== 10) contents = contents.slice(contents.indexOf("\n") + 1);
			}
		} finally {
			await handle.close();
		}
		if (contents.length === 0) return {
			events: [],
			torn: null,
			nextOffset: size,
			truncated
		};
		const hasTrailingNewline = contents.endsWith("\n");
		const lines = contents.split("\n");
		if (hasTrailingNewline) lines.pop();
		const torn = hasTrailingNewline ? null : lines.pop() ?? null;
		const events = [];
		for (const line of lines) {
			if (!line.trim()) continue;
			try {
				events.push(JSON.parse(line));
			} catch (error) {
				throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, `invalid event record: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
			}
		}
		const consumed = contents.endsWith("\n") ? contents.length : contents.length - (torn?.length ?? 0);
		return {
			events,
			torn,
			nextOffset: from + Buffer.byteLength(contents.slice(0, consumed), "utf8"),
			truncated
		};
	}
	location(workspacePath, workspaceId, teamId) {
		const root = path.resolve(workspacePath, TEAM_ROOT, "teams", teamId);
		return {
			directory: root,
			file: path.join(root, "team.json"),
			eventsFile: path.join(root, "events.jsonl"),
			workspacePath: path.resolve(workspacePath),
			workspaceId,
			teamId
		};
	}
	requireLocation(teamId) {
		const location = this.locations.get(teamId);
		if (!location) throw new Error(`Team ${teamId} has not been opened`);
		return location;
	}
	async read(location) {
		let state;
		try {
			state = await readJson(location.file);
		} catch (error) {
			if ((error !== null && typeof error === "object" && "code" in error ? error.code : void 0) === "ENOENT") throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, `missing state file: ${location.file}`, { cause: error });
			if (error instanceof SyntaxError) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, `invalid JSON in ${location.file}: ${error.message}`, { cause: error });
			if (error instanceof LiveTeamsError) throw error;
			throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, `cannot read ${location.file}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
		}
		if (state === null || typeof state !== "object" || Array.isArray(state)) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, `state is not an object: ${location.file}`);
		const candidate = state;
		if (!Number.isInteger(candidate.schemaVersion)) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, "state schemaVersion is missing or invalid");
		const schemaVersion = candidate.schemaVersion;
		if (schemaVersion === void 0) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, "state schemaVersion is missing or invalid");
		if (schemaVersion > 1) throw new LiveTeamsError(ERROR_CODES.SCHEMA_UNSUPPORTED, `schemaVersion ${candidate.schemaVersion} is newer than 1`);
		if (candidate.teamId !== location.teamId || candidate.workspaceId !== location.workspaceId || !Number.isInteger(candidate.revision) || !Array.isArray(candidate.members) || !Array.isArray(candidate.archivedMemberIds)) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, "state identity or required fields are invalid");
		return candidate;
	}
	memberBySessionSync(teamId, sessionId) {
		return readMemberBySessionSync({
			workspacePath: this.requireLocation(teamId).workspacePath,
			teamId,
			sessionId
		});
	}
};
function createTeamStore(options = {}) {
	return new TeamStore(options);
}
/**
* Read the dispatch switch strictly: an absent switch is `auto`, and anything
* malformed is corrupt state rather than a quiet fallback to automatic dispatch.
*/
function readDispatchSwitch(state) {
	const candidate = objectRecord(state.dispatch);
	if (candidate === void 0) return {
		mode: "auto",
		by: "default",
		at: 0
	};
	if (candidate.mode !== "auto" && candidate.mode !== "paused") throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, "state dispatch mode is invalid");
	if (typeof candidate.by !== "string" || candidate.by.length === 0) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, "state dispatch actor is invalid");
	if (!Number.isInteger(candidate.at)) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, "state dispatch timestamp is invalid");
	if (candidate.reason !== void 0 && typeof candidate.reason !== "string") throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, "state dispatch reason is invalid");
	return candidate;
}
function readTeamStateSync(request) {
	const file = path.join(path.resolve(request.workspacePath), TEAM_ROOT, "teams", request.teamId, "team.json");
	let contents;
	try {
		contents = readFileSync(file, "utf8");
	} catch (error) {
		if (error.code === "ENOENT") return void 0;
		throw error;
	}
	let state;
	try {
		state = JSON.parse(contents);
	} catch (error) {
		throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, `invalid JSON in ${file}`, { cause: error });
	}
	if (state === null || typeof state !== "object" || Array.isArray(state) || !Array.isArray(state.members)) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, `team state has no member list: ${file}`);
	return clone(state);
}
function readMemberBySessionSync(request) {
	const file = path.join(path.resolve(request.workspacePath), TEAM_ROOT, "teams", request.teamId, "team.json");
	let contents;
	try {
		contents = readFileSync(file, "utf8");
	} catch (error) {
		if (error.code === "ENOENT") return void 0;
		throw error;
	}
	const state = JSON.parse(contents);
	if (state === null || typeof state !== "object" || !Array.isArray(state.members)) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, `team state has no member list: ${file}`);
	const member = state.members.find((entry) => entry !== null && typeof entry === "object" && entry.sessionId === request.sessionId);
	return member === void 0 ? void 0 : clone(member);
}
export { RESERVED_ACTOR_NAMES, TEAM_ROOT, TeamStore, createTeamStore, isReservedActorName, readDispatchSwitch, readMemberBySessionSync, readTeamStateSync, resolveLeadMemberId };
