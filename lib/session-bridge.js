import { LiveTeamsError, translatePlatformError } from "./errors.js";
// src/session-bridge.ts
function selectionValue(value) {
	const source = record(value);
	const provider = text(source.provider);
	const model = text(source.model);
	if (provider === void 0 || model === void 0) return void 0;
	const reasoningEffort = text(source.reasoningEffort);
	return {
		provider,
		model,
		...reasoningEffort === void 0 ? {} : { reasoningEffort }
	};
}
/**
* The selection this Session would use next.
*
* A pending `model/selection` wins over the last request: it is the choice the next turn will send.
* Otherwise the newest `request/header` says what the last turn actually used, with one subtlety
* copied from DSH's own fold — when the adapter defaulted the effort, `adapterDefaults.reasoningEffort`
* is true and the effort in the config is not a human choice, so it is left out instead of being
* frozen into an explicit value the human never picked.
*/
function modelSelectionOf(events) {
	let fromHeader;
	for (let index = events.length - 1; index >= 0; index -= 1) {
		const event = record(events[index]);
		if (event.type === "model/selection") {
			const selected = selectionValue(event.data);
			if (selected !== void 0) return selected;
			continue;
		}
		if (fromHeader !== void 0 || event.type !== "request/header") continue;
		const header = record(record(event.data).header);
		const config = record(header.config);
		const effortDefaulted = record(header.adapterDefaults).reasoningEffort === true;
		fromHeader = selectionValue({
			...config,
			...effortDefaulted ? { reasoningEffort: void 0 } : {}
		});
	}
	return fromHeader;
}
function record(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function text(value) {
	return typeof value === "string" && value.length > 0 ? value : void 0;
}
function amount(value) {
	return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
/**
* The prompt size of a Session's latest turn, read from the Session's own usage record.
*
* `totalTokens` on an `assistant/message` is the size of the context that call sent — input, plus
* cached input, plus output — not a per-turn delta, so the newest one is the current window. Rotation
* reads it as "how much would the next turn re-send". Older hosts and some routes record no usage at
* all; `undefined` then means unmeasured, and no size limit is applied rather than a guessed one.
*/
function contextTokensOf(events) {
	for (let index = events.length - 1; index >= 0; index -= 1) {
		const event = record(events[index]);
		if (event.type !== "assistant/message") continue;
		const data = record(event.data);
		const usage = record(data.usage ?? record(data.message).usage);
		const total = amount(usage.totalTokens);
		if (total !== void 0 && total > 0) return total;
		const input = amount(usage.inputTokens);
		const cached = amount(usage.cacheReadTokens);
		const output = amount(usage.outputTokens);
		if (input !== void 0 && cached !== void 0 && output !== void 0) return input + cached + output;
	}
}
function isSubagentHeader(header) {
	const value = record(header);
	return value.origin === "subagent" || text(value.parentSession) !== void 0;
}
function isMissingSession(error) {
	const value = record(error);
	if (value.code === "session/not-found") return true;
	if (typeof value.code === "string" && value.code.length > 0) return false;
	return /not found/i.test(String(value.message ?? ""));
}
function isSubagentOwnership(error) {
	const value = record(error);
	if (value.code !== "session/agent-busy") return false;
	const details = record(value.details);
	return /subagent/i.test(String(details.reason ?? value.message ?? ""));
}
function toBridgeError(error) {
	if (error instanceof LiveTeamsError) return error;
	const translated = translatePlatformError(error);
	if (!isSubagentOwnership(error)) return translated;
	return new LiveTeamsError("CAPABILITY_UNAVAILABLE", "Session is owned by subagent routing and cannot be a team member", translated.auditDetail === void 0 ? { cause: error } : {
		cause: error,
		auditDetail: translated.auditDetail
	});
}
function descriptorOf(inspection, liveAgent) {
	const liveSession = record(record(liveAgent).session);
	const meta = record(inspection.meta ?? inspection.header ?? liveSession.header);
	const ownerHeader = record(record(liveAgent).session).header ?? meta;
	const events = Array.isArray(inspection.events) ? inspection.events : [];
	let title = text(meta.title);
	let seq = typeof meta.seq === "number" ? meta.seq : 0;
	for (const event of events) {
		const value = record(event);
		if (typeof value.seq === "number" && value.seq > seq) seq = value.seq;
		if (value.type === "session/title") title = text(record(value.data).title) ?? title;
	}
	const statusValue = record(liveAgent).status;
	return {
		sessionId: text(meta.id) ?? "",
		workspaceId: text(meta.workspaceId),
		cwd: text(meta.cwd),
		title,
		status: statusValue === "idle" || statusValue === "running" ? statusValue : "unknown",
		live: liveAgent !== void 0 && liveAgent !== null,
		subagentOwned: isSubagentHeader(ownerHeader),
		seq,
		agentPreset: text(meta.agentPreset)
	};
}
function createSessionBridge({ controller, agents, sessionQuery, liveSession }) {
	if (controller === null || typeof controller !== "object") throw new LiveTeamsError("CAPABILITY_UNAVAILABLE", "sessionController is not available in this composition");
	const liveAgentOf = (sessionId) => agents?.get?.(sessionId);
	const queryService = () => typeof sessionQuery === "function" ? sessionQuery() : sessionQuery;
	/**
	* Read one Session through whichever inspection API the host still offers.
	* Inspection is deliberately not cached: delivery receipts depend on current history.
	*/
	const snapshotOf = async (sessionId) => {
		if (typeof controller.inspect === "function") return record(await controller.inspect(sessionId));
		try {
			const live = record(liveSession?.(sessionId));
			const header = record(live.header);
			if (header.id === sessionId) {
				const events = typeof live.snapshotEvents === "function" ? live.snapshotEvents() : [];
				return {
					meta: header,
					inheritedEventCount: live.inheritedEventCount,
					events: Array.isArray(events) ? events : []
				};
			}
		} catch {}
		const query = queryService();
		if (typeof query?.load === "function") {
			const loaded = record(await query.load(sessionId));
			return {
				meta: record(loaded.header ?? loaded.meta),
				...loaded.inheritedEventCount === void 0 ? {} : { inheritedEventCount: loaded.inheritedEventCount },
				events: Array.isArray(loaded.events) ? loaded.events : []
			};
		}
		if (typeof controller.list === "function") {
			const page = record(await controller.list({}));
			const found = (Array.isArray(page.items) ? page.items : Array.isArray(page) ? page : []).map(record).find((item) => text(item.sessionId) === sessionId || text(item.id) === sessionId);
			if (found !== void 0) return {
				meta: {
					...found,
					id: sessionId
				},
				events: []
			};
		}
		throw new LiveTeamsError("CAPABILITY_UNAVAILABLE", "Session inspection is unavailable: this host offers neither sessionController.inspect, a live Session, sessionQuery.load nor a readable Session list", { auditDetail: "host compatibility: no Session inspection API" });
	};
	const bridge = {
		async removeQueuedRequest(sessionId, requestId) {
			if (text(sessionId) === void 0 || text(requestId) === void 0) return {
				state: "refused",
				reason: "invalid-request-identity"
			};
			const agent = record(liveAgentOf(sessionId));
			const header = record(record(agent.session).header);
			if (header.id !== sessionId || controller.updateQueue === void 0) return {
				state: "unobservable",
				reason: "pending-queue-unavailable"
			};
			if (isSubagentHeader(header)) return {
				state: "refused",
				reason: "subagent-owned"
			};
			const inbox = record(agent.inbox);
			if (!Array.isArray(inbox.nextTurn) || !Array.isArray(inbox.nextStep)) return {
				state: "unobservable",
				reason: "pending-queue-unavailable"
			};
			const matches = [...inbox.nextTurn, ...inbox.nextStep].map(record).filter((message) => record(message.source).kind === "user" && record(message.source).rpcId === requestId);
			if (matches.length === 0) return { state: "not-pending" };
			const itemId = text(matches[0]?.id);
			if (matches.length !== 1 || itemId === void 0) return {
				state: "refused",
				reason: "pending-identity-ambiguous"
			};
			try {
				await controller.updateQueue({
					sessionId,
					itemId,
					action: { kind: "remove" }
				});
				return {
					state: "removed",
					itemId
				};
			} catch (error) {
				return record(error).code === "session/queue-item-not-found" ? {
					state: "not-pending",
					itemId
				} : {
					state: "refused",
					itemId,
					reason: "native-queue-removal-refused"
				};
			}
		},
		async create(request) {
			const sessionId = text(request?.sessionId);
			if (sessionId === void 0) throw new LiveTeamsError("CAPABILITY_UNAVAILABLE", "create requires an explicit plugin-owned sessionId");
			const payload = { sessionId };
			if (text(request.workspaceId) !== void 0) payload.workspaceId = request.workspaceId;
			if (text(request.cwd) !== void 0) payload.cwd = request.cwd;
			if (text(request.agentPreset) !== void 0) payload.agentPreset = request.agentPreset;
			try {
				await controller.create(payload);
			} catch (error) {
				throw toBridgeError(error);
			}
			const descriptor = await bridge.inspect(sessionId);
			if (descriptor === void 0) throw new LiveTeamsError("SESSION_NOT_FOUND", `Session "${sessionId}" was not readable after create`, { auditDetail: "create succeeded but inspect could not observe the Session" });
			return descriptor;
		},
		async inspect(sessionId) {
			try {
				return descriptorOf(await snapshotOf(sessionId), liveAgentOf(sessionId));
			} catch (error) {
				if (isMissingSession(error)) return void 0;
				throw toBridgeError(error);
			}
		},
		/**
		* Deliberately silent on failure: an unreadable Session is an unmeasured one, and a rotation
		* limit that guessed a size would rotate for the wrong reason. The caller treats `undefined` as
		* "no evidence", which is what the decision table already does.
		*/
		async contextTokens(sessionId) {
			try {
				return contextTokensOf((await snapshotOf(sessionId)).events);
			} catch {
				return;
			}
		},
		/**
		* Same silence as `contextTokens`: an unreadable Session is an unnamed one, and rotation then
		* leaves the new Session on the deployment default rather than inventing a selection.
		*/
		async modelSelection(sessionId) {
			try {
				return modelSelectionOf((await snapshotOf(sessionId)).events);
			} catch {
				return;
			}
		},
		async validateAttachment(sessionId, workspaceId) {
			const descriptor = await bridge.inspect(sessionId);
			if (descriptor === void 0) throw new LiveTeamsError("SESSION_NOT_FOUND", `Session "${sessionId}" does not exist`, { auditDetail: "validateAttachment: inspect returned no Session" });
			if (descriptor.subagentOwned) throw new LiveTeamsError("CAPABILITY_UNAVAILABLE", `Session "${sessionId}" is owned by subagent routing`, { auditDetail: "validateAttachment: subagent-owned Session cannot be a member" });
			const expected = text(workspaceId);
			if (expected !== void 0 && descriptor.workspaceId !== expected) throw new LiveTeamsError("SESSION_WRONG_WORKSPACE", `Session "${sessionId}" is not attached to workspace "${expected}"`, { auditDetail: `observed workspaceId=${String(descriptor.workspaceId)}` });
			return descriptor;
		},
		async rename(sessionId, title) {
			try {
				const result = record(await controller.rename({
					sessionId,
					title
				}));
				return {
					title: text(result.title) ?? title,
					seq: typeof result.seq === "number" ? result.seq : void 0
				};
			} catch (error) {
				throw toBridgeError(error);
			}
		},
		selectModel() {
			throw new LiveTeamsError("CAPABILITY_UNAVAILABLE", "Model selection is intentionally unavailable in this build", { auditDetail: "Phase 2 policy omits member model selection because selectModel also rewrites the deployment-wide default model. This must not be worked around silently." });
		},
		async observeHumanActivity(sessionId, since, knownRequestIds) {
			let inspection;
			try {
				inspection = await snapshotOf(sessionId);
			} catch {
				return;
			}
			if (record(inspection.meta ?? inspection.header).id !== sessionId || !Array.isArray(inspection.events)) return void 0;
			const known = new Set(knownRequestIds);
			for (const raw of inspection.events) {
				const event = record(raw);
				if (event.type !== "user/message") continue;
				if (typeof event.time !== "number" || !Number.isFinite(event.time)) return void 0;
				if (event.time <= since) continue;
				const source = record(record(event.data).source);
				if (source.kind !== "user" && source.kind !== void 0) continue;
				if (typeof source.rpcId !== "string" || !known.has(source.rpcId)) return true;
			}
			return false;
		},
		async observeRequest(sessionId, requestId) {
			if (text(sessionId) === void 0 || text(requestId) === void 0) return {
				state: "unobservable",
				reason: "invalid-request-identity"
			};
			let inspection;
			try {
				inspection = await snapshotOf(sessionId);
			} catch (error) {
				return isMissingSession(error) ? {
					state: "failed",
					reason: "session-missing"
				} : {
					state: "unobservable",
					reason: "inspection-failed"
				};
			}
			if (record(inspection.meta ?? inspection.header).id !== sessionId) return {
				state: "unobservable",
				reason: "session-identity-unconfirmed"
			};
			if (!Array.isArray(inspection.events)) return {
				state: "unobservable",
				reason: "event-inspection-unavailable"
			};
			const events = inspection.events.map(record).filter((event) => Number.isInteger(event.seq)).sort((a, b) => Number(a.seq) - Number(b.seq));
			const input = events.find((event) => event.type === "user/message" && record(record(event.data).source).rpcId === requestId);
			if (input === void 0) return { state: "pending" };
			const inputSeq = Number(input.seq);
			const turn = record(events.filter((event) => event.type === "turn/start" && Number(event.seq) < inputSeq).at(-1)?.data).turn;
			if (typeof turn !== "number" || !Number.isInteger(turn)) return {
				state: "unobservable",
				inputSeq,
				reason: "turn-identity-unconfirmed"
			};
			const end = events.find((event) => event.type === "turn/end" && Number(event.seq) > inputSeq && record(event.data).turn === turn);
			if (end === void 0) return {
				state: "started",
				turn,
				inputSeq
			};
			const kind = text(record(record(end.data).reason).kind);
			if (kind === "completed") return {
				state: "completed",
				turn,
				inputSeq
			};
			return {
				state: "failed",
				turn,
				inputSeq,
				reason: kind ?? "turn-ended-without-completion"
			};
		},
		async deliver(sessionId, envelope) {
			if (envelope.mode !== "queue" && envelope.mode !== "steer") throw new LiveTeamsError("DELIVERY_REJECTED", `Unsupported delivery mode "${String(envelope.mode)}"`);
			try {
				await controller.prompt({
					requestId: envelope.requestId,
					sessionId,
					mode: envelope.mode,
					content: envelope.content
				}, new AbortController().signal);
				return { accepted: true };
			} catch (error) {
				throw toBridgeError(error);
			}
		},
		async interrupt(sessionId, _reason) {
			try {
				controller.cancel({ sessionId });
				return { accepted: true };
			} catch (error) {
				throw toBridgeError(error);
			}
		},
		async reconcile(sessionIds) {
			const descriptors = [];
			for (const sessionId of sessionIds) {
				const descriptor = await bridge.inspect(sessionId);
				if (descriptor !== void 0) descriptors.push(descriptor);
			}
			return descriptors;
		}
	};
	return Object.freeze(bridge);
}
export { contextTokensOf, createSessionBridge, modelSelectionOf, toBridgeError };
