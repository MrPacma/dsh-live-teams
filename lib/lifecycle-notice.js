import { ERROR_CODES, LiveTeamsError } from "./errors.js";
// src/lifecycle-notice.ts
function lifecycleIntent(kind, contractRevision, fields) {
	return {
		id: `notice-${kind}:${fields.roundId ?? fields.submissionId ?? contractRevision}`,
		kind,
		contractRevision,
		...fields
	};
}
function withLifecycleIntent(task, intent) {
	return {
		...task,
		lifecycleNotices: [...(task.lifecycleNotices ?? []).filter((value) => value.kind !== intent.kind), intent]
	};
}
function validateLifecycleNotices(value) {
	if (!Array.isArray(value) || value.length > 4) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, "invalid lifecycle notification intents");
	const kinds = /* @__PURE__ */ new Set();
	for (const item of value) {
		if (item === null || typeof item !== "object" || typeof item.id !== "string" || !item.id || ![
			"review-verdict",
			"acceptance",
			"cancellation",
			"direction"
		].includes(item.kind) || kinds.has(item.kind) || !Number.isSafeInteger(item.contractRevision) || item.contractRevision < 0) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, "invalid lifecycle notification intent");
		kinds.add(item.kind);
		if ((item.kind === "review-verdict" ? ["roundId", "submissionId"] : item.kind === "acceptance" ? ["submissionId", "assignee"] : item.kind === "direction" ? [
			"assignee",
			"attemptId",
			"text"
		] : ["assignee", "text"]).some((key) => typeof item[key] !== "string" || !item[key])) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, "incomplete lifecycle notification intent");
	}
}
const PREFIX = "lifecycle-notice/v1:";
function lifecycleNoticeThread(request) {
	return PREFIX + Buffer.from(JSON.stringify([
		request.taskId,
		request.intent.id,
		request.recipient,
		request.sessionId,
		request.bindingGeneration
	])).toString("base64url");
}
function lifecycleNoticeFence(message) {
	if (message.from !== "scheduler" || !message.threadId?.startsWith(PREFIX)) return void 0;
	try {
		if (message.threadId.length > 4096) throw new Error();
		const v = JSON.parse(Buffer.from(message.threadId.slice(20), "base64url").toString("utf8"));
		if (!Array.isArray(v) || v.length !== 5 || !v.slice(0, 4).every((item) => typeof item === "string" && item.length > 0) || !Number.isSafeInteger(v[4]) || v[4] < 0 || v[2] !== message.to) throw new Error();
		return {
			taskId: v[0],
			intentId: v[1],
			recipient: v[2],
			sessionId: v[3],
			bindingGeneration: v[4]
		};
	} catch {
		throw new LiveTeamsError(ERROR_CODES.DELIVERY_REJECTED, "invalid lifecycle notice identity");
	}
}
async function lifecycleNoticeDeliveryAllowed(store, message, sessionId, bindingGeneration) {
	const f = lifecycleNoticeFence(message);
	return f === void 0 || f.sessionId === sessionId && f.bindingGeneration === bindingGeneration && await store.isLifecycleNoticeCurrent(f);
}
function createLifecycleNoticePort(options) {
	return async (request) => {
		const base = {
			recipient: request.recipient,
			purpose: request.intent.kind
		};
		if (!await request.stillCurrent()) return {
			...base,
			state: "superseded",
			reason: "lifecycle-action-no-longer-current"
		};
		const mailbox = options.mailbox();
		if (mailbox === void 0) return {
			...base,
			state: "unavailable",
			reason: "mailbox-unavailable"
		};
		const result = await mailbox.sendFromSchedulerOnce({
			to: request.recipient,
			kind: request.intent.kind === "direction" ? "direction" : "message",
			threadId: lifecycleNoticeThread(request),
			content: request.content
		});
		const delivery = result.deliveries.find((row) => row.recipient === request.recipient);
		const ids = {
			messageId: result.message.id,
			requestId: `${options.teamId}:${result.message.id}:${request.recipient}:queue`
		};
		if (delivery === void 0) return {
			...base,
			...ids,
			state: "failed",
			reason: "missing-delivery-receipt"
		};
		if (delivery.state === "failed") return await request.stillCurrent() ? {
			...base,
			...ids,
			state: "failed",
			reason: "delivery-failed"
		} : {
			...base,
			...ids,
			state: "superseded",
			reason: "lifecycle-action-no-longer-current"
		};
		return {
			...base,
			...ids,
			state: delivery.state === "delivered" || delivery.state === "acknowledged" ? "queued" : "pending"
		};
	};
}
export { createLifecycleNoticePort, lifecycleIntent, lifecycleNoticeDeliveryAllowed, lifecycleNoticeFence, lifecycleNoticeThread, validateLifecycleNotices, withLifecycleIntent };
