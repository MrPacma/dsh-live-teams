import { randomUUID } from "node:crypto";
import path from "node:path";
import { BINDING_STALE_MESSAGE, ERROR_CODES, LiveTeamsError } from "./errors.js";
import { atomicWriteJson, clone, fileExists, readJson, withProcessLock } from "./storage.js";
// src/command-queue.ts
const DELIVERED_STATES = /* @__PURE__ */ new Set(["admitted", "applied"]);
const AWAITING_DELIVERY_STATES = /* @__PURE__ */ new Set(["pending", "leased"]);
function text(value) {
	return typeof value === "string" && value.length > 0 ? value : void 0;
}
function findByIdempotencyKey(records, key) {
	return records.find((record) => record.idempotencyKey === key);
}
var SessionCommandQueue = class {
	workspacePath;
	teamId;
	deliver;
	bindingGenerationOf;
	now;
	file;
	constructor(options) {
		if (text(options?.workspacePath) === void 0) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, "command queue requires a workspacePath");
		if (text(options?.teamId) === void 0) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, "command queue requires a teamId");
		if (typeof options?.deliver !== "function") throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, "command queue requires a delivery port");
		this.workspacePath = path.resolve(options.workspacePath);
		this.teamId = options.teamId;
		this.deliver = options.deliver;
		this.bindingGenerationOf = options.bindingGenerationOf;
		this.now = options.now ?? Date.now;
		this.now;
		this.file = path.join(this.workspacePath, ".dsh-live-teams", "teams", this.teamId, "commands.json");
	}
	async list() {
		return this.read();
	}
	async listPending(teamId) {
		if (teamId !== void 0 && teamId !== this.teamId) return [];
		return (await this.read()).filter((record) => AWAITING_DELIVERY_STATES.has(record.state));
	}
	async admit(request) {
		const idempotencyKey = text(request?.idempotencyKey);
		const sessionId = text(request?.sessionId);
		if (idempotencyKey === void 0) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, "admit requires an idempotencyKey");
		if (sessionId === void 0) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, "admit requires a sessionId");
		if (request.mode !== "queue" && request.mode !== "steer") throw new LiveTeamsError(ERROR_CODES.DELIVERY_REJECTED, `Unsupported delivery mode "${String(request.mode)}"`);
		if (!Number.isInteger(request.bindingGeneration)) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, "admit requires a bindingGeneration");
		return this.mutate((records) => {
			const existing = findByIdempotencyKey(records, idempotencyKey);
			if (existing !== void 0) return {
				record: clone(existing),
				duplicate: true
			};
			const record = {
				commandId: randomUUID(),
				idempotencyKey,
				causationId: text(request.causationId),
				sessionId,
				bindingGeneration: request.bindingGeneration,
				mode: request.mode,
				reason: text(request.reason) ?? "unspecified",
				content: clone(request.content ?? []),
				requestId: `${this.teamId}:${idempotencyKey}`,
				state: "pending",
				receipt: void 0,
				failureCode: void 0,
				failureDetail: void 0,
				revision: 1
			};
			records.push(record);
			return {
				record: clone(record),
				duplicate: false
			};
		});
	}
	async dispatch(commandId) {
		const reserved = await this.transition(commandId, (record) => {
			if (DELIVERED_STATES.has(record.state)) return {
				next: record,
				stop: true
			};
			record.state = "leased";
			record.revision += 1;
			return {
				next: record,
				stop: false,
				call: true
			};
		});
		if (reserved.call !== true) return reserved.record;
		let outcome;
		try {
			const current = typeof this.bindingGenerationOf === "function" ? await this.bindingGenerationOf(reserved.record.sessionId) : reserved.record.bindingGeneration;
			if (current !== void 0 && current !== reserved.record.bindingGeneration) throw new LiveTeamsError(ERROR_CODES.BINDING_STALE, BINDING_STALE_MESSAGE, { auditDetail: `admitted for generation ${reserved.record.bindingGeneration}, current ${current}` });
			await this.deliver(clone(reserved.record));
			outcome = {
				state: "admitted",
				receipt: "accepted"
			};
		} catch (error) {
			const domain = error instanceof LiveTeamsError ? error : new LiveTeamsError(ERROR_CODES.DELIVERY_REJECTED, error instanceof Error ? error.message : String(error), { cause: error });
			outcome = {
				state: "failed",
				failureCode: domain.code,
				failureDetail: domain.auditDetail ?? domain.message
			};
		}
		return (await this.transition(commandId, (record) => {
			record.state = outcome.state;
			record.receipt = outcome.receipt;
			record.failureCode = outcome.failureCode;
			record.failureDetail = outcome.failureDetail;
			record.revision += 1;
			return {
				next: record,
				stop: true
			};
		})).record;
	}
	async retry(commandId) {
		const prepared = await this.transition(commandId, (record) => {
			record.state = "pending";
			record.receipt = void 0;
			record.failureCode = void 0;
			record.failureDetail = void 0;
			record.revision += 1;
			return {
				next: record,
				stop: true
			};
		});
		const before = (await this.read()).length;
		const dispatched = await this.dispatch(prepared.record.commandId);
		if (before !== (await this.read()).length) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, "retry changed the number of durable commands");
		return dispatched;
	}
	async get(commandId) {
		const record = (await this.read()).find((entry) => entry.commandId === commandId);
		return record === void 0 ? void 0 : clone(record);
	}
	async transition(commandId, change) {
		return this.mutate((records) => {
			const index = records.findIndex((entry) => entry.commandId === commandId);
			if (index < 0) throw new LiveTeamsError(ERROR_CODES.DELIVERY_REJECTED, `unknown command "${commandId}"`);
			const outcome = change(records[index]);
			records[index] = outcome.next;
			return {
				record: clone(outcome.next),
				call: outcome.call === true
			};
		});
	}
	async mutate(change) {
		return withProcessLock(this.file, async () => {
			const records = await this.read();
			const result = change(records);
			await atomicWriteJson(this.file, {
				schemaVersion: 1,
				teamId: this.teamId,
				commands: records
			});
			return result;
		});
	}
	async read() {
		if (!await fileExists(this.file)) return [];
		let parsed;
		try {
			parsed = await readJson(this.file);
		} catch (error) {
			throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, "command state is not readable JSON", {
				cause: error,
				auditDetail: `failed to read ${this.file}`
			});
		}
		const commands = parsed !== null && typeof parsed === "object" ? parsed.commands : void 0;
		if (!Array.isArray(commands)) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, "command state has no command list", { auditDetail: `invalid shape in ${this.file}` });
		return commands;
	}
};
function createCommandQueue(options) {
	return new SessionCommandQueue(options);
}
export { SessionCommandQueue, createCommandQueue };
