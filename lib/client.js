window.__ModuleLoader__.load({
	id: "dsh-live-teams",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		// \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		react = __toESM(react, 1);
		_deepseek_ai_dsh_client_ui_primitives = __toESM(_deepseek_ai_dsh_client_ui_primitives, 1);
		// src/client/icon-names.ts
		/**
		* The icon names this plugin looks for, newest naming scheme first.
		*
		* Kept apart from the resolver so it can be checked without loading the host's primitives package:
		* the resolver imports the real module, a test cannot.
		*/
		const ICON_CANDIDATES = Object.freeze({
			IconEdit: [
				"IconEditOutlineRegular",
				"IconEditOutlineMedium",
				"IconEditOutline16"
			],
			IconPlus: [
				"IconPlusOutlineRegular",
				"IconPlusOutlineMedium",
				"IconPlusOutline16"
			],
			IconPause: [
				"IconPauseOutlineRegular",
				"IconPauseOutlineMedium",
				"IconPauseOutline16"
			],
			IconPlay: [
				"IconPlayOutlineRegular",
				"IconPlayOutlineMedium",
				"IconPlayOutline16"
			],
			IconRefresh: [
				"IconRefreshOutlineRegular",
				"IconRefreshOutlineMedium",
				"IconRefreshOutline16"
			],
			IconChevronDown: [
				"IconChevronDownOutlineRegular",
				"IconChevronDownOutlineMedium",
				"IconChevronDownOutline14"
			]
		});
		// src/client/client-requirements.ts
		/**
		* What this panel needs the host's client packages to export.
		*
		* On DSH 0.1.7 the host renamed every icon (`IconEditOutline16` → `IconEditOutlineRegular`) and the
		* Team tab went blank: a named import that no longer exists is `undefined`, and React throws
		* "element type is invalid" while rendering the whole slot. Nothing in the build or the tests
		* noticed, because the tests mock the package.
		*
		* So the requirement is written down here, next to the code that uses it, and checked twice: a unit
		* test holds this list against the real import in the panel, and `b36-client-names-check.mjs` holds
		* it against whatever host is installed. The next rename fails a check instead of a person's tab.
		*/
		const REQUIRED_PRIMITIVES = Object.freeze([
			"Button",
			"MarkdownText",
			"Modal",
			"StateDot",
			"Tag",
			"Tooltip"
		]);
		// src/client/primitives.ts
		const missing = (label) => () => react.default.createElement("span", { "data-live-teams-fallback": label });
		function resolveComponent(name, fallback) {
			try {
				const found = _deepseek_ai_dsh_client_ui_primitives[name];
				if (typeof found === "function" || typeof found === "object" && found !== null) return found;
			} catch {}
			return fallback;
		}
		const ButtonFallback = (props) => react.default.createElement("button", {
			type: "button",
			className: props.className,
			onClick: props.onClick,
			disabled: props.disabled,
			"aria-label": props["aria-label"],
			"data-live-teams-fallback": "Button"
		}, props.children);
		const MarkdownFallback = (props) => react.default.createElement("div", {
			className: props.className,
			"data-live-teams-fallback": "MarkdownText"
		}, String(props.text ?? ""));
		const ModalFallback = (props) => props.open === true ? react.default.createElement("div", {
			role: "dialog",
			"aria-label": props.title,
			"data-live-teams-fallback": "Modal"
		}, props.description, props.children, props.footer) : null;
		const DotFallback = (props) => react.default.createElement("span", {
			className: props.className,
			"data-live-teams-fallback": "StateDot"
		});
		const TagFallback = (props) => react.default.createElement("span", {
			className: props.className,
			"data-live-teams-fallback": "Tag"
		}, props.children);
		const TooltipFallback = (props) => react.default.createElement("span", {
			title: props.content,
			"data-live-teams-fallback": "Tooltip"
		}, props.children);
		const FALLBACKS = Object.freeze({
			Button: ButtonFallback,
			MarkdownText: MarkdownFallback,
			Modal: ModalFallback,
			StateDot: DotFallback,
			Tag: TagFallback,
			Tooltip: TooltipFallback
		});
		const resolved = {};
		for (const name of REQUIRED_PRIMITIVES) resolved[name] = resolveComponent(name, FALLBACKS[name] ?? missing(name));
		const Button = resolved.Button;
		const MarkdownText = resolved.MarkdownText;
		const Modal = resolved.Modal;
		const StateDot = resolved.StateDot;
		const Tag = resolved.Tag;
		const Tooltip = resolved.Tooltip;
		// src/client/icons.ts
		const Missing = () => null;
		function resolveIcon(candidates) {
			for (const name of candidates) try {
				const found = _deepseek_ai_dsh_client_ui_primitives[name];
				if (typeof found === "function" || typeof found === "object" && found !== null) return found;
			} catch {}
			return Missing;
		}
		/** Newest naming scheme first, then the one this plugin was written against. */
		const IconEdit = resolveIcon(ICON_CANDIDATES.IconEdit);
		const IconPlus = resolveIcon(ICON_CANDIDATES.IconPlus);
		const IconPause = resolveIcon(ICON_CANDIDATES.IconPause);
		const IconPlay = resolveIcon(ICON_CANDIDATES.IconPlay);
		const IconRefresh = resolveIcon(ICON_CANDIDATES.IconRefresh);
		const IconChevronDown = resolveIcon(ICON_CANDIDATES.IconChevronDown);
		// src/client/member-name.ts
		/**
		* The inverse of the server's Session-title convention.
		*
		* A member named `Builder` owns a Session titled `Builder - B1 Check`
		* (`sessionTitleFor` in `../session-title.ts`). The add-member dialog prefills
		* the member name from the picked Session's title while the server re-derives
		* the title from that name, so without this strip the two feed each other and
		* every add appends the team name again — the live audit shows exactly that:
		* `Builder - B1 Check` → `Builder-2 - B1 Check` → `Builder-2 - B1 Check - B1 Check`.
		*
		* Repeat stripping is deliberate: it also repairs names that already carry more
		* than one team suffix.
		*/
		function memberNameFromTitle(title, teamName) {
			const value = typeof title === "string" ? title.trim() : "";
			const team = typeof teamName === "string" ? teamName.trim() : "";
			if (value.length === 0 || team.length === 0) return value;
			const suffix = ` - ${team}`;
			let name = value;
			while (name.endsWith(suffix)) name = name.slice(0, -suffix.length).trimEnd();
			return name.length === 0 ? value : name;
		}
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
		// src/client/api.ts
		function pathWarnings(value) {
			if (value === void 0) return [];
			if (!Array.isArray(value)) throw new Error("invalid path warnings");
			return value.map((item) => {
				const entry = record(item);
				if (entry.code !== "path-no-match" && entry.code !== "path-scan-incomplete" || text(entry.pattern) === void 0 || text(entry.message) === void 0) throw new Error("invalid path warning");
				return {
					code: entry.code,
					pattern: entry.pattern,
					message: entry.message
				};
			});
		}
		/** The workspace folder action only exists after override created its folder. */
		function canOpenWorkspaceRoles(roles) {
			return roles.openAvailable && roles.workspaceDirectoryExists;
		}
		var LiveTeamsApiError = class extends Error {
			status;
			error;
			conflict;
			constructor(status, error, conflict = null) {
				super(error);
				this.name = "LiveTeamsApiError";
				this.status = status;
				this.error = error;
				this.conflict = conflict;
			}
		};
		function record(value) {
			return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
		}
		function text(value) {
			return typeof value === "string" && value.length > 0 ? value : void 0;
		}
		function nonNegativeInteger(value) {
			return typeof value === "number" && Number.isInteger(value) && value >= 0;
		}
		function member(value) {
			const candidate = record(value);
			const memberId = text(candidate.memberId);
			const displayName = text(candidate.displayName);
			const role = text(candidate.role);
			const availability = text(candidate.availability);
			const sessionId = candidate.sessionId;
			const status = candidate.status;
			if (memberId === void 0 || displayName === void 0 || role === void 0 || availability === void 0 || sessionId !== null && text(sessionId) === void 0 || typeof candidate.live !== "boolean" || status !== "idle" && status !== "running" && status !== "unknown" || !nonNegativeInteger(candidate.bindingGeneration) || !nonNegativeInteger(candidate.contractRevision)) throw new Error("invalid team member response");
			const permittedContacts = candidate.permittedContacts;
			if (permittedContacts !== void 0 && (!Array.isArray(permittedContacts) || !permittedContacts.every((contact) => text(contact) !== void 0))) throw new Error("invalid team member response");
			return {
				memberId,
				...typeof candidate.note === "string" ? { note: candidate.note } : {},
				displayName,
				role,
				availability,
				sessionId: sessionId === null ? null : String(sessionId),
				live: candidate.live,
				status,
				bindingGeneration: candidate.bindingGeneration,
				contractRevision: candidate.contractRevision,
				...permittedContacts === void 0 ? {} : { permittedContacts: [...permittedContacts] }
			};
		}
		function members(value) {
			if (!Array.isArray(value)) throw new Error("invalid team members response");
			return value.map(member);
		}
		function candidate(value) {
			const entry = record(value);
			const sessionId = text(entry.sessionId);
			const title = entry.title;
			const cwd = text(entry.cwd);
			const status = entry.status;
			if (sessionId === void 0 || title !== null && text(title) === void 0 || cwd === void 0 || typeof entry.live !== "boolean" || status !== "idle" && status !== "running" && status !== "unknown") throw new Error("invalid team candidate response");
			return {
				sessionId,
				title: title === null ? null : String(title),
				cwd,
				live: entry.live,
				status
			};
		}
		function role(value) {
			const entry = record(value);
			const id = text(entry.id);
			const name = text(entry.name);
			const description = entry.description;
			const aliases = entry.aliases;
			const source = entry.source;
			if (id === void 0 || name === void 0 || description !== void 0 && text(description) === void 0 || !Array.isArray(aliases) || !aliases.every((alias) => text(alias) !== void 0) || source !== "global" && source !== "workspace" || typeof entry.overridden !== "boolean") throw new Error("invalid team role response");
			return {
				id,
				name,
				...description === void 0 ? {} : { description: String(description) },
				aliases,
				source,
				overridden: entry.overridden
			};
		}
		function roles(value) {
			const entry = record(value);
			const globalDirectory = text(entry.globalDirectory);
			const workspaceDirectory = text(entry.workspaceDirectory);
			if (globalDirectory === void 0 || workspaceDirectory === void 0 || typeof entry.workspaceDirectoryExists !== "boolean" || typeof entry.openAvailable !== "boolean" || typeof entry.globalOpenAvailable !== "boolean" || !Array.isArray(entry.roles)) throw new Error("invalid team roles response");
			return {
				roles: entry.roles.map(role),
				globalDirectory,
				workspaceDirectory,
				workspaceDirectoryExists: entry.workspaceDirectoryExists,
				openAvailable: entry.openAvailable,
				globalOpenAvailable: entry.globalOpenAvailable
			};
		}
		function candidates(value) {
			const entry = record(value);
			const teamId = text(entry.teamId);
			const teamName = text(entry.teamName);
			const workspacePath = text(entry.workspacePath);
			if (teamId === void 0 || teamName === void 0 || workspacePath === void 0 || !nonNegativeInteger(entry.revision) || !Array.isArray(entry.candidates)) throw new Error("invalid team candidates response");
			return {
				teamId,
				teamName,
				workspacePath,
				revision: entry.revision,
				candidates: entry.candidates.map(candidate)
			};
		}
		function adoptionCandidate(value) {
			const entry = record(value);
			const teamId = text(entry.teamId);
			if (teamId === void 0 || entry.name !== void 0 && text(entry.name) === void 0 || entry.memberCount !== void 0 && !nonNegativeInteger(entry.memberCount) || entry.updatedAt !== void 0 && !nonNegativeInteger(entry.updatedAt) || entry.usable !== void 0 && typeof entry.usable !== "boolean" || entry.reason !== void 0 && text(entry.reason) === void 0) throw new Error("invalid adoption candidate response");
			return {
				teamId,
				...entry.name === void 0 ? {} : { name: String(entry.name) },
				...entry.memberCount === void 0 ? {} : { memberCount: entry.memberCount },
				...entry.updatedAt === void 0 ? {} : { updatedAt: entry.updatedAt },
				...entry.usable === void 0 ? {} : { usable: entry.usable },
				...entry.reason === void 0 ? {} : { reason: String(entry.reason) }
			};
		}
		function adoptionCandidates(value) {
			const entry = record(value);
			const teamId = text(entry.teamId);
			const workspacePath = text(entry.workspacePath);
			if (teamId === void 0 || workspacePath === void 0 || !Array.isArray(entry.candidates)) throw new Error("invalid adoption candidates response");
			return {
				teamId,
				workspacePath,
				candidates: entry.candidates.map(adoptionCandidate)
			};
		}
		function teamState(value) {
			const candidate = record(value);
			const teamId = text(candidate.teamId);
			const teamName = text(candidate.teamName);
			const workspacePath = text(candidate.workspacePath);
			if (typeof candidate.enabled !== "boolean" || teamId === void 0 || teamName === void 0 || workspacePath === void 0) throw new Error("invalid team state response");
			return {
				enabled: candidate.enabled,
				...typeof candidate.briefing === "string" ? { briefing: candidate.briefing } : {},
				...typeof candidate.openAvailable === "boolean" ? { openAvailable: candidate.openAvailable } : {},
				teamId,
				teamName,
				workspacePath,
				...typeof candidate.revision === "number" ? { revision: candidate.revision } : {},
				...typeof candidate.memberCount === "number" ? { memberCount: candidate.memberCount } : {}
			};
		}
		function inboxMessage(value) {
			const entry = record(value);
			const id = text(entry.id);
			const from = text(entry.from);
			const fromName = text(entry.fromName);
			const kind = entry.kind;
			const content = typeof entry.content === "string" ? entry.content : void 0;
			const createdAt = entry.createdAt;
			const delivery = record(entry.delivery);
			const deliveryId = text(delivery.id);
			const state = delivery.state;
			if (id === void 0 || from === void 0 || fromName === void 0 || !messageKindValue(kind) || content === void 0 || !nonNegativeInteger(createdAt) || deliveryId === void 0 || state !== "stored" && state !== "acknowledged" || delivery.acknowledgedAt !== void 0 && !nonNegativeInteger(delivery.acknowledgedAt)) throw new Error("invalid team inbox response");
			return {
				id,
				from,
				fromName,
				kind,
				content,
				createdAt,
				delivery: {
					id: deliveryId,
					state,
					...delivery.acknowledgedAt === void 0 ? {} : { acknowledgedAt: delivery.acknowledgedAt }
				}
			};
		}
		function messageKindValue(value) {
			return value === "message" || value === "direction" || value === "comment";
		}
		function inbox(value) {
			const entry = record(value);
			const teamId = text(entry.teamId);
			if (teamId === void 0 || !Array.isArray(entry.messages)) throw new Error("invalid team inbox response");
			return {
				teamId,
				messages: entry.messages.map(inboxMessage)
			};
		}
		function attentionEntry(value) {
			const entry = record(value);
			const memberId = text(entry.memberId);
			const name = text(entry.name);
			const sessionId = entry.sessionId === null ? null : text(entry.sessionId);
			const kind = entry.kind;
			if (memberId === void 0 || name === void 0 || sessionId === void 0 || !messageKindValue(kind) || !nonNegativeInteger(entry.waiting) || entry.waiting < 1 || !nonNegativeInteger(entry.since)) throw new Error("invalid team attention response");
			return {
				memberId,
				name,
				sessionId,
				waiting: entry.waiting,
				since: entry.since,
				kind
			};
		}
		function attention(value) {
			const entry = record(value);
			const teamId = text(entry.teamId);
			if (teamId === void 0 || !Array.isArray(entry.attention)) throw new Error("invalid team attention response");
			return {
				teamId,
				attention: entry.attention.map(attentionEntry)
			};
		}
		function sendMessageResult(value) {
			const entry = record(value);
			const messageId = text(entry.messageId);
			const recipients = entry.recipients;
			const deliveries = entry.deliveries;
			if (messageId === void 0 || !Array.isArray(recipients) || !recipients.every((item) => text(item) !== void 0) || !Array.isArray(deliveries)) throw new Error("invalid team send response");
			return {
				messageId,
				recipients,
				deliveries: deliveries.map((item) => {
					const delivery = record(item);
					const id = text(delivery.id);
					const recipient = text(delivery.recipient);
					const state = text(delivery.state);
					if (id === void 0 || recipient === void 0 || state === void 0 || delivery.failure !== void 0 && text(delivery.failure) === void 0) throw new Error("invalid team send response");
					return {
						id,
						recipient,
						state,
						...delivery.failure === void 0 ? {} : { failure: String(delivery.failure) }
					};
				})
			};
		}
		function snapshot(value) {
			const candidate = record(value);
			const teamId = text(candidate.teamId);
			const workspacePath = text(candidate.workspacePath);
			if (teamId === void 0 || workspacePath === void 0 || !nonNegativeInteger(candidate.revision)) throw new Error("invalid team snapshot response");
			const teamName = text(candidate.teamName);
			return {
				teamId,
				...teamName === void 0 ? {} : { teamName },
				...typeof candidate.leadMemberId === "string" ? { leadMemberId: candidate.leadMemberId } : {},
				workspacePath,
				revision: candidate.revision,
				members: members(candidate.members)
			};
		}
		function createSessionSuccess(value) {
			const candidate = record(value);
			const teamId = text(candidate.teamId);
			const memberId = text(candidate.memberId);
			const sessionId = text(candidate.sessionId);
			if (teamId === void 0 || memberId === void 0 || sessionId === void 0 || !nonNegativeInteger(candidate.revision) || candidate.applied !== true || typeof candidate.retried !== "boolean") throw new Error("invalid team session creation response");
			return {
				teamId,
				memberId,
				sessionId,
				revision: candidate.revision,
				applied: true,
				retried: candidate.retried,
				member: member(candidate.member)
			};
		}
		function mutationSuccess(value) {
			const candidate = record(value);
			const teamId = text(candidate.teamId);
			const memberId = text(candidate.memberId);
			if (teamId === void 0 || memberId === void 0 || !nonNegativeInteger(candidate.revision) || candidate.applied !== true || typeof candidate.retried !== "boolean") throw new Error("invalid team mutation response");
			return {
				teamId,
				memberId,
				revision: candidate.revision,
				applied: true,
				retried: candidate.retried,
				member: member(candidate.member)
			};
		}
		function interruptTurnSuccess(value) {
			const candidate = record(value);
			const memberId = text(candidate.memberId);
			const status = candidate.status;
			if (memberId === void 0 || candidate.interrupted !== true || status !== "idle" && status !== "running" && status !== "unknown") throw new Error("invalid team interrupt response");
			return {
				memberId,
				interrupted: true,
				status
			};
		}
		function removeMemberSuccess(value) {
			const candidate = record(value);
			const teamId = text(candidate.teamId);
			const memberId = text(candidate.memberId);
			const removed = record(candidate.removed);
			const removedId = text(removed.memberId);
			const displayName = text(removed.displayName);
			const role = text(removed.role);
			const sessionId = removed.sessionId;
			if (teamId === void 0 || memberId === void 0 || memberId !== removedId || !nonNegativeInteger(candidate.revision) || candidate.applied !== true || typeof candidate.retried !== "boolean" || removedId === void 0 || displayName === void 0 || role === void 0 || sessionId !== null && text(sessionId) === void 0) throw new Error("invalid team removal response");
			return {
				teamId,
				memberId,
				revision: candidate.revision,
				applied: true,
				retried: candidate.retried,
				removed: {
					memberId: removedId,
					displayName,
					role,
					sessionId: sessionId === null ? null : String(sessionId)
				}
			};
		}
		function conflict(value) {
			const candidate = record(value);
			if (!nonNegativeInteger(candidate.revision)) return null;
			try {
				return {
					revision: candidate.revision,
					members: members(candidate.members)
				};
			} catch {
				return null;
			}
		}
		const TASK_STATUSES = [
			"draft",
			"ready",
			"claimed",
			"in_progress",
			"waiting",
			"needs_human",
			"completed",
			"failed",
			"cancelled"
		];
		const REVIEW_VERDICTS = [
			"pass",
			"needs_revision",
			"escalate"
		];
		const FINDING_SEVERITIES = [
			"low",
			"medium",
			"high",
			"blocker"
		];
		function taskStatus(value) {
			return typeof value === "string" && TASK_STATUSES.includes(value);
		}
		function route(value) {
			if (value === void 0) return void 0;
			const entry = record(value);
			const type = entry.type;
			if (type === "report") {
				const to = entry.to;
				if ((typeof to !== "string" || to.length === 0) && to !== "human") throw new Error("invalid team task route");
				return {
					type,
					to
				};
			}
			if (type === "review") {
				const reviewer = text(entry.reviewer);
				if (reviewer === void 0) throw new Error("invalid team task route");
				return {
					type,
					reviewer
				};
			}
			if (type === "interactive") {
				const nested = route(entry.then);
				if (nested === void 0) throw new Error("invalid team task route");
				return {
					type,
					then: nested
				};
			}
			if (type === "custom") {
				const description = text(entry.description);
				if (description === void 0) throw new Error("invalid team task route");
				return {
					type,
					description
				};
			}
			throw new Error("invalid team task route");
		}
		function summaryRoute(value) {
			if (value === void 0) return void 0;
			const entry = record(value);
			const type = entry.type;
			if (type === "report") {
				const to = entry.to;
				if ((typeof to !== "string" || to.length === 0) && to !== "human") throw new Error("invalid team task route");
				const toName = entry.toName;
				if (toName !== void 0 && text(toName) === void 0) throw new Error("invalid team task route");
				return {
					type,
					to,
					...toName === void 0 ? {} : { toName: String(toName) }
				};
			}
			if (type === "review") {
				const reviewer = text(entry.reviewer);
				const reviewerName = entry.reviewerName;
				if (reviewer === void 0 || reviewerName !== void 0 && text(reviewerName) === void 0) throw new Error("invalid team task route");
				return {
					type,
					reviewer,
					...reviewerName === void 0 ? {} : { reviewerName: String(reviewerName) }
				};
			}
			if (type === "interactive") {
				const nested = summaryRoute(entry.then);
				if (nested === void 0) throw new Error("invalid team task route");
				return {
					type,
					then: nested
				};
			}
			if (type === "custom") {
				const description = text(entry.description);
				if (description === void 0) throw new Error("invalid team task route");
				return {
					type,
					description
				};
			}
			throw new Error("invalid team task route");
		}
		function task(value) {
			const entry = record(value);
			const id = text(entry.id);
			const teamId = text(entry.teamId);
			const title = text(entry.title);
			const kind = text(entry.kind);
			const status = entry.status;
			const acceptance = entry.acceptance;
			if (id === void 0 || teamId === void 0 || title === void 0 || kind === void 0 || !taskStatus(status) || !Array.isArray(acceptance) || !acceptance.every((item) => text(item) !== void 0) || !nonNegativeInteger(entry.roundLimit) || text(entry.createdBy) === void 0 || !nonNegativeInteger(entry.createdAt) || !nonNegativeInteger(entry.updatedAt) || !nonNegativeInteger(entry.revision)) throw new Error("invalid team task response");
			const assignee = entry.assignee;
			const humanContact = entry.humanContact;
			const optionalText = (value) => value === void 0 ? void 0 : text(value);
			if (assignee !== void 0 && text(assignee) === void 0) throw new Error("invalid team task response");
			if (humanContact !== void 0 && humanContact !== "none" && humanContact !== "expected" && humanContact !== "required") throw new Error("invalid team task response");
			const activeAttemptId = optionalText(entry.activeAttemptId);
			const latestSubmissionId = optionalText(entry.latestSubmissionId);
			const acceptedSubmissionId = optionalText(entry.acceptedSubmissionId);
			const archivedPath = optionalText(entry.archivedPath);
			if (entry.activeAttemptId !== void 0 && activeAttemptId === void 0 || entry.latestSubmissionId !== void 0 && latestSubmissionId === void 0 || entry.acceptedSubmissionId !== void 0 && acceptedSubmissionId === void 0 || entry.archivedPath !== void 0 && archivedPath === void 0) throw new Error("invalid team task response");
			if (entry.documentMissing !== void 0 && typeof entry.documentMissing !== "boolean") throw new Error("invalid team task response");
			return {
				id,
				teamId,
				title,
				kind,
				status,
				...entry.reviewReturn === void 0 ? {} : { reviewReturn: parseReviewReturn(entry.reviewReturn) },
				...assignee === void 0 ? {} : { assignee: String(assignee) },
				...entry.route === void 0 ? {} : { route: route(entry.route) },
				...humanContact === void 0 ? {} : { humanContact },
				...activeAttemptId === void 0 ? {} : { activeAttemptId },
				...latestSubmissionId === void 0 ? {} : { latestSubmissionId },
				...acceptedSubmissionId === void 0 ? {} : { acceptedSubmissionId },
				acceptance: [...acceptance],
				roundLimit: entry.roundLimit,
				createdBy: String(entry.createdBy),
				createdAt: entry.createdAt,
				updatedAt: entry.updatedAt,
				revision: entry.revision,
				...archivedPath === void 0 ? {} : { archivedPath },
				...entry.documentMissing === void 0 ? {} : { documentMissing: entry.documentMissing }
			};
		}
		function taskBlockers(value) {
			if (!Array.isArray(value)) throw new Error("invalid team tasks response");
			return value.map((entry) => {
				const fields = record(entry);
				const id = text(fields.id);
				const title = text(fields.title);
				if (id === void 0 || title === void 0 || !taskStatus(fields.status)) throw new Error("invalid team tasks response");
				return {
					id,
					title,
					status: fields.status
				};
			});
		}
		function taskSummary(value) {
			const entry = record(value);
			const id = text(entry.id);
			const title = text(entry.title);
			const status = entry.status;
			if (id === void 0 || title === void 0 || !taskStatus(status) || !nonNegativeInteger(entry.updatedAt)) throw new Error("invalid team tasks response");
			const assignee = entry.assignee;
			const assigneeName = entry.assigneeName;
			if (assignee !== void 0 && text(assignee) === void 0 || assigneeName !== void 0 && text(assigneeName) === void 0) throw new Error("invalid team tasks response");
			const round = entry.round;
			const roundLimit = entry.roundLimit;
			if (round !== void 0 && !nonNegativeInteger(round) || roundLimit !== void 0 && !nonNegativeInteger(roundLimit)) throw new Error("invalid team tasks response");
			const archivedPath = entry.archivedPath;
			const documentMissing = entry.documentMissing;
			const awaitsDecision = entry.awaitsDecision;
			if (awaitsDecision !== void 0 && typeof awaitsDecision !== "boolean") throw new Error("invalid team tasks response");
			if (archivedPath !== void 0 && text(archivedPath) === void 0 || documentMissing !== void 0 && typeof documentMissing !== "boolean") throw new Error("invalid team tasks response");
			const dependsOn = entry.dependsOn;
			if (dependsOn !== void 0 && (!Array.isArray(dependsOn) || !dependsOn.every((item) => typeof item === "string"))) throw new Error("invalid team tasks response");
			const blockedBy = entry.blockedBy === void 0 ? void 0 : taskBlockers(entry.blockedBy);
			return {
				id,
				title,
				status,
				...entry.reviewReturn === void 0 ? {} : { reviewReturn: parseReviewReturn(entry.reviewReturn) },
				...awaitsDecision === true ? { awaitsDecision: true } : {},
				...assignee === void 0 ? {} : { assignee: String(assignee) },
				...assigneeName === void 0 ? {} : { assigneeName: String(assigneeName) },
				...entry.route === void 0 ? {} : { route: summaryRoute(entry.route) },
				...round === void 0 ? {} : { round },
				...roundLimit === void 0 ? {} : { roundLimit },
				updatedAt: entry.updatedAt,
				...dependsOn === void 0 ? {} : { dependsOn },
				...blockedBy === void 0 ? {} : { blockedBy },
				...archivedPath === void 0 ? {} : { archivedPath: String(archivedPath) },
				...documentMissing === void 0 ? {} : { documentMissing }
			};
		}
		function tasks(value) {
			const entry = record(value);
			const teamId = text(entry.teamId);
			if (teamId === void 0 || !Array.isArray(entry.tasks)) throw new Error("invalid team tasks response");
			return {
				teamId,
				tasks: entry.tasks.map(taskSummary)
			};
		}
		function check(value) {
			const entry = record(value);
			const command = text(entry.command);
			const status = entry.status;
			if (command === void 0 || status !== "passed" && status !== "failed" || entry.output !== void 0 && text(entry.output) === void 0) throw new Error("invalid team task response");
			return {
				command,
				status,
				...entry.output === void 0 ? {} : { output: String(entry.output) }
			};
		}
		const SCOPE_STATES = [
			"clean",
			"violation",
			"shared-tree",
			"unchecked"
		];
		const SCOPE_REASONS = [
			"no-repository",
			"too-many-files",
			"no-snapshot",
			"unreadable"
		];
		function submissionScope(value) {
			if (value === void 0) return void 0;
			const entry = record(value);
			const state = entry.state === "collision" ? "shared-tree" : entry.state;
			if (!SCOPE_STATES.includes(state)) return void 0;
			const reason = typeof entry.reason === "string" && SCOPE_REASONS.includes(entry.reason) ? entry.reason : void 0;
			const list = (name) => Array.isArray(entry[name]) ? entry[name].filter((item) => typeof item === "string") : void 0;
			return {
				state,
				...list("declared") === void 0 ? {} : { declared: list("declared") },
				...list("changed") === void 0 ? {} : { changed: list("changed") },
				...list("unexpected") === void 0 ? {} : { unexpected: list("unexpected") },
				...(list("sharedTree") ?? list("collision")) === void 0 ? {} : { sharedTree: list("sharedTree") ?? list("collision") },
				...entry.mode === "git" || entry.mode === "files" ? { mode: entry.mode } : {},
				...reason === void 0 ? {} : { reason }
			};
		}
		function submission(value) {
			const entry = record(value);
			const id = text(entry.id);
			const taskId = text(entry.taskId);
			const attemptId = text(entry.attemptId);
			const summary = text(entry.summary);
			const artifact = record(entry.artifact);
			const artifactType = artifact.type;
			if (id === void 0 || taskId === void 0 || attemptId === void 0 || summary === void 0 || !nonNegativeInteger(entry.attemptGeneration) || !nonNegativeInteger(entry.createdAt) || !nonNegativeInteger(entry.revision) || !Array.isArray(entry.checks)) throw new Error("invalid team task response");
			let parsedArtifact;
			if (artifactType === "report") {
				const bodyRef = text(artifact.bodyRef);
				const bodyDigest = text(artifact.bodyDigest);
				if (bodyRef === void 0 || bodyDigest === void 0) throw new Error("invalid team task response");
				parsedArtifact = {
					type: artifactType,
					bodyRef,
					bodyDigest
				};
			} else if (artifactType === "files") {
				const paths = artifact.paths;
				const manifestDigest = text(artifact.manifestDigest);
				if (!Array.isArray(paths) || !paths.every((item) => text(item) !== void 0) || manifestDigest === void 0) throw new Error("invalid team task response");
				parsedArtifact = {
					type: artifactType,
					paths: [...paths],
					manifestDigest
				};
			} else throw new Error("invalid team task response");
			const scope = submissionScope(entry.scope);
			return {
				id,
				taskId,
				attemptId,
				attemptGeneration: entry.attemptGeneration,
				artifact: parsedArtifact,
				summary,
				checks: entry.checks.map(check),
				...scope === void 0 ? {} : { scope },
				createdAt: entry.createdAt,
				revision: entry.revision
			};
		}
		function finding(value) {
			const entry = record(value);
			const severity = entry.severity;
			const problem = text(entry.problem);
			const requiredFix = text(entry.requiredFix);
			const artifactLocation = entry.artifactLocation;
			if (!FINDING_SEVERITIES.includes(severity) || problem === void 0 || requiredFix === void 0 || artifactLocation !== void 0 && text(artifactLocation) === void 0) throw new Error("invalid team task response");
			return {
				severity,
				problem,
				requiredFix,
				...artifactLocation === void 0 ? {} : { artifactLocation: String(artifactLocation) }
			};
		}
		function reviewRound(value) {
			const entry = record(value);
			const id = text(entry.id);
			const taskId = text(entry.taskId);
			const submissionId = text(entry.submissionId);
			const reviewerMemberId = text(entry.reviewerMemberId);
			const verdict = entry.verdict;
			if (id === void 0 || taskId === void 0 || submissionId === void 0 || reviewerMemberId === void 0 || !nonNegativeInteger(entry.round) || entry.round < 1 || !REVIEW_VERDICTS.includes(verdict) || !Array.isArray(entry.findings) || !Array.isArray(entry.evidence) || !nonNegativeInteger(entry.createdAt) || !nonNegativeInteger(entry.revision)) throw new Error("invalid team task response");
			return {
				id,
				taskId,
				submissionId,
				reviewerMemberId,
				round: entry.round,
				verdict,
				findings: entry.findings.map(finding),
				evidence: entry.evidence.map(check),
				createdAt: entry.createdAt,
				revision: entry.revision
			};
		}
		const ATTEMPT_STATUSES = [
			"active",
			"revoking",
			"revoked",
			"completed",
			"failed"
		];
		function taskAttempt(value) {
			const entry = record(value);
			if (typeof entry.id !== "string" || typeof entry.memberId !== "string" || typeof entry.sessionId !== "string" || !Number.isInteger(entry.generation) || !Number.isInteger(entry.startedAt) || !ATTEMPT_STATUSES.includes(entry.status)) throw new Error("invalid team task attempt");
			if (entry.humanIntervenedAt !== void 0 && !Number.isInteger(entry.humanIntervenedAt)) throw new Error("invalid team task attempt");
			return {
				id: entry.id,
				memberId: entry.memberId,
				sessionId: entry.sessionId,
				generation: entry.generation,
				status: entry.status,
				startedAt: entry.startedAt,
				...entry.humanIntervenedAt === void 0 ? {} : { humanIntervenedAt: entry.humanIntervenedAt }
			};
		}
		function taskDetail(value) {
			const entry = record(value);
			if (typeof entry.document !== "string" || !Array.isArray(entry.submissions) || !Array.isArray(entry.rounds) || !Array.isArray(entry.attempts)) throw new Error("invalid team task response");
			if (entry.documentMissing !== void 0 && entry.documentMissing !== true) throw new Error("invalid team task response");
			return {
				task: task(entry.task),
				document: entry.document,
				...entry.documentMissing === void 0 ? {} : { documentMissing: true },
				submissions: entry.submissions.map(submission),
				rounds: entry.rounds.map(reviewRound),
				attempts: entry.attempts.map(taskAttempt)
			};
		}
		function acceptTaskResult(value) {
			const entry = record(value);
			const archivedPath = text(entry.archivedPath);
			if (archivedPath === void 0) throw new Error("invalid team task response");
			return {
				task: task(entry.task),
				archivedPath
			};
		}
		function reviseTaskResult(value) {
			return { task: task(record(value).task) };
		}
		function cancelTaskResult(value) {
			const entry = record(value);
			const parsedTask = task(entry.task);
			const archivedPath = text(entry.archivedPath);
			if (typeof entry.quiesced !== "boolean") throw new Error("invalid cancellation response");
			if (entry.quiesced && (parsedTask.status !== "cancelled" || archivedPath === void 0)) throw new Error("invalid completed cancellation");
			if (!entry.quiesced && (parsedTask.status !== "needs_human" || archivedPath !== void 0)) throw new Error("invalid pending cancellation");
			return {
				task: parsedTask,
				quiesced: entry.quiesced,
				...archivedPath === void 0 ? {} : { archivedPath }
			};
		}
		async function requestJson(path, init) {
			const response = await fetch(path, {
				...init,
				cache: "no-store",
				credentials: "same-origin",
				redirect: "error",
				headers: {
					accept: "application/json",
					...init.headers ?? {}
				}
			});
			let body;
			try {
				body = await response.json();
			} catch {
				throw new LiveTeamsApiError(response.status, `invalid team response (HTTP ${response.status}; non-JSON body)`);
			}
			if (!response.ok) {
				const bodyRecord = record(body);
				throw new LiveTeamsApiError(response.status, text(bodyRecord.error) ?? "team request failed", response.status === 409 ? conflict(body) : null);
			}
			return body;
		}
		/**
		* Every team request is scoped by the Session the view belongs to, so the host
		* can serve the team of that Session's workspace. A view without a Session id
		* still works against a pinned deployment.
		*/
		function scoped(path, session) {
			return session === void 0 || session.length === 0 ? path : `${path}?session=${encodeURIComponent(session)}`;
		}
		/** Add the scope to a mutation body only when there is one. */
		function withSession(body, session) {
			return session === void 0 || session.length === 0 ? body : {
				...body,
				sessionId: session
			};
		}
		async function fetchTeamState(session, signal) {
			const init = {
				method: "GET",
				headers: { accept: "application/json" }
			};
			if (signal !== void 0) init.signal = signal;
			try {
				return teamState(await requestJson(scoped("/api/live-teams/team", session), init));
			} catch (cause) {
				if (cause instanceof LiveTeamsApiError) throw cause;
				throw new LiveTeamsApiError(500, "invalid team response");
			}
		}
		async function enableTeam(name, session, createNew = false) {
			const body = withSession({
				...name === void 0 ? {} : { name },
				...createNew ? { createNew: true } : {}
			}, session);
			try {
				return teamState(await requestJson("/api/live-teams/team/enable", {
					method: "POST",
					headers: {
						accept: "application/json",
						"content-type": "application/json"
					},
					body: JSON.stringify(body)
				}));
			} catch (cause) {
				if (cause instanceof LiveTeamsApiError) throw cause;
				throw new LiveTeamsApiError(500, "invalid team response");
			}
		}
		async function disableTeam(session) {
			try {
				return teamState(await requestJson("/api/live-teams/team/disable", {
					method: "POST",
					headers: {
						accept: "application/json",
						"content-type": "application/json"
					},
					body: JSON.stringify(withSession({}, session))
				}));
			} catch (cause) {
				if (cause instanceof LiveTeamsApiError) throw cause;
				throw new LiveTeamsApiError(500, "invalid team response");
			}
		}
		async function renameTeam(name, expectedRevision, session) {
			const body = withSession({
				name,
				expectedRevision
			}, session);
			try {
				return teamState(await requestJson("/api/live-teams/team/name", {
					method: "POST",
					headers: {
						accept: "application/json",
						"content-type": "application/json"
					},
					body: JSON.stringify(body)
				}));
			} catch (cause) {
				if (cause instanceof LiveTeamsApiError) throw cause;
				throw new LiveTeamsApiError(500, "invalid team response");
			}
		}
		async function fetchTeamTasks(session, includeArchived = false, signal) {
			const base = scoped("/api/live-teams/tasks", session);
			const separator = base.includes("?") ? "&" : "?";
			const init = {
				method: "GET",
				headers: { accept: "application/json" }
			};
			if (signal !== void 0) init.signal = signal;
			try {
				return tasks(await requestJson(`${base}${separator}includeArchived=${includeArchived ? "true" : "false"}`, init));
			} catch (cause) {
				if (cause instanceof LiveTeamsApiError) throw cause;
				throw new LiveTeamsApiError(500, "invalid team response");
			}
		}
		function dispatchProjection(value) {
			const candidate = value;
			if (candidate === null || typeof candidate !== "object" || typeof candidate.paused !== "boolean" || !Array.isArray(candidate.tasks) || typeof candidate.counts !== "object" || candidate.counts === null) throw new LiveTeamsApiError(500, "invalid dispatch response");
			return candidate;
		}
		async function fetchTeamDispatch(session, signal) {
			const init = {
				method: "GET",
				headers: { accept: "application/json" }
			};
			if (signal !== void 0) init.signal = signal;
			try {
				return dispatchProjection(await requestJson(scoped("/api/live-teams/dispatch", session), init));
			} catch (cause) {
				if (cause instanceof LiveTeamsApiError) throw cause;
				throw new LiveTeamsApiError(500, "invalid dispatch response");
			}
		}
		/** Only the human and the lead may flip this; the server decides which one the caller is. */
		async function setTeamDispatch(mode, reason, session) {
			const body = withSession({
				mode,
				...reason === void 0 ? {} : { reason }
			}, session);
			try {
				const candidate = await requestJson("/api/live-teams/dispatch", {
					method: "POST",
					headers: {
						accept: "application/json",
						"content-type": "application/json"
					},
					body: JSON.stringify(body)
				});
				if (candidate === null || typeof candidate !== "object" || typeof candidate.from !== "string" || typeof candidate.to !== "string") throw new LiveTeamsApiError(500, "invalid dispatch response");
				return {
					from: candidate.from,
					to: candidate.to
				};
			} catch (cause) {
				if (cause instanceof LiveTeamsApiError) throw cause;
				throw new LiveTeamsApiError(500, "invalid dispatch response");
			}
		}
		function rotationPayload(value) {
			const candidate = record(value);
			if (typeof candidate.enabled !== "boolean" || !Number.isInteger(candidate.maxContextTokens) || !Number.isInteger(candidate.maxCompletedTasks) || typeof candidate.cooldownMs !== "number" || typeof candidate.maxRotationsPerPass !== "number" || candidate.source !== "team" && candidate.source !== "profile" || !Number.isInteger(candidate.revision)) throw new LiveTeamsApiError(500, "invalid rotation response");
			return candidate;
		}
		async function fetchTeamRotation(session, signal) {
			const init = {
				method: "GET",
				headers: { accept: "application/json" }
			};
			if (signal !== void 0) init.signal = signal;
			try {
				return rotationPayload(await requestJson(scoped("/api/live-teams/team/rotation", session), init));
			} catch (cause) {
				if (cause instanceof LiveTeamsApiError) throw cause;
				throw new LiveTeamsApiError(500, "invalid rotation response");
			}
		}
		/** The human's own surface, like dispatch: the host commits under the revision it was shown. */
		async function setTeamRotation(request, session) {
			const body = withSession({ ...request }, session);
			try {
				return rotationPayload(await requestJson("/api/live-teams/team/rotation", {
					method: "POST",
					headers: {
						accept: "application/json",
						"content-type": "application/json"
					},
					body: JSON.stringify(body)
				}));
			} catch (cause) {
				if (cause instanceof LiveTeamsApiError) throw cause;
				throw new LiveTeamsApiError(500, "invalid rotation response");
			}
		}
		async function fetchTeamTask(taskId, session, signal) {
			const base = scoped("/api/live-teams/task", session);
			const separator = base.includes("?") ? "&" : "?";
			const init = {
				method: "GET",
				headers: { accept: "application/json" }
			};
			if (signal !== void 0) init.signal = signal;
			try {
				return taskDetail(await requestJson(`${base}${separator}taskId=${encodeURIComponent(taskId)}`, init));
			} catch (cause) {
				if (cause instanceof LiveTeamsApiError) throw cause;
				throw new LiveTeamsApiError(500, "invalid team response");
			}
		}
		async function acceptTeamTask(taskId, note, session) {
			const body = withSession({
				taskId,
				...note === void 0 ? {} : { note }
			}, session);
			try {
				return acceptTaskResult(await requestJson("/api/live-teams/task/accept", {
					method: "POST",
					headers: {
						accept: "application/json",
						"content-type": "application/json"
					},
					body: JSON.stringify(body)
				}));
			} catch (cause) {
				if (cause instanceof LiveTeamsApiError) throw cause;
				throw new LiveTeamsApiError(500, "invalid team response");
			}
		}
		/**
		* Close a task by hand, without a submission.
		*
		* Accept needs a submission awaiting a decision; a task whose work was done by hand, dropped, or
		* overtaken has none, and the panel offered no way to close it.
		*/
		async function cancelTeamTask(taskId, reason, session) {
			const body = withSession({
				taskId,
				reason
			}, session);
			try {
				return cancelTaskResult(await requestJson("/api/live-teams/task/cancel", {
					method: "POST",
					headers: {
						accept: "application/json",
						"content-type": "application/json"
					},
					body: JSON.stringify(body)
				}));
			} catch (cause) {
				if (cause instanceof LiveTeamsApiError) throw cause;
				throw new LiveTeamsApiError(500, "invalid team response");
			}
		}
		async function resumeTeamTask(taskId, session) {
			const body = withSession({ taskId }, session);
			try {
				return reviseTaskResult(await requestJson("/api/live-teams/task/resume", {
					method: "POST",
					headers: {
						accept: "application/json",
						"content-type": "application/json"
					},
					body: JSON.stringify(body)
				}));
			} catch (cause) {
				if (cause instanceof LiveTeamsApiError) throw cause;
				throw new LiveTeamsApiError(500, "invalid team response");
			}
		}
		async function reviseTeamTask(taskId, instructions, session) {
			const body = withSession({
				taskId,
				instructions
			}, session);
			try {
				return reviseTaskResult(await requestJson("/api/live-teams/task/revise", {
					method: "POST",
					headers: {
						accept: "application/json",
						"content-type": "application/json"
					},
					body: JSON.stringify(body)
				}));
			} catch (cause) {
				if (cause instanceof LiveTeamsApiError) throw cause;
				throw new LiveTeamsApiError(500, "invalid team response");
			}
		}
		async function fetchTeamRoles(session, signal) {
			const init = {
				method: "GET",
				headers: { accept: "application/json" }
			};
			if (signal !== void 0) init.signal = signal;
			try {
				return roles(await requestJson(scoped("/api/live-teams/roles", session), init));
			} catch (cause) {
				if (cause instanceof LiveTeamsApiError) throw cause;
				throw new LiveTeamsApiError(500, "invalid team response");
			}
		}
		async function openTeamRoles(kind, id, session) {
			const body = withSession(id === void 0 ? { scope: kind } : {
				scope: kind,
				id
			}, session);
			const opened = text(record(await requestJson("/api/live-teams/roles/open", {
				method: "POST",
				headers: {
					accept: "application/json",
					"content-type": "application/json"
				},
				body: JSON.stringify(body)
			})).opened);
			if (opened === void 0) throw new LiveTeamsApiError(500, "invalid team response");
			return opened;
		}
		async function overrideTeamRole(id, session) {
			const result = record(await requestJson("/api/live-teams/roles/override", {
				method: "POST",
				headers: {
					accept: "application/json",
					"content-type": "application/json"
				},
				body: JSON.stringify(withSession({ id }, session))
			}));
			const path = text(result.path);
			if (text(result.id) === void 0 || path === void 0) throw new LiveTeamsApiError(500, "invalid team response");
			return {
				id: String(result.id),
				path
			};
		}
		async function fetchTeamAdoptionCandidates(session, signal) {
			const init = {
				method: "GET",
				headers: { accept: "application/json" }
			};
			if (signal !== void 0) init.signal = signal;
			try {
				return adoptionCandidates(await requestJson(scoped("/api/live-teams/team/candidates", session), init));
			} catch (cause) {
				if (cause instanceof LiveTeamsApiError) throw cause;
				throw new LiveTeamsApiError(500, "invalid team response");
			}
		}
		async function adoptTeam(teamId, replaceEmptyDerived, session) {
			const body = withSession({
				teamId,
				replaceEmptyDerived
			}, session);
			try {
				const value = record(await requestJson("/api/live-teams/team/adopt", {
					method: "POST",
					headers: {
						accept: "application/json",
						"content-type": "application/json"
					},
					body: JSON.stringify(body)
				}));
				const result = teamState(value);
				const adoptedFrom = text(value.adoptedFrom);
				if (adoptedFrom === void 0) throw new LiveTeamsApiError(500, "invalid team response");
				return {
					...result,
					adoptedFrom
				};
			} catch (cause) {
				if (cause instanceof LiveTeamsApiError) throw cause;
				throw new LiveTeamsApiError(500, "invalid team response");
			}
		}
		async function fetchTeamCandidates(session, signal) {
			const init = {
				method: "GET",
				headers: { accept: "application/json" }
			};
			if (signal !== void 0) init.signal = signal;
			try {
				return candidates(await requestJson(scoped("/api/live-teams/candidates", session), init));
			} catch (cause) {
				if (cause instanceof LiveTeamsApiError) throw cause;
				throw new LiveTeamsApiError(500, "invalid team response");
			}
		}
		async function fetchTeamInbox(session, limit = 50, signal) {
			const init = {
				method: "GET",
				headers: { accept: "application/json" }
			};
			if (signal !== void 0) init.signal = signal;
			try {
				return inbox(await requestJson(`${scoped("/api/live-teams/messages", session)}${session === void 0 || session.length === 0 ? "?" : "&"}limit=${encodeURIComponent(String(limit))}`, init));
			} catch (cause) {
				if (cause instanceof LiveTeamsApiError) throw cause;
				throw new LiveTeamsApiError(500, "invalid team response");
			}
		}
		/** Who is waiting for the human, one entry per member. Polled by the header chip. */
		async function fetchTeamAttention(session, signal) {
			const init = {
				method: "GET",
				headers: { accept: "application/json" }
			};
			if (signal !== void 0) init.signal = signal;
			try {
				return attention(await requestJson(scoped("/api/live-teams/attention", session), init));
			} catch (cause) {
				if (cause instanceof LiveTeamsApiError) throw cause;
				throw new LiveTeamsApiError(500, "invalid team response");
			}
		}
		/**
		* Clear a whole member's backlog in one request. The chip opens the Session the
		* human was taken to, so acknowledging 22 rows one by one would be busywork.
		*/
		async function acknowledgeTeamMessages(messageIds, session) {
			try {
				const result = record(await requestJson("/api/live-teams/messages/acknowledge", {
					method: "POST",
					headers: {
						accept: "application/json",
						"content-type": "application/json"
					},
					body: JSON.stringify(withSession({ messageIds: [...messageIds] }, session))
				}));
				if (!Array.isArray(result.messageIds) || !result.messageIds.every((entry) => typeof entry === "string")) throw new LiveTeamsApiError(500, "invalid team response");
				return { messageIds: result.messageIds };
			} catch (cause) {
				if (cause instanceof LiveTeamsApiError) throw cause;
				throw new LiveTeamsApiError(500, "invalid team response");
			}
		}
		async function sendTeamMessage(request, session) {
			try {
				return sendMessageResult(await requestJson("/api/live-teams/messages", {
					method: "POST",
					headers: {
						accept: "application/json",
						"content-type": "application/json"
					},
					body: JSON.stringify(withSession(request, session))
				}));
			} catch (cause) {
				if (cause instanceof LiveTeamsApiError) throw cause;
				throw new LiveTeamsApiError(500, "invalid team response");
			}
		}
		async function acknowledgeTeamMessage(messageId, session) {
			try {
				const result = record(await requestJson("/api/live-teams/messages/acknowledge", {
					method: "POST",
					headers: {
						accept: "application/json",
						"content-type": "application/json"
					},
					body: JSON.stringify(withSession({ messageId }, session))
				}));
				if (text(result.messageId) === void 0 || result.state !== "acknowledged") throw new LiveTeamsApiError(500, "invalid team response");
				return {
					messageId: String(result.messageId),
					state: "acknowledged"
				};
			} catch (cause) {
				if (cause instanceof LiveTeamsApiError) throw cause;
				throw new LiveTeamsApiError(500, "invalid team response");
			}
		}
		function lead(value) {
			const candidate = record(value);
			if (candidate.resolvedFrom !== "state" && candidate.resolvedFrom !== "role" && candidate.resolvedFrom !== "none") throw new Error("invalid team lead response");
			return {
				...typeof candidate.leadMemberId === "string" ? { leadMemberId: candidate.leadMemberId } : {},
				resolvedFrom: candidate.resolvedFrom
			};
		}
		async function openTeamBriefing(session) {
			const opened = text(record(await requestJson("/api/live-teams/team/briefing/open", {
				method: "POST",
				headers: {
					accept: "application/json",
					"content-type": "application/json"
				},
				body: JSON.stringify(withSession({}, session))
			})).opened);
			if (opened === void 0) throw new LiveTeamsApiError(500, "invalid team response");
			return opened;
		}
		async function fetchTeamLead(session) {
			return lead(await requestJson(scoped("/api/live-teams/team/lead", session), {
				method: "GET",
				headers: { accept: "application/json" }
			}));
		}
		async function setTeamLead(memberId, session) {
			const leadMemberId = text(record(await requestJson("/api/live-teams/team/lead", {
				method: "POST",
				headers: {
					accept: "application/json",
					"content-type": "application/json"
				},
				body: JSON.stringify(withSession({ memberId }, session))
			})).leadMemberId);
			if (leadMemberId === void 0) throw new LiveTeamsApiError(500, "invalid team response");
			return { leadMemberId };
		}
		async function fetchTeamSnapshot(session, signal) {
			const init = {
				method: "GET",
				headers: { accept: "application/json" }
			};
			if (signal !== void 0) init.signal = signal;
			try {
				return snapshot(await requestJson(scoped("/api/live-teams/members", session), init));
			} catch (cause) {
				if (cause instanceof LiveTeamsApiError) throw cause;
				throw new LiveTeamsApiError(500, "invalid team response");
			}
		}
		async function mutate(path, body, session) {
			try {
				return mutationSuccess(await requestJson(path, {
					method: "POST",
					headers: {
						accept: "application/json",
						"content-type": "application/json"
					},
					body: JSON.stringify(withSession(body, session))
				}));
			} catch (cause) {
				if (cause instanceof LiveTeamsApiError) throw cause;
				throw new LiveTeamsApiError(500, "invalid team response");
			}
		}
		function changeMemberRole(memberId, role, expectedRevision, session) {
			return mutate("/api/live-teams/members/role", {
				memberId,
				role,
				expectedRevision
			}, session);
		}
		function changeMemberAvailability(memberId, availability, expectedRevision, session) {
			return mutate("/api/live-teams/members/availability", {
				memberId,
				availability,
				expectedRevision
			}, session);
		}
		function changeMemberDisplayName(memberId, displayName, expectedRevision, session) {
			return mutate("/api/live-teams/members/name", {
				memberId,
				displayName,
				expectedRevision
			}, session);
		}
		async function createTeamTask(draft, session) {
			try {
				const result = record(await requestJson("/api/live-teams/task/create", {
					method: "POST",
					headers: {
						accept: "application/json",
						"content-type": "application/json"
					},
					body: JSON.stringify(withSession(draft, session))
				}));
				const documentPath = text(result.documentPath);
				if (documentPath === void 0) throw new Error("invalid create response");
				return {
					task: task(result.task),
					documentPath,
					warnings: pathWarnings(result.warnings)
				};
			} catch (cause) {
				if (cause instanceof LiveTeamsApiError) throw cause;
				throw new LiveTeamsApiError(500, "invalid team response");
			}
		}
		async function updateTeamTask(request, session) {
			try {
				const result = record(await requestJson(scoped("/api/live-teams/task/update", session), {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(request)
				}));
				if (typeof result.document !== "string" || !Array.isArray(result.changed) || !result.changed.every((item) => typeof item === "string")) throw new Error("invalid update response");
				return {
					task: task(result.task),
					document: result.document,
					changed: result.changed,
					warnings: pathWarnings(result.warnings)
				};
			} catch (cause) {
				if (cause instanceof LiveTeamsApiError) throw cause;
				throw new LiveTeamsApiError(500, "invalid team response");
			}
		}
		async function revokeTeamTask(request, session) {
			try {
				const result = record(await requestJson(scoped("/api/live-teams/task/revoke", session), {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(request)
				}));
				if (typeof result.quiesced !== "boolean" || typeof result.reassigned !== "boolean") throw new Error("invalid revoke response");
				return {
					task: task(result.task),
					attempt: taskAttempt(result.attempt),
					quiesced: result.quiesced,
					reassigned: result.reassigned
				};
			} catch (cause) {
				if (cause instanceof LiveTeamsApiError) throw cause;
				throw new LiveTeamsApiError(500, "invalid team response");
			}
		}
		function addTeamMember(request, session) {
			return mutate(scoped("/api/live-teams/members", session), request);
		}
		async function createTeamSessionMember(request, session) {
			try {
				return createSessionSuccess(await requestJson("/api/live-teams/members/create-session", {
					method: "POST",
					headers: {
						accept: "application/json",
						"content-type": "application/json"
					},
					body: JSON.stringify(withSession(request, session))
				}));
			} catch (cause) {
				if (cause instanceof LiveTeamsApiError) throw cause;
				throw new LiveTeamsApiError(500, "invalid team response");
			}
		}
		async function interruptTeamMember(memberId, session) {
			try {
				return interruptTurnSuccess(await requestJson("/api/live-teams/member/interrupt", {
					method: "POST",
					headers: {
						accept: "application/json",
						"content-type": "application/json"
					},
					body: JSON.stringify(withSession({ memberId }, session))
				}));
			} catch (cause) {
				if (cause instanceof LiveTeamsApiError) throw cause;
				throw new LiveTeamsApiError(500, "invalid team response");
			}
		}
		async function grantTeamContact(request, session) {
			const value = record(await requestJson("/api/live-teams/member/grant", {
				method: "POST",
				headers: {
					accept: "application/json",
					"content-type": "application/json"
				},
				body: JSON.stringify(withSession(request, session))
			}));
			if (!Array.isArray(value.grants)) throw new LiveTeamsApiError(500, "invalid team response");
			return {
				grants: value.grants,
				...typeof value.leadMemberId === "string" ? { leadMemberId: value.leadMemberId } : {}
			};
		}
		async function removeTeamMember(memberId, expectedRevision, session) {
			try {
				return removeMemberSuccess(await requestJson("/api/live-teams/members/remove", {
					method: "POST",
					headers: {
						accept: "application/json",
						"content-type": "application/json"
					},
					body: JSON.stringify(withSession({
						memberId,
						expectedRevision
					}, session))
				}));
			} catch (cause) {
				if (cause instanceof LiveTeamsApiError) throw cause;
				throw new LiveTeamsApiError(500, "invalid team response");
			}
		}
		// src/client/styles.ts
		const STYLE_ID = "dsh-live-teams/styles";
		const css = `
/* Layout and type scale adapted from dsh-context v0.52.1 (Apache License 2.0); modified for dsh-live-teams. */
.dshLiveTeamsRoot {
  box-sizing: border-box;
  height: 100%;
  min-width: 0;
  overflow-y: auto;
  padding: 16px 20px 32px;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
}

.dshLiveTeamsCard {
  box-sizing: border-box;
  min-width: 0;
  margin-bottom: 14px;
  padding: 14px 16px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1);
  container: dshLiveTeamsCard / inline-size;
}

.dshLiveTeamsCols {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-bottom: 14px;
}

.dshLiveTeamsCols > .dshLiveTeamsCard,
.dshLiveTeamsCol > .dshLiveTeamsCard:last-child {
  margin-bottom: 0;
}

.dshLiveTeamsLeadControl { display: flex; flex-direction: column; gap: 4px; color: var(--dsw-alias-label-secondary); font-size: 11px; }
.dshLiveTeamsLeadControl select { height: 28px; padding: 4px 8px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 7px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); font: inherit; }

.dshLiveTeamsHeader {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.dshLiveTeamsHeaderCopy,
.dshLiveTeamsSectionHeader,
.dshLiveTeamsMemberHeading,
.dshLiveTeamsMemberIdentity,
.dshLiveTeamsNameLine,
.dshLiveTeamsMemberMeta,
.dshLiveTeamsAvailability {
  min-width: 0;
}

.dshLiveTeamsHeaderCopy,
.dshLiveTeamsSectionHeader {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.dshLiveTeamsHeader h2,
.dshLiveTeamsSectionHeader h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.dshLiveTeamsHeader h2 {
  font-size: 13px;
}

.dshLiveTeamsHeaderCaption,
.dshLiveTeamsSectionCaption {
  margin: 0;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
}

.dshLiveTeamsIconButton {
  appearance: none;
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 6px;
  border: 0;
  border-radius: 28px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  transition: background-color var(--ds-transition-duration, .2s) var(--ds-ease-in-out, ease-in-out), color var(--ds-transition-duration, .2s) var(--ds-ease-in-out, ease-in-out);
}

.dshLiveTeamsIconButton:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

.dshLiveTeamsIconButton:focus-visible,
.dshLiveTeamsAddButton:focus-visible,
.dshLiveTeamsCandidate:focus-within,
.dshLiveTeamsModalField input:focus-visible,
.dshLiveTeamsModalField select:focus-visible,
.dshLiveTeamsModalField textarea:focus-visible,
.dshLiveTeamsMemberAction:focus-visible,
.dshLiveTeamsInterruptButton:focus-visible,
.dshLiveTeamsEditNameButton:focus-visible,
.dshLiveTeamsApply:focus-visible,
.dshLiveTeamsRoleInput:focus-visible,
.dshLiveTeamsNameInput:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: 2px;
}

.dshLiveTeamsIconButton:disabled,
.dshLiveTeamsMemberAction:disabled,
.dshLiveTeamsEditNameButton:disabled,
.dshLiveTeamsApply:disabled,
.dshLiveTeamsRoleInput:disabled,
.dshLiveTeamsNameInput:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.dshLiveTeamsBriefing pre { margin: 8px 0; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--dsw-alias-label-secondary); font: inherit; }

.dshLiveTeamsCollapseHeader { display: flex; align-items: center; gap: 8px; width: 100%; padding: 0; border: 0; background: transparent; color: var(--dsw-alias-label-primary); font: inherit; text-align: left; cursor: pointer; }
.dshLiveTeamsCollapseHeaderCopy { display: flex; flex: 1; flex-direction: column; gap: 3px; min-width: 0; }
.dshLiveTeamsCollapseHeaderCopy strong { font-size: 13px; font-weight: 600; }
.dshLiveTeamsCollapseHeaderCopy span { overflow: hidden; color: var(--dsw-alias-label-secondary); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.dshLiveTeamsDisclosure { display: inline-flex; flex: none; color: var(--dsw-alias-label-tertiary); transition: transform var(--ds-transition-duration, .2s) var(--ds-ease-in-out, ease-in-out); }
.dshLiveTeamsPanelExpanded .dshLiveTeamsDisclosure { transform: rotate(180deg); }
.dshLiveTeamsBriefing > .dshLiveTeamsAddButton { margin-top: 8px; }
.dshLiveTeamsJournal { display: flex; flex-direction: column; gap: 8px; }
.dshLiveTeamsJournalFilters { display: flex; flex-wrap: wrap; gap: 4px; }
.dshLiveTeamsJournalFilter { padding: 3px 8px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 5px; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 11px; line-height: 1; cursor: pointer; }
.dshLiveTeamsJournalFilterActive { background: var(--dsw-alias-interactive-bg-active); color: var(--dsw-alias-label-primary); }
/* The journal is what a person actually reads, so it takes the height it can: the old 320px cap
   showed about eight rows and hid the rest behind its own scrollbar. The card below it (messages)
   is collapsed to one line unless it has something for the human, so this costs no other section. */
.dshLiveTeamsJournalList { display: flex; flex-direction: column; gap: 2px; max-height: min(58vh, 760px); margin: 0; padding: 0; overflow-y: auto; list-style: none; }
.dshLiveTeamsJournalRow { display: flex; align-items: center; gap: 8px; min-width: 0; padding: 3px 0; font-size: 12px; }
.dshLiveTeamsJournalIcon { flex: none; width: 12px; color: var(--dsw-alias-label-tertiary); text-align: center; }
.dshLiveTeamsJournalKind { flex: none; padding: 1px 6px; border-radius: 4px; color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-2); font-size: 10px; font-weight: 600; line-height: 1.2; }
.dshLiveTeamsJournalSummary { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dshLiveTeamsJournalRefs { flex: none; color: var(--dsw-alias-label-secondary); font-size: 11px; font-variant-numeric: tabular-nums; }
.dshLiveTeamsJournalTime { flex: none; color: var(--dsw-alias-label-secondary); font-size: 12px; font-variant-numeric: tabular-nums; }
.dshLiveTeamsJournalDetail { flex-basis: 100%; padding-left: 20px; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 1.55; }
.dshLiveTeamsMemberCollapsed { display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 0; border: 0; background: transparent; color: var(--dsw-alias-label-primary); font: inherit; text-align: left; cursor: pointer; list-style: none; }
.dshLiveTeamsMemberCollapsed::-webkit-details-marker { display: none; }
.dshLiveTeamsMemberCollapsed .dshLiveTeamsMemberName { flex: none; width: auto; font-size: 12px; line-height: 16px; }
.dshLiveTeamsMemberChip { flex: none; padding: 1px 6px; border-radius: 4px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary); font-size: 10px; font-weight: 600; }
.dshLiveTeamsMemberLive { flex: none; color: var(--dsw-alias-label-secondary); font-size: 11px; }
.dshLiveTeamsMemberLiveOn { color: var(--dsw-alias-state-success-primary); }
.dshLiveTeamsMemberNote { min-width: 0; overflow: hidden; color: var(--dsw-alias-label-secondary); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.dshLiveTeamsRow:not(.dshLiveTeamsRowSelected) > .dshLiveTeamsMemberCollapsed { min-height: 28px; }
.dshLiveTeamsRoles > .dshLiveTeamsCollapseHeader { margin-bottom: 0; }
.dshLiveTeamsRoles.dshLiveTeamsPanelExpanded > .dshLiveTeamsRoleActions { margin-top: 8px; }
.dshLiveTeamsTasks { width: 100%; box-sizing: border-box; }
.dshLiveTeamsTaskFilter { display: flex; flex-wrap: wrap; }
.dshLiveTeamsTaskList { display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 0; list-style: none; }
.dshLiveTeamsTaskRow { min-width: 0; overflow: hidden; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: var(--dsw-alias-bg-layer-2); }
.dshLiveTeamsTaskSummary { display: grid; grid-template-columns: 14px auto minmax(0, 1fr) minmax(0, 1.2fr) 36px 42px; align-items: center; gap: 8px; width: 100%; padding: 7px 10px; border: 0; background: transparent; color: var(--dsw-alias-label-primary); font: inherit; font-size: 12px; line-height: 1.35; text-align: left; cursor: pointer; transition: background-color var(--ds-transition-duration, .2s) var(--ds-ease-in-out, ease-in-out); }
.dshLiveTeamsTaskSummary:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dshLiveTeamsTaskDisclosure { display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; color: var(--dsw-alias-label-tertiary); transition: transform var(--ds-transition-duration, .2s) var(--ds-ease-in-out, ease-in-out); }
.dshLiveTeamsTaskDisclosureOpen { transform: rotate(180deg); }
/* A blocked task must not read as a claimable one: warn tone, and only on blocked rows. */
.dshLiveTeamsTaskBlocked { flex: none; padding: 1px 6px; border-radius: 4px; background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 15%, transparent); color: var(--dsw-alias-state-warn-primary); font-size: 10px; font-weight: 600; line-height: 1.35; white-space: nowrap; }
.dshLiveTeamsTaskQueued { flex: none; padding: 1px 6px; border-radius: 4px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary); font-size: 10px; font-weight: 600; line-height: 1.35; white-space: nowrap; }
.dshLiveTeamsTaskControls { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.dshLiveTeamsSubmissionScope { margin-left: 6px; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; background: color-mix(in srgb, var(--dsw-alias-text-secondary) 12%, transparent); color: var(--dsw-alias-text-secondary); }
.dshLiveTeamsSubmissionScope.dshLiveTeamsScopeshared-tree { background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 15%, transparent); color: var(--dsw-alias-state-warn-primary); }
.dshLiveTeamsSubmissionScope.dshLiveTeamsScopescopeviolation { background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 15%, transparent); color: var(--dsw-alias-state-error-primary); }
.dshLiveTeamsMemberOpen { flex: none; padding: 2px 8px; border: 1px solid var(--dsw-alias-border-secondary); border-radius: 6px; background: transparent; color: var(--dsw-alias-text-secondary); font-size: 11px; line-height: 1.4; cursor: pointer; }
.dshLiveTeamsMemberOpen:hover:not(:disabled) { border-color: var(--dsw-alias-border-primary); color: var(--dsw-alias-text-primary); }
.dshLiveTeamsMemberOpen:disabled { opacity: 0.45; cursor: default; }
.dshLiveTeamsTaskAttempts { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 3px; }
.dshLiveTeamsTaskAttempts li { display: flex; flex-wrap: wrap; gap: 6px; align-items: baseline; }
.dshLiveTeamsTaskIntervened { flex: none; padding: 1px 6px; border-radius: 4px; background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 15%, transparent); color: var(--dsw-alias-state-warn-primary); font-size: 10px; font-weight: 600; line-height: 1.35; }
.dshLiveTeamsDispatchToggle { padding: 1px 8px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 4px; background: transparent; color: var(--dsw-alias-label-secondary); font-size: 11px; cursor: pointer; transition: color var(--ds-transition-duration, .2s) var(--ds-ease-in-out, ease-in-out), border-color var(--ds-transition-duration, .2s) var(--ds-ease-in-out, ease-in-out); }
.dshLiveTeamsDispatchToggle:hover:not(:disabled) { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-label-secondary); }
.dshLiveTeamsDispatchToggle:disabled { opacity: .5; cursor: default; }
.dshLiveTeamsDispatchTogglePaused { border-color: var(--dsw-alias-state-warn-primary); color: var(--dsw-alias-state-warn-primary); }
.dshLiveTeamsTaskRound { width: 36px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
.dshLiveTeamsTaskAge { color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
.dshLiveTeamsTaskStatus { display: inline-flex; width: max-content; padding: 1px 6px; border-radius: 4px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary); font-size: 10px; font-weight: 600; line-height: 1.35; white-space: nowrap; }
.dshLiveTeamsTaskTitle, .dshLiveTeamsTaskRoute { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dshLiveTeamsTaskTitle { font-weight: 600; }
.dshLiveTeamsTaskRoute { color: var(--dsw-alias-label-secondary); font-size: 11px; }
.dshLiveTeamsTaskDetail { display: flex; flex-direction: column; gap: 12px; padding: 12px; border-top: 1px solid var(--dsw-alias-border-l2); font-size: 12px; line-height: 1.55; }
.dshLiveTeamsTaskDetail h4 { margin: 0 0 5px; font-size: 12px; }
.dshLiveTeamsTaskDetail p { margin: 0; }
.dshLiveTeamsTaskDetail pre { max-height: 320px; margin: 0; overflow-y: auto; padding: 8px; white-space: pre-wrap; overflow-wrap: anywhere; background: var(--dsw-alias-bg-layer-1); border-radius: 6px; font: inherit; }
.dshLiveTeamsTaskDetail ul, .dshLiveTeamsTaskDetail ol { margin: 4px 0 0; padding-left: 20px; }
.dshLiveTeamsTaskFacts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 0; }
.dshLiveTeamsTaskFacts dt { color: var(--dsw-alias-label-tertiary); font-size: 11px; font-weight: 600; }
.dshLiveTeamsTaskFacts dd { margin: 3px 0 0; }
.dshLiveTeamsTaskActions { display: flex; flex-wrap: wrap; gap: 8px; }
.dshLiveTeamsTaskInput { box-sizing: border-box; width: 100%; min-height: 72px; resize: vertical; padding: 7px 8px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 7px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); font: inherit; }
.dshLiveTeamsNarrowPanel { min-width: 0; }

.dshLiveTeamsSummary {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dshLiveTeamsSummaryGrid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(108px, 1fr));
  margin: 0;
  gap: 6px;
}

.dshLiveTeamsStat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 6px 3px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2);
  text-align: center;
}

.dshLiveTeamsStat dt,
.dshLiveTeamsStat dd {
  margin: 0;
}

.dshLiveTeamsStatValue {
  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.dshLiveTeamsStatLabel {
  overflow: hidden;
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dshLiveTeamsNotice,
.dshLiveTeamsMessage {
  margin: 0;
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 20px;
}

.dshLiveTeamsNotice {
  padding: 9px 12px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2);
}

.dshLiveTeamsRoles {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2);
}

.dshLiveTeamsRoleActions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.dshLiveTeamsRoleList {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dshLiveTeamsRoleRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
  padding: 7px 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 7px;
  background: var(--dsw-alias-bg-layer-1);
}

.dshLiveTeamsRoleIdentity {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
  min-width: 0;
}

.dshLiveTeamsRoleName {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dshLiveTeamsRoleState {
  flex: none;
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  line-height: 16px;
}

.dshLiveTeamsRoles h4 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.dshLiveTeamsComposer {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dshLiveTeamsComposer textarea {
  box-sizing: border-box;
  width: 100%;
  min-height: 72px;
  resize: vertical;
  padding: 7px 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 7px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
}

.dshLiveTeamsComposer select {
  box-sizing: border-box;
  width: 100%;
  height: 32px;
  padding: 5px 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 7px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
}

.dshLiveTeamsInboxList {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dshLiveTeamsInboxRow {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 9px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 7px;
  background: var(--dsw-alias-bg-layer-2);
}

.dshLiveTeamsInboxRow p { margin: 4px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.dshLiveTeamsInboxKind,
.dshLiveTeamsInboxAcknowledged { display: block; color: var(--dsw-alias-label-secondary); font-size: 11px; }

.dshLiveTeamsMembers {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dshLiveTeamsMembers > .dshLiveTeamsWorkspacePath {
  margin: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  overflow-wrap: anywhere;
}

.dshLiveTeamsAdoptionList {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dshLiveTeamsAdoptionRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 7px;
  background: var(--dsw-alias-bg-layer-2);
}

.dshLiveTeamsTeamToggle {
  box-sizing: border-box;
  align-self: flex-start;
  padding: 6px 11px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 7px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: background-color var(--ds-transition-duration, .2s) var(--ds-ease-in-out, ease-in-out);
}

.dshLiveTeamsTeamToggle:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
}

.dshLiveTeamsTeamToggle:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.dshLiveTeamsAddButton {
  align-self: flex-start;
}

.dshLiveTeamsAddButton {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 5px 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 7px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  cursor: pointer;
}

.dshLiveTeamsAddButton:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
}

.dshLiveTeamsAddForm {
  display: flex;
  flex-direction: column;
  gap: 14px;
  /*
   * The add-member dialog holds a Session picker whose length is unbounded (a workspace keeps every
   * Session it ever ran; 20+ candidates on a real team). Scrolling the *form* rather than the list
   * keeps one scrollbar, and the primitive Modal's footer — with the create button — stays reachable
   * because it lives outside this form.
   */
  max-height: min(60vh, 520px);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-inline: 2px;
  scrollbar-gutter: stable;
}

.dshLiveTeamsCandidateList {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.dshLiveTeamsCandidate {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
  padding: 7px 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 7px;
  cursor: pointer;
}

.dshLiveTeamsCandidate:has(input:checked) {
  border-color: var(--dsw-alias-state-business-primary);
  background: var(--dsw-alias-bg-layer-2);
}

.dshLiveTeamsCandidateCopy {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
}

.dshLiveTeamsCandidateCopy strong,
.dshLiveTeamsCandidateCopy span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dshLiveTeamsCandidateCopy strong {
  font-weight: 600;
}

.dshLiveTeamsCandidateCopy span {
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
}

.dshLiveTeamsModalField {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* The container the task form puts its fields in: without it the dialog had no vertical rhythm. */
.dshLiveTeamsModalFields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* One box for every control in a dialog. Selects and textareas used to be left native, which is
   why the create-task form looked like a browser form next to the rest of the panel. */
.dshLiveTeamsModalField input,
.dshLiveTeamsModalField select,
.dshLiveTeamsModalField textarea {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  height: 32px;
  padding: 5px 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 7px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
}

.dshLiveTeamsModalField textarea {
  height: auto;
  min-height: 64px;
  padding: 6px 8px;
  line-height: 18px;
  resize: vertical;
}

.dshLiveTeamsModalField select {
  /* The platform arrow is kept: a custom one would need an asset, and every other select in this
     panel is native too. What matters is the box, and that is now the same as the inputs. */
  cursor: pointer;
}

.dshLiveTeamsRows {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(270px, 100%), 1fr));
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dshLiveTeamsRow {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  padding: 13px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-2);
}

.dshLiveTeamsMemberHeading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.dshLiveTeamsMemberIdentity {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.dshLiveTeamsNameLine {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dshLiveTeamsEditNameButton {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 4px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--ds-transition-duration, .2s) var(--ds-ease-in-out, ease-in-out), background-color var(--ds-transition-duration, .2s) var(--ds-ease-in-out, ease-in-out), color var(--ds-transition-duration, .2s) var(--ds-ease-in-out, ease-in-out);
}

.dshLiveTeamsRow:hover .dshLiveTeamsEditNameButton,
.dshLiveTeamsRow:focus-within .dshLiveTeamsEditNameButton,
.dshLiveTeamsEditNameButton:focus-visible {
  opacity: 1;
}

.dshLiveTeamsEditNameButton:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

.dshLiveTeamsInterruptButton,
.dshLiveTeamsMemberRemove {
  appearance: none;
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 3px 7px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-state-error-primary);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.dshLiveTeamsInterruptButton {
  color: var(--dsw-alias-state-warn-primary);
}

.dshLiveTeamsInterruptButton:hover:not(:disabled),
.dshLiveTeamsMemberRemove:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
}

.dshLiveTeamsInterruptButton:disabled,
.dshLiveTeamsMemberRemove:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.dshLiveTeamsNameInput {
  box-sizing: border-box;
  min-width: 0;
  width: min(100%, 220px);
  height: 28px;
  padding: 4px 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 7px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  line-height: 18px;
}

.dshLiveTeamsNameActions {
  display: inline-flex;
  flex: none;
  gap: 6px;
}

.dshLiveTeamsFieldError {
  margin: 2px 0 0;
  color: var(--dsw-alias-state-error-primary);
  font-size: 11px;
  line-height: 16px;
}

.dshLiveTeamsMemberAction {
  appearance: none;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.dshLiveTeamsMemberAction:hover:not(:disabled) strong,
.dshLiveTeamsMemberAction:focus-visible strong {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.dshLiveTeamsMemberAction:disabled {
  color: var(--dsw-alias-label-secondary);
}

.dshLiveTeamsMemberName {
  display: block;
  overflow: hidden;
  font-size: 15px;
  font-weight: 600;
  line-height: 21px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dshLiveTeamsState {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
}

.dshLiveTeamsStateDot {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 10px;
  height: 18px;
}

.dshLiveTeamsStateLabel {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dshLiveTeamsControls {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  min-width: 0;
}

.dshLiveTeamsRoleField {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.dshLiveTeamsFieldLabel {
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
}

.dshLiveTeamsRoleInput {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  height: 28px;
  padding: 4px 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 7px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  line-height: 18px;
}

.dshLiveTeamsApply {
  flex: none;
}

.dshLiveTeamsAvailabilityTag {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dshLiveTeamsMemberMeta {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 5px 10px;
  padding-top: 10px;
  border-top: 1px solid var(--dsw-alias-border-l2);
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
}

.dshLiveTeamsMetaValue {
  min-width: 0;
  overflow-wrap: anywhere;
}

.dshLiveTeamsVisuallyHidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.dshLiveTeamsRoster {
  position: relative;
  min-width: 0;
}

/*
 * The attention chip sits in the Session header, where every other control is a
 * quiet icon button. It is the one thing there that must be noticed, so it is the
 * only one allowed a filled background — and only while someone is waiting.
 */
.dshLiveTeamsAttention {
  box-sizing: border-box;
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 220px;
  min-width: 0;
  padding: 3px 9px;
  border: 1px solid var(--dsw-alias-state-warn-primary);
  border-radius: 999px;
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 12%, transparent);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  cursor: pointer;
}

.dshLiveTeamsAttention:hover {
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 20%, transparent);
}

.dshLiveTeamsAttention:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: 2px;
}

.dshLiveTeamsAttentionBusy {
  cursor: progress;
  opacity: 0.7;
}

.dshLiveTeamsAttentionDot {
  flex: none;
  color: var(--dsw-alias-state-warn-primary);
  font-size: 9px;
  line-height: 1;
}

.dshLiveTeamsAttentionName {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}

.dshLiveTeamsAttentionMore,
.dshLiveTeamsAttentionCount {
  flex: none;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.dshLiveTeamsRosterEntry {
  box-sizing: border-box;
  appearance: none;
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  gap: 7px;
  padding: 7px 8px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--ds-transition-duration, .2s) var(--ds-ease-in-out, ease-in-out), border-color var(--ds-transition-duration, .2s) var(--ds-ease-in-out, ease-in-out);
}

.dshLiveTeamsRosterEntry:hover,
.dshLiveTeamsRosterEntry:focus-visible {
  border-color: var(--dsw-alias-border-l2);
  background: var(--dsw-alias-interactive-bg-hover);
}

.dshLiveTeamsRosterEntry:focus-visible,
.dshLiveTeamsRosterRow:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: 2px;
}

.dshLiveTeamsRosterMark {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 16px;
  color: var(--dsw-alias-brand-primary);
  font-size: 12px;
}

.dshLiveTeamsRosterTeam {
  min-width: 0;
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dshLiveTeamsRosterSummary {
  flex: none;
  margin-left: auto;
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  white-space: nowrap;
}

.dshLiveTeamsRosterPopover {
  position: absolute;
  z-index: 10;
  left: 0;
  bottom: calc(100% + 6px);
  box-sizing: border-box;
  width: min(300px, calc(100vw - 24px));
  max-height: min(360px, calc(100vh - 24px));
  padding: 6px;
  overflow-x: hidden;
  overflow-y: auto;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2);
  box-shadow: var(--ds-shadow-lv3, var(--ds-shadow-lv2));
  color: var(--dsw-alias-label-primary);
}

.dshLiveTeamsRosterList {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dshLiveTeamsRosterListItem {
  min-width: 0;
}

.dshLiveTeamsRosterRow {
  box-sizing: border-box;
  appearance: none;
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  gap: 8px;
  padding: 7px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--ds-transition-duration, .2s) var(--ds-ease-in-out, ease-in-out);
}

.dshLiveTeamsRosterRow:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}

.dshLiveTeamsRosterRowUnbound {
  cursor: default;
  color: var(--dsw-alias-label-secondary);
}

.dshLiveTeamsRosterRowUnbound:hover {
  background: transparent;
}

.dshLiveTeamsRosterName {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dshLiveTeamsRosterMarker {
  display: inline-block;
  flex: none;
  width: 8px;
  height: 8px;
  margin-left: auto;
  border-radius: 50%;
  background: var(--dsw-alias-label-tertiary);
}

.dshLiveTeamsRosterMarker[data-state="live"] {
  background: var(--dsw-alias-state-success-primary);
}

.dshLiveTeamsRosterMarker[data-state="paused"] {
  background: var(--dsw-alias-state-warn-primary);
}

.dshLiveTeamsRosterMarker[data-state="not-live"] {
  background: var(--dsw-alias-state-error-primary);
}

/* B25.1: the actual rendered dsh-context cascade is its compact root-qualified
   shell. These rules intentionally override the earlier generic component rules. */
.dshLiveTeamsRoot .dshLiveTeamsCard {
  box-sizing: border-box;
  margin-bottom: 7px;
  padding: 7px 8px;
  container: dshLiveTeamsCard / inline-size;
}
.dshLiveTeamsShell { min-width: 0; }
.dshLiveTeamsRoot .dshLiveTeamsCols {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-bottom: 7px;
}
.dshLiveTeamsHead > .dshLiveTeamsCard,
.dshLiveTeamsMain > .dshLiveTeamsCol {
  flex: 1;
  min-width: min(360px, 100%);
}
.dshLiveTeamsCol { min-width: 0; }
.dshLiveTeamsCol > .dshLiveTeamsCard:last-child { margin-bottom: 0; }
.dshLiveTeamsMembers { width: 100%; }

.dshLiveTeamsCardTitle {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 10px;
  font-weight: 600;
}
.dshLiveTeamsCardTitleText { flex: none; margin: 0; font-size: 13px; white-space: nowrap; }
.dshLiveTeamsSegmented {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  margin-left: auto;
  padding: 1px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  background: var(--dsw-alias-bg-layer-2);
}
/* The action sits in the segmented row, so it is shaped like the segments rather than like a
   standalone outline button (the human saw it sticking out of the row). */
.dshLiveTeamsTaskNew {
  padding: 3px 10px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 5px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
}

.dshLiveTeamsTaskNew:hover {
  color: var(--dsw-alias-label-primary);
  border-color: var(--dsw-alias-border-l1);
}

.dshLiveTeamsSegmentedButton {
  padding: 3px 8px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
  transition: color var(--ds-transition-duration, .2s) var(--ds-ease-in-out, ease-in-out);
}
.dshLiveTeamsSegmentedButton:hover { color: var(--dsw-alias-label-primary); }
.dshLiveTeamsSegmentedButtonActive,
.dshLiveTeamsSegmentedButtonActive:hover {
  background: var(--dsw-alias-button-primary-fill);
  color: var(--dsw-alias-label-primary-foreground);
}
.dshLiveTeamsTaskFilter { margin-top: 0; margin-bottom: 0; }
.dshLiveTeamsKindCount { margin-left: 4px; opacity: .65; font-variant-numeric: tabular-nums; }
.dshLiveTeamsSegmentedButtonActive .dshLiveTeamsKindCount { opacity: .85; }

.dshLiveTeamsTeamControls { display: flex; flex-direction: column; gap: 7px; }
.dshLiveTeamsTeamControls .dshLiveTeamsHeader { align-items: center; gap: 7px; }
.dshLiveTeamsTeamControls .dshLiveTeamsHeaderCopy { flex: 1; }
.dshLiveTeamsTeamControls .dshLiveTeamsLeadControl { flex-direction: row; align-items: center; margin-left: auto; }
.dshLiveTeamsTeamControls .dshLiveTeamsLeadControl select { height: 26px; }
.dshLiveTeamsTeamControls .dshLiveTeamsTeamToggle { align-self: center; padding: 4px 8px; font-size: 11px; }
.dshLiveTeamsBriefing,
.dshLiveTeamsControlDisclosure { padding-top: 7px; border-top: 1px solid var(--dsw-alias-border-l2); }
.dshLiveTeamsBriefing > .dshLiveTeamsAddButton { margin-top: 5px; }

.dshLiveTeamsJournal { gap: 0; }
.dshLiveTeamsJournalFilters { max-width: 100%; }
.dshLiveTeamsJournalRow { flex-wrap: wrap; gap: 8px; padding: 3px 0; }
.dshLiveTeamsJournalIcon { width: 18px; }
.dshLiveTeamsJournalDetail { box-sizing: border-box; width: 100%; padding-left: 26px; }
.dshLiveTeamsJournalKind-message { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 15%, transparent); color: var(--dsw-alias-brand-primary); }
.dshLiveTeamsJournalKind-delivery { background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 15%, transparent); color: var(--dsw-alias-state-success-primary); }
.dshLiveTeamsJournalKind-task { background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 15%, transparent); color: var(--dsw-alias-state-warn-primary); }
.dshLiveTeamsJournalKind-review { background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 15%, transparent); color: var(--dsw-alias-state-error-primary); }
.dshLiveTeamsJournalKind-contact,
.dshLiveTeamsJournalKind-team,
.dshLiveTeamsJournalKind-member,
.dshLiveTeamsJournalKind-other { background: color-mix(in srgb, var(--dsw-alias-label-secondary) 15%, transparent); color: var(--dsw-alias-label-secondary); }

.dshLiveTeamsTasks .dshLiveTeamsTaskList { gap: 4px; }
.dshLiveTeamsTasks .dshLiveTeamsTaskRow { border-radius: 8px; }
.dshLiveTeamsTasks .dshLiveTeamsTaskSummary { padding: 7px 10px; }

.dshLiveTeamsMembers { gap: 7px; }
.dshLiveTeamsMembers > .dshLiveTeamsSectionHeader { flex-direction: row; align-items: baseline; }
.dshLiveTeamsMembers > .dshLiveTeamsSectionHeader .dshLiveTeamsSectionCaption { display: none; }
.dshLiveTeamsMembers > .dshLiveTeamsAddButton { margin-top: -35px; margin-left: auto; }
.dshLiveTeamsRows {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.dshLiveTeamsRows > .dshLiveTeamsRow {
  flex: 1 1 150px;
  min-width: 150px;
  max-width: 190px;
}

.dshLiveTeamsRow {
  gap: 7px;
  padding: 6px 8px;
  border-radius: 8px;
}
.dshLiveTeamsRow {
  border-top: 2px solid var(--dsh-live-team-role-accent, var(--dsw-alias-border-l2));
  background: color-mix(in srgb, var(--dsh-live-team-role-accent, var(--dsw-alias-label-secondary)) 5%, var(--dsw-alias-bg-layer-2));
  transition: border-color var(--ds-transition-duration, .2s) var(--ds-ease-in-out, ease-in-out), background-color var(--ds-transition-duration, .2s) var(--ds-ease-in-out, ease-in-out);
}
.dshLiveTeamsRow[data-role="lead"],
.dshLiveTeamsMemberPanel[data-role="lead"] { --dsh-live-team-role-accent: var(--dsw-alias-state-error-primary); }
.dshLiveTeamsRow[data-role="oracle"],
.dshLiveTeamsMemberPanel[data-role="oracle"] { --dsh-live-team-role-accent: color-mix(in srgb, var(--dsw-alias-brand-primary) 58%, var(--dsw-alias-state-error-primary)); }
.dshLiveTeamsRow[data-role="verifier"],
.dshLiveTeamsMemberPanel[data-role="verifier"] { --dsh-live-team-role-accent: var(--dsw-alias-state-warn-primary); }
.dshLiveTeamsRow[data-role="builder"],
.dshLiveTeamsMemberPanel[data-role="builder"] { --dsh-live-team-role-accent: var(--dsw-alias-brand-primary); }
.dshLiveTeamsRowSelected {
  z-index: 1;
  box-shadow: 0 0 0 1px var(--dsh-live-team-role-accent, var(--dsw-alias-border-l2));
}
.dshLiveTeamsRowSelected details { min-width: 0; }

/* The unfolding controls of the selected member. They live outside the ribbon so
   the compact cells never move or stretch; the accent ties the panel to its
   card. Everything sits on one compact grid instead of a tall stack. */
.dshLiveTeamsMemberPanel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  margin-top: 6px;
  padding: 7px 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-left: 2px solid var(--dsh-live-team-role-accent, var(--dsw-alias-border-l2));
  border-radius: 8px;
  background: color-mix(in srgb, var(--dsh-live-team-role-accent, var(--dsw-alias-label-secondary)) 5%, var(--dsw-alias-bg-layer-2));
  font-size: 12px;
}
.dshLiveTeamsMemberPanel > .dshLiveTeamsMemberHeading,
.dshLiveTeamsMemberPanel > .dshLiveTeamsMemberMeta,
.dshLiveTeamsMemberPanel > .dshLiveTeamsFieldError { flex: 1 1 100%; }
.dshLiveTeamsMemberPanel > .dshLiveTeamsControls,
.dshLiveTeamsMemberPanel > .dshLiveTeamsContactGrant { flex: 1 1 300px; }
.dshLiveTeamsMemberPanel .dshLiveTeamsMemberHeading { gap: 8px; align-items: center; }
.dshLiveTeamsMemberPanel .dshLiveTeamsMemberIdentity { flex-direction: row; flex-wrap: nowrap; align-items: center; gap: 6px; min-width: 0; }
/* A fixed basis keeps Save/Cancel on the same line as the field they save. */
.dshLiveTeamsMemberPanel .dshLiveTeamsNameInput { flex: 0 1 200px; width: auto; min-width: 120px; }
/* The state keeps its width: the field shrinks first. */
.dshLiveTeamsMemberPanel .dshLiveTeamsMemberIdentity > .dshLiveTeamsState { flex: none; }
.dshLiveTeamsMemberPanel .dshLiveTeamsMemberActions { align-items: center; gap: 6px; margin-left: auto; }
.dshLiveTeamsMemberPanel .dshLiveTeamsEditNameButton { opacity: 1; }
/* flex-end keeps Apply level with the select, not with the label above it. */
.dshLiveTeamsMemberPanel .dshLiveTeamsControls { flex-wrap: wrap; align-items: flex-end; gap: 8px; }
.dshLiveTeamsMemberPanel .dshLiveTeamsRoleField { flex: 0 1 160px; }
.dshLiveTeamsMemberPanel .dshLiveTeamsContactGrant { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; }
.dshLiveTeamsContactSelect { flex: 0 1 190px; width: auto; }
.dshLiveTeamsMemberPanel .dshLiveTeamsMemberMeta { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 6px; padding-top: 6px; }
.dshLiveTeamsMemberPanel .dshLiveTeamsMemberMeta .dshLiveTeamsMemberRemove { margin-left: auto; }
.dshLiveTeamsMemberActions { display: flex; flex: none; align-items: center; gap: 4px; }
.dshLiveTeamsMemberCollapsed { align-items: flex-start; flex-wrap: wrap; gap: 4px 6px; padding: 0; }
.dshLiveTeamsMemberCollapsed .dshLiveTeamsDisclosure { margin-top: 1px; }
.dshLiveTeamsMemberCollapsed .dshLiveTeamsMemberName { flex: 1; min-width: 72px; }
.dshLiveTeamsMemberNote { flex-basis: calc(100% - 20px); margin-left: 20px; }

.dshLiveTeamsComposer { gap: 7px; margin-bottom: 7px; }
.dshLiveTeamsInboxList { gap: 0; }
.dshLiveTeamsInboxRow { padding: 5px 0; border: 0; border-bottom: 1px solid var(--dsw-alias-border-l1); border-radius: 0; background: transparent; font-size: 12px; }
.dshLiveTeamsInboxRow:last-child { border-bottom: 0; }

@media (max-width: 700px) {
  .dshLiveTeamsCols { flex-direction: column; }
  .dshLiveTeamsHead > .dshLiveTeamsCard,
  .dshLiveTeamsMain > .dshLiveTeamsCol { min-width: 0; }
}

@container dshLiveTeamsCard (max-width: 380px) {
  .dshLiveTeamsCardTitle { align-items: flex-start; }
  .dshLiveTeamsSegmented { width: 100%; margin-left: 0; }
  .dshLiveTeamsJournalRefs { display: none; }
}

@container dshLiveTeamsCard (max-width: 700px) {
  .dshLiveTeamsTaskSummary { grid-template-columns: 14px auto minmax(0, 1fr) 36px 42px; }
  .dshLiveTeamsTaskRoute { grid-column: 3 / -1; }
  .dshLiveTeamsTaskFacts { grid-template-columns: 1fr; }
}

@container dshLiveTeamsCard (max-width: 480px) {
  .dshLiveTeamsHeader {
    flex-wrap: wrap;
  }

  .dshLiveTeamsHeader .dshLiveTeamsIconButton {
    margin-left: auto;
  }

  .dshLiveTeamsControls {
    align-items: stretch;
    flex-wrap: wrap;
  }

  .dshLiveTeamsRoleField {
    flex-basis: calc(100% - 88px);
  }
}
/* A journal row is a button so it can be unfolded: the line keeps the old layout, and the panel
   below it is what a person reads when the one-line summary is not enough. */
.dshLiveTeamsJournalLine {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.dshLiveTeamsJournalLine:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 2px;
  border-radius: 4px;
}

.dshLiveTeamsJournalDisclosure {
  display: inline-flex;
  align-items: center;
  color: var(--dsw-alias-label-tertiary);
  transition: transform var(--ds-transition-duration, .2s) var(--ds-ease-in-out, ease-in-out);
}

.dshLiveTeamsJournalDisclosureOpen {
  transform: rotate(180deg);
}

.dshLiveTeamsJournalDetailPanel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex-basis: 100%;
  margin: 6px 0 2px 18px;
  padding: 10px 12px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2);
}

.dshLiveTeamsJournalFields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
  gap: 6px 14px;
  margin: 0;
}

.dshLiveTeamsJournalField {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.dshLiveTeamsJournalField dt {
  color: var(--dsw-alias-label-tertiary);
  font-size: 10px;
  font-weight: 600;
  line-height: 14px;
  text-transform: uppercase;
  letter-spacing: .04em;
}

.dshLiveTeamsJournalField dd {
  margin: 0;
  color: var(--dsw-alias-label-primary);
  font-size: 12px;
  line-height: 16px;
  overflow-wrap: anywhere;
}

.dshLiveTeamsJournalBody {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.dshLiveTeamsJournalBodyHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.dshLiveTeamsJournalRawToggle {
  padding: 2px 6px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 5px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  font: inherit;
  font-size: 10px;
  line-height: 1;
  cursor: pointer;
}

.dshLiveTeamsJournalRawToggle:hover {
  color: var(--dsw-alias-label-primary);
}

.dshLiveTeamsJournalRaw {
  margin: 0;
  padding: 8px;
  border-radius: 6px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font-family: var(--dsw-font-mono, ui-monospace, monospace);
  font-size: 11px;
  line-height: 16px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

/* The markdown component renders at the application's reading size (14px base, 21px headings),
   which is right for a chat message and too big for a journal row. It takes its sizes from font
   tokens, so the journal re-points the tokens instead of fighting its selectors. */
.dshLiveTeamsJournalMarkdown {
  --dsh-content-font-size: 11px;
  --dsh-content-font-delta: -2px;
  --dsh-content-font-size-secondary: 10px;
  --dsh-content-font-delta-secondary: -2px;
  --dsw-font-markdown-base: var(--dsh-content-font-size) / 16px var(--dsw-font-family);
  --dsw-font-markdown-small: 10px / 15px var(--dsw-font-family);
  --dsw-font-markdown-code: 10px / 15px var(--ds-font-family-code);
  --dsw-font-markdown-table: var(--dsh-content-font-size-secondary) / 15px var(--dsw-font-family);
  --dsw-font-markdown-h1: 700 14px / 20px var(--dsw-font-family);
  --dsw-font-markdown-h2: 700 13px / 19px var(--dsw-font-family);
  --dsw-font-markdown-h3: 700 12px / 18px var(--dsw-font-family);
  --dsw-font-markdown-h4: 600 11px / 17px var(--dsw-font-family);
  min-width: 0;
  color: var(--dsw-alias-label-primary);
  font-size: 11px;
  line-height: 16px;
}

/* Headings inside a journal row must not push the row apart. */
.dshLiveTeamsJournalMarkdown :where(h1, h2, h3, h4, h5, h6) {
  margin: 8px 0 4px;
}

.dshLiveTeamsJournalMarkdown :where(p, ul, ol) {
  margin: 6px 0;
}

.dshLiveTeamsJournalTaskLine {
  margin: 0;
  color: var(--dsw-alias-label-primary);
  font-size: 12px;
  line-height: 16px;
}

.dshLiveTeamsJournalAcceptance {
  margin: 0;
  padding-left: 18px;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 17px;
}

.dshLiveTeamsJournalPending {
  margin: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 16px;
}

/* The inbox is a list of things waiting for the human, so it lives in the journal header as one
   control that opens over the panel — the journal is what a person reads, and a second card for
   messages took the height it needed. */
.dshLiveTeamsJournalControls {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.dshLiveTeamsInboxButton {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 5px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
}

.dshLiveTeamsInboxButton:hover {
  color: var(--dsw-alias-label-primary);
  border-color: var(--dsw-alias-border-l1);
}

.dshLiveTeamsInboxButtonUnread {
  border-color: var(--dsw-alias-border-primary);
  color: var(--dsw-alias-label-primary);
}

.dshLiveTeamsInboxCount {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 15px;
  height: 15px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--dsw-alias-button-primary-fill);
  color: var(--dsw-alias-label-primary-foreground);
  font-size: 10px;
  font-weight: 600;
}

/* The application's Modal is a small-confirmation card (380px), and an agent's report is not a
   confirmation: the inbox opens in a panel wide enough to read one. */
.dshLiveTeamsOverlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--dsw-alias-bg-mask-1);
  backdrop-filter: var(--dsw-mask-blur);
}

.dshLiveTeamsDialog {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: min(760px, 92vw);
  max-height: 84vh;
  padding: 16px 20px 20px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  box-shadow: 0 12px 32px var(--dsw-alias-bg-mask-drop);
}

.dshLiveTeamsDialogHead {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-right: 28px;
}

.dshLiveTeamsDialogTitle {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.dshLiveTeamsDialogDescription {
  margin: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 16px;
}

.dshLiveTeamsDialogClose {
  position: absolute;
  top: -2px;
  right: -4px;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

.dshLiveTeamsDialogClose:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

.dshLiveTeamsDialogBody {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  overflow-y: auto;
}

.dshLiveTeamsCompatibility {
  margin: 0 0 12px;
  padding: 8px 10px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 17px;
}

.dshLiveTeamsCompatibilityBad {
  border-color: var(--dsw-alias-border-primary);
  color: var(--dsw-alias-label-primary);
}

.dshLiveTeamsPanelError {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border: 1px solid var(--dsw-alias-border-primary);
  border-radius: 8px;
  font-size: 12px;
  line-height: 17px;
}

.dshLiveTeamsPanelError p {
  margin: 0;
}

.dshLiveTeamsPanelErrorHint {
  color: var(--dsw-alias-label-secondary);
}

.dshLiveTeamsPanelErrorStack {
  margin: 0;
  max-height: 120px;
  overflow: auto;
  font-size: 11px;
  white-space: pre-wrap;
  color: var(--dsw-alias-label-secondary);
}

/* Task-first Team: visual hierarchy matched to the approved mockup; no host theme overrides. */
.dshLiveTeamsTaskFirst { --dsh-team-accent: var(--dsw-alias-state-business-primary, rgb(237 135 83)); padding: 14px 18px 28px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsShell { display: flex; flex-direction: column; gap: 12px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsHead { min-width: 0; }
.dshLiveTeamsTaskFirst .dshLiveTeamsMain { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsMain > .dshLiveTeamsCard { width: 100%; margin: 0; padding: 14px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsCard { border-color: color-mix(in srgb, var(--dsw-alias-border-l2) 78%, transparent); border-radius: 9px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsSummary { display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; gap: 12px 24px; margin: 0; padding: 12px 16px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsSummary > .dshLiveTeamsSectionHeader { flex: 0 1 auto; }
.dshLiveTeamsTaskFirst .dshLiveTeamsSummary h2 { display: flex; align-items: center; gap: 10px; margin: 0; font-size: 17px; font-weight: 600; line-height: 24px; overflow-wrap: anywhere; }
.dshLiveTeamsTaskFirst .dshLiveTeamsSummary h2::before { content: ''; width: 9px; height: 9px; flex: none; border-radius: 50%; background: var(--dsw-alias-state-success-primary, rgb(69 189 123)); }
.dshLiveTeamsTaskFirst .dshLiveTeamsSummaryGrid { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 0; }
.dshLiveTeamsTaskFirst .dshLiveTeamsStat { display: flex; flex-direction: row-reverse; align-items: baseline; gap: 4px; padding: 0; min-height: 0; border: 0; background: transparent; }
.dshLiveTeamsTaskFirst .dshLiveTeamsStat[hidden] { display: none; }
.dshLiveTeamsTaskFirst .dshLiveTeamsStatLabel { font-size: 11px; font-weight: 400; line-height: 18px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsStatValue { margin: 0; font-size: 11px; line-height: 18px; font-weight: 500; color: var(--dsw-alias-label-secondary); }
.dshLiveTeamsOverviewActions { display: flex; align-items: center; gap: 10px; margin-left: auto; }
.dshLiveTeamsSettingsToggle { display: inline-flex; align-items: center; gap: 7px; padding: 6px 11px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px; background: color-mix(in srgb, var(--dsw-alias-label-primary) 3%, transparent); color: var(--dsw-alias-label-primary); font: inherit; font-size: 11px; cursor: pointer; }
.dshLiveTeamsSettingsToggle svg { width: 14px; height: 14px; }
.dshLiveTeamsSettingsToggle:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dshLiveTeamsTaskFirst .dshLiveTeamsCardTitle { align-items: center; gap: 18px; margin-bottom: 12px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsCardTitleText { font-size: 14px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsTaskControls { display: contents; }
.dshLiveTeamsTaskFirst .dshLiveTeamsTaskFilter { order: 1; gap: 12px; margin: 0 auto 0 0; border: 0; padding: 0; background: none; }
.dshLiveTeamsTaskFirst .dshLiveTeamsTaskFilterButton { border-radius: 0; padding: 7px 3px; border-bottom: 2px solid transparent; background: none; font-size: 11px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsTaskFilterButtonActive { color: var(--dsw-alias-label-primary); background: none; border-bottom-color: var(--dsh-team-accent); }
.dshLiveTeamsTaskFirst .dshLiveTeamsDispatchToggle { order: 2; font-size: 10px; opacity: .8; }
.dshLiveTeamsTaskFirst .dshLiveTeamsTaskNew { display: inline-flex; align-items: center; justify-content: center; gap: 5px; order: 3; padding: 7px 11px; border: 1px solid color-mix(in srgb, var(--dsh-team-accent) 75%, white); border-radius: 6px; background: var(--dsh-team-accent); color: rgb(30 21 16); font-size: 11px; font-weight: 600; }
.dshLiveTeamsTaskFirst .dshLiveTeamsTaskNew:hover:not(:disabled) { background: rgb(244 155 112); color: rgb(30 21 16); }
.dshLiveTeamsTaskFirst .dshLiveTeamsTaskList { gap: 7px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsTaskRow { background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 75%, var(--dsw-alias-bg-layer-2)); border-color: color-mix(in srgb, var(--dsw-alias-border-l2) 75%, transparent); }
.dshLiveTeamsTaskFirst .dshLiveTeamsTaskSummary { display: grid; grid-template-columns: 32px minmax(0, 1fr) minmax(90px, 130px) minmax(115px, 160px) 30px 86px; align-items: center; gap: 14px; padding: 14px 12px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsTaskDisclosure { position: relative; width: 32px; height: 34px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 7px; background: rgb(255 255 255 / 4%); transform: none; }
.dshLiveTeamsTaskChevron { position: absolute; right: -5px; bottom: -2px; display: flex; background: var(--dsw-alias-bg-layer-1); border-radius: 50%; }
.dshLiveTeamsTaskDisclosureOpen .dshLiveTeamsTaskChevron { transform: rotate(180deg); }
.dshLiveTeamsMemberCount { color: var(--dsw-alias-label-tertiary); font-size: 11px; font-weight: 400; }
.dshLiveTeamsTaskIdentity { display: flex; flex-direction: column; min-width: 0; gap: 6px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsTaskTitle { white-space: normal; overflow-wrap: anywhere; font-size: 13px; font-weight: 550; line-height: 19px; }
.dshLiveTeamsTaskMetadata { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; min-width: 0; }
.dshLiveTeamsTaskFirst .dshLiveTeamsTaskRoute { grid-column: auto; white-space: normal; overflow-wrap: anywhere; font-size: 11px; }
.dshLiveTeamsTaskOwner, .dshLiveTeamsTaskStage, .dshLiveTeamsTaskFirst .dshLiveTeamsTaskAge { display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 6px; min-width: 0; font-size: 12px; text-align: left; }
.dshLiveTeamsTaskOwner > span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
.dshLiveTeamsTaskOwner small, .dshLiveTeamsTaskStage small, .dshLiveTeamsTaskAge small { color: var(--dsw-alias-label-tertiary); font-size: 10px; font-weight: 400; }
.dshLiveTeamsTaskFirst .dshLiveTeamsTaskStatus { padding: 4px 7px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 5px; font-size: 10px; font-weight: 500; white-space: normal; }
.dshLiveTeamsTaskStage[data-status='in_progress'] .dshLiveTeamsTaskStatus { background: rgb(49 133 85 / 18%); border-color: rgb(83 171 121 / 25%); color: var(--dsw-alias-state-success-primary, rgb(145 210 174)); }
.dshLiveTeamsTaskStage[data-status='waiting'][data-route='review'] .dshLiveTeamsTaskStatus { background: rgb(113 80 168 / 22%); border-color: rgb(155 123 203 / 30%); color: rgb(199 178 236); }
.dshLiveTeamsTaskStage[data-status='needs_human'] .dshLiveTeamsTaskStatus { color: var(--dsw-alias-state-warn-primary, rgb(223 186 130)); border-color: rgb(193 148 77 / 30%); }
.dshLiveTeamsTaskFirst .dshLiveTeamsTaskQueued { max-width: 100%; white-space: normal; overflow-wrap: anywhere; }
.dshLiveTeamsTaskFirst .dshLiveTeamsTaskRound { color: var(--dsw-alias-label-tertiary); font-size: 10px; }
.dshLiveTeamsTaskEmpty { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 8px 12px; color: var(--dsw-alias-label-tertiary); border: 1px dashed color-mix(in srgb, var(--dsw-alias-border-l2) 75%, transparent); border-radius: 6px; }
.dshLiveTeamsTaskEmpty p { margin: 0; font-size: 12px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsMembers { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 12px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsMembers > .dshLiveTeamsAddButton { margin: 0; grid-column: 2; font-size: 11px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsMembers > .dshLiveTeamsMessage { grid-column: 1 / -1; }
.dshLiveTeamsTaskFirst .dshLiveTeamsRows { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(170px, 100%), 1fr)); gap: 8px; grid-column: 1 / -1; margin: 0; }
.dshLiveTeamsTaskFirst .dshLiveTeamsRows > .dshLiveTeamsRow { min-width: 0; max-width: none; padding: 0; border: 1px solid color-mix(in srgb, var(--dsw-alias-border-l2) 75%, transparent); border-radius: 7px; background: linear-gradient(145deg, rgb(255 255 255 / 2%), transparent), var(--dsw-alias-bg-layer-1); box-shadow: none; }
.dshLiveTeamsTaskFirst .dshLiveTeamsRowSelected { border-color: var(--dsh-team-accent); }
.dshLiveTeamsTaskFirst .dshLiveTeamsMemberCollapsed { display: grid; grid-template-columns: 32px minmax(0, 1fr) 10px; align-items: start; box-sizing: border-box; padding: 12px; gap: 6px 10px; border-radius: 7px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsMemberCollapsed:hover { background: rgb(255 255 255 / 3%); }
.dshLiveTeamsMemberAvatar { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border: 1px solid rgb(255 255 255 / 7%); border-radius: 50%; background: rgb(255 255 255 / 5%); color: var(--dsw-alias-label-secondary); }
/* Hue identifies declared responsibility only; Session liveness stays in its own indicator. */
.dshLiveTeamsMemberAvatar[data-agent-role='lead'] { --dsh-agent-hue: rgb(218 171 92); }
.dshLiveTeamsMemberAvatar[data-agent-role='builder'] { --dsh-agent-hue: rgb(109 159 226); }
.dshLiveTeamsMemberAvatar[data-agent-role='reviewer'] { --dsh-agent-hue: rgb(177 139 222); }
.dshLiveTeamsMemberAvatar[data-agent-role='verifier'] { --dsh-agent-hue: rgb(89 181 163); }
.dshLiveTeamsMemberAvatar[data-agent-role='oracle'] { --dsh-agent-hue: rgb(100 187 210); }
.dshLiveTeamsMemberAvatar[data-agent-role='researcher'] { --dsh-agent-hue: rgb(148 151 220); }
.dshLiveTeamsMemberAvatar[data-agent-role='scout'] { --dsh-agent-hue: rgb(217 151 112); }
.dshLiveTeamsMemberAvatar[data-agent-role='delegate'] { --dsh-agent-hue: rgb(143 164 186); }
.dshLiveTeamsMemberAvatar[data-agent-role]:not([data-agent-role='custom']) { color: color-mix(in srgb, var(--dsh-agent-hue) 78%, var(--dsw-alias-label-primary)); background: color-mix(in srgb, var(--dsh-agent-hue) 12%, var(--dsw-alias-bg-layer-1)); border-color: color-mix(in srgb, var(--dsh-agent-hue) 28%, transparent); }
.dshLiveTeamsMemberCopy { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.dshLiveTeamsTaskFirst .dshLiveTeamsMemberName { min-width: 0; font-weight: 550; overflow: hidden; text-overflow: ellipsis; }
.dshLiveTeamsTaskFirst .dshLiveTeamsMemberChip { align-self: flex-start; padding: 0; background: none; color: var(--dsw-alias-label-tertiary); font-weight: 400; font-size: 10px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsMemberLive { font-size: 10px; font-weight: 400; white-space: nowrap; }
.dshLiveTeamsTaskFirst .dshLiveTeamsMemberLiveOn { color: var(--dsw-alias-state-success-primary, rgb(113 195 149)); }
.dshLiveTeamsMemberMenu { color: var(--dsw-alias-label-tertiary); font-size: 17px; line-height: 16px; }
.dshLiveTeamsMemberPaused { grid-column: 2; color: rgb(216 179 124); font-size: 10px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsMemberTask { grid-column: 1 / -1; margin: 5px 0 0; padding-top: 9px; border-top: 1px solid color-mix(in srgb, var(--dsw-alias-border-l2) 65%, transparent); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 17px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsMemberNote { grid-column: 1 / -1; margin: 0; min-width: 0; font-size: 10px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsJournalList { max-height: min(65vh, 800px); gap: 0; }
.dshLiveTeamsTaskFirst .dshLiveTeamsJournalRow { padding: 9px 0; border-bottom: 1px solid color-mix(in srgb, var(--dsw-alias-border-l2) 65%, transparent); }
.dshLiveTeamsTaskFirst .dshLiveTeamsJournalRow:last-child { border-bottom: 0; }
.dshLiveTeamsActivityModes { display: flex; align-items: center; gap: 5px; margin-left: auto; padding: 0; }
.dshLiveTeamsTaskFirst .dshLiveTeamsActivityModes .dshLiveTeamsSegmentedButton { min-width: 60px; padding: 5px 12px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 18px; font-size: 10px; background: none; }
.dshLiveTeamsTaskFirst .dshLiveTeamsActivityModes .dshLiveTeamsSegmentedButtonActive { color: var(--dsh-team-accent); border-color: var(--dsh-team-accent); background: rgb(237 135 83 / 5%); }
.dshLiveTeamsActivityCategories { color: var(--dsw-alias-label-tertiary); font-size: 10px; }
.dshLiveTeamsActivityCategories > summary { cursor: pointer; padding: 5px; }
.dshLiveTeamsActivityCategories[open] { flex-basis: 100%; }
.dshLiveTeamsActivityCategories .dshLiveTeamsJournalFilters { justify-content: flex-start; margin: 6px 0 0; width: fit-content; }
.dshLiveTeamsTaskFirst .dshLiveTeamsJournalLine { position: relative; display: grid; width: 100%; grid-template-columns: 32px minmax(0, 1fr) auto 14px; gap: 3px 12px; align-items: center; }
.dshLiveTeamsTaskFirst .dshLiveTeamsJournalIcon { grid-column: 1; grid-row: 1 / 3; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; color: rgb(208 176 126); background: rgb(164 126 66 / 14%); }
.dshLiveTeamsTaskFirst .dshLiveTeamsJournalIcon-task { color: rgb(136 197 162); background: rgb(59 140 93 / 17%); }
.dshLiveTeamsTaskFirst .dshLiveTeamsJournalIcon-message { color: rgb(148 182 219); background: rgb(62 121 174 / 17%); }
.dshLiveTeamsTaskFirst .dshLiveTeamsJournalIcon-review { color: rgb(189 167 223); background: rgb(123 82 176 / 17%); }
.dshLiveTeamsTaskFirst .dshLiveTeamsJournalKind { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); padding: 0; border: 0; }
.dshLiveTeamsTaskFirst .dshLiveTeamsJournalSummary { grid-column: 2; grid-row: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; line-height: 19px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsJournalRefs { grid-column: 2; grid-row: 2; display: flex; align-items: center; gap: 7px; min-width: 0; overflow: hidden; color: var(--dsw-alias-label-tertiary); font-size: 11px; line-height: 17px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsJournalTaskRef { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dshLiveTeamsTaskFirst .dshLiveTeamsJournalRoundRef { flex: none; white-space: nowrap; font-size: 10px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsJournalTaskId { display: none; }
.dshLiveTeamsTaskFirst .dshLiveTeamsJournalTime { grid-column: 3; grid-row: 1 / 3; color: var(--dsw-alias-label-tertiary); font-size: 10px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsJournalDisclosure { grid-column: 4; grid-row: 1 / 3; }
.dshLiveTeamsJournalSourceSummary { margin: 0; white-space: normal; overflow-wrap: anywhere; }
.dshLiveTeamsDrawerBackdrop { position: fixed; inset: 0; z-index: 900; display: flex; justify-content: flex-end; background: rgb(0 0 0 / 38%); }
.dshLiveTeamsDrawer { display: flex; flex-direction: column; box-sizing: border-box; width: min(520px, 100%); height: 100%; padding-top: var(--dsh-frame-overlay-top, 0px); min-width: 0; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); border-left: 1px solid var(--dsw-alias-border-l2); box-shadow: -12px 0 40px rgb(0 0 0 / 18%); }
.dshLiveTeamsDrawerHeader { display: flex; flex: none; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 18px; border-bottom: 1px solid var(--dsw-alias-border-l2); }
.dshLiveTeamsDrawerHeader h3 { margin: 0; font-size: 14px; overflow-wrap: anywhere; }
.dshLiveTeamsDrawerHeader .dshLiveTeamsIconButton { font-size: 22px; }
.dshLiveTeamsDrawerBody { padding: 16px; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
.dshLiveTeamsDrawerBody > .dshLiveTeamsTeamControls { margin: 0; padding: 0; border: 0; background: transparent; }
.dshLiveTeamsDrawerBody .dshLiveTeamsHeader { flex-wrap: wrap; }
.dshLiveTeamsDrawerBody .dshLiveTeamsLeadControl { flex-basis: 100%; margin-left: 0; }
.dshLiveTeamsDrawerBody .dshLiveTeamsMemberPanel { margin: 0; padding: 14px; }
.dshLiveTeamsDrawerBody .dshLiveTeamsMemberIdentity { flex-wrap: wrap; }
.dshLiveTeamsDrawerBody .dshLiveTeamsMetaValue { overflow-wrap: anywhere; }
.dshLiveTeamsSettingsToggle:focus-visible, .dshLiveTeamsMemberCollapsed:focus-visible, .dshLiveTeamsActivityCategories > summary:focus-visible { outline: 2px solid var(--dsh-team-accent); outline-offset: 2px; }
@container dshLiveTeamsCard (max-width: 700px) {
  .dshLiveTeamsTaskFirst .dshLiveTeamsTaskSummary { grid-template-columns: 32px minmax(0, 1fr) 86px; gap: 10px; }
  .dshLiveTeamsTaskFirst .dshLiveTeamsTaskDisclosure { grid-column: 1; grid-row: 1 / 4; }
  .dshLiveTeamsTaskFirst .dshLiveTeamsTaskIdentity { grid-column: 2; grid-row: 1; }
  .dshLiveTeamsTaskFirst .dshLiveTeamsTaskOwner { grid-column: 2; grid-row: 2; }
  .dshLiveTeamsTaskFirst .dshLiveTeamsTaskStage { grid-column: 2; grid-row: 3; }
  .dshLiveTeamsTaskFirst .dshLiveTeamsTaskAge { grid-column: 3; grid-row: 1; }
  .dshLiveTeamsTaskFirst .dshLiveTeamsTaskRound { grid-column: 3; grid-row: 2; }
  .dshLiveTeamsTaskFirst .dshLiveTeamsTaskFilter { gap: 8px; }
  .dshLiveTeamsTaskFirst .dshLiveTeamsDispatchToggle { flex-basis: 100%; text-align: left; }
}
@media (max-width: 600px) {
  .dshLiveTeamsTaskFirst { padding: 8px; }
  .dshLiveTeamsTaskFirst .dshLiveTeamsMain > .dshLiveTeamsCard { padding: 12px; }
  .dshLiveTeamsTaskFirst .dshLiveTeamsSummaryGrid { flex-basis: 100%; order: 3; }
  .dshLiveTeamsTaskFirst .dshLiveTeamsSummary { gap: 8px; }
  .dshLiveTeamsTaskFirst .dshLiveTeamsActivityModes { margin-left: 0; flex-wrap: wrap; }
}

/* Member settings: clear sections rather than a nested role-colored roster card. */
.dshLiveTeamsMemberFeedback { position: sticky; top: 0; z-index: 2; margin: 0 0 14px; padding: 10px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px; background: var(--dsw-alias-bg-layer-2); font-size: 12px; }
.dshLiveTeamsDrawerBody .dshLiveTeamsMemberPanel.dshLiveTeamsMemberSettings { display: flex; flex-direction: column; align-items: stretch; gap: 0; width: 100%; margin: 0; padding: 0; border: 0; border-radius: 0; background: none; box-shadow: none; }
.dshLiveTeamsMemberSettings > .dshLiveTeamsMemberHeading { display: grid; grid-template-columns: 44px minmax(0, 1fr); align-items: center; gap: 12px; padding: 2px 0 20px; }
.dshLiveTeamsMemberSettings .dshLiveTeamsMemberHeading > .dshLiveTeamsMemberAvatar { width: 44px; height: 44px; box-sizing: border-box; }
.dshLiveTeamsMemberSettings .dshLiveTeamsMemberHeading > .dshLiveTeamsMemberAvatar svg { width: 25px; height: 25px; }
.dshLiveTeamsMemberSettings .dshLiveTeamsMemberIdentity { display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; gap: 4px 8px; min-width: 0; }
.dshLiveTeamsMemberSettings .dshLiveTeamsMemberAction { min-width: 0; max-width: 100%; padding: 0; }
.dshLiveTeamsMemberSettings .dshLiveTeamsMemberName { font-size: 16px; font-weight: 600; line-height: 23px; white-space: normal; overflow-wrap: anywhere; }
.dshLiveTeamsMemberSettings .dshLiveTeamsMemberRoleCaption { flex: 1 1 100%; order: 1; color: var(--dsw-alias-label-tertiary); font-size: 11px; }
.dshLiveTeamsMemberSettings .dshLiveTeamsState { flex: 1 1 100%; order: 2; font-size: 11px; }
.dshLiveTeamsMemberSettings .dshLiveTeamsNameInput { flex: 1 1 100%; width: 100%; min-width: 0; max-width: 100%; }
.dshLiveTeamsMemberSettings .dshLiveTeamsNameActions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.dshLiveTeamsMemberSettings .dshLiveTeamsEditNameButton { flex: none; opacity: 1; }
.dshLiveTeamsMemberSection { display: flex; flex-direction: column; align-items: stretch; gap: 9px; margin: 0; padding: 18px 0; border-top: 1px solid var(--dsw-alias-border-l2); }
.dshLiveTeamsMemberSettings h4 { margin: 0; font-size: 12px; font-weight: 600; line-height: 18px; color: var(--dsw-alias-label-primary); }
.dshLiveTeamsSectionHint { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 11px; font-weight: 400; line-height: 17px; white-space: normal; overflow-wrap: anywhere; }
.dshLiveTeamsMemberSettings .dshLiveTeamsControls { display: flex; flex-wrap: nowrap; align-items: flex-end; gap: 8px; width: 100%; margin: 0; }
.dshLiveTeamsMemberSettings .dshLiveTeamsRoleField { display: flex; flex: 1 1 auto; flex-direction: column; gap: 5px; min-width: 0; }
.dshLiveTeamsMemberSettings .dshLiveTeamsRoleInput { box-sizing: border-box; max-width: 100%; min-width: 0; height: 34px; border-radius: 6px; }
.dshLiveTeamsMemberSettings .dshLiveTeamsApply { flex: none; min-height: 32px; }
.dshLiveTeamsDraftHint { margin: 0; font-size: 10px; line-height: 16px; color: var(--dsw-alias-state-warn-primary); }
.dshLiveTeamsMemberSettings .dshLiveTeamsMemberActions { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; margin: 2px 0 0; }
.dshLiveTeamsMemberSettings .dshLiveTeamsAvailabilityAction { display: inline-flex; flex: none; align-items: center; justify-content: center; gap: 6px; width: auto; height: 32px; padding: 5px 10px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px; font-size: 11px; color: var(--dsw-alias-label-primary); }
.dshLiveTeamsMemberSettings .dshLiveTeamsContactGrant { display: flex; flex-direction: column; align-items: stretch; gap: 10px; flex-basis: auto; margin: 0; }
.dshLiveTeamsContactChips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.dshLiveTeamsContactChip { display: inline-flex; align-items: center; max-width: 100%; padding: 4px 8px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 15px; overflow-wrap: anywhere; }
.dshLiveTeamsMemberSettings .dshLiveTeamsGrantControls { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.dshLiveTeamsMemberSettings .dshLiveTeamsContactSelect { flex: 1 1 100%; width: 100%; margin-bottom: 2px; }
.dshLiveTeamsMemberSessionActions { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
.dshLiveTeamsBindingTag { color: var(--dsw-alias-label-secondary); font-size: 11px; }
.dshLiveTeamsMemberSettings .dshLiveTeamsMemberOpen { display: inline-flex; justify-content: center; padding: 6px 11px; min-height: 30px; font-size: 11px; border-color: var(--dsw-alias-border-l2); color: var(--dsw-alias-label-primary); }
.dshLiveTeamsMemberTurnControl { display: flex; flex-direction: column; align-items: flex-start; gap: 7px; margin-top: 4px; }
.dshLiveTeamsMemberSettings .dshLiveTeamsInterruptButton { align-self: flex-start; padding: 6px 10px; font-size: 11px; }
.dshLiveTeamsMemberNoteText { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; white-space: pre-wrap; overflow-wrap: anywhere; }
.dshLiveTeamsMemberTechnical { padding: 14px 0; border-top: 1px solid var(--dsw-alias-border-l2); }
.dshLiveTeamsMemberTechnical > summary { cursor: pointer; color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 20px; }
.dshLiveTeamsMemberSettings .dshLiveTeamsMemberMeta { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; margin: 14px 0 0; padding: 0; border: 0; }
.dshLiveTeamsMemberSettings .dshLiveTeamsMemberMeta > div { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.dshLiveTeamsMemberSettings .dshLiveTeamsMemberMeta dt { color: var(--dsw-alias-label-tertiary); font-size: 10px; }
.dshLiveTeamsMemberSettings .dshLiveTeamsMemberMeta dd { margin: 0; font-size: 11px; color: var(--dsw-alias-label-secondary); overflow-wrap: anywhere; }
.dshLiveTeamsMemberSettings .dshLiveTeamsMemberMeta code { white-space: normal; overflow-wrap: anywhere; user-select: all; }
.dshLiveTeamsMemberRemoval { display: flex; flex-direction: column; align-items: flex-start; gap: 9px; padding: 18px 0 2px; border-top: 1px solid var(--dsw-alias-border-l2); }
.dshLiveTeamsMemberSettings .dshLiveTeamsMemberRemove { margin: 1px 0 0; padding: 6px 10px; font-size: 11px; }

/* B43: rotation limits. Laid out like the lead control: a team-level setting above the roster. */
.dshLiveTeamsRotation { display: flex; flex-direction: column; gap: 8px; padding: 14px 0; border-top: 1px solid var(--dsw-alias-border-l2); }
.dshLiveTeamsRotationHead { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.dshLiveTeamsRotationHead strong { font-size: 12px; color: var(--dsw-alias-label-primary); }
.dshLiveTeamsRotationState { color: var(--dsw-alias-label-tertiary); font-size: 11px; }
.dshLiveTeamsRotationHint { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 16px; }
.dshLiveTeamsRotationControls { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px; }
.dshLiveTeamsRotationControls .dshLiveTeamsModalField { flex: 0 1 150px; }
.dshLiveTeamsRotationControls .dshLiveTeamsModalField input { width: 100%; }
.dshLiveTeamsRotationToggle { padding: 6px 11px; font-size: 11px; min-height: 30px; }
.dshLiveTeamsMemberTechnical > summary:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 2px; border-radius: 3px; }
`;
		function installLiveTeamsStyles() {
			if (typeof document === "undefined") return () => {};
			const selector = `style[data-plugin-css=${JSON.stringify(STYLE_ID)}]`;
			if (document.querySelector(selector) !== null) return () => {};
			const style = document.createElement("style");
			style.dataset.plugin = "dsh-live-teams";
			style.dataset.pluginCss = STYLE_ID;
			style.textContent = css;
			document.head.appendChild(style);
			return () => {
				style.remove();
			};
		}
		// src/client/SidePanel.tsx
		/** A view-local modal drawer. It changes no routing, membership or request ownership. */
		function SidePanel(props) {
			const panel = (0, react.useRef)(null);
			const close = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
				close.current?.focus();
				return () => {
					if (previous?.isConnected) previous.focus();
				};
			}, []);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dshLiveTeamsDrawerBackdrop",
				onClick: (event) => {
					if (event.target === event.currentTarget && !props.busy) props.onClose();
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("aside", {
					ref: panel,
					className: "dshLiveTeamsDrawer",
					tabIndex: -1,
					role: "dialog",
					"aria-modal": "true",
					"aria-label": props.title,
					onKeyDown: (event) => {
						if (event.defaultPrevented) return;
						if (event.key === "Escape") {
							event.stopPropagation();
							if (!props.busy) props.onClose();
							return;
						}
						if (event.key !== "Tab") return;
						const controls = Array.from(panel.current?.querySelectorAll("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex=\"0\"]") ?? []);
						if (controls.length === 0) {
							event.preventDefault();
							panel.current?.focus();
							return;
						}
						const first = controls[0];
						const last = controls.at(-1);
						if (event.shiftKey && document.activeElement === first) {
							event.preventDefault();
							last?.focus();
						} else if (!event.shiftKey && document.activeElement === last) {
							event.preventDefault();
							first?.focus();
						}
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: "dshLiveTeamsDrawerHeader",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: props.title }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							ref: close,
							type: "button",
							className: "dshLiveTeamsIconButton",
							"aria-label": props.closeLabel,
							disabled: props.busy,
							onClick: props.onClose,
							children: "×"
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dshLiveTeamsDrawerBody",
						children: props.children
					})]
				})
			});
		}
		// src/client/TeamGlyph.tsx
		/** Local decorative SVGs avoid extending the host primitive capability contract. */
		function TeamGlyph({ kind }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				viewBox: "0 0 24 24",
				width: "20",
				height: "20",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.5",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				focusable: "false",
				children: kind === "member" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
					cx: "12",
					cy: "8",
					r: "3.5"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M5 20v-2a7 7 0 0 1 14 0v2Z" })] }) : kind === "message" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M4 4h16v12H9l-5 4Z M8 8h8 M8 12h5" }) : kind === "review" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
					cx: "12",
					cy: "12",
					r: "8"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m8 12 3 3 5-6" })] }) : kind === "settings" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m9 3-1 3-3 1-2 5 2 5 3 1 1 3h6l1-3 3-1 2-5-2-5-3-1-1-3Z" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
					cx: "12",
					cy: "12",
					r: "3"
				})] }) : kind === "task" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M6 3h9l4 4v14H6Z M15 3v5h4 M9 12h7 M9 16h5" }) }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M5 12h14 M12 5l7 7-7 7" }) })
			});
		}
		// src/client/RoleAvatar.tsx
		const agentRoleKinds = [
			"lead",
			"builder",
			"reviewer",
			"verifier",
			"oracle",
			"researcher",
			"scout",
			"delegate",
			"custom"
		];
		/** Use the declared role/registry aliases only, never member names, notes or Session activity. */
		function agentRoleKind(role, roles = []) {
			const key = role.trim().toLowerCase();
			const canonical = (roles.find((entry) => entry.id.toLowerCase() === key) ?? roles.find((entry) => entry.aliases?.some((alias) => alias.toLowerCase() === key)))?.id.toLowerCase() ?? key;
			return agentRoleKinds.includes(canonical) ? canonical : "custom";
		}
		function RoleAvatar({ role, label, roles }) {
			const kind = agentRoleKind(role, roles);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "dshLiveTeamsMemberAvatar",
				"data-agent-role": kind,
				title: label,
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
					viewBox: "0 0 24 24",
					width: "20",
					height: "20",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: "1.5",
					strokeLinecap: "round",
					strokeLinejoin: "round",
					focusable: "false",
					"data-agent-icon": kind,
					children: kind === "lead" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
							x: "9",
							y: "3",
							width: "6",
							height: "5",
							rx: "1"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M12 8v5M5 13h14M5 13v3M19 13v3" }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
							x: "2",
							y: "16",
							width: "6",
							height: "5",
							rx: "1"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
							x: "16",
							y: "16",
							width: "6",
							height: "5",
							rx: "1"
						})
					] }) : kind === "builder" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m7 7-5 5 5 5M17 7l5 5-5 5M14 4l-4 16" }) }) : kind === "reviewer" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m8 12 3 3 5-6" })] }) : kind === "verifier" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "10",
						cy: "10",
						r: "7"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m7 10 2 2 4-4M15 15l6 6" })] }) : kind === "oracle" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M9 17h6M9 20h6M12 2a6 6 0 0 0-4 10c1 1 1 2 1 3h6c0-1 0-2 1-3a6 6 0 0 0-4-10Z" }) }) : kind === "researcher" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M3 4h7l2 2 2-2h7v15h-7l-2 2-2-2H3ZM12 6v15M6 8h3M6 12h3M15 8h3M15 12h3" }) }) : kind === "scout" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "12",
						cy: "12",
						r: "9"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m16 8-2 6-6 2 2-6ZM12 2v2M22 12h-2M12 22v-2M2 12h2" })] }) : kind === "delegate" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
							x: "3",
							y: "3",
							width: "6",
							height: "6",
							rx: "1"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
							x: "15",
							y: "15",
							width: "6",
							height: "6",
							rx: "1"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M9 6h9v6m-3-3 3 3 3-3M6 9v9h6m-3-3 3 3-3 3" })
					] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "12",
						cy: "8",
						r: "3.5"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M5 20v-2a7 7 0 0 1 14 0v2Z" })] })
				})
			});
		}
		// src/client/member-drafts.ts
		/** Presentation-only reconciliation: status/contact refreshes must not overwrite unsaved inputs. */
		function reconcileMemberDrafts(previous, next, drafts, field) {
			const old = new Map(previous.map((member) => [member.memberId, member]));
			const result = {};
			for (const member of next) result[member.memberId] = old.get(member.memberId)?.[field] === member[field] ? drafts[member.memberId] ?? member[field] : member[field];
			return Object.keys(result).length === Object.keys(drafts).length && Object.entries(result).every(([key, value]) => drafts[key] === value) ? drafts : result;
		}
		// src/client/team-presentation.ts
		/** Remove only an exact, typed task-title suffix. Never parse or rewrite event meaning. */
		function activityHeading(entry) {
			const suffix = entry.refs.taskTitle === void 0 ? void 0 : ` · ${entry.refs.taskTitle}`;
			const summary = suffix !== void 0 && entry.summary.endsWith(suffix) ? entry.summary.slice(0, -suffix.length) : entry.summary;
			if (entry.summaryParts === void 0 || entry.summaryParts.map((part) => part.text).join("") !== entry.summary) return { summary };
			let remaining = summary.length;
			return {
				summary,
				parts: entry.summaryParts.flatMap((part) => {
					const text = part.text.slice(0, remaining);
					remaining = Math.max(0, remaining - text.length);
					return text.length === 0 ? [] : [{
						...part,
						text
					}];
				})
			};
		}
		/** Classification uses formal event metadata, never private message text or inferred model intent. */
		function activityMatchesMode(entry, mode) {
			const technical = entry.category === "delivery" || entry.category === "contact" || entry.category === "other";
			if (mode === "all") return true;
			if (mode === "technical") return technical;
			return !technical || /(?:^|[./_-])(failed|failure|error|rejected|blocked|unconfirmed|unavailable|stalled|intervened)(?:$|[./_-])/u.test(entry.kind);
		}
		/** A route tells us where the decision is expected, not whether that Session started working. */
		function taskDecisionStage(task) {
			if (task.status !== "waiting" || task.awaitsDecision !== true) return void 0;
			if (task.route?.type === "review") return "taskAwaitingReview";
			if (task.route?.type === "report" && task.route.to === "human") return "taskAwaitingHuman";
			return "taskAwaitingDecision";
		}
		/** Assignment references only: a running Session is not proof of work on an assigned task. */
		function memberTaskReferences(tasks, memberId) {
			return tasks.filter((task) => task.assignee === memberId && task.archivedPath === void 0 && ![
				"completed",
				"failed",
				"cancelled"
			].includes(task.status));
		}
		// src/client/TeamView.tsx
		function fallback$1(key) {
			return key;
		}
		/**
		* The server names the reason it refused a member; showing "Unable to add team
		* member" instead throws that away and leaves the human guessing. Unknown text
		* is passed through rather than replaced by a vaguer sentence.
		*/
		const addMemberFailureKeys = {
			"live-teams session not found": "addMemberSessionMissing",
			"live-teams session not in workspace": "addMemberSessionElsewhere",
			"live-teams invalid request": "addMemberAlreadyMember",
			"live-teams unknown role": "addMemberUnknownRole",
			"live-teams state unavailable": "stateUnavailable",
			"live-teams workspace not registered": "workspaceNotRegistered"
		};
		function addMemberFailure(cause, t) {
			if (!(cause instanceof LiveTeamsApiError)) return t("addMemberFailed");
			const server = cause.error;
			if (server === void 0 || server.length === 0) return t("addMemberFailed");
			const key = addMemberFailureKeys[server];
			return key === void 0 ? server : t(key);
		}
		function bindingLabel(member, t) {
			return member.sessionId === null ? t("unbound") : t("bound");
		}
		function statusLabel(member, t) {
			if (member.status === "idle") return t("idle");
			if (member.status === "running") return t("running");
			return t("unknown");
		}
		function stateDot(member) {
			if (!member.live) return "warning";
			if (member.status === "running") return "ongoing";
			if (member.status === "idle") return "done";
			return "idle";
		}
		function stateText(member, t) {
			return `${member.live ? t("live") : t("notLive")} · ${statusLabel(member, t)}`;
		}
		const activityModeKeys = {
			important: "journalImportant",
			all: "journalAll",
			technical: "journalTechnical"
		};
		const journalCategories = [
			"message",
			"delivery",
			"task",
			"review",
			"contact",
			"team",
			"member",
			"other"
		];
		const journalCategoryKeys = {
			message: "journalFilterMessage",
			delivery: "journalFilterDelivery",
			task: "journalFilterTask",
			review: "journalFilterReview",
			contact: "journalFilterContact",
			team: "journalFilterTeam",
			member: "journalFilterMember",
			other: "journalFilterOther"
		};
		function isJournalCategory(value) {
			return typeof value === "string" && journalCategories.includes(value);
		}
		/**
		* The journal, from a byte cursor when we have one.
		*
		* The file grows forever and the panel re-reads it every few seconds; asking for everything was the
		* only part of polling that got worse with age. The server returns `nextOffset`, we hand it back, and
		* pay only for what is new.
		*/
		async function fetchJournal(session, after) {
			const query = new URLSearchParams({ limit: "100" });
			if (after !== void 0) query.set("after", String(after));
			if (session !== void 0 && session.length > 0) query.set("session", session);
			const response = await fetch(`/api/live-teams/journal?${query.toString()}`, {
				method: "GET",
				cache: "no-store",
				credentials: "same-origin",
				headers: { accept: "application/json" }
			});
			let body;
			try {
				body = await response.json();
			} catch {
				throw new LiveTeamsApiError(response.status, `invalid team response (HTTP ${response.status}; non-JSON body)`);
			}
			if (!response.ok) {
				const error = body !== null && typeof body === "object" && !Array.isArray(body) && typeof body.error === "string" ? body.error : "team request failed";
				throw new LiveTeamsApiError(response.status, error);
			}
			const record = body !== null && typeof body === "object" && !Array.isArray(body) ? body : {};
			if (typeof record.teamId !== "string" || !Array.isArray(record.entries)) throw new LiveTeamsApiError(500, "invalid team response");
			const nextOffset = typeof record.nextOffset === "number" && Number.isInteger(record.nextOffset) && record.nextOffset >= 0 ? record.nextOffset : void 0;
			const truncated = record.truncated === true;
			const entries = record.entries.flatMap((raw) => {
				if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return [];
				const entry = raw;
				if (typeof entry.id !== "string" || typeof entry.kind !== "string" || !isJournalCategory(entry.category) || typeof entry.at !== "number" || typeof entry.summary !== "string") return [];
				const refsValue = entry.refs;
				const refs = refsValue !== null && typeof refsValue === "object" && !Array.isArray(refsValue) ? refsValue : {};
				const fields = Array.isArray(entry.fields) ? entry.fields.flatMap((raw) => {
					if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return [];
					const field = raw;
					return typeof field.label === "string" && typeof field.value === "string" ? [{
						label: field.label,
						value: field.value
					}] : [];
				}) : void 0;
				const summaryParts = Array.isArray(entry.summaryParts) ? entry.summaryParts.flatMap((raw) => {
					if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return [];
					const part = raw;
					return typeof part.text === "string" ? [{
						text: part.text,
						...part.strong === true ? { strong: true } : {}
					}] : [];
				}) : void 0;
				return [{
					id: entry.id,
					kind: entry.kind,
					category: entry.category,
					at: entry.at,
					...summaryParts === void 0 || summaryParts.length === 0 ? {} : { summaryParts },
					...typeof entry.actor === "string" ? { actor: entry.actor } : {},
					...typeof entry.actorName === "string" ? { actorName: entry.actorName } : {},
					summary: entry.summary,
					refs,
					...fields === void 0 || fields.length === 0 ? {} : { fields },
					...typeof entry.detail === "string" ? { detail: entry.detail } : {}
				}];
			});
			return {
				teamId: record.teamId,
				entries,
				...nextOffset === void 0 ? {} : { nextOffset },
				...truncated ? { truncated: true } : {}
			};
		}
		function routeWords(route) {
			if (route === void 0) return "—";
			if (route.type === "report") return `report → ${route.to === "human" ? "human" : route.toName ?? route.to}`;
			if (route.type === "review") return `review → ${route.reviewerName ?? route.reviewer}`;
			if (route.type === "custom") return `custom → ${route.description}`;
			return `interactive → ${routeWords(route.then)}`;
		}
		function taskAge(updatedAt, now = Date.now()) {
			const elapsed = Math.max(0, now - updatedAt);
			const minutes = Math.floor(elapsed / 6e4);
			if (minutes < 1) return "<1m";
			if (minutes < 60) return `${minutes}m`;
			const hours = Math.floor(minutes / 60);
			if (hours < 24) return `${hours}h`;
			return `${Math.floor(hours / 24)}d`;
		}
		const attemptStatusKeys = {
			active: "attemptStatusactive",
			revoking: "attemptStatusrevoking",
			revoked: "attemptStatusrevoked",
			completed: "attemptStatuscompleted",
			failed: "attemptStatusfailed"
		};
		const scopeKeys = {
			clean: "scopeClean",
			violation: "scopeViolation",
			"shared-tree": "scopeSharedTree",
			unchecked: "scopeUnchecked"
		};
		const scopeReasonKeys = {
			"no-repository": "scopeReasonNoRepository",
			"too-many-files": "scopeReasonTooManyFiles",
			"no-snapshot": "scopeReasonNoSnapshot",
			unreadable: "scopeReasonUnreadable"
		};
		/** The tooltip says what was observed, not what it might mean. */
		function scopeTitle(scope, t) {
			const parts = [t(scopeKeys[scope.state])];
			const unexpected = scope.unexpected ?? [];
			const sharedTree = scope.sharedTree ?? [];
			const declared = scope.declared ?? [];
			if (unexpected.length > 0) parts.push(`${t("scopeUnexpected")}: ${unexpected.join(", ")}`);
			if (sharedTree.length > 0) parts.push(`${t("scopeSharedTreeNote")}: ${sharedTree.join(", ")}`);
			if (declared.length > 0) parts.push(`${t("scopeDeclared")}: ${declared.join(", ")}`);
			if (scope.mode !== void 0) parts.push(t(scope.mode === "git" ? "scopeModeGit" : "scopeModeFiles"));
			if (scope.state === "unchecked" && scope.reason !== void 0) parts.push(t(scopeReasonKeys[scope.reason]));
			return parts.join(" · ");
		}
		const taskStatusKeys = {
			draft: "taskStatusdraft",
			ready: "taskStatusready",
			claimed: "taskStatusclaimed",
			in_progress: "taskStatusin_progress",
			waiting: "taskStatuswaiting",
			needs_human: "taskStatusneeds_human",
			completed: "taskStatuscompleted",
			failed: "taskStatusfailed",
			cancelled: "taskStatuscancelled"
		};
		const taskFilterKeys = {
			active: "tasksFilteractive",
			waiting: "tasksFilterwaiting",
			archived: "tasksFilterarchived"
		};
		const messageKindKeys = {
			message: "messageKindMessage",
			direction: "messageKindDirection",
			comment: "messageKindComment"
		};
		/**
		* The one-word reason a task is not running, for the row chip. `dependency-open`
		* is already the `Blocked` chip and the task's own status carries `waiting` and
		* `needs_human`, so those stay silent rather than saying the same thing twice.
		*/
		const DISPATCH_CHIP_KEYS = {
			"member-paused": "taskQueuedMemberPaused",
			"member-busy": "taskQueuedMemberBusy",
			"no-session": "taskQueuedNoSession",
			"attempt-revoking": "taskQueuedRevoking",
			"member-unknown": "taskQueuedDeparted",
			"coding-not-isolated": "taskQueuedCoding",
			"paths-undeclared": "taskQueuedNoPaths",
			"paths-overlap": "taskQueuedPathsOverlap",
			"paths-shared": "taskQueuedPathsShared",
			"human-intervened": "taskQueuedIntervened"
		};
		const reviewReturnKeys = {
			pending: "reviewReturnpending",
			sending: "reviewReturnsending",
			delivered: "reviewReturndelivered",
			started: "reviewReturnstarted",
			completed: "reviewReturncompleted",
			blocked: "reviewReturnblocked",
			failed: "reviewReturnfailed",
			unconfirmed: "reviewReturnunconfirmed",
			superseded: "reviewReturnsuperseded"
		};
		function taskStatusLabel(status, t) {
			return t(taskStatusKeys[status]);
		}
		/** Name each blocker with its status: "blocked" alone does not say what to fix. */
		function blockerWords(blockers, t) {
			return blockers.map((blocker) => `${blocker.title} — ${taskStatusLabel(blocker.status, t)}`).join("; ");
		}
		function taskMatchesFilter(task, filter) {
			const archived = task.archivedPath !== void 0;
			if (filter === "archived") return archived;
			if (archived) return false;
			if (filter === "waiting") return task.status === "waiting" || task.status === "needs_human";
			return task.status !== "waiting" && task.status !== "needs_human" && task.status !== "completed";
		}
		function isActiveTask(task) {
			return task.archivedPath === void 0 && (task.status === "ready" || task.status === "claimed" || task.status === "in_progress");
		}
		function awaitsLead(task) {
			return task.archivedPath === void 0 && (task.status === "waiting" || task.status === "needs_human");
		}
		function artifactLabel(artifact) {
			return artifact.type === "report" ? `${artifact.bodyRef} · ${artifact.bodyDigest}` : `${artifact.paths.join(", ")} · ${artifact.manifestDigest}`;
		}
		function TeamView(props) {
			const t = props.ctx?.t ?? fallback$1;
			const session = props.sessionId;
			const [snapshot, setSnapshot] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(true);
			const [error, setError] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(() => /* @__PURE__ */ new Set());
			const [roleBusy, setRoleBusy] = (0, react.useState)(() => /* @__PURE__ */ new Set());
			const [roleDrafts, setRoleDrafts] = (0, react.useState)({});
			const [nameDrafts, setNameDrafts] = (0, react.useState)({});
			const [editingName, setEditingName] = (0, react.useState)(null);
			const nameInputRef = (0, react.useRef)(null);
			const nameEditButtons = (0, react.useRef)({});
			const focusAfterNameEdit = (0, react.useRef)(null);
			const [notice, setNotice] = (0, react.useState)(null);
			const [addOpen, setAddOpen] = (0, react.useState)(false);
			const [candidates, setCandidates] = (0, react.useState)([]);
			/** Team name carried by the candidates response — the suffix its titles end with. */
			const [candidateTeamName, setCandidateTeamName] = (0, react.useState)("");
			const [selectedSessionId, setSelectedSessionId] = (0, react.useState)(null);
			const [candidateLoading, setCandidateLoading] = (0, react.useState)(false);
			const [addBusy, setAddBusy] = (0, react.useState)(false);
			const [removeTarget, setRemoveTarget] = (0, react.useState)(null);
			const [removeBusy, setRemoveBusy] = (0, react.useState)(false);
			const [interruptTarget, setInterruptTarget] = (0, react.useState)(null);
			const [interruptBusy, setInterruptBusy] = (0, react.useState)(false);
			const [addName, setAddName] = (0, react.useState)("");
			const [addRole, setAddRole] = (0, react.useState)("");
			const [roleData, setRoleData] = (0, react.useState)(null);
			const [roleLoading, setRoleLoading] = (0, react.useState)(true);
			const [teamState, setTeamState] = (0, react.useState)(null);
			const [briefingText, setBriefingText] = (0, react.useState)("");
			const [teamLoading, setTeamLoading] = (0, react.useState)(true);
			const [teamBusy, setTeamBusy] = (0, react.useState)(false);
			const [leadMemberId, setLeadMemberId] = (0, react.useState)(void 0);
			/** Rotation limits in force, and the human's unsaved edits to them. */
			const [rotation, setRotation] = (0, react.useState)(null);
			const [rotationBusy, setRotationBusy] = (0, react.useState)(false);
			const [rotationDraft, setRotationDraft] = (0, react.useState)(null);
			/** Card-local feedback: a rotation read or save failure must not hijack the team-wide notice. */
			const [rotationNotice, setRotationNotice] = (0, react.useState)(null);
			const [inbox, setInbox] = (0, react.useState)([]);
			const [inboxLoading, setInboxLoading] = (0, react.useState)(true);
			/** Unread count for the folded header, read from the same projection as the header chip. */
			const [attentionWaiting, setAttentionWaiting] = (0, react.useState)(0);
			const [settingsOpen, setSettingsOpen] = (0, react.useState)(false);
			const [activityMode, setActivityMode] = (0, react.useState)("important");
			(0, react.useEffect)(() => {
				setSettingsOpen(false);
				setExpandedMembers(/* @__PURE__ */ new Set());
			}, [session]);
			const [journal, setJournal] = (0, react.useState)([]);
			const [journalLoading, setJournalLoading] = (0, react.useState)(true);
			const [journalNotice, setJournalNotice] = (0, react.useState)(null);
			const [journalFilters, setJournalFilters] = (0, react.useState)(() => new Set(journalCategories));
			const [expandedMembers, setExpandedMembers] = (0, react.useState)(() => /* @__PURE__ */ new Set());
			const [briefingExpanded, setBriefingExpanded] = (0, react.useState)(false);
			const [rolesExpanded, setRolesExpanded] = (0, react.useState)(false);
			const [taskFilter, setTaskFilter] = (0, react.useState)("active");
			const [taskSummaries, setTaskSummaries] = (0, react.useState)([]);
			const [dispatch, setDispatch] = (0, react.useState)(null);
			const [dispatchBusy, setDispatchBusy] = (0, react.useState)(false);
			const [taskDetails, setTaskDetails] = (0, react.useState)({});
			const [taskExpanded, setTaskExpanded] = (0, react.useState)(null);
			const [taskLoading, setTaskLoading] = (0, react.useState)(true);
			const [taskBusy, setTaskBusy] = (0, react.useState)(null);
			const [taskNotice, setTaskNotice] = (0, react.useState)(null);
			const [taskNote, setTaskNote] = (0, react.useState)("");
			const [taskInstructions, setTaskInstructions] = (0, react.useState)("");
			const [taskConfirm, setTaskConfirm] = (0, react.useState)(null);
			/** Where the journal read left off. A ref: changing it must not re-create the poll callback. */
			const journalOffset = (0, react.useRef)(void 0);
			/** Is anything actually happening? The poll interval reads this without re-creating the timer. */
			const busyRef = (0, react.useRef)(false);
			/** Which journal row is unfolded, and whether its body is shown as raw text instead of markdown. */
			const [journalExpanded, setJournalExpanded] = (0, react.useState)(null);
			const [journalRaw, setJournalRaw] = (0, react.useState)(false);
			/** The contract of a task a journal row is about, fetched when that row is opened. */
			const [journalTask, setJournalTask] = (0, react.useState)({});
			const [taskDraft, setTaskDraft] = (0, react.useState)(null);
			const [draftTitle, setDraftTitle] = (0, react.useState)("");
			const [draftKind, setDraftKind] = (0, react.useState)("implementation");
			const [draftAssignee, setDraftAssignee] = (0, react.useState)("");
			const [draftRoute, setDraftRoute] = (0, react.useState)("report");
			const [draftReviewer, setDraftReviewer] = (0, react.useState)("");
			const [draftPaths, setDraftPaths] = (0, react.useState)("");
			const [draftAcceptance, setDraftAcceptance] = (0, react.useState)("");
			const [draftChecks, setDraftChecks] = (0, react.useState)("");
			const [draftBody, setDraftBody] = (0, react.useState)("");
			const [draftBusy, setDraftBusy] = (0, react.useState)(false);
			const [releaseTarget, setReleaseTarget] = (0, react.useState)(null);
			const [releaseReason, setReleaseReason] = (0, react.useState)("");
			const [messageTo, setMessageTo] = (0, react.useState)("");
			const [messageKind, setMessageKind] = (0, react.useState)("");
			const [messageContent, setMessageContent] = (0, react.useState)("");
			/**
			* The inbox is collapsed by default and no longer a surface to read: the
			* conversation with a member happens in that member's Session, and the header
			* chip says when someone is waiting. What stays here is the archive and the
			* acknowledgement trail.
			*/
			const [inboxExpanded, setInboxExpanded] = (0, react.useState)(false);
			const [messageBusy, setMessageBusy] = (0, react.useState)(false);
			const [grantTarget, setGrantTarget] = (0, react.useState)("");
			const [grantBusy, setGrantBusy] = (0, react.useState)(null);
			const [adoptionCandidates, setAdoptionCandidates] = (0, react.useState)([]);
			const [adoptionLoading, setAdoptionLoading] = (0, react.useState)(false);
			const [teamNameDraft, setTeamNameDraft] = (0, react.useState)("");
			const [editingTeamName, setEditingTeamName] = (0, react.useState)(false);
			const [disableConfirm, setDisableConfirm] = (0, react.useState)(false);
			const refreshRoles = (0, react.useCallback)((options = {}) => {
				if (options.silent !== true) setRoleLoading(true);
				fetchTeamRoles(session).then((next) => {
					setRoleData((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
				}).catch(() => {}).finally(() => {
					if (options.silent !== true) setRoleLoading(false);
				});
			}, [session]);
			const refreshInbox = (0, react.useCallback)(() => {
				setInboxLoading(true);
				fetchTeamInbox(session).then((next) => setInbox(next.messages)).catch(() => setInbox([])).finally(() => setInboxLoading(false));
			}, [session]);
			/**
			* One signature per read: a poll that returns the same content must not replace state,
			* or the card re-renders (and the list jumps) every few seconds for nothing.
			*/
			const refreshJournal = (0, react.useCallback)((options = {}) => {
				const silent = options.silent === true;
				if (!silent) setJournalLoading(true);
				fetchJournal(session, journalOffset.current).then((next) => {
					setJournalNotice(null);
					if (next.nextOffset !== void 0) journalOffset.current = next.nextOffset;
					setJournal((current) => {
						const base = next.truncated === true ? [] : current;
						const seen = new Set(base.map((entry) => entry.id));
						const added = next.entries.filter((entry) => !seen.has(entry.id));
						if (added.length === 0) return base;
						return [...base, ...added].sort((left, right) => right.at - left.at).slice(0, 500);
					});
				}).catch((cause) => {
					setJournalNotice(`${t("journalLoadFailed")}${cause instanceof LiveTeamsApiError ? ` — ${cause.error}` : ""}`);
				}).finally(() => {
					if (!silent) setJournalLoading(false);
				});
			}, [session, t]);
			const refreshTasks = (0, react.useCallback)((includeArchived = taskFilter === "archived", options = {}) => {
				const silent = options.silent === true;
				if (!silent) setTaskLoading(true);
				fetchTeamDispatch(session).then((next) => {
					setDispatch((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
				}).catch(() => {
					if (!silent) setDispatch(null);
				});
				fetchTeamTasks(session, includeArchived).then((next) => {
					const signature = (tasks) => tasks.map((task) => `${task.id}:${task.status}:${task.updatedAt}`).join("|");
					setTaskSummaries((current) => signature(current) === signature(next.tasks) ? current : next.tasks);
				}).catch((cause) => {
					if (silent) return;
					setTaskSummaries([]);
					setTaskNotice(cause instanceof LiveTeamsApiError ? cause.error : t("tasksLoadFailed"));
				}).finally(() => {
					if (!silent) setTaskLoading(false);
				});
			}, [
				session,
				t,
				taskFilter
			]);
			(0, react.useEffect)(() => {
				const tasksBusy = taskSummaries.some((task) => task.status === "in_progress" || task.status === "claimed");
				const attemptsBusy = dispatch?.tasks.some((entry) => entry.decision === "active") === true;
				busyRef.current = tasksBusy || attemptsBusy;
			}, [taskSummaries, dispatch]);
			const toggleDispatch = (0, react.useCallback)(() => {
				const next = dispatch?.paused === true ? "auto" : "paused";
				setDispatchBusy(true);
				setTaskNotice(null);
				setTeamDispatch(next, void 0, session).then(() => refreshTasks()).catch((cause) => {
					setTaskNotice(cause instanceof LiveTeamsApiError ? cause.error : t("dispatchActionFailed"));
				}).finally(() => setDispatchBusy(false));
			}, [
				dispatch,
				refreshTasks,
				session,
				t
			]);
			/**
			* A limit typed into the card, or `undefined` when the field is not a non-negative integer.
			* Reading it here keeps the disabled state of Apply and the request body in agreement.
			*/
			const rotationLimit = (value) => {
				if (!/^\d+$/u.test(value.trim())) return void 0;
				const parsed = Number(value);
				return Number.isSafeInteger(parsed) ? parsed : void 0;
			};
			const rotationContextValue = rotationDraft?.maxContextTokens ?? (rotation === null ? "" : String(rotation.maxContextTokens));
			const rotationTaskValue = rotationDraft?.maxCompletedTasks ?? (rotation === null ? "" : String(rotation.maxCompletedTasks));
			const rotationEnabledValue = rotationDraft?.enabled ?? rotation?.enabled ?? false;
			const rotationDirty = rotation !== null && (rotationContextValue !== String(rotation.maxContextTokens) || rotationTaskValue !== String(rotation.maxCompletedTasks) || rotationEnabledValue !== rotation.enabled);
			const rotationApplicable = rotationDirty && rotationLimit(rotationContextValue) !== void 0 && rotationLimit(rotationTaskValue) !== void 0;
			const saveRotation = (0, react.useCallback)(() => {
				const context = rotationLimit(rotationContextValue);
				const tasks = rotationLimit(rotationTaskValue);
				if (rotation === null || context === void 0 || tasks === void 0) return;
				setRotationBusy(true);
				setTeamRotation({
					enabled: rotationEnabledValue,
					maxContextTokens: context,
					maxCompletedTasks: tasks,
					expectedRevision: rotation.revision
				}, session).then((next) => {
					setRotation(next);
					setRotationDraft(null);
					setRotationNotice(t("rotationSaved"));
				}).catch((cause) => setRotationNotice(cause instanceof LiveTeamsApiError ? cause.error : t("rotationSaveFailed"))).finally(() => setRotationBusy(false));
			}, [
				rotation,
				rotationContextValue,
				rotationEnabledValue,
				rotationTaskValue,
				session,
				t
			]);
			/** Include all projected facts, especially observed status, contact grants and revisions. */
			const memberSignature = (value) => JSON.stringify(value);
			const refresh = (0, react.useCallback)((options = {}) => {
				const silent = options.silent === true;
				refreshRoles({ ...silent ? { silent: true } : {} });
				refreshJournal({ ...silent ? { silent: true } : {} });
				if (!silent) {
					setLoading(true);
					setError(null);
				}
				fetchTeamLead(session).then((result) => setLeadMemberId(result.leadMemberId)).catch(() => {
					if (!silent) setNotice(t("leadLoadFailed"));
				});
				fetchTeamRotation(session).then((result) => setRotation(result)).catch(() => {
					if (!silent) setRotationNotice(t("rotationLoadFailed"));
				});
				fetchTeamSnapshot(session).then((next) => {
					setSnapshot((current) => {
						if (memberSignature(current) === memberSignature(next)) return current;
						const previous = current?.teamId === next.teamId ? current.members : [];
						setRoleDrafts((drafts) => reconcileMemberDrafts(previous, next.members, drafts, "role"));
						setNameDrafts((drafts) => reconcileMemberDrafts(previous, next.members, drafts, "displayName"));
						return next;
					});
				}).catch((cause) => {
					if (!silent) setError(cause instanceof LiveTeamsApiError ? cause : new LiveTeamsApiError(500, t("loadFailed")));
				}).finally(() => {
					if (!silent) setLoading(false);
				});
			}, [
				refreshJournal,
				refreshRoles,
				session,
				t
			]);
			const loadTeam = (0, react.useCallback)(() => {
				globalThis.__loads = (globalThis.__loads ?? 0) + 1;
				setTeamLoading(true);
				fetchTeamState(session).then((next) => {
					setTeamState(next);
					setBriefingText(next.briefing ?? "");
					setTeamNameDraft(next.teamName);
					if (!next.enabled) {
						setAdoptionLoading(true);
						fetchTeamAdoptionCandidates(session).then((result) => setAdoptionCandidates(result.candidates)).catch(() => setAdoptionCandidates([])).finally(() => setAdoptionLoading(false));
					} else setAdoptionCandidates([]);
				}).catch(() => {
					setTeamState(null);
				}).finally(() => setTeamLoading(false));
			}, [session]);
			(0, react.useEffect)(() => {
				fetchTeamLead(session).then((result) => setLeadMemberId(result.leadMemberId)).catch(() => {});
			}, [session]);
			(0, react.useEffect)(() => {
				loadTeam();
			}, [loadTeam]);
			/**
			* The archive itself is expensive — every relay the human ever received — so it
			* is read only when unfolded. The folded header needs one number, and asking
			* the attention projection for it keeps that number identical to the chip's.
			*/
			(0, react.useEffect)(() => {
				if (!inboxExpanded) return void 0;
				refreshInbox();
			}, [inboxExpanded, refreshInbox]);
			(0, react.useEffect)(() => {
				let active = true;
				const read = () => {
					fetchTeamAttention(session).then((result) => {
						if (active) setAttentionWaiting(result.attention.reduce((sum, entry) => sum + entry.waiting, 0));
					}).catch(() => {
						if (active) setAttentionWaiting(0);
					});
				};
				read();
				const timer = setInterval(read, 2e4);
				return () => {
					active = false;
					clearInterval(timer);
				};
			}, [session]);
			/**
			* The panel used to be a snapshot: a task that finished stayed in `Active` until the
			* human switched filters or reloaded, because nothing ever re-read the list. The host
			* offers no push channel for these reads, so the tab polls — but only while it is
			* visible, and silently, so the list never flashes.
			*/
			(0, react.useEffect)(() => {
				if (teamState?.enabled !== true) return;
				const tick = () => {
					if (typeof document !== "undefined" && document.hidden === true) return;
					refreshTasks(taskFilter === "archived", { silent: true });
					refreshJournal({ silent: true });
				};
				const timer = { current: void 0 };
				const schedule = () => {
					const busy = busyRef.current;
					timer.current = setTimeout(() => {
						tick();
						schedule();
					}, props.pollMs ?? (busy ? 2e3 : 12e3));
				};
				schedule();
				const onVisible = () => {
					if (document.hidden !== true) tick();
				};
				document.addEventListener("visibilitychange", onVisible);
				return () => {
					if (timer.current !== void 0) clearTimeout(timer.current);
					document.removeEventListener("visibilitychange", onVisible);
				};
			}, [
				teamState?.enabled,
				taskFilter,
				refreshTasks,
				refreshJournal,
				props.pollMs
			]);
			(0, react.useEffect)(() => {
				if (teamState?.enabled !== true) return;
				const timer = setInterval(() => {
					if (document.hidden !== true) refresh({ silent: true });
				}, 2e4);
				return () => clearInterval(timer);
			}, [teamState?.enabled, refresh]);
			(0, react.useEffect)(() => {
				if (teamState?.enabled === true) {
					refresh();
					refreshTasks();
				}
			}, [
				teamState?.enabled,
				refresh,
				refreshTasks
			]);
			(0, react.useEffect)(() => {
				if (teamState?.enabled === true) refreshTasks(taskFilter === "archived");
			}, [
				taskFilter,
				teamState?.enabled,
				refreshTasks
			]);
			const invalidateTaskDetail = (taskId) => {
				setTaskDetails((current) => {
					const next = { ...current };
					delete next[taskId];
					return next;
				});
				setTaskExpanded((current) => current === taskId ? null : current);
			};
			const loadTaskDetail = (summary) => {
				setTaskExpanded(summary.id);
				if (taskDetails[summary.id] !== void 0) return;
				setTaskLoading(true);
				fetchTeamTask(summary.id, session).then((detail) => setTaskDetails((current) => ({
					...current,
					[summary.id]: detail
				}))).catch((cause) => setTaskNotice(cause instanceof LiveTeamsApiError ? cause.error : t("taskLoadFailed"))).finally(() => setTaskLoading(false));
			};
			const openNewTask = () => {
				setDraftTitle("");
				setDraftKind("implementation");
				setDraftAssignee(members[0]?.memberId ?? "");
				setDraftRoute("report");
				setDraftReviewer("");
				setDraftPaths("");
				setDraftAcceptance("");
				setDraftChecks("");
				setDraftBody("");
				setTaskDraft({});
			};
			const openContract = (summary, detail) => {
				setDraftTitle(summary.title);
				setDraftKind(detail?.task.kind ?? "implementation");
				setDraftAssignee(detail?.task.assignee ?? summary.assignee ?? "");
				setDraftRoute(summary.route?.type === "review" ? "review" : "report");
				setDraftReviewer(summary.route?.type === "review" ? summary.route.reviewer : "");
				setDraftPaths((summary.paths ?? []).join(", "));
				setDraftAcceptance((detail?.task.acceptance ?? []).join("\n"));
				setDraftChecks((detail?.task.checks ?? []).join("\n"));
				setDraftBody(detail?.document ?? "");
				setTaskDraft({ editing: summary.id });
			};
			const lines = (value) => value.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
			const saveDraft = () => {
				if (draftBusy || draftTitle.trim().length === 0 || draftAssignee.length === 0 || lines(draftAcceptance).length === 0) return;
				if (draftRoute === "review" && draftReviewer.length === 0) return;
				setDraftBusy(true);
				setTaskNotice(null);
				const route = draftRoute === "review" ? {
					type: "review",
					reviewer: draftReviewer
				} : {
					type: "report",
					to: "human"
				};
				const paths = draftPaths.split(",").map((entry) => entry.trim()).filter((entry) => entry.length > 0);
				(taskDraft?.editing === void 0 ? createTeamTask({
					title: draftTitle.trim(),
					kind: draftKind,
					assignee: draftAssignee,
					acceptance: lines(draftAcceptance),
					route,
					...paths.length === 0 ? {} : { paths },
					...lines(draftChecks).length === 0 ? {} : { checks: lines(draftChecks) },
					...draftBody.trim().length === 0 ? {} : { body: draftBody }
				}, session) : updateTeamTask({
					taskId: taskDraft.editing,
					title: draftTitle.trim(),
					assignee: draftAssignee,
					acceptance: lines(draftAcceptance),
					...paths.length === 0 ? {} : { paths },
					...lines(draftChecks).length === 0 ? {} : { checks: lines(draftChecks) },
					...draftBody.trim().length === 0 ? {} : { body: draftBody }
				}, session)).then((result) => {
					invalidateTaskDetail(result.task.id);
					setTaskDraft(null);
					setTaskNotice([t("taskSaved"), ...result.warnings.map((warning) => `${t(warning.code === "path-no-match" ? "taskPathNoMatch" : "taskPathScanIncomplete")}: ${warning.pattern}`)].join("\n"));
					refreshTasks(taskFilter === "archived");
				}).catch((cause) => setTaskNotice(cause instanceof LiveTeamsApiError ? cause.error : t("taskActionFailed"))).finally(() => setDraftBusy(false));
			};
			const releaseAttempt = () => {
				if (releaseTarget === null || draftBusy || releaseReason.trim().length === 0) return;
				setDraftBusy(true);
				setTaskNotice(null);
				revokeTeamTask({
					taskId: releaseTarget.id,
					reason: releaseReason.trim()
				}, session).then((result) => {
					invalidateTaskDetail(releaseTarget.id);
					setReleaseTarget(null);
					setReleaseReason("");
					setTaskNotice(t(result.quiesced ? "taskReleased" : "taskStopUnconfirmed"));
					refreshTasks(taskFilter === "archived");
				}).catch((cause) => setTaskNotice(cause instanceof LiveTeamsApiError ? cause.error : t("taskActionFailed"))).finally(() => setDraftBusy(false));
			};
			const resumeTask = (summary) => {
				if (taskBusy !== null || draftBusy) return;
				setTaskBusy(summary.id);
				setTaskNotice(null);
				resumeTeamTask(summary.id, session).then(() => {
					setTaskNotice(t("taskResumed"));
					invalidateTaskDetail(summary.id);
					refreshTasks(taskFilter === "archived");
				}).catch((cause) => setTaskNotice(cause instanceof LiveTeamsApiError ? cause.error : t("taskActionFailed"))).finally(() => setTaskBusy(null));
			};
			const runTaskAction = (kind, summary) => {
				if (taskBusy !== null) return;
				setTaskBusy(summary.id);
				setTaskNotice(null);
				(kind === "cancel" ? cancelTeamTask(summary.id, taskInstructions.trim(), session) : kind === "accept" ? acceptTeamTask(summary.id, taskNote.trim().length === 0 ? void 0 : taskNote.trim(), session) : reviseTeamTask(summary.id, taskInstructions.trim(), session)).then((result) => {
					if ("quiesced" in result && !result.quiesced) setTaskNotice(t("taskStopUnconfirmed"));
					setTaskConfirm(null);
					setTaskNote("");
					setTaskInstructions("");
					invalidateTaskDetail(summary.id);
					refreshTasks(taskFilter === "archived");
				}).catch((cause) => setTaskNotice(cause instanceof LiveTeamsApiError ? cause.error : t("taskActionFailed"))).finally(() => setTaskBusy(null));
			};
			const sendMessage = () => {
				if (messageBusy || messageKind === "" || messageTo.length === 0 || messageContent.trim().length === 0) return;
				setMessageBusy(true);
				setNotice(null);
				sendTeamMessage({
					to: messageTo,
					kind: messageKind,
					content: messageContent
				}, session).then((result) => {
					const failed = result.deliveries.find((delivery) => delivery.state === "failed" && delivery.failure !== void 0);
					setMessageContent("");
					setMessageKind("");
					setNotice(failed === void 0 ? t("messageSent") : `${t("messageDeliveryFailed")}: ${failed.recipient} — ${failed.failure}`);
					refreshInbox();
				}).catch((cause) => {
					setNotice(cause instanceof LiveTeamsApiError ? cause.error : t("messageSendFailed"));
				}).finally(() => setMessageBusy(false));
			};
			const acknowledgeMessage = (message) => {
				if (message.delivery.state === "acknowledged") return;
				acknowledgeTeamMessage(message.id, session).then(() => refreshInbox()).catch(() => setNotice(t("messageAcknowledgeFailed")));
			};
			const applyTeamName = () => {
				if (teamState === null || teamBusy) return;
				setTeamBusy(true);
				renameTeam(teamNameDraft, teamState.revision ?? 0, session).then((next) => {
					setTeamState(next);
					setEditingTeamName(false);
					setNotice(t("teamRenamed"));
				}).catch(() => setNotice(t("teamActionFailed"))).finally(() => setTeamBusy(false));
			};
			const applyEnable = (createNew = false) => {
				if (teamBusy) return;
				setTeamBusy(true);
				enableTeam(teamNameDraft.length === 0 ? void 0 : teamNameDraft, session, createNew).then((next) => {
					setTeamState(next);
					setNotice(t("teamEnabled"));
				}).catch((cause) => {
					if (cause instanceof LiveTeamsApiError && cause.status === 409) setNotice(t("existingTeamFound"));
					else setNotice(t("teamActionFailed"));
				}).finally(() => setTeamBusy(false));
			};
			const applyAdopt = (candidate) => {
				if (teamBusy || candidate.usable === false) return;
				setTeamBusy(true);
				const replaceEmptyDerived = teamState !== null && teamState.enabled === false && (teamState.memberCount ?? 0) === 0;
				adoptTeam(candidate.teamId, replaceEmptyDerived, session).then((next) => {
					setTeamState(next);
					setAdoptionCandidates([]);
					setNotice(`${t("teamAdopted")}: ${candidate.name ?? candidate.teamId}`);
				}).catch(() => setNotice(t("teamActionFailed"))).finally(() => setTeamBusy(false));
			};
			const applyDisable = () => {
				if (teamBusy) return;
				setTeamBusy(true);
				disableTeam(session).then((next) => {
					setTeamState(next);
					setDisableConfirm(false);
					setNotice(t("teamDisabled"));
				}).catch(() => setNotice(t("teamActionFailed"))).finally(() => setTeamBusy(false));
			};
			const loadCandidates = (0, react.useCallback)(() => {
				setCandidateLoading(true);
				fetchTeamCandidates(session).then((result) => {
					setCandidates(result.candidates);
					setCandidateTeamName(result.teamName);
					const first = result.candidates[0];
					setSelectedSessionId(first?.sessionId ?? null);
					setAddName(memberNameFromTitle(first?.title, result.teamName));
				}).catch(() => {
					setCandidates([]);
					setCandidateTeamName("");
					setSelectedSessionId(null);
					setNotice(t("addMemberFailed"));
				}).finally(() => setCandidateLoading(false));
			}, [t]);
			const openAddMember = () => {
				setAddOpen(true);
				setNotice(null);
				setAddName("");
				setAddRole("");
				setSelectedSessionId(null);
				loadCandidates();
			};
			/** The name the dialog fills in itself; anything else is the human's own typing. */
			const defaultMemberName = (candidate) => memberNameFromTitle(candidate.title, candidateTeamName);
			const chooseCandidate = (candidate) => {
				setSelectedSessionId(candidate.sessionId);
				setAddName(defaultMemberName(candidate));
			};
			const selectedCandidate = candidates.find((candidate) => candidate.sessionId === selectedSessionId);
			const chooseNewSession = () => {
				if (selectedCandidate === void 0 || addName === defaultMemberName(selectedCandidate)) setAddName("");
				setSelectedSessionId(null);
			};
			const roleOptions = roleData?.roles ?? [];
			const roleById = new Map(roleOptions.map((role) => [role.id, role]));
			const canSaveMember = addName.trim().length > 0 && addRole.trim().length > 0 && roleById.has(addRole) && !addBusy;
			const createMember = () => {
				if (!canSaveMember) return;
				setAddBusy(true);
				setNotice(null);
				const withRevision = async () => {
					if (snapshot !== null) return snapshot;
					try {
						const fetched = await fetchTeamSnapshot(session);
						setSnapshot(fetched);
						return fetched;
					} catch {
						setNotice(t("memberNeedsState"));
						setAddBusy(false);
						return null;
					}
				};
				withRevision().then((current) => {
					if (current === null) return void 0;
					return selectedCandidate === void 0 ? createTeamSessionMember({
						displayName: addName,
						role: addRole,
						expectedRevision: current.revision
					}, session) : addTeamMember({
						sessionId: selectedCandidate.sessionId,
						displayName: addName,
						role: addRole,
						expectedRevision: current.revision
					}, session);
				}).then((result) => {
					if (result === void 0) return;
					setAddOpen(false);
					setNotice(t("memberCreated"));
					refresh();
				}).catch((cause) => {
					if (cause instanceof LiveTeamsApiError && cause.status === 409 && cause.conflict !== null) {
						setSnapshot((current) => current === null ? current : {
							...current,
							revision: cause.conflict?.revision ?? current.revision,
							members: cause.conflict?.members ?? current.members
						});
						setRoleDrafts(Object.fromEntries(cause.conflict.members.map((entry) => [entry.memberId, entry.role])));
						setNameDrafts(Object.fromEntries(cause.conflict.members.map((entry) => [entry.memberId, entry.displayName])));
						setNotice(t("teamChanged"));
					} else setNotice(addMemberFailure(cause, t));
				}).finally(() => setAddBusy(false));
			};
			(0, react.useEffect)(() => {
				if (editingName !== null) nameInputRef.current?.focus();
				else if (focusAfterNameEdit.current !== null) {
					const memberId = focusAfterNameEdit.current;
					if (busy.has(memberId)) return;
					focusAfterNameEdit.current = null;
					nameEditButtons.current[memberId]?.focus();
				}
			}, [busy, editingName]);
			const openMember = (member) => {
				if (member.sessionId === null) return;
				if (props.ctx?.openSession?.(member.sessionId) !== true) setNotice(t("openSessionUnavailable"));
			};
			/**
			* One member panel at a time: the ribbon keeps its layout, so a second open
			* panel would only push the rest of the tab down. Clicking the open member
			* again closes it.
			*/
			const toggleMemberPanel = (memberId) => {
				setSettingsOpen(false);
				setExpandedMembers((current) => current.has(memberId) ? /* @__PURE__ */ new Set() : /* @__PURE__ */ new Set([memberId]));
			};
			const beginNameEdit = (member) => {
				if (busy.has(member.memberId)) return;
				setNameDrafts((current) => ({
					...current,
					[member.memberId]: member.displayName
				}));
				setEditingName(member.memberId);
				setNotice(null);
			};
			const cancelNameEdit = (member) => {
				setNameDrafts((current) => ({
					...current,
					[member.memberId]: member.displayName
				}));
				focusAfterNameEdit.current = member.memberId;
				setEditingName(null);
			};
			const applyName = (member) => {
				if (snapshot === null || busy.has(member.memberId)) return;
				const displayName = nameDrafts[member.memberId] ?? member.displayName;
				if (displayName.trim().length === 0) return;
				setBusy((current) => new Set(current).add(member.memberId));
				setNotice(null);
				changeMemberDisplayName(member.memberId, displayName, snapshot.revision, session).then((result) => {
					setSnapshot((current) => current === null ? current : {
						...current,
						revision: result.revision,
						members: current.members.map((entry) => entry.memberId === result.memberId ? result.member : entry)
					});
					setNameDrafts((current) => ({
						...current,
						[result.memberId]: result.member.displayName
					}));
					focusAfterNameEdit.current = member.memberId;
					setEditingName(null);
				}).catch((cause) => {
					if (cause instanceof LiveTeamsApiError && cause.status === 409 && cause.conflict !== null) {
						setSnapshot((current) => current === null ? current : {
							...current,
							revision: cause.conflict?.revision ?? current.revision,
							members: cause.conflict?.members ?? current.members
						});
						setRoleDrafts(Object.fromEntries(cause.conflict.members.map((entry) => [entry.memberId, entry.role])));
						setNameDrafts(Object.fromEntries(cause.conflict.members.map((entry) => [entry.memberId, entry.displayName])));
						focusAfterNameEdit.current = member.memberId;
						setEditingName(null);
						setNotice(t("teamChanged"));
					} else setNotice(t("mutationFailed"));
				}).finally(() => setBusy((current) => {
					const next = new Set(current);
					next.delete(member.memberId);
					return next;
				}));
			};
			const applyRole = (member) => {
				if (snapshot === null || busy.has(member.memberId)) return;
				const role = roleDrafts[member.memberId] ?? member.role;
				setBusy((current) => new Set(current).add(member.memberId));
				setNotice(null);
				changeMemberRole(member.memberId, role, snapshot.revision, session).then((result) => {
					setSnapshot((current) => current === null ? current : {
						...current,
						revision: result.revision,
						members: current.members.map((entry) => entry.memberId === result.memberId ? result.member : entry)
					});
					setRoleDrafts((current) => ({
						...current,
						[result.memberId]: result.member.role
					}));
				}).catch((cause) => {
					if (cause instanceof LiveTeamsApiError && cause.status === 409 && cause.conflict !== null) {
						setSnapshot((current) => current === null ? current : {
							...current,
							revision: cause.conflict?.revision ?? current.revision,
							members: cause.conflict?.members ?? current.members
						});
						setRoleDrafts(Object.fromEntries(cause.conflict.members.map((entry) => [entry.memberId, entry.role])));
						setNotice(t("teamChanged"));
					} else setNotice(t("mutationFailed"));
				}).finally(() => setBusy((current) => {
					const next = new Set(current);
					next.delete(member.memberId);
					return next;
				}));
			};
			const openRolesPath = (scope, id) => {
				setNotice(null);
				openTeamRoles(scope, id, session).then(() => setNotice(t("rolesOpened"))).catch(() => setNotice(t("openRolesFailed")));
			};
			const customizeRole = (id) => {
				if (roleBusy.has(id)) return;
				setRoleBusy((current) => new Set(current).add(id));
				setNotice(null);
				overrideTeamRole(id, session).then(() => {
					setNotice(t("roleOverridden"));
					refreshRoles();
				}).catch((cause) => {
					setNotice(cause instanceof LiveTeamsApiError && cause.status === 409 ? t("roleAlreadyOverridden") : t("overrideFailed"));
				}).finally(() => setRoleBusy((current) => {
					const next = new Set(current);
					next.delete(id);
					return next;
				}));
			};
			const toggleAvailability = (member) => {
				if (snapshot === null || busy.has(member.memberId)) return;
				const availability = member.availability === "paused" ? "available" : "paused";
				setBusy((current) => new Set(current).add(member.memberId));
				setNotice(null);
				changeMemberAvailability(member.memberId, availability, snapshot.revision, session).then((result) => {
					setSnapshot((current) => current === null ? current : {
						...current,
						revision: result.revision,
						members: current.members.map((entry) => entry.memberId === result.memberId ? result.member : entry)
					});
				}).catch((cause) => {
					if (cause instanceof LiveTeamsApiError && cause.status === 409 && cause.conflict !== null) {
						setSnapshot((current) => current === null ? current : {
							...current,
							revision: cause.conflict?.revision ?? current.revision,
							members: cause.conflict?.members ?? current.members
						});
						setRoleDrafts(Object.fromEntries(cause.conflict.members.map((entry) => [entry.memberId, entry.role])));
						setNotice(t("teamChanged"));
					} else setNotice(t("mutationFailed"));
				}).finally(() => setBusy((current) => {
					const next = new Set(current);
					next.delete(member.memberId);
					return next;
				}));
			};
			const confirmInterruptTurn = () => {
				if (interruptTarget === null || interruptBusy) return;
				if (interruptTarget.sessionId === null || interruptTarget.status !== "running") {
					setNotice(t("noRunningTurn"));
					setInterruptTarget(null);
					return;
				}
				const target = interruptTarget;
				setInterruptBusy(true);
				setNotice(null);
				interruptTeamMember(target.memberId, session).then((result) => {
					setSnapshot((current) => current === null ? current : {
						...current,
						members: current.members.map((entry) => entry.memberId === result.memberId ? {
							...entry,
							status: result.status
						} : entry)
					});
					setInterruptTarget(null);
					setNotice(t("turnInterrupted"));
				}).catch((cause) => {
					if (cause instanceof LiveTeamsApiError && cause.status === 409) setNotice(t("noRunningTurn"));
					else setNotice(t("interruptFailed"));
				}).finally(() => setInterruptBusy(false));
			};
			const confirmRemoveMember = () => {
				if (snapshot === null || removeTarget === null || removeBusy) return;
				const target = removeTarget;
				setRemoveBusy(true);
				setNotice(null);
				removeTeamMember(target.memberId, snapshot.revision, session).then((result) => {
					setSnapshot((current) => current === null ? current : {
						...current,
						revision: result.revision,
						members: current.members.filter((entry) => entry.memberId !== result.memberId)
					});
					setRoleDrafts((current) => {
						const next = { ...current };
						delete next[result.memberId];
						return next;
					});
					setNameDrafts((current) => {
						const next = { ...current };
						delete next[result.memberId];
						return next;
					});
					setRemoveTarget(null);
					setNotice(t("memberRemoved"));
				}).catch((cause) => {
					if (cause instanceof LiveTeamsApiError && cause.status === 409 && cause.conflict !== null) {
						setSnapshot((current) => current === null ? current : {
							...current,
							revision: cause.conflict?.revision ?? current.revision,
							members: cause.conflict?.members ?? current.members
						});
						setRoleDrafts(Object.fromEntries(cause.conflict.members.map((entry) => [entry.memberId, entry.role])));
						setNameDrafts(Object.fromEntries(cause.conflict.members.map((entry) => [entry.memberId, entry.displayName])));
						setRemoveTarget(null);
						setNotice(t("teamChanged"));
					} else setNotice(t("mutationFailed"));
				}).finally(() => setRemoveBusy(false));
			};
			if (teamState !== null && !teamState.enabled) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "dshLiveTeamsRoot",
				"aria-label": t("title"),
				children: [
					teamState?.compatibility === void 0 || teamState.compatibility.verdict === "compatible" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						className: `dshLiveTeamsNotice dshLiveTeamsCompatibility${teamState.compatibility.verdict === "incompatible" ? " dshLiveTeamsCompatibilityBad" : ""}`,
						role: "status",
						children: [
							teamState.compatibility.verdict === "incompatible" ? t("compatibilityIncompatible") : t("compatibilityDegraded"),
							teamState.compatibility.hostVersion === void 0 ? "" : ` · DSH ${teamState.compatibility.hostVersion}`,
							" — ",
							teamState.compatibility.detail
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dshLiveTeamsCard",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dshLiveTeamsSectionHeader",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: t("teamOffTitle") }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "dshLiveTeamsSectionCaption",
										children: t("teamOffHint")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "dshLiveTeamsWorkspacePath",
										children: teamState.workspacePath
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: "dshLiveTeamsModalField",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dshLiveTeamsFieldLabel",
									children: t("teamNameLabel")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "text",
									value: teamNameDraft,
									disabled: teamBusy,
									onChange: (event) => setTeamNameDraft(event.target.value)
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: "dshLiveTeamsTeamToggle",
								type: "button",
								disabled: teamBusy,
								onClick: () => applyEnable(),
								children: t("enableTeam")
							}),
							adoptionLoading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dshLiveTeamsMessage",
								children: t("loading")
							}) : adoptionCandidates.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dshLiveTeamsAdoptionList",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "dshLiveTeamsMessage",
										children: t("existingTeamHint")
									}),
									adoptionCandidates.map((candidate) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dshLiveTeamsAdoptionRow",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: candidate.name ?? candidate.teamId }),
											" — ",
											candidate.usable === false ? candidate.reason ?? t("candidateUnusable") : `${candidate.memberCount ?? 0} ${t("members").toLowerCase()}`
										] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											className: "dshLiveTeamsTeamToggle",
											type: "button",
											disabled: teamBusy || candidate.usable === false,
											onClick: () => applyAdopt(candidate),
											children: t("adoptTeam")
										})]
									}, candidate.teamId)),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: "dshLiveTeamsTeamToggle",
										type: "button",
										disabled: teamBusy,
										onClick: () => applyEnable(true),
										children: t("createNewTeam")
									})
								]
							}) : null
						]
					}),
					notice !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dshLiveTeamsNotice",
						role: "status",
						children: notice
					})
				]
			});
			if (teamLoading && teamState === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
				className: "dshLiveTeamsRoot",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "dshLiveTeamsMessage",
					children: t("loading")
				})
			});
			if (loading && snapshot === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
				className: "dshLiveTeamsRoot",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "dshLiveTeamsMessage",
					children: t("loading")
				})
			});
			if (error?.status === 503) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "dshLiveTeamsRoot",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "dshLiveTeamsMessage",
					children: t("unavailable")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
					variant: "outline",
					size: "sm",
					type: "button",
					onClick: () => refresh(),
					children: t("refresh")
				})]
			});
			if (error !== null && snapshot === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "dshLiveTeamsRoot",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "dshLiveTeamsMessage",
					children: t("loadFailed")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
					variant: "outline",
					size: "sm",
					type: "button",
					onClick: () => refresh(),
					children: t("refresh")
				})]
			});
			const members = snapshot?.members ?? [];
			const liveCount = members.filter((member) => member.live).length;
			const pausedCount = members.filter((member) => member.availability === "paused").length;
			const unboundCount = members.filter((member) => member.sessionId === null).length;
			const visibleTasks = taskSummaries.filter((task) => taskMatchesFilter(task, taskFilter));
			const activeTaskCount = taskSummaries.filter(isActiveTask).length;
			const awaitingLeadCount = taskSummaries.filter(awaitsLead).length;
			const sectionTitleId = "dsh-live-teams-members-title";
			const visibleJournal = journal.filter((entry) => activityMatchesMode(entry, activityMode) && (journalFilters.size === 0 || journalFilters.has(entry.category)));
			const toggleJournalFilter = (category) => {
				if (activityMode === "important" && [
					"delivery",
					"contact",
					"other"
				].includes(category)) setActivityMode("all");
				setJournalFilters((current) => {
					if (current.size === journalCategories.length) return /* @__PURE__ */ new Set([category]);
					const next = new Set(current);
					if (next.has(category)) next.delete(category);
					else next.add(category);
					return next;
				});
			};
			const briefingSummary = (briefingText.split(/\r?\n/u)[0] ?? "").trim() || t("briefingEmpty");
			const formatJournalTime = (at) => {
				try {
					return new Intl.DateTimeFormat(void 0, {
						hour: "2-digit",
						minute: "2-digit"
					}).format(new Date(at));
				} catch {
					return "—";
				}
			};
			const selectedMember = members.find((member) => expandedMembers.has(member.memberId));
			const settingsPanel = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "dshLiveTeamsCard dshLiveTeamsTeamControls",
				"aria-label": t("title"),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dshLiveTeamsHeader",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dshLiveTeamsHeaderCopy",
								children: editingTeamName ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "dshLiveTeamsNameLine",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "text",
										className: "dshLiveTeamsNameInput",
										value: teamNameDraft,
										disabled: teamBusy,
										onChange: (event) => setTeamNameDraft(event.target.value),
										"aria-label": t("teamNameLabel")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "dshLiveTeamsNameActions",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
											variant: "outline",
											size: "sm",
											type: "button",
											disabled: teamBusy || teamNameDraft.trim().length === 0,
											onClick: applyTeamName,
											children: t("save")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
											variant: "outline",
											size: "sm",
											type: "button",
											disabled: teamBusy,
											onClick: () => {
												setEditingTeamName(false);
												setTeamNameDraft(teamState?.teamName ?? "");
											},
											children: t("cancel")
										})]
									})]
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "dshLiveTeamsNameLine",
									children: [teamState?.teamName ?? t("title"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: "dshLiveTeamsEditNameButton",
										type: "button",
										onClick: () => setEditingTeamName(true),
										"aria-label": `${t("renameTeam")}: ${teamState?.teamName ?? ""}`,
										title: t("renameTeam"),
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconEdit, { size: 14 })
									})]
								}) })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: "dshLiveTeamsIconButton",
								type: "button",
								onClick: () => refresh(),
								disabled: loading,
								"aria-label": t("refresh"),
								title: t("refresh"),
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconRefresh, {})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: "dshLiveTeamsLeadControl",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("lead") }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
									value: leadMemberId ?? "",
									disabled: teamBusy,
									onChange: (event) => {
										setTeamBusy(true);
										setTeamLead(event.target.value, session).then(() => {
											setLeadMemberId(event.target.value);
											setNotice(t("leadUpdated"));
										}).catch(() => setNotice(t("teamActionFailed"))).finally(() => setTeamBusy(false));
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: "",
										children: t("leadUnset")
									}), members.map((member) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: member.memberId,
										children: member.displayName
									}, member.memberId))]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: "dshLiveTeamsTeamToggle",
								type: "button",
								disabled: teamBusy,
								onClick: () => setDisableConfirm(true),
								children: t("disableTeam")
							})
						]
					}),
					rotation === null ? rotationNotice === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dshLiveTeamsRotationHint",
						role: "status",
						children: rotationNotice
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dshLiveTeamsRotation",
						"aria-labelledby": "dsh-live-teams-rotation-title",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dshLiveTeamsRotationHead",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
									id: "dsh-live-teams-rotation-title",
									children: t("rotationHeading")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dshLiveTeamsRotationState",
									children: rotation.source === "team" ? t("rotationSourceTeam") : t("rotationSourceProfile")
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dshLiveTeamsRotationHint",
								children: t("rotationHint")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dshLiveTeamsRotationControls",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: `dshLiveTeamsSegmentedButton dshLiveTeamsRotationToggle${rotationEnabledValue ? " dshLiveTeamsSegmentedButtonActive" : ""}`,
										type: "button",
										"aria-pressed": rotationEnabledValue,
										disabled: rotationBusy,
										onClick: () => setRotationDraft({
											enabled: !rotationEnabledValue,
											maxContextTokens: rotationContextValue,
											maxCompletedTasks: rotationTaskValue
										}),
										children: rotationEnabledValue ? t("rotationOn") : t("rotationOff")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: "dshLiveTeamsModalField",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dshLiveTeamsFieldLabel",
											children: t("rotationContextLimit")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "number",
											min: 0,
											step: 1e3,
											inputMode: "numeric",
											value: rotationContextValue,
											disabled: rotationBusy,
											onChange: (event) => setRotationDraft({
												enabled: rotationEnabledValue,
												maxContextTokens: event.target.value,
												maxCompletedTasks: rotationTaskValue
											})
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: "dshLiveTeamsModalField",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dshLiveTeamsFieldLabel",
											children: t("rotationTaskLimit")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "number",
											min: 0,
											step: 1,
											inputMode: "numeric",
											value: rotationTaskValue,
											disabled: rotationBusy,
											onChange: (event) => setRotationDraft({
												enabled: rotationEnabledValue,
												maxContextTokens: rotationContextValue,
												maxCompletedTasks: event.target.value
											})
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: "dshLiveTeamsAddButton",
										type: "button",
										disabled: rotationBusy || !rotationApplicable,
										onClick: saveRotation,
										children: t("rotationSave")
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dshLiveTeamsRotationHint",
								role: "status",
								children: rotationNotice ?? (rotationDirty && !rotationApplicable ? t("rotationPending") : t("rotationZeroHint"))
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: `dshLiveTeamsBriefing${briefingExpanded ? " dshLiveTeamsPanelExpanded" : ""}`,
						"aria-labelledby": "dsh-live-teams-briefing-title",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								className: "dshLiveTeamsCollapseHeader",
								type: "button",
								"aria-expanded": briefingExpanded,
								onClick: () => setBriefingExpanded((current) => !current),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dshLiveTeamsDisclosure",
									"aria-hidden": "true",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconChevronDown, { size: 14 })
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "dshLiveTeamsCollapseHeaderCopy",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
										id: "dsh-live-teams-briefing-title",
										children: t("briefing")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: briefingExpanded ? t("briefingHint") : briefingSummary })]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: "dshLiveTeamsAddButton",
								type: "button",
								onClick: () => {
									openTeamBriefing(session).then(() => setNotice(t("briefingOpened"))).catch(() => setNotice(t("openBriefingFailed")));
								},
								disabled: teamState?.openAvailable !== true,
								children: t("openBriefing")
							}),
							briefingExpanded && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", { children: briefingText || t("briefingEmpty") })
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: `dshLiveTeamsRoles dshLiveTeamsControlDisclosure${rolesExpanded ? " dshLiveTeamsPanelExpanded" : ""}`,
						"aria-labelledby": "dsh-live-teams-roles-title",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								className: "dshLiveTeamsCollapseHeader",
								type: "button",
								"aria-expanded": rolesExpanded,
								onClick: () => setRolesExpanded((current) => !current),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dshLiveTeamsDisclosure",
									"aria-hidden": "true",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconChevronDown, { size: 14 })
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "dshLiveTeamsCollapseHeaderCopy",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
										id: "dsh-live-teams-roles-title",
										children: t("roles")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: rolesExpanded ? t("rolesCaption") : `${roleOptions.length} ${t("rolesCount")}` })]
								})]
							}),
							rolesExpanded && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dshLiveTeamsRoleActions",
								children: [roleData !== null && roleData.globalOpenAvailable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dshLiveTeamsAddButton",
									type: "button",
									onClick: () => openRolesPath("global"),
									"aria-label": t("openGlobalRoles"),
									children: t("openGlobalRoles")
								}), roleData !== null && canOpenWorkspaceRoles(roleData) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dshLiveTeamsAddButton",
									type: "button",
									onClick: () => openRolesPath("workspace"),
									"aria-label": t("openWorkspaceRoles"),
									children: t("openWorkspaceRoles")
								})]
							}), roleLoading && roleData === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dshLiveTeamsMessage",
								children: t("loading")
							}) : roleData !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
								className: "dshLiveTeamsRoleList",
								children: roleData.roles.map((role) => {
									const customized = role.source === "workspace" || role.overridden;
									const roleActionLabel = customized ? `${t("openRoleFile")}: ${role.name}` : `${t("customizeRole")}: ${role.name}`;
									return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
										className: "dshLiveTeamsRoleRow",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dshLiveTeamsRoleIdentity",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
												className: "dshLiveTeamsRoleName",
												children: role.name
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dshLiveTeamsRoleState",
												children: customized ? t("roleCustomized") : t("roleGlobal")
											})]
										}), customized ? roleData.openAvailable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											className: "dshLiveTeamsAddButton",
											type: "button",
											disabled: roleBusy.has(role.id),
											onClick: () => openRolesPath("workspace", role.id),
											"aria-label": roleActionLabel,
											children: t("openRoleFile")
										}) : null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											className: "dshLiveTeamsAddButton",
											type: "button",
											disabled: roleBusy.has(role.id),
											onClick: () => customizeRole(role.id),
											"aria-label": roleActionLabel,
											children: t("customizeRole")
										})]
									}, role.id);
								})
							})] }),
							"        "
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Modal, {
						open: disableConfirm,
						onClose: () => {
							if (!teamBusy) setDisableConfirm(false);
						},
						title: t("disableTeamTitle"),
						closeLabel: t("cancel"),
						description: `${t("disableTeamDescription")} ${t("sessionContinues")}`,
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
							variant: "outline",
							size: "sm",
							type: "button",
							disabled: teamBusy,
							onClick: () => setDisableConfirm(false),
							children: t("cancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
							variant: "primary",
							size: "sm",
							type: "button",
							disabled: teamBusy,
							onClick: applyDisable,
							children: t("disableTeam")
						})] }),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dshLiveTeamsMessage",
							children: t("disableTeamKeeps")
						})
					}),
					notice !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dshLiveTeamsNotice",
						role: "status",
						children: notice
					})
				]
			});
			const membersPanel = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "dshLiveTeamsCard dshLiveTeamsMembers",
				"aria-labelledby": sectionTitleId,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dshLiveTeamsSectionHeader",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h3", {
							id: sectionTitleId,
							children: [
								t("membersTitle"),
								" ",
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "dshLiveTeamsMemberCount",
									children: [
										"(",
										members.length,
										")"
									]
								})
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dshLiveTeamsSectionCaption",
							children: t("membersCaption")
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						className: "dshLiveTeamsAddButton",
						type: "button",
						onClick: openAddMember,
						"aria-label": t("addMember"),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconPlus, { size: 14 }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("addMember") })]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Modal, {
						open: addOpen,
						onClose: () => {
							if (!addBusy) setAddOpen(false);
						},
						title: t("addMemberTitle"),
						closeLabel: t("cancel"),
						description: t("addMemberDescription"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
							variant: "outline",
							size: "sm",
							type: "button",
							disabled: addBusy,
							onClick: () => setAddOpen(false),
							children: t("cancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
							variant: "primary",
							size: "sm",
							type: "button",
							disabled: !canSaveMember,
							onClick: createMember,
							children: t("createMember")
						})] }),
						children: candidateLoading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dshLiveTeamsMessage",
							children: t("loading")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dshLiveTeamsAddForm",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
									className: "dshLiveTeamsCandidateList",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("legend", {
											className: "dshLiveTeamsFieldLabel",
											children: t("candidateSession")
										}),
										candidates.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: "dshLiveTeamsMessage",
											children: t("candidatesEmpty")
										}),
										candidates.map((candidate) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											className: "dshLiveTeamsCandidate",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												type: "radio",
												name: "dsh-live-teams-candidate",
												checked: candidate.sessionId === selectedSessionId,
												disabled: addBusy,
												onChange: () => chooseCandidate(candidate)
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: "dshLiveTeamsCandidateCopy",
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: candidate.title ?? candidate.sessionId }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: candidate.sessionId }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
														className: "dshLiveTeamsCandidateState",
														children: [
															t("candidateState"),
															": ",
															candidate.status === "running" ? t("running") : candidate.status === "idle" ? t("idle") : t("unknown")
														]
													})
												]
											})]
										}, candidate.sessionId)),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											className: "dshLiveTeamsCandidate",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												type: "radio",
												name: "dsh-live-teams-candidate",
												checked: selectedSessionId === null,
												disabled: addBusy,
												onChange: chooseNewSession
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: "dshLiveTeamsCandidateCopy",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("candidateNewSession") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dshLiveTeamsCandidateState",
													children: t("candidateNewSessionHint")
												})]
											})]
										})
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: "dshLiveTeamsModalField",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dshLiveTeamsFieldLabel",
										children: t("name")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "text",
										value: addName,
										disabled: addBusy,
										onChange: (event) => setAddName(event.target.value)
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: "dshLiveTeamsModalField",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dshLiveTeamsFieldLabel",
										children: t("role")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
										value: addRole,
										disabled: addBusy || roleLoading,
										onChange: (event) => setAddRole(event.target.value),
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "",
											children: t("chooseRole")
										}), roleOptions.map((role) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: role.id,
											children: role.name
										}, role.id))]
									})]
								})
							]
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Modal, {
						open: interruptTarget !== null,
						onClose: () => {
							if (!interruptBusy) setInterruptTarget(null);
						},
						title: t("interruptTurnTitle"),
						closeLabel: t("cancel"),
						description: t("interruptTurnDescription"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
							variant: "outline",
							size: "sm",
							type: "button",
							disabled: interruptBusy,
							onClick: () => setInterruptTarget(null),
							children: t("cancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
							variant: "primary",
							size: "sm",
							type: "button",
							disabled: interruptBusy || interruptTarget?.status !== "running",
							onClick: confirmInterruptTurn,
							children: t("interruptTurn")
						})] }),
						children: interruptTarget !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dshLiveTeamsMessage",
							children: interruptTarget.status === "running" ? t("interruptTurnKeeps") : t("noRunningTurn")
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Modal, {
						open: removeTarget !== null,
						onClose: () => {
							if (!removeBusy) setRemoveTarget(null);
						},
						title: t("removeMemberTitle"),
						closeLabel: t("cancel"),
						description: `${t("removeMemberDescription")} ${t("sessionContinues")}`,
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
							variant: "outline",
							size: "sm",
							type: "button",
							disabled: removeBusy,
							onClick: () => setRemoveTarget(null),
							children: t("cancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
							variant: "primary",
							size: "sm",
							type: "button",
							disabled: removeBusy,
							onClick: confirmRemoveMember,
							children: t("removeMemberConfirm")
						})] }),
						children: removeTarget !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dshLiveTeamsMessage",
							children: t("auditRecorded")
						})
					}),
					members.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dshLiveTeamsMessage",
						children: t("empty")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						className: "dshLiveTeamsRows",
						children: members.map((member) => {
							const expanded = expandedMembers.has(member.memberId);
							const paused = member.availability === "paused";
							const assignments = memberTaskReferences(taskSummaries, member.memberId);
							return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", {
								className: `dshLiveTeamsRow${expanded ? " dshLiveTeamsRowSelected" : ""}`,
								"data-role": member.role,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									"aria-haspopup": "dialog",
									title: member.availability === "available" ? t("available") : member.availability === "paused" ? t("pausedState") : member.availability,
									className: "dshLiveTeamsMemberCollapsed",
									"aria-expanded": expanded,
									onClick: () => toggleMemberPanel(member.memberId),
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RoleAvatar, {
											role: member.role,
											label: roleOptions.find((role) => role.id === member.role)?.name ?? member.role,
											roles: roleData?.roles ?? []
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: "dshLiveTeamsMemberCopy",
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
													className: "dshLiveTeamsMemberName",
													children: member.displayName
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
													className: `dshLiveTeamsMemberLive${member.live ? " dshLiveTeamsMemberLiveOn" : ""}`,
													children: [
														"● ",
														member.live ? t("live") : t("notLive"),
														" · ",
														statusLabel(member, t)
													]
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dshLiveTeamsMemberChip",
													children: roleOptions.find((role) => role.id === member.role)?.name ?? member.role
												})
											]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dshLiveTeamsMemberMenu",
											"aria-hidden": "true",
											children: "⋮"
										}),
										paused ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dshLiveTeamsMemberPaused",
											children: t("pausedState")
										}) : null,
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dshLiveTeamsMemberTask",
											title: assignments.map((task) => task.title).join("; "),
											children: assignments.length === 0 ? t("noAssignedTask") : `${t("assignedTasks")}: ${assignments[0]?.title}${assignments.length > 1 ? ` +${assignments.length - 1}` : ""}`
										}),
										member.note?.trim() ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dshLiveTeamsMemberNote",
											children: member.note
										}) : null
									]
								})
							}, member.memberId);
						})
					})
				]
			});
			const tasksPanel = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "dshLiveTeamsCard dshLiveTeamsTasks dshLiveTeamsListPanel",
				"aria-labelledby": "dsh-live-teams-tasks-title",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dshLiveTeamsCardTitle",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
							className: "dshLiveTeamsCardTitleText",
							id: "dsh-live-teams-tasks-title",
							children: t("tasksTitle")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dshLiveTeamsTaskControls",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									className: "dshLiveTeamsTaskNew",
									type: "button",
									disabled: draftBusy,
									onClick: openNewTask,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconPlus, { size: 14 }), t("taskNew")]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dshLiveTeamsSegmented dshLiveTeamsTaskFilter",
									role: "group",
									"aria-label": t("taskFilters"),
									children: [
										"active",
										"waiting",
										"archived"
									].map((filter) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										className: `dshLiveTeamsSegmentedButton dshLiveTeamsTaskFilterButton${taskFilter === filter ? " dshLiveTeamsSegmentedButtonActive dshLiveTeamsTaskFilterButtonActive" : ""}`,
										type: "button",
										"aria-pressed": taskFilter === filter,
										onClick: () => setTaskFilter(filter),
										children: [t(taskFilterKeys[filter]), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dshLiveTeamsKindCount",
											children: taskSummaries.filter((task) => taskMatchesFilter(task, filter)).length
										})]
									}, filter))
								}),
								dispatch === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: `dshLiveTeamsSegmentedButton dshLiveTeamsDispatchToggle${dispatch.paused ? " dshLiveTeamsDispatchTogglePaused" : ""}`,
									type: "button",
									disabled: dispatchBusy,
									"aria-pressed": dispatch.paused,
									title: dispatch.pausedBy === void 0 ? t("dispatchPaused") : `${t("dispatchPaused")} · ${t("dispatchPausedBy")}: ${dispatch.pausedBy}`,
									onClick: toggleDispatch,
									children: dispatch.paused ? t("dispatchResume") : t("dispatchPause")
								})
							]
						})]
					}),
					dispatch?.paused === true && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						className: "dshLiveTeamsNotice",
						role: "status",
						children: [t("dispatchPaused"), dispatch.pausedReason === void 0 ? "" : ` — ${dispatch.pausedReason}`]
					}),
					taskNotice !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dshLiveTeamsNotice",
						role: "status",
						children: taskNotice
					}),
					taskLoading && taskSummaries.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dshLiveTeamsMessage",
						children: t("loading")
					}) : visibleTasks.length === 0 ? taskNotice === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dshLiveTeamsTaskEmpty",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TeamGlyph, { kind: "task" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("tasksEmpty") })]
					}) : null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						className: "dshLiveTeamsTaskList",
						children: visibleTasks.map((summary) => {
							const expanded = taskExpanded === summary.id;
							const detail = taskDetails[summary.id];
							const canDecide = summary.awaitsDecision === true;
							const canReturn = canDecide || awaitsLead(summary) && summary.reviewReturn !== void 0 && ["failed", "blocked"].includes(summary.reviewReturn.state);
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
								className: "dshLiveTeamsTaskRow",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									className: "dshLiveTeamsTaskSummary",
									type: "button",
									"aria-expanded": expanded,
									onClick: () => expanded ? setTaskExpanded(null) : loadTaskDetail(summary),
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: `dshLiveTeamsTaskDisclosure${expanded ? " dshLiveTeamsTaskDisclosureOpen" : ""}`,
											"aria-hidden": "true",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TeamGlyph, { kind: "task" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dshLiveTeamsTaskChevron",
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconChevronDown, { size: 10 })
											})]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: "dshLiveTeamsTaskIdentity",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
												className: "dshLiveTeamsTaskTitle",
												children: summary.title
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: "dshLiveTeamsTaskMetadata",
												children: [
													summary.reviewReturn === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dshLiveTeamsTaskQueued",
														"data-review-return-state": summary.reviewReturn.state,
														title: summary.reviewReturn.reason,
														children: t(reviewReturnKeys[summary.reviewReturn.state])
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dshLiveTeamsTaskRoute",
														children: routeWords(summary.route)
													}),
													summary.blockedBy === void 0 || summary.blockedBy.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dshLiveTeamsTaskBlocked",
														title: blockerWords(summary.blockedBy, t),
														children: t("taskBlocked")
													}),
													(() => {
														const verdict = dispatch?.tasks.find((entry) => entry.taskId === summary.id);
														const key = verdict === void 0 ? void 0 : DISPATCH_CHIP_KEYS[verdict.reason];
														return key === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "dshLiveTeamsTaskQueued",
															title: verdict?.detail,
															children: t(key)
														});
													})(),
													(() => {
														const verdict = dispatch?.tasks.find((entry) => entry.taskId === summary.id);
														return verdict?.stalled === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
															className: "dshLiveTeamsTaskIntervened",
															title: verdict.stalled.detail,
															children: [t("taskStalled"), t(verdict.stalled.reason === "unacknowledged" ? "taskStalledUnacknowledged" : "taskStalledIdle")]
														});
													})()
												]
											})]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: "dshLiveTeamsTaskOwner",
											title: t("taskAssignee"),
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: t("taskAssignee") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: summary.assigneeName ?? members.find((member) => member.memberId === summary.assignee)?.displayName ?? summary.assignee ?? "—" })]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: "dshLiveTeamsTaskStage",
											"data-status": summary.status,
											"data-route": summary.route?.type,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: t("taskStage") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dshLiveTeamsTaskStatus",
												title: taskStatusLabel(summary.status, t),
												children: t(taskDecisionStage(summary) ?? taskStatusKeys[summary.status])
											})]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dshLiveTeamsTaskRound",
											children: summary.round === void 0 || summary.roundLimit === void 0 ? "—" : `${summary.round}/${summary.roundLimit}`
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: "dshLiveTeamsTaskAge",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: t("lastActivity") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: taskAge(summary.updatedAt) })]
										})
									]
								}), expanded && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dshLiveTeamsTaskDetail",
									children: detail === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("loading") }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [
											t("taskAssignee"),
											": ",
											detail.task.assignee ?? summary.assigneeName ?? "—"
										] }),
										detail.task.reviewReturn === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: t("reviewReturnHeading") }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
											className: "dshLiveTeamsNotice",
											role: "status",
											"data-review-return-state": detail.task.reviewReturn.state,
											children: [
												t(reviewReturnKeys[detail.task.reviewReturn.state]),
												detail.task.reviewReturn.reason === void 0 ? "" : ` — ${detail.task.reviewReturn.reason}`,
												detail.task.reviewReturn.leadNotified === true || reviewReturnNoticeClass(detail.task.reviewReturn) === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [" · ", t("reviewReturnLeadPending")] })
											]
										})] }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: t("taskAttempts") }),
										detail.attempts.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("taskNoAttempts") }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
											className: "dshLiveTeamsTaskAttempts",
											children: detail.attempts.map((attempt) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: attempt.generation }),
												" — ",
												members.find((entry) => entry.memberId === attempt.memberId)?.displayName ?? attempt.memberId,
												": ",
												t(attemptStatusKeys[attempt.status]),
												attempt.humanIntervenedAt === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dshLiveTeamsTaskIntervened",
													title: t("attemptHumanIntervened"),
													children: t("taskIntervened")
												})
											] }, attempt.id))
										}),
										summary.blockedBy === void 0 || summary.blockedBy.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: t("taskBlockedBy") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", { children: summary.blockedBy.map((blocker) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [
											blocker.title,
											" — ",
											taskStatusLabel(blocker.status, t)
										] }, blocker.id)) })] }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: t("taskAcceptance") }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", { children: detail.task.acceptance.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: item }, item)) }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: t("taskDocument") }),
										detail.documentMissing === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("taskDocumentMissing") }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", { children: detail.document || "—" }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: t("taskSubmissions") }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", { children: detail.submissions.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: item.summary }),
											" — ",
											artifactLabel(item.artifact),
											item.scope === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: `dshLiveTeamsSubmissionScope dshLiveTeamsScope${item.scope.state}`,
												title: scopeTitle(item.scope, t),
												children: t(scopeKeys[item.scope.state])
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", { children: item.checks.map((check) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [
												check.status,
												": ",
												check.command
											] }, `${item.id}-${check.command}`)) })
										] }, item.id)) }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: t("taskReviewRounds") }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ol", { children: detail.rounds.map((round) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: [
												round.round,
												": ",
												round.verdict
											] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", { children: round.findings.map((finding) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [
												finding.severity,
												": ",
												finding.problem
											] }, `${round.id}-${finding.problem}`)) }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", { children: round.evidence.map((check) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [
												check.status,
												": ",
												check.command
											] }, `${round.id}-${check.command}`)) })
										] }, round.id)) }),
										(summary.status === "draft" || summary.status === "ready") && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dshLiveTeamsTaskActions",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
												variant: "outline",
												size: "sm",
												type: "button",
												disabled: draftBusy,
												onClick: () => openContract(summary, detail),
												children: t("taskEditContract")
											}), summary.status === "draft" && detail.task.assignee !== void 0 && detail.task.route !== void 0 && detail.task.acceptance.length > 0 && !detail.attempts.some((attempt) => attempt.status === "active" || attempt.status === "revoking") && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
												variant: "primary",
												size: "sm",
												type: "button",
												disabled: draftBusy || taskBusy !== null,
												onClick: () => resumeTask(summary),
												children: t("taskResume")
											})]
										}),
										summary.status !== "completed" && summary.status !== "cancelled" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dshLiveTeamsTaskActions",
											children: [detail.attempts.some((attempt) => attempt.id === detail.task.activeAttemptId && (attempt.status === "active" || attempt.status === "revoking")) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
												variant: "outline",
												size: "sm",
												type: "button",
												disabled: draftBusy,
												onClick: () => {
													setReleaseReason("");
													setReleaseTarget(summary);
												},
												children: t("taskRelease")
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
												variant: "outline",
												size: "sm",
												type: "button",
												disabled: draftBusy,
												onClick: () => {
													setTaskNotice(null);
													setTaskInstructions("");
													setTaskConfirm({
														kind: "cancel",
														task: summary
													});
												},
												children: t("taskClose")
											})]
										}),
										canReturn && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dshLiveTeamsTaskActions",
											children: [canDecide && detail.documentMissing !== true && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
												variant: "primary",
												size: "sm",
												type: "button",
												onClick: () => {
													setTaskNotice(null);
													setTaskNote("");
													setTaskConfirm({
														kind: "accept",
														task: summary
													});
												},
												children: t("taskAccept")
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
												variant: "outline",
												size: "sm",
												type: "button",
												onClick: () => {
													setTaskNotice(null);
													setTaskInstructions("");
													setTaskConfirm({
														kind: "revise",
														task: summary
													});
												},
												children: t("taskRevise")
											})]
										})
									] })
								})]
							}, summary.id);
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Modal, {
						open: taskDraft !== null,
						onClose: () => {
							if (!draftBusy) setTaskDraft(null);
						},
						title: taskDraft?.editing === void 0 ? t("taskNewTitle") : t("taskEditTitle"),
						closeLabel: t("cancel"),
						description: t("taskDraftDescription"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
							variant: "outline",
							size: "sm",
							type: "button",
							disabled: draftBusy,
							onClick: () => setTaskDraft(null),
							children: t("cancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
							variant: "primary",
							size: "sm",
							type: "button",
							disabled: draftBusy || draftTitle.trim().length === 0 || draftAssignee.length === 0 || lines(draftAcceptance).length === 0 || draftRoute === "review" && draftReviewer.length === 0,
							onClick: saveDraft,
							children: t("taskSave")
						})] }),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dshLiveTeamsModalFields",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: "dshLiveTeamsModalField",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dshLiveTeamsFieldLabel",
										children: t("taskTitleLabel")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "text",
										value: draftTitle,
										disabled: draftBusy,
										onChange: (event) => setDraftTitle(event.target.value)
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: "dshLiveTeamsModalField",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dshLiveTeamsFieldLabel",
										children: t("taskKind")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
										value: draftKind,
										disabled: draftBusy || taskDraft?.editing !== void 0,
										onChange: (event) => setDraftKind(event.target.value),
										children: [
											"implementation",
											"research",
											"requirements",
											"verification",
											"repair",
											"integration",
											"work"
										].map((kind) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: kind,
											children: t(`taskKind${kind}`)
										}, kind))
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: "dshLiveTeamsModalField",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dshLiveTeamsFieldLabel",
										children: t("taskAssignee")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
										value: draftAssignee,
										disabled: draftBusy,
										onChange: (event) => setDraftAssignee(event.target.value),
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "",
											children: "—"
										}), members.map((member) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: member.memberId,
											children: member.displayName
										}, member.memberId))]
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: "dshLiveTeamsModalField",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dshLiveTeamsFieldLabel",
										children: t("taskRoute")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
										value: draftRoute,
										disabled: draftBusy,
										onChange: (event) => setDraftRoute(event.target.value === "review" ? "review" : "report"),
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "report",
											children: t("taskRouteReport")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "review",
											children: t("taskRouteReview")
										})]
									})]
								}),
								draftRoute === "review" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: "dshLiveTeamsModalField",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dshLiveTeamsFieldLabel",
										children: t("taskReviewer")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
										value: draftReviewer,
										disabled: draftBusy,
										onChange: (event) => setDraftReviewer(event.target.value),
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "",
											children: "—"
										}), members.filter((member) => member.memberId !== draftAssignee).map((member) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: member.memberId,
											children: member.displayName
										}, member.memberId))]
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: "dshLiveTeamsModalField",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dshLiveTeamsFieldLabel",
										children: t("taskPaths")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "text",
										value: draftPaths,
										disabled: draftBusy,
										onChange: (event) => setDraftPaths(event.target.value)
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: "dshLiveTeamsModalField",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dshLiveTeamsFieldLabel",
										children: t("taskAcceptanceLabel")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
										value: draftAcceptance,
										disabled: draftBusy,
										onChange: (event) => setDraftAcceptance(event.target.value)
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: "dshLiveTeamsModalField",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dshLiveTeamsFieldLabel",
										children: t("taskChecksLabel")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
										value: draftChecks,
										disabled: draftBusy,
										onChange: (event) => setDraftChecks(event.target.value)
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: "dshLiveTeamsModalField",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dshLiveTeamsFieldLabel",
										children: t("taskBodyLabel")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
										value: draftBody,
										disabled: draftBusy,
										onChange: (event) => setDraftBody(event.target.value)
									})]
								})
							]
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Modal, {
						open: releaseTarget !== null,
						onClose: () => {
							if (!draftBusy) setReleaseTarget(null);
						},
						title: t("taskReleaseTitle"),
						closeLabel: t("cancel"),
						description: t("taskReleaseDescription"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
							variant: "outline",
							size: "sm",
							type: "button",
							disabled: draftBusy,
							onClick: () => setReleaseTarget(null),
							children: t("cancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
							variant: "primary",
							size: "sm",
							type: "button",
							disabled: draftBusy || releaseReason.trim().length === 0,
							onClick: releaseAttempt,
							children: t("taskRelease")
						})] }),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: "dshLiveTeamsModalField",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dshLiveTeamsFieldLabel",
								children: t("taskReleaseReason")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
								value: releaseReason,
								disabled: draftBusy,
								onChange: (event) => setReleaseReason(event.target.value)
							})]
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Modal, {
						open: taskConfirm !== null,
						onClose: () => {
							if (taskBusy === null) setTaskConfirm(null);
						},
						title: taskConfirm?.kind === "accept" ? t("taskAcceptTitle") : taskConfirm?.kind === "cancel" ? t("taskCloseTitle") : t("taskReviseTitle"),
						closeLabel: t("cancel"),
						description: taskConfirm?.kind === "accept" ? t("taskAcceptDescription") : taskConfirm?.kind === "cancel" ? t("taskCloseDescription") : t("taskReviseDescription"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
							variant: "outline",
							size: "sm",
							type: "button",
							onClick: () => setTaskConfirm(null),
							children: t("cancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
							variant: "primary",
							size: "sm",
							type: "button",
							disabled: taskBusy !== null || (taskConfirm?.kind === "revise" || taskConfirm?.kind === "cancel") && taskInstructions.trim().length === 0,
							onClick: () => {
								if (taskConfirm !== null) runTaskAction(taskConfirm.kind, taskConfirm.task);
							},
							children: taskConfirm?.kind === "accept" ? t("taskAccept") : taskConfirm?.kind === "cancel" ? t("taskClose") : t("taskRevise")
						})] }),
						children: [taskNotice !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dshLiveTeamsMessage",
							children: taskNotice
						}), taskConfirm?.kind === "cancel" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: "dshLiveTeamsModalField",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dshLiveTeamsFieldLabel",
								children: t("taskCloseReason")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
								value: taskInstructions,
								onChange: (event) => setTaskInstructions(event.target.value)
							})]
						}) : taskConfirm?.kind === "accept" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: "dshLiveTeamsModalField",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dshLiveTeamsFieldLabel",
								children: t("taskAcceptNote")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
								value: taskNote,
								onChange: (event) => setTaskNote(event.target.value)
							})]
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: "dshLiveTeamsModalField",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dshLiveTeamsFieldLabel",
								children: t("taskReviseInstructions")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
								value: taskInstructions,
								onChange: (event) => setTaskInstructions(event.target.value)
							})]
						})]
					})
				]
			});
			const journalPanel = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "dshLiveTeamsCard dshLiveTeamsJournal",
				"aria-labelledby": "dsh-live-teams-journal-title",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dshLiveTeamsCardTitle",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								className: "dshLiveTeamsCardTitleText",
								id: "dsh-live-teams-journal-title",
								children: t("journalTitle")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dshLiveTeamsJournalControls",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									className: `dshLiveTeamsInboxButton${attentionWaiting > 0 ? " dshLiveTeamsInboxButtonUnread" : ""}`,
									type: "button",
									onClick: () => setInboxExpanded(true),
									children: [t("messagesTitle"), attentionWaiting > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dshLiveTeamsInboxCount",
										children: attentionWaiting
									}) : null]
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dshLiveTeamsActivityModes",
								role: "group",
								"aria-label": t("journalModes"),
								children: [
									"important",
									"all",
									"technical"
								].map((mode) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: `dshLiveTeamsSegmentedButton${activityMode === mode ? " dshLiveTeamsSegmentedButtonActive" : ""}`,
									type: "button",
									"aria-pressed": activityMode === mode,
									onClick: () => {
										setActivityMode(mode);
										setJournalFilters(new Set(journalCategories));
									},
									children: t(activityModeKeys[mode])
								}, mode))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
								className: "dshLiveTeamsActivityCategories",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: t("journalFilters") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dshLiveTeamsSegmented dshLiveTeamsJournalFilters",
									role: "group",
									"aria-label": t("journalFilters"),
									children: journalCategories.map((category) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										className: `dshLiveTeamsSegmentedButton dshLiveTeamsJournalFilter dshLiveTeamsJournalFilter-${category}${journalFilters.has(category) ? " dshLiveTeamsSegmentedButtonActive dshLiveTeamsJournalFilterActive" : ""}`,
										type: "button",
										"aria-pressed": journalFilters.has(category),
										onClick: () => toggleJournalFilter(category),
										children: [t(journalCategoryKeys[category]), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dshLiveTeamsKindCount",
											children: journal.filter((entry) => entry.category === category).length
										})]
									}, category))
								})]
							})
						]
					}),
					journalNotice !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dshLiveTeamsNotice",
						role: "status",
						children: journalNotice
					}),
					journalLoading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dshLiveTeamsMessage",
						children: t("loading")
					}) : visibleJournal.length === 0 ? journalNotice === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dshLiveTeamsMessage",
						children: t(journal.length === 0 ? "journalEmpty" : "journalNoMatches")
					}) : null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						className: "dshLiveTeamsJournalList",
						children: visibleJournal.map((entry) => {
							const expanded = journalExpanded === entry.id;
							const heading = activityHeading(entry);
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
								className: `dshLiveTeamsJournalRow${expanded ? " dshLiveTeamsJournalRowOpen" : ""}`,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									className: "dshLiveTeamsJournalLine",
									type: "button",
									"aria-expanded": expanded,
									onClick: () => {
										setJournalExpanded(expanded ? null : entry.id);
										setJournalRaw(false);
										const taskId = entry.refs.taskId;
										if (!expanded && taskId !== void 0 && journalTask[taskId] === void 0) fetchTeamTask(taskId, session).then((detail) => setJournalTask((current) => ({
											...current,
											[taskId]: detail
										}))).catch(() => void 0);
									},
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: `dshLiveTeamsJournalIcon dshLiveTeamsJournalIcon-${entry.category}`,
											"aria-hidden": "true",
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TeamGlyph, { kind: entry.category === "message" ? "message" : entry.category === "review" ? "review" : entry.category === "task" ? "task" : "event" })
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: `dshLiveTeamsJournalKind dshLiveTeamsJournalKind-${entry.category}`,
											children: t(journalCategoryKeys[entry.category])
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dshLiveTeamsJournalSummary",
											title: entry.summary,
											children: heading.parts === void 0 ? heading.summary : heading.parts.map((part, index) => part.strong === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: part.text }, index) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: part.text }, index))
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: "dshLiveTeamsJournalRefs",
											children: [
												entry.refs.taskTitle !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dshLiveTeamsJournalTaskRef",
													title: entry.refs.taskTitle,
													children: entry.refs.taskTitle
												}),
												entry.refs.taskId !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dshLiveTeamsJournalTaskId",
													children: entry.refs.taskId
												}),
												entry.refs.round === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
													className: "dshLiveTeamsJournalRoundRef",
													children: [
														t("journalRound"),
														" ",
														entry.refs.round
													]
												})
											]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("time", {
											className: "dshLiveTeamsJournalTime",
											dateTime: new Date(entry.at).toISOString(),
											children: formatJournalTime(entry.at)
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: `dshLiveTeamsJournalDisclosure${expanded ? " dshLiveTeamsJournalDisclosureOpen" : ""}`,
											"aria-hidden": "true",
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconChevronDown, { size: 14 })
										})
									]
								}), expanded && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dshLiveTeamsJournalDetailPanel",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: "dshLiveTeamsJournalSourceSummary",
											children: entry.summary
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dl", {
											className: "dshLiveTeamsJournalFields",
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "dshLiveTeamsJournalField",
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: t("journalEventKind") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: entry.kind }) })]
												}),
												entry.refs.taskId === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "dshLiveTeamsJournalField",
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "ID" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: entry.refs.taskId })]
												}),
												(entry.fields ?? []).map((field) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "dshLiveTeamsJournalField",
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: field.label }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: field.value })]
												}, `${field.label}:${field.value}`))
											]
										}),
										entry.refs.taskId === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dshLiveTeamsJournalBody",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dshLiveTeamsFieldLabel",
												children: t("journalTask")
											}), (() => {
												const detail = journalTask[entry.refs.taskId];
												if (detail === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
													className: "dshLiveTeamsJournalPending",
													children: t("loading")
												});
												return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
														className: "dshLiveTeamsJournalTaskLine",
														children: [
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: detail.task.title }),
															" — ",
															taskStatusLabel(detail.task.status, t)
														]
													}),
													detail.task.acceptance.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
														className: "dshLiveTeamsJournalAcceptance",
														children: detail.task.acceptance.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: item }, item))
													}),
													detail.documentMissing === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
														className: "dshLiveTeamsJournalPending",
														children: t("taskDocumentMissing")
													}) : journalRaw ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
														className: "dshLiveTeamsJournalRaw dshLiveTeamsJournalRawTask",
														children: detail.document
													}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
														className: "dshLiveTeamsJournalMarkdown",
														children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MarkdownText, {
															text: detail.document,
															labels: {
																code: {
																	copyLabel: t("copy"),
																	copiedLabel: t("copied")
																},
																footnotes: t("markdownFootnotes")
															}
														})
													})
												] });
											})()]
										}),
										entry.detail === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dshLiveTeamsJournalBody",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dshLiveTeamsJournalBodyHead",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dshLiveTeamsFieldLabel",
													children: t("journalBody")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													className: "dshLiveTeamsJournalRawToggle",
													type: "button",
													"aria-pressed": journalRaw,
													onClick: () => setJournalRaw(!journalRaw),
													children: journalRaw ? t("journalRendered") : t("journalRaw")
												})]
											}), journalRaw ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
												className: "dshLiveTeamsJournalRaw dshLiveTeamsJournalRawMessage",
												children: entry.detail
											}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "dshLiveTeamsJournalMarkdown",
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MarkdownText, {
													text: entry.detail,
													labels: {
														code: {
															copyLabel: t("copy"),
															copiedLabel: t("copied")
														},
														footnotes: t("markdownFootnotes")
													}
												})
											})]
										})
									]
								})]
							}, entry.id);
						})
					})
				]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
				className: "dshLiveTeamsRoot dshLiveTeamsTaskFirst",
				"aria-label": t("title"),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dshLiveTeamsShell",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dshLiveTeamsHead",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
								className: "dshLiveTeamsCard dshLiveTeamsSummary",
								"aria-labelledby": "dsh-live-teams-summary-title",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dshLiveTeamsSectionHeader",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
											id: "dsh-live-teams-summary-title",
											children: teamState?.teamName ?? snapshot?.teamName ?? t("title")
										})
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dl", {
										className: "dshLiveTeamsSummaryGrid",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Stat, {
												label: t("totalMembers"),
												value: members.length
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Stat, {
												label: t("liveMembers"),
												value: liveCount,
												hidden: true
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Stat, {
												label: t("pausedMembers"),
												value: pausedCount,
												hidden: pausedCount === 0
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Stat, {
												label: t("unboundMembers"),
												value: unboundCount,
												hidden: unboundCount === 0
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Stat, {
												label: t("activeTasks"),
												value: activeTaskCount
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Stat, {
												label: t("awaitingLead"),
												value: awaitingLeadCount
											})
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dshLiveTeamsOverviewActions",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											className: "dshLiveTeamsIconButton",
											type: "button",
											onClick: () => refresh(),
											disabled: loading,
											"aria-label": t("refresh"),
											title: t("refresh"),
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconRefresh, {})
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
											className: "dshLiveTeamsSettingsToggle",
											type: "button",
											"aria-expanded": settingsOpen,
											"aria-haspopup": "dialog",
											onClick: () => {
												setExpandedMembers(/* @__PURE__ */ new Set());
												setSettingsOpen(true);
											},
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TeamGlyph, { kind: "settings" }), t("teamSettings")]
										})]
									})
								]
							})
						}),
						notice !== null && !settingsOpen && selectedMember === void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dshLiveTeamsNotice",
							role: "status",
							children: notice
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dshLiveTeamsMain",
							children: [
								tasksPanel,
								membersPanel,
								journalPanel
							]
						}),
						inboxExpanded && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dshLiveTeamsOverlay",
							role: "presentation",
							onClick: () => setInboxExpanded(false),
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dshLiveTeamsDialog",
								role: "dialog",
								"aria-modal": "true",
								"aria-label": t("messagesTitle"),
								onClick: (event) => event.stopPropagation(),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dshLiveTeamsDialogHead",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
											className: "dshLiveTeamsDialogTitle",
											children: t("messagesTitle")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: "dshLiveTeamsDialogDescription",
											children: attentionWaiting > 0 ? `${attentionWaiting} ${t("unread")}` : t("inboxEmpty")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											className: "dshLiveTeamsDialogClose",
											type: "button",
											"aria-label": t("cancel"),
											onClick: () => setInboxExpanded(false),
											children: "×"
										})
									]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dshLiveTeamsDialogBody",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dshLiveTeamsComposer",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
												className: "dshLiveTeamsModalField",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dshLiveTeamsFieldLabel",
													children: t("messageRecipient")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
													value: messageTo,
													disabled: messageBusy,
													onChange: (event) => setMessageTo(event.target.value),
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
															value: "",
															children: t("chooseRecipient")
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
															value: "team",
															children: t("wholeTeam")
														}),
														members.map((member) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
															value: member.memberId,
															children: member.displayName
														}, member.memberId))
													]
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
												className: "dshLiveTeamsModalField",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dshLiveTeamsFieldLabel",
													children: t("messageKind")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
													value: messageKind,
													disabled: messageBusy,
													onChange: (event) => setMessageKind(event.target.value),
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
															value: "",
															children: t("chooseMessageKind")
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
															value: "message",
															children: [
																t("messageKindMessage"),
																" — ",
																t("messageKindMessageHint")
															]
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
															value: "direction",
															children: [
																t("messageKindDirection"),
																" — ",
																t("messageKindDirectionHint")
															]
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
															value: "comment",
															children: [
																t("messageKindComment"),
																" — ",
																t("messageKindCommentHint")
															]
														})
													]
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
												className: "dshLiveTeamsModalField",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dshLiveTeamsFieldLabel",
													children: t("messageContent")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
													value: messageContent,
													disabled: messageBusy,
													maxLength: 8e3,
													onChange: (event) => setMessageContent(event.target.value)
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
												variant: "primary",
												size: "sm",
												type: "button",
												disabled: messageBusy || messageTo.length === 0 || messageKind === "" || messageContent.trim().length === 0,
												onClick: sendMessage,
												children: t("sendMessage")
											})
										]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dshLiveTeamsInbox",
										"aria-live": "polite",
										children: inboxLoading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: "dshLiveTeamsMessage",
											children: t("loading")
										}) : inbox.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: "dshLiveTeamsMessage",
											children: t("inboxEmpty")
										}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
											className: "dshLiveTeamsInboxList",
											children: inbox.map((message) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
												className: "dshLiveTeamsInboxRow",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: message.fromName }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dshLiveTeamsInboxKind",
														children: t(messageKindKeys[message.kind])
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: message.content })
												] }), message.delivery.state === "acknowledged" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dshLiveTeamsInboxAcknowledged",
													children: t("acknowledged")
												}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
													variant: "outline",
													size: "sm",
													type: "button",
													onClick: () => acknowledgeMessage(message),
													children: t("acknowledge")
												})]
											}, message.delivery.id))
										})
									})]
								})]
							})
						}),
						settingsOpen && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SidePanel, {
							title: t("teamSettings"),
							closeLabel: t("closePanel"),
							busy: teamBusy,
							onClose: () => setSettingsOpen(false),
							children: settingsPanel
						}),
						selectedMember !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(SidePanel, {
							title: t("memberSettingsTitle"),
							closeLabel: t("closePanel"),
							busy: busy.size > 0 || roleBusy.size > 0 || removeBusy || interruptBusy || grantBusy !== null,
							onClose: () => setExpandedMembers(/* @__PURE__ */ new Set()),
							children: [notice !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dshLiveTeamsNotice dshLiveTeamsMemberFeedback",
								role: "status",
								children: notice
							}), members.filter((member) => expandedMembers.has(member.memberId)).map((member) => {
								const rowBusy = busy.has(member.memberId);
								const editing = editingName === member.memberId;
								const roleInputId = `dsh-live-teams-role-${member.memberId}`;
								const nameInputId = `dsh-live-teams-name-${member.memberId}`;
								const nameErrorId = `${nameInputId}-error`;
								const paused = member.availability === "paused";
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
									className: "dshLiveTeamsMemberPanel dshLiveTeamsMemberSettings",
									"data-role": member.role,
									"data-member": member.memberId,
									"aria-label": member.displayName,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dshLiveTeamsMemberHeading",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RoleAvatar, {
												role: member.role,
												label: roleById.get(member.role)?.name ?? member.role,
												roles: roleData?.roles ?? []
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dshLiveTeamsMemberIdentity",
												children: [
													editing ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
														className: "dshLiveTeamsVisuallyHidden",
														htmlFor: nameInputId,
														children: t("name")
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
														ref: nameInputRef,
														className: "dshLiveTeamsNameInput",
														id: nameInputId,
														type: "text",
														value: nameDrafts[member.memberId] ?? member.displayName,
														disabled: rowBusy || removeBusy,
														"aria-invalid": (nameDrafts[member.memberId] ?? "").trim().length === 0,
														"aria-describedby": nameErrorId,
														onChange: (event) => setNameDrafts((current) => ({
															...current,
															[member.memberId]: event.target.value
														})),
														onKeyDown: (event) => {
															if (event.key === "Enter") {
																event.preventDefault();
																applyName(member);
															} else if (event.key === "Escape") {
																event.preventDefault();
																cancelNameEdit(member);
															}
														}
													})] }) : null,
													!editing && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Tooltip, {
														label: t("openSession"),
														disabled: member.sessionId === null,
														children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															className: "dshLiveTeamsMemberAction",
															type: "button",
															disabled: member.sessionId === null,
															onClick: () => openMember(member),
															children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
																className: "dshLiveTeamsMemberName",
																children: member.displayName
															})
														})
													}),
													!editing && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														ref: (element) => {
															nameEditButtons.current[member.memberId] = element;
														},
														className: "dshLiveTeamsEditNameButton",
														type: "button",
														disabled: rowBusy || removeBusy,
														onClick: () => beginNameEdit(member),
														"aria-label": t("editName"),
														title: t("editName"),
														children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconEdit, { size: 14 })
													}),
													editing && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: "dshLiveTeamsNameActions",
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
															variant: "outline",
															size: "sm",
															type: "button",
															disabled: rowBusy || removeBusy || (nameDrafts[member.memberId] ?? "").trim().length === 0,
															onClick: () => applyName(member),
															children: t("save")
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
															variant: "outline",
															size: "sm",
															type: "button",
															disabled: rowBusy || removeBusy,
															onClick: () => cancelNameEdit(member),
															children: t("cancel")
														})]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
														className: "dshLiveTeamsState",
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "dshLiveTeamsStateDot",
															children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StateDot, { state: stateDot(member) })
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "dshLiveTeamsStateLabel",
															children: stateText(member, t)
														})]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dshLiveTeamsMemberRoleCaption",
														children: roleById.get(member.role)?.name ?? member.role
													})
												]
											})]
										}),
										editing && (nameDrafts[member.memberId] ?? "").trim().length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: "dshLiveTeamsFieldError",
											id: nameErrorId,
											children: t("nameRequired")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
											className: "dshLiveTeamsMemberSection",
											"data-member-section": "role",
											"aria-label": t("memberRoleHeading"),
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: t("memberRoleHeading") }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
													className: "dshLiveTeamsSectionHint",
													children: t("memberRoleHint")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "dshLiveTeamsControls",
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: "dshLiveTeamsRoleField",
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
															className: "dshLiveTeamsFieldLabel",
															htmlFor: roleInputId,
															children: t("role")
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
															className: "dshLiveTeamsRoleInput",
															id: roleInputId,
															value: roleDrafts[member.memberId] ?? member.role,
															disabled: rowBusy || removeBusy || roleLoading,
															onChange: (event) => setRoleDrafts((current) => ({
																...current,
																[member.memberId]: event.target.value
															})),
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																value: member.role,
																children: roleById.has(member.role) ? roleById.get(member.role)?.name : `${member.role} (${t("unknownRole")})`
															}), roleOptions.filter((role) => role.id !== member.role).map((role) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																value: role.id,
																children: role.name
															}, role.id))]
														})]
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
														variant: "outline",
														size: "sm",
														className: "dshLiveTeamsApply",
														type: "button",
														disabled: rowBusy || removeBusy,
														onClick: () => applyRole(member),
														children: t("apply")
													})]
												}),
												(roleDrafts[member.memberId] ?? member.role) !== member.role && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
													className: "dshLiveTeamsDraftHint",
													children: t("memberRolePending")
												}),
												roleById.get(roleDrafts[member.memberId] ?? member.role)?.description && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
													className: "dshLiveTeamsSectionHint",
													children: roleById.get(roleDrafts[member.memberId] ?? member.role)?.description
												})
											]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
											className: "dshLiveTeamsMemberSection",
											"data-member-section": "availability",
											"aria-label": t("memberAvailabilityHeading"),
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: t("memberAvailabilityHeading") }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
													className: "dshLiveTeamsSectionHint",
													children: t("memberAvailabilityHint")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "dshLiveTeamsMemberActions",
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Tag, {
														className: "dshLiveTeamsAvailabilityTag",
														tone: "neutral",
														children: paused ? t("pausedState") : member.availability === "available" ? t("available") : member.availability
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
														className: "dshLiveTeamsIconButton dshLiveTeamsAvailabilityAction",
														type: "button",
														disabled: rowBusy || removeBusy,
														onClick: () => toggleAvailability(member),
														"aria-label": paused ? t("memberResumeAssignments") : t("memberPauseAssignments"),
														title: paused ? t("memberResumeAssignments") : t("memberPauseAssignments"),
														children: [paused ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconPlay, { size: 14 }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconPause, { size: 14 }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: paused ? t("memberResumeAssignments") : t("memberPauseAssignments") })]
													})]
												})
											]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
											className: "dshLiveTeamsMemberSection",
											"data-member-section": "contacts",
											"aria-label": t("permittedContacts"),
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dshLiveTeamsContactGrant",
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: t("permittedContacts") }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
														className: "dshLiveTeamsContactChips",
														children: member.permittedContacts === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
															className: "dshLiveTeamsSectionHint",
															children: t("memberContactsUnknown")
														}) : member.permittedContacts.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
															className: "dshLiveTeamsSectionHint",
															children: t("noPeerContact")
														}) : member.permittedContacts.map((contact, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "dshLiveTeamsContactChip",
															title: contact,
															children: contact === "team" ? t("memberContactTeam") : contact === "human" ? t("memberContactHuman") : members.find((candidate) => candidate.memberId === contact)?.displayName ?? contact
														}, `${contact}:${index}`))
													}),
													member.memberId === leadMemberId && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: "dshLiveTeamsGrantControls",
														children: [
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
																className: "dshLiveTeamsRoleInput dshLiveTeamsContactSelect",
																"aria-label": t("memberContactTarget"),
																value: grantTarget,
																disabled: grantBusy !== null,
																onChange: (event) => setGrantTarget(event.target.value),
																children: [
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																		value: "",
																		children: t("chooseContact")
																	}),
																	members.filter((candidate) => candidate.memberId !== member.memberId).map((candidate) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																		value: candidate.memberId,
																		children: candidate.displayName
																	}, candidate.memberId)),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																		value: "team",
																		children: t("memberContactTeam")
																	}),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																		value: "human",
																		children: t("memberContactHuman")
																	})
																]
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
																variant: "outline",
																size: "sm",
																type: "button",
																disabled: grantBusy !== null || grantTarget.length === 0,
																onClick: () => {
																	const allow = grantTarget;
																	setGrantBusy(member.memberId);
																	grantTeamContact({
																		memberId: member.memberId,
																		allow,
																		action: "add"
																	}, session).then(() => refresh()).catch((cause) => setNotice(cause instanceof LiveTeamsApiError ? cause.error : t("grantFailed"))).finally(() => setGrantBusy(null));
																},
																children: t("grant")
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
																variant: "outline",
																size: "sm",
																type: "button",
																disabled: grantBusy !== null || grantTarget.length === 0,
																onClick: () => {
																	const allow = grantTarget;
																	setGrantBusy(member.memberId);
																	grantTeamContact({
																		memberId: member.memberId,
																		allow,
																		action: "remove"
																	}, session).then(() => refresh()).catch((cause) => setNotice(cause instanceof LiveTeamsApiError ? cause.error : t("grantFailed"))).finally(() => setGrantBusy(null));
																},
																children: t("revoke")
															})
														]
													}),
													member.memberId !== leadMemberId && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dshLiveTeamsFieldLabel",
														children: t("contactGrantLeadOnly")
													})
												]
											})
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
											className: "dshLiveTeamsMemberSection",
											"data-member-section": "session",
											"aria-label": t("memberSessionHeading"),
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: t("memberSessionHeading") }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "dshLiveTeamsMemberSessionActions",
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dshLiveTeamsBindingTag",
														children: bindingLabel(member, t)
													}), !editing && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														className: "dshLiveTeamsMemberOpen",
														type: "button",
														disabled: member.sessionId === null,
														title: t("openSession"),
														onClick: () => openMember(member),
														children: t("openSessionAction")
													})]
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "dshLiveTeamsMemberTurnControl",
													children: [!editing && member.status === "running" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														className: "dshLiveTeamsInterruptButton",
														type: "button",
														disabled: rowBusy || removeBusy || interruptBusy,
														onClick: () => setInterruptTarget(member),
														"aria-label": `${t("interruptTurn")}: ${member.displayName}`,
														title: t("interruptTurn"),
														children: t("interruptTurn")
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
														className: "dshLiveTeamsSectionHint",
														children: member.status === "running" ? editing ? t("memberFinishNameFirst") : t("interruptTurnKeeps") : member.status === "unknown" ? t("memberTurnUnknown") : t("noRunningTurn")
													})]
												})
											]
										}),
										member.note?.trim() && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
											className: "dshLiveTeamsMemberSection",
											"data-member-section": "note",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: t("note") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												className: "dshLiveTeamsMemberNoteText",
												children: member.note
											})]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
											className: "dshLiveTeamsMemberTechnical",
											"data-member-section": "technical",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: t("memberTechnicalDetails") }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dl", {
												className: "dshLiveTeamsMemberMeta",
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: t("memberIdentifier") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: member.memberId }) })] }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: t("memberSessionIdentifier") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: member.sessionId ?? t("unbound") }) })] }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: t("memberBindingGeneration") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: member.bindingGeneration })] }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: t("memberContractRevision") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: member.contractRevision })] })
												]
											})]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
											className: "dshLiveTeamsMemberRemoval",
											"data-member-section": "removal",
											"aria-label": t("removeMember"),
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: t("removeMember") }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
													className: "dshLiveTeamsSectionHint",
													children: t("sessionContinues")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													className: "dshLiveTeamsMemberRemove",
													type: "button",
													disabled: rowBusy || removeBusy || interruptBusy,
													onClick: () => setRemoveTarget(member),
													"aria-label": `${t("removeMember")}: ${member.displayName}`,
													title: t("removeMember"),
													children: t("removeMember")
												})
											]
										})
									]
								}, `panel-${member.memberId}`);
							})]
						})
					]
				})
			});
		}
		function Stat(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dshLiveTeamsStat",
				hidden: props.hidden,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", {
					className: "dshLiveTeamsStatLabel",
					children: props.label
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", {
					className: "dshLiveTeamsStatValue",
					children: props.value
				})]
			});
		}
		// src/client/error-boundary.tsx
		var PanelErrorBoundary = class extends react.default.Component {
			state = {};
			static getDerivedStateFromError(error) {
				return { message: error instanceof Error ? error.message : String(error) };
			}
			componentDidCatch(error, info) {
				console.error(`live-teams: the ${this.props.label} failed to render`, error, info.componentStack);
				const stack = info.componentStack;
				this.setState(stack === null || stack === void 0 ? {} : { stack });
			}
			render() {
				if (this.state.message === void 0) return this.props.children;
				return react.default.createElement("div", {
					className: "dshLiveTeamsPanelError",
					role: "alert"
				}, react.default.createElement("strong", null, `live-teams: the ${this.props.label} could not be shown`), react.default.createElement("p", null, this.state.message), react.default.createElement("p", { className: "dshLiveTeamsPanelErrorHint" }, "This usually means the DSH version no longer exports something the panel needs. The host log line to look for is \"slot entry crashed\"."), this.state.stack === void 0 ? null : react.default.createElement("pre", { className: "dshLiveTeamsPanelErrorStack" }, this.state.stack.trim().split("\n").slice(0, 6).join("\n")));
			}
		};
		// src/client/roster.tsx
		function fallback(key) {
			return key;
		}
		function rosterIsVisible(snapshot, sessions) {
			return sessions !== void 0 && snapshot !== null && snapshot.teamId.trim().length > 0 && snapshot.members.length > 0;
		}
		function liveMemberCount(snapshot) {
			return snapshot.members.filter((member) => member.live).length;
		}
		function memberMarkerLabel(member, t) {
			if (member.sessionId === null) return t("unbound");
			if (!member.live) return t("notLive");
			if (member.availability === "paused") return `${t("live")} · ${t("pausedState")}`;
			return t("live");
		}
		function canOpenMember(member) {
			return member.sessionId !== null;
		}
		function openMember(member, sessions) {
			if (member.sessionId !== null) sessions.open(member.sessionId);
		}
		function markerState(member) {
			if (member.sessionId === null) return "unbound";
			if (!member.live) return "not-live";
			if (member.availability === "paused") return "paused";
			return "live";
		}
		function RosterRow(props) {
			const marker = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "dshLiveTeamsRosterMarker",
				"data-state": markerState(props.member),
				role: "img",
				"aria-label": memberMarkerLabel(props.member, props.t)
			});
			const name = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "dshLiveTeamsRosterName",
				children: props.member.displayName
			});
			if (!canOpenMember(props.member)) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dshLiveTeamsRosterRow dshLiveTeamsRosterRowUnbound",
				role: "listitem",
				children: [name, marker]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				className: "dshLiveTeamsRosterRow",
				type: "button",
				title: props.t("openSession"),
				onClick: () => openMember(props.member, props.sessions),
				children: [name, marker]
			});
		}
		function RosterSurface(props) {
			const t = props.ctx.t;
			const entryRef = (0, react.useRef)(null);
			const rootRef = (0, react.useRef)(null);
			const [open, setOpen] = (0, react.useState)(false);
			const count = liveMemberCount(props.snapshot);
			const popoverId = "dsh-live-teams-roster-popover";
			const close = (0, react.useCallback)(() => {
				setOpen(false);
				entryRef.current?.focus();
			}, []);
			(0, react.useEffect)(() => {
				if (!open) return;
				props.onRefresh();
				const onPointerDown = (event) => {
					const target = event.target;
					if (target instanceof Node && rootRef.current?.contains(target) === true) return;
					close();
				};
				const onKeyDown = (event) => {
					if (event.key === "Escape") close();
				};
				document.addEventListener("pointerdown", onPointerDown);
				document.addEventListener("keydown", onKeyDown);
				return () => {
					document.removeEventListener("pointerdown", onPointerDown);
					document.removeEventListener("keydown", onKeyDown);
				};
			}, [close, open]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dshLiveTeamsRoster",
				ref: rootRef,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					ref: entryRef,
					className: "dshLiveTeamsRosterEntry",
					type: "button",
					"aria-label": `${props.snapshot.teamName ?? props.snapshot.teamId}: ${count} ${t("liveMembers")}`,
					"aria-haspopup": "dialog",
					"aria-controls": popoverId,
					"aria-expanded": open,
					onClick: () => {
						if (open) close();
						else setOpen(true);
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dshLiveTeamsRosterMark",
							"aria-hidden": "true",
							children: "◆"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dshLiveTeamsRosterTeam",
							children: props.snapshot.teamName ?? props.snapshot.teamId
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "dshLiveTeamsRosterSummary",
							children: [
								count,
								" ",
								t("liveMembers")
							]
						})
					]
				}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dshLiveTeamsRosterPopover",
					id: popoverId,
					role: "dialog",
					"aria-label": t("roster"),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						className: "dshLiveTeamsRosterList",
						children: props.snapshot.members.map((member) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", {
							className: "dshLiveTeamsRosterListItem",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RosterRow, {
								member,
								sessions: props.ctx.sessions,
								t
							})
						}, member.memberId))
					})
				})]
			});
		}
		function Roster(props) {
			const t = props.ctx?.t ?? fallback;
			const [snapshot, setSnapshot] = (0, react.useState)(null);
			const inFlight = (0, react.useRef)(null);
			const refresh = (0, react.useCallback)(() => {
				inFlight.current?.abort();
				const controller = new AbortController();
				inFlight.current = controller;
				fetchTeamSnapshot(void 0, controller.signal).then((next) => {
					if (!controller.signal.aborted) setSnapshot(next);
				}).catch(() => {
					if (!controller.signal.aborted) setSnapshot(null);
				});
			}, []);
			(0, react.useEffect)(() => {
				refresh();
				return () => inFlight.current?.abort();
			}, [refresh]);
			const sessions = props.ctx?.sessions;
			if (!rosterIsVisible(snapshot, sessions) || snapshot === null || sessions === void 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RosterSurface, {
				snapshot,
				ctx: {
					sessions,
					t
				},
				onRefresh: refresh
			});
		}
		// src/client/attention.tsx
		/**
		* The attention chip.
		*
		* The Messages panel answered "what was said to me", which is a question nobody
		* asks — the human asks "does anyone need me?", and then wants the conversation,
		* which lives in the member's own Session. This chip answers that question from
		* anywhere: it sits in the Session header, resolves the team from the Session it
		* is rendered in, and a click opens the member who is waiting.
		*
		* Acknowledging on click is deliberate: the delivery record is the only durable
		* "the human was told" evidence, and opening the source is the human acting on
		* it. Without that the chip would keep asking forever.
		*/
		/** How often the chip re-asks while a Session is open. */
		const ATTENTION_POLL_MS = 2e4;
		/**
		* Members whose acknowledgement is in flight.
		*
		* Clicking the chip opens the member's Session, and the chip lives in the Session
		* header — so the click can unmount the instance that started the acknowledgement,
		* and the Session switch mounts a fresh one. With only local state, that new
		* instance re-asks before the request lands, sees the member still waiting, and
		* puts the chip back: one click to travel, a second to clear. Reported live:
		* "нажал, перешёл в сессию Lead, затем нажал второй раз, чип пропал".
		*
		* The marker is dropped as soon as the request settles, so a failure brings the
		* chip back instead of hiding a backlog the human was never told about. The TTL
		* only bounds a request that never settles at all.
		*/
		const pendingClears = /* @__PURE__ */ new Map();
		function isClearPending(memberId, now = Date.now()) {
			const startedAt = pendingClears.get(memberId);
			if (startedAt === void 0) return false;
			if (now - startedAt > 15e3) {
				pendingClears.delete(memberId);
				return false;
			}
			return true;
		}
		/**
		* The Session the chip speaks for: the one being viewed, not the one it happens
		* to be mounted in. The `conversation.session.header.utilities` slot passes no
		* props (`renderSlot(name, {})`), so this is the only way to the Session id.
		*/
		function currentSessionId(sessions) {
			const current = sessions?.list?.getSnapshot().current;
			return typeof current === "string" && current.length > 0 ? current : void 0;
		}
		/** What the chip says: the longest-waiting member, plus how many others follow. */
		function attentionLabel(entries) {
			const first = entries[0];
			if (first === void 0) return void 0;
			return {
				name: first.name,
				extra: entries.length - 1,
				waiting: first.waiting
			};
		}
		/**
		* Mark everything one member is waiting on as read by the human.
		*
		* The waiting count comes from deliveries, whose ids only the inbox carries, so
		* this reads the inbox once and acknowledges in a single request. Returns false
		* when the state could not be cleared, so the chip can keep asking instead of
		* pretending the human saw something they did not.
		*/
		async function acknowledgeMemberWaiting(sessionId, memberId) {
			try {
				const ids = (await fetchTeamInbox(sessionId, 200)).messages.filter((message) => message.from === memberId && message.delivery.state === "stored").map((message) => message.id);
				if (ids.length === 0) return true;
				await acknowledgeTeamMessages(ids, sessionId);
				return true;
			} catch {
				return false;
			}
		}
		function AttentionChip(props) {
			const ctx = props.ctx;
			const t = ctx?.t ?? ((key) => key);
			const [sessionId, setSessionId] = (0, react.useState)(() => currentSessionId(ctx?.sessions));
			const [entries, setEntries] = (0, react.useState)([]);
			const [busy, setBusy] = (0, react.useState)(false);
			const mounted = (0, react.useRef)(true);
			(0, react.useEffect)(() => {
				mounted.current = true;
				return () => {
					mounted.current = false;
				};
			}, []);
			(0, react.useEffect)(() => {
				const list = ctx?.sessions.list;
				if (list?.subscribe === void 0) return void 0;
				setSessionId(currentSessionId(ctx?.sessions));
				return list.subscribe(() => setSessionId(currentSessionId(ctx?.sessions)));
			}, [ctx?.sessions]);
			const refresh = (0, react.useCallback)((signal) => {
				if (sessionId === void 0) {
					setEntries([]);
					return;
				}
				fetchTeamAttention(sessionId, signal).then((result) => {
					if (signal?.aborted !== true && mounted.current) setEntries(result.attention.filter((entry) => !isClearPending(entry.memberId)));
				}).catch(() => {
					if (signal?.aborted !== true && mounted.current) setEntries([]);
				});
			}, [sessionId]);
			(0, react.useEffect)(() => {
				const controller = new AbortController();
				refresh(controller.signal);
				const timer = setInterval(() => refresh(controller.signal), ATTENTION_POLL_MS);
				const onFocus = () => refresh(controller.signal);
				window.addEventListener("focus", onFocus);
				return () => {
					controller.abort();
					clearInterval(timer);
					window.removeEventListener("focus", onFocus);
				};
			}, [refresh]);
			const label = attentionLabel(entries);
			if (label === void 0 || sessionId === void 0) return null;
			const open = () => {
				const first = entries[0];
				if (first === void 0 || busy) return;
				setBusy(true);
				pendingClears.set(first.memberId, Date.now());
				if (first.sessionId !== null) ctx?.sessions.open(first.sessionId);
				acknowledgeMemberWaiting(sessionId, first.memberId).then((cleared) => {
					pendingClears.delete(first.memberId);
					if (!mounted.current) return;
					if (cleared) setEntries((current) => current.filter((entry) => entry.memberId !== first.memberId));
					else refresh();
				}).finally(() => {
					if (mounted.current) setBusy(false);
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: `dshLiveTeamsAttention${busy ? " dshLiveTeamsAttentionBusy" : ""}`,
				onClick: open,
				disabled: busy,
				"aria-label": `${label.name} — ${t("attentionWaiting")}`,
				title: t("attentionWaiting"),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dshLiveTeamsAttentionDot",
						"aria-hidden": "true",
						children: "●"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dshLiveTeamsAttentionName",
						children: label.name
					}),
					label.extra > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dshLiveTeamsAttentionMore",
						children: `+${label.extra}`
					}),
					label.waiting > 1 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dshLiveTeamsAttentionCount",
						children: label.waiting
					})
				]
			});
		}
		// src/client/locales.ts
		const NS = "dsh-live-teams";
		const dictionaries = {
			en: {
				memberSettingsTitle: "Member settings",
				memberRoleHeading: "Role & responsibilities",
				memberRoleHint: "The role defines instructions and permissions. Choose a role, then apply the change.",
				memberRolePending: "Role selection has not been applied.",
				memberAvailabilityHeading: "New assignments",
				memberAvailabilityHint: "Pausing prevents new automatic assignments. It does not stop the current turn.",
				memberPauseAssignments: "Pause assignments",
				memberResumeAssignments: "Resume assignments",
				memberContactsUnknown: "Contact rules are unavailable in this snapshot.",
				memberContactTarget: "Contact to allow or revoke",
				memberContactTeam: "Team",
				memberContactHuman: "Human",
				memberSessionHeading: "Session",
				memberFinishNameFirst: "Finish name editing to manage the current turn.",
				memberTurnUnknown: "Current turn status is unknown.",
				memberTechnicalDetails: "Technical details",
				memberIdentifier: "Member ID",
				memberSessionIdentifier: "Session ID",
				memberBindingGeneration: "Binding generation",
				memberContractRevision: "Member contract revision",
				teamSettings: "Team settings",
				closePanel: "Close panel",
				assignedTasks: "Assigned",
				noAssignedTask: "No assigned task",
				taskStage: "Stage",
				lastActivity: "Last activity",
				taskAwaitingReview: "Awaiting review",
				taskAwaitingHuman: "Awaiting human decision",
				taskAwaitingDecision: "Awaiting decision",
				journalNoMatches: "No events in this view. Try All or change the filters.",
				journalModes: "Activity view",
				journalImportant: "Important",
				journalAll: "All",
				journalTechnical: "Technical",
				journalEventKind: "Event kind",
				reviewReturnHeading: "Automatic review return",
				reviewReturnpending: "Return queued",
				reviewReturnsending: "Notification delivery pending",
				reviewReturndelivered: "Delivered; launch not yet confirmed",
				reviewReturnstarted: "Session launch confirmed",
				reviewReturncompleted: "Session processed the request (not work acceptance)",
				reviewReturnblocked: "Automatic return blocked",
				reviewReturnfailed: "Return or launch failed",
				reviewReturnunconfirmed: "Session launch unconfirmed",
				reviewReturnsuperseded: "Return no longer current",
				reviewReturnLeadPending: "Lead notification not yet confirmed",
				taskStopUnconfirmed: "The Session stop could not be confirmed. The attempt is fenced; the task needs human intervention and has not been archived.",
				taskPathNoMatch: "Warning: path matches no existing file or directory; confirm it is a new path, not a typo",
				taskPathScanIncomplete: "Warning: path inspection was incomplete",
				taskResume: "Resume task",
				taskResumed: "Task returned to the ready queue.",
				tab: "Team",
				title: "Workspace team",
				briefing: "Briefing",
				briefingHint: "The lead maintains the team operating order.",
				briefingEmpty: "No briefing; built-in order applies.",
				openBriefing: "Open file",
				briefingOpened: "Briefing file opened",
				openBriefingFailed: "Unable to open briefing file",
				lead: "Lead",
				leadUnset: "Not set",
				leadLoadFailed: "Could not read the team lead; reopen the tab.",
				leadUpdated: "Lead updated",
				note: "Note",
				noNote: "No note",
				headerCaption: "Live roster and availability at a glance",
				journalTitle: "Activity journal",
				journalCaption: "Recent team activity",
				journalEmpty: "No activity yet",
				journalLoadFailed: "Journal could not be refreshed; shown entries may be stale.",
				journalFilters: "Activity filters",
				journalFilterMessage: "Messages",
				journalFilterDelivery: "Delivery",
				journalFilterTask: "Tasks",
				journalFilterReview: "Reviews",
				journalFilterContact: "Contacts",
				journalFilterTeam: "Team",
				journalFilterMember: "Members",
				journalFilterOther: "Other",
				journalRound: "Round",
				rolesCount: "roles",
				summaryTitle: "Team overview",
				summaryCaption: "Current snapshot",
				totalMembers: "Members",
				liveMembers: "Live",
				pausedMembers: "Paused",
				unboundMembers: "Unbound",
				activeTasks: "Active",
				awaitingLead: "Awaiting action",
				membersTitle: "Members",
				members: "Members",
				membersCaption: "Manage roles and availability",
				addMember: "Add member",
				addMemberTitle: "Add team member",
				addMemberDescription: "Pick a Session of this workspace or create a new one, then assign its role.",
				candidatesEmpty: "No listed Session is free to join in this workspace",
				workspaceNotRegistered: "This folder is not a DSH workspace yet. Add it as a workspace in DSH first.",
				candidateSession: "Session",
				candidateState: "State",
				candidateNewSession: "New session",
				candidateNewSessionHint: "Creates a Session in this workspace and titles it after the member. DSH lists it once it has activity.",
				createMember: "Create member",
				memberCreated: "Member added",
				memberNeedsState: "The team state could not be read, so there is no revision to write against. Refresh the tab and try again.",
				addMemberFailed: "Unable to add team member",
				addMemberSessionMissing: "That Session no longer exists. Reopen the dialog to list the current Sessions.",
				addMemberSessionElsewhere: "That Session works in another folder, so it cannot join this team.",
				addMemberAlreadyMember: "That Session is already a member, or the request was rejected as invalid.",
				addMemberUnknownRole: "That role is not in the registry. Reopen the dialog and pick a listed role.",
				stateUnavailable: "The team state is unavailable right now. Try again in a moment.",
				refresh: "Refresh",
				teamOffTitle: "Team mode is off for this workspace",
				teamOffHint: "Turn it on to create a team here, name it, and add members from Sessions in this workspace.",
				existingTeamHint: "This workspace already has a team:",
				adoptTeam: "Enable this team",
				createNewTeam: "Create a new empty team",
				candidateUnusable: "unusable",
				existingTeamFound: "An existing team was found; choose it or create a new team.",
				teamAdopted: "Team adopted",
				teamNameLabel: "Team name",
				enableTeam: "Enable team mode",
				teamEnabled: "Team mode is on",
				disableTeam: "Disable team mode",
				disableTeamTitle: "Disable team mode",
				disableTeamDescription: "This team will be switched off for this workspace.",
				disableTeamKeeps: "Members, roles and the audit are kept, and switching it back on restores them.",
				teamDisabled: "Team mode is off",
				compatibilityIncompatible: "This DSH is not compatible with the team plugin",
				compatibilityDegraded: "The team runs without some host surfaces",
				teamRenamed: "Team renamed",
				teamActionFailed: "Unable to change the team",
				renameTeam: "Rename team",
				loading: "Loading team…",
				unavailable: "Team state unavailable",
				empty: "The team has no members",
				name: "Name",
				editName: "Edit member name",
				save: "Save",
				cancel: "Cancel",
				nameRequired: "Enter a name before saving",
				role: "Role",
				availability: "Availability",
				available: "Available",
				pausedState: "Paused",
				binding: "Session",
				state: "State",
				bound: "Bound",
				unbound: "Unbound",
				live: "Live",
				notLive: "Not live",
				idle: "Idle",
				running: "Running",
				unknown: "Unknown",
				loadFailed: "Unable to load team state",
				apply: "Apply",
				pause: "Pause",
				resume: "Resume",
				teamChanged: "The team changed; current state is shown",
				mutationFailed: "Unable to change team member",
				openSession: "Open this member's Session",
				openSessionUnavailable: "This DSH version gives a plugin no way to open a session. Open it from the session list instead.",
				openSessionAction: "Open Session",
				roster: "Team roster",
				attention: "Team attention",
				attentionWaiting: "is waiting for you — open their Session",
				permittedContacts: "Permitted contacts",
				contactGrantLeadOnly: "Only the lead can change peer access.",
				noPeerContact: "Contact with colleagues is not allowed",
				chooseContact: "Choose a contact",
				grant: "Allow",
				revoke: "Remove access",
				grantFailed: "Unable to update contact permission",
				roles: "Roles",
				rolesCaption: "Shipped roles and workspace customizations",
				chooseRole: "Choose a role",
				unknownRole: "unavailable",
				openGlobalRoles: "Open global roles folder",
				openWorkspaceRoles: "Open workspace roles folder",
				customizeRole: "Customize in this workspace",
				openRoleFile: "Open file",
				roleGlobal: "global",
				roleCustomized: "customized in this workspace",
				rolesOpened: "Roles location opened",
				openRolesFailed: "Unable to open roles location",
				roleOverridden: "Role copied into this workspace",
				roleAlreadyOverridden: "Role is already customized",
				overrideFailed: "Unable to customize role",
				removeMember: "Remove from team",
				removeMemberTitle: "Remove team member",
				removeMemberDescription: "This member will leave the team.",
				sessionContinues: "Their Session keeps running and is not interrupted.",
				auditRecorded: "This change is recorded in the team audit.",
				removeMemberConfirm: "Remove from team",
				memberRemoved: "Member removed from team",
				interruptTurn: "Interrupt turn",
				interruptTurnTitle: "Interrupt the current turn?",
				interruptTurnDescription: "The turn stops. Availability, membership and the Session itself are unchanged.",
				interruptTurnKeeps: "This only stops the current turn; it does not change availability or team membership.",
				turnInterrupted: "Turn interrupted",
				noRunningTurn: "Nothing to interrupt: this member is not running a turn right now",
				interruptFailed: "Unable to interrupt turn",
				messagesTitle: "Messages",
				messagesShow: "Show",
				unread: "unread",
				messagesCaption: "Send a distinct message, direction or comment and review your inbox.",
				messageRecipient: "Recipient",
				chooseRecipient: "Choose a recipient",
				wholeTeam: "Entire team",
				messageKind: "Kind",
				chooseMessageKind: "Choose what this does",
				messageKindMessage: "Message",
				messageKindMessageHint: "starts or queues a turn",
				messageKindDirection: "Direction",
				messageKindDirectionHint: "steers at a safe boundary, otherwise queues",
				messageKindComment: "Comment",
				messageKindCommentHint: "stored for later context; wakes nobody",
				messageContent: "Content",
				sendMessage: "Send",
				messageSent: "Message sent",
				messageSendFailed: "Unable to send message",
				messageDeliveryFailed: "Delivery failed",
				messageAcknowledgeFailed: "Unable to acknowledge message",
				inboxEmpty: "Your inbox is empty",
				tasksTitle: "Tasks",
				taskFilters: "Task filters",
				tasksFilteractive: "Active",
				tasksFilterwaiting: "Waiting",
				tasksFilterarchived: "Archived",
				taskStatusdraft: "Draft",
				taskStatusready: "Ready",
				taskStatusclaimed: "Claimed",
				taskStatusin_progress: "In progress",
				taskStatuswaiting: "Waiting",
				taskStatusneeds_human: "Needs human",
				taskStatuscompleted: "Completed",
				taskStatusfailed: "Failed",
				taskStatuscancelled: "Cancelled",
				tasksEmpty: "No tasks in this view",
				tasksLoadFailed: "Unable to load tasks",
				taskLoadFailed: "Unable to load task",
				taskActionFailed: "Unable to change task",
				taskAssignee: "Assignee",
				taskBlocked: "Blocked",
				taskBlockedBy: "Blocked by",
				dispatchPause: "Pause dispatch",
				dispatchResume: "Resume dispatch",
				dispatchPaused: "Automatic dispatch is paused",
				dispatchPausedBy: "Paused by",
				dispatchActionFailed: "Unable to change dispatch",
				rotationHeading: "Automatic rotation",
				rotationHint: "Replaces a member’s Session when it crosses a limit. The task record, not the transcript, carries the memory across.",
				rotationState: "Rotation",
				rotationOn: "On",
				rotationOff: "Off",
				rotationContextLimit: "Context limit, tokens",
				rotationTaskLimit: "Accepted tasks limit",
				rotationZeroHint: "0 turns that rule off.",
				rotationSave: "Apply rotation",
				rotationSaved: "Rotation settings applied",
				rotationLoadFailed: "Rotation settings are unavailable",
				rotationSaveFailed: "Unable to change rotation",
				rotationSourceProfile: "from profile",
				rotationSourceTeam: "set in this team",
				rotationPending: "Rotation changes have not been applied.",
				taskQueuedMemberPaused: "Queued · member paused",
				taskQueuedMemberBusy: "Queued · member busy",
				taskQueuedNoSession: "Queued · no session",
				taskQueuedRevoking: "Revocation in flight",
				taskQueuedDeparted: "Assignee has left",
				taskQueuedCoding: "Code · manual dispatch",
				taskQueuedNoPaths: "Paths · not declared",
				taskQueuedPathsOverlap: "Paths · overlap",
				taskQueuedPathsShared: "Paths · shared file",
				taskAttempts: "Attempts",
				taskNoAttempts: "No attempts yet",
				attemptStatusactive: "active",
				attemptStatusrevoking: "revoking",
				attemptStatusrevoked: "revoked",
				attemptStatuscompleted: "completed",
				attemptStatusfailed: "failed",
				attemptHumanIntervened: "a human wrote into this session directly",
				taskIntervened: "human intervened",
				taskTitleLabel: "Title",
				journalBody: "What was sent",
				journalTask: "The task",
				copy: "Copy",
				copied: "Copied",
				markdownFootnotes: "Footnotes",
				journalRaw: "Raw",
				journalRendered: "Rendered",
				taskKindimplementation: "Implementation",
				taskKindresearch: "Research",
				taskKindrequirements: "Requirements",
				taskKindverification: "Verification",
				taskKindrepair: "Repair",
				taskKindintegration: "Integration",
				taskKindwork: "Work",
				taskNew: "New task",
				taskEditContract: "Edit contract",
				taskEditTitle: "Change the contract",
				taskNewTitle: "Create a task",
				taskDraftDescription: "The task starts as soon as its assignee is free. Declared paths are the write contract: two writers may run together only when their paths do not intersect.",
				taskKind: "Kind",
				taskRoute: "Route",
				taskRouteReport: "Report to the human",
				taskRouteReview: "Review by a member",
				taskReviewer: "Reviewer",
				taskPaths: "Declared paths (comma separated)",
				taskAcceptanceLabel: "Acceptance, one per line",
				taskChecksLabel: "Checks, one per line",
				taskBodyLabel: "Task document",
				taskSave: "Save",
				taskSaved: "Task saved.",
				taskRelease: "Release attempt",
				taskReleaseTitle: "Release the attempt?",
				taskReleaseDescription: "The attempt is revoked, the task returns to the assignee and the dispatcher may start it again. Work already written to the tree stays.",
				taskReleaseReason: "Why",
				taskReleased: "Attempt released.",
				taskStalled: "silent",
				taskStalledUnacknowledged: "never acknowledged the assignment",
				taskStalledIdle: "idle with nothing submitted",
				taskQueuedIntervened: "Human · change unrecorded",
				taskAcceptance: "Acceptance",
				taskDocument: "Document",
				taskDocumentMissing: "Document is missing; the task remains available for revision.",
				taskSubmissions: "Submissions",
				scopeClean: "Scope · clean",
				scopeViolation: "Scope · outside the declaration",
				scopeSharedTree: "Scope · shared tree moved",
				scopeUnchecked: "Scope · unchecked",
				scopeUnexpected: "changed outside the declaration",
				scopeSharedTreeNote: "another active task declared that area",
				scopeDeclared: "declared",
				scopeModeGit: "observed via git",
				scopeModeFiles: "observed via file fingerprints",
				scopeReasonNoRepository: "no version control: the declaration could not be checked",
				scopeReasonTooManyFiles: "the folder is too large to watch",
				scopeReasonNoSnapshot: "no fingerprint was taken when the work started",
				scopeReasonUnreadable: "the workspace could not be read",
				taskNoSubmissions: "No submissions",
				taskReviewRounds: "Review rounds",
				taskNoRounds: "No review rounds",
				taskAccept: "Accept",
				taskRevise: "Revise",
				taskAcceptTitle: "Accept this task?",
				taskReviseTitle: "Revise this task?",
				taskAcceptDescription: "This completes the task, archives its document, completes the attempt and sends a closing message.",
				taskReviseDescription: "This returns the task to in progress and sends instructions to the assignee.",
				taskAcceptNote: "Optional note",
				taskReviseInstructions: "Instructions",
				taskClose: "Close task",
				taskCloseTitle: "Close this task without a submission?",
				taskCloseDescription: "For work that will never be submitted: done by hand, dropped, or overtaken. The reason goes into the journal and the task is archived.",
				taskCloseReason: "Why is it being closed?",
				acknowledge: "Acknowledge",
				acknowledged: "Acknowledged"
			},
			ru: {
				memberSettingsTitle: "Настройки участника",
				memberRoleHeading: "Роль и назначение",
				memberRoleHint: "Роль определяет инструкции и права. Выберите роль и примените изменение.",
				memberRolePending: "Выбранная роль ещё не применена.",
				memberAvailabilityHeading: "Новые назначения",
				memberAvailabilityHint: "Пауза запрещает новые автоматические назначения. Текущий ход при этом не останавливается.",
				memberPauseAssignments: "Приостановить назначения",
				memberResumeAssignments: "Возобновить назначения",
				memberContactsUnknown: "Правила контактов недоступны в этом снимке.",
				memberContactTarget: "Контакт для выдачи или отзыва доступа",
				memberContactTeam: "Команда",
				memberContactHuman: "Человек",
				memberSessionHeading: "Сессия",
				memberFinishNameFirst: "Завершите редактирование имени, чтобы управлять текущим ходом.",
				memberTurnUnknown: "Состояние текущего хода неизвестно.",
				memberTechnicalDetails: "Технические сведения",
				memberIdentifier: "ID участника",
				memberSessionIdentifier: "ID сессии",
				memberBindingGeneration: "Поколение привязки",
				memberContractRevision: "Ревизия контракта участника",
				teamSettings: "Настройки команды",
				closePanel: "Закрыть панель",
				assignedTasks: "Назначено",
				noAssignedTask: "Нет назначенной задачи",
				taskStage: "Этап",
				lastActivity: "Последнее изменение",
				taskAwaitingReview: "Ожидает ревью",
				taskAwaitingHuman: "Ожидает решения человека",
				taskAwaitingDecision: "Ожидает решения",
				journalNoMatches: "Нет событий в этом режиме. Выберите «Все» или измените фильтры.",
				journalModes: "Режим журнала",
				journalImportant: "Важное",
				journalAll: "Все",
				journalTechnical: "Техническое",
				journalEventKind: "Тип события",
				reviewReturnHeading: "Автоматический возврат на доработку",
				reviewReturnpending: "Возврат ожидает отправки",
				reviewReturnsending: "Доставка уведомления ожидается",
				reviewReturndelivered: "Доставлено; запуск ещё не подтверждён",
				reviewReturnstarted: "Запуск Session подтверждён",
				reviewReturncompleted: "Session обработала запрос (не принятие работы)",
				reviewReturnblocked: "Автоматический возврат заблокирован",
				reviewReturnfailed: "Ошибка возврата или запуска",
				reviewReturnunconfirmed: "Запуск Session не подтверждён",
				reviewReturnsuperseded: "Возврат больше не действует",
				reviewReturnLeadPending: "Уведомление лиду пока не подтверждено",
				taskStopUnconfirmed: "Остановка сессии не подтверждена. Попытка заблокирована; задача требует участия человека и не архивирована.",
				taskPathNoMatch: "Предупреждение: путь не совпадает с существующими файлами или каталогами; проверьте, что это новый путь, а не опечатка",
				taskPathScanIncomplete: "Предупреждение: проверка существования пути неполная",
				taskResume: "Возобновить задачу",
				taskResumed: "Задача возвращена в очередь запуска.",
				tab: "Команда",
				title: "Команда рабочего пространства",
				briefing: "Брифинг",
				briefingHint: "Лид ведёт порядок работы команды.",
				briefingEmpty: "Брифинга нет; действует встроенный порядок.",
				openBriefing: "Открыть файл",
				briefingOpened: "Файл брифинга открыт",
				openBriefingFailed: "Не удалось открыть файл брифинга",
				lead: "Лид",
				leadUnset: "Не задан",
				leadLoadFailed: "Не удалось прочитать лидера команды; откройте вкладку заново.",
				leadUpdated: "Лид обновлён",
				note: "Назначение",
				noNote: "Нет заметки",
				headerCaption: "Актуальный состав и доступность команды",
				journalTitle: "Журнал активности",
				journalCaption: "Последние события команды",
				journalEmpty: "Активности пока нет",
				journalLoadFailed: "Не удалось обновить журнал; показанные события могут быть устаревшими.",
				journalFilters: "Фильтры активности",
				journalFilterMessage: "Сообщения",
				journalFilterDelivery: "Доставка",
				journalFilterTask: "Задания",
				journalFilterReview: "Проверки",
				journalFilterContact: "Контакты",
				journalFilterTeam: "Команда",
				journalFilterMember: "Участники",
				journalFilterOther: "Другое",
				journalRound: "Раунд",
				rolesCount: "ролей",
				summaryTitle: "Обзор команды",
				summaryCaption: "Текущее состояние",
				totalMembers: "Участники",
				liveMembers: "Активны",
				pausedMembers: "На паузе",
				unboundMembers: "Без привязки",
				activeTasks: "Активные",
				awaitingLead: "Требуют внимания",
				membersTitle: "Участники",
				members: "Участники",
				membersCaption: "Управление ролями и доступностью",
				addMember: "Добавить участника",
				addMemberTitle: "Добавить участника команды",
				addMemberDescription: "Выберите сессию этого рабочего пространства или создайте новую и назначьте роль.",
				candidatesEmpty: "Свободных сессий из списка в этом рабочем пространстве нет",
				workspaceNotRegistered: "Эта папка ещё не является рабочим пространством DSH. Сначала добавьте её как workspace в DSH.",
				candidateSession: "Сессия",
				candidateState: "Состояние",
				candidateNewSession: "Новая сессия",
				candidateNewSessionHint: "Создаёт сессию в этом рабочем пространстве и называет её по имени участника. DSH покажет её в списке, когда в ней появится активность.",
				createMember: "Создать участника",
				memberCreated: "Участник добавлен",
				memberNeedsState: "Не удалось прочитать состояние команды, поэтому писать не с чем. Обнови вкладку и попробуй снова.",
				addMemberFailed: "Не удалось добавить участника команды",
				addMemberSessionMissing: "Такой сессии больше нет. Откройте диалог заново, чтобы увидеть актуальный список.",
				addMemberSessionElsewhere: "Эта сессия работает в другой папке и не может войти в эту команду.",
				addMemberAlreadyMember: "Эта сессия уже участник, либо запрос отклонён как некорректный.",
				addMemberUnknownRole: "Такой роли нет в реестре. Откройте диалог заново и выберите роль из списка.",
				stateUnavailable: "Состояние команды сейчас недоступно. Повторите через момент.",
				refresh: "Обновить",
				teamOffTitle: "Режим команды для этого workspace выключен",
				teamOffHint: "Включите его, чтобы создать здесь команду, назвать её и добавлять участников из сессий этого workspace.",
				existingTeamHint: "В этом workspace уже есть команда:",
				adoptTeam: "Включить эту команду",
				createNewTeam: "Создать новую пустую команду",
				candidateUnusable: "непригодна",
				existingTeamFound: "Найдена существующая команда; выберите её или создайте новую.",
				teamAdopted: "Команда подключена",
				teamNameLabel: "Название команды",
				enableTeam: "Включить режим команды",
				teamEnabled: "Режим команды включён",
				disableTeam: "Выключить режим команды",
				disableTeamTitle: "Выключение режима команды",
				disableTeamDescription: "Команда будет выключена для этого workspace.",
				disableTeamKeeps: "Состав, роли и аудит сохраняются, и повторное включение вернёт их.",
				teamDisabled: "Режим команды выключен",
				compatibilityIncompatible: "Этот DSH несовместим с плагином команды",
				compatibilityDegraded: "Команда работает без части возможностей хоста",
				teamRenamed: "Команда переименована",
				teamActionFailed: "Не удалось изменить команду",
				renameTeam: "Переименовать команду",
				loading: "Загрузка команды…",
				unavailable: "Состояние команды недоступно",
				empty: "В команде нет участников",
				name: "Имя",
				editName: "Изменить имя участника",
				save: "Сохранить",
				cancel: "Отменить",
				nameRequired: "Введите имя перед сохранением",
				role: "Роль",
				availability: "Доступность",
				available: "Доступен",
				pausedState: "На паузе",
				binding: "Сессия",
				state: "Состояние",
				bound: "Привязан",
				unbound: "Не привязан",
				live: "Активна",
				notLive: "Не активна",
				idle: "Ожидает",
				running: "Работает",
				unknown: "Неизвестно",
				loadFailed: "Не удалось загрузить состояние команды",
				apply: "Применить",
				pause: "Пауза",
				resume: "Возобновить",
				teamChanged: "Команда изменилась; показано актуальное состояние",
				mutationFailed: "Не удалось изменить участника команды",
				openSession: "Открыть сессию этого участника",
				openSessionUnavailable: "Эта версия DSH не даёт плагину открыть сессию. Откройте её из списка сессий.",
				openSessionAction: "Открыть сессию",
				roster: "Состав команды",
				attention: "Внимание команды",
				attentionWaiting: "ждёт вас — открыть его сессию",
				permittedContacts: "Разрешённые контакты",
				contactGrantLeadOnly: "Менять доступ к коллегам может только лид.",
				noPeerContact: "Связь с коллегами не разрешена",
				chooseContact: "Выберите контакт",
				grant: "Разрешить",
				revoke: "Снять разрешение",
				grantFailed: "Не удалось изменить разрешение контакта",
				roles: "Роли",
				rolesCaption: "Поставленные роли и настройки рабочего пространства",
				chooseRole: "Выберите роль",
				unknownRole: "недоступна",
				openGlobalRoles: "Открыть глобальные роли",
				openWorkspaceRoles: "Открыть роли рабочего пространства",
				customizeRole: "Настроить в этом рабочем пространстве",
				openRoleFile: "Открыть файл",
				roleGlobal: "глобальная",
				roleCustomized: "настроена в этом рабочем пространстве",
				rolesOpened: "Расположение ролей открыто",
				openRolesFailed: "Не удалось открыть роли",
				roleOverridden: "Роль скопирована в рабочее пространство",
				roleAlreadyOverridden: "Роль уже настроена",
				overrideFailed: "Не удалось настроить роль",
				removeMember: "Удалить из команды",
				removeMemberTitle: "Удаление участника команды",
				removeMemberDescription: "Этот участник покинет команду.",
				sessionContinues: "Его сессия продолжит работу и не будет прервана.",
				auditRecorded: "Изменение будет записано в аудит команды.",
				removeMemberConfirm: "Удалить из команды",
				memberRemoved: "Участник удалён из команды",
				interruptTurn: "Прервать ход",
				interruptTurnTitle: "Прервать текущий ход?",
				interruptTurnDescription: "Ход остановится. Доступность, состав команды и сама сессия не изменятся.",
				interruptTurnKeeps: "Останавливается только текущий ход; доступность и состав команды не меняются.",
				turnInterrupted: "Ход прерван",
				noRunningTurn: "Прерывать нечего: участник сейчас не выполняет ход",
				interruptFailed: "Не удалось прервать ход",
				messagesTitle: "Сообщения",
				messagesShow: "Показать",
				unread: "непрочитанных",
				messagesCaption: "Отправляйте сообщения, направления и комментарии и просматривайте входящие.",
				messageRecipient: "Получатель",
				chooseRecipient: "Выберите получателя",
				wholeTeam: "Вся команда",
				messageKind: "Вид",
				chooseMessageKind: "Выберите действие",
				messageKindMessage: "Сообщение",
				messageKindMessageHint: "начинает или ставит в очередь ход",
				messageKindDirection: "Направление",
				messageKindDirectionHint: "управляет на безопасной границе, иначе ставит в очередь",
				messageKindComment: "Комментарий",
				messageKindCommentHint: "сохраняется для контекста и никого не будит",
				messageContent: "Содержание",
				sendMessage: "Отправить",
				messageSent: "Сообщение отправлено",
				messageSendFailed: "Не удалось отправить сообщение",
				messageDeliveryFailed: "Доставка не удалась",
				messageAcknowledgeFailed: "Не удалось подтвердить сообщение",
				inboxEmpty: "Входящих сообщений нет",
				tasksTitle: "Задания",
				taskFilters: "Фильтры заданий",
				tasksFilteractive: "Активные",
				tasksFilterwaiting: "Ожидают решения",
				tasksFilterarchived: "Архив",
				taskStatusdraft: "Черновик",
				taskStatusready: "Готово",
				taskStatusclaimed: "Назначено",
				taskStatusin_progress: "В работе",
				taskStatuswaiting: "Ожидает решения",
				taskStatusneeds_human: "Нужно участие человека",
				taskStatuscompleted: "Завершено",
				taskStatusfailed: "Не выполнено",
				taskStatuscancelled: "Отменено",
				tasksEmpty: "В этом представлении заданий нет",
				tasksLoadFailed: "Не удалось загрузить задания",
				taskLoadFailed: "Не удалось загрузить задание",
				taskActionFailed: "Не удалось изменить задание",
				taskAssignee: "Исполнитель",
				taskBlocked: "Заблокирована",
				taskBlockedBy: "Блокируют",
				dispatchPause: "Пауза диспетчера",
				dispatchResume: "Возобновить диспетчер",
				dispatchPaused: "Автоматический запуск заданий на паузе",
				dispatchPausedBy: "Пауза от",
				dispatchActionFailed: "Не удалось изменить диспетчер",
				taskQueuedMemberPaused: "В очереди · участник на паузе",
				taskQueuedMemberBusy: "В очереди · участник занят",
				taskQueuedNoSession: "В очереди · нет сессии",
				taskQueuedRevoking: "Идёт отзыв задания",
				taskQueuedDeparted: "Исполнитель покинул команду",
				taskQueuedCoding: "Код · только вручную",
				taskQueuedNoPaths: "Пути · не объявлены",
				taskQueuedPathsOverlap: "Пути · пересечение",
				taskQueuedPathsShared: "Пути · общий файл",
				taskAttempts: "Попытки",
				taskNoAttempts: "Попыток пока нет",
				attemptStatusactive: "активна",
				attemptStatusrevoking: "отзывается",
				attemptStatusrevoked: "отозвана",
				attemptStatuscompleted: "завершена",
				attemptStatusfailed: "не удалась",
				attemptHumanIntervened: "человек писал в эту сессию напрямую",
				taskIntervened: "вмешался человек",
				taskStalled: "молчит",
				taskTitleLabel: "Название",
				journalBody: "Что отправлено",
				journalTask: "Задача",
				copy: "Скопировать",
				copied: "Скопировано",
				markdownFootnotes: "Сноски",
				journalRaw: "Как есть",
				journalRendered: "Оформлено",
				taskKindimplementation: "Реализация",
				taskKindresearch: "Исследование",
				taskKindrequirements: "Требования",
				taskKindverification: "Проверка",
				taskKindrepair: "Починка",
				taskKindintegration: "Интеграция",
				taskKindwork: "Работа",
				taskNew: "Новое задание",
				taskEditContract: "Изменить контракт",
				taskEditTitle: "Изменение контракта",
				taskNewTitle: "Создать задание",
				taskDraftDescription: "Задание начнётся, как только исполнитель освободится. Объявленные пути — это договор на запись: двое работают одновременно только там, где пути не пересекаются.",
				taskKind: "Вид",
				taskRoute: "Маршрут",
				taskRouteReport: "Отчёт человеку",
				taskRouteReview: "Проверка участником",
				taskReviewer: "Проверяющий",
				taskPaths: "Объявленные пути (через запятую)",
				taskAcceptanceLabel: "Критерии приёмки, по одному в строке",
				taskChecksLabel: "Проверки, по одной в строке",
				taskBodyLabel: "Документ задания",
				taskSave: "Сохранить",
				taskSaved: "Задание сохранено.",
				taskRelease: "Освободить попытку",
				taskReleaseTitle: "Освободить попытку?",
				taskReleaseDescription: "Попытка будет отозвана, задание вернётся исполнителю, и диспетчер сможет запустить его снова. Уже написанное в дереве остаётся.",
				taskReleaseReason: "Причина",
				taskReleased: "Попытка освобождена.",
				taskStalledUnacknowledged: "не подтвердил получение задания",
				taskStalledIdle: "простаивает, ничего не сдано",
				taskQueuedIntervened: "Человек · изменение не записано",
				taskAcceptance: "Критерии приёмки",
				taskDocument: "Документ",
				taskDocumentMissing: "Документ отсутствует; задание можно вернуть на доработку.",
				taskSubmissions: "Результаты",
				scopeClean: "Скоуп · чисто",
				scopeViolation: "Скоуп · вне объявления",
				scopeSharedTree: "Скоуп · дерево двигалось",
				scopeUnchecked: "Скоуп · не проверено",
				scopeUnexpected: "изменено вне объявления",
				scopeSharedTreeNote: "эту область объявила другая активная задача",
				scopeDeclared: "объявлено",
				scopeModeGit: "наблюдение через git",
				scopeModeFiles: "наблюдение по отпечаткам файлов",
				scopeReasonNoRepository: "нет контроля версий: объявление проверить не удалось",
				scopeReasonTooManyFiles: "папка слишком велика для наблюдения",
				scopeReasonNoSnapshot: "отпечаток на старте работы не снят",
				scopeReasonUnreadable: "рабочую папку не удалось прочитать",
				taskNoSubmissions: "Результатов нет",
				taskReviewRounds: "Раунды проверки",
				taskNoRounds: "Раундов проверки нет",
				taskAccept: "Принять",
				taskRevise: "Вернуть на доработку",
				taskAcceptTitle: "Принять это задание?",
				taskReviseTitle: "Вернуть это задание?",
				taskAcceptDescription: "Задание будет завершено, документ — помещён в архив, попытка — закрыта, исполнителю отправлено сообщение.",
				taskReviseDescription: "Задание вернётся в работу, исполнителю будут отправлены инструкции.",
				taskAcceptNote: "Необязательная заметка",
				taskReviseInstructions: "Инструкции",
				taskClose: "Закрыть задачу",
				taskCloseTitle: "Закрыть задачу без сдачи?",
				taskCloseDescription: "Для работы, которая уже не будет сдана: сделана руками, отменена или перекрыта. Причина уйдёт в журнал, задача отправится в архив.",
				taskCloseReason: "Почему закрываем?",
				rotationHeading: "Автоматическая ротация",
				rotationHint: "Заменяет сессию участника при превышении лимита. Память остаётся в задаче, а не в переписке.",
				rotationState: "Ротация",
				rotationOn: "Включена",
				rotationOff: "Выключена",
				rotationContextLimit: "Предел контекста, токенов",
				rotationTaskLimit: "Предел принятых задач",
				rotationZeroHint: "0 отключает это правило.",
				rotationSave: "Применить ротацию",
				rotationSaved: "Настройки ротации применены",
				rotationLoadFailed: "Настройки ротации недоступны",
				rotationSaveFailed: "Не удалось изменить ротацию",
				rotationSourceProfile: "из профиля",
				rotationSourceTeam: "задано в команде",
				rotationPending: "Изменения ротации не применены.",
				acknowledge: "Подтвердить",
				acknowledged: "Подтверждено"
			}
		};
		// src/client/index.ts
		/**
		* Open a session, whichever way this host offers.
		*
		* DSH 0.1.7 removed `sessions.open` from the client service and opens sessions through
		* `uiWorkspace.openSession` instead; 0.1.5 has the opposite. Reading the new one through `ctx.get`
		* keeps the panel working on both without declaring a service the older host does not have — and a
		* host that offers neither gets told so, because a click that silently does nothing is what sent a
		* person looking for a bug in the wrong place.
		*/
		function sessionOpener(ctx) {
			const read = (name) => {
				try {
					const value = ctx.get?.(name);
					return value !== null && typeof value === "object" ? value : void 0;
				} catch {
					return;
				}
			};
			return (sessionId) => {
				const workspace = read("uiWorkspace");
				if (typeof workspace?.openSession === "function") {
					workspace.openSession.call(workspace, sessionId);
					return true;
				}
				const legacy = ctx.sessions ?? void 0;
				if (typeof legacy?.open === "function") {
					legacy.open(sessionId);
					return true;
				}
				return false;
			};
		}
		const name = "dsh-live-teams";
		const inject = [
			"slots",
			"locale",
			"sessions"
		];
		function apply(ctx) {
			const t = ctx.locale.bind(NS);
			const opener = sessionOpener(ctx);
			ctx.effect(() => ctx.locale.register(NS, dictionaries), "dsh-live-teams: dictionaries");
			ctx.effect(installLiveTeamsStyles, "dsh-live-teams: styles");
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "live-teams-roster",
				order: 30,
				locale: NS,
				label: () => t("roster")
			}, () => react.createElement(PanelErrorBoundary, { label: "roster" }, react.createElement(Roster, { ctx: {
				sessions: ctx.sessions,
				t
			} }))));
			ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register({
				name: "conversation.session.header.utilities",
				id: "live-teams-attention",
				order: 20,
				locale: NS,
				label: () => t("attention")
			}, () => react.createElement(PanelErrorBoundary, { label: "attention chip" }, react.createElement(AttentionChip, { ctx: {
				sessions: ctx.sessions,
				t
			} }))));
			ctx.slots.inject("conversation.view", () => ctx.slots.register({
				name: "conversation.view",
				id: "team",
				order: 30,
				locale: NS,
				label: () => t("tab")
			}, (props) => {
				const seat = props ?? {};
				return react.createElement(PanelErrorBoundary, { label: "team panel" }, react.createElement(TeamView, {
					...seat.sessionId === void 0 ? {} : { sessionId: seat.sessionId },
					ctx: {
						sessions: ctx.sessions,
						openSession: opener,
						t
					}
				}));
			}));
		}
		exports.NS = NS;
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});
