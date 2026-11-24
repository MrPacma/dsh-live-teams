import { LiveTeamsError } from "./errors.js";
import "./mailbox.js";
import { assignmentRouteText, blockedBy, taskDocumentPath } from "./task-store.js";
import { readDispatchSwitch } from "./team-store.js";
import { CODING_KINDS, SHARED_PATH_DEFAULTS, scopeConflict } from "./scope.js";
// src/dispatch.ts
/**
* The dispatcher is a reconciler, not an event handler: callers pass it wake-up
* signals, and every pass recomputes its decisions from durable state. A missed
* signal therefore cannot lose work, and a duplicated one cannot duplicate it.
*
* It has exactly two actions — retry a delivery that never reached its member, and
* start an assigned task whose gate is open — and it never chooses a member, never
* moves ownership, never edits a contract and never escalates.
*/
const DISPATCH_REASONS = Object.freeze([
	"dispatch-paused",
	"attempt-revoking",
	"human-gate",
	"task-not-ready",
	"no-assignee",
	"dependency-open",
	"coding-not-isolated",
	"human-intervened",
	"task-settled-during-pass",
	"paths-undeclared",
	"paths-overlap",
	"paths-shared",
	"attempt-active",
	"member-unknown",
	"member-paused",
	"member-busy",
	"no-session",
	"ok"
]);
/** The verdict follows from the reason, so the two can never disagree. */
const VERDICTS = {
	"ok": "assign",
	"attempt-active": "active",
	"dispatch-paused": "wait",
	"attempt-revoking": "wait",
	"human-gate": "wait",
	"dependency-open": "wait",
	"coding-not-isolated": "wait",
	"human-intervened": "wait",
	"task-settled-during-pass": "wait",
	"paths-undeclared": "wait",
	"paths-overlap": "wait",
	"paths-shared": "wait",
	"member-paused": "wait",
	"member-busy": "wait",
	"no-session": "wait",
	"task-not-ready": "refused",
	"no-assignee": "refused",
	"member-unknown": "refused"
};
const TERMINAL = [
	"completed",
	"failed",
	"cancelled"
];
/** The assignment message for one attempt; also its dedupe key across passes. */
function assignmentThread(taskId, attemptId) {
	return `dispatch:${taskId}:${attemptId}`;
}
/** The latest attempt of a task that carries a mark the contract has not caught up with. */
function unresolvedIntervention(task, attempts) {
	const latest = attempts.filter((attempt) => attempt.taskId === task.id).sort((left, right) => right.generation - left.generation)[0];
	if (latest?.humanIntervenedAt === void 0) return void 0;
	return (task.contractRevision ?? 0) <= (latest.humanIntervenedContractRevision ?? 0) ? latest : void 0;
}
function activeAttemptOf(task, attempts) {
	return task.activeAttemptId === void 0 ? void 0 : attempts.find((attempt) => attempt.id === task.activeAttemptId);
}
function memberName(team, memberId) {
	return team.members.find((member) => member.memberId === memberId)?.displayName ?? memberId;
}
/**
* The gate. The first blocker wins and its name *is* what the human reads, so the
* states that need a person are reported as what they are before the generic ones.
*/
function evaluateTask(input) {
	const { task, tasks, attempts, team } = input;
	const assignee = task.assignee;
	const base = {
		taskId: task.id,
		title: task.title,
		status: task.status,
		...assignee === void 0 ? {} : { assignee }
	};
	const verdict = (reason, detail, warning) => ({
		...base,
		decision: VERDICTS[reason],
		reason,
		detail,
		...warning === void 0 ? {} : { warning }
	});
	const attempt = activeAttemptOf(task, attempts);
	if (input.paused) return verdict("dispatch-paused", "automatic dispatch is paused");
	if (attempt?.status === "revoking") return verdict("attempt-revoking", `attempt ${attempt.id} is revoking — settle the revocation before anything starts beside it`);
	const own = unresolvedIntervention(task, attempts);
	if (own !== void 0) return verdict("human-intervened", `a human wrote into ${memberName(team, own.memberId)}'s Session directly (attempt ${own.id}); resolve the intervention by accepting/revising an undecided submission, revoking then editing and explicitly resuming parked work, or cancelling the task; the in-flight contract is frozen`);
	if (task.status === "waiting") return verdict("human-gate", "the submission is waiting for a decision: the reviewer, or the lead after an escalation");
	if (task.status === "needs_human") return verdict("human-gate", "the task needs a human decision");
	if (attempt?.status === "active") {
		const active = verdict("attempt-active", `attempt ${attempt.id} is active with ${memberName(team, attempt.memberId)}`);
		return attempt.stalled === void 0 ? active : {
			...active,
			stalled: attempt.stalled
		};
	}
	if (task.status !== "ready") return verdict("task-not-ready", TERMINAL.includes(task.status) ? `task is ${task.status}` : `task is ${task.status}, not ready`);
	if (assignee === void 0 || assignee.length === 0) return verdict("no-assignee", "the task has no assignee");
	const blockers = blockedBy(task, input.universe ?? tasks);
	if (blockers.length > 0) {
		const first = blockers[0];
		return verdict("dependency-open", `blocked by ${first.id} "${first.title}" (${first.status})${blockers.length > 1 ? ` and ${blockers.length - 1} more` : ""}`);
	}
	if (input.coding === "manual" && CODING_KINDS.has(task.kind)) return verdict("coding-not-isolated", `${task.kind} work is not started automatically: this deployment has not accepted coding dispatch without per-member isolation, and this host cannot provide it (ADR 0008 — set codingDispatch: automatic to accept the shared tree)`);
	const intervenedDependency = (task.dependsOn ?? []).map((id) => tasks.find((entry) => entry.id === id)).find((dependency) => dependency !== void 0 && dependency.status === "completed" && unresolvedIntervention(dependency, attempts) !== void 0);
	if (intervenedDependency !== void 0) return verdict("human-intervened", `dependency ${intervenedDependency.id} "${intervenedDependency.title}" was completed after a human changed its work directly, and the change was never recorded`);
	const member = input.memberOf(assignee);
	if (member === void 0) return verdict("member-unknown", "the assignee is not a current team member");
	if (member.availability !== "available") return verdict("member-paused", `${member.displayName} is ${member.availability === "paused" ? "paused" : `unavailable (${String(member.availability)})`}`);
	const busy = attempts.find((candidate) => candidate.status === "active" && candidate.memberId === assignee && candidate.taskId !== task.id);
	if (busy !== void 0) return verdict("member-busy", `${member.displayName} already holds attempt ${busy.id} on ${busy.taskId}`);
	if (member.sessionId === void 0 || member.sessionId.length === 0) return verdict("no-session", `${member.displayName} has no Session bound`);
	if (CODING_KINDS.has(task.kind)) {
		const writers = attempts.filter((candidate) => candidate.status === "active" && candidate.taskId !== task.id).map((candidate) => ({
			attempt: candidate,
			other: (input.universe ?? tasks).find((entry) => entry.id === candidate.taskId)
		})).filter((entry) => entry.other !== void 0 && CODING_KINDS.has(entry.other.kind));
		if (writers.length > 0) {
			const shared = [...SHARED_PATH_DEFAULTS, ...input.sharedPaths ?? []];
			const own = task.paths ?? [];
			if (own.length === 0) {
				const active = writers[0];
				return verdict("paths-undeclared", `another writing task is active (${active.other.id} "${active.other.title}"), and this task declares no paths — declare them so the two can be shown to be disjoint`);
			}
			for (const writer of writers) {
				const otherPaths = writer.other?.paths ?? [];
				if (otherPaths.length === 0) return verdict("paths-overlap", `${writer.other?.id} "${writer.other?.title}" is writing and declares no paths, so its scope is unknown`);
				const conflict = scopeConflict(own, otherPaths, shared);
				if (conflict === void 0) continue;
				const pair = `${conflict.left} × ${conflict.right}`;
				if (conflict.kind === "shared") return verdict("paths-shared", `${pair} is shared by every task, and ${writer.other?.id} "${writer.other?.title}" is writing — serialise the two with dependsOn, or hand one over deliberately`);
				return verdict("paths-overlap", `${pair} intersects ${writer.other?.id} "${writer.other?.title}", which is writing now`);
			}
		}
	}
	const preferred = input.preferredKindsOf?.(assignee) ?? [];
	const warning = preferred.length > 0 && !preferred.includes(task.kind) ? `${member.displayName}'s role prefers ${preferred.join(", ")}, and this task is ${task.kind}` : void 0;
	return verdict("ok", `eligible to start as attempt for ${member.displayName}`, warning);
}
function projectDispatch(input) {
	const evaluations = input.tasks.map((task) => evaluateTask({
		...input,
		task,
		paused: input.dispatch.mode === "paused",
		coding: input.dispatch.coding ?? "manual"
	})).sort((left, right) => left.taskId.localeCompare(right.taskId));
	const counts = {
		assign: 0,
		active: 0,
		wait: 0,
		refused: 0
	};
	for (const evaluation of evaluations) counts[evaluation.decision] += 1;
	const paused = input.dispatch.mode === "paused";
	return {
		paused,
		coding: input.dispatch.coding ?? "manual",
		...paused && input.dispatch.by !== void 0 ? { pausedBy: input.dispatch.by } : {},
		...paused && input.dispatch.reason !== void 0 ? { pausedReason: input.dispatch.reason } : {},
		evaluations,
		counts
	};
}
function assignmentText(task, attempt, team, workspacePath) {
	const route = assignmentRouteText(task.route, team);
	const contact = task.humanContact === "required" ? "required before finishing" : task.humanContact === "expected" ? "expected — the lead will arrange it" : "none expected";
	return [
		`You have been assigned task ${task.id}: ${task.title} (${task.kind}).`,
		`A claim was made for you as attempt ${attempt.id}.`,
		`- Route: ${route}`,
		`- Round limit: ${task.roundLimit}`,
		`- Human contact: ${contact}`,
		`- Document: ${taskDocumentPath(workspacePath, task.teamId, task.id)}`,
		`Read current state with live_team_read_task before any action. This queued notification may be stale: only proceed if task ${task.id} is claimed/in_progress, your active attempt is still ${attempt.id}, and there is no newer submission. Ignore closed, archived, replaced or already-submitted work; never revive it or overwrite newer/human instructions.`,
		`If still current, acknowledge through live_team_ack_task before starting. Do not send a peer acknowledgement or waiting/progress message to the lead.`,
		"Report a blocker with live_team_send to your lead rather than working around it."
	].join("\n");
}
/**
* Read a live Agent's status the way the reconciler needs it.
*
* `unknown` is a real answer, not a fallback to `idle`: a Session the host cannot observe must not be
* reported as finished work, because "idle and nothing submitted" is exactly the silence the stalled
* detector marks. One function for both callers (the stalled detector and the rotation gate), so the
* two cannot drift into disagreeing about whether a member is working.
*/
function sessionStatusFromAgent(agent) {
	if (agent === void 0 || agent === null) return "unknown";
	const status = agent.status;
	return status === "running" ? "running" : status === "idle" ? "idle" : "unknown";
}
const TRIGGER_KINDS = /^(task|attempt|submission|review|member|team|delivery)\//;
function createDispatcher(ports) {
	const logger = ports.logger ?? (() => void 0);
	const now = ports.now ?? Date.now;
	const maxActions = ports.maxActionsPerPass ?? 8;
	const sweepIntervalMs = ports.sweepIntervalMs ?? 3e4;
	let warnedUnobservable = false;
	let running;
	let rerun = false;
	let timer;
	let stopped = false;
	/** Last reason seen per task, so a journal entry marks a transition, not a pass. */
	const lastReason = /* @__PURE__ */ new Map();
	async function wakeHalf(result) {
		const expired = await ports.mailbox.retryExpiredLeases();
		for (const delivery of expired) {
			if (delivery.state !== "delivered") continue;
			result.woke.push({
				deliveryId: delivery.id,
				messageId: delivery.messageId,
				state: delivery.state
			});
			await ports.appendAudit({
				kind: "dispatch/woke",
				teamId: ports.teamId,
				deliveryId: delivery.id,
				messageId: delivery.messageId,
				state: delivery.state,
				at: now()
			});
		}
		const state = await ports.readTeam();
		for (const delivery of await ports.mailbox.listDeliveries()) {
			if (delivery.state !== "stored" || delivery.wakePolicy !== "queue") continue;
			try {
				const woken = await ports.mailbox.deliver(delivery.id);
				result.woke.push({
					deliveryId: woken.id,
					messageId: woken.messageId,
					state: woken.state
				});
				await ports.appendAudit({
					kind: "dispatch/woke",
					teamId: ports.teamId,
					deliveryId: woken.id,
					messageId: woken.messageId,
					state: woken.state,
					at: now()
				});
			} catch (error) {
				logger(`live-teams: dispatch could not deliver stored ${delivery.id}: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
		for (const delivery of await ports.mailbox.listDeliveries()) {
			if (delivery.state !== "failed" || delivery.failure !== "recipient has no current session binding") continue;
			const member = state.members.find((candidate) => candidate.memberId === delivery.recipient);
			if (member?.sessionId === void 0 || member.bindingGeneration === void 0) continue;
			try {
				const retried = await ports.mailbox.retryDelivery(delivery.id);
				if (retried.state !== "delivered") continue;
				result.woke.push({
					deliveryId: retried.id,
					messageId: retried.messageId,
					state: retried.state
				});
				await ports.appendAudit({
					kind: "dispatch/woke",
					teamId: ports.teamId,
					deliveryId: retried.id,
					messageId: retried.messageId,
					state: retried.state,
					at: now()
				});
			} catch (error) {
				logger(`live-teams: dispatch could not retry delivery ${delivery.id}: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
	}
	async function startHalf(state, result) {
		const universe = await ports.taskStore.listTasks({ includeArchived: true });
		const tasks = universe.filter((task) => task.archivedPath === void 0);
		result.evaluated = tasks.length;
		const attempts = (await ports.taskStore.readAttempts()).attempts;
		const messages = await ports.mailbox.listMessages();
		const deliveries = await ports.mailbox.listDeliveries();
		const memberOf = (memberId) => state.members.find((member) => member.memberId === memberId);
		let actions = 0;
		for (const task of [...tasks].sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id))) {
			const evaluation = evaluateTask({
				task,
				tasks,
				universe,
				attempts,
				team: state,
				paused: false,
				coding: ports.codingDispatch ?? "manual",
				...ports.sharedPaths === void 0 ? {} : { sharedPaths: ports.sharedPaths },
				memberOf,
				...ports.preferredKindsOf === void 0 ? {} : { preferredKindsOf: ports.preferredKindsOf }
			});
			const previous = lastReason.get(task.id);
			lastReason.set(task.id, evaluation.reason);
			const attempt = task.activeAttemptId === void 0 ? void 0 : attempts.find((candidate) => candidate.id === task.activeAttemptId);
			const repair = evaluation.decision === "active" && attempt !== void 0 && !messages.some((candidate) => candidate.threadId === assignmentThread(task.id, attempt.id));
			if (evaluation.decision !== "assign" && !repair) {
				result.skipped.push({
					taskId: task.id,
					reason: evaluation.reason,
					detail: evaluation.detail
				});
				if (previous !== void 0 && previous !== evaluation.reason && evaluation.reason !== "attempt-active") {
					result.blocked.push({
						taskId: task.id,
						reason: evaluation.reason,
						detail: evaluation.detail
					});
					await ports.appendAudit({
						kind: "dispatch/blocked",
						teamId: ports.teamId,
						taskId: task.id,
						reason: evaluation.reason,
						detail: evaluation.detail,
						from: previous,
						at: now()
					});
				}
				continue;
			}
			if (actions >= maxActions) {
				result.skipped.push({
					taskId: task.id,
					reason: evaluation.reason,
					detail: "per-pass action limit reached"
				});
				continue;
			}
			actions += 1;
			const member = memberOf(task.assignee);
			try {
				const claimed = await ports.taskStore.claimTask({
					taskId: task.id,
					memberId: member.memberId,
					sessionId: member.sessionId,
					bindingGeneration: member.bindingGeneration
				});
				if (!attempts.some((candidate) => candidate.id === claimed.attempt.id)) attempts.push(claimed.attempt);
				const settled = (await ports.taskStore.listTasks({ includeArchived: true })).find((candidate) => candidate.id === task.id);
				if (settled === void 0 || TERMINAL.includes(settled.status)) {
					result.skipped.push({
						taskId: task.id,
						reason: "task-settled-during-pass",
						detail: `the task became ${settled?.status ?? "unknown"} while this pass was running; no assignment was sent`
					});
					continue;
				}
				const threadId = assignmentThread(task.id, claimed.attempt.id);
				const existing = messages.find((message) => message.threadId === threadId);
				if (existing !== void 0) {
					for (const delivery of deliveries.filter((candidate) => candidate.messageId === existing.id)) {
						if (delivery.state === "delivered" || delivery.state === "acknowledged") continue;
						try {
							await ports.mailbox.deliver(delivery.id);
						} catch (error) {
							logger(`live-teams: dispatch could not deliver ${delivery.id}: ${error instanceof Error ? error.message : String(error)}`);
						}
					}
					result.started.push({
						taskId: task.id,
						attemptId: claimed.attempt.id,
						memberId: member.memberId,
						messageId: existing.id,
						detail: "already dispatched"
					});
					continue;
				}
				const sent = await ports.mailbox.sendFromScheduler({
					to: member.memberId,
					kind: "message",
					content: assignmentText(task, claimed.attempt, state, ports.workspacePath),
					threadId
				});
				const messageId = sent.message.id;
				messages.push(sent.message);
				result.started.push({
					taskId: task.id,
					attemptId: claimed.attempt.id,
					memberId: member.memberId,
					messageId,
					detail: repair ? `repaired a lost assignment for attempt ${claimed.attempt.id}` : evaluation.detail
				});
				await ports.appendAudit({
					kind: "dispatch/assigned",
					teamId: ports.teamId,
					taskId: task.id,
					attemptId: claimed.attempt.id,
					memberId: member.memberId,
					messageId,
					reason: evaluation.reason,
					detail: evaluation.detail,
					...repair ? { repair: true } : {},
					at: now()
				});
			} catch (error) {
				const message = error instanceof LiveTeamsError ? error.message : error instanceof Error ? error.message : String(error);
				result.failures.push(`${task.id}: ${message}`);
				logger(`live-teams: dispatch could not start ${task.id}: ${message}`);
			}
		}
	}
	/**
	* Mark attempts a human wrote into mid-flight (B31). Only active attempts are
	/**
	* Close attempts left active on a task that has already ended (F5 of the first live
	* run). The store writes the audit; the pass only reports what it healed, because a
	* stale active attempt makes its member look busy for every later task.
	*/
	/**
	* Show an attempt that is not moving (F3 of the live pilot).
	*
	* Detection only: nothing is revoked and nothing is reassigned, because silence is not death — a
	* member may be thinking, waiting for a person, or finished with a task it has not submitted. What
	* the product owes the human is that silence is *visible*, with the two signals that mean it:
	*
	*   - the assignment was never acknowledged (the task is still `claimed` long after the claim);
	*   - the work was acknowledged but nothing came of it: still no submission, and the Session is
	*     idle rather than running.
	*
	* A submission waiting for a reviewer, a lead or a person is deliberately *not* a stall: the ball
	* is with somebody, and the projection already says who.
	*/
	async function observeStalledAttempts(state, result) {
		const threshold = ports.stalledAfterMs ?? 6e5;
		const now = ports.now?.() ?? Date.now();
		const tasks = await ports.taskStore.listTasks({ includeArchived: true });
		const attempts = (await ports.taskStore.readAttempts()).attempts;
		for (const attempt of attempts) {
			if (attempt.status !== "active" || attempt.stalled !== void 0) continue;
			const task = tasks.find((candidate) => candidate.id === attempt.taskId);
			if (task === void 0 || task.latestSubmissionId !== void 0) continue;
			const silence = now - (task.status === "claimed" ? attempt.startedAt : Math.max(attempt.startedAt, task.updatedAt));
			if (silence < threshold) continue;
			let reason = "unacknowledged";
			let detail = `${memberName(state, attempt.memberId)} has not acknowledged the assignment in ${Math.round(silence / 6e4)} minutes`;
			if (task.status !== "claimed") {
				if (ports.sessionStatus === void 0) continue;
				if (await ports.sessionStatus(attempt.sessionId).catch(() => "unknown") !== "idle") continue;
				reason = "idle";
				detail = `${memberName(state, attempt.memberId)} acknowledged the work ${Math.round(silence / 6e4)} minutes ago, its Session is idle and nothing has been submitted`;
			}
			if (await ports.taskStore.markAttemptStalled({
				attemptId: attempt.id,
				reason,
				detail,
				actor: "reconciler"
			}).catch(() => false)) result.stalled.push({
				taskId: attempt.taskId,
				attemptId: attempt.id,
				memberId: attempt.memberId,
				reason,
				detail
			});
		}
	}
	async function healTerminalAttempts() {
		try {
			const healed = await ports.taskStore.closeTerminalAttempts();
			if (healed.closed.length > 0) logger(`live-teams: closed ${healed.closed.length} attempt(s) whose task had already ended: ${healed.closed.map((entry) => `${entry.attemptId} (${entry.status})`).join(", ")}`);
			const pruned = await ports.taskStore.pruneSnapshots();
			if (pruned > 0) logger(`live-teams: removed ${pruned} stale scope snapshot(s)`);
			const orphans = await ports.mailbox.healOrphanMessages().catch(() => []);
			for (const orphan of orphans) logger(`live-teams: message ${orphan.messageId} had no delivery row; recorded a failed delivery to ${orphan.recipient}`);
			if (ports.gitTip !== void 0) {
				const interrupted = await ports.taskStore.reconcilePendingIntegrations({
					tipOf: ports.gitTip,
					actor: "reconciler"
				});
				for (const entry of interrupted) logger(`live-teams: integration pending on ${entry.taskId} (${entry.state}): ${entry.detail}`);
			}
		} catch (error) {
			logger(`live-teams: could not close stale attempts: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
	/**
	* Mark attempts a human wrote into mid-flight (B31). Only active attempts are
	* observed: the mark matters while work is in progress, and once set it persists on
	* the record, so a later pass cannot miss it.
	*/
	async function observeInterventions(result) {
		if (ports.humanActivity === void 0) {
			if (!warnedUnobservable) {
				warnedUnobservable = true;
				logger("live-teams: human intervention cannot be observed in this composition; no attempt will be marked");
			}
			return;
		}
		const attempts = (await ports.taskStore.readAttempts()).attempts.filter((attempt) => attempt.status === "active" && attempt.humanIntervenedAt === void 0);
		for (const attempt of attempts) {
			let observed;
			try {
				observed = await ports.humanActivity(attempt.sessionId, attempt.startedAt);
			} catch (error) {
				logger(`live-teams: could not observe Session ${attempt.sessionId}: ${error instanceof Error ? error.message : String(error)}`);
				continue;
			}
			if (observed !== true) continue;
			if (!(await ports.taskStore.markHumanIntervention(attempt.id, now())).changed) continue;
			result.intervened.push({
				attemptId: attempt.id,
				taskId: attempt.taskId,
				memberId: attempt.memberId
			});
		}
	}
	async function pass(trigger) {
		const result = {
			trigger,
			paused: false,
			evaluated: 0,
			started: [],
			woke: [],
			blocked: [],
			skipped: [],
			intervened: [],
			stalled: [],
			failures: []
		};
		const state = await ports.readTeam();
		const dispatch = readDispatchSwitch(state);
		result.paused = dispatch.mode === "paused";
		await healTerminalAttempts();
		await observeInterventions(result);
		await ports.recoverObsoleteAssignments?.();
		await wakeHalf(result);
		await ports.recoverReviewReturns?.();
		await ports.recoverSubmissionNotifications?.();
		await ports.recoverLifecycleNotifications?.();
		await observeStalledAttempts(state, result);
		if (dispatch.mode === "auto") await startHalf(state, result);
		if (dispatch.mode === "auto" && ports.rotation !== void 0) try {
			await ports.rotation();
		} catch (error) {
			logger(`live-teams: rotation pass failed: ${error instanceof Error ? error.message : String(error)}`);
		}
		return result;
	}
	/**
	* One pass, guarded by a single-flight latch. The latch is cleared from a
	* continuation registered *after* it is set: clearing it inside the pass's own
	* `finally` runs synchronously when the pass refuses before its first `await`,
	* which would leave the latch holding a settled promise and turn every later
	* reconcile into a replay of that first refusal (found by the B29 host check).
	*/
	function reconcile(trigger) {
		if (stopped) return Promise.resolve({
			trigger,
			paused: false,
			evaluated: 0,
			started: [],
			woke: [],
			blocked: [],
			skipped: [],
			intervened: [],
			stalled: [],
			failures: ["the dispatcher is stopped"]
		});
		if (running !== void 0) {
			rerun = true;
			return running;
		}
		const attempt = runPass(trigger);
		running = attempt;
		const settle = () => {
			if (running === attempt) running = void 0;
			if (rerun && !stopped) {
				rerun = false;
				reconcile("coalesced");
			}
		};
		attempt.then(settle, settle);
		return attempt;
	}
	async function runPass(trigger) {
		try {
			if (ports.enabled?.() === false) return {
				trigger,
				paused: false,
				evaluated: 0,
				started: [],
				woke: [],
				blocked: [],
				skipped: [],
				intervened: [],
				stalled: [],
				failures: [ports.inactiveReason?.() ?? "the team is not active"]
			};
			return await pass(trigger);
		} catch (error) {
			const message = error instanceof LiveTeamsError ? error.message : error instanceof Error ? error.message : String(error);
			logger(`live-teams: dispatch pass failed (${trigger}): ${message}`);
			return {
				trigger,
				paused: false,
				evaluated: 0,
				started: [],
				woke: [],
				blocked: [],
				skipped: [],
				intervened: [],
				stalled: [],
				failures: [message]
			};
		}
	}
	return {
		reconcile,
		notice: (event) => {
			const kind = typeof event?.kind === "string" ? event.kind : "";
			if (kind.length === 0 || kind.startsWith("dispatch/") || !TRIGGER_KINDS.test(kind)) return;
			reconcile(`event:${kind}`);
		},
		start: () => {
			if (stopped || timer !== void 0) return;
			const interval = setInterval(() => {
				reconcile("sweep");
			}, sweepIntervalMs);
			interval.unref?.();
			timer = interval;
			reconcile("startup");
		},
		stop: async () => {
			stopped = true;
			if (timer !== void 0) clearInterval(timer);
			timer = void 0;
			try {
				await running;
			} catch {}
		}
	};
}
export { DISPATCH_REASONS, assignmentText, assignmentThread, createDispatcher, evaluateTask, projectDispatch, sessionStatusFromAgent };
