import { randomUUID } from "node:crypto";
import { ERROR_CODES, LiveTeamsError } from "./errors.js";
// src/rotation.ts
/**
* Automatic member rotation.
*
* A member is a long-lived Session, and every turn re-sends the whole transcript. Measured on this
* product's own team (200 tasks, 7 700 model calls) the average prompt was ~460k tokens while a
* fresh Session starts at ~19k: the transcript, not the system prompt, is what costs. Compaction
* does not fix that — it runs repeatedly (53–102 prunes per heavy Session) and the window still
* settles around half a million tokens, while each compaction is itself a full-context call and a
* lossy summary of ids and evidence that the review protocol depends on.
*
* Rotation is therefore a *membership* operation, not a Session delete: a new Session is created,
* the rota moves onto it (name, role, note, contact grants, lead selection), and the old member id
* is archived. The old Session stays readable, the durable record (task documents, submissions,
* reviews, briefing, member note) carries the memory, and the new member id starts with a clean
* completed-task count — which is what makes the task limit self-resetting.
*
* Two independent limits are supported on purpose. A context cap never fires for a member that
* works in many short turns; a task cap never fires for one very long turn. Either one alone is a
* half-measure, so both are configurable and both default to a value that was measured rather than
* guessed.
*/
/**
* The defaults are the numbers this team actually reached. 150k is roughly one task's worth of
* context on top of a fresh Session, so a member rotates at the point where the transcript starts
* costing more than the work; five accepted tasks is the point where the previous task's evidence
* stops being read and starts being re-sent.
*/
const DEFAULT_ROTATION_CONFIG = Object.freeze({
	enabled: false,
	maxContextTokens: 15e4,
	maxCompletedTasks: 5,
	cooldownMs: 6e5,
	maxRotationsPerPass: 1
});
function record(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function text(value) {
	return typeof value === "string" && value.length > 0 ? value : void 0;
}
function messageOf(error) {
	return error instanceof Error ? error.message : String(error);
}
/**
* Normalize the `rotation` config row.
*
* Like `codingDispatch`, this fails closed: a typo must not start replacing Sessions. Unknown keys
* are ignored rather than refused, because a profile written for a newer build should still mount.
*/
function readRotationConfig(value) {
	const source = record(value);
	const warnings = [];
	const enabled = source.enabled === true;
	if (source.enabled !== void 0 && typeof source.enabled !== "boolean") warnings.push("live-teams: rotation.enabled must be true or false; rotation stays disabled");
	const amount = (name, fallback) => {
		const raw = source[name];
		if (raw === void 0) return fallback;
		if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) return Math.floor(raw);
		warnings.push(`live-teams: rotation.${name} must be a non-negative number; using ${fallback}`);
		return fallback;
	};
	const config = {
		enabled,
		maxContextTokens: amount("maxContextTokens", DEFAULT_ROTATION_CONFIG.maxContextTokens),
		maxCompletedTasks: amount("maxCompletedTasks", DEFAULT_ROTATION_CONFIG.maxCompletedTasks),
		cooldownMs: amount("cooldownMs", DEFAULT_ROTATION_CONFIG.cooldownMs),
		maxRotationsPerPass: amount("maxRotationsPerPass", DEFAULT_ROTATION_CONFIG.maxRotationsPerPass)
	};
	if (enabled && config.maxContextTokens === 0 && config.maxCompletedTasks === 0) warnings.push("live-teams: rotation is enabled with both limits at 0; nothing will ever rotate");
	return {
		config,
		warnings
	};
}
/**
* Whether this member should be replaced now.
*
* Every refusal is named, because "rotation did not happen" is otherwise indistinguishable from a
* broken plugin: the pass reports the reason instead of staying silent.
*/
function decideRotation(input) {
	const { config, member } = input;
	if (!config.enabled) return {
		rotate: false,
		skipped: "disabled"
	};
	if (text(member.sessionId) === void 0) return {
		rotate: false,
		skipped: "no-session"
	};
	if (member.availability === "paused") return {
		rotate: false,
		skipped: "paused"
	};
	if (input.activeAttempt) return {
		rotate: false,
		skipped: "active-attempt"
	};
	if (input.openTasks > 0) return {
		rotate: false,
		skipped: "open-tasks"
	};
	if (input.sessionStatus === "running") return {
		rotate: false,
		skipped: "session-running"
	};
	if (input.undeliveredMessages > 0) return {
		rotate: false,
		skipped: "undelivered-messages"
	};
	if (config.maxContextTokens > 0 && input.contextTokens !== void 0 && input.contextTokens >= config.maxContextTokens) return {
		rotate: true,
		reason: "max-context-tokens",
		detail: `context ${input.contextTokens} ≥ ${config.maxContextTokens} tokens`
	};
	if (config.maxCompletedTasks > 0 && input.completedTasks >= config.maxCompletedTasks) return {
		rotate: true,
		reason: "max-completed-tasks",
		detail: `${input.completedTasks} completed tasks ≥ ${config.maxCompletedTasks}`
	};
	return {
		rotate: false,
		skipped: "below-threshold"
	};
}
function createRotationService(ports) {
	const clock = ports.now ?? Date.now;
	const logger = ports.logger ?? (() => void 0);
	const sessionIdFor = ports.newSessionId;
	/** Member id → earliest moment it may be rotated again. Failure backoff, not a threshold. */
	const blockedUntil = /* @__PURE__ */ new Map();
	let running;
	async function rotateOne(team, member, facts, decision, contextTokens) {
		const previousSessionId = text(member.sessionId);
		if (previousSessionId === void 0) return void 0;
		const sessionId = sessionIdFor();
		const now = clock();
		await ports.createSession({
			sessionId,
			workspaceId: ports.workspaceId,
			...facts.agentPreset === void 0 ? {} : { agentPreset: facts.agentPreset }
		});
		const memberId = `m-${randomUUID()}`;
		let committed;
		try {
			committed = await ports.commit({
				expectedRevision: team.revision,
				mutate: (state) => {
					const index = state.members.findIndex((entry) => entry.memberId === member.memberId);
					const current = index < 0 ? void 0 : state.members[index];
					if (current === void 0) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `rotation target ${member.memberId} is no longer a member`, { auditDetail: "rotation target disappeared" });
					if (current.sessionId !== previousSessionId) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `member ${member.memberId} was rebound to another Session during rotation`, { auditDetail: "rotation target was rebound" });
					const previous = { ...current };
					const rotated = {
						...previous,
						memberId,
						sessionId,
						bindingGeneration: 1,
						contractRevision: 0,
						rotatedFrom: previous.memberId,
						rotatedAt: now
					};
					state.members[index] = rotated;
					state.archivedMemberIds.push(previous.memberId);
					if (state.leadMemberId === previous.memberId) state.leadMemberId = memberId;
					if (state.contactGrants !== void 0) state.contactGrants = state.contactGrants.map((grant) => ({
						...grant,
						from: grant.from === previous.memberId ? memberId : grant.from,
						to: grant.to === previous.memberId ? memberId : grant.to
					}));
					return {
						member: rotated,
						previous
					};
				}
			});
		} catch (error) {
			await ports.audit({
				kind: "session/orphaned",
				teamId: ports.teamId,
				sessionId,
				reason: messageOf(error),
				actor: "rotation",
				at: now
			}).catch(() => void 0);
			throw error;
		}
		const outcome = {
			previousMemberId: committed.value.previous.memberId,
			memberId,
			previousSessionId,
			sessionId,
			reason: decision.reason,
			detail: decision.detail,
			completedTasks: facts.completedTasks,
			...contextTokens === void 0 ? {} : { contextTokens }
		};
		await ports.audit({
			kind: "member/rotated",
			teamId: ports.teamId,
			memberId,
			previousMemberId: outcome.previousMemberId,
			sessionId,
			previousSessionId,
			displayName: committed.value.member.displayName,
			role: committed.value.member.role,
			reason: decision.reason,
			detail: decision.detail,
			completedTasks: facts.completedTasks,
			...contextTokens === void 0 ? {} : { contextTokens },
			at: now,
			actor: "rotation"
		});
		ports.onRotated?.(outcome);
		if (ports.titleSession !== void 0) try {
			await ports.titleSession(sessionId, committed.value.member.displayName);
		} catch (error) {
			logger(`live-teams: rotated member ${memberId} kept its default title: ${messageOf(error)}`);
		}
		return outcome;
	}
	async function pass() {
		const config = ports.config;
		if (!config.enabled) return [];
		let team;
		try {
			team = await ports.readTeam();
		} catch (error) {
			logger(`live-teams: rotation could not read the team: ${messageOf(error)}`);
			return [];
		}
		const outcomes = [];
		for (const member of team.members) {
			if (outcomes.length >= config.maxRotationsPerPass) break;
			if (text(member.sessionId) === void 0) continue;
			const until = blockedUntil.get(member.memberId);
			if (until !== void 0 && clock() < until) continue;
			let facts;
			try {
				facts = await ports.factsOf(member);
			} catch (error) {
				logger(`live-teams: rotation could not read member ${member.memberId}: ${messageOf(error)}`);
				continue;
			}
			const sessionId = text(member.sessionId);
			let contextTokens;
			if (sessionId !== void 0) try {
				contextTokens = await ports.measureContextTokens(sessionId);
			} catch {
				contextTokens = void 0;
			}
			const decision = decideRotation({
				config,
				member,
				completedTasks: facts.completedTasks,
				openTasks: facts.openTasks,
				activeAttempt: facts.activeAttempt,
				sessionStatus: facts.sessionStatus,
				undeliveredMessages: facts.undeliveredMessages,
				contextTokens
			});
			if (!decision.rotate) continue;
			try {
				const outcome = await rotateOne(team, member, facts, decision, contextTokens);
				if (outcome === void 0) continue;
				outcomes.push(outcome);
				blockedUntil.delete(member.memberId);
			} catch (error) {
				if (config.cooldownMs > 0) blockedUntil.set(member.memberId, clock() + config.cooldownMs);
				logger(`live-teams: rotation of ${member.memberId} failed: ${messageOf(error)}`);
			}
		}
		return outcomes;
	}
	return {
		config: ports.config,
		check: async () => {
			if (running !== void 0) return running;
			running = pass();
			try {
				return await running;
			} finally {
				running = void 0;
			}
		}
	};
}
export { DEFAULT_ROTATION_CONFIG, createRotationService, decideRotation, readRotationConfig };
