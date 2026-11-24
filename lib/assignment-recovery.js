import { assignmentDeliveryAllowed, assignmentFence } from "./assignment-guard.js";
// src/assignment-recovery.ts
/** Bounded reconciliation of exact plugin-owned input; no task mutation or Agent interruption. */
function createAssignmentRecovery(deps) {
	const settled = /* @__PURE__ */ new Set();
	const observed = /* @__PURE__ */ new Map();
	/**
	* Set once the host has refused to remove queued input because the capability is absent.
	*
	* In that state the command stays pending forever, so every pass would report the same items again
	* — and after a restart every stored command is reported once more. Measured on a real team: 1 387
	* such events for three days of work, growing by two a minute with nothing changing. One event per
	* process carries the count; the rest is silence, because the removal cannot succeed anyway.
	*/
	let removalUnavailable = false;
	let unavailableReported = false;
	let cursor = 0;
	let running;
	const pass = async () => {
		const messages = new Map((await deps.listMessages()).map((message) => [message.id, message]));
		const candidates = (await deps.listCommands()).flatMap((command) => {
			const message = command.causationId === void 0 ? void 0 : messages.get(command.causationId);
			if (message === void 0 || message.teamId !== deps.teamId || command.mode !== "queue" || settled.has(command.requestId)) return [];
			const fence = assignmentFence(message);
			if (fence === void 0 || command.requestId !== `${deps.teamId}:${message.id}:${fence.assignee}:queue`) return [];
			return [{
				command,
				message,
				fence
			}];
		});
		if (candidates.length === 0) {
			cursor = 0;
			return;
		}
		const count = Math.min(candidates.length, Math.max(1, deps.limit ?? 8));
		for (let i = 0; i < count; i++) {
			const { command, message, fence } = candidates[(cursor + i) % candidates.length];
			if (removalUnavailable) continue;
			if (await assignmentDeliveryAllowed(deps.store, message, command.sessionId, command.bindingGeneration)) continue;
			const result = await deps.bridge.removeQueuedRequest(command.sessionId, command.requestId);
			if (result.state === "removed" || result.state === "not-pending") settled.add(command.requestId);
			if (result.reason === "pending-queue-unavailable") {
				removalUnavailable = true;
				if (!unavailableReported) {
					unavailableReported = true;
					await deps.appendAudit({
						kind: "dispatch/obsolete-input",
						state: result.state,
						reason: result.reason,
						skipped: candidates.length,
						at: Date.now(),
						actor: "scheduler"
					});
				}
				continue;
			}
			const fingerprint = `${result.state}:${result.reason ?? ""}`;
			if (observed.get(command.requestId) === fingerprint) continue;
			await deps.appendAudit({
				kind: "dispatch/obsolete-input",
				taskId: fence.taskId,
				attemptId: fence.attemptId,
				messageId: message.id,
				requestId: command.requestId,
				memberId: fence.assignee,
				state: result.state,
				...result.itemId === void 0 ? {} : { itemId: result.itemId },
				...result.reason === void 0 ? {} : { reason: result.reason },
				at: Date.now(),
				actor: "scheduler"
			});
			observed.set(command.requestId, fingerprint);
		}
		cursor = (cursor + count) % candidates.length;
	};
	return async () => {
		if (running !== void 0) return running;
		const operation = pass();
		running = operation;
		try {
			await operation;
		} finally {
			if (running === operation) running = void 0;
		}
	};
}
export { createAssignmentRecovery };
