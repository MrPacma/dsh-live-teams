import { LiveTeamsError } from './errors.js'
import { NO_SESSION_FAILURE, type MailboxService, type MessageDelivery } from './mailbox.js'
import { assignmentRouteText, blockedBy, taskDocumentPath, type TaskAttempt, type TaskStore, type TeamTask } from './task-store.js'
import { readDispatchSwitch, type MemberRecord, type TeamState } from './team-store.js'
import { CODING_KINDS, scopeConflict, SHARED_PATH_DEFAULTS } from './scope.js'

/**
 * The dispatcher is a reconciler, not an event handler: callers pass it wake-up
 * signals, and every pass recomputes its decisions from durable state. A missed
 * signal therefore cannot lose work, and a duplicated one cannot duplicate it.
 *
 * It has exactly two actions — retry a delivery that never reached its member, and
 * start an assigned task whose gate is open — and it never chooses a member, never
 * moves ownership, never edits a contract and never escalates.
 */

export const DISPATCH_REASONS = Object.freeze([
  'dispatch-paused',
  'attempt-revoking',
  'human-gate',
  'task-not-ready',
  'no-assignee',
  'dependency-open',
  'coding-not-isolated',
  'human-intervened',
  /** The task settled while the pass was running: nothing is dispatched for it (F22). */
  'task-settled-during-pass',
  'paths-undeclared',
  'paths-overlap',
  'paths-shared',
  'attempt-active',
  'member-unknown',
  'member-paused',
  'member-busy',
  'no-session',
  'ok',
] as const)
export type DispatchReason = (typeof DISPATCH_REASONS)[number]
export type DispatchVerdict = 'assign' | 'active' | 'wait' | 'refused'
export interface DispatchEvaluation {
  taskId: string
  title: string
  status: TeamTask['status']
  assignee?: string
  decision: DispatchVerdict
  reason: DispatchReason
  detail: string
  /** A `preferredTaskKinds` mismatch is reported, never enforced: the lead named the member. */
  warning?: string
  /**
   * The active attempt has been silent long enough to be worth showing (F3). Detection only: the
   * human decides whether to open the Session, direct the member or revoke the attempt.
   */
  stalled?: { at: number; reason: 'unacknowledged' | 'idle'; detail: string }
}

/** The verdict follows from the reason, so the two can never disagree. */
const VERDICTS: Record<DispatchReason, DispatchVerdict> = {
  'ok': 'assign',
  'attempt-active': 'active',
  'dispatch-paused': 'wait',
  'attempt-revoking': 'wait',
  'human-gate': 'wait',
  'dependency-open': 'wait',
  'coding-not-isolated': 'wait',
  'human-intervened': 'wait',
  'task-settled-during-pass': 'wait',
  'paths-undeclared': 'wait',
  'paths-overlap': 'wait',
  'paths-shared': 'wait',
  'member-paused': 'wait',
  'member-busy': 'wait',
  'no-session': 'wait',
  'task-not-ready': 'refused',
  'no-assignee': 'refused',
  'member-unknown': 'refused',
}

const TERMINAL: readonly TeamTask['status'][] = ['completed', 'failed', 'cancelled']

export type CodingDispatch = 'manual' | 'automatic'

/** The assignment message for one attempt; also its dedupe key across passes. */
export function assignmentThread(taskId: string, attemptId: string): string { return `dispatch:${taskId}:${attemptId}` }

type GateInput = {
  task: TeamTask
  /** Candidate tasks; `universe` is what dependencies are resolved against. */
  tasks: readonly TeamTask[]
  universe?: readonly TeamTask[]
  attempts: readonly TaskAttempt[]
  team: TeamState
  paused: boolean
  /** `manual` (the default) refuses to start coding work on its own. */
  coding: CodingDispatch
  /** Paths every task effectively shares; extends the built-in list. */
  sharedPaths?: readonly string[]
  memberOf: (memberId: string) => MemberRecord | undefined
  preferredKindsOf?: (memberId: string) => readonly string[]
}

/** The latest attempt of a task that carries a mark the contract has not caught up with. */
function unresolvedIntervention(task: TeamTask, attempts: readonly TaskAttempt[]): TaskAttempt | undefined {
  const latest = attempts.filter((attempt) => attempt.taskId === task.id).sort((left, right) => right.generation - left.generation)[0]
  if (latest?.humanIntervenedAt === undefined) return undefined
  return (task.contractRevision ?? 0) <= (latest.humanIntervenedContractRevision ?? 0) ? latest : undefined
}

function activeAttemptOf(task: TeamTask, attempts: readonly TaskAttempt[]): TaskAttempt | undefined {
  return task.activeAttemptId === undefined ? undefined : attempts.find((attempt) => attempt.id === task.activeAttemptId)
}
function memberName(team: TeamState, memberId: string): string {
  return team.members.find((member) => member.memberId === memberId)?.displayName ?? memberId
}

/**
 * The gate. The first blocker wins and its name *is* what the human reads, so the
 * states that need a person are reported as what they are before the generic ones.
 */
export function evaluateTask(input: GateInput): DispatchEvaluation {
  const { task, tasks, attempts, team } = input
  const assignee = task.assignee
  const base = { taskId: task.id, title: task.title, status: task.status, ...(assignee === undefined ? {} : { assignee }) }
  const verdict = (reason: DispatchReason, detail: string, warning?: string): DispatchEvaluation => ({
    ...base, decision: VERDICTS[reason], reason, detail, ...(warning === undefined ? {} : { warning }),
  })
  const attempt = activeAttemptOf(task, attempts)

  if (input.paused) return verdict('dispatch-paused', 'automatic dispatch is paused')
  if (attempt?.status === 'revoking') return verdict('attempt-revoking', `attempt ${attempt.id} is revoking — settle the revocation before anything starts beside it`)
  // A human writing into a member's Session mid-attempt changes the work behind the
  // contract's back (design §10.2). Nothing automatic continues until the contract is
  // formally restated — an update, an acceptance or a revision bumps the task revision
  // above the mark — because judging such an attempt against the old contract is exactly
  // the confusion this rule exists to prevent.
  const own = unresolvedIntervention(task, attempts)
  if (own !== undefined) return verdict('human-intervened', `a human wrote into ${memberName(team, own.memberId)}'s Session directly (attempt ${own.id}); resolve the intervention by accepting/revising an undecided submission, revoking then editing and explicitly resuming parked work, or cancelling the task; the in-flight contract is frozen`)
  // `waiting` means the submission is in and a decision is owed — by the reviewer, or by the lead
  // after an escalation. It does not mean the member is stuck waiting for a reply: on a real stand
  // that wording made a healthy submitted task read as a hung member.
  if (task.status === 'waiting') return verdict('human-gate', 'the submission is waiting for a decision: the reviewer, or the lead after an escalation')
  if (task.status === 'needs_human') return verdict('human-gate', 'the task needs a human decision')
  // A running attempt is more informative than "not ready": it says who holds the work.
  if (attempt?.status === 'active') {
    const active = verdict('attempt-active', `attempt ${attempt.id} is active with ${memberName(team, attempt.memberId)}`)
    return attempt.stalled === undefined ? active : { ...active, stalled: attempt.stalled }
  }
  if (task.status !== 'ready') return verdict('task-not-ready', TERMINAL.includes(task.status) ? `task is ${task.status}` : `task is ${task.status}, not ready`)
  if (assignee === undefined || assignee.length === 0) return verdict('no-assignee', 'the task has no assignee')
  const blockers = blockedBy(task, input.universe ?? tasks)
  if (blockers.length > 0) {
    const first = blockers[0] as { id: string; title: string; status: string }
    return verdict('dependency-open', `blocked by ${first.id} "${first.title}" (${first.status})${blockers.length > 1 ? ` and ${blockers.length - 1} more` : ''}`)
  }
  // The policy sits after the task's own state and its dependencies, so it names the
  // thing a human can act on first, and reports itself exactly when the work would
  // otherwise be startable. It is not a refusal: the member may still claim it, and a
  // human can drive it — what it refuses is the dispatcher starting it unattended.
  if (input.coding === 'manual' && CODING_KINDS.has(task.kind)) {
    // The isolation this gate once waited for is unavailable rather than unproven: the host cannot
    // give a Session both a workspace and a cwd elsewhere (ADR 0008, rejected with the experiment
    // that decided it). So the decision is the deployment's, and the refusal says so plainly.
    return verdict('coding-not-isolated', `${task.kind} work is not started automatically: this deployment has not accepted coding dispatch without per-member isolation, and this host cannot provide it (ADR 0008 — set codingDispatch: automatic to accept the shared tree)`)
  }
  const intervenedDependency = (task.dependsOn ?? [])
    .map((id) => tasks.find((entry) => entry.id === id))
    .find((dependency) => dependency !== undefined && dependency.status === 'completed' && unresolvedIntervention(dependency, attempts) !== undefined)
  if (intervenedDependency !== undefined) return verdict('human-intervened', `dependency ${intervenedDependency.id} "${intervenedDependency.title}" was completed after a human changed its work directly, and the change was never recorded`)
  const member = input.memberOf(assignee)
  if (member === undefined) return verdict('member-unknown', 'the assignee is not a current team member')
  // Fail closed: only an explicit `available` starts work. Any other value — a typo, a hand-edited
  // file, a value from an older design — used to mean "available", so a misspelling quietly granted
  // dispatch. `dispatch.mode` is already validated strictly; this is the same rule where it matters.
  if (member.availability !== 'available') return verdict('member-paused', `${member.displayName} is ${member.availability === 'paused' ? 'paused' : `unavailable (${String(member.availability)})`}`)
  const busy = attempts.find((candidate) => candidate.status === 'active' && candidate.memberId === assignee && candidate.taskId !== task.id)
  if (busy !== undefined) return verdict('member-busy', `${member.displayName} already holds attempt ${busy.id} on ${busy.taskId}`)
  if (member.sessionId === undefined || member.sessionId.length === 0) return verdict('no-session', `${member.displayName} has no Session bound`)
  // Parallel writes in one tree (B30). Two writers may run together only when their
  // declared scopes are known to be disjoint: an unknown scope is treated as touching
  // everything, because a missed overlap costs somebody's edits while a reported one
  // costs throughput.
  if (CODING_KINDS.has(task.kind)) {
    const writers = attempts.filter((candidate) => candidate.status === 'active' && candidate.taskId !== task.id)
      .map((candidate) => ({ attempt: candidate, other: (input.universe ?? tasks).find((entry) => entry.id === candidate.taskId) }))
      .filter((entry) => entry.other !== undefined && CODING_KINDS.has(entry.other.kind))
    if (writers.length > 0) {
      const shared = [...SHARED_PATH_DEFAULTS, ...(input.sharedPaths ?? [])]
      const own = task.paths ?? []
      if (own.length === 0) {
        const active = writers[0] as { attempt: TaskAttempt; other: TeamTask }
        return verdict('paths-undeclared', `another writing task is active (${active.other.id} "${active.other.title}"), and this task declares no paths — declare them so the two can be shown to be disjoint`)
      }
      for (const writer of writers) {
        const otherPaths = writer.other?.paths ?? []
        if (otherPaths.length === 0) {
          return verdict('paths-overlap', `${writer.other?.id} "${writer.other?.title}" is writing and declares no paths, so its scope is unknown`)
        }
        const conflict = scopeConflict(own, otherPaths, shared)
        if (conflict === undefined) continue
        const pair = `${conflict.left} × ${conflict.right}`
        if (conflict.kind === 'shared') {
          return verdict('paths-shared', `${pair} is shared by every task, and ${writer.other?.id} "${writer.other?.title}" is writing — serialise the two with dependsOn, or hand one over deliberately`)
        }
        return verdict('paths-overlap', `${pair} intersects ${writer.other?.id} "${writer.other?.title}", which is writing now`)
      }
    }
  }
  const preferred = input.preferredKindsOf?.(assignee) ?? []
  const warning = preferred.length > 0 && !preferred.includes(task.kind)
    ? `${member.displayName}'s role prefers ${preferred.join(', ')}, and this task is ${task.kind}`
    : undefined
  return verdict('ok', `eligible to start as attempt for ${member.displayName}`, warning)
}

export type DispatchProjection = {
  paused: boolean
  coding: CodingDispatch
  pausedBy?: string
  pausedReason?: string
  evaluations: DispatchEvaluation[]
  counts: Record<DispatchVerdict, number>
}
export type ProjectionInput = Omit<GateInput, 'task' | 'paused' | 'coding'> & { dispatch: { mode: 'auto' | 'paused'; coding?: CodingDispatch; by?: string; reason?: string } }
export function projectDispatch(input: ProjectionInput): DispatchProjection {
  const evaluations = input.tasks
    .map((task) => evaluateTask({ ...input, task, paused: input.dispatch.mode === 'paused', coding: input.dispatch.coding ?? 'manual' }))
    .sort((left, right) => left.taskId.localeCompare(right.taskId))
  const counts: Record<DispatchVerdict, number> = { assign: 0, active: 0, wait: 0, refused: 0 }
  for (const evaluation of evaluations) counts[evaluation.decision] += 1
  const paused = input.dispatch.mode === 'paused'
  return {
    paused,
    coding: input.dispatch.coding ?? 'manual',
    // Who paused it only means something while it *is* paused: the absent switch has
    // a placeholder actor, and reporting it made an automatic team read as paused.
    ...(paused && input.dispatch.by !== undefined ? { pausedBy: input.dispatch.by } : {}),
    ...(paused && input.dispatch.reason !== undefined ? { pausedReason: input.dispatch.reason } : {}),
    evaluations,
    counts,
  }
}

export function assignmentText(task: TeamTask, attempt: TaskAttempt, team: TeamState, workspacePath: string): string {
  const route = assignmentRouteText(task.route, team)
  const contact = task.humanContact === 'required' ? 'required before finishing' : task.humanContact === 'expected' ? 'expected — the lead will arrange it' : 'none expected'
  return [
    `You have been assigned task ${task.id}: ${task.title} (${task.kind}).`,
    `A claim was made for you as attempt ${attempt.id}.`,
    `- Route: ${route}`,
    `- Round limit: ${task.roundLimit}`,
    `- Human contact: ${contact}`,
    `- Document: ${taskDocumentPath(workspacePath, task.teamId, task.id)}`,
    `Read current state with live_team_read_task before any action. This queued notification may be stale: only proceed if task ${task.id} is claimed/in_progress, your active attempt is still ${attempt.id}, and there is no newer submission. Ignore closed, archived, replaced or already-submitted work; never revive it or overwrite newer/human instructions.`,
    `If still current, acknowledge through live_team_ack_task before starting. Do not send a peer acknowledgement or waiting/progress message to the lead.`,
    'Report a blocker with live_team_send to your lead rather than working around it.',
  ].join('\n')
}

export type DispatchAudit = (event: Record<string, unknown> & { kind: string }) => Promise<void>
export type ReconcileResult = {
  trigger: string
  paused: boolean
  evaluated: number
  started: { taskId: string; attemptId: string; memberId: string; messageId?: string; detail: string }[]
  /** Attempts this pass marked as human-intervened. */
  intervened: { taskId: string; attemptId: string; memberId: string }[]
  /**
   * Attempts this pass found silent and recorded as stalled (F3). Detection only: nothing is
   * revoked, nothing is reassigned. The human sees it and decides.
   */
  stalled: { taskId: string; attemptId: string; memberId: string; reason: 'unacknowledged' | 'idle'; detail: string }[]
  woke: { deliveryId: string; messageId: string; state: MessageDelivery['state'] }[]
  blocked: { taskId: string; reason: DispatchReason; detail: string }[]
  skipped: { taskId: string; reason: DispatchReason; detail: string }[]
  failures: string[]
}

export type DispatcherPorts = {
  workspacePath: string
  teamId: string
  /** Reads current team state. */
  readTeam: () => Promise<TeamState>
  taskStore: Pick<TaskStore, 'listTasks' | 'readAttempts' | 'claimTask' | 'markHumanIntervention' | 'closeTerminalAttempts' | 'pruneSnapshots' | 'markAttemptStalled' | 'reconcilePendingIntegrations'>
  mailbox: Pick<MailboxService, 'listMessages' | 'listDeliveries' | 'sendFromScheduler' | 'retryExpiredLeases' | 'retryDelivery' | 'deliver' | 'healOrphanMessages'>
  appendAudit: DispatchAudit
  recoverReviewReturns?: () => Promise<void>
  recoverSubmissionNotifications?: () => Promise<void>
  recoverLifecycleNotifications?: () => Promise<void>
  recoverObsoleteAssignments?: () => Promise<void>
  /**
   * Replace a member's Session when its measured cost crosses a configured limit. Runs inside the
   * pass — not on its own timer — so the single-flight latch and the shutdown path already cover it,
   * and a member replaced here can be dispatched in the same pass.
   */
  rotation?: () => Promise<void>
  /** Whether this deployment starts coding work on its own; `manual` by default. */
  codingDispatch?: CodingDispatch
  /** Extra shared hotspots, on top of the built-in list. */
  sharedPaths?: readonly string[]
  /**
   * Is the member's Session running right now? `undefined` means this composition cannot tell, and
   * only the state-based signal (an assignment never acknowledged) is used.
   */
  sessionStatus?: (sessionId: string) => Promise<'running' | 'idle' | 'unknown'>
  /** How long silence may last before it is shown. Ten minutes by default. */
  stalledAfterMs?: number
  /** The tip of a branch, for reconciling an interrupted integration. */
  gitTip?: (ref: string) => Promise<string | undefined>
  /**
   * Did a human write into this Session after `since`? `undefined` means this
   * composition cannot observe it, which is reported once instead of being read as
   * "no human was here".
   */
  humanActivity?: (sessionId: string, since: number) => Promise<boolean | undefined>
  /** False when the team (or the binding) is not active; nothing is dispatched. */
  enabled?: () => boolean
  /** Why the pass refused to run; a silent refusal reads as "nothing to do". */
  inactiveReason?: () => string
  preferredKindsOf?: (memberId: string) => readonly string[]
  logger?: (message: string) => void
  now?: () => number
  sweepIntervalMs?: number
  maxActionsPerPass?: number
}

export type Dispatcher = {
  reconcile: (trigger: string) => Promise<ReconcileResult>
  /** Wake-up signal from the audit stream; filtered to the events that can change a decision. */
  notice: (event: { kind?: unknown }) => void
  start: () => void
  /** Stop accepting passes and wait for the one in flight, so disposal never races a write. */
  stop: () => Promise<void>
}

const TRIGGER_KINDS = /^(task|attempt|submission|review|member|team|delivery)\//

export function createDispatcher(ports: DispatcherPorts): Dispatcher {
  const logger = ports.logger ?? ((): void => undefined)
  const now = ports.now ?? Date.now
  const maxActions = ports.maxActionsPerPass ?? 8
  // The signals are the mechanism; this is the safety net. 30 s of small state
  // reads costs little and still heals a missed event quickly.
  const sweepIntervalMs = ports.sweepIntervalMs ?? 30000
  let warnedUnobservable = false
  let running: Promise<ReconcileResult> | undefined
  let rerun = false
  let timer: ReturnType<typeof setInterval> | undefined
  let stopped = false
  /** Last reason seen per task, so a journal entry marks a transition, not a pass. */
  const lastReason = new Map<string, DispatchReason>()

  async function wakeHalf(result: ReconcileResult): Promise<void> {
    const expired = await ports.mailbox.retryExpiredLeases()
    for (const delivery of expired) {
      if (delivery.state !== 'delivered') continue
      result.woke.push({ deliveryId: delivery.id, messageId: delivery.messageId, state: delivery.state })
      await ports.appendAudit({ kind: 'dispatch/woke', teamId: ports.teamId, deliveryId: delivery.id, messageId: delivery.messageId, state: delivery.state, at: now() })
    }
    const state = await ports.readTeam()
    // A delivery that never left `stored` is a message nobody was told about: the mailbox writes the
    // row before it wakes the Session, so a process that stops in between leaves exactly that, and
    // nothing else in the product looks at `stored` rows (external review, mailbox atomicity). Only
    // queued wake policies are retried here: an inbox row waits for a person on purpose.
    for (const delivery of await ports.mailbox.listDeliveries()) {
      if (delivery.state !== 'stored' || delivery.wakePolicy !== 'queue') continue
      try {
        const woken = await ports.mailbox.deliver(delivery.id)
        result.woke.push({ deliveryId: woken.id, messageId: woken.messageId, state: woken.state })
        await ports.appendAudit({ kind: 'dispatch/woke', teamId: ports.teamId, deliveryId: woken.id, messageId: woken.messageId, state: woken.state, at: now() })
      } catch (error) {
        logger(`live-teams: dispatch could not deliver stored ${delivery.id}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    // A delivery failed only because the member had no binding yet. That is the one
    // failure this reconciler may retry, and only once the binding exists.
    for (const delivery of await ports.mailbox.listDeliveries()) {
      if (delivery.state !== 'failed' || delivery.failure !== NO_SESSION_FAILURE) continue
      const member = state.members.find((candidate) => candidate.memberId === delivery.recipient)
      if (member?.sessionId === undefined || member.bindingGeneration === undefined) continue
      try {
        const retried = await ports.mailbox.retryDelivery(delivery.id)
        if (retried.state !== 'delivered') continue
        result.woke.push({ deliveryId: retried.id, messageId: retried.messageId, state: retried.state })
        await ports.appendAudit({ kind: 'dispatch/woke', teamId: ports.teamId, deliveryId: retried.id, messageId: retried.messageId, state: retried.state, at: now() })
      } catch (error) {
        // A delivery whose acknowledgement policy forbids retry, or whose lease is
        // held, is not this reconciler's to force: it stays failed and visible.
        logger(`live-teams: dispatch could not retry delivery ${delivery.id}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  async function startHalf(state: TeamState, result: ReconcileResult): Promise<void> {
    // Dependencies are resolved against every task, archived ones included: an
    // accepted task is completed, and a dependent must be able to start because of
    // it. Only non-archived tasks are candidates for starting.
    const universe = await ports.taskStore.listTasks({ includeArchived: true })
    const tasks = universe.filter((task) => task.archivedPath === undefined)
    result.evaluated = tasks.length
    const attempts = (await ports.taskStore.readAttempts()).attempts
    const messages = await ports.mailbox.listMessages()
    const deliveries = await ports.mailbox.listDeliveries()
    const memberOf = (memberId: string): MemberRecord | undefined => state.members.find((member) => member.memberId === memberId)
    let actions = 0
    for (const task of [...tasks].sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id))) {
      const evaluation = evaluateTask({ task, tasks, universe, attempts, team: state, paused: false, coding: ports.codingDispatch ?? 'manual', ...(ports.sharedPaths === undefined ? {} : { sharedPaths: ports.sharedPaths }), memberOf, ...(ports.preferredKindsOf === undefined ? {} : { preferredKindsOf: ports.preferredKindsOf }) })
      const previous = lastReason.get(task.id)
      lastReason.set(task.id, evaluation.reason)
      const attempt = task.activeAttemptId === undefined ? undefined : attempts.find((candidate) => candidate.id === task.activeAttemptId)
      // A claim with no assignment message is the crash window between the two: the
      // work is durable, the member was never told. Repair it with the same attempt
      // and the same thread, never with a second attempt (design §12).
      const repair = evaluation.decision === 'active' && attempt !== undefined && !messages.some((candidate) => candidate.threadId === assignmentThread(task.id, attempt.id))
      if (evaluation.decision !== 'assign' && !repair) {
        // `skipped` is the whole picture of one pass; `blocked` is the subset the
        // journal keeps — a *changed* reason only. A pass that changes nothing
        // writes nothing, the first sighting of a task is not news, and starting a
        // task (which reads as `attempt-active`) is progress rather than a block.
        result.skipped.push({ taskId: task.id, reason: evaluation.reason, detail: evaluation.detail })
        if (previous !== undefined && previous !== evaluation.reason && evaluation.reason !== 'attempt-active') {
          result.blocked.push({ taskId: task.id, reason: evaluation.reason, detail: evaluation.detail })
          await ports.appendAudit({ kind: 'dispatch/blocked', teamId: ports.teamId, taskId: task.id, reason: evaluation.reason, detail: evaluation.detail, from: previous, at: now() })
        }
        continue
      }
      if (actions >= maxActions) { result.skipped.push({ taskId: task.id, reason: evaluation.reason, detail: 'per-pass action limit reached' }); continue }
      actions += 1
      const member = memberOf(task.assignee as string) as MemberRecord
      try {
        const claimed = await ports.taskStore.claimTask({ taskId: task.id, memberId: member.memberId, sessionId: member.sessionId as string, bindingGeneration: member.bindingGeneration })
        // The pass keeps its own view of attempts honest: two ready tasks for one
        // member must not both look admissible once the first has been claimed.
        if (!attempts.some((candidate) => candidate.id === claimed.attempt.id)) attempts.push(claimed.attempt)
        // The pass read its view of the world when it began. A human acceptance landing inside the
        // pass — the fourth live round measured 12:03:40 for exactly that — would otherwise send an
        // assignment for a task that is already finished, costing the member a turn and confusing
        // it (F22). Re-reading the one task here narrows the window from a whole pass to the write
        // itself, and a settled task is not dispatched at all.
        const settled = (await ports.taskStore.listTasks({ includeArchived: true })).find((candidate) => candidate.id === task.id)
        if (settled === undefined || TERMINAL.includes(settled.status)) {
          result.skipped.push({ taskId: task.id, reason: 'task-settled-during-pass', detail: `the task became ${settled?.status ?? 'unknown'} while this pass was running; no assignment was sent` })
          continue
        }
        const threadId = assignmentThread(task.id, claimed.attempt.id)
        const existing = messages.find((message) => message.threadId === threadId)
        if (existing !== undefined) {
          for (const delivery of deliveries.filter((candidate) => candidate.messageId === existing.id)) {
            if (delivery.state === 'delivered' || delivery.state === 'acknowledged') continue
            try { await ports.mailbox.deliver(delivery.id) } catch (error) { logger(`live-teams: dispatch could not deliver ${delivery.id}: ${error instanceof Error ? error.message : String(error)}`) }
          }
          result.started.push({ taskId: task.id, attemptId: claimed.attempt.id, memberId: member.memberId, messageId: existing.id, detail: 'already dispatched' })
          continue
        }
        const sent = await ports.mailbox.sendFromScheduler({ to: member.memberId, kind: 'message', content: assignmentText(task, claimed.attempt, state, ports.workspacePath), threadId })
        const messageId = sent.message.id
        messages.push(sent.message)
        result.started.push({ taskId: task.id, attemptId: claimed.attempt.id, memberId: member.memberId, messageId, detail: repair ? `repaired a lost assignment for attempt ${claimed.attempt.id}` : evaluation.detail })
        await ports.appendAudit({
          kind: 'dispatch/assigned', teamId: ports.teamId, taskId: task.id, attemptId: claimed.attempt.id, memberId: member.memberId,
          messageId, reason: evaluation.reason, detail: evaluation.detail, ...(repair ? { repair: true } : {}), at: now(),
        })
      } catch (error) {
        // One task that cannot be started must not stop the others: the claim can
        // lose a race against a state change this pass did not see.
        const message = error instanceof LiveTeamsError ? error.message : error instanceof Error ? error.message : String(error)
        result.failures.push(`${task.id}: ${message}`)
        logger(`live-teams: dispatch could not start ${task.id}: ${message}`)
      }
    }
  }

  /**
   * Mark attempts a human wrote into mid-flight (B31). Only active attempts are
  /**
   * Close attempts left active on a task that has already ended (F5 of the first live
   * run). The store writes the audit; the pass only reports what it healed, because a
   * stale active attempt makes its member look busy for every later task.
   */
  /**
   * Show an attempt that is not moving (F3 of the live pilot).
   *
   * Detection only: nothing is revoked and nothing is reassigned, because silence is not death — a
   * member may be thinking, waiting for a person, or finished with a task it has not submitted. What
   * the product owes the human is that silence is *visible*, with the two signals that mean it:
   *
   *   - the assignment was never acknowledged (the task is still `claimed` long after the claim);
   *   - the work was acknowledged but nothing came of it: still no submission, and the Session is
   *     idle rather than running.
   *
   * A submission waiting for a reviewer, a lead or a person is deliberately *not* a stall: the ball
   * is with somebody, and the projection already says who.
   */
  async function observeStalledAttempts(state: TeamState, result: ReconcileResult): Promise<void> {
    const threshold = ports.stalledAfterMs ?? 10 * 60 * 1000
    const now = ports.now?.() ?? Date.now()
    const tasks = await ports.taskStore.listTasks({ includeArchived: true })
    const attempts = (await ports.taskStore.readAttempts()).attempts
    for (const attempt of attempts) {
      if (attempt.status !== 'active' || attempt.stalled !== undefined) continue
      const task = tasks.find((candidate) => candidate.id === attempt.taskId)
      if (task === undefined || task.latestSubmissionId !== undefined) continue
      const silence = now - (task.status === 'claimed' ? attempt.startedAt : Math.max(attempt.startedAt, task.updatedAt))
      if (silence < threshold) continue
      let reason: 'unacknowledged' | 'idle' = 'unacknowledged'
      let detail = `${memberName(state, attempt.memberId)} has not acknowledged the assignment in ${Math.round(silence / 60000)} minutes`
      if (task.status !== 'claimed') {
        if (ports.sessionStatus === undefined) continue
        const status = await ports.sessionStatus(attempt.sessionId).catch(() => 'unknown' as const)
        if (status !== 'idle') continue
        reason = 'idle'
        detail = `${memberName(state, attempt.memberId)} acknowledged the work ${Math.round(silence / 60000)} minutes ago, its Session is idle and nothing has been submitted`
      }
      const recorded = await ports.taskStore.markAttemptStalled({ attemptId: attempt.id, reason, detail, actor: 'reconciler' }).catch(() => false)
      if (recorded) result.stalled.push({ taskId: attempt.taskId, attemptId: attempt.id, memberId: attempt.memberId, reason, detail })
    }
  }

  async function healTerminalAttempts(): Promise<void> {
    try {
      const healed = await ports.taskStore.closeTerminalAttempts()
      if (healed.closed.length > 0) {
        logger(`live-teams: closed ${healed.closed.length} attempt(s) whose task had already ended: ${healed.closed.map((entry) => `${entry.attemptId} (${entry.status})`).join(', ')}`)
      }
      // A fingerprint whose attempt is no longer running is garbage, not evidence (B32).
      const pruned = await ports.taskStore.pruneSnapshots()
      if (pruned > 0) logger(`live-teams: removed ${pruned} stale scope snapshot(s)`)
      // An integration interrupted between moving the branch and finishing the acceptance leaves a
      // marker on the task. The branch says which half happened; nothing is decided here (review
      // finding 1).
      // A message stored without its delivery rows is invisible; make it a visible failure.
      const orphans = await ports.mailbox.healOrphanMessages().catch(() => [])
      for (const orphan of orphans) logger(`live-teams: message ${orphan.messageId} had no delivery row; recorded a failed delivery to ${orphan.recipient}`)

      if (ports.gitTip !== undefined) {
        const interrupted = await ports.taskStore.reconcilePendingIntegrations({ tipOf: ports.gitTip, actor: 'reconciler' })
        for (const entry of interrupted) logger(`live-teams: integration pending on ${entry.taskId} (${entry.state}): ${entry.detail}`)
      }
    } catch (error) {
      logger(`live-teams: could not close stale attempts: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Mark attempts a human wrote into mid-flight (B31). Only active attempts are
   * observed: the mark matters while work is in progress, and once set it persists on
   * the record, so a later pass cannot miss it.
   */
  async function observeInterventions(result: ReconcileResult): Promise<void> {
    if (ports.humanActivity === undefined) {
      if (!warnedUnobservable) { warnedUnobservable = true; logger('live-teams: human intervention cannot be observed in this composition; no attempt will be marked') }
      return
    }
    const attempts = (await ports.taskStore.readAttempts()).attempts.filter((attempt) => attempt.status === 'active' && attempt.humanIntervenedAt === undefined)
    for (const attempt of attempts) {
      let observed: boolean | undefined
      try { observed = await ports.humanActivity(attempt.sessionId, attempt.startedAt) } catch (error) {
        logger(`live-teams: could not observe Session ${attempt.sessionId}: ${error instanceof Error ? error.message : String(error)}`)
        continue
      }
      if (observed !== true) continue
      const marked = await ports.taskStore.markHumanIntervention(attempt.id, now())
      if (!marked.changed) continue
      result.intervened.push({ attemptId: attempt.id, taskId: attempt.taskId, memberId: attempt.memberId })
    }
  }

  async function pass(trigger: string): Promise<ReconcileResult> {
    const result: ReconcileResult = { trigger, paused: false, evaluated: 0, started: [], woke: [], blocked: [], skipped: [], intervened: [], stalled: [], failures: [] }
    const state = await ports.readTeam()
    const dispatch = readDispatchSwitch(state)
    result.paused = dispatch.mode === 'paused'
    // The wake half runs even when dispatch is paused: a message already queued for
    // a member must still reach that member. Pausing starts is not a takeover.
    await healTerminalAttempts()
    await observeInterventions(result)
    await ports.recoverObsoleteAssignments?.()
    await wakeHalf(result)
    await ports.recoverReviewReturns?.()
    await ports.recoverSubmissionNotifications?.()
    await ports.recoverLifecycleNotifications?.()
    await observeStalledAttempts(state, result)
    if (dispatch.mode === 'auto') await startHalf(state, result)
    // Rotation runs last and only on the automatic half: a paused team is a human decision, and
    // replacing a member's Session behind that decision would be the kind of hidden autonomy this
    // product avoids. It is also last on purpose — every step above reads the team state a rotation
    // would change, so replacing a member earlier in the pass would leave those steps assigning to a
    // member id that no longer exists.
    if (dispatch.mode === 'auto' && ports.rotation !== undefined) {
      try { await ports.rotation() } catch (error) {
        logger(`live-teams: rotation pass failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    return result
  }

  /**
   * One pass, guarded by a single-flight latch. The latch is cleared from a
   * continuation registered *after* it is set: clearing it inside the pass's own
   * `finally` runs synchronously when the pass refuses before its first `await`,
   * which would leave the latch holding a settled promise and turn every later
   * reconcile into a replay of that first refusal (found by the B29 host check).
   */
  function reconcile(trigger: string): Promise<ReconcileResult> {
    if (stopped) return Promise.resolve<ReconcileResult>({ trigger, paused: false, evaluated: 0, started: [], woke: [], blocked: [], skipped: [], intervened: [], stalled: [], failures: ['the dispatcher is stopped'] })
    if (running !== undefined) { rerun = true; return running }
    const attempt = runPass(trigger)
    running = attempt
    const settle = (): void => {
      if (running === attempt) running = undefined
      if (rerun && !stopped) { rerun = false; void reconcile('coalesced') }
    }
    void attempt.then(settle, settle)
    return attempt
  }

  async function runPass(trigger: string): Promise<ReconcileResult> {
    try {
      if (ports.enabled?.() === false) return { trigger, paused: false, evaluated: 0, started: [], woke: [], blocked: [], skipped: [], intervened: [], stalled: [], failures: [ports.inactiveReason?.() ?? 'the team is not active'] } satisfies ReconcileResult
      return await pass(trigger)
    } catch (error) {
      const message = error instanceof LiveTeamsError ? error.message : error instanceof Error ? error.message : String(error)
      logger(`live-teams: dispatch pass failed (${trigger}): ${message}`)
      return { trigger, paused: false, evaluated: 0, started: [], woke: [], blocked: [], skipped: [], intervened: [], stalled: [], failures: [message] } satisfies ReconcileResult
    }
  }

  return {
    reconcile,
    notice: (event) => {
      const kind = typeof event?.kind === 'string' ? event.kind : ''
      // The dispatcher's own audits are not wake-up signals, or a pass would retrigger itself.
      if (kind.length === 0 || kind.startsWith('dispatch/') || !TRIGGER_KINDS.test(kind)) return
      void reconcile(`event:${kind}`)
    },
    start: () => {
      if (stopped || timer !== undefined) return
      const interval = setInterval(() => { void reconcile('sweep') }, sweepIntervalMs)
      // A sweep is a safety net, not a reason to hold the process open.
      ;(interval as unknown as { unref?: () => void }).unref?.()
      timer = interval
      void reconcile('startup')
    },
    stop: async () => {
      stopped = true
      if (timer !== undefined) clearInterval(timer)
      timer = undefined
      // A pass already running holds store writes; disposal must wait for it rather
      // than delete the workspace underneath it (found by the B19 host check).
      try { await running } catch { /* the pass reports its own failure */ }
    },
  }
}
