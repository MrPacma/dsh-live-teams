import path from "node:path";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { access, copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { ERROR_CODES, LiveTeamsError } from "./errors.js";
import { checkCompatibility } from "./compatibility.js";
import { TeamStore, readDispatchSwitch, readMemberBySessionSync, readTeamRotation, readTeamStateSync, resolveLeadMemberId } from "./team-store.js";
import { readRoleRegistry, readRoleRegistrySync } from "./roles.js";
import { createSessionBridge } from "./session-bridge.js";
import { createCommandQueue } from "./command-queue.js";
import { createMailbox } from "./mailbox.js";
import { createReviewReturnPorts, reviewReturnLeadDeliveryAllowed } from "./review-return-ports.js";
import { createReviewReturnGuard } from "./review-return-guard.js";
import { assignmentDeliveryAllowed } from "./assignment-guard.js";
import { createAssignmentRecovery } from "./assignment-recovery.js";
import { createSubmissionNoticePort, submissionNoticeDeliveryAllowed } from "./submission-notice-ports.js";
import { createLifecycleNoticePort, lifecycleNoticeDeliveryAllowed } from "./lifecycle-notice.js";
import { createDispatcher, projectDispatch } from "./dispatch.js";
import { createMembershipContextProvider } from "./context-provider.js";
import { createRotationService, effectiveRotationConfig, readRotationConfig } from "./rotation.js";
import { registerMemberToolsIfAvailable } from "./member-tools.js";
import { createTaskStore, permittedContacts } from "./task-store.js";
import { gitChangedPaths, gitCommittedPaths, workspaceMode } from "./changed-paths.js";
import { snapshotTree } from "./tree-snapshot.js";
import { baseInfo, commitPaths, commitPathsOf, integrateCommit, pinCommit, refTip } from "./git-artifacts.js";
import { assertSessionDescriptorInTeamWorkspace, assertSessionInTeamWorkspace } from "./binding.js";
import { applySessionTitle } from "./session-title.js";
import { registerLiveTeamsRoutes } from "./routes.js";
// src/plugin.ts
const name = "live-teams-host";
const inject = [
	"sessionController",
	"sessions",
	"agents",
	"systemPrompt",
	"workspaceRegistry"
];
function canonicalize(value) {
	try {
		return realpathSync.native(value);
	} catch {
		return value;
	}
}
function text(value) {
	return typeof value === "string" && value.length > 0 ? value : void 0;
}
/**
* Mount one host instance.  The optional workspacePath is a deliberate pin:
* with a pin the old single-workspace route shape is retained, while without it
* every request is resolved through its Session's cwd.
*/
function apply(ctx, config = {}) {
	if (config.enabled !== true) return;
	const configuredPath = typeof config.workspacePath === "string" && config.workspacePath.length > 0 ? path.resolve(config.workspacePath) : void 0;
	if (config.codingDispatch !== void 0 && config.codingDispatch !== "manual" && config.codingDispatch !== "automatic") ctx.logger?.warn?.(`live-teams: unknown codingDispatch "${String(config.codingDispatch)}"; coding dispatch stays manual`);
	const compatibility = checkCompatibility(ctx);
	if (compatibility.verdict !== "compatible") ctx.logger?.warn?.(`live-teams: ${compatibility.detail}`);
	const codingDispatch = config.codingDispatch === "automatic" ? "automatic" : "manual";
	const rotationInput = config.rotation === true ? { enabled: true } : config.rotation;
	const rotation = readRotationConfig(rotationInput);
	for (const warning of rotation.warnings) ctx.logger?.warn?.(warning);
	const sharedPaths = Array.isArray(config.sharedPaths) ? config.sharedPaths.filter((entry) => typeof entry === "string" && entry.trim().length > 0) : [];
	const globalRolesDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "roles");
	let disposing = false;
	ctx.effect(() => async () => {
		disposing = true;
		const stopping = [...bindingsByWorkspaceId.values()].map((binding) => binding.dispatcher.stop());
		bindingsByWorkspaceId.clear();
		await Promise.all(stopping);
	}, "live-teams-host.dispose");
	let queryService;
	const sessionQuery = () => queryService;
	if (typeof ctx.inject === "function") try {
		ctx.inject(["sessionQuery"], (injected) => {
			queryService = injected.sessionQuery;
		});
	} catch {}
	const liveSession = ctx.sessions?.get === void 0 ? void 0 : (sessionId) => ctx.sessions?.get?.(sessionId);
	const bridge = createSessionBridge({
		controller: ctx.sessionController,
		...ctx.agents === void 0 ? {} : { agents: ctx.agents },
		sessionQuery,
		...liveSession === void 0 ? {} : { liveSession }
	});
	function registryEntries() {
		try {
			return ctx.workspaceRegistry?.list?.() ?? [];
		} catch (error) {
			ctx.logger?.warn?.(`live-teams: workspace registry unavailable: ${String(error)}`);
			return [];
		}
	}
	function entryForPath(value) {
		const canonical = canonicalize(value);
		return registryEntries().find((entry) => typeof entry.path === "string" && canonicalize(entry.path) === canonical);
	}
	function workspaceTitle(entry, workspacePath, fallback) {
		return text(entry?.title) ?? (fallback.length > 0 ? fallback : path.basename(workspacePath));
	}
	const bindingsByWorkspaceId = /* @__PURE__ */ new Map();
	const sessionBindings = /* @__PURE__ */ new Map();
	function bindingFor(input) {
		const existing = bindingsByWorkspaceId.get(input.id);
		if (existing !== void 0) return existing;
		const workspacePath = canonicalize(input.path);
		const store = new TeamStore({
			workspacePath,
			workspaceId: input.id,
			teamId: input.teamId,
			name: input.teamName
		});
		let escalationMailbox;
		let dispatcher;
		/** Resolves once this binding has looked for its own team under another workspace id. */
		let adoption = Promise.resolve();
		const taskStore = createTaskStore({
			workspacePath,
			teamId: input.teamId,
			deliverLifecycleNotice: createLifecycleNoticePort({
				mailbox: () => escalationMailbox,
				teamId: input.teamId
			}),
			deliverSubmissionNotice: createSubmissionNoticePort({
				mailbox: () => escalationMailbox,
				teamId: input.teamId
			}),
			...createReviewReturnPorts({
				mailbox: () => escalationMailbox,
				bridge,
				teamId: input.teamId
			}),
			appendAudit: async (event) => {
				await audit(event);
			},
			changedPaths: gitChangedPaths,
			committedPaths: gitCommittedPaths,
			workspaceMode: async (candidate) => {
				if (config.scopeMode === "git") return "git";
				if (config.scopeMode === "files") return "files";
				return await workspaceMode(candidate);
			},
			snapshotTree,
			git: {
				base: async (candidate) => await baseInfo(candidate),
				tip: async (candidate, ref) => await refTip(candidate, ref),
				commit: async (candidate, base, request) => await commitPaths(candidate, base, request),
				pin: async (candidate, ref, sha) => await pinCommit(candidate, ref, sha),
				integrate: async (candidate, ref, headSha, expectedTip, commitPaths) => await integrateCommit(candidate, ref, headSha, expectedTip, commitPaths),
				changedBetween: async (candidate, fromSha, toSha) => await commitPathsOf(candidate, fromSha, toSha)
			},
			deliverEscalation: async ({ leadMemberId, taskId, submissionId, round, reviewerMemberId, problem, tried }) => {
				if (escalationMailbox === void 0) return;
				await escalationMailbox.sendFromScheduler({
					to: leadMemberId,
					kind: "message",
					content: `Review round ${round.round} escalated by ${reviewerMemberId} for task ${taskId}, submission ${submissionId}. Blocking problem: ${problem}. Already tried: ${tried}`
				});
			},
			deliverClosing: async ({ assignee, taskId, note }) => {
				if (escalationMailbox === void 0) return;
				await escalationMailbox.sendFromScheduler({
					to: assignee,
					kind: "message",
					content: `The work is accepted, await the next task. Task ${taskId} is archived.${note === void 0 || note.trim().length === 0 ? "" : ` Lead note: ${note.trim()}`}`
				});
			},
			deliverCancellation: async ({ assignee, taskId, reason }) => {
				if (escalationMailbox === void 0) return;
				await escalationMailbox.sendFromScheduler({
					to: assignee,
					kind: "message",
					content: `Task ${taskId} was cancelled without accepting its work. Reason: ${reason}. Await the next task.`
				});
			},
			deliverReviewRequest: async ({ reviewer, assignee, taskId, submissionId, summary }) => {
				if (escalationMailbox === void 0) return;
				await escalationMailbox.sendFromScheduler({
					to: reviewer,
					kind: "message",
					content: `task ${taskId} was submitted for review by ${assignee}: ${submissionId}. Summary: ${summary}`
				});
			},
			deliverDirection: async ({ assignee, taskId, instructions }) => {
				if (escalationMailbox === void 0) return;
				await escalationMailbox.sendFromScheduler({
					to: assignee,
					kind: "direction",
					content: `Lead direction for task ${taskId}: ${instructions}`
				});
			},
			interruptSession: async (sessionId, reason) => {
				const agent = ctx.agents?.get?.(sessionId);
				if (agent === void 0 || agent === null) return;
				await bridge.interrupt(sessionId, reason);
			},
			awaitQuiescence: async (sessionId, timeoutMs) => {
				const deadline = Date.now() + timeoutMs;
				for (;;) {
					const agent = ctx.agents?.get?.(sessionId);
					if (agent === void 0 || agent === null) return true;
					if (agent.status !== "running") return true;
					if (Date.now() >= deadline) return false;
					await new Promise((resolve) => setTimeout(resolve, 100));
				}
			}
		});
		let opening;
		const ensureStore = () => {
			if (opening !== void 0) return opening;
			opening = store.open().then(() => store);
			opening.catch(() => {
				opening = void 0;
			});
			return opening;
		};
		/**
		* One audit sink for the whole binding: every durable state change lands in the
		* team journal, and the dispatcher hears all of them. Events are only wake-up
		* signals for it — every pass re-reads durable state — so a missed or a
		* duplicated event can neither lose work nor duplicate it (B29).
		*/
		async function audit(event) {
			await (await ensureStore()).appendEvent(input.teamId, event);
			dispatcher?.notice(event);
		}
		const teamStateFile = path.join(workspacePath, ".dsh-live-teams", "teams", input.teamId, "team.json");
		const disabledMarker = path.join(workspacePath, ".dsh-live-teams", "teams", input.teamId, "disabled");
		const enabledSync = () => {
			if (!existsSync(teamStateFile)) return false;
			try {
				readFileSync(disabledMarker, "utf8");
				return false;
			} catch (error) {
				if (error.code === "ENOENT") return true;
				throw error;
			}
		};
		const teamNameSync = () => {
			try {
				return text(JSON.parse(readFileSync(teamStateFile, "utf8")).name)?.trim() ?? input.teamName;
			} catch {
				return input.teamName;
			}
		};
		const storeFacade = {
			memberBySessionSync: (team, sessionId) => readMemberBySessionSync({
				workspacePath,
				teamId: team,
				sessionId
			}),
			teamStateSync: (team) => readTeamStateSync({
				workspacePath,
				teamId: team
			}),
			activeTaskForMemberSync: (_team, memberId) => taskStore.activeTaskForMemberSync(memberId),
			tasksSync: (_team) => taskStore.listTasksSync(),
			attemptSync: (_team, taskId) => taskStore.latestAttemptForTaskSync(taskId),
			memberBySession: async (team, sessionId) => (await ensureStore()).memberBySession(team, sessionId)
		};
		let roleRegistry;
		const workspaceRolesDirectory = path.join(workspacePath, ".dsh-live-teams", "roles");
		const readRoles = async () => {
			roleRegistry = await readRoleRegistry(globalRolesDirectory, workspaceRolesDirectory);
			return roleRegistry;
		};
		const resolveRoleSync = (value) => {
			try {
				return readRoleRegistrySync(globalRolesDirectory, workspaceRolesDirectory).resolve(value);
			} catch (error) {
				ctx.logger?.warn?.(`live-teams: role registry unavailable: ${String(error)}`);
				return;
			}
		};
		const contextBinding = {
			store: storeFacade,
			teamId: input.teamId,
			teamName: teamNameSync,
			workspacePath,
			activeTaskForMemberSync: storeFacade.activeTaskForMemberSync,
			tasksSync: storeFacade.tasksSync,
			attemptSync: storeFacade.attemptSync,
			enabled: enabledSync,
			roleRegistry: { resolve: resolveRoleSync },
			live: (member) => member.sessionId !== void 0 && ctx.agents?.get?.(member.sessionId) !== void 0
		};
		const titleSession = (sessionId, displayName, reason, previousTitle) => applySessionTitle({
			rename: (id, title) => bridge.rename(id, title),
			...ctx.logger?.warn === void 0 ? {} : { warn: (message) => ctx.logger?.warn?.(message) }
		}, {
			sessionId,
			displayName,
			teamName: teamNameSync(),
			reason,
			...previousTitle === void 0 ? {} : { previousTitle }
		});
		const status = async () => {
			const current = await store.readExisting();
			if (current === void 0) return {
				enabled: false,
				teamId: input.teamId,
				teamName: input.teamName,
				workspacePath,
				memberCount: 0
			};
			if (!!await store.isDisabled(input.teamId)) return {
				enabled: false,
				teamId: input.teamId,
				teamName: current.name ?? input.teamName,
				workspacePath,
				revision: current.revision,
				memberCount: current.members.length
			};
			return {
				enabled: true,
				teamId: input.teamId,
				teamName: current.name ?? input.teamName,
				workspacePath,
				revision: current.revision,
				memberCount: current.members.length
			};
		};
		const listTeamCandidates = async () => store.listAdoptionCandidates({
			workspacePath,
			derivedTeamId: input.teamId
		});
		const enableTeam = async (requestedName, createNew = false) => {
			if (await store.readExisting() === void 0) {
				const candidates = await listTeamCandidates();
				if (candidates.length > 0 && !createNew) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, "existing team found", {
					auditDetail: "existing team found",
					details: { candidates }
				});
			}
			const current = requestedName === void 0 ? await store.open() : await store.open({ name: requestedName });
			await store.setDisabled(input.teamId, false);
			await store.appendEvent(input.teamId, {
				kind: "team/enabled",
				teamId: input.teamId,
				name: current.name ?? requestedName ?? input.teamName,
				at: Date.now(),
				actor: "human:desktop"
			});
			return status();
		};
		const adoptTeam = async (candidateTeamId, replaceEmptyDerived) => {
			const adopted = await store.adoptTeam({
				workspacePath,
				workspaceId: input.id,
				derivedTeamId: input.teamId,
				candidateTeamId,
				replaceEmptyDerived
			});
			return {
				status: await status(),
				adoptedFrom: adopted.adoptedFrom
			};
		};
		const disableTeam = async () => {
			const current = await store.open();
			await store.setDisabled(input.teamId, true);
			await store.appendEvent(input.teamId, {
				kind: "team/disabled",
				teamId: input.teamId,
				at: Date.now(),
				actor: "human:desktop"
			});
			return {
				enabled: false,
				teamId: input.teamId,
				teamName: current.name ?? input.teamName,
				workspacePath,
				memberCount: 0
			};
		};
		const renameTeam = async (requestedName, expectedRevision) => {
			const renamed = await store.renameTeam(input.teamId, expectedRevision, requestedName);
			await store.appendEvent(input.teamId, {
				kind: "team/renamed",
				teamId: input.teamId,
				from: renamed.from,
				to: requestedName,
				at: Date.now(),
				actor: "human:desktop"
			});
			return {
				from: renamed.from,
				status: {
					enabled: true,
					teamId: input.teamId,
					teamName: requestedName,
					workspacePath,
					revision: renamed.state.revision,
					memberCount: renamed.state.members.length
				}
			};
		};
		const returnDeliveryAllowed = createReviewReturnGuard({
			store: taskStore,
			bridge,
			readEvents: async () => (await (await ensureStore()).readEvents(input.teamId, 0)).events,
			knownRequestIds: async (sessionId) => (await queue.list()).filter((record) => record.sessionId === sessionId).map((record) => record.requestId)
		});
		const queue = createCommandQueue({
			workspacePath,
			teamId: input.teamId,
			deliver: async (record) => {
				if (disposing) throw new LiveTeamsError(ERROR_CODES.PLUGIN_DISPOSING, "the plugin is disposing");
				const message = record.causationId === void 0 ? void 0 : await mailbox.getMessage(record.causationId);
				if (record.causationId !== void 0 && message === void 0) throw new LiveTeamsError(ERROR_CODES.DELIVERY_REJECTED, "mailbox causation is unavailable");
				if (message !== void 0 && (!await assignmentDeliveryAllowed(taskStore, message, record.sessionId, record.bindingGeneration) || !await submissionNoticeDeliveryAllowed(taskStore, message, record.sessionId, record.bindingGeneration) || !await lifecycleNoticeDeliveryAllowed(taskStore, message, record.sessionId, record.bindingGeneration) || !await reviewReturnLeadDeliveryAllowed(taskStore, message, record.sessionId, record.bindingGeneration) || !await returnDeliveryAllowed(message, record.sessionId, record.bindingGeneration))) throw new LiveTeamsError(ERROR_CODES.DELIVERY_REJECTED, "scheduler task notification is no longer current");
				return bridge.deliver(record.sessionId, {
					requestId: record.requestId,
					mode: record.mode,
					content: record.content
				});
			},
			bindingGenerationOf: async (sessionId) => (await storeFacade.memberBySession(input.teamId, sessionId))?.bindingGeneration
		});
		const mailbox = createMailbox({
			workspacePath,
			teamId: input.teamId,
			queue,
			canDeliver: async (message, recipient) => await assignmentDeliveryAllowed(taskStore, message, recipient.sessionId, recipient.bindingGeneration) && await submissionNoticeDeliveryAllowed(taskStore, message, recipient.sessionId, recipient.bindingGeneration) && await lifecycleNoticeDeliveryAllowed(taskStore, message, recipient.sessionId, recipient.bindingGeneration) && await reviewReturnLeadDeliveryAllowed(taskStore, message, recipient.sessionId, recipient.bindingGeneration) && await returnDeliveryAllowed(message, recipient.sessionId, recipient.bindingGeneration),
			authorize: async ({ from, to }) => {
				const state = await ensureStore().then((current) => current.open());
				if (state.members.some((member) => member.memberId === from)) {} else if (from === "human" || from === "scheduler") return;
				const sender = state.members.find((member) => member.memberId === from);
				if (sender === void 0) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, "calling session is not bound to an active team member");
				const leadId = resolveLeadMemberId(state);
				if (to === sender.memberId || permittedContacts(state, sender.memberId, await taskStore.listTasks()).includes(to)) return;
				const target = to === "human" || to === "team" ? to : state.members.find((member) => member.memberId === to)?.displayName ?? to;
				if (leadId === void 0) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `Not permitted to address ${target}: this team has no lead. Ask the human to set one in the Team tab.`);
				throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `Not permitted to address ${target}: peer contact is granted by your lead.\nSend this to your lead instead — the lead holds the project context and decides\nwhether a conversation with ${target} is warranted.`);
			},
			listRecipients: async () => {
				return (await ensureStore()).open().then((team) => team.members.map((member) => ({
					memberId: member.memberId,
					displayName: member.displayName,
					...member.sessionId === void 0 ? {} : { sessionId: member.sessionId },
					bindingGeneration: member.bindingGeneration,
					active: true
				})));
			},
			resolveSessionSender: async (sessionId) => (await storeFacade.memberBySession(input.teamId, sessionId))?.memberId,
			appendAudit: async (event) => {
				await audit(event);
			}
		});
		escalationMailbox = mailbox;
		const preferredKindsOf = (memberId) => {
			try {
				const member = readTeamStateSync({
					workspacePath,
					teamId: input.teamId
				})?.members.find((entry) => entry.memberId === memberId);
				if (member === void 0) return [];
				const registry = readRoleRegistrySync(globalRolesDirectory, workspaceRolesDirectory);
				return (Array.isArray(member.roles) && member.roles.length > 0 ? member.roles : [member.role]).flatMap((role) => registry.resolve(role)?.preferredTaskKinds ?? []);
			} catch {
				return [];
			}
		};
		/**
		* Did a human write into this Session after `since`?
		*
		* `source.kind === 'user'` is necessary but not sufficient: the session bridge
		* delivers the plugin's own traffic through the same controller API, so a
		* scheduler assignment also arrives as a user-role message (the B31 host check
		* proved it on its first run). What distinguishes a human is that the plugin did
		* not submit it — every command we send is recorded with its own `requestId`, and
		* the delivered message carries that id as `source.rpcId`. An unloaded Session
		* cannot be observed at all, and `undefined` says so rather than reporting that
		* nobody was there.
		*/
		const humanActivity = async (sessionId, since) => {
			const session = ctx.sessions?.get?.(sessionId);
			if (session?.snapshotEvents === void 0 || typeof session.seq !== "number") return void 0;
			const mine = new Set((await queue.list()).filter((record) => record.sessionId === sessionId).map((record) => record.requestId));
			return session.snapshotEvents(0, session.seq).some((event) => {
				const record = event;
				if (record?.type !== "user/message" || record.data?.source?.kind !== "user") return false;
				if (typeof record.time !== "number" || record.time <= since) return false;
				const rpcId = record.data.source.rpcId;
				return !(typeof rpcId === "string" && mine.has(rpcId));
			});
		};
		const recoverObsoleteAssignments = createAssignmentRecovery({
			teamId: input.teamId,
			store: taskStore,
			bridge,
			listMessages: async () => mailbox.listMessages(),
			listCommands: async () => queue.list(),
			appendAudit: async (event) => {
				await audit(event);
			}
		});
		/**
		* Everything the rotation decision reads about one member, gathered in one place so the decision
		* table itself stays pure and testable.
		*
		* Two things here are easy to get wrong and matter more than the limits: a member who is the
		* *reviewer* of an open task holds that work too (its id is in the route, and a new id would
		* strand the round), and mail that is stored but not yet delivered would be delivered to a
		* member that no longer exists. Both block rotation.
		*/
		const rotationFacts = async (member) => {
			const memberId = member.memberId;
			const universe = await taskStore.listTasks({ includeArchived: true });
			let openTasks = 0;
			let completedTasks = 0;
			for (const task of universe) {
				const assigned = task.assignee === memberId;
				const reviewing = task.route?.type === "review" && task.route.reviewer === memberId;
				if (!assigned && !reviewing) continue;
				if (task.status === "completed") {
					if (assigned) completedTasks += 1;
					continue;
				}
				if (task.status === "cancelled") continue;
				if (task.archivedPath === void 0) openTasks += 1;
			}
			const activeAttempt = (await taskStore.readAttempts()).attempts.some((attempt) => attempt.memberId === memberId && (attempt.status === "active" || attempt.status === "revoking"));
			const undeliveredMessages = (await mailbox.listDeliveries()).filter((delivery) => delivery.recipient === memberId && delivery.state === "stored").length;
			const sessionId = member.sessionId;
			let sessionStatus = "unknown";
			let agentPreset;
			if (sessionId !== void 0) {
				const agent = ctx.agents?.get?.(sessionId);
				sessionStatus = agent === void 0 ? "unknown" : agent.status === "running" ? "running" : agent.status === "idle" ? "idle" : "unknown";
				try {
					agentPreset = (await bridge.inspect(sessionId))?.agentPreset;
				} catch {
					agentPreset = void 0;
				}
			}
			return {
				completedTasks,
				openTasks,
				activeAttempt,
				sessionStatus,
				undeliveredMessages,
				agentPreset
			};
		};
		let bindingRef;
		const rotationService = createRotationService({
			teamId: input.teamId,
			workspaceId: input.id,
			config: rotation.config,
			configOf: (team) => effectiveRotationConfig(rotation.config, team.rotation),
			readTeam: async () => (await ensureStore()).open(),
			commit: async (request) => await (await ensureStore()).commit(input.teamId, request),
			factsOf: rotationFacts,
			measureContextTokens: async (sessionId) => await bridge.contextTokens(sessionId),
			createSession: async (request) => {
				await bridge.create({
					sessionId: request.sessionId,
					workspaceId: request.workspaceId,
					...request.agentPreset === void 0 ? {} : { agentPreset: request.agentPreset }
				});
			},
			newSessionId: () => `session-${randomUUID()}`,
			audit: async (event) => {
				await audit(event);
			},
			onRotated: (outcome) => {
				if (bindingRef === void 0) return;
				sessionBindings.set(outcome.sessionId, bindingRef);
			},
			titleSession: async (sessionId, displayName) => {
				await titleSession(sessionId, displayName, "member-added", void 0);
			},
			logger: (message) => ctx.logger?.warn?.(message)
		});
		let explainedInactive = false;
		dispatcher = createDispatcher({
			workspacePath,
			teamId: input.teamId,
			readTeam: async () => (await ensureStore()).open(),
			taskStore,
			mailbox,
			appendAudit: async (event) => {
				await audit(event);
			},
			codingDispatch,
			humanActivity,
			recoverReviewReturns: async () => taskStore.recoverReviewReturns(),
			recoverSubmissionNotifications: async () => taskStore.recoverSubmissionNotifications(),
			recoverLifecycleNotifications: async () => taskStore.recoverLifecycleNotifications(),
			recoverObsoleteAssignments,
			rotation: async () => {
				await rotationService.check();
			},
			...sharedPaths.length === 0 ? {} : { sharedPaths },
			gitTip: async (ref) => await refTip(workspacePath, ref),
			enabled: enabledSync,
			inactiveReason: () => {
				const hint = `team "${input.teamId}" has no active state at ${teamStateFile}`;
				if (!explainedInactive) {
					explainedInactive = true;
					ctx.logger?.warn?.(`live-teams: dispatch is idle — ${hint}`);
				}
				return `the team is not active: ${hint}`;
			},
			preferredKindsOf,
			logger: (message) => ctx.logger?.warn?.(message),
			...config.dispatchSweepMs === void 0 ? {} : { sweepIntervalMs: config.dispatchSweepMs }
		});
		adoption = store.adoptByPath({
			workspacePath,
			workspaceId: input.id,
			teamId: input.teamId,
			actor: "plugin"
		}).then((adopted) => {
			if (adopted !== void 0) ctx.logger?.warn?.(`live-teams: adopted team ${adopted.adoptedFrom} for ${workspacePath} (${adopted.memberCount} member(s)) under workspace ${input.id}`);
			return adopted;
		}).catch((error) => {
			ctx.logger?.warn?.(`live-teams: could not adopt a team for ${workspacePath}: ${error instanceof Error ? error.message : String(error)}`);
		});
		adoption.then(async () => {
			const migrated = await taskStore.migrate().catch((error) => {
				ctx.logger?.warn?.(`live-teams: state migration refused: ${error instanceof Error ? error.message : String(error)}`);
			});
			if (migrated !== void 0 && migrated.files.length > 0) ctx.logger?.warn?.(`live-teams: migrated ${migrated.files.map((file) => `${file.file} ${file.from}→${file.to}`).join(", ")}`);
			dispatcher?.start();
		});
		/** The projection the panel, the lead's tool and the journal all read from. */
		const readDispatchProjection = async () => {
			const state = await (await ensureStore()).open();
			const universe = await taskStore.listTasks({ includeArchived: true });
			const tasks = universe.filter((task) => task.archivedPath === void 0);
			const attempts = (await taskStore.readAttempts()).attempts;
			const projection = projectDispatch({
				tasks,
				universe,
				attempts,
				team: state,
				memberOf: (memberId) => state.members.find((member) => member.memberId === memberId),
				preferredKindsOf,
				dispatch: {
					...readDispatchSwitch(state),
					coding: codingDispatch
				}
			});
			return {
				teamId: input.teamId,
				paused: projection.paused,
				coding: projection.coding,
				...projection.pausedBy === void 0 ? {} : { pausedBy: projection.pausedBy },
				...projection.pausedReason === void 0 ? {} : { pausedReason: projection.pausedReason },
				counts: projection.counts,
				tasks: projection.evaluations
			};
		};
		/** One switch, two callers: the desktop route admits the human, the tool admits the lead. */
		const setDispatchMode = async (mode, actor, reason) => {
			const store_ = await ensureStore();
			const current = await store_.open();
			if (actor !== "human:desktop" && actor !== "local:unverified") {
				const leadId = current.leadMemberId ?? (current.members.filter((member) => member.role === "lead").length === 1 ? current.members.find((member) => member.role === "lead")?.memberId : void 0);
				if (leadId === void 0 || actor !== leadId) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, "only the human or the lead may change dispatch");
			}
			const result = await store_.setDispatchMode(input.teamId, mode, {
				actor,
				...reason === void 0 ? {} : { reason }
			}, current.revision);
			await audit({
				kind: mode === "paused" ? "dispatch/paused" : "dispatch/resumed",
				teamId: input.teamId,
				from: result.from,
				to: result.to,
				...reason === void 0 ? {} : { reason },
				actor,
				at: Date.now()
			});
			return {
				from: result.from,
				to: result.to
			};
		};
		/**
		* Rotation limits in force, with where they came from.
		*
		* The profile row is the deployment default; the Team tab writes overrides into `team.json`, so
		* the human can change a limit without an operator editing YAML — and one team can differ from
		* the next in the same profile.
		*/
		const readRotationSettings = async () => {
			const state = await (await ensureStore()).readExisting();
			const overrides = state === void 0 ? {} : readTeamRotation(state);
			return {
				...effectiveRotationConfig(rotation.config, overrides),
				source: Object.keys(overrides).length === 0 ? "profile" : "team",
				revision: state?.revision ?? 0
			};
		};
		const setRotationSettings = async (request) => {
			const result = await (await ensureStore()).commit(input.teamId, {
				expectedRevision: request.expectedRevision,
				mutate: (state) => {
					const next = { ...readTeamRotation(state) };
					if (request.enabled !== void 0) next.enabled = request.enabled;
					if (request.maxContextTokens !== void 0) next.maxContextTokens = request.maxContextTokens;
					if (request.maxCompletedTasks !== void 0) next.maxCompletedTasks = request.maxCompletedTasks;
					state.rotation = next;
					return next;
				}
			});
			await audit({
				kind: "team/rotation",
				teamId: input.teamId,
				actor: request.actor,
				appliedRevision: result.state.revision,
				rotation: result.value,
				at: Date.now()
			});
			return await readRotationSettings();
		};
		const copyRoleOverride = async (id) => {
			const registry = roleRegistry ?? await readRoles();
			const globalPath = registry.globalRolePath(id);
			if (globalPath === void 0 || !registry.globalRoleIds.has(id)) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, "unknown global role");
			const target = path.join(workspaceRolesDirectory, `${id}.md`);
			try {
				await access(target);
				throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, "role already overridden", { auditDetail: "role already overridden" });
			} catch (error) {
				if (error instanceof LiveTeamsError) throw error;
			}
			await mkdir(workspaceRolesDirectory, { recursive: true });
			try {
				await copyFile(globalPath, target, 0);
			} catch (error) {
				throw new Error(error instanceof Error ? error.message : String(error));
			}
			roleRegistry = void 0;
			return {
				id,
				path: target
			};
		};
		const routeOptions = {
			teamId: input.teamId,
			compatibility: () => compatibility,
			setLead: async (memberId, expectedRevision) => {
				const state = await store.setLead(input.teamId, memberId, expectedRevision);
				return {
					state,
					...state.leadMemberId === void 0 ? {} : { leadMemberId: state.leadMemberId }
				};
			},
			setContactGrant: async (from, to, action, actor) => {
				const result = await store.updateContactGrant(input.teamId, from, to, action, actor);
				if (result.changed) await store.appendEvent(input.teamId, {
					kind: action === "add" ? "contact/granted" : "contact/revoked",
					from,
					to,
					actor,
					at: Date.now()
				});
				return { grants: result.grants };
			},
			teamName: input.teamName,
			workspacePath,
			titleSession: async (request) => titleSession(request.sessionId, request.displayName, request.reason, request.previousTitle),
			...ctx.logger === void 0 ? {} : { logger: ctx.logger },
			readRoles,
			teamStatus: status,
			teamEnabled: async () => {
				try {
					return enabledSync();
				} catch {
					return await store.readExisting() !== void 0 && !await store.isDisabled(input.teamId);
				}
			},
			enableTeam,
			disableTeam,
			renameTeam,
			listTeamCandidates,
			adoptTeam,
			canOpenWorkspacePath: async () => typeof ctx.sessionController.canOpenWorkspacePath === "function" && await ctx.sessionController.canOpenWorkspacePath(),
			openWorkspacePath: async (request, signal) => {
				if (typeof ctx.sessionController.openWorkspacePath !== "function") throw new Error("session path opener unavailable");
				return ctx.sessionController.openWorkspacePath(request, signal);
			},
			copyRoleOverride,
			mailbox,
			taskStore,
			workspaceRegistered: () => entryForPath(workspacePath) !== void 0,
			...ctx.agents?.get === void 0 ? {} : { agents: { get: ctx.agents.get.bind(ctx.agents) } },
			listCandidates: async () => {
				const controller = ctx.sessionController;
				if (controller === void 0 || controller === null || typeof controller.list !== "function") return [];
				const controllerAbort = new AbortController();
				const timer = setTimeout(() => controllerAbort.abort(), 8e3);
				let listed;
				try {
					listed = await controller.list({}, controllerAbort.signal);
				} catch (error) {
					throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `the host did not list Sessions within 8s: ${error instanceof Error ? error.message : String(error)}`, { auditDetail: "session listing timed out" });
				} finally {
					clearTimeout(timer);
				}
				const value = listed !== null && typeof listed === "object" && !Array.isArray(listed) ? listed : {};
				if (!Array.isArray(value.items)) return [];
				const descriptors = [];
				for (const raw of value.items) {
					if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue;
					const item = raw;
					const sessionId = item.sessionId;
					const cwd = item.cwd;
					if (typeof sessionId !== "string" || sessionId.length === 0 || typeof cwd !== "string" || cwd.length === 0) continue;
					if (item.origin === "subagent") continue;
					const liveAgent = ctx.agents?.get?.(sessionId);
					const parentSessionId = typeof item.parentSessionId === "string" ? item.parentSessionId : void 0;
					const parentAgent = parentSessionId === void 0 ? void 0 : ctx.agents?.get?.(parentSessionId);
					if (parentSessionId !== void 0 && liveAgent !== void 0 && liveAgent !== null && parentAgent !== void 0 && parentAgent !== null && ctx.agents?.isOwnedBy?.(sessionId, parentAgent) === true) continue;
					const runtime = liveAgent !== void 0 && liveAgent !== null ? liveAgent : void 0;
					const titleValue = (item.projections !== null && typeof item.projections === "object" && !Array.isArray(item.projections) ? item.projections : void 0)?.values?.title;
					descriptors.push({
						sessionId,
						cwd,
						title: typeof titleValue === "string" ? titleValue : void 0,
						live: liveAgent !== void 0 && liveAgent !== null,
						status: runtime?.status === "running" ? "running" : runtime?.status === "idle" ? "idle" : "unknown",
						subagentOwned: false,
						workspaceId: void 0,
						seq: 0,
						agentPreset: void 0,
						blank: item.blank === true
					});
				}
				return descriptors;
			},
			createMember: async (request) => {
				const descriptor = await assertSessionInTeamWorkspace({
					bridge,
					workspacePath
				}, request.sessionId);
				const current = await ensureStore();
				const memberId = request.memberId ?? `m-${randomUUID()}`;
				const result = await current.commit(input.teamId, {
					expectedRevision: request.expectedRevision,
					mutate: (state) => {
						if (state.members.some((entry) => entry.memberId === memberId)) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, "member id is already taken");
						if (state.members.some((entry) => entry.sessionId === request.sessionId)) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, "session is already bound");
						const member = {
							memberId,
							displayName: request.displayName,
							role: request.role,
							availability: "available",
							sessionId: request.sessionId,
							bindingGeneration: 1,
							contractRevision: 0
						};
						state.members.push(member);
						return member;
					}
				});
				sessionBindings.set(request.sessionId, binding);
				const sessionTitle = await titleSession(descriptor.sessionId, result.value.displayName, "member-added", descriptor.title);
				return {
					state: result.state,
					member: result.value,
					...sessionTitle === void 0 ? {} : { sessionTitle }
				};
			},
			createSessionMember: async (request) => {
				const workspace = entryForPath(workspacePath);
				if (workspace === void 0 || typeof workspace.id !== "string" || workspace.id.length === 0) throw new LiveTeamsError(ERROR_CODES.SESSION_WRONG_WORKSPACE, "workspace not registered", { auditDetail: "workspace not registered" });
				const descriptor = await bridge.create({
					sessionId: request.sessionId,
					workspaceId: workspace.id
				});
				assertSessionDescriptorInTeamWorkspace({ workspacePath }, descriptor);
				const current = await ensureStore();
				const memberId = `m-${randomUUID()}`;
				const commitMember = async () => await current.commit(input.teamId, {
					expectedRevision: request.expectedRevision,
					mutate: (state) => {
						if (state.members.some((entry) => entry.sessionId === descriptor.sessionId)) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, "session is already bound");
						const member = {
							memberId,
							displayName: request.displayName,
							role: request.role,
							availability: "available",
							sessionId: descriptor.sessionId,
							bindingGeneration: 1,
							contractRevision: 0
						};
						state.members.push(member);
						return member;
					}
				});
				const result = await commitMember().catch(async (error) => {
					await audit({
						kind: "session/orphaned",
						teamId: input.teamId,
						sessionId: descriptor.sessionId,
						reason: error instanceof Error ? error.message : String(error),
						actor: "plugin",
						at: Date.now()
					});
					throw error;
				});
				sessionBindings.set(descriptor.sessionId, binding);
				const sessionTitle = await titleSession(descriptor.sessionId, result.value.displayName, "member-added", descriptor.title);
				return {
					state: result.state,
					member: result.value,
					...sessionTitle === void 0 ? {} : { sessionTitle }
				};
			},
			removeMember: async (request) => {
				const held = (await taskStore.readAttempts()).attempts.find((attempt) => attempt.status === "active" && attempt.memberId === request.memberId);
				if (held !== void 0) {
					const task = (await taskStore.listTasks({ includeArchived: true })).find((entry) => entry.id === held.taskId);
					throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `${request.memberId} holds an active attempt on ${held.taskId}${task === void 0 ? "" : ` "${task.title}"`}; release the attempt before removing the member`, { auditDetail: "member holds an active attempt" });
				}
				return await (await ensureStore()).removeMember(input.teamId, request.memberId, request.expectedRevision);
			},
			applyMutation: async (request) => {
				const current = await ensureStore();
				const prior = (await current.open()).members.find((entry) => entry.memberId === request.memberId);
				let priorDescriptor;
				if (request.kind === "name" && prior?.sessionId !== void 0) try {
					priorDescriptor = await bridge.inspect(prior.sessionId);
				} catch (error) {
					ctx.logger?.warn?.(`live-teams: could not inspect Session "${prior.sessionId}" before title sync: ${String(error)}`);
				}
				const result = await current.commit(input.teamId, {
					expectedRevision: request.expectedRevision,
					mutate: (state) => {
						const member = state.members.find((entry) => entry.memberId === request.memberId);
						if (member === void 0) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, "member not found");
						const from = request.kind === "role" ? member.role : request.kind === "availability" ? member.availability : member.displayName;
						if (request.kind === "role") member.role = request.value;
						else if (request.kind === "availability") member.availability = request.value;
						else member.displayName = request.value;
						return {
							member,
							from,
							to: request.value
						};
					}
				});
				const sessionTitle = request.kind === "name" && priorDescriptor !== void 0 ? await titleSession(priorDescriptor.sessionId, result.value.member.displayName, "member-renamed", priorDescriptor.title) : void 0;
				return {
					state: result.state,
					member: result.value.member,
					from: result.value.from,
					to: result.value.to,
					...sessionTitle === void 0 ? {} : { sessionTitle }
				};
			},
			appendAudit: async (event) => {
				await audit(event);
			},
			readDispatch: readDispatchProjection,
			setDispatch: async (request) => await setDispatchMode(request.mode, request.actor, request.reason),
			readRotation: readRotationSettings,
			setRotation: setRotationSettings,
			readEvents: async (after) => await (await ensureStore()).readEvents(input.teamId, after),
			interrupt: (sessionId, reason) => bridge.interrupt(sessionId, reason)
		};
		const contextProvider = createMembershipContextProvider({
			store: storeFacade,
			teamId: input.teamId,
			teamName: teamNameSync,
			workspacePath,
			enabled: enabledSync,
			roleRegistry: { resolve: resolveRoleSync },
			formalToolsAvailable: toolRuntime !== void 0,
			live: (member) => member.sessionId !== void 0 && ctx.agents?.get?.(member.sessionId) !== void 0,
			commentsSync: (_teamId, memberId) => mailbox.unreadCommentsForSync(memberId),
			routeOf: (member) => {
				if (member.sessionId === void 0) return void 0;
				const model = (ctx.agents?.get?.(member.sessionId))?.model;
				return typeof model === "string" && model.length > 0 ? model : void 0;
			},
			onError: (error) => ctx.logger?.warn?.(`live-teams: membership context unavailable: ${String(error)}`)
		});
		const binding = {
			path: workspacePath,
			id: input.id,
			teamId: input.teamId,
			teamName: input.teamName,
			store,
			taskStore,
			storeFacade,
			contextBinding,
			contextProvider,
			routeOptions,
			queue,
			mailbox,
			dispatcher,
			adoption,
			readDispatch: readDispatchProjection,
			setDispatch: setDispatchMode,
			ensureStore
		};
		bindingRef = binding;
		bindingsByWorkspaceId.set(input.id, binding);
		return binding;
	}
	const pinnedEntry = configuredPath === void 0 ? void 0 : entryForPath(configuredPath);
	const pinnedWorkspaceId = configuredPath === void 0 ? void 0 : config.workspaceId ?? pinnedEntry?.id;
	const pinnedTeamId = config.teamId ?? config.workspaceId ?? (configuredPath === void 0 ? "" : path.basename(configuredPath));
	const pinnedTeamName = config.teamName === void 0 || config.teamName.length === 0 ? pinnedTeamId : config.teamName;
	const toolRuntime = ctx.get?.("tools");
	const pinnedBinding = configuredPath === void 0 ? void 0 : bindingFor({
		path: configuredPath,
		id: pinnedWorkspaceId ?? pinnedTeamId,
		teamId: pinnedTeamId,
		teamName: pinnedTeamName
	});
	for (const entry of registryEntries()) {
		if (typeof entry.path !== "string" || entry.path.length === 0 || typeof entry.id !== "string" || entry.id.length === 0) continue;
		const entryPath = path.resolve(entry.path);
		const entryTeamName = configuredPath !== void 0 && canonicalize(entryPath) === canonicalize(configuredPath) ? pinnedTeamName : workspaceTitle(entry, entryPath, entry.id);
		const binding = configuredPath !== void 0 && canonicalize(entryPath) === canonicalize(configuredPath) ? pinnedBinding : bindingFor({
			path: entryPath,
			id: entry.id,
			teamId: entry.id,
			teamName: entryTeamName
		});
		if (binding === void 0) continue;
		for (const sessionId of entry.sessionIds ?? []) if (typeof sessionId === "string" && sessionId.length > 0) sessionBindings.set(sessionId, binding);
	}
	const dynamicContextProvider = createMembershipContextProvider({
		...pinnedBinding === void 0 ? {} : {
			store: pinnedBinding.storeFacade,
			teamId: pinnedBinding.teamId,
			teamName: pinnedBinding.teamName,
			enabled: () => enabledSyncForBinding(pinnedBinding)
		},
		...pinnedBinding === void 0 ? { resolveSession: (sessionId) => sessionBindings.get(sessionId)?.contextBinding } : {},
		formalToolsAvailable: toolRuntime !== void 0,
		onError: (error) => ctx.logger?.warn?.(`live-teams: membership context unavailable: ${String(error)}`)
	});
	function enabledSyncForBinding(binding) {
		try {
			return binding.contextBinding.enabled?.() !== false;
		} catch {
			return false;
		}
	}
	const contextProvider = pinnedBinding === void 0 ? dynamicContextProvider : pinnedBinding.contextProvider;
	ctx.systemPrompt.context(contextProvider.definition());
	registerMemberToolsIfAvailable(toolRuntime, async (sessionId) => {
		const binding = await bindingForSession(sessionId);
		if (binding === void 0 || binding.contextBinding.enabled?.() === false) return void 0;
		const member = await binding.storeFacade.memberBySession(binding.teamId, sessionId);
		if (member === void 0 || member.sessionId !== sessionId) return void 0;
		const team = await binding.ensureStore().then((store) => store.open());
		return {
			mailbox: binding.mailbox,
			teamId: binding.teamId,
			teamName: team.name ?? binding.teamName,
			member,
			team,
			workspacePath: binding.path,
			taskStore: binding.taskStore,
			setMemberNote: async (memberId, note) => {
				const current = await binding.ensureStore();
				const state = await current.open();
				const result = await current.setMemberNote(binding.teamId, memberId, note, state.revision);
				return {
					memberId: result.member.memberId,
					note: result.member.note ?? ""
				};
			},
			setDispatch: async (request) => await binding.setDispatch(request.mode, request.actor, request.reason),
			updateContactGrant: async (from, to, action, actor) => {
				const current = await binding.ensureStore();
				const state = await current.open();
				const target = state.members.some((entry) => entry.memberId === to) || to === "human" || to === "team";
				if (!state.members.some((entry) => entry.memberId === from) || !target) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, "memberId and allow must name members of this team, human, or team");
				const result = await current.updateContactGrant(binding.teamId, from, to, action, actor);
				if (result.changed) await current.appendEvent(binding.teamId, {
					kind: action === "add" ? "contact/granted" : "contact/revoked",
					from,
					to,
					actor,
					at: Date.now()
				});
				return { grants: result.grants };
			},
			appendAudit: async (event) => (await binding.ensureStore()).appendEvent(binding.teamId, event),
			live: (candidate) => candidate.sessionId !== void 0 && binding.storeFacade.memberBySessionSync(binding.teamId, candidate.sessionId)?.memberId === candidate.memberId
		};
	}, {
		includeContext: true,
		includeContact: true,
		includeTasks: true,
		includeSubmissions: true,
		includeReview: true,
		includeAcceptance: true,
		includeDispatch: true
	});
	const rootOptions = pinnedBinding?.routeOptions ?? {
		teamId: "workspace-scoped",
		teamName: "workspace-scoped",
		workspacePath: "",
		resolveRequest: async (_request, sessionId) => {
			return (await bindingForSession(sessionId))?.routeOptions;
		}
	};
	/**
	* Resolve the binding that owns a Session, caching the answer.
	*
	* The cache is primed from the workspace registry at mount, which misses a
	* Session created afterwards — and in a pinned deployment nothing else
	* refreshes it. A miss therefore resolves directly from the Session, and the
	* pinned workspace answers for its own directory, so a member added at any
	* time can still act.
	*/
	async function bindingForSession(sessionId) {
		if (sessionId === void 0 || sessionId.length === 0) return void 0;
		const cached = sessionBindings.get(sessionId);
		if (cached !== void 0) return cached;
		const descriptor = await bridge.inspect(sessionId);
		if (descriptor === void 0 || descriptor.sessionId !== sessionId || descriptor.cwd === void 0 || descriptor.cwd.length === 0) return void 0;
		const entry = entryForPath(descriptor.cwd);
		if (entry !== void 0 && entry.id.length > 0) {
			const entryPath = path.resolve(entry.path);
			const binding = bindingFor({
				path: entryPath,
				id: entry.id,
				teamId: entry.id,
				teamName: workspaceTitle(entry, entryPath, entry.id)
			});
			sessionBindings.set(sessionId, binding);
			return binding;
		}
		if (pinnedBinding !== void 0 && canonicalize(descriptor.cwd) === canonicalize(configuredPath)) {
			sessionBindings.set(sessionId, pinnedBinding);
			return pinnedBinding;
		}
	}
	(pinnedBinding === void 0 ? Promise.resolve(void 0) : pinnedBinding.store.readExisting()).catch((error) => {
		ctx.logger?.warn?.(`live-teams: store unavailable: ${String(error)}`);
	});
	const initialReadRoles = pinnedBinding?.routeOptions.readRoles;
	if (initialReadRoles !== void 0) initialReadRoles().catch((error) => {
		ctx.logger?.warn?.(`live-teams: role registry unavailable: ${String(error)}`);
	});
	if (ctx.inject !== void 0) ctx.inject(["webServer"], (webCtx) => {
		webCtx.effect(() => registerLiveTeamsRoutes(webCtx, rootOptions), "live-teams-host: routes");
	});
	else if (ctx.webServer !== void 0) ctx.effect(() => registerLiveTeamsRoutes(ctx, rootOptions), "live-teams-host: routes");
	const defaultBinding = pinnedBinding ?? [...bindingsByWorkspaceId.values()][0];
	const service = Object.freeze({
		teamId: defaultBinding?.teamId ?? "",
		workspacePath: defaultBinding?.path ?? "",
		bridge,
		queue: defaultBinding?.queue ?? createCommandQueue({
			workspacePath: process.cwd(),
			teamId: "workspace-scoped",
			deliver: async () => {
				throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, "workspace-scoped queue requires a resolved workspace");
			}
		}),
		mailbox: defaultBinding?.mailbox ?? createMailbox({
			workspacePath: process.cwd(),
			teamId: "workspace-scoped",
			queue: createCommandQueue({
				workspacePath: process.cwd(),
				teamId: "workspace-scoped",
				deliver: async () => {
					throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, "workspace-scoped mailbox requires a resolved workspace");
				}
			}),
			listRecipients: async () => []
		}),
		contextProvider,
		store: async () => {
			if (defaultBinding === void 0) throw new LiveTeamsError(ERROR_CODES.SESSION_WRONG_WORKSPACE, "no workspace is resolved");
			return defaultBinding.ensureStore();
		},
		taskStore: async () => {
			if (defaultBinding === void 0) throw new LiveTeamsError(ERROR_CODES.SESSION_WRONG_WORKSPACE, "no workspace is resolved");
			return defaultBinding.taskStore;
		},
		readDispatch: async () => {
			if (defaultBinding === void 0) throw new LiveTeamsError(ERROR_CODES.SESSION_WRONG_WORKSPACE, "no workspace is resolved");
			return await defaultBinding.readDispatch();
		},
		reconcile: async (trigger = "manual") => {
			if (defaultBinding === void 0) throw new LiveTeamsError(ERROR_CODES.SESSION_WRONG_WORKSPACE, "no workspace is resolved");
			return await defaultBinding.dispatcher.reconcile(trigger);
		},
		openMember: async (sessionId) => {
			const binding = sessionBindings.get(sessionId);
			return binding === void 0 ? void 0 : binding.storeFacade.memberBySession(binding.teamId, sessionId);
		},
		bindMember: async (request) => {
			const binding = sessionBindings.get(request.sessionId);
			if (binding === void 0) throw new LiveTeamsError(ERROR_CODES.SESSION_WRONG_WORKSPACE, "no workspace is resolved");
			await assertSessionInTeamWorkspace({
				bridge,
				workspacePath: binding.path
			}, request.sessionId);
			return (await binding.ensureStore()).bindSession(binding.teamId, request.memberId, request.sessionId, request.expectedRevision);
		},
		/** What the plugin found when it asked the host what it offers. */
		compatibility,
		get disposing() {
			return disposing;
		}
	});
	ctx.provide("liveTeams", service);
}
export { apply, apply as default, inject, name };
