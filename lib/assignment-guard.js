import { ERROR_CODES, LiveTeamsError } from "./errors.js";
// src/assignment-guard.ts
function assignmentFence(message) {
	if (message.from !== "scheduler" || !message.threadId?.startsWith("dispatch:")) return void 0;
	const match = /^dispatch:([^:]+):([^:]+)$/.exec(message.threadId);
	if (match === null || message.to === "team" || message.to === "human") throw new LiveTeamsError(ERROR_CODES.DELIVERY_REJECTED, "invalid scheduler assignment identity");
	return {
		taskId: match[1],
		attemptId: match[2],
		assignee: message.to
	};
}
/** Inspect durable ownership, not prose or an Agent's generic running flag. */
async function assignmentDeliveryAllowed(store, message, sessionId, bindingGeneration) {
	const fence = assignmentFence(message);
	if (fence === void 0) return true;
	const task = (await store.listTasks({ includeArchived: true })).find((entry) => entry.id === fence.taskId);
	if (task === void 0 || task.archivedPath !== void 0 || !["claimed", "in_progress"].includes(task.status) || task.latestSubmissionId !== void 0 || task.assignee !== fence.assignee || task.activeAttemptId !== fence.attemptId) return false;
	const attempt = (await store.readAttempts()).attempts.find((entry) => entry.id === fence.attemptId);
	return attempt?.status === "active" && attempt.taskId === task.id && attempt.memberId === fence.assignee && attempt.sessionId === sessionId && attempt.bindingGeneration === bindingGeneration;
}
export { assignmentDeliveryAllowed, assignmentFence };
