import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { atomicWriteJson, clone, fileExists, readJson, withProcessLock } from "./storage.js";
import { ERROR_CODES, LiveTeamsError } from "./errors.js";
// src/mailbox.ts
/**
* The one delivery failure the dispatcher may retry on its own: the recipient had
* no usable binding yet. Every other failure is terminal and stays visible —
* the reconciler never resurrects a delivery for a reason it cannot name.
*/
const NO_SESSION_FAILURE = "recipient has no current session binding";
function recipientLabel(recipient) {
	return recipient.displayName?.trim() || recipient.memberId;
}
/** Resolve the one addressing vocabulary shared by member and human sends. */
function resolveMailboxRecipient(value, recipients) {
	const requested = value.trim();
	const exact = recipients.find((candidate) => candidate.memberId === requested);
	if (exact !== void 0) return {
		recipient: exact.memberId,
		name: recipientLabel(exact)
	};
	if (requested === "team") return {
		recipient: "team",
		name: "team"
	};
	if (requested === "human") return {
		recipient: "human",
		name: "human"
	};
	const matching = recipients.filter((candidate) => candidate.displayName?.trim().toLocaleLowerCase() === requested.toLocaleLowerCase());
	if (matching.length === 1) {
		const candidate = matching[0];
		if (candidate === void 0) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, "recipient resolution state disappeared");
		return {
			recipient: candidate.memberId,
			name: recipientLabel(candidate)
		};
	}
	if (matching.length > 1) {
		const candidates = matching.map((candidate) => `${candidate.memberId} (${recipientLabel(candidate)})`);
		throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `ambiguous recipient "${requested}"; candidates: ${candidates.join(", ")}`, { details: { candidates } });
	}
	const existing = recipients.map((candidate) => `${candidate.memberId} (${recipientLabel(candidate)})`);
	throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `unknown recipient "${requested}"; existing recipients: ${existing.length > 0 ? existing.join(", ") : "none"}`, { details: { recipients: existing } });
}
const SCHEMA_VERSION = 1;
const DEFAULT_LEASE_MS = 3e4;
const MESSAGE_KEYS = /* @__PURE__ */ new Set([
	"id",
	"teamId",
	"from",
	"to",
	"kind",
	"content",
	"threadId",
	"createdAt"
]);
const DELIVERY_KEYS = /* @__PURE__ */ new Set([
	"id",
	"messageId",
	"recipient",
	"wakePolicy",
	"ackPolicy",
	"state",
	"claimedAt",
	"deliveredAt",
	"acknowledgedAt",
	"failure",
	"revision"
]);
const MESSAGE_WRAPPER_KEYS = /* @__PURE__ */ new Set([
	"schemaVersion",
	"teamId",
	"messages"
]);
const DELIVERY_WRAPPER_KEYS = /* @__PURE__ */ new Set([
	"schemaVersion",
	"teamId",
	"deliveries"
]);
function record(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function text(value) {
	return typeof value === "string" && value.length > 0 ? value : void 0;
}
function nonNegativeInteger(value) {
	return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
function positiveInteger(value) {
	return typeof value === "number" && Number.isInteger(value) && value > 0;
}
function keysAllowed(value, keys) {
	return Object.keys(value).every((key) => keys.has(key));
}
function isMessageKind(value) {
	return value === "message" || value === "direction" || value === "comment";
}
function isWakePolicy(value) {
	return value === "never" || value === "queue" || value === "steer";
}
function isAckPolicy(value) {
	return value === "delivery" || value === "consumption" || value === "formal";
}
function isDeliveryState(value) {
	return value === "stored" || value === "leased" || value === "delivered" || value === "acknowledged" || value === "failed";
}
function cloneMessage(value) {
	return clone(value);
}
function cloneDelivery(value) {
	return clone(value);
}
function messagePolicy(kind, recipient) {
	if (recipient === "human") return {
		wakePolicy: "never",
		ackPolicy: "consumption"
	};
	if (kind === "comment") return {
		wakePolicy: "never",
		ackPolicy: "consumption"
	};
	if (kind === "direction") return {
		wakePolicy: "steer",
		ackPolicy: "delivery"
	};
	return {
		wakePolicy: "queue",
		ackPolicy: "delivery"
	};
}
/** Derive the externally reported outcome from a final delivery state and policy. */
function messageDeliveryOutcome(delivery) {
	if (delivery.state === "failed") return "failed";
	if (delivery.state === "delivered" || delivery.state === "acknowledged") return "delivered";
	if (delivery.state === "stored" && delivery.wakePolicy === "never") return "inbox";
	return "pending";
}
function checkedMessage(value, teamId) {
	const candidate = record(value);
	if (candidate === void 0 || !keysAllowed(candidate, MESSAGE_KEYS) || text(candidate.id) === void 0 || candidate.teamId !== teamId || candidate.from !== "human" && candidate.from !== "scheduler" && text(candidate.from) === void 0 || candidate.to !== "human" && candidate.to !== "team" && text(candidate.to) === void 0 || !isMessageKind(candidate.kind) || typeof candidate.content !== "string" || !nonNegativeInteger(candidate.createdAt) || candidate.threadId !== void 0 && text(candidate.threadId) === void 0) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, "invalid mailbox message state", { auditDetail: `invalid message in team ${teamId}` });
	return clone(candidate);
}
function checkedDelivery(value, teamId) {
	const candidate = record(value);
	if (candidate === void 0 || !keysAllowed(candidate, DELIVERY_KEYS) || text(candidate.id) === void 0 || text(candidate.messageId) === void 0 || typeof candidate.recipient !== "string" || candidate.recipient.length === 0 || !isWakePolicy(candidate.wakePolicy) || !isAckPolicy(candidate.ackPolicy) || !isDeliveryState(candidate.state) || !positiveInteger(candidate.revision) || candidate.claimedAt !== void 0 && !nonNegativeInteger(candidate.claimedAt) || candidate.deliveredAt !== void 0 && !nonNegativeInteger(candidate.deliveredAt) || candidate.acknowledgedAt !== void 0 && !nonNegativeInteger(candidate.acknowledgedAt) || candidate.failure !== void 0 && text(candidate.failure) === void 0) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, "invalid mailbox delivery state", { auditDetail: `invalid delivery in team ${teamId}` });
	if (candidate.state === "failed" && candidate.failure === void 0) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, "failed delivery has no reason");
	if (candidate.state === "acknowledged" && candidate.acknowledgedAt === void 0) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, "acknowledged delivery has no timestamp");
	if (candidate.state === "delivered" && candidate.deliveredAt === void 0) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, "delivered delivery has no timestamp");
	if (candidate.state === "stored" && (candidate.claimedAt !== void 0 || candidate.deliveredAt !== void 0 || candidate.acknowledgedAt !== void 0 || candidate.failure !== void 0)) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, "stored delivery has transition fields");
	if (candidate.state === "leased" && candidate.claimedAt === void 0) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, "leased delivery has no claim timestamp");
	return clone(candidate);
}
function checkedArray(value, key, teamId) {
	const wrapper = record(value);
	if (wrapper === void 0 || !keysAllowed(wrapper, key === "messages" ? MESSAGE_WRAPPER_KEYS : DELIVERY_WRAPPER_KEYS) || wrapper.schemaVersion !== SCHEMA_VERSION || wrapper.teamId !== teamId || !Array.isArray(wrapper[key])) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, `invalid mailbox ${key} state`, { auditDetail: `invalid ${key}.json in team ${teamId}` });
	return key === "messages" ? wrapper.messages.map((entry) => checkedMessage(entry, teamId)) : wrapper.deliveries.map((entry) => checkedDelivery(entry, teamId));
}
function requestDraft(value) {
	const candidate = record(value);
	if (candidate === void 0 || Object.keys(candidate).some((key) => !(/* @__PURE__ */ new Set([
		"to",
		"kind",
		"content",
		"threadId"
	])).has(key)) || typeof candidate.to !== "string" || candidate.to.length === 0 || !isMessageKind(candidate.kind) || typeof candidate.content !== "string" || candidate.threadId !== void 0 && text(candidate.threadId) === void 0 || candidate.from !== void 0) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, "invalid mailbox message request");
	return {
		to: candidate.to,
		kind: candidate.kind,
		content: candidate.content,
		...candidate.threadId === void 0 ? {} : { threadId: candidate.threadId }
	};
}
function senderActor(value) {
	const candidate = record(value);
	if (candidate?.type === "human") return { type: "human" };
	if (candidate?.type === "scheduler") return { type: "scheduler" };
	if (candidate?.type === "session" && text(candidate.sessionId) !== void 0) return {
		type: "session",
		sessionId: candidate.sessionId
	};
	throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, "mailbox sender identity is required");
}
var MailboxService = class {
	workspacePath;
	teamId;
	queue;
	listRecipients;
	authorize;
	resolveSessionSender;
	canDeliver;
	appendAudit;
	now;
	leaseMs;
	autoDeliver;
	directory;
	messagesFile;
	deliveriesFile;
	lockFile;
	constructor(options) {
		if (text(options?.workspacePath) === void 0 || text(options?.teamId) === void 0) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, "mailbox requires workspacePath and teamId");
		if (!options.queue || typeof options.queue.admit !== "function" || typeof options.queue.dispatch !== "function") throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, "mailbox requires the existing command queue");
		if (typeof options.listRecipients !== "function") throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, "mailbox requires a recipient resolver");
		this.workspacePath = path.resolve(options.workspacePath);
		this.teamId = options.teamId;
		this.queue = options.queue;
		this.listRecipients = options.listRecipients;
		this.canDeliver = options.canDeliver;
		this.authorize = options.authorize;
		this.resolveSessionSender = options.resolveSessionSender;
		this.appendAudit = options.appendAudit;
		this.now = options.now ?? Date.now;
		this.leaseMs = options.leaseMs ?? DEFAULT_LEASE_MS;
		if (!positiveInteger(this.leaseMs)) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, "mailbox leaseMs must be positive");
		this.autoDeliver = options.autoDeliver ?? true;
		this.directory = path.join(this.workspacePath, ".dsh-live-teams", "teams", this.teamId);
		this.messagesFile = path.join(this.directory, "messages.json");
		this.deliveriesFile = path.join(this.directory, "deliveries.json");
		this.lockFile = path.join(this.directory, ".mailbox.lock");
	}
	async listMessages() {
		return (await this.snapshot()).messages.map(cloneMessage);
	}
	async listDeliveries() {
		return (await this.snapshot()).deliveries.map(cloneDelivery);
	}
	async getMessage(messageId) {
		return (await this.listMessages()).find((message) => message.id === messageId);
	}
	async getDelivery(deliveryId) {
		return (await this.listDeliveries()).find((delivery) => delivery.id === deliveryId);
	}
	async deliveriesFor(messageId) {
		return (await this.listDeliveries()).filter((delivery) => delivery.messageId === messageId);
	}
	/**
	* Internal send path.
	*
	* Deliberately private: an actor argument that any caller may supply would let
	* a member send as `human` or as another member, which ADR 0004 forbids. The
	* public entries derive the sender instead — from the calling Session binding
	* for member traffic, and from the host itself for human and scheduler paths.
	*/
	async send(draftValue, actorValue, once = false) {
		const draft = requestDraft(draftValue);
		const actor = senderActor(actorValue);
		const from = await this.resolveFrom(actor);
		const result = await withProcessLock(this.lockFile, async () => {
			const snapshot = await this.readSnapshot();
			const availableRecipients = await this.listRecipients();
			const resolved = resolveMailboxRecipient(draft.to, availableRecipients);
			const recipients = resolved.recipient === "team" ? availableRecipients.filter((recipient) => recipient.active !== false && (actor.type !== "session" || recipient.memberId !== from)) : [];
			if (this.authorize !== void 0) await this.authorize({
				from,
				to: resolved.recipient
			});
			if (resolved.recipient === "team" && recipients.length === 0) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, "team broadcast has no other active recipients");
			if (once) {
				const existing = snapshot.messages.find((message) => message.from === "scheduler" && message.threadId === draft.threadId);
				if (existing !== void 0) {
					if (existing.to !== resolved.recipient || existing.kind !== draft.kind || existing.content !== draft.content) throw new LiveTeamsError(ERROR_CODES.DELIVERY_REJECTED, "scheduler notification identity reused with different content");
					return {
						message: cloneMessage(existing),
						deliveries: snapshot.deliveries.filter((delivery) => delivery.messageId === existing.id).map(cloneDelivery)
					};
				}
			}
			const message = {
				id: randomUUID(),
				teamId: this.teamId,
				from,
				to: resolved.recipient,
				kind: draft.kind,
				content: draft.content,
				...draft.threadId === void 0 ? {} : { threadId: draft.threadId },
				createdAt: this.now()
			};
			const recipientIds = resolved.recipient === "team" ? recipients.map((recipient) => recipient.memberId) : [resolved.recipient];
			if (recipientIds.some((recipient) => typeof recipient !== "string" || recipient.length === 0)) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, "mailbox recipient is invalid");
			const deliveries = recipientIds.map((recipient) => {
				const policy = messagePolicy(draft.kind, recipient);
				return {
					id: randomUUID(),
					messageId: message.id,
					recipient,
					...policy,
					state: "stored",
					revision: 1
				};
			});
			await this.persist({
				messages: [...snapshot.messages, message],
				deliveries: [...snapshot.deliveries, ...deliveries]
			});
			await this.audit({
				kind: "message/sent",
				teamId: this.teamId,
				messageId: message.id,
				from: message.from,
				actor: message.from,
				to: message.to,
				messageKind: message.kind,
				at: this.now()
			});
			return {
				message: cloneMessage(message),
				deliveries: deliveries.map(cloneDelivery)
			};
		});
		if (!this.autoDeliver) return result;
		const delivered = [];
		for (const delivery of result.deliveries) if (once && (delivery.state === "failed" || delivery.state === "leased" && delivery.claimedAt !== void 0 && delivery.claimedAt + this.leaseMs > this.now())) delivered.push(delivery);
		else delivered.push(await this.deliver(delivery.id));
		return {
			message: result.message,
			deliveries: delivered
		};
	}
	async sendFromSession(sessionId, draft) {
		return this.send(draft, {
			type: "session",
			sessionId
		});
	}
	async sendFromHuman(draft) {
		return this.send(draft, { type: "human" });
	}
	async sendFromScheduler(draft) {
		return this.send(draft, { type: "scheduler" });
	}
	/** Internal outbox identity uses the existing immutable thread field; no mailbox schema change. */
	async sendFromSchedulerOnce(draft) {
		if (text(draft.threadId) === void 0) throw new LiveTeamsError(ERROR_CODES.DELIVERY_REJECTED, "scheduler-once requires a stable thread identity");
		return withProcessLock(`${this.lockFile}:scheduler-once:${draft.threadId}`, () => this.send(draft, { type: "scheduler" }, true));
	}
	async claimDelivery(deliveryId) {
		let leased;
		await withProcessLock(this.lockFile, async () => {
			const snapshot = await this.readSnapshot();
			const index = snapshot.deliveries.findIndex((delivery) => delivery.id === deliveryId);
			if (index < 0) throw new LiveTeamsError(ERROR_CODES.DELIVERY_REJECTED, `unknown mailbox delivery "${deliveryId}"`);
			const current = snapshot.deliveries[index];
			if (current === void 0) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, "mailbox delivery disappeared");
			if (current.state === "delivered" || current.state === "acknowledged") {
				leased = cloneDelivery(current);
				return;
			}
			if (current.state === "leased" && current.claimedAt !== void 0 && current.claimedAt + this.leaseMs > this.now()) return;
			if (current.state === "failed") return;
			const next = {
				...current,
				state: "leased",
				claimedAt: this.now(),
				revision: current.revision + 1
			};
			delete next.failure;
			delete next.deliveredAt;
			delete next.acknowledgedAt;
			snapshot.deliveries[index] = next;
			await this.persist(snapshot);
			await this.audit({
				kind: "delivery/leased",
				teamId: this.teamId,
				deliveryId: next.id,
				messageId: next.messageId,
				recipient: next.recipient,
				at: this.now(),
				revision: next.revision
			});
			leased = cloneDelivery(next);
		});
		return leased;
	}
	async deliver(deliveryId) {
		const existing = await this.getDelivery(deliveryId);
		if (existing === void 0) throw new LiveTeamsError(ERROR_CODES.DELIVERY_REJECTED, `unknown mailbox delivery "${deliveryId}"`);
		if (existing.state === "delivered" || existing.state === "acknowledged") return existing;
		if (existing.recipient === "human" || existing.wakePolicy === "never") return existing;
		const claimed = await this.claimDelivery(deliveryId);
		if (claimed === void 0) {
			const current = await this.getDelivery(deliveryId);
			if (current === void 0) throw new LiveTeamsError(ERROR_CODES.DELIVERY_REJECTED, `unknown mailbox delivery "${deliveryId}"`);
			if (current.state === "leased") return current;
			if (current.state === "failed") throw new LiveTeamsError(ERROR_CODES.DELIVERY_REJECTED, current.failure ?? "mailbox delivery failed");
			return current;
		}
		if (claimed.state === "delivered" || claimed.state === "acknowledged") return claimed;
		const message = await this.getMessage(claimed.messageId);
		if (message === void 0) return this.fail(claimed.id, "mailbox message is missing");
		if (claimed.recipient === "human" || claimed.wakePolicy === "never") return claimed;
		const recipient = (await this.listRecipients()).find((entry) => entry.memberId === claimed.recipient && entry.active !== false);
		if (recipient === void 0 || recipient.sessionId === void 0 || recipient.bindingGeneration === void 0) return this.fail(claimed.id, NO_SESSION_FAILURE);
		try {
			if (this.canDeliver !== void 0 && !await this.canDeliver(message, recipient)) return this.fail(claimed.id, "automatic review return capability is no longer current");
			const senderName = message.from === "human" || message.from === "scheduler" ? void 0 : (await this.listRecipients()).find((entry) => entry.memberId === message.from)?.displayName;
			const first = await this.attemptDelivery(message, claimed, recipient, claimed.wakePolicy, senderName);
			if (first.kind === "delivered") return this.markDelivered(claimed.id);
			if (claimed.wakePolicy !== "steer") return this.fail(claimed.id, first.reason);
			await this.audit({
				kind: "delivery/steer-fallback",
				teamId: this.teamId,
				deliveryId: claimed.id,
				messageId: message.id,
				reason: first.reason,
				at: this.now()
			});
			const second = await this.attemptDelivery(message, claimed, recipient, "queue", senderName);
			if (second.kind === "delivered") return this.markDelivered(claimed.id);
			return this.fail(claimed.id, second.reason);
		} catch (error) {
			return this.fail(claimed.id, error instanceof LiveTeamsError ? error.auditDetail ?? error.message : error instanceof Error ? error.message : String(error));
		}
	}
	/**
	* One transport attempt in one mode.
	*
	* The idempotency key carries the mode, because the key is bound to the first
	* command admitted under it: reusing one key for a queue retry after a steer
	* attempt would return the steer command and change nothing. The mode is part
	* of what makes this attempt distinct, and `(messageId, recipient)` still
	* identifies the delivery itself.
	*/
	async attemptDelivery(message, claimed, recipient, mode, senderName) {
		try {
			const admission = await this.admitOnce(message, claimed, recipient, mode, senderName);
			const command = await this.queue.dispatch(admission.record.commandId);
			if (command.state === "admitted" || command.state === "applied") return { kind: "delivered" };
			return {
				kind: "refused",
				reason: command.failureDetail ?? command.failureCode ?? "command queue did not admit delivery"
			};
		} catch (error) {
			return {
				kind: "refused",
				reason: error instanceof LiveTeamsError ? error.auditDetail ?? error.message : error instanceof Error ? error.message : String(error)
			};
		}
	}
	async admitOnce(message, claimed, recipient, mode, senderName) {
		const attributed = message.from === "human" ? `Human instruction (${message.kind}): ${message.content}` : message.from === "scheduler" ? `Scheduler notification (${message.kind}): ${message.content}` : `Peer message from ${senderName ?? message.from} (${message.kind}): ${message.content}`;
		return this.queue.admit({
			idempotencyKey: `${message.id}:${claimed.recipient}:${mode}`,
			sessionId: recipient.sessionId,
			bindingGeneration: recipient.bindingGeneration,
			mode,
			reason: `mailbox ${message.kind}`,
			causationId: message.id,
			content: [{
				type: "text",
				text: attributed
			}]
		});
	}
	async retryExpiredLeases() {
		const candidates = (await this.snapshot()).deliveries.filter((delivery) => delivery.state === "leased" && delivery.claimedAt !== void 0 && delivery.claimedAt + this.leaseMs <= this.now());
		const results = [];
		for (const candidate of candidates) try {
			results.push(await this.deliver(candidate.id));
		} catch {}
		return results;
	}
	async retryDelivery(deliveryId) {
		await withProcessLock(this.lockFile, async () => {
			const snapshot = await this.readSnapshot();
			const index = snapshot.deliveries.findIndex((delivery) => delivery.id === deliveryId);
			if (index < 0) throw new LiveTeamsError(ERROR_CODES.DELIVERY_REJECTED, `unknown mailbox delivery "${deliveryId}"`);
			const current = snapshot.deliveries[index];
			if (current === void 0) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, "mailbox delivery disappeared");
			if (current.state === "delivered" || current.state === "acknowledged") return;
			if (current.state === "leased" && current.claimedAt !== void 0 && current.claimedAt + this.leaseMs > this.now()) return;
			if (current.ackPolicy !== "delivery" && current.ackPolicy !== "formal" && current.ackPolicy !== "consumption") throw new LiveTeamsError(ERROR_CODES.DELIVERY_REJECTED, "mailbox acknowledgement policy cannot be retried");
			const next = {
				...current,
				state: "stored",
				revision: current.revision + 1
			};
			delete next.claimedAt;
			delete next.deliveredAt;
			delete next.acknowledgedAt;
			delete next.failure;
			snapshot.deliveries[index] = next;
			await this.persist(snapshot);
		});
		return this.deliver(deliveryId);
	}
	async acknowledge(messageId, recipient, _formal = false) {
		if (text(messageId) === void 0 || text(recipient) === void 0) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, "acknowledgement requires messageId and recipient");
		let result;
		await withProcessLock(this.lockFile, async () => {
			const snapshot = await this.readSnapshot();
			const index = snapshot.deliveries.findIndex((delivery) => delivery.messageId === messageId && delivery.recipient === recipient);
			if (index < 0) throw new LiveTeamsError(ERROR_CODES.DELIVERY_REJECTED, "unknown mailbox delivery");
			const current = snapshot.deliveries[index];
			if (current === void 0) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, "mailbox delivery disappeared");
			if (current.state === "acknowledged" || current.ackPolicy === "delivery" && current.state === "delivered") {
				result = {
					delivery: cloneDelivery(current),
					duplicate: true
				};
				return;
			}
			if (current.state !== "stored" && current.state !== "delivered") throw new LiveTeamsError(ERROR_CODES.DELIVERY_REJECTED, "mailbox delivery is not acknowledgeable");
			if (current.ackPolicy === "delivery") {
				result = {
					delivery: cloneDelivery(current),
					duplicate: true
				};
				return;
			}
			const next = {
				...current,
				state: "acknowledged",
				acknowledgedAt: this.now(),
				revision: current.revision + 1
			};
			snapshot.deliveries[index] = next;
			await this.persist(snapshot);
			await this.audit({
				kind: "delivery/acknowledged",
				teamId: this.teamId,
				deliveryId: next.id,
				messageId: next.messageId,
				recipient: next.recipient,
				actor: next.recipient,
				at: this.now(),
				revision: next.revision
			});
			result = {
				delivery: cloneDelivery(next),
				duplicate: false
			};
		});
		if (result === void 0) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, "acknowledgement produced no result");
		return result;
	}
	async resolveFrom(actor) {
		if (actor.type === "human" || actor.type === "scheduler") return actor.type;
		if (this.resolveSessionSender === void 0) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, "session sender resolver is unavailable");
		const memberId = await this.resolveSessionSender(actor.sessionId);
		if (memberId === void 0 || memberId.length === 0) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, "calling session is not bound to an active team member");
		return memberId;
	}
	/**
	* A message persisted without its delivery rows is a message nobody will ever see: the snapshot is
	* two files, and a process that dies between them leaves exactly that. The reconciler calls this,
	* and the orphan becomes a visible failed delivery instead of silence (external review, mailbox
	* atomicity).
	*/
	async healOrphanMessages() {
		let healed = [];
		await withProcessLock(this.lockFile, async () => {
			const snapshot = await this.readSnapshot();
			const withDeliveries = new Set(snapshot.deliveries.map((delivery) => delivery.messageId));
			const orphans = snapshot.messages.filter((message) => !withDeliveries.has(message.id));
			if (orphans.length === 0) return;
			const rows = orphans.map((message) => ({
				id: `delivery-${randomUUID()}`,
				messageId: message.id,
				recipient: message.to,
				wakePolicy: "never",
				ackPolicy: "delivery",
				state: "failed",
				failure: "the message was stored without a delivery row: the process stopped between the two writes",
				revision: snapshot.deliveries.length + 1
			}));
			const next = {
				...snapshot,
				deliveries: [...snapshot.deliveries, ...rows]
			};
			await atomicWriteJson(this.deliveriesFile, next);
			for (const row of rows) await this.audit({
				kind: "delivery/failed",
				teamId: this.teamId,
				deliveryId: row.id,
				messageId: row.messageId,
				recipient: row.recipient,
				reason: row.failure ?? "orphan message",
				at: this.now(),
				revision: row.revision
			});
			healed = rows.map((row) => ({
				messageId: row.messageId,
				recipient: row.recipient
			}));
		});
		return healed;
	}
	async markDelivered(deliveryId) {
		let result;
		await withProcessLock(this.lockFile, async () => {
			const snapshot = await this.readSnapshot();
			const index = snapshot.deliveries.findIndex((delivery) => delivery.id === deliveryId);
			if (index < 0) throw new LiveTeamsError(ERROR_CODES.DELIVERY_REJECTED, "unknown mailbox delivery");
			const current = snapshot.deliveries[index];
			if (current === void 0) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, "mailbox delivery disappeared");
			if (current.state === "delivered" || current.state === "acknowledged") {
				result = cloneDelivery(current);
				return;
			}
			if (current.state !== "leased") throw new LiveTeamsError(ERROR_CODES.DELIVERY_REJECTED, "mailbox delivery lease is not held");
			const next = {
				...current,
				state: "delivered",
				deliveredAt: this.now(),
				revision: current.revision + 1
			};
			delete next.failure;
			snapshot.deliveries[index] = next;
			await this.persist(snapshot);
			await this.audit({
				kind: "delivery/delivered",
				teamId: this.teamId,
				deliveryId: next.id,
				messageId: next.messageId,
				recipient: next.recipient,
				at: this.now(),
				revision: next.revision
			});
			result = cloneDelivery(next);
		});
		if (result === void 0) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, "delivery transition produced no result");
		return result;
	}
	async fail(deliveryId, reason) {
		const failure = text(reason) ?? "delivery failed";
		let result;
		await withProcessLock(this.lockFile, async () => {
			const snapshot = await this.readSnapshot();
			const index = snapshot.deliveries.findIndex((delivery) => delivery.id === deliveryId);
			if (index < 0) throw new LiveTeamsError(ERROR_CODES.DELIVERY_REJECTED, "unknown mailbox delivery");
			const current = snapshot.deliveries[index];
			if (current === void 0) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, "mailbox delivery disappeared");
			if (current.state === "delivered" || current.state === "acknowledged") {
				result = cloneDelivery(current);
				return;
			}
			const next = {
				...current,
				state: "failed",
				failure,
				revision: current.revision + 1
			};
			snapshot.deliveries[index] = next;
			await this.persist(snapshot);
			await this.audit({
				kind: "delivery/failed",
				teamId: this.teamId,
				deliveryId: next.id,
				messageId: next.messageId,
				recipient: next.recipient,
				reason: failure,
				at: this.now(),
				revision: next.revision
			});
			result = cloneDelivery(next);
		});
		if (result === void 0) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, "failure transition produced no result");
		return result;
	}
	async snapshot() {
		return withProcessLock(this.lockFile, () => this.readSnapshot());
	}
	/**
	* Comments this member has not acknowledged, read synchronously.
	*
	* The membership context is assembled synchronously, and a comment is stored with
	* `wakePolicy: never` — nothing wakes the Session for it. Without a sync reader the recipient only
	* ever learns about a comment if it happens to ask (external review, finding 13).
	*/
	unreadCommentsForSync(memberId) {
		try {
			if (!existsSync(this.messagesFile) || !existsSync(this.deliveriesFile)) return [];
			const messages = JSON.parse(readFileSync(this.messagesFile, "utf8"));
			const deliveries = JSON.parse(readFileSync(this.deliveriesFile, "utf8"));
			const unread = new Set((deliveries.deliveries ?? []).filter((delivery) => delivery.recipient === memberId && delivery.state !== "acknowledged" && delivery.state !== "failed").map((delivery) => delivery.messageId));
			return (messages.messages ?? []).filter((message) => message.kind === "comment" && message.to === memberId && unread.has(message.id)).sort((left, right) => left.createdAt - right.createdAt).slice(-3).map((message) => ({
				from: message.from,
				content: message.content,
				at: message.createdAt
			}));
		} catch {
			return [];
		}
	}
	async readSnapshot() {
		if (await fileExists(this.messagesFile) !== await fileExists(this.deliveriesFile)) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, "mailbox state is torn: only one of the two files exists");
		const messages = await this.readMessages();
		const deliveries = await this.readDeliveries();
		const ids = new Set(messages.map((message) => message.id));
		if (ids.size !== messages.length) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, "mailbox contains duplicate message ids");
		if (new Set(deliveries.map((delivery) => delivery.id)).size !== deliveries.length) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, "mailbox contains duplicate delivery ids");
		if (new Set(deliveries.map((delivery) => `${delivery.messageId}:${delivery.recipient}`)).size !== deliveries.length) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, "mailbox repeats a message for one recipient");
		if (deliveries.some((delivery) => !ids.has(delivery.messageId))) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, "mailbox delivery references a missing message");
		return {
			messages,
			deliveries
		};
	}
	async readMessages() {
		if (!await fileExists(this.messagesFile)) return [];
		let parsed;
		try {
			parsed = await readJson(this.messagesFile);
		} catch (error) {
			throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, "mailbox messages state is not readable JSON", { cause: error });
		}
		return checkedArray(parsed, "messages", this.teamId);
	}
	async readDeliveries() {
		if (!await fileExists(this.deliveriesFile)) return [];
		let parsed;
		try {
			parsed = await readJson(this.deliveriesFile);
		} catch (error) {
			throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, "mailbox deliveries state is not readable JSON", { cause: error });
		}
		return checkedArray(parsed, "deliveries", this.teamId);
	}
	async persist(snapshot) {
		await atomicWriteJson(this.messagesFile, {
			schemaVersion: SCHEMA_VERSION,
			teamId: this.teamId,
			messages: snapshot.messages
		});
		await atomicWriteJson(this.deliveriesFile, {
			schemaVersion: SCHEMA_VERSION,
			teamId: this.teamId,
			deliveries: snapshot.deliveries
		});
	}
	async audit(event) {
		if (this.appendAudit !== void 0) await this.appendAudit(event);
	}
};
function createMailbox(options) {
	return new MailboxService(options);
}
export { MailboxService, NO_SESSION_FAILURE, createMailbox, messageDeliveryOutcome, messagePolicy, resolveMailboxRecipient };
