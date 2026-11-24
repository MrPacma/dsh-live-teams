import { defineTool } from "@deepseek-ai/dsh-tools";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { messageDeliveryOutcome } from "./mailbox.js";
import { resolveLeadMemberId } from "./team-store.js";
// src/member-tools.ts
const MEMBER_TOOL_NAMES = Object.freeze([
	"live_team_send",
	"live_team_ack_message",
	"live_team_context",
	"live_team_status",
	"live_team_brief",
	"live_team_member_note",
	"live_team_grant",
	"live_team_dispatch",
	"live_team_create_task",
	"live_team_read_task",
	"live_team_list_tasks",
	"live_team_claim_task",
	"live_team_ack_task",
	"live_team_submit",
	"live_team_review",
	"live_team_update_task",
	"live_team_accept_task",
	"live_team_revise_task",
	"live_team_revoke_task",
	"live_team_cancel_task",
	"live_team_resume_task"
]);
/**
* Which team tools belong to whom.
*
* The host registers tools globally and gives a plugin no way to hide one from a Session, so a
* builder is *offered* the lead's tools and learns by refusal. The membership context is rendered on
* every turn, so it can say what belongs to the role — and that is what this is for: the context
* names the member's own tools and the ones addressed to somebody else.
*
* One list, not a second copy of the authority rules: `assertToolRolesComplete` (a test) fails if a
* tool is added without a home here, and the runtime guards in `execute` stay exactly as they are.
* Visibility is a hint; authority is still decided per call.
*/
const MEMBER_BASE_TOOLS = [
	"live_team_send",
	"live_team_ack_message",
	"live_team_context",
	"live_team_status",
	"live_team_brief",
	"live_team_read_task",
	"live_team_list_tasks",
	"live_team_claim_task",
	"live_team_ack_task",
	"live_team_submit"
];
const LEAD_TOOLS = [
	"live_team_create_task",
	"live_team_update_task",
	"live_team_revoke_task",
	"live_team_accept_task",
	"live_team_revise_task",
	"live_team_cancel_task",
	"live_team_resume_task",
	"live_team_grant",
	"live_team_dispatch",
	"live_team_member_note"
];
const REVIEW_TOOLS = ["live_team_review"];
/** Reviewer and verifier both judge work; the role files are craft, the capability is this. */
const REVIEW_ROLES = ["reviewer", "verifier"];
function toolsForRole(role) {
	const mine = [
		...MEMBER_BASE_TOOLS,
		...role === "lead" ? LEAD_TOOLS : [],
		...REVIEW_ROLES.includes(role) ? REVIEW_TOOLS : []
	];
	return {
		mine,
		notMine: MEMBER_TOOL_NAMES.filter((name) => !mine.includes(name))
	};
}
function sessionIdOf(exec) {
	const value = exec.agent?.session?.id;
	if (typeof value !== "string" || value.length === 0) throw new Error("calling Session has no identity");
	return value;
}
function memberName(binding, recipient) {
	if (recipient === "human") return "human";
	return binding.team.members.find((member) => member.memberId === recipient)?.displayName ?? recipient;
}
function sendResult(binding, messageId, deliveries) {
	const projected = deliveries.map((delivery) => ({
		recipient: delivery.recipient,
		name: memberName(binding, delivery.recipient),
		state: delivery.state,
		outcome: messageDeliveryOutcome(delivery),
		...delivery.state === "failed" && delivery.failure !== void 0 ? { failure: delivery.failure } : {}
	}));
	return {
		accepted: true,
		messageId,
		delivered: projected.filter((delivery) => delivery.outcome === "delivered").length,
		inbox: projected.filter((delivery) => delivery.outcome === "inbox").length,
		pending: projected.filter((delivery) => delivery.outcome === "pending").length,
		failed: projected.filter((delivery) => delivery.outcome === "failed").length,
		deliveries: projected
	};
}
function memberContext(binding) {
	return {
		teamName: binding.teamName,
		memberName: binding.member.displayName,
		role: binding.member.role,
		availability: binding.member.availability,
		members: binding.team.members.map((member) => ({
			memberId: member.memberId,
			name: member.displayName,
			role: member.role,
			availability: member.availability,
			live: binding.live(member)
		}))
	};
}
function memberStatus(binding) {
	return {
		memberId: binding.member.memberId,
		teamId: binding.team.teamId,
		role: binding.member.role,
		availability: binding.member.availability,
		bindingGeneration: binding.member.bindingGeneration,
		contractRevision: binding.member.contractRevision,
		live: binding.live(binding.member)
	};
}
function renderOutput(value) {
	return [{
		type: "text",
		text: JSON.stringify(value)
	}];
}
function jsonRecord(value) {
	return JSON.parse(JSON.stringify(value));
}
function jsonCreateResult(value) {
	const candidate = jsonRecord(value);
	return {
		task: jsonRecord(candidate.task),
		documentPath: String(candidate.documentPath),
		...Array.isArray(candidate.warnings) ? { warnings: candidate.warnings } : {}
	};
}
function jsonReadResult(value) {
	const candidate = jsonRecord(value);
	return {
		task: jsonRecord(candidate.task),
		document: String(candidate.document),
		submissions: Array.isArray(candidate.submissions) ? candidate.submissions : [],
		rounds: Array.isArray(candidate.rounds) ? candidate.rounds : []
	};
}
function jsonListedTasks(value) {
	return JSON.parse(JSON.stringify(value));
}
function normalizeOptions(options, b18, b19, b20) {
	if (typeof options === "object" && options !== null) return {
		includeContext: options.includeContext === true,
		includeContact: options.includeContact === true,
		includeTasks: options.includeTasks === true,
		includeSubmissions: options.includeSubmissions === true,
		includeReview: options.includeReview === true,
		includeAcceptance: options.includeAcceptance === true,
		includeDispatch: options.includeDispatch === true
	};
	return {
		includeContext: options === true,
		includeContact: b18 === true,
		includeTasks: b19 === true,
		includeSubmissions: b20 === true,
		includeReview: false,
		includeAcceptance: false,
		includeDispatch: false
	};
}
/** Mount B13 only when the optional tools service is present. */
function registerMemberToolsIfAvailable(registry, resolve, options = {}, legacyB18 = false, legacyB19 = false, legacyB20 = false) {
	if (registry === void 0) return false;
	registerMemberTools(registry, resolve, typeof options === "boolean" ? {
		includeContext: true,
		includeContact: legacyB18,
		includeTasks: legacyB19,
		includeSubmissions: legacyB20
	} : {
		includeContext: true,
		...options
	});
	return true;
}
/** Register the member-tool surface. Object options prevent positional flag drift as gates grow. */
function registerMemberTools(registry, resolve, options = false, legacyB18, legacyB19, legacyB20) {
	const flags = normalizeOptions(options, legacyB18, legacyB19, legacyB20);
	const includeContext = flags.includeContext;
	const includeContact = flags.includeContact;
	const includeTasks = flags.includeTasks;
	const includeSubmissions = flags.includeSubmissions;
	const includeReview = flags.includeReview;
	const includeAcceptance = flags.includeAcceptance;
	const includeDispatch = flags.includeDispatch;
	registry.register(defineTool({
		name: "live_team_send",
		description: "Send a message, direction, or comment to a member id or display name, the team, or the human.",
		parameters: {
			to: {
				type: "string",
				required: true,
				description: "A member id, display name, 'team', or 'human'."
			},
			kind: {
				type: "string",
				enum: [
					"message",
					"direction",
					"comment",
					"report"
				],
				description: "The message kind: `message` (the default), `direction` (the lead directing a member), `comment` (a note on someone else's work). `report` is accepted as a synonym for `message`."
			},
			content: {
				type: "string",
				required: true,
				description: "The message body."
			},
			threadId: {
				type: "string",
				description: "Optional thread to continue."
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					accepted: {
						type: "boolean",
						required: true
					},
					messageId: {
						type: "string",
						required: true
					},
					delivered: {
						type: "number",
						required: true
					},
					inbox: {
						type: "number",
						required: true
					},
					pending: {
						type: "number",
						required: true
					},
					failed: {
						type: "number",
						required: true
					},
					deliveries: {
						type: "array",
						required: true,
						items: {
							type: "object",
							additionalProperties: false,
							properties: {
								recipient: {
									type: "string",
									required: true
								},
								name: {
									type: "string",
									required: true
								},
								state: {
									type: "string",
									required: true,
									enum: [
										"stored",
										"leased",
										"delivered",
										"acknowledged",
										"failed"
									]
								},
								outcome: {
									type: "string",
									required: true,
									enum: [
										"delivered",
										"inbox",
										"pending",
										"failed"
									]
								},
								failure: { type: "string" }
							}
						}
					}
				}
			},
			render: (_args, value) => {
				const result = value;
				const statements = result.deliveries.map((delivery) => {
					if (delivery.outcome === "delivered") return `Delivered to ${delivery.name}.`;
					if (delivery.outcome === "inbox") return delivery.name === "human" ? "Stored in the human inbox (waits for the human)." : `Stored for ${delivery.name}'s context.`;
					if (delivery.outcome === "pending") return `Pending delivery to ${delivery.name}.`;
					return `Failed to deliver to ${delivery.name}: ${delivery.failure ?? "delivery failed"}.`;
				});
				const undelivered = result.deliveries.filter((delivery) => delivery.outcome === "failed" || delivery.outcome === "pending");
				const warning = undelivered.length === 0 ? "" : result.delivered === 0 && result.inbox === 0 ? ` Nothing was delivered to: ${undelivered.map((delivery) => `${delivery.name} (${delivery.outcome}${delivery.failure === void 0 ? "" : `: ${delivery.failure}`})`).join(", ")}.` : ` Not delivered to: ${undelivered.map((delivery) => `${delivery.name} (${delivery.outcome}${delivery.failure === void 0 ? "" : `: ${delivery.failure}`})`).join(", ")}.`;
				return [{
					type: "text",
					text: `Accepted. ${statements.join(" ")}${warning}`
				}];
			}
		},
		execute: async (args, exec) => {
			const sessionId = sessionIdOf(exec);
			const binding = await resolve(sessionId);
			if (binding === void 0) throw new Error("calling Session is not an active member of this team");
			const draft = {
				...args,
				kind: args.kind === void 0 || args.kind === "report" ? "message" : args.kind
			};
			const result = await binding.mailbox.sendFromSession(sessionId, draft);
			return sendResult(binding, result.message.id, result.deliveries);
		}
	}));
	registry.register(defineTool({
		name: "live_team_ack_message",
		description: "Acknowledge the calling member's own delivery of a team message.",
		parameters: { messageId: {
			type: "string",
			required: true
		} },
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					acknowledged: {
						type: "boolean",
						required: true
					},
					messageId: {
						type: "string",
						required: true
					}
				}
			},
			render: (_args, value) => renderOutput(value)
		},
		execute: async (args, exec) => {
			const binding = await resolve(sessionIdOf(exec));
			if (binding === void 0) throw new Error("calling Session is not an active member of this team");
			await binding.mailbox.acknowledge(args.messageId, binding.member.memberId);
			return {
				acknowledged: true,
				messageId: args.messageId
			};
		}
	}));
	registry.register(defineTool({
		name: "live_team_context",
		description: "Read the bounded current team context for the calling member.",
		parameters: {},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					teamName: {
						type: "string",
						required: true
					},
					memberName: {
						type: "string",
						required: true
					},
					role: {
						type: "string",
						required: true
					},
					availability: {
						type: "string",
						required: true
					},
					members: {
						type: "array",
						required: true,
						items: {
							type: "object",
							additionalProperties: false,
							properties: {
								memberId: {
									type: "string",
									required: true
								},
								name: {
									type: "string",
									required: true
								},
								role: {
									type: "string",
									required: true
								},
								availability: {
									type: "string",
									required: true
								},
								live: {
									type: "boolean",
									required: true
								}
							}
						}
					}
				}
			},
			render: (_args, value) => renderOutput(value)
		},
		execute: async (_args, exec) => {
			const binding = await resolve(sessionIdOf(exec));
			if (binding === void 0) throw new Error("calling Session is not an active member of this team");
			return memberContext(binding);
		}
	}));
	if (includeContact) registry.register(defineTool({
		name: "live_team_grant",
		description: "List your permitted contacts, or ask the lead to grant/revoke a contact.",
		parameters: {
			action: {
				type: "string",
				required: true,
				enum: [
					"list",
					"add",
					"remove"
				]
			},
			memberId: { type: "string" },
			allow: { type: "string" }
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					grants: {
						type: "array",
						required: true
					},
					leadMemberId: { type: "string" }
				}
			},
			render: (_args, value) => renderOutput(value)
		},
		execute: async (args, exec) => {
			const binding = await resolve(sessionIdOf(exec));
			if (binding === void 0) throw new Error("calling Session is not an active member of this team");
			const leadId = resolveLeadMemberId(binding.team);
			const ownGrants = (binding.team.contactGrants ?? []).filter((grant) => grant.from === binding.member.memberId);
			if (args.action === "list") return {
				grants: ownGrants,
				...leadId === void 0 ? {} : { leadMemberId: leadId }
			};
			if (binding.member.memberId !== leadId) throw new Error(`only the lead may change contact grants; ask ${leadId ?? "the lead"}`);
			if (typeof args.memberId !== "string" || args.memberId.length === 0 || typeof args.allow !== "string" || args.allow.length === 0) throw new Error("memberId and allow are required");
			if (binding.updateContactGrant === void 0) throw new Error("contact grants are unavailable");
			return binding.updateContactGrant(args.memberId, args.allow, args.action, binding.member.memberId);
		}
	}));
	if (includeDispatch) registry.register(defineTool({
		name: "live_team_dispatch",
		description: "Pause or resume automatic dispatch for this team. Only the lead may change it. Pausing stops new work from starting: it never revokes a running attempt, never moves ownership, and never drops a message already queued for a member.",
		parameters: {
			mode: {
				type: "string",
				required: true,
				enum: ["auto", "paused"]
			},
			reason: { type: "string" }
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					from: {
						type: "string",
						required: true
					},
					to: {
						type: "string",
						required: true
					}
				}
			},
			render: (_args, value) => renderOutput(value)
		},
		execute: async (args, exec) => {
			const binding = await resolve(sessionIdOf(exec));
			if (binding === void 0) throw new Error("calling Session is not an active member of this team");
			const leadId = resolveLeadMemberId(binding.team);
			if (binding.member.memberId !== leadId) throw new Error(`only the lead may pause or resume dispatch; ask ${leadId ?? "the lead"}`);
			if (binding.setDispatch === void 0) throw new Error("dispatch is unavailable");
			const result = await binding.setDispatch({
				mode: args.mode,
				actor: binding.member.memberId,
				...typeof args.reason === "string" && args.reason.trim().length > 0 ? { reason: args.reason.trim() } : {}
			});
			return {
				from: result.from,
				to: result.to
			};
		}
	}));
	if (includeTasks) {
		registry.register(defineTool({
			name: "live_team_create_task",
			description: "Create a durable task. Only the team lead may create tasks.",
			parameters: {
				title: {
					type: "string",
					required: true
				},
				kind: {
					type: "string",
					required: true,
					enum: [
						"work",
						"research",
						"requirements",
						"implementation",
						"verification",
						"review",
						"repair",
						"integration"
					]
				},
				assignee: { type: "string" },
				route: {
					type: "json",
					description: "Who receives the finished work: {\"type\":\"review\",\"reviewer\":\"<Reviewer member id>\"} or {\"type\":\"report\",\"to\":\"<Lead/member id>\"}; use {\"type\":\"report\",\"to\":\"human\"} only when the report is intended for the human. For small Builder → Lead work, name the Lead member id. Report recipient does not change Lead/human acceptance authority."
				},
				humanContact: {
					type: "string",
					enum: [
						"none",
						"expected",
						"required"
					]
				},
				acceptance: {
					type: "array",
					required: true,
					items: { type: "string" },
					description: "What \"done\" means, each criterion checkable inside this task declared paths (e.g. \"node --test packages/alpha/test\"). A repository-wide criterion needs a declared dependency: a sibling task in flight makes it unsatisfiable."
				},
				checks: {
					type: "array",
					items: { type: "string" }
				},
				why: { type: "string" },
				body: { type: "string" },
				roundLimit: { type: "integer" },
				dependsOn: {
					type: "array",
					items: { type: "string" }
				},
				paths: {
					type: "array",
					items: { type: "string" },
					description: "Workspace-relative globs this task may touch. Two writing tasks with intersecting paths never run at the same time, so declare them for any task that writes code."
				}
			},
			output: {
				schema: {
					type: "object",
					additionalProperties: false,
					properties: {
						task: {
							type: "json",
							required: true
						},
						documentPath: {
							type: "string",
							required: true
						},
						warnings: {
							type: "array",
							items: { type: "json" }
						}
					}
				},
				render: (_args, value) => renderOutput(value)
			},
			execute: async (args, exec) => {
				const binding = await resolve(sessionIdOf(exec));
				if (binding === void 0) throw new Error("calling Session is not an active member of this team");
				const leadId = resolveLeadMemberId(binding.team);
				if (binding.member.memberId !== leadId) throw new Error(`only the lead may create tasks; ask ${leadId ?? "the lead"}`);
				if (binding.taskStore === void 0) throw new Error("task store is unavailable");
				return jsonCreateResult(await binding.taskStore.createTask({
					...args,
					actor: binding.member.memberId
				}));
			}
		}));
		registry.register(defineTool({
			name: "live_team_update_task",
			description: "Edit the contract of a task you created: title, kind, assignee, route, acceptance, checks, why, body, round limit, human contact, dependencies, declared paths. Only the lead may update tasks, and only while nobody has started them (draft or ready). Absent fields are left alone; assignee, route, dependsOn and paths accept null to clear them.",
			parameters: {
				taskId: {
					type: "string",
					required: true
				},
				expectedRevision: { type: "integer" },
				title: { type: "string" },
				kind: {
					type: "string",
					enum: [
						"work",
						"research",
						"requirements",
						"implementation",
						"verification",
						"review",
						"repair",
						"integration"
					]
				},
				assignee: { type: "string" },
				route: {
					type: "json",
					description: "Who receives the finished work: {\"type\":\"review\",\"reviewer\":\"<Reviewer member id>\"} or {\"type\":\"report\",\"to\":\"<Lead/member id>\"}; use {\"type\":\"report\",\"to\":\"human\"} only when the report is intended for the human. For small Builder → Lead work, name the Lead member id. Report recipient does not change Lead/human acceptance authority."
				},
				humanContact: {
					type: "string",
					enum: [
						"none",
						"expected",
						"required"
					]
				},
				acceptance: {
					type: "array",
					items: { type: "string" },
					description: "What \"done\" means, each criterion checkable inside this task declared paths (e.g. \"node --test packages/alpha/test\"). A repository-wide criterion needs a declared dependency: a sibling task in flight makes it unsatisfiable."
				},
				checks: {
					type: "array",
					items: { type: "string" }
				},
				why: { type: "string" },
				body: { type: "string" },
				roundLimit: { type: "integer" },
				dependsOn: {
					type: "array",
					items: { type: "string" }
				},
				paths: {
					type: "array",
					items: { type: "string" },
					description: "Workspace-relative globs this task may touch; null clears the declaration."
				}
			},
			output: {
				schema: {
					type: "object",
					additionalProperties: false,
					properties: {
						task: {
							type: "json",
							required: true
						},
						document: {
							type: "string",
							required: true
						},
						changed: {
							type: "array",
							required: true,
							items: { type: "string" }
						},
						warnings: {
							type: "array",
							items: { type: "json" }
						}
					}
				},
				render: (_args, value) => renderOutput(value)
			},
			execute: async (args, exec) => {
				const binding = await resolve(sessionIdOf(exec));
				if (binding === void 0) throw new Error("calling Session is not an active member of this team");
				if (binding.taskStore === void 0) throw new Error("task store is unavailable");
				const result = await binding.taskStore.updateTask({
					...args,
					actor: binding.member.memberId
				});
				return {
					task: jsonRecord(result.task),
					document: result.document,
					changed: [...result.changed],
					...result.warnings === void 0 ? {} : { warnings: result.warnings.map(jsonRecord) }
				};
			}
		}));
		registry.register(defineTool({
			name: "live_team_cancel_task",
			description: "Cancel and archive a task without accepting its work. Only the lead may cancel. A running attempt is invalidated and its Session must be observed stopped first. If that cannot be established, returns quiesced:false and needs_human without archiving; retry after resolving the runtime stop. Historical submissions remain evidence. Inspect notifications for the author notice; saved cancellation is not delivery and must not be repeated to retry a handoff.",
			parameters: {
				taskId: {
					type: "string",
					required: true
				},
				reason: {
					type: "string",
					required: true
				},
				expectedRevision: { type: "integer" }
			},
			output: {
				schema: {
					type: "object",
					additionalProperties: false,
					properties: {
						task: {
							type: "json",
							required: true
						},
						archivedPath: { type: "string" },
						quiesced: {
							type: "boolean",
							required: true
						},
						notifications: {
							type: "array",
							items: { type: "json" },
							required: true
						}
					}
				},
				render: (_args, value) => renderOutput(value)
			},
			execute: async (args, exec) => {
				const binding = await resolve(sessionIdOf(exec));
				if (binding === void 0) throw new Error("calling Session is not an active member of this team");
				if (binding.taskStore === void 0) throw new Error("task store is unavailable");
				const result = await binding.taskStore.cancelTask({
					...args,
					actor: binding.member.memberId
				});
				return {
					task: jsonRecord(result.task),
					quiesced: result.quiesced,
					notifications: (result.notifications ?? []).map(jsonRecord),
					...result.archivedPath === void 0 ? {} : { archivedPath: result.archivedPath }
				};
			}
		}));
		registry.register(defineTool({
			name: "live_team_resume_task",
			description: "Explicitly release a parked draft task back to the ready queue. Only the lead may resume. Revocation itself never automatically restarts work. The existing contract must have an assignee, route and acceptance criteria; no live/revoking attempt may remain.",
			parameters: {
				taskId: {
					type: "string",
					required: true
				},
				expectedRevision: { type: "integer" }
			},
			output: {
				schema: {
					type: "object",
					additionalProperties: false,
					properties: { task: {
						type: "json",
						required: true
					} }
				},
				render: (_args, value) => renderOutput(value)
			},
			execute: async (args, exec) => {
				const binding = await resolve(sessionIdOf(exec));
				if (binding === void 0) throw new Error("calling Session is not an active member of this team");
				if (binding.taskStore === void 0) throw new Error("task store is unavailable");
				return { task: jsonRecord((await binding.taskStore.resumeTask({
					...args,
					actor: binding.member.memberId
				})).task) };
			}
		}));
		registry.register(defineTool({
			name: "live_team_revoke_task",
			description: "Take a task away from the member working on it: invalidate their attempt, stop their Session, and park the task in draft (optionally for a new assignee). Only the lead may revoke. It will not be automatically reclaimed: use live_team_resume_task explicitly to restart. If the Session cannot be observed to have stopped, the task goes to needs_human instead of pretending it was revoked.",
			parameters: {
				taskId: {
					type: "string",
					required: true
				},
				reason: {
					type: "string",
					required: true
				},
				nextAssignee: { type: "string" },
				expectedRevision: { type: "integer" }
			},
			output: {
				schema: {
					type: "object",
					additionalProperties: false,
					properties: {
						task: {
							type: "json",
							required: true
						},
						attempt: {
							type: "json",
							required: true
						},
						quiesced: {
							type: "boolean",
							required: true
						},
						reassigned: {
							type: "boolean",
							required: true
						}
					}
				},
				render: (_args, value) => renderOutput(value)
			},
			execute: async (args, exec) => {
				const binding = await resolve(sessionIdOf(exec));
				if (binding === void 0) throw new Error("calling Session is not an active member of this team");
				if (binding.taskStore === void 0) throw new Error("task store is unavailable");
				const result = await binding.taskStore.revokeTask({
					...args,
					actor: binding.member.memberId
				});
				return {
					task: jsonRecord(result.task),
					attempt: jsonRecord(result.attempt),
					quiesced: result.quiesced,
					reassigned: result.reassigned
				};
			}
		}));
		registry.register(defineTool({
			name: "live_team_read_task",
			description: "Read a durable task and its authored document. An archived task is history: read it for a specific question, never to rebuild state.",
			parameters: { taskId: {
				type: "string",
				required: true
			} },
			output: {
				schema: {
					type: "object",
					additionalProperties: false,
					properties: {
						task: {
							type: "json",
							required: true
						},
						document: {
							type: "string",
							required: true
						},
						submissions: {
							type: "array",
							required: true
						},
						rounds: {
							type: "array",
							required: true
						}
					}
				},
				render: (_args, value) => renderOutput(value)
			},
			execute: async (args, exec) => {
				const binding = await resolve(sessionIdOf(exec));
				if (binding === void 0) throw new Error("calling Session is not an active member of this team");
				if (binding.taskStore === void 0) throw new Error("task store is unavailable");
				return jsonReadResult(await binding.taskStore.readTask(args.taskId));
			}
		}));
		registry.register(defineTool({
			name: "live_team_list_tasks",
			description: "List durable tasks for this team, newest first; archived tasks are hidden unless requested. Archived rows are history: ask for them only to answer a specific question.",
			parameters: { includeArchived: { type: "boolean" } },
			output: {
				schema: {
					type: "object",
					additionalProperties: false,
					properties: { tasks: {
						type: "array",
						required: true,
						items: {
							type: "object",
							additionalProperties: true,
							properties: { documentMissing: { type: "boolean" } }
						}
					} }
				},
				render: (_args, value) => renderOutput(value)
			},
			execute: async (args, exec) => {
				const binding = await resolve(sessionIdOf(exec));
				if (binding === void 0) throw new Error("calling Session is not an active member of this team");
				if (binding.taskStore === void 0) throw new Error("task store is unavailable");
				return jsonListedTasks({ tasks: await binding.taskStore.listTasks({ includeArchived: args.includeArchived === true }) });
			}
		}));
		if (includeSubmissions) {
			registry.register(defineTool({
				name: "live_team_claim_task",
				description: "Claim your assigned ready task and create its active attempt.",
				parameters: { taskId: {
					type: "string",
					required: true
				} },
				output: {
					schema: {
						type: "object",
						additionalProperties: false,
						properties: {
							task: {
								type: "json",
								required: true
							},
							attempt: {
								type: "json",
								required: true
							}
						}
					},
					render: (_args, value) => renderOutput(value)
				},
				execute: async (args, exec) => {
					const binding = await resolve(sessionIdOf(exec));
					if (binding === void 0) throw new Error("calling Session is not an active member of this team");
					if (binding.taskStore === void 0) throw new Error("task store is unavailable");
					const result = await binding.taskStore.claimTask({
						taskId: args.taskId,
						memberId: binding.member.memberId,
						sessionId: binding.member.sessionId ?? sessionIdOf(exec),
						bindingGeneration: binding.member.bindingGeneration
					});
					return {
						task: jsonRecord(result.task),
						attempt: jsonRecord(result.attempt)
					};
				}
			}));
			registry.register(defineTool({
				name: "live_team_ack_task",
				description: "Acknowledge your claimed task and move it into progress.",
				parameters: { taskId: {
					type: "string",
					required: true
				} },
				output: {
					schema: {
						type: "object",
						additionalProperties: false,
						properties: { task: {
							type: "json",
							required: true
						} }
					},
					render: (_args, value) => renderOutput(value)
				},
				execute: async (args, exec) => {
					const binding = await resolve(sessionIdOf(exec));
					if (binding === void 0) throw new Error("calling Session is not an active member of this team");
					if (binding.taskStore === void 0) throw new Error("task store is unavailable");
					return { task: jsonRecord((await binding.taskStore.acknowledgeTask({
						taskId: args.taskId,
						memberId: binding.member.memberId,
						sessionId: sessionIdOf(exec),
						bindingGeneration: binding.member.bindingGeneration
					})).task) };
				}
			}));
		}
	}
	if (includeReview) {
		registry.register(defineTool({
			name: "live_team_submit",
			description: "Submit an immutable report or file artifact for the active task attempt. Returns the saved submission and per-recipient notifications. Saving is not notification: queued means native admission, not execution or acceptance; pending/failed/unavailable needs attention without resubmitting or blind duplicate sends. Report routes notify current Lead; review routes notify their Reviewer. A refusal before saving changes nothing about the task.",
			parameters: {
				taskId: {
					type: "string",
					required: true
				},
				artifact: {
					type: "json",
					required: true,
					description: "Exactly one of two shapes, with exactly these keys: {\"type\":\"report\",\"bodyRef\":\"<workspace-relative path to the report you wrote>\"} or {\"type\":\"files\",\"paths\":[\"<workspace-relative path>\", \"...\"]}. `type` is required; no other keys are accepted. Write a report body under .dsh-live-teams/reports/<task-id>.md, never in the repository root: the root is the integration tree."
				},
				summary: {
					type: "string",
					required: true,
					description: "One or two sentences: what you changed and what you observed."
				},
				checks: {
					type: "array",
					items: { type: "json" },
					description: "The checks you actually ran: [{\"command\":\"npm test\",\"status\":\"passed\" | \"failed\",\"output\":\"<short tail>\"}]. Each entry needs `command` and `status`."
				}
			},
			output: {
				schema: {
					type: "object",
					additionalProperties: false,
					properties: {
						submission: {
							type: "json",
							required: true
						},
						notifications: {
							type: "array",
							items: { type: "json" },
							required: true
						}
					}
				},
				render: (_args, value) => renderOutput(value)
			},
			execute: async (args, exec) => {
				const sessionId = sessionIdOf(exec);
				const binding = await resolve(sessionId);
				if (binding === void 0) throw new Error("calling Session is not an active member of this team");
				if (binding.taskStore === void 0) throw new Error("task store is unavailable");
				const raw = args.artifact;
				let artifactInput;
				if (typeof raw === "string") try {
					artifactInput = JSON.parse(raw);
				} catch {
					artifactInput = void 0;
				}
				else if (raw !== null && typeof raw === "object") artifactInput = raw;
				const observed = raw === void 0 ? "undefined" : typeof raw === "string" ? `a JSON string: ${JSON.stringify(raw.slice(0, 120))}` : JSON.stringify(raw);
				const declared = typeof artifactInput?.type === "string" ? artifactInput.type.trim().toLowerCase() : artifactInput?.type;
				const shape = artifactInput === void 0 ? observed : Object.keys(artifactInput).join(", ");
				if (declared === "report" && typeof artifactInput?.bodyRef !== "string") throw new Error(`artifact {"type":"report"} needs a string "bodyRef"; received keys: ${shape}. Accepted shapes: {"type":"report","bodyRef":"<path>"} or {"type":"files","paths":["<path>", "…"]}`);
				if (declared === "files" && (!Array.isArray(artifactInput?.paths) || artifactInput.paths.length === 0 || !artifactInput.paths.every((entry) => typeof entry === "string"))) throw new Error(`artifact {"type":"files"} needs a non-empty "paths" array of strings; received keys: ${shape}. Accepted shapes: {"type":"files","paths":["<path>", "…"]} or {"type":"report","bodyRef":"<path>"}`);
				if (declared !== "report" && declared !== "files") throw new Error(`artifact must declare its shape with "type":"report" or "type":"files"; received keys: ${shape}; "type" was ${JSON.stringify(artifactInput?.type)}. Accepted shapes: {"type":"report","bodyRef":"<path>"} or {"type":"files","paths":["<path>", "…"]}`);
				const artifact = declared === "report" ? {
					type: "report",
					bodyRef: (artifactInput?.bodyRef).trim()
				} : {
					type: "files",
					paths: (artifactInput?.paths).map((entry) => entry.trim())
				};
				const result = await binding.taskStore.submitTask({
					taskId: args.taskId,
					memberId: binding.member.memberId,
					sessionId,
					bindingGeneration: binding.member.bindingGeneration,
					artifact,
					summary: args.summary,
					checks: args.checks ?? []
				});
				return {
					submission: jsonRecord(result.submission),
					notifications: Array.isArray(result.notifications) ? result.notifications.map(jsonRecord) : []
				};
			}
		}));
		registry.register(defineTool({
			name: "live_team_review",
			description: "Reviewer only. Save a terminal verdict on the latest immutable submission. PASS keeps existing automatic acceptance and notifies current Lead; ESCALATE requests Lead decision; NEEDS_REVISION returns through the existing author/Lead protocol. Inspect notifications: saved verdict is not delivery, queued is native admission not reading/execution, and absent/pending/failed/unavailable is not permission to claim notification or repeat review. PASS needs at least one check you ran, command and observed output; inspection counts.",
			parameters: {
				taskId: {
					type: "string",
					required: true
				},
				submissionId: {
					type: "string",
					required: true
				},
				verdict: {
					type: "string",
					required: true,
					enum: [
						"pass",
						"needs_revision",
						"escalate"
					]
				},
				findings: {
					type: "array",
					items: { type: "json" },
					description: "One entry per problem: [{\"severity\":\"low\" | \"medium\" | \"high\" | \"blocker\",\"problem\":\"…\",\"requiredFix\":\"…\",\"artifactLocation\":\"<optional path>\"}]. Required for a verdict other than pass."
				},
				evidence: {
					type: "array",
					items: { type: "json" },
					description: "What you ran while judging: [{\"command\":\"npm test\",\"status\":\"passed\" | \"failed\",\"output\":\"<short tail>\"}]."
				}
			},
			output: {
				schema: {
					type: "object",
					additionalProperties: false,
					properties: {
						round: {
							type: "json",
							required: true
						},
						task: {
							type: "json",
							required: true
						},
						notifications: {
							type: "array",
							items: { type: "json" },
							required: true
						}
					}
				},
				render: (_args, value) => renderOutput(value)
			},
			execute: async (args, exec) => {
				const binding = await resolve(sessionIdOf(exec));
				if (binding === void 0) throw new Error("calling Session is not an active member of this team");
				if (binding.taskStore === void 0) throw new Error("task store is unavailable");
				const result = await binding.taskStore.reviewTask({
					taskId: args.taskId,
					submissionId: args.submissionId,
					reviewerMemberId: binding.member.memberId,
					verdict: args.verdict,
					findings: args.findings ?? [],
					evidence: args.evidence ?? []
				});
				return {
					round: jsonRecord(result.round),
					task: jsonRecord(result.task),
					notifications: (result.notifications ?? []).map(jsonRecord)
				};
			}
		}));
	}
	if (includeAcceptance) {
		registry.register(defineTool({
			name: "live_team_accept_task",
			description: "Accept a waiting task as the team lead and archive its authored document. Inspect notifications for the author handoff: saved acceptance is not delivery; never accept again just to retry a notice.",
			parameters: {
				taskId: {
					type: "string",
					required: true
				},
				note: { type: "string" }
			},
			output: {
				schema: {
					type: "object",
					additionalProperties: false,
					properties: {
						task: {
							type: "json",
							required: true
						},
						archivedPath: {
							type: "string",
							required: true
						},
						notifications: {
							type: "array",
							items: { type: "json" },
							required: true
						}
					}
				},
				render: (_args, value) => renderOutput(value)
			},
			execute: async (args, exec) => {
				const binding = await resolve(sessionIdOf(exec));
				if (binding === void 0) throw new Error("calling Session is not an active member of this team");
				if (binding.taskStore === void 0) throw new Error("task store is unavailable");
				const leadId = resolveLeadMemberId(binding.team);
				if (binding.member.memberId !== leadId) throw new Error(`only the lead may accept tasks; ask ${leadId ?? "the lead"}`);
				const result = await binding.taskStore.acceptTask({
					taskId: args.taskId,
					actor: binding.member.memberId,
					...args.note === void 0 ? {} : { note: args.note }
				});
				return {
					task: jsonRecord(result.task),
					archivedPath: result.archivedPath,
					notifications: (result.notifications ?? []).map(jsonRecord)
				};
			}
		}));
		registry.register(defineTool({
			name: "live_team_revise_task",
			description: "Return a waiting task to progress with high-priority instructions for its assignee. Inspect notifications: saved revision is not delivery; do not revise again just to retry a notice.",
			parameters: {
				taskId: {
					type: "string",
					required: true
				},
				instructions: {
					type: "string",
					required: true
				}
			},
			output: {
				schema: {
					type: "object",
					additionalProperties: false,
					properties: {
						task: {
							type: "json",
							required: true
						},
						notifications: {
							type: "array",
							items: { type: "json" },
							required: true
						}
					}
				},
				render: (_args, value) => renderOutput(value)
			},
			execute: async (args, exec) => {
				const binding = await resolve(sessionIdOf(exec));
				if (binding === void 0) throw new Error("calling Session is not an active member of this team");
				if (binding.taskStore === void 0) throw new Error("task store is unavailable");
				const leadId = resolveLeadMemberId(binding.team);
				if (binding.member.memberId !== leadId) throw new Error(`only the lead may revise tasks; ask ${leadId ?? "the lead"}`);
				const result = await binding.taskStore.reviseTask({
					taskId: args.taskId,
					actor: binding.member.memberId,
					instructions: args.instructions
				});
				return {
					task: jsonRecord(result.task),
					notifications: (result.notifications ?? []).map(jsonRecord)
				};
			}
		}));
	}
	if (includeContext) registry.register(defineTool({
		name: "live_team_brief",
		description: "Read or update the team briefing. Only the team lead may update it.",
		parameters: {
			action: {
				type: "string",
				required: true,
				enum: ["read", "update"]
			},
			text: { type: "string" }
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					text: { type: "string" },
					saved: { type: "boolean" },
					length: { type: "number" }
				}
			},
			render: (_args, value) => renderOutput(value)
		},
		execute: async (args, exec) => {
			const binding = await resolve(sessionIdOf(exec));
			if (binding === void 0) throw new Error("calling Session is not an active member of this team");
			const leadId = resolveLeadMemberId(binding.team);
			if (args.action === "read") {
				if (binding.workspacePath === void 0) return { text: "" };
				try {
					return { text: await readFile(path.join(binding.workspacePath, ".dsh-live-teams", "BRIEF.md"), "utf8") };
				} catch {
					return { text: "" };
				}
			}
			if (binding.member.memberId !== leadId) throw new Error("briefing is owned by the lead; ask the lead to update it");
			if (typeof args.text !== "string") throw new Error("text is required for update");
			const next = args.text.trim().slice(0, 8e3);
			if (binding.workspacePath === void 0) throw new Error("team workspace is unavailable");
			await mkdir(path.join(binding.workspacePath, ".dsh-live-teams"), { recursive: true });
			const file = path.join(binding.workspacePath, ".dsh-live-teams", "BRIEF.md");
			if (next.length === 0) await writeFile(file, "", "utf8");
			else await writeFile(file, next, "utf8");
			await binding.appendAudit?.({
				kind: "briefing/updated",
				actor: binding.member.memberId,
				length: next.length,
				at: Date.now()
			});
			return {
				saved: true,
				length: next.length
			};
		}
	}));
	if (includeContext) registry.register(defineTool({
		name: "live_team_member_note",
		description: "Set a member note. Only the team lead may update notes.",
		parameters: {
			memberId: {
				type: "string",
				required: true
			},
			note: {
				type: "string",
				required: true
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					memberId: {
						type: "string",
						required: true
					},
					note: {
						type: "string",
						required: true
					}
				}
			},
			render: (_args, value) => renderOutput(value)
		},
		execute: async (args, exec) => {
			const binding = await resolve(sessionIdOf(exec));
			if (binding === void 0) throw new Error("calling Session is not an active member of this team");
			const leadId = resolveLeadMemberId(binding.team);
			if (binding.member.memberId !== leadId) throw new Error("briefing is owned by the lead; ask the lead to update the member note");
			if (binding.team.members.find((entry) => entry.memberId === args.memberId) === void 0) throw new Error("member not found");
			const note = args.note.trim().slice(0, 200);
			if (binding.setMemberNote !== void 0) await binding.setMemberNote(args.memberId, note, binding.member.memberId);
			await binding.appendAudit?.({
				kind: "member/note",
				memberId: args.memberId,
				note,
				actor: binding.member.memberId,
				at: Date.now()
			});
			return {
				memberId: args.memberId,
				note
			};
		}
	}));
	registry.register(defineTool({
		name: "live_team_status",
		description: "Read the calling member current binding and contract status.",
		parameters: {},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					memberId: {
						type: "string",
						required: true
					},
					teamId: {
						type: "string",
						required: true
					},
					role: {
						type: "string",
						required: true
					},
					availability: {
						type: "string",
						required: true
					},
					bindingGeneration: {
						type: "number",
						required: true
					},
					contractRevision: {
						type: "number",
						required: true
					},
					live: {
						type: "boolean",
						required: true
					}
				}
			},
			render: (_args, value) => renderOutput(value)
		},
		execute: async (_args, exec) => {
			const binding = await resolve(sessionIdOf(exec));
			if (binding === void 0) throw new Error("calling Session is not an active member of this team");
			return memberStatus(binding);
		}
	}));
}
export { MEMBER_TOOL_NAMES, registerMemberTools, registerMemberToolsIfAvailable, toolsForRole };
