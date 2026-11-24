// src/errors.ts
/** Stable host-side error taxonomy and platform translation. */
const ERROR_CODES = Object.freeze({
	SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
	SESSION_WRONG_WORKSPACE: "SESSION_WRONG_WORKSPACE",
	SESSION_BUSY: "SESSION_BUSY",
	DELIVERY_REJECTED: "DELIVERY_REJECTED",
	MODEL_UNAVAILABLE: "MODEL_UNAVAILABLE",
	INTERRUPT_UNSUPPORTED: "INTERRUPT_UNSUPPORTED",
	PLUGIN_DISPOSING: "PLUGIN_DISPOSING",
	CAPABILITY_UNAVAILABLE: "CAPABILITY_UNAVAILABLE",
	REVISION_CONFLICT: "REVISION_CONFLICT",
	BINDING_STALE: "BINDING_STALE",
	SCHEMA_UNSUPPORTED: "SCHEMA_UNSUPPORTED",
	STATE_CORRUPT: "STATE_CORRUPT",
	/** ADR 0006: the reviewed base moved before integration, so the decision must be refreshed. */
	STALE_BASE: "STALE_BASE"
});
/** Audit text used when a member was rebound after command admission. */
const BINDING_STALE_MESSAGE = "the member was rebound after this command was admitted";
const SUBAGENT_OWNERSHIP_REASON = "use subagent delivery for this child session";
const platformErrorMap = /* @__PURE__ */ new Map([
	["session/not-found", "SESSION_NOT_FOUND"],
	["session/conflict", "SESSION_WRONG_WORKSPACE"],
	["session/workspace-attach-failed", "SESSION_WRONG_WORKSPACE"],
	["workspace/not-found", "SESSION_WRONG_WORKSPACE"],
	["session/steer-unavailable", "DELIVERY_REJECTED"],
	["session/attachment-invalid", "DELIVERY_REJECTED"],
	["session/invalid-time-zone", "DELIVERY_REJECTED"],
	["session/queue-item-not-found", "DELIVERY_REJECTED"],
	["session/model-unavailable", "MODEL_UNAVAILABLE"],
	["llm/model-discovery-rejected", "MODEL_UNAVAILABLE"],
	["session/title-invalid", "CAPABILITY_UNAVAILABLE"],
	["agent-preset/conflict", "CAPABILITY_UNAVAILABLE"],
	["session/fork-unavailable", "CAPABILITY_UNAVAILABLE"],
	["settings/rejected", "CAPABILITY_UNAVAILABLE"],
	["credential/rejected", "CAPABILITY_UNAVAILABLE"],
	["subagent/not-found", "CAPABILITY_UNAVAILABLE"],
	["subagent/unauthorized", "CAPABILITY_UNAVAILABLE"],
	["subagent/catalog-diagnostic", "CAPABILITY_UNAVAILABLE"],
	["gateway/cancelled", "PLUGIN_DISPOSING"],
	["gateway/bad-request", "CAPABILITY_UNAVAILABLE"],
	["gateway/internal", "CAPABILITY_UNAVAILABLE"]
]);
function isErrorCode(code) {
	return Object.prototype.hasOwnProperty.call(ERROR_CODES, code);
}
function rawMessage(value) {
	if (value instanceof Error) return value.message;
	if (typeof value === "string") return value;
	if (value !== null && typeof value === "object" && "message" in value) {
		const message = value.message;
		if (typeof message === "string") return message;
	}
	return String(value ?? "Unknown platform error");
}
function platformCodeOf(value) {
	if (value === null || typeof value !== "object") return void 0;
	const object = value;
	if (typeof object.code === "string") return object.code;
	if (typeof object.details?.code === "string") return object.details.code;
}
function platformReasonOf(value) {
	if (value === null || typeof value !== "object") return void 0;
	const details = value.details;
	return typeof details?.reason === "string" ? details.reason : void 0;
}
var LiveTeamsError = class extends Error {
	code;
	auditDetail;
	details;
	constructor(code, message, options = {}) {
		const normalizedCode = isErrorCode(code) ? code : "CAPABILITY_UNAVAILABLE";
		super(message, options.cause !== void 0 ? { cause: options.cause } : void 0);
		this.name = "LiveTeamsError";
		this.code = normalizedCode;
		this.auditDetail = options.auditDetail ?? message;
		this.details = options.details ?? {};
	}
};
/** Translate platform failures into stable domain errors. */
function translatePlatformError(error) {
	if (error instanceof LiveTeamsError) return error;
	const sourceCode = platformCodeOf(error);
	const reason = platformReasonOf(error);
	let code;
	if (sourceCode === "session/agent-busy") code = reason?.includes(SUBAGENT_OWNERSHIP_REASON) ? "CAPABILITY_UNAVAILABLE" : "SESSION_BUSY";
	else code = (sourceCode === void 0 ? void 0 : platformErrorMap.get(sourceCode)) ?? "CAPABILITY_UNAVAILABLE";
	const detail = sourceCode === void 0 || platformErrorMap.has(sourceCode) || sourceCode === "session/agent-busy" ? rawMessage(error) : `platform code ${sourceCode}: ${rawMessage(error)}`;
	return new LiveTeamsError(code, code, {
		auditDetail: detail,
		cause: error,
		details: {
			...sourceCode === void 0 ? {} : { platformCode: sourceCode },
			...reason === void 0 ? {} : { reason }
		}
	});
}
function platformErrorMappings() {
	return platformErrorMap;
}
export { BINDING_STALE_MESSAGE, ERROR_CODES, LiveTeamsError, platformErrorMappings, translatePlatformError };
