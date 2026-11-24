import path from 'node:path'
import type { ToolRuntime } from '@deepseek-ai/dsh-tools'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { access, copyFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { ERROR_CODES, LiveTeamsError } from './errors.js'
import { checkCompatibility } from './compatibility.js'
import { resolveLeadMemberId, TeamStore, readDispatchSwitch, readMemberBySessionSync, readTeamRotation, readTeamStateSync, type ContactTarget, type MemberRecord, type TeamRotationSettings, type TeamState } from './team-store.js'
import { readRoleRegistry, readRoleRegistrySync, type RoleRegistry } from './roles.js'
import { createSessionBridge, type ModelSelection, type SessionBridge, type SessionDescriptor, type SessionQuerySource } from './session-bridge.js'
import { createCommandQueue, type CommandRecord, type SessionCommandQueue } from './command-queue.js'
import { createMailbox, type MailboxRecipient, type MailboxService } from './mailbox.js'
import { createReviewReturnPorts, reviewReturnLeadDeliveryAllowed } from './review-return-ports.js'
import { createReviewReturnGuard } from './review-return-guard.js'
import { assignmentDeliveryAllowed } from './assignment-guard.js'
import { createAssignmentRecovery } from './assignment-recovery.js'
import { createSubmissionNoticePort, submissionNoticeDeliveryAllowed } from './submission-notice-ports.js'
import { createLifecycleNoticePort, lifecycleNoticeDeliveryAllowed } from './lifecycle-notice.js'
import { createDispatcher, projectDispatch, type CodingDispatch, type Dispatcher, type ReconcileResult } from './dispatch.js'
import { createMembershipContextProvider, type MembershipContextBinding, type MembershipContextProvider } from './context-provider.js'
import { createRotationService, effectiveRotationConfig, pendingMailFor, readRotationConfig, type RotationFacts, type RotationOutcome } from './rotation.js'
import { registerMemberToolsIfAvailable } from './member-tools.js'
import { createTaskStore, permittedContacts, type TaskStore } from './task-store.js'
import { gitChangedPaths, gitCommittedPaths, workspaceMode } from './changed-paths.js'
import { snapshotTree } from './tree-snapshot.js'
import { baseInfo, commitPaths, commitPathsOf, integrateCommit, pinCommit, refTip } from './git-artifacts.js'
import { assertSessionDescriptorInTeamWorkspace, assertSessionInTeamWorkspace } from './binding.js'
import { applySessionTitle, isRetiredTitle, retiredSessionTitle, sessionTitleFor } from './session-title.js'
import {
  registerLiveTeamsRoutes,
  type LiveTeamsAuditRecord,
  type LiveTeamsCreateMemberRequest,
  type LiveTeamsCreateMemberResult,
  type LiveTeamsCreateSessionMemberRequest,
  type LiveTeamsCreateSessionMemberResult,
  type LiveTeamsDispatch,
  type LiveTeamsRotation,
  type LiveTeamsRotationRequest,
  type LiveTeamsRemoveMemberRequest,
  type LiveTeamsRemoveMemberResult,
  type LiveTeamsMutation,
  type LiveTeamsMutationResult,
  type LiveTeamsSessionTitleResult,
  type LiveTeamsTeamStatus,
  type LiveTeamsRouteOptions,
  type LiveTeamsWebServer,
} from './routes.js'

export const name = 'live-teams-host'
export const inject = ['sessionController', 'sessions', 'agents', 'systemPrompt', 'workspaceRegistry'] as const

type WorkspaceEntry = {
  readonly path: string
  readonly id: string
  readonly title?: unknown
  readonly sessionIds?: readonly unknown[]
}
type SessionProjection = { readonly values?: { readonly title?: unknown } }
type SessionListItem = {
  readonly sessionId?: unknown
  readonly cwd?: unknown
  readonly origin?: unknown
  readonly parentSessionId?: unknown
  readonly projections?: unknown
  readonly blank?: unknown
}
type AgentRegistry = {
  readonly get?: (sessionId: string) => unknown
  readonly isOwnedBy?: (sessionId: string, owner: unknown) => boolean
}
type NativePathController = {
  readonly canOpenWorkspacePath?: () => boolean | Promise<boolean>
  readonly openWorkspacePath?: (request: { path: string; action: 'reveal' | 'open' }, signal: AbortSignal) => Promise<unknown>
}

type HostContext = {
  effect: (effect: () => (() => void), name?: string) => void
  workspaceRegistry?: { list?: () => WorkspaceEntry[] }
  tools?: Pick<ToolRuntime, 'register'>
  /** Optional service lookup: returns undefined instead of failing without inject. */
  get?: (name: string) => unknown
  sessionController: Parameters<typeof createSessionBridge>[0]['controller'] & NativePathController
  agents?: AgentRegistry
  sessions?: { get?: (sessionId: string) => unknown }
  /** Provided by the host through `ctx.inject`; not visible through a bare `ctx.get` here. */
  sessionQuery?: SessionQuerySource
  systemPrompt: { context: (definition: ReturnType<MembershipContextProvider['definition']>) => unknown }
  provide: (key: string, value: LiveTeamsService) => unknown
  logger?: { warn?: (message: string) => void }
  settingsController?: { canOpenAgentPresetDirectory?: () => boolean | Promise<boolean> }
  webServer?: LiveTeamsWebServer
  inject?: (deps: readonly string[], callback: (ctx: HostContext & { webServer: LiveTeamsWebServer }) => void) => unknown
}
export type PluginConfig = { enabled?: boolean; workspacePath?: string; workspaceId?: string; teamId?: string; teamName?: string; /** How often the dispatcher sweeps as a safety net; a signal wakes it sooner. */ dispatchSweepMs?: number; /**
 * Whether the dispatcher may start *coding* work on its own. `manual` (the default)
 * keeps this product inside design §22, where the isolation it asked for is unavailable on this
 * host (ADR 0008 is rejected): research
 * and documentation tasks are dispatched, code is not. It is a deployment flag, not
 * a team switch, because Gate C is a property of the product rather than of a team.
 */ codingDispatch?: 'manual' | 'automatic'; /** Shared hotspots, on top of the built-in list (B30). */ sharedPaths?: string[];
  /**
   * B32: how the scope record observes the workspace. `auto` uses git in a work tree and a
   * tree fingerprint otherwise, so a folder that is not a repository is a first-class case.
   * The explicit values exist for a repository whose status is unusable, and for verifying
   * the fingerprint path inside a repository.
   */
  scopeMode?: 'auto' | 'git' | 'files'
  /**
   * Replace a member's Session when its measured cost crosses a limit (B43).
   *
   * Off by default and configurable through the profile row, because rotation changes the team's
   * composition — the same class of decision `codingDispatch` keeps manual. The limits are
   * documented in `rotation.ts` next to the numbers they default to.
   */
  rotation?: {
    enabled?: boolean
    maxContextTokens?: number
    maxCompletedTasks?: number
    cooldownMs?: number
    maxRotationsPerPass?: number
  } | boolean
}
export type LiveTeamsService = {
  teamId: string
  workspacePath: string
  bridge: SessionBridge
  queue: SessionCommandQueue
  mailbox: MailboxService
  contextProvider: MembershipContextProvider
  store: () => Promise<TeamStore>
  taskStore: () => Promise<TaskStore>
  /** The dispatch projection: what the reconciler would do, and why (B29). */
  readDispatch: () => Promise<LiveTeamsDispatch>
  /** Run one reconcile pass now instead of waiting for a signal or the sweep. */
  reconcile: (trigger?: string) => Promise<ReconcileResult>
  openMember: (sessionId: string) => Promise<MemberRecord | undefined>
  bindMember: (request: { memberId: string; sessionId: string; expectedRevision: number }) => Promise<MemberRecord>
  readonly disposing: boolean
}
function canonicalize(value: string): string { try { return realpathSync.native(value) } catch { return value } }
function text(value: unknown): string | undefined { return typeof value === 'string' && value.length > 0 ? value : undefined }

/**
 * Mount one host instance.  The optional workspacePath is a deliberate pin:
 * with a pin the old single-workspace route shape is retained, while without it
 * every request is resolved through its Session's cwd.
 */
export function apply(ctx: HostContext, config: PluginConfig = {}): void {
  if (config.enabled !== true) return
  const configuredPath = typeof config.workspacePath === 'string' && config.workspacePath.length > 0 ? path.resolve(config.workspacePath) : undefined
  // Unknown values fail closed: a typo must not silently unlock unattended coding.
  if (config.codingDispatch !== undefined && config.codingDispatch !== 'manual' && config.codingDispatch !== 'automatic') {
    ctx.logger?.warn?.(`live-teams: unknown codingDispatch "${String(config.codingDispatch)}"; coding dispatch stays manual`)
  }
  // Ask the host what it offers before anything else runs. A DSH release can rename or drop a service
  // this plugin calls; without this the symptom is "I updated and everything broke", with no line
  // saying what broke. The answer is about the host, so it is computed once, not per binding.
  const compatibility = checkCompatibility(ctx as unknown as Record<string, unknown>)
  // A compatible host needs no line: the verdict is on the team status for anyone who asks.
  if (compatibility.verdict !== 'compatible') ctx.logger?.warn?.(`live-teams: ${compatibility.detail}`)
  const codingDispatch: CodingDispatch = config.codingDispatch === 'automatic' ? 'automatic' : 'manual'
  // `rotation: true` is the shorthand for "on, with the measured defaults"; anything else is read as
  // a config object and normalized defensively. Warnings are logged once, at mount.
  const rotationInput = config.rotation === true ? { enabled: true } : config.rotation
  const rotation = readRotationConfig(rotationInput)
  for (const warning of rotation.warnings) ctx.logger?.warn?.(warning)
  const sharedPaths = Array.isArray(config.sharedPaths) ? config.sharedPaths.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0) : []
  const globalRolesDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'roles')
  let disposing = false
  ctx.effect(() => async () => {
    disposing = true
    // Timers must not outlive the plugin: a sweep after disposal would read state
    // and deliver into a host that is going away. Unloading awaits this disposer,
    // so a pass in flight finishes before anything else is torn down.
    const stopping = [...bindingsByWorkspaceId.values()].map((binding) => binding.dispatcher.stop())
    bindingsByWorkspaceId.clear()
    await Promise.all(stopping)
  }, 'live-teams-host.dispose')
  // DSH 0.2.2-rc.1 removed sessionController.inspect; sessionQuery.load reads the same header and
  // events. `ctx.get` does not cross the service isolation here (the first lazy build still logged
  // "neither inspect nor sessionQuery.load"), so the official injection seam is used and the live
  // Session service remains the fallback for a freshly created member.
  let queryService: SessionQuerySource | undefined
  const sessionQuery = (): SessionQuerySource | undefined => queryService
  if (typeof ctx.inject === 'function') {
    try {
      ctx.inject(['sessionQuery'], (injected) => {
        queryService = (injected as HostContext).sessionQuery
      })
    } catch { /* older host without the service */ }
  }
  const liveSession = ctx.sessions?.get === undefined ? undefined : (sessionId: string) => ctx.sessions?.get?.(sessionId)
  const bridge = createSessionBridge({
    controller: ctx.sessionController,
    ...(ctx.agents === undefined ? {} : { agents: ctx.agents }),
    sessionQuery,
    ...(liveSession === undefined ? {} : { liveSession }),
  })

  function registryEntries(): WorkspaceEntry[] {
    try { return ctx.workspaceRegistry?.list?.() ?? [] } catch (error) {
      ctx.logger?.warn?.(`live-teams: workspace registry unavailable: ${String(error)}`)
      return []
    }
  }
  function entryForPath(value: string): WorkspaceEntry | undefined {
    const canonical = canonicalize(value)
    return registryEntries().find((entry) => typeof entry.path === 'string' && canonicalize(entry.path) === canonical)
  }
  function workspaceTitle(entry: WorkspaceEntry | undefined, workspacePath: string, fallback: string): string {
    const title = text(entry?.title)
    return title ?? (fallback.length > 0 ? fallback : path.basename(workspacePath))
  }

  type BindingInput = { path: string; id: string; teamId: string; teamName: string }
  type Binding = {
    readonly path: string
    readonly id: string
    readonly teamId: string
    readonly teamName: string
    readonly store: TeamStore
    readonly taskStore: TaskStore
    /** Adoption of this workspace's own team from another id, if it was needed (F16). */
    readonly adoption: Promise<unknown>
    readonly dispatcher: Dispatcher
    readonly readDispatch: () => Promise<LiveTeamsDispatch>
    readonly setDispatch: (mode: 'auto' | 'paused', actor: string, reason?: string) => Promise<{ from: string; to: string }>
    readonly storeFacade: {
      memberBySessionSync: (team: string, sessionId: string) => MemberRecord | undefined
      teamStateSync: (team: string) => TeamState | undefined
      activeTaskForMemberSync: (team: string, memberId: string) => ReturnType<TaskStore['activeTaskForMemberSync']>
      tasksSync: (team: string) => ReturnType<TaskStore['listTasksSync']>
      attemptSync: (team: string, taskId: string) => ReturnType<TaskStore['latestAttemptForTaskSync']>
      memberBySession: (team: string, sessionId: string) => Promise<MemberRecord | undefined>
    }
    readonly contextBinding: MembershipContextBinding
    readonly contextProvider: MembershipContextProvider
    readonly routeOptions: LiveTeamsRouteOptions
    readonly queue: SessionCommandQueue
    readonly mailbox: MailboxService
    readonly ensureStore: () => Promise<TeamStore>
  }
  const bindingsByWorkspaceId = new Map<string, Binding>()
  const sessionBindings = new Map<string, Binding>()

  function bindingFor(input: BindingInput): Binding {
    const existing = bindingsByWorkspaceId.get(input.id)
    if (existing !== undefined) return existing
    // Canonical: a pinned directory spelled through a symlink (`/tmp` against
    // `/private/tmp`) would otherwise persist an identity the dynamic resolver
    // can never match, and the team would read as missing.
    const workspacePath = canonicalize(input.path)
    const store = new TeamStore({ workspacePath, workspaceId: input.id, teamId: input.teamId, name: input.teamName })
    let escalationMailbox: MailboxService | undefined
    let dispatcher: Dispatcher | undefined
    /** Resolves once this binding has looked for its own team under another workspace id. */
    let adoption: Promise<unknown> = Promise.resolve()
    const taskStore = createTaskStore({ workspacePath, teamId: input.teamId, deliverLifecycleNotice: createLifecycleNoticePort({ mailbox: () => escalationMailbox, teamId: input.teamId }), deliverSubmissionNotice: createSubmissionNoticePort({ mailbox: () => escalationMailbox, teamId: input.teamId }), ...createReviewReturnPorts({ mailbox: () => escalationMailbox, bridge, teamId: input.teamId }), appendAudit: async (event) => { await audit(event as Record<string, unknown>) }, changedPaths: gitChangedPaths, committedPaths: gitCommittedPaths,
    workspaceMode: async (candidate: string) => {
      if (config.scopeMode === 'git') return 'git' as const
      if (config.scopeMode === 'files') return 'files' as const
      return await workspaceMode(candidate)
    },
    snapshotTree,
    // Phase 6: Git plumbing for Git-bound submissions. Wired always; the store only uses it in
    // Git mode, so a folder without a repository never runs git at all.
    git: {
      base: async (candidate: string) => await baseInfo(candidate),
      tip: async (candidate: string, ref: string) => await refTip(candidate, ref),
      commit: async (candidate: string, base: { ref: string; sha: string } | undefined, request: { paths: readonly string[]; message: string; author: { name: string; email: string } }) =>
        await commitPaths(candidate, base, request),
      pin: async (candidate: string, ref: string, sha: string) => await pinCommit(candidate, ref, sha),
      integrate: async (candidate: string, ref: string, headSha: string, expectedTip: string | undefined, commitPaths?: readonly string[]) => await integrateCommit(candidate, ref, headSha, expectedTip, commitPaths),
      changedBetween: async (candidate: string, fromSha: string, toSha: string) => await commitPathsOf(candidate, fromSha, toSha),
    }, deliverEscalation: async ({ leadMemberId, taskId, submissionId, round, reviewerMemberId, problem, tried }) => {
      if (escalationMailbox === undefined) return
      await escalationMailbox.sendFromScheduler({ to: leadMemberId, kind: 'message', content: `Review round ${round.round} escalated by ${reviewerMemberId} for task ${taskId}, submission ${submissionId}. Blocking problem: ${problem}. Already tried: ${tried}` })
    }, deliverClosing: async ({ assignee, taskId, note }) => {
      if (escalationMailbox === undefined) return
      await escalationMailbox.sendFromScheduler({ to: assignee, kind: 'message', content: `The work is accepted, await the next task. Task ${taskId} is archived.${note === undefined || note.trim().length === 0 ? '' : ` Lead note: ${note.trim()}`}` })
    }, deliverCancellation: async ({ assignee, taskId, reason }) => {
      if (escalationMailbox === undefined) return
      await escalationMailbox.sendFromScheduler({ to: assignee, kind: 'message', content: `Task ${taskId} was cancelled without accepting its work. Reason: ${reason}. Await the next task.` })
    }, deliverReviewRequest: async ({ reviewer, assignee, taskId, submissionId, summary }) => {
      if (escalationMailbox === undefined) return
      // The scheduler's message is queued, so the dispatcher wakes the reviewer's Session — the same
      // path that starts a member on an assignment. Without it the reviewer simply sleeps.
      await escalationMailbox.sendFromScheduler({ to: reviewer, kind: 'message', content: `task ${taskId} was submitted for review by ${assignee}: ${submissionId}. Summary: ${summary}` })
    }, deliverDirection: async ({ assignee, taskId, instructions }) => {
      if (escalationMailbox === undefined) return
      await escalationMailbox.sendFromScheduler({ to: assignee, kind: 'direction', content: `Lead direction for task ${taskId}: ${instructions}` })
    },
    // B28: a revocation asks the Session to stop and then waits until the agent is
    // observable as no longer running. Without these two the store refuses to claim
    // a successful revocation, which is the honest outcome.
    interruptSession: async (sessionId, reason) => {
      const agent = ctx.agents?.get?.(sessionId)
      if (agent === undefined || agent === null) return
      await bridge.interrupt(sessionId, reason)
    },
    awaitQuiescence: async (sessionId, timeoutMs) => {
      const deadline = Date.now() + timeoutMs
      for (;;) {
        const agent = ctx.agents?.get?.(sessionId)
        // A Session that is gone is quiescent by definition: nothing can write.
        if (agent === undefined || agent === null) return true
        if ((agent as { status?: unknown }).status !== 'running') return true
        if (Date.now() >= deadline) return false
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    } })
    let opening: Promise<TeamStore> | undefined
    const ensureStore = (): Promise<TeamStore> => {
      if (opening !== undefined) return opening
      opening = store.open().then(() => store)
      opening.catch(() => { opening = undefined })
      return opening
    }
    /**
     * One audit sink for the whole binding: every durable state change lands in the
     * team journal, and the dispatcher hears all of them. Events are only wake-up
     * signals for it — every pass re-reads durable state — so a missed or a
     * duplicated event can neither lose work nor duplicate it (B29).
     */
    async function audit(event: Record<string, unknown> | LiveTeamsAuditRecord): Promise<void> {
      await (await ensureStore()).appendEvent(input.teamId, event)
      dispatcher?.notice(event as { kind?: unknown })
    }
    const teamStateFile = path.join(workspacePath, '.dsh-live-teams', 'teams', input.teamId, 'team.json')
    const disabledMarker = path.join(workspacePath, '.dsh-live-teams', 'teams', input.teamId, 'disabled')
    const enabledSync = (): boolean => {
      if (!existsSync(teamStateFile)) return false
      try { readFileSync(disabledMarker, 'utf8'); return false } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true
        throw error
      }
    }
    const teamNameSync = (): string => {
      try {
        const candidate = JSON.parse(readFileSync(teamStateFile, 'utf8')) as { name?: unknown }
        return text(candidate.name)?.trim() ?? input.teamName
      } catch { return input.teamName }
    }
    const storeFacade = {
      memberBySessionSync: (team: string, sessionId: string): MemberRecord | undefined => readMemberBySessionSync({ workspacePath, teamId: team, sessionId }),
      teamStateSync: (team: string): TeamState | undefined => readTeamStateSync({ workspacePath, teamId: team }),
      activeTaskForMemberSync: (_team: string, memberId: string) => taskStore.activeTaskForMemberSync(memberId),
      tasksSync: (_team: string) => taskStore.listTasksSync(),
      attemptSync: (_team: string, taskId: string) => taskStore.latestAttemptForTaskSync(taskId),
      memberBySession: async (team: string, sessionId: string): Promise<MemberRecord | undefined> => (await ensureStore()).memberBySession(team, sessionId),
    }
    let roleRegistry: RoleRegistry | undefined
    const workspaceRolesDirectory = path.join(workspacePath, '.dsh-live-teams', 'roles')
    const readRoles = async (): Promise<RoleRegistry> => {
      roleRegistry = await readRoleRegistry(globalRolesDirectory, workspaceRolesDirectory)
      return roleRegistry
    }
    const resolveRoleSync = (value: string) => {
      try { return readRoleRegistrySync(globalRolesDirectory, workspaceRolesDirectory).resolve(value) }
      catch (error) { ctx.logger?.warn?.(`live-teams: role registry unavailable: ${String(error)}`); return undefined }
    }
    const contextBinding: MembershipContextBinding = {
      store: storeFacade,
      teamId: input.teamId,
      teamName: teamNameSync,
      workspacePath,
      activeTaskForMemberSync: storeFacade.activeTaskForMemberSync,
      tasksSync: storeFacade.tasksSync,
      attemptSync: storeFacade.attemptSync,
      enabled: enabledSync,
      roleRegistry: { resolve: resolveRoleSync },
      live: (member) => member.sessionId !== undefined && ctx.agents?.get?.(member.sessionId) !== undefined,
    }
    const titleSession = (
      sessionId: string,
      displayName: string,
      reason: 'member-added' | 'member-renamed',
      previousTitle: string | undefined,
    ): Promise<LiveTeamsSessionTitleResult | undefined> => applySessionTitle(
      {
        rename: (id, title) => bridge.rename(id, title),
        ...(ctx.logger?.warn === undefined ? {} : { warn: (message: string) => ctx.logger?.warn?.(message) }),
      },
      { sessionId, displayName, teamName: teamNameSync(), reason, ...(previousTitle === undefined ? {} : { previousTitle }) },
    )
    const status = async (): Promise<LiveTeamsTeamStatus> => {
      const current = await store.readExisting()
      if (current === undefined) return { enabled: false, teamId: input.teamId, teamName: input.teamName, workspacePath, memberCount: 0 }
      const enabled = !(await store.isDisabled(input.teamId))
      // A disabled team still has its members, and reporting zero hides them from
      // the human and from the client, which uses the count to decide whether a
      // derived directory may be replaced.
      if (!enabled) return { enabled: false, teamId: input.teamId, teamName: current.name ?? input.teamName, workspacePath, revision: current.revision, memberCount: current.members.length }
      return { enabled: true, teamId: input.teamId, teamName: current.name ?? input.teamName, workspacePath, revision: current.revision, memberCount: current.members.length }
    }
    const listTeamCandidates = async () => store.listAdoptionCandidates({ workspacePath, derivedTeamId: input.teamId })
    const enableTeam = async (requestedName?: string, createNew = false): Promise<LiveTeamsTeamStatus> => {
      const existing = await store.readExisting()
      if (existing === undefined) {
        const candidates = await listTeamCandidates()
        if (candidates.length > 0 && !createNew) {
          throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'existing team found', { auditDetail: 'existing team found', details: { candidates } })
        }
      }
      const current = requestedName === undefined ? await store.open() : await store.open({ name: requestedName })
      await store.setDisabled(input.teamId, false)
      await store.appendEvent(input.teamId, { kind: 'team/enabled', teamId: input.teamId, name: current.name ?? requestedName ?? input.teamName, at: Date.now(), actor: 'human:desktop' })
      return status()
    }
    const adoptTeam = async (candidateTeamId: string, replaceEmptyDerived: boolean): Promise<{ status: LiveTeamsTeamStatus; adoptedFrom: string }> => {
      const adopted = await store.adoptTeam({ workspacePath, workspaceId: input.id, derivedTeamId: input.teamId, candidateTeamId, replaceEmptyDerived })
      return { status: await status(), adoptedFrom: adopted.adoptedFrom }
    }
    const disableTeam = async (): Promise<LiveTeamsTeamStatus> => {
      const current = await store.open()
      await store.setDisabled(input.teamId, true)
      await store.appendEvent(input.teamId, { kind: 'team/disabled', teamId: input.teamId, at: Date.now(), actor: 'human:desktop' })
      return { enabled: false, teamId: input.teamId, teamName: current.name ?? input.teamName, workspacePath, memberCount: 0 }
    }
    const renameTeam = async (requestedName: string, expectedRevision: number): Promise<{ status: LiveTeamsTeamStatus; from: string }> => {
      const renamed = await store.renameTeam(input.teamId, expectedRevision, requestedName)
      await store.appendEvent(input.teamId, { kind: 'team/renamed', teamId: input.teamId, from: renamed.from, to: requestedName, at: Date.now(), actor: 'human:desktop' })
      return { from: renamed.from, status: { enabled: true, teamId: input.teamId, teamName: requestedName, workspacePath, revision: renamed.state.revision, memberCount: renamed.state.members.length } }
    }
    const returnDeliveryAllowed = createReviewReturnGuard({
      store: taskStore, bridge,
      readEvents: async () => (await (await ensureStore()).readEvents(input.teamId, 0)).events,
      knownRequestIds: async (sessionId) => (await queue.list()).filter(record => record.sessionId === sessionId).map(record => record.requestId),
    })
    const queue = createCommandQueue({
      workspacePath, teamId: input.teamId,
      deliver: async (record: CommandRecord) => {
        if (disposing) throw new LiveTeamsError(ERROR_CODES.PLUGIN_DISPOSING, 'the plugin is disposing')
        const message = record.causationId === undefined ? undefined : await mailbox.getMessage(record.causationId)
        if (record.causationId !== undefined && message === undefined) throw new LiveTeamsError(ERROR_CODES.DELIVERY_REJECTED, 'mailbox causation is unavailable')
        if (message !== undefined && (!await assignmentDeliveryAllowed(taskStore, message, record.sessionId, record.bindingGeneration) || !await submissionNoticeDeliveryAllowed(taskStore, message, record.sessionId, record.bindingGeneration) || !await lifecycleNoticeDeliveryAllowed(taskStore, message, record.sessionId, record.bindingGeneration) || !await reviewReturnLeadDeliveryAllowed(taskStore, message, record.sessionId, record.bindingGeneration) || !await returnDeliveryAllowed(message, record.sessionId, record.bindingGeneration))) throw new LiveTeamsError(ERROR_CODES.DELIVERY_REJECTED, 'scheduler task notification is no longer current')
        return bridge.deliver(record.sessionId, { requestId: record.requestId, mode: record.mode, content: record.content })
      },
      bindingGenerationOf: async (sessionId: string) => (await storeFacade.memberBySession(input.teamId, sessionId))?.bindingGeneration,
    })
    const mailbox = createMailbox({
      workspacePath, teamId: input.teamId, queue,
      canDeliver: async (message, recipient) => await assignmentDeliveryAllowed(taskStore, message, recipient.sessionId, recipient.bindingGeneration) && await submissionNoticeDeliveryAllowed(taskStore, message, recipient.sessionId, recipient.bindingGeneration) && await lifecycleNoticeDeliveryAllowed(taskStore, message, recipient.sessionId, recipient.bindingGeneration) && await reviewReturnLeadDeliveryAllowed(taskStore, message, recipient.sessionId, recipient.bindingGeneration) && await returnDeliveryAllowed(message, recipient.sessionId, recipient.bindingGeneration),
      authorize: async ({ from, to }) => {
        const state = await ensureStore().then((current) => current.open())
        // Membership is decided before the name is: a member whose id happens to be `human` is a
        // member, not the human. Trusting the string first was a way to send mail as the human and to
        // reach any recipient without a route or a grant.
        if (state.members.some((member) => member.memberId === from)) {
          // fall through to the member rules below
        } else if (from === 'human' || from === 'scheduler') return
        const sender = state.members.find((member) => member.memberId === from)
        if (sender === undefined) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'calling session is not bound to an active team member')
        const leadId = resolveLeadMemberId(state)
        // The same function the panel and the context use. Three copies of this rule drifted once
        // already: the panel told the lead that contact was not allowed while the mailbox delivered.
        if (to === sender.memberId || permittedContacts(state, sender.memberId, await taskStore.listTasks()).includes(to)) return
        const target = to === 'human' || to === 'team' ? to : state.members.find((member) => member.memberId === to)?.displayName ?? to
        if (leadId === undefined) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `Not permitted to address ${target}: this team has no lead. Ask the human to set one in the Team tab.`)
        throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `Not permitted to address ${target}: peer contact is granted by your lead.\nSend this to your lead instead — the lead holds the project context and decides\nwhether a conversation with ${target} is warranted.`)
      },
      listRecipients: async (): Promise<readonly MailboxRecipient[]> => {
        const state = await ensureStore()
        return state.open().then((team) => team.members.map((member) => ({ memberId: member.memberId, displayName: member.displayName, ...(member.sessionId === undefined ? {} : { sessionId: member.sessionId }), bindingGeneration: member.bindingGeneration, active: true })))
      },
      resolveSessionSender: async (sessionId: string): Promise<string | undefined> => (await storeFacade.memberBySession(input.teamId, sessionId))?.memberId,
      appendAudit: async (event) => { await audit(event) },
    })
    escalationMailbox = mailbox
    // B29: the reconciler that starts what the lead assigned and drains deliveries
    // that never reached a member. It is started here and stopped with the plugin.
    const preferredKindsOf = (memberId: string): readonly string[] => {
      try {
        const state = readTeamStateSync({ workspacePath, teamId: input.teamId })
        const member = state?.members.find((entry) => entry.memberId === memberId)
        if (member === undefined) return []
        const registry = readRoleRegistrySync(globalRolesDirectory, workspaceRolesDirectory)
        const roles = Array.isArray(member.roles) && member.roles.length > 0 ? member.roles : [member.role]
        return roles.flatMap((role) => registry.resolve(role)?.preferredTaskKinds ?? [])
      } catch { return [] }
    }
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
    const humanActivity = async (sessionId: string, since: number): Promise<boolean | undefined> => {
      const sessions = (ctx as unknown as { sessions?: { get?: (id: string) => unknown } }).sessions
      const session = sessions?.get?.(sessionId) as { seq?: number; snapshotEvents?: (offset: number, seq: number) => readonly unknown[] } | undefined
      if (session?.snapshotEvents === undefined || typeof session.seq !== 'number') return undefined
      const mine = new Set((await queue.list()).filter((record) => record.sessionId === sessionId).map((record) => record.requestId))
      const events = session.snapshotEvents(0, session.seq)
      return events.some((event) => {
        const record = event as { type?: unknown; time?: unknown; data?: { source?: { kind?: unknown; rpcId?: unknown } } } | null
        if (record?.type !== 'user/message' || record.data?.source?.kind !== 'user') return false
        if (typeof record.time !== 'number' || record.time <= since) return false
        const rpcId = record.data.source.rpcId
        return !(typeof rpcId === 'string' && mine.has(rpcId))
      })
    }

    const recoverObsoleteAssignments = createAssignmentRecovery({
      teamId: input.teamId, store: taskStore, bridge,
      listMessages: async () => mailbox.listMessages(),
      listCommands: async () => queue.list(),
      appendAudit: async event => { await audit(event) },
    })
    /**
     * Everything the rotation decision reads about one member, gathered in one place so the decision
     * table itself stays pure and testable.
     *
     * Two things here are easy to get wrong and matter more than the limits: a member who is the
     * *reviewer* of an open task holds that work too (its id is in the route, and a new id would
     * strand the round), and mail that is stored but not yet delivered would be delivered to a
     * member that no longer exists. Both block rotation.
     */
    const rotationFacts = async (member: MemberRecord): Promise<RotationFacts> => {
      const memberId = member.memberId
      const universe = await taskStore.listTasks({ includeArchived: true })
      let openTasks = 0
      let completedTasks = 0
      for (const task of universe) {
        const assigned = task.assignee === memberId
        const reviewing = task.route?.type === 'review' && task.route.reviewer === memberId
        if (!assigned && !reviewing) continue
        if (task.status === 'completed') {
          if (assigned) completedTasks += 1
          continue
        }
        if (task.status === 'cancelled') continue
        if (task.archivedPath === undefined) openTasks += 1
      }
      const attempts = (await taskStore.readAttempts()).attempts
      const activeAttempt = attempts.some((attempt) => attempt.memberId === memberId && (attempt.status === 'active' || attempt.status === 'revoking'))
      const deliveries = await mailbox.listDeliveries()
      // Not every stored delivery blocks: a comment never wakes a Session and waits for the member's
      // own next turn, which can be days. Only mail the host is about to push may block a rotation.
      const mail = pendingMailFor(deliveries, memberId)
      const undeliveredMessages = mail.pushPending
      const parkedMessages = mail.parked
      const sessionId = member.sessionId
      let sessionStatus: 'running' | 'idle' | 'unknown' = 'unknown'
      let agentPreset: string | undefined
      let modelSelection: ModelSelection | undefined
      let sessionTitle: string | undefined
      if (sessionId !== undefined) {
        const agent = ctx.agents?.get?.(sessionId) as { status?: unknown } | undefined
        sessionStatus = agent === undefined ? 'unknown' : agent.status === 'running' ? 'running' : agent.status === 'idle' ? 'idle' : 'unknown'
        // One inspection answers two questions: which preset the replacement should use, and which
        // name the retired Session should keep.
        try {
          const descriptor = await bridge.inspect(sessionId)
          agentPreset = descriptor?.agentPreset
          sessionTitle = descriptor?.title
        } catch { agentPreset = undefined; sessionTitle = undefined }
        // The Session's own model choice: `session.create` accepts none, so it has to be read here
        // and re-recorded on the replacement, or the member silently drops to the deployment default.
        modelSelection = await bridge.modelSelection(sessionId)
      }
      return { completedTasks, openTasks, activeAttempt, sessionStatus, undeliveredMessages, parkedMessages, agentPreset, modelSelection, sessionTitle }
    }
    // The binding is created after the service, and the service needs the binding to register the
    // replacement Session in the session→binding map before that Session's first turn.
    let bindingRef: Binding | undefined
    let warnedModelSelection = false
    const rotationService = createRotationService({
      teamId: input.teamId,
      workspaceId: input.id,
      config: rotation.config,
      // The panel's overrides win over the deployment row, and both are re-read every pass so a
      // change made in the Team tab takes effect on the next sweep instead of at the next restart.
      configOf: (team) => effectiveRotationConfig(rotation.config, team.rotation),
      readTeam: async () => (await ensureStore()).open(),
      commit: async (request) => await (await ensureStore()).commit(input.teamId, request),
      factsOf: rotationFacts,
      measureContextTokens: async (sessionId) => await bridge.contextTokens(sessionId),
      createSession: async (request) => {
        await bridge.create({
          sessionId: request.sessionId,
          workspaceId: request.workspaceId,
          ...(request.agentPreset === undefined ? {} : { agentPreset: request.agentPreset }),
        })
      },
      newSessionId: () => `session-${randomUUID()}`,
      /**
       * Record the old Session's model on the replacement through `agent.model.select`, which is the
       * event DSH's own composer writes. `sessionController.selectModel` would do the same *and*
       * save the value as the deployment-wide default, so one member's model would re-model every
       * other Session in the profile — the exact side effect this plugin refuses to have.
       */
      applyModelSelection: async (sessionId, selection) => {
        const agent = ctx.agents?.get?.(sessionId) as { model?: { select?: (value: ModelSelection) => unknown } } | undefined
        if (agent?.model?.select === undefined) {
          if (!warnedModelSelection) {
            warnedModelSelection = true
            ctx.logger?.warn?.('live-teams: rotation cannot carry a Session model on this host (no agent.model.select); rotated members keep the deployment default')
          }
          return false
        }
        agent.model.select(selection)
        return true
      },
      /**
       * The retired Session is stamped on top of the name it already has, so a human rename survives
       * the bookkeeping. The base falls back to the membership title only when the Session has none,
       * and an already stamped title is left alone: a second pass over the same Session renames
       * nothing.
       */
      retireTitle: async (request) => {
        const base = request.previousTitle ?? sessionTitleFor(request.displayName, teamNameSync())
        if (isRetiredTitle(base)) return undefined
        const result = await applySessionTitle(
          {
            rename: (sessionId, title) => bridge.rename(sessionId, title),
            ...(ctx.logger?.warn === undefined ? {} : { warn: (message: string) => ctx.logger?.warn?.(message) }),
          },
          {
            sessionId: request.sessionId,
            displayName: request.displayName,
            teamName: teamNameSync(),
            reason: 'member-rotated',
            title: retiredSessionTitle(base, request.at),
            previousTitle: base,
          },
        )
        return result?.renamed === true ? result.to : undefined
      },
      audit: async (event) => { await audit(event) },
      onRotated: (outcome: RotationOutcome) => {
        if (bindingRef === undefined) return
        sessionBindings.set(outcome.sessionId, bindingRef)
      },
      titleSession: async (sessionId, displayName) => { await titleSession(sessionId, displayName, 'member-added', undefined) },
      logger: (message) => ctx.logger?.warn?.(message),
    })
    let explainedInactive = false
    dispatcher = createDispatcher({
      workspacePath,
      teamId: input.teamId,
      readTeam: async () => (await ensureStore()).open(),
      taskStore,
      mailbox,
      appendAudit: async (event) => { await audit(event as unknown as Record<string, unknown>) },
      codingDispatch,
      humanActivity,
      recoverReviewReturns: async () => taskStore.recoverReviewReturns(),
      recoverSubmissionNotifications: async () => taskStore.recoverSubmissionNotifications(),
      recoverLifecycleNotifications: async () => taskStore.recoverLifecycleNotifications(),
      recoverObsoleteAssignments,
      rotation: async () => { await rotationService.check() },
      ...(sharedPaths.length === 0 ? {} : { sharedPaths }),
    gitTip: async (ref: string) => await refTip(workspacePath, ref),
      // A pass that refuses to run says which team it thinks is inactive: a wrong
      // team id otherwise looks exactly like a dispatcher with nothing to do.
      enabled: enabledSync,
      inactiveReason: () => {
        const hint = `team "${input.teamId}" has no active state at ${teamStateFile}`
        if (!explainedInactive) { explainedInactive = true; ctx.logger?.warn?.(`live-teams: dispatch is idle — ${hint}`) }
        return `the team is not active: ${hint}`
      },
      preferredKindsOf,
      logger: (message) => ctx.logger?.warn?.(message),
      ...(config.dispatchSweepMs === undefined ? {} : { sweepIntervalMs: config.dispatchSweepMs }),
    })
    // The registry can re-create a workspace entry under a new id, which changes the team
    // directory's identity; the team for this path is then adopted instead of being reported
    // as missing (F16). Adoption is asynchronous while the binding function is not, so it
    // runs as a pass of its own and the dispatcher waits for it — a start that raced the
    // adoption would read an empty team and skip a pass for nothing.
    adoption = store.adoptByPath({ workspacePath, workspaceId: input.id, teamId: input.teamId, actor: 'plugin' })
      .then((adopted) => {
        if (adopted !== undefined) {
          ctx.logger?.warn?.(`live-teams: adopted team ${adopted.adoptedFrom} for ${workspacePath} (${adopted.memberCount} member(s)) under workspace ${input.id}`)
        }
        return adopted
      })
      .catch((error: unknown) => {
        ctx.logger?.warn?.(`live-teams: could not adopt a team for ${workspacePath}: ${error instanceof Error ? error.message : String(error)}`)
        return undefined
      })
    void adoption.then(async () => {
      // State written by an older build is brought forward once, before anything reads or writes it.
      // This call was lost once: it was edited in, never committed, and a restart therefore migrated
      // nothing while the panel kept showing a task that could not be accepted.
      const migrated = await taskStore.migrate().catch((error: unknown) => {
        ctx.logger?.warn?.(`live-teams: state migration refused: ${error instanceof Error ? error.message : String(error)}`)
        return undefined
      })
      if (migrated !== undefined && migrated.files.length > 0) ctx.logger?.warn?.(`live-teams: migrated ${migrated.files.map((file) => `${file.file} ${file.from}→${file.to}`).join(', ')}`)
      dispatcher?.start()
    })
    /** The projection the panel, the lead's tool and the journal all read from. */
    const readDispatchProjection = async (): Promise<LiveTeamsDispatch> => {
      const state = await (await ensureStore()).open()
      const universe = await taskStore.listTasks({ includeArchived: true })
      const tasks = universe.filter((task) => task.archivedPath === undefined)
      const attempts = (await taskStore.readAttempts()).attempts
      const projection = projectDispatch({
        tasks, universe, attempts, team: state,
        memberOf: (memberId) => state.members.find((member) => member.memberId === memberId),
        preferredKindsOf,
        dispatch: { ...readDispatchSwitch(state), coding: codingDispatch },
      })
      return {
        teamId: input.teamId,
        paused: projection.paused,
        coding: projection.coding,
        ...(projection.pausedBy === undefined ? {} : { pausedBy: projection.pausedBy }),
        ...(projection.pausedReason === undefined ? {} : { pausedReason: projection.pausedReason }),
        counts: projection.counts,
        tasks: projection.evaluations,
      }
    }
    /** One switch, two callers: the desktop route admits the human, the tool admits the lead. */
    const setDispatchMode = async (mode: 'auto' | 'paused', actor: string, reason?: string): Promise<{ from: string; to: string }> => {
      const store_ = await ensureStore()
      const current = await store_.open()
      // Authority is decided here, once, for both callers: the desktop route admits
      // the human, the tool passes a member id, and a member must be the lead.
      // Both human actors pass: the route admitted the caller, and which of the two it was belongs
      // to the journal (see `actorOf`), not to authority.
      if (actor !== 'human:desktop' && actor !== 'local:unverified') {
        const leadId = current.leadMemberId ?? (current.members.filter((member) => member.role === 'lead').length === 1 ? current.members.find((member) => member.role === 'lead')?.memberId : undefined)
        if (leadId === undefined || actor !== leadId) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'only the human or the lead may change dispatch')
      }
      const result = await store_.setDispatchMode(input.teamId, mode, { actor, ...(reason === undefined ? {} : { reason }) }, current.revision)
      await audit({ kind: mode === 'paused' ? 'dispatch/paused' : 'dispatch/resumed', teamId: input.teamId, from: result.from, to: result.to, ...(reason === undefined ? {} : { reason }), actor, at: Date.now() } as unknown as Record<string, unknown>)
      return { from: result.from, to: result.to }
    }
    /**
     * Rotation limits in force, with where they came from.
     *
     * The profile row is the deployment default; the Team tab writes overrides into `team.json`, so
     * the human can change a limit without an operator editing YAML — and one team can differ from
     * the next in the same profile.
     */
    const readRotationSettings = async (): Promise<LiveTeamsRotation> => {
      const state = await (await ensureStore()).readExisting()
      const overrides = state === undefined ? {} : readTeamRotation(state)
      return {
        ...effectiveRotationConfig(rotation.config, overrides),
        source: Object.keys(overrides).length === 0 ? 'profile' : 'team',
        revision: state?.revision ?? 0,
      }
    }
    const setRotationSettings = async (request: LiveTeamsRotationRequest & { actor: string }): Promise<LiveTeamsRotation> => {
      const current = await ensureStore()
      const result = await current.commit(input.teamId, {
        expectedRevision: request.expectedRevision,
        mutate: (state) => {
          const next: TeamRotationSettings = { ...readTeamRotation(state) }
          if (request.enabled !== undefined) next.enabled = request.enabled
          if (request.maxContextTokens !== undefined) next.maxContextTokens = request.maxContextTokens
          if (request.maxCompletedTasks !== undefined) next.maxCompletedTasks = request.maxCompletedTasks
          state.rotation = next
          return next
        },
      })
      await audit({ kind: 'team/rotation', teamId: input.teamId, actor: request.actor, appliedRevision: result.state.revision, rotation: result.value, at: Date.now() } as unknown as Record<string, unknown>)
      return await readRotationSettings()
    }
    const copyRoleOverride = async (id: string): Promise<{ id: string; path: string }> => {
      const registry = roleRegistry ?? await readRoles()
      const globalPath = registry.globalRolePath(id)
      if (globalPath === undefined || !registry.globalRoleIds.has(id)) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'unknown global role')
      const target = path.join(workspaceRolesDirectory, `${id}.md`)
      try { await access(target); throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'role already overridden', { auditDetail: 'role already overridden' }) } catch (error) {
        if (error instanceof LiveTeamsError) throw error
      }
      await mkdir(workspaceRolesDirectory, { recursive: true })
      try { await copyFile(globalPath, target, 0) } catch (error) { throw new Error(error instanceof Error ? error.message : String(error)) }
      roleRegistry = undefined
      return { id, path: target }
    }
    const routeOptions: LiveTeamsRouteOptions = {
      teamId: input.teamId,
      compatibility: () => compatibility,
      setLead: async (memberId, expectedRevision) => {
        const state = await store.setLead(input.teamId, memberId, expectedRevision)
        // The store's own state, not the request: clearing has to come back as cleared.
        return { state, ...(state.leadMemberId === undefined ? {} : { leadMemberId: state.leadMemberId }) }
      },
      setContactGrant: async (from, to, action, actor) => {
        const result = await store.updateContactGrant(input.teamId, from, to as ContactTarget, action, actor)
        if (result.changed) await store.appendEvent(input.teamId, { kind: action === 'add' ? 'contact/granted' : 'contact/revoked', from, to, actor, at: Date.now() })
        return { grants: result.grants }
      },
      teamName: input.teamName,
      workspacePath,
      titleSession: async (request) => titleSession(request.sessionId, request.displayName, request.reason, request.previousTitle),
      ...(ctx.logger === undefined ? {} : { logger: ctx.logger }),
      readRoles,
      teamStatus: status,
      teamEnabled: async () => {
        try { return enabledSync() } catch { const current = await store.readExisting(); return current !== undefined && !(await store.isDisabled(input.teamId)) }
      },
      enableTeam,
      disableTeam,
      renameTeam,
      listTeamCandidates,
      adoptTeam,
      canOpenWorkspacePath: async (): Promise<boolean> => typeof ctx.sessionController.canOpenWorkspacePath === 'function' && await ctx.sessionController.canOpenWorkspacePath(),
      openWorkspacePath: async (request, signal): Promise<unknown> => {
        if (typeof ctx.sessionController.openWorkspacePath !== 'function') throw new Error('session path opener unavailable')
        return ctx.sessionController.openWorkspacePath(request, signal)
      },
      copyRoleOverride,
      mailbox,
      taskStore,
      workspaceRegistered: (): boolean => entryForPath(workspacePath) !== undefined,
      ...(ctx.agents?.get === undefined ? {} : { agents: { get: ctx.agents.get.bind(ctx.agents) } }),
      listCandidates: async (): Promise<readonly SessionDescriptor[]> => {
        const controller = ctx.sessionController
        if (controller === undefined || controller === null || typeof controller.list !== 'function') return []
        // A host call with no deadline is a hung panel: the listing feeds the add-member dialog, and
        // a profile with dozens of Sessions can take long enough that the human sees a dead button.
        const controllerAbort = new AbortController()
        const timer = setTimeout(() => controllerAbort.abort(), 8000)
        let listed: unknown
        try {
          listed = await controller.list({}, controllerAbort.signal)
        } catch (error) {
          throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `the host did not list Sessions within 8s: ${error instanceof Error ? error.message : String(error)}`, { auditDetail: 'session listing timed out' })
        } finally { clearTimeout(timer) }
        const value = listed !== null && typeof listed === 'object' && !Array.isArray(listed) ? listed as { items?: unknown } : {}
        if (!Array.isArray(value.items)) return []
        const descriptors: SessionDescriptor[] = []
        for (const raw of value.items) {
          if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) continue
          const item = raw as SessionListItem
          const sessionId = item.sessionId
          const cwd = item.cwd
          if (typeof sessionId !== 'string' || sessionId.length === 0 || typeof cwd !== 'string' || cwd.length === 0) continue
          if (item.origin === 'subagent') continue
          const liveAgent = ctx.agents?.get?.(sessionId)
          const parentSessionId = typeof item.parentSessionId === 'string' ? item.parentSessionId : undefined
          const parentAgent = parentSessionId === undefined ? undefined : ctx.agents?.get?.(parentSessionId)
          if (parentSessionId !== undefined && liveAgent !== undefined && liveAgent !== null && parentAgent !== undefined && parentAgent !== null && ctx.agents?.isOwnedBy?.(sessionId, parentAgent) === true) continue
          const runtime = liveAgent !== undefined && liveAgent !== null ? liveAgent as { status?: unknown } : undefined
          const projection = item.projections !== null && typeof item.projections === 'object' && !Array.isArray(item.projections) ? item.projections as SessionProjection : undefined
          const titleValue = projection?.values?.title
          descriptors.push({ sessionId, cwd, title: typeof titleValue === 'string' ? titleValue : undefined, live: liveAgent !== undefined && liveAgent !== null, status: runtime?.status === 'running' ? 'running' : runtime?.status === 'idle' ? 'idle' : 'unknown', subagentOwned: false, workspaceId: undefined, seq: 0, agentPreset: undefined, blank: item.blank === true })
        }
        return descriptors
      },
      createMember: async (request: LiveTeamsCreateMemberRequest): Promise<LiveTeamsCreateMemberResult> => {
        const descriptor = await assertSessionInTeamWorkspace({ bridge, workspacePath }, request.sessionId)
        const current = await ensureStore()
        const memberId = request.memberId ?? `m-${randomUUID()}`
        const result = await current.commit(input.teamId, {
          expectedRevision: request.expectedRevision,
          mutate: (state) => {
            if (state.members.some((entry) => entry.memberId === memberId)) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'member id is already taken')
            if (state.members.some((entry) => entry.sessionId === request.sessionId)) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'session is already bound')
            const member: MemberRecord = { memberId, displayName: request.displayName, role: request.role, availability: 'available', sessionId: request.sessionId, bindingGeneration: 1, contractRevision: 0 }
            state.members.push(member)
            return member
          },
        })
        sessionBindings.set(request.sessionId, binding)
        const sessionTitle = await titleSession(descriptor.sessionId, result.value.displayName, 'member-added', descriptor.title)
        return { state: result.state, member: result.value, ...(sessionTitle === undefined ? {} : { sessionTitle }) }
      },
      createSessionMember: async (request: LiveTeamsCreateSessionMemberRequest): Promise<LiveTeamsCreateSessionMemberResult> => {
        const workspace = entryForPath(workspacePath)
        if (workspace === undefined || typeof workspace.id !== 'string' || workspace.id.length === 0) throw new LiveTeamsError(ERROR_CODES.SESSION_WRONG_WORKSPACE, 'workspace not registered', { auditDetail: 'workspace not registered' })
        const descriptor = await bridge.create({ sessionId: request.sessionId, workspaceId: workspace.id })
        assertSessionDescriptorInTeamWorkspace({ workspacePath }, descriptor)
        const current = await ensureStore()
        const memberId = `m-${randomUUID()}`
        // The Session exists before the membership does, so a refused commit would leave a Session
        // nobody owns. Nothing here can delete it, so it is recorded: an orphan that is visible
        // (external review, finding 15).
        const commitMember = async (): Promise<{ state: Awaited<ReturnType<typeof current.open>>; value: MemberRecord }> => await current.commit<MemberRecord>(input.teamId, {
          expectedRevision: request.expectedRevision,
          mutate: (state) => {
            if (state.members.some((entry) => entry.sessionId === descriptor.sessionId)) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'session is already bound')
            const member: MemberRecord = { memberId, displayName: request.displayName, role: request.role, availability: 'available', sessionId: descriptor.sessionId, bindingGeneration: 1, contractRevision: 0 }
            state.members.push(member)
            return member
          },
        })
        const result = await commitMember().catch(async (error: unknown) => {
          await audit({ kind: 'session/orphaned', teamId: input.teamId, sessionId: descriptor.sessionId, reason: error instanceof Error ? error.message : String(error), actor: 'plugin', at: Date.now() } as unknown as Record<string, unknown>)
          throw error
        })
        sessionBindings.set(descriptor.sessionId, binding)
        const sessionTitle = await titleSession(descriptor.sessionId, result.value.displayName, 'member-added', descriptor.title)
        return { state: result.state, member: result.value, ...(sessionTitle === undefined ? {} : { sessionTitle }) }
      },
      removeMember: async (request: LiveTeamsRemoveMemberRequest): Promise<LiveTeamsRemoveMemberResult> => {
        // A member who holds an active attempt is not removed silently: the work would keep an owner
        // nobody can reach it through, and the task would sit until someone noticed (external review,
        // finding 12). The human releases the attempt first — the panel has that action.
        const attempts = await taskStore.readAttempts()
        const held = attempts.attempts.find((attempt) => attempt.status === 'active' && attempt.memberId === request.memberId)
        if (held !== undefined) {
          const task = (await taskStore.listTasks({ includeArchived: true })).find((entry) => entry.id === held.taskId)
          throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `${request.memberId} holds an active attempt on ${held.taskId}${task === undefined ? '' : ` "${task.title}"`}; release the attempt before removing the member`, { auditDetail: 'member holds an active attempt' })
        }
        return await (await ensureStore()).removeMember(input.teamId, request.memberId, request.expectedRevision)
      },
      applyMutation: async (request: LiveTeamsMutation): Promise<LiveTeamsMutationResult> => {
        const current = await ensureStore()
        const before = await current.open()
        const prior = before.members.find((entry) => entry.memberId === request.memberId)
        let priorDescriptor: SessionDescriptor | undefined
        if (request.kind === 'name' && prior?.sessionId !== undefined) {
          try { priorDescriptor = await bridge.inspect(prior.sessionId) }
          catch (error) { ctx.logger?.warn?.(`live-teams: could not inspect Session "${prior.sessionId}" before title sync: ${String(error)}`) }
        }
        const result = await current.commit(input.teamId, {
          expectedRevision: request.expectedRevision,
          mutate: (state) => {
            const member = state.members.find((entry) => entry.memberId === request.memberId)
            if (member === undefined) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'member not found')
            const from = request.kind === 'role' ? member.role : request.kind === 'availability' ? member.availability : member.displayName
            if (request.kind === 'role') member.role = request.value
            else if (request.kind === 'availability') member.availability = request.value
            else member.displayName = request.value
            return { member, from, to: request.value }
          },
        })
        const sessionTitle = request.kind === 'name' && priorDescriptor !== undefined ? await titleSession(priorDescriptor.sessionId, result.value.member.displayName, 'member-renamed', priorDescriptor.title) : undefined
        return { state: result.state, member: result.value.member, from: result.value.from, to: result.value.to, ...(sessionTitle === undefined ? {} : { sessionTitle }) }
      },
      appendAudit: async (event: LiveTeamsAuditRecord): Promise<void> => { await audit(event) },
      readDispatch: readDispatchProjection,
      setDispatch: async (request) => await setDispatchMode(request.mode, request.actor, request.reason),
      readRotation: readRotationSettings,
      setRotation: setRotationSettings,
      readEvents: async (after?: number): Promise<{ events: readonly unknown[]; torn: string | null; nextOffset: number; truncated: boolean }> => await (await ensureStore()).readEvents(input.teamId, after),
      interrupt: (sessionId, reason) => bridge.interrupt(sessionId, reason),
    }
    const contextProvider = createMembershipContextProvider({ store: storeFacade, teamId: input.teamId, teamName: teamNameSync, workspacePath, enabled: enabledSync, roleRegistry: { resolve: resolveRoleSync }, formalToolsAvailable: toolRuntime !== undefined, live: (member) => member.sessionId !== undefined && ctx.agents?.get?.(member.sessionId) !== undefined, commentsSync: (_teamId, memberId) => mailbox.unreadCommentsForSync(memberId),
      // The route decides how the team tools are named: through the oh-my-claude bridge they arrive
      // as mcp__dsh__live_team_*. Read from the agent the same way its status is read.
      routeOf: (member) => {
        if (member.sessionId === undefined) return undefined
        const agent = ctx.agents?.get?.(member.sessionId) as { model?: unknown } | undefined
        const model = agent?.model
        return typeof model === 'string' && model.length > 0 ? model : undefined
      }, onError: (error) => ctx.logger?.warn?.(`live-teams: membership context unavailable: ${String(error)}`) })
    const binding: Binding = { path: workspacePath, id: input.id, teamId: input.teamId, teamName: input.teamName, store, taskStore, storeFacade, contextBinding, contextProvider, routeOptions, queue, mailbox, dispatcher, adoption, readDispatch: readDispatchProjection, setDispatch: setDispatchMode, ensureStore }
    bindingRef = binding
    bindingsByWorkspaceId.set(input.id, binding)
    return binding
  }

  const pinnedEntry = configuredPath === undefined ? undefined : entryForPath(configuredPath)
  const pinnedWorkspaceId = configuredPath === undefined ? undefined : config.workspaceId ?? pinnedEntry?.id
  const pinnedTeamId = config.teamId ?? config.workspaceId ?? (configuredPath === undefined ? '' : path.basename(configuredPath))
  const pinnedTeamName = config.teamName === undefined || config.teamName.length === 0 ? pinnedTeamId : config.teamName
  // The tools service is optional by design: a composition without it must still
  // mount, register nothing, and keep the context line honest.
  const toolRuntime = ctx.get?.('tools') as Pick<ToolRuntime, 'register'> | undefined

  const pinnedBinding = configuredPath === undefined ? undefined : bindingFor({ path: configuredPath, id: pinnedWorkspaceId ?? pinnedTeamId, teamId: pinnedTeamId, teamName: pinnedTeamName })

  // Session -> workspace is deliberately a synchronous cache for context assembly.
  // It is primed from the registry at mount and refreshed by every async resolver.
  for (const entry of registryEntries()) {
    if (typeof entry.path !== 'string' || entry.path.length === 0 || typeof entry.id !== 'string' || entry.id.length === 0) continue
    const entryPath = path.resolve(entry.path)
    const entryTeamName = configuredPath !== undefined && canonicalize(entryPath) === canonicalize(configuredPath) ? pinnedTeamName : workspaceTitle(entry, entryPath, entry.id)
    const binding = configuredPath !== undefined && canonicalize(entryPath) === canonicalize(configuredPath) ? pinnedBinding : bindingFor({ path: entryPath, id: entry.id, teamId: entry.id, teamName: entryTeamName })
    if (binding === undefined) continue
    for (const sessionId of entry.sessionIds ?? []) if (typeof sessionId === 'string' && sessionId.length > 0) sessionBindings.set(sessionId, binding)
  }

  const dynamicContextProvider = createMembershipContextProvider({
    ...(pinnedBinding === undefined ? {} : { store: pinnedBinding.storeFacade, teamId: pinnedBinding.teamId, teamName: pinnedBinding.teamName, enabled: () => enabledSyncForBinding(pinnedBinding) }),
    ...(pinnedBinding === undefined ? { resolveSession: (sessionId: string): MembershipContextBinding | undefined => sessionBindings.get(sessionId)?.contextBinding } : {}),
    formalToolsAvailable: toolRuntime !== undefined,
    onError: (error) => ctx.logger?.warn?.(`live-teams: membership context unavailable: ${String(error)}`),
  })
  function enabledSyncForBinding(binding: Binding): boolean {
    try { return binding.contextBinding.enabled?.() !== false } catch { return false }
  }
  const contextProvider = pinnedBinding === undefined ? dynamicContextProvider : pinnedBinding.contextProvider
  ctx.systemPrompt.context(contextProvider.definition())
  registerMemberToolsIfAvailable(toolRuntime, async (sessionId) => {
    const binding = await bindingForSession(sessionId)
    if (binding === undefined || binding.contextBinding.enabled?.() === false) return undefined
    const member = await binding.storeFacade.memberBySession(binding.teamId, sessionId)
    if (member === undefined || member.sessionId !== sessionId) return undefined
    const team = await binding.ensureStore().then((store) => store.open())
    return {
      mailbox: binding.mailbox,
      teamId: binding.teamId,
      teamName: team.name ?? binding.teamName,
      member,
      team,
      workspacePath: binding.path,
      taskStore: binding.taskStore,
      setMemberNote: async (memberId, note) => { const current = await binding.ensureStore(); const state = await current.open(); const result = await current.setMemberNote(binding.teamId, memberId, note, state.revision); return { memberId: result.member.memberId, note: result.member.note ?? '' } },
      setDispatch: async (request) => await binding.setDispatch(request.mode, request.actor, request.reason),
      updateContactGrant: async (from, to, action, actor) => {
         const current = await binding.ensureStore()
         const state = await current.open()
         const target = state.members.some((entry) => entry.memberId === to) || to === 'human' || to === 'team'
         if (!state.members.some((entry) => entry.memberId === from) || !target) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'memberId and allow must name members of this team, human, or team')
         const result = await current.updateContactGrant(binding.teamId, from, to as ContactTarget, action, actor)
         if (result.changed) await current.appendEvent(binding.teamId, { kind: action === 'add' ? 'contact/granted' : 'contact/revoked', from, to, actor, at: Date.now() })
         return { grants: result.grants }
       },
       appendAudit: async (event) => (await binding.ensureStore()).appendEvent(binding.teamId, event),
      live: (candidate) => candidate.sessionId !== undefined && binding.storeFacade.memberBySessionSync(binding.teamId, candidate.sessionId)?.memberId === candidate.memberId,
    }
  }, { includeContext: true, includeContact: true, includeTasks: true, includeSubmissions: true, includeReview: true, includeAcceptance: true, includeDispatch: true })

  const rootOptions: LiveTeamsRouteOptions = pinnedBinding?.routeOptions ?? {
    teamId: 'workspace-scoped',
    teamName: 'workspace-scoped',
    workspacePath: '',
    resolveRequest: async (_request, sessionId) => {
      const binding = await bindingForSession(sessionId)
      return binding?.routeOptions
    },
  }
  /**
   * Resolve the binding that owns a Session, caching the answer.
   *
   * The cache is primed from the workspace registry at mount, which misses a
   * Session created afterwards — and in a pinned deployment nothing else
   * refreshes it. A miss therefore resolves directly from the Session, and the
   * pinned workspace answers for its own directory, so a member added at any
   * time can still act.
   */
  async function bindingForSession(sessionId: string | undefined): Promise<Binding | undefined> {
    if (sessionId === undefined || sessionId.length === 0) return undefined
    const cached = sessionBindings.get(sessionId)
    if (cached !== undefined) return cached
    const descriptor = await bridge.inspect(sessionId)
    if (descriptor === undefined || descriptor.sessionId !== sessionId || descriptor.cwd === undefined || descriptor.cwd.length === 0) return undefined
    const entry = entryForPath(descriptor.cwd)
    if (entry !== undefined && entry.id.length > 0) {
      const entryPath = path.resolve(entry.path)
      const binding = bindingFor({ path: entryPath, id: entry.id, teamId: entry.id, teamName: workspaceTitle(entry, entryPath, entry.id) })
      sessionBindings.set(sessionId, binding)
      return binding
    }
    if (pinnedBinding !== undefined && canonicalize(descriptor.cwd) === canonicalize(configuredPath as string)) {
      sessionBindings.set(sessionId, pinnedBinding)
      return pinnedBinding
    }
    return undefined
  }

  // Touch the store without creating it. Creating state at mount wrote a team
  // before the workspace registry could supply its identity, and that state then
  // read as corrupt everywhere else. Teams are created by enabling or adopting.
  void (pinnedBinding === undefined ? Promise.resolve(undefined) : pinnedBinding.store.readExisting()).catch((error: unknown) => { ctx.logger?.warn?.(`live-teams: store unavailable: ${String(error)}`) })
  const initialReadRoles = pinnedBinding?.routeOptions.readRoles
  if (initialReadRoles !== undefined) void initialReadRoles().catch((error: unknown) => { ctx.logger?.warn?.(`live-teams: role registry unavailable: ${String(error)}`) })
  if (ctx.inject !== undefined) ctx.inject(['webServer'], (webCtx) => { webCtx.effect(() => registerLiveTeamsRoutes(webCtx, rootOptions), 'live-teams-host: routes') })
  else if (ctx.webServer !== undefined) ctx.effect(() => registerLiveTeamsRoutes(ctx as HostContext & { webServer: LiveTeamsWebServer }, rootOptions), 'live-teams-host: routes')

  const defaultBinding = pinnedBinding ?? [...bindingsByWorkspaceId.values()][0]
  const service: LiveTeamsService = Object.freeze({
    teamId: defaultBinding?.teamId ?? '',
    workspacePath: defaultBinding?.path ?? '',
    bridge,
    queue: defaultBinding?.queue ?? createCommandQueue({ workspacePath: process.cwd(), teamId: 'workspace-scoped', deliver: async () => { throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'workspace-scoped queue requires a resolved workspace') } }),
    mailbox: defaultBinding?.mailbox ?? createMailbox({ workspacePath: process.cwd(), teamId: 'workspace-scoped', queue: createCommandQueue({ workspacePath: process.cwd(), teamId: 'workspace-scoped', deliver: async () => { throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'workspace-scoped mailbox requires a resolved workspace') } }), listRecipients: async () => [] }),
    contextProvider,
    store: async () => {
      if (defaultBinding === undefined) throw new LiveTeamsError(ERROR_CODES.SESSION_WRONG_WORKSPACE, 'no workspace is resolved')
      return defaultBinding.ensureStore()
    },
    taskStore: async () => {
      if (defaultBinding === undefined) throw new LiveTeamsError(ERROR_CODES.SESSION_WRONG_WORKSPACE, 'no workspace is resolved')
      return defaultBinding.taskStore
    },
    readDispatch: async () => {
      if (defaultBinding === undefined) throw new LiveTeamsError(ERROR_CODES.SESSION_WRONG_WORKSPACE, 'no workspace is resolved')
      return await defaultBinding.readDispatch()
    },
    reconcile: async (trigger = 'manual') => {
      if (defaultBinding === undefined) throw new LiveTeamsError(ERROR_CODES.SESSION_WRONG_WORKSPACE, 'no workspace is resolved')
      return await defaultBinding.dispatcher.reconcile(trigger)
    },
    openMember: async (sessionId) => {
      const binding = sessionBindings.get(sessionId)
      return binding === undefined ? undefined : binding.storeFacade.memberBySession(binding.teamId, sessionId)
    },
    bindMember: async (request) => {
      const binding = sessionBindings.get(request.sessionId)
      if (binding === undefined) throw new LiveTeamsError(ERROR_CODES.SESSION_WRONG_WORKSPACE, 'no workspace is resolved')
      await assertSessionInTeamWorkspace({ bridge, workspacePath: binding.path }, request.sessionId)
      return (await binding.ensureStore()).bindSession(binding.teamId, request.memberId, request.sessionId, request.expectedRevision)
    },
    /** What the plugin found when it asked the host what it offers. */
    compatibility,
    get disposing() { return disposing },
  })
  ctx.provide('liveTeams', service)
}
export default apply
