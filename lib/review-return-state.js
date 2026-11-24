// src/review-return-state.ts
const REVIEW_RETURN_STATES = [
	"pending",
	"sending",
	"delivered",
	"started",
	"completed",
	"blocked",
	"failed",
	"unconfirmed",
	"superseded"
];
/** Semantic notification budget; raw state transitions remain in audit/GUI. */
function reviewReturnNoticeClass(intent) {
	if (intent.state === "started" || intent.state === "completed") return "returned";
	if (intent.state === "blocked" || intent.state === "failed") return `problem:${intent.state}:${intent.reason ?? "unknown"}`;
	if (intent.state === "superseded" && [
		"dispatch-paused",
		"team-disabled",
		"human-intervened",
		"integration-pending",
		"member-unavailable",
		"binding-changed",
		"dependency-not-completed",
		"paths-overlap"
	].includes(intent.reason ?? "")) return `problem:blocked:${intent.reason}`;
	if (intent.state === "unconfirmed" && [
		"execution-unobservable",
		"observation-failed",
		"invalid-execution-receipt",
		"delivery-unavailable"
	].includes(intent.reason ?? "")) return `problem:unobservable:${intent.reason}`;
}
/** Whitelist operational metadata; never expose arbitrary source/message bodies. */
function parseReviewReturn(value) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid review return metadata");
	const record = value;
	const result = {};
	for (const key of [
		"roundId",
		"submissionId",
		"attemptId",
		"assignee",
		"sessionId"
	]) {
		if (typeof record[key] !== "string" || record[key].length === 0) throw new Error("invalid review return identity");
		result[key] = record[key];
	}
	for (const [key, minimum] of [
		["generation", 1],
		["bindingGeneration", 0],
		["at", 0]
	]) {
		if (!Number.isSafeInteger(record[key]) || Number(record[key]) < minimum) throw new Error("invalid review return counter");
		result[key] = record[key];
	}
	if (!REVIEW_RETURN_STATES.includes(record.state)) throw new Error("invalid review return state");
	result.state = record.state;
	for (const key of [
		"reason",
		"messageId",
		"requestId"
	]) if (record[key] !== void 0) {
		if (typeof record[key] !== "string" || record[key].length === 0) throw new Error("invalid review return text");
		result[key] = record[key];
	}
	if (record.admission !== void 0) {
		if (!["queued", "pending"].includes(String(record.admission)) || record.requestId === void 0) throw new Error("invalid review return admission receipt");
		result.admission = record.admission;
	}
	if (record.messageId === void 0 !== (record.requestId === void 0)) throw new Error("incomplete review return delivery identity");
	for (const key of ["turn", "inputSeq"]) if (record[key] !== void 0) {
		if (!Number.isSafeInteger(record[key]) || Number(record[key]) < 0) throw new Error("invalid review return execution metadata");
		result[key] = record[key];
	}
	if ([
		"delivered",
		"started",
		"completed"
	].includes(String(record.state)) && record.requestId === void 0) throw new Error("review return has no request receipt");
	if (["started", "completed"].includes(String(record.state)) && (record.turn === void 0 || record.inputSeq === void 0)) throw new Error("review return has no turn receipt");
	if (record.leadNotified !== void 0) {
		if (typeof record.leadNotified !== "boolean") throw new Error("invalid review return notice flag");
		result.leadNotified = record.leadNotified;
	}
	if (record.leadNotification !== void 0) {
		const receipt = record.leadNotification;
		if (receipt === null || typeof receipt !== "object" || receipt.purpose !== "review-return-lead" || typeof receipt.recipient !== "string" || !receipt.recipient || ![
			"queued",
			"pending",
			"failed",
			"unavailable",
			"superseded"
		].includes(String(receipt.state))) throw new Error("invalid review return lead receipt");
		const safe = {
			recipient: receipt.recipient,
			purpose: receipt.purpose,
			state: receipt.state
		};
		for (const key of [
			"messageId",
			"requestId",
			"reason"
		]) if (receipt[key] !== void 0) {
			if (typeof receipt[key] !== "string" || !receipt[key]) throw new Error("invalid review return lead receipt identity");
			safe[key] = receipt[key];
		}
		if (receipt.state === "queued" && (!safe.messageId || !safe.requestId)) throw new Error("missing review return lead admission receipt");
		if (receipt.sessionId !== void 0 || receipt.bindingGeneration !== void 0) {
			if (typeof receipt.sessionId !== "string" || !receipt.sessionId || !Number.isSafeInteger(receipt.bindingGeneration) || Number(receipt.bindingGeneration) < 0) throw new Error("invalid review return lead binding");
			safe.sessionId = receipt.sessionId;
			safe.bindingGeneration = receipt.bindingGeneration;
		}
		result.leadNotification = safe;
	}
	return result;
}
export { REVIEW_RETURN_STATES, parseReviewReturn, reviewReturnNoticeClass };
