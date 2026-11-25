import { promises as fs, readFileSync } from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { ERROR_CODES, LiveTeamsError } from './errors.js'
import { atomicWrite, atomicWriteJson, clone, fileExists, readJson, withProcessLock, CURRENT_SCHEMA_VERSION, TASKS_SCHEMA_VERSION } from './storage.js'
import { CODING_KINDS, literalPrefix, MAX_PATHS, normalizeScope, normalizeScopePath, outsideScope, scopesIntersect } from './scope.js'
import { diffSnapshots } from './tree-snapshot.js'
import { diagnosePaths, type PathWarning } from './path-diagnostics.js'
import { parseReviewReturn, reviewReturnNoticeClass, type ReviewReturn } from './review-return-state.js'
import { lifecycleIntent, withLifecycleIntent, validateLifecycleNotices, type LifecycleNoticeIntent, type LifecycleNoticeRequest, type LifecycleNoticeFence } from './lifecycle-notice.js'
import { MIGRATIONS, applyMigration, planMigration, type Migration } from './migrations.js'
import { resolveLeadMemberId } from './team-store.js'
import { TEAM_ROOT, type MemberRecord, type TeamState } from './team-store.js'

export type TaskKind = 'work' | 'research' | 'requirements' | 'implementation' | 'verification' | 'review' | 'repair' | 'integration'
export type TaskStatus = 'draft' | 'ready' | 'claimed' | 'in_progress' | 'waiting' | 'needs_human' | 'completed' | 'failed' | 'cancelled'
export type TaskRoute =
  | { type: 'report'; to: string | 'human' }
  | { type: 'review'; reviewer: string }
  | { type: 'interactive'; then: TaskRoute }
  | { type: 'custom'; description: string }

/** The durable task shape deliberately leaves room for later Phase 4 fields. */
export type HumanContact = 'none' | 'expected' | 'required'

export type { ReviewReturn } from './review-return-state.js'
export interface ReviewReturnRequest {
  taskId: string
  title: string
  leadMemberId: string
  leadSessionId?: string
  leadBindingGeneration?: number
  leadStillCurrent?: () => Promise<boolean>
  intent: ReviewReturn
  round: ReviewRound
  /** Recheck the attempt capability immediately before an external enqueue. */
  stillCurrent: () => Promise<boolean>
}

export interface TeamTask {
  /** Prospective durable handoff only; historical reviews have no return intent. */
  reviewReturn?: ReviewReturn
  id: string
  teamId: string
  title: string
  kind: TaskKind
  status: TaskStatus
  assignee?: string
  route?: TaskRoute
  humanContact?: HumanContact
  activeAttemptId?: string
  latestSubmissionId?: string
  acceptedSubmissionId?: string
  acceptance: string[]
  roundLimit: number
  createdBy: string
  createdAt: number
  updatedAt: number
  revision: number
  /** Set after lead acceptance; the authored document then lives under archive/. */
  archivedPath?: string
  /** Latest review round, populated by list projections when reviews exist. */
  round?: number
  /**
   * Tasks in this team that must be `completed` before this one may be claimed.
   * Immutable in B26: changing them is contract editing (B27).
   */
  dependsOn?: string[]
  /**
   * Workspace-relative globs this task may touch (B30). The lead declares them; two
   * writing tasks with intersecting declarations do not run at the same time, and a
   * submission records what actually changed outside them.
   */
  paths?: string[]
  /**
   * Bumped only when the *work itself* is restated — creation, a contract update, an
   * acceptance, a revision — never by claiming, acknowledging, submitting or revoking.
   * A mark left by a human intervention is resolved by exactly that (B31), so a
   * revocation cannot silently un-suppress a task whose contract nobody rewrote.
   */
  contractRevision?: number
  /**
   * The authored narrative of the contract. It used to live only in the rendered
   * document, which made the record a partial copy of its own contract and made
   * editing impossible without losing it (B27).
   */
  why?: string
  body?: string
  checks?: string[]
  /** True only in list projections when this task's authored document is absent. */
  documentMissing?: boolean
  [key: string]: unknown
  /**
   * Written just before an integration moves the branch, cleared by the write that finishes the
   * acceptance. A process that dies in between leaves it behind, which is how the reconciler can tell
   * "the branch moved but the task was never completed" from "nothing happened" (review finding 1).
   */
  integrationPending?: { baseRef: string; headSha: string; baseTipSha: string; at: number; reportedAt?: number }
  /**
   * A submission is in and nobody has decided on it: the lead or the human owes an accept or a
   * return. Kept as a fact on the task rather than derived from the status, because the status also
   * says `in_progress` after a return — and both the store and the panel read the status and
   * concluded there was nothing to decide while a submission sat on the table (found on a real
   * stand: the human had only "Release attempt" and the lead's accept was refused).
   */
  awaitsDecision?: boolean
  /** Prospective notification intent; mailbox/command rows retain the delivery receipt. */
  submissionNoticeId?: string
  /** Prospective existing lifecycle handoffs; delivery records live in the mailbox outbox. */
  lifecycleNotices?: LifecycleNoticeIntent[]
}

/** Submission accepts claimed work too; notification eligibility must preserve that protocol.
 * Marker opt-in, route, recipient and binding fences are checked by their existing callers. */
function submissionAwaitsDecision(task: TeamTask | undefined, submissionId = task?.latestSubmissionId): task is TeamTask {
  return task !== undefined && task.latestSubmissionId !== undefined && task.latestSubmissionId === submissionId && task.awaitsDecision === true && task.archivedPath === undefined && ['claimed', 'in_progress', 'waiting'].includes(task.status)
}

export interface TaskAttempt {
  id: string
  taskId: string
  memberId: string
  sessionId: string
  bindingGeneration: number
  generation: number
  /**
   * `revoking` is durable on purpose: the capability is already invalid and the
   * session has been asked to stop, but quiescence has not been observed yet. A
   * crash mid-transaction then leaves an honest record, not an active-looking
   * attempt (B28).
   */
  status: 'active' | 'revoking' | 'revoked' | 'completed' | 'failed'
  startedAt: number
  /**
   * When a human wrote into this member's Session directly, mid-attempt (B31), and the
   * task revision at that moment. The mark stops automatic dispatch until the contract
   * is formally restated — an update, an acceptance or a revision bumps the task
   * revision above this value, which is what resolves it.
   */
  humanIntervenedAt?: number
  humanIntervenedContractRevision?: number
  /**
   * When the reconciler first noticed that this attempt is not moving: the assignment was never
   * acknowledged, or the member's Session went idle with the work unfinished (F3 of the live pilot).
   * Recorded on the attempt so the notice survives restarts and is written once, not every pass.
   * Nothing is revoked on the strength of it — silence is not death, it is something to show.
   */
  stalled?: { at: number; reason: 'unacknowledged' | 'idle'; detail: string }
  /**
   * Phase 6: the branch and tip this attempt was based on, recorded when it claimed the task.
   * It is the acceptance precondition — integration refuses if the base moved since.
   */
  gitBase?: { ref: string; baseTipSha: string }
  revision: number
}

export interface AttemptsState {
  schemaVersion: number
  revision: number
  teamId: string
  attempts: TaskAttempt[]
  [key: string]: unknown
}

export interface ClaimTaskRequest {
  taskId: string
  memberId: string
  sessionId: string
  bindingGeneration: number
}

export interface ClaimTaskResult {
  task: TeamTask
  attempt: TaskAttempt
}

export interface AcknowledgeTaskRequest {
  taskId: string
  memberId: string
  /** Required: the fence of ADR 0005 is checked against the binding the caller presents. */
  sessionId: string
  bindingGeneration: number
}

export interface TasksState {
  schemaVersion: number
  revision: number
  teamId: string
  tasks: TeamTask[]
  [key: string]: unknown
}

/**
 * A contract edit. An absent key means "leave it"; `null` clears a field that is
 * allowed to be empty. Only the lead may send one, and only while the task is
 * `draft` or `ready` — see the B27 contract.
 */
export interface UpdateTaskRequest {
  taskId: string
  actor: string
  expectedRevision?: number
  title?: string
  kind?: TaskKind
  assignee?: string | null
  route?: TaskRoute | null
  acceptance?: readonly string[]
  checks?: readonly string[]
  why?: string
  body?: string
  roundLimit?: number
  humanContact?: HumanContact
  dependsOn?: readonly string[] | null
  paths?: readonly string[] | null
}

export type UpdateTaskResult = { readonly task: TeamTask; readonly document: string; readonly changed: readonly string[]; readonly warnings?: readonly PathWarning[] }

/**
 * Take work away from its current attempt (B28).
 *
 * `nextAssignee` moves ownership inside the same transaction; the contract is not
 * touched, and the new owner claims the task themselves — the only path that has
 * ever created an attempt.
 */
export interface RevokeTaskRequest {
  taskId: string
  actor: string
  reason: string
  nextAssignee?: string
  expectedRevision?: number
}

export type RevokeTaskResult = { readonly task: TeamTask; readonly attempt: TaskAttempt; readonly quiesced: boolean; readonly reassigned: boolean }

export interface CreateTaskRequest {
  title: string
  kind: TaskKind
  assignee?: string
  route?: TaskRoute
  acceptance: readonly string[]
  humanContact?: HumanContact
  checks?: readonly string[]
  why?: string
  body?: string
  roundLimit?: number
  dependsOn?: readonly string[]
  paths?: readonly string[]
  actor: string
  expectedRevision?: number
}

export type SubmissionArtifact =
  | {
    type: 'report'
    bodyRef: string
    bodyDigest: string
    /**
     * Where the frozen bytes live, relative to the team directory. The digest proves *what* was
     * submitted; this makes it possible to read it back after the workspace moved on — the author can
     * rewrite the file at `bodyRef` the moment after submitting, and a reviewer that reads the path
     * would see the new text while the digest still describes the old one.
     */
    blobPath?: string
  }
  | {
    type: 'files'
    paths: string[]
    manifestDigest: string
    /** One frozen copy per path, in the same order as `paths`. */
    blobs?: { path: string; digest: string; blobPath: string }[]
  }

export type SubmissionSourceArtifact =
  | { type: 'report'; bodyRef: string }
  | { type: 'files'; paths: string[] }

export type SubmissionCheck = { command: string; status: 'passed' | 'failed'; output?: string }

/**
 * What the declaration was worth at submission time (B30). `unchecked` is a
 * first-class outcome: an unobservable workspace must not read as a clean one.
 */
export interface SubmissionScope {
  declared: string[]
  changed?: string[]
  unexpected?: string[]
  /**
   * Paths outside this declaration that another *active* task was writing at the same
   * time. The first parallel run showed that in one shared tree this is what most
   * "unexpected" changes are: a colleague working on their own package, not an
   * intrusion into this one. The name says what was observed.
   */
  sharedTree?: string[]
  state: 'clean' | 'violation' | 'shared-tree' | 'unchecked'
  /**
   * Where this record's evidence came from (B32): `git` in a work tree, `files` in a folder
   * that is not a repository. The record keeps its shape either way; the mode says what the
   * evidence is worth.
   */
  mode?: 'git' | 'files'
  /** Why the workspace could not be observed, when `state` is `unchecked`. */
  reason?: 'no-repository' | 'too-many-files' | 'no-snapshot' | 'unreadable'
  /**
   * Phase 6: the paths that went into the submission's commit — exactly what the member
   * submitted. `changed` stays the working tree's own story, so an edit outside the declaration
   * is still visible even though the reviewed artifact is a commit.
   */
  committed?: string[]
}

/**
 * The Git half of a submission (ADR 0006): the commit the plugin built from the submitted paths,
 * the base it was built on, and the boundary of the reviewed diff.
 */
export interface SubmissionGit {
  baseRef: string
  baseTipSha: string
  /**
   * Set when the recorded claim-time base had already moved by the time the submission was frozen
   * and the movement could not touch the declared paths: the commit is parented on the base as it
   * was at freeze time, and this names the base the attempt actually started from.
   */
  rebasedFrom?: string
  headSha: string
  mergeBaseSha?: string
  commitPaths: string[]
}

/** A path whose workspace content no longer matches what the submission froze. */
export interface SubmissionDrift {
  path: string
  expected: string
  /** `null` when the file is gone. */
  actual: string | null
}

export interface Submission {
  id: string
  taskId: string
  attemptId: string
  attemptGeneration: number
  artifact: SubmissionArtifact
  /**
   * Phase 6: the commit this submission is reviewed as. It belongs to the submission, not to an
   * artifact shape — a coding task that submits a report still has a diff to review.
   */
  git?: SubmissionGit
  summary: string
  checks: SubmissionCheck[]
  scope?: SubmissionScope
  createdAt: number
  revision: number
}

export type ReviewFinding = { severity: 'low' | 'medium' | 'high' | 'blocker'; problem: string; requiredFix: string; artifactLocation?: string }
export type ReviewVerdict = 'pass' | 'needs_revision' | 'escalate'
export interface ReviewRound {
  id: string
  taskId: string
  submissionId: string
  reviewerMemberId: string
  round: number
  verdict: ReviewVerdict
  findings: ReviewFinding[]
  evidence: SubmissionCheck[]
  createdAt: number
  revision: number
}

export interface SubmissionsState {
  schemaVersion: number
  revision: number
  teamId: string
  submissions: Submission[]
  [key: string]: unknown
}

export interface ReviewsState {
  schemaVersion: number
  revision: number
  teamId: string
  rounds: ReviewRound[]
  [key: string]: unknown
}

export interface SubmitTaskRequest {
  taskId: string
  memberId: string
  sessionId: string
  bindingGeneration: number
  artifact: SubmissionSourceArtifact
  summary: string
  checks: readonly SubmissionCheck[]
}

export interface AcceptTaskRequest {
  taskId: string
  actor: string
  note?: string
}

export interface AcceptTaskResult {
  notifications?: SubmissionNotificationReceipt[]
  task: TeamTask
  archivedPath: string
}

export interface ReviseTaskRequest {
  taskId: string
  actor: string
  instructions: string
}

export interface ReviseTaskResult {
  notifications?: SubmissionNotificationReceipt[]
  task: TeamTask
}

export interface ReviewTaskRequest {
  taskId: string
  submissionId: string
  reviewerMemberId: string
  verdict: ReviewVerdict
  findings?: readonly ReviewFinding[]
  evidence?: readonly SubmissionCheck[]
}

export interface ReviewTaskResult {
  notifications?: SubmissionNotificationReceipt[]
  round: ReviewRound
  task: TeamTask
}

export interface ReadTaskResult {
  task: TeamTask
  document: string
  /**
   * Submissions as they were frozen, plus a drift note per submission: paths whose workspace content
   * no longer matches the frozen bytes. A reviewer that reads the workspace path would otherwise
   * judge text the digest does not describe.
   */
  submissions: (Submission & { drift?: SubmissionDrift[] })[]
  rounds: ReviewRound[]
  /**
   * Every attempt this task ever had, oldest first. A task sitting in `claimed` with an
   * attempt nobody acknowledged is the state a human most needs to see, and reading the
   * journal for it was the only way before B31.
   */
  attempts: TaskAttempt[]
}

export interface CreateTaskResult {
  task: TeamTask
  documentPath: string
  warnings?: readonly PathWarning[]
}

export interface ListTasksOptions {
  includeArchived?: boolean
}

export type SubmissionNotificationReceipt = {
  recipient?: string
  purpose: 'lead-acceptance' | 'review' | 'review-return' | 'review-return-lead' | LifecycleNoticeIntent['kind']
  state: 'queued' | 'pending' | 'failed' | 'unavailable' | 'superseded'
  messageId?: string
  requestId?: string
  sessionId?: string
  bindingGeneration?: number
  reason?: string
}
export type SubmissionNotificationRequest = {
  taskId: string; submissionId: string; assignee: string; summary: string
  recipient: string; purpose: 'lead-acceptance' | 'review'; sessionId: string; bindingGeneration: number
  stillCurrent: () => Promise<boolean>
}

type TaskStoreOptions = {
  deliverLifecycleNotice?: (request: LifecycleNoticeRequest) => Promise<SubmissionNotificationReceipt>
  deliverSubmissionNotice?: (request: SubmissionNotificationRequest) => Promise<SubmissionNotificationReceipt>

  workspacePath: string
  teamId: string
  appendAudit?: (event: unknown) => Promise<void>
  deliverEscalation?: (request: { leadMemberId: string; taskId: string; submissionId: string; round: ReviewRound; reviewerMemberId: string; problem: string; tried: string }) => Promise<void>
  deliverClosing?: (request: { assignee: string; taskId: string; note?: string }) => Promise<void>
  /**
   * Tell the reviewer that a submission is waiting.
   *
   * Handing the submission over is the member's job by contract, and a member that forgets leaves the
   * work sitting: on a real stand one submission waited six and a half minutes for a human to notice,
   * while the member that did message its reviewer was accepted in thirty-one seconds. The route is
   * frozen in the task's contract once work starts, so this can only go where the lead sent it.
   */
  deliverReviewRequest?: (request: { reviewer: string; assignee: string; taskId: string; submissionId: string; summary: string }) => Promise<void>
  /**
   * Tell the assignee that the task was closed by hand.
   *
   * Closing ends the attempt, and a member whose Session is waiting for a next task is never told by
   * the state change alone: acceptance has always delivered a closing message, and closing needs the
   * same, with the reason.
   */
  deliverCancellation?: (request: { assignee: string; taskId: string; reason: string }) => Promise<void>
  deliverDirection?: (request: { assignee: string; taskId: string; instructions: string }) => Promise<void>
  deliverReviewReturn?: (request: ReviewReturnRequest) => Promise<{ messageId: string; requestId: string; pending?: boolean }>
  observeReviewReturn?: (request: ReviewReturnRequest) => Promise<{ state: 'pending' | 'started' | 'completed' | 'failed' | 'unobservable'; turn?: number; inputSeq?: number; reason?: string }>
  notifyReviewReturn?: (request: ReviewReturnRequest) => Promise<SubmissionNotificationReceipt | void>
  /**
   * Ask a Session to stop. Absent means the store cannot interrupt, and a
   * revocation then refuses rather than pretending the session was stopped.
   */
  interruptSession?: (sessionId: string, reason: string) => Promise<void>
  /** Observe that a Session is no longer running. `false` means "not observed in time". */
  awaitQuiescence?: (sessionId: string, timeoutMs: number) => Promise<boolean>
  quiescenceTimeoutMs?: number
  /**
   * What changed in the workspace at submission time (B30). `undefined` means "not
   * observable" — no git, or not a repository — and is recorded as `unchecked`
   * rather than as a clean result. The store never shells out itself.
   */
  changedPaths?: (workspacePath: string) => Promise<readonly string[] | undefined>
  /**
   * What the member committed since the attempt's base. Optional: without it the scope sees the
   * working tree only, which is the behaviour that refused a member who committed its work.
   */
  committedPaths?: (workspacePath: string, base: string) => Promise<readonly string[] | undefined>
  /**
   * B32: which observation this workspace supports. Absent means the composition cannot
   * tell, and a scope record says `unchecked (unreadable)` rather than reading as clean.
   */
  workspaceMode?: (workspacePath: string) => Promise<'git' | 'files' | undefined>
  /** Migration steps to use; the module's registry by default, injectable so a test can add one. */
  migrations?: Readonly<Record<number, Migration>>
  /** B32: a cheap fingerprint of the tree, taken at claim and at submit in `files` mode. */
  snapshotTree?: (workspacePath: string) => Promise<Readonly<Record<string, string>> | undefined>
  /**
   * Phase 6 (ADR 0006): Git plumbing, injected the same way the changed-paths port is. The store
   * never shells out itself. Absent means submissions carry no Git artifact — a workspace without
   * a repository, or a composition that does not offer one.
   */
  git?: {
    base: (workspacePath: string) => Promise<{ ref: string; sha: string } | undefined>
    tip: (workspacePath: string, ref: string) => Promise<string | undefined>
    commit: (workspacePath: string, base: { ref: string; sha: string } | undefined, request: { paths: readonly string[]; message: string; author: { name: string; email: string } }) => Promise<{ headSha: string; treeSha: string; commitPaths: readonly string[]; mergeBaseSha?: string } | undefined>
    pin: (workspacePath: string, ref: string, sha: string) => Promise<boolean>
    integrate: (workspacePath: string, ref: string, headSha: string, expectedTip: string | undefined, commitPaths?: readonly string[]) => Promise<'integrated' | 'stale' | 'index-failed'>
    /** Paths changed between two commits, for deciding whether a moved base can be refreshed safely. */
    changedBetween: (workspacePath: string, fromSha: string, toSha: string) => Promise<readonly string[] | undefined>
  }
}

type TaskLocation = {
  directory: string
  file: string
  attemptsFile: string
  submissionsFile: string
  reviewsFile: string
  teamFile: string
  tasksDirectory: string
  archiveDirectory: string
  /** B32: one tree fingerprint per writing attempt in `files` mode. */
  snapshotsDirectory: string
  /** Content-addressed copies of submitted bytes, so a submission can be read back as submitted. */
  blobsDirectory: string
}

type ObjectRecord = Record<string, unknown>

const TASK_KINDS: readonly TaskKind[] = ['work', 'research', 'requirements', 'implementation', 'verification', 'review', 'repair', 'integration']
const TASK_STATUSES: readonly TaskStatus[] = ['draft', 'ready', 'claimed', 'in_progress', 'waiting', 'needs_human', 'completed', 'failed', 'cancelled']
const MAX_TITLE = 200
const MAX_BODY = 20_000
const MAX_TASKS = 100
/** A task with more dependencies than this is a plan, not a task. */
const MAX_DEPENDENCIES = 8
const FINDING_SEVERITIES: readonly ReviewFinding['severity'][] = ['low', 'medium', 'high', 'blocker']
const REVIEW_VERDICTS: readonly ReviewVerdict[] = ['pass', 'needs_revision', 'escalate']

function objectRecord(value: unknown): ObjectRecord | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as ObjectRecord : undefined
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function chars(value: string): number { return Array.from(value).length }

function candidateId(value: string): boolean {
  return value.length > 0 && value !== '.' && value !== '..' && !value.includes('/') && !value.includes('\\')
}

function fail(message: string): never {
  throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, message)
}

function memberById(team: TeamState, id: string): MemberRecord | undefined {
  return team.members.find((member) => member.memberId === id)
}

/**
 * A route target named the way a model actually writes it.
 *
 * Ids are exact, `human` is a target of its own, and a display name is accepted when it identifies
 * exactly one member — the mailbox resolves names the same way. `lead` is accepted as well because it
 * is unambiguous in a team that has one, and a model reaching for "send it back to the lead" should not
 * have to look an id up first. An ambiguous or unknown name returns nothing, so the caller can name
 * the valid ids instead of guessing.
 */
function routeTarget(team: TeamState, value: unknown): string | undefined {
  if (!nonEmpty(value)) return undefined
  const requested = value.trim()
  if (requested === 'human') return 'human'
  const byId = memberById(team, requested)
  if (byId !== undefined) return byId.memberId
  if (requested.toLowerCase() === 'lead') {
    const lead = resolveLeadMemberId(team)
    if (lead !== undefined) return lead
  }
  const matches = team.members.filter((member) => member.displayName.trim().toLowerCase() === requested.toLowerCase())
  return matches.length === 1 ? matches[0]?.memberId : undefined
}

/**
 * A route serialised as JSON text.
 *
 * Models emit `"route": "{\"type\":\"report\",\"to\":\"<id>\"}"` often enough that refusing it costs a
 * whole turn of retries — and the retries are what turned a one-line contract into a stuck queue. Only
 * an object is parsed: a bare word is not a route, and the error names the shapes that are.
 */
function jsonObjectRoute(text: string): unknown {
  const trimmed = text.trim()
  if (!trimmed.startsWith('{')) return undefined
  try { return JSON.parse(trimmed) as unknown } catch { return undefined }
}

const ROUTE_SHAPES = '{"type":"review","reviewer":"<member id>"} or {"type":"report","to":"<member id>"|"lead"|"human"}'

function isLead(team: TeamState, actor: string): boolean {
  if (team.leadMemberId !== undefined) return team.leadMemberId === actor && memberById(team, actor) !== undefined
  const leads = team.members.filter((member) => member.role === 'lead')
  return leads.length === 1 && leads[0]?.memberId === actor
}

/** The desktop route is the owning human's lead-level operation. */
function isLeadOrHuman(team: TeamState, actor: string): boolean {
  // Both human actors pass: the route admitted the caller either way, and the difference between
  // "the panel did it" and "a local process did it" belongs to the journal, not to authority.
  return actor === 'human:desktop' || actor === 'local:unverified' || isLead(team, actor)
}

function leadMemberIdForMessage(team: TeamState): string { return team.leadMemberId ?? team.members.find((member) => member.role === 'lead')?.memberId ?? 'the lead' }

function validateRoute(route: unknown, team: TeamState, assignee: string | undefined): TaskRoute {
  // A JSON string is parsed once and then validated exactly like an object; a bare word is refused
  // with the shapes that work, because the previous message ("route must be a report, review, …")
  // read as if `"report"` were acceptable and cost the lead eight consecutive failed calls.
  const parsed = typeof route === 'string' ? jsonObjectRoute(route) : route
  // The portable protocol describes `interactive → human, then reviewer`. The transitions implement
  // `report` and `review` only, so a task with the nested shape could never be completed: it is
  // refused where it is written, with the working alternative named.
  if (objectRecord(parsed)?.type === 'interactive') fail('the interactive route shape is not implemented: use {"type":"review","reviewer":"<member id>"} or {"type":"report","to":"human"}')
  const value = objectRecord(parsed)
  if (value === undefined || typeof value.type !== 'string') fail(`route must be an object, not ${typeof route === 'string' ? 'a string' : 'that'}: ${ROUTE_SHAPES} (a JSON string of the same object is accepted)`)
  if (value.type === 'report') {
    const target = routeTarget(team, value.to)
    if (target === undefined) fail(`report route must name a current member id, a unique display name, "lead" or "human"; members: ${team.members.map((member) => `${member.memberId} (${member.displayName})`).join(', ')}`)
    return { type: 'report', to: target }
  }
  if (value.type === 'review') {
    const reviewer = routeTarget(team, value.reviewer)
    if (reviewer === undefined) fail(`review route must name a current member by id or unique display name; members: ${team.members.map((member) => `${member.memberId} (${member.displayName})`).join(', ')}`)
    if (assignee !== undefined && reviewer === assignee) fail('reviewer cannot be the assignee; nobody reviews their own work')
    return { type: 'review', reviewer }
  }
  if (value.type === 'interactive') {
    if (value.then === undefined) fail('interactive route requires a follow-up route')
    return { type: 'interactive', then: validateRoute(value.then, team, assignee) }
  }
  if (value.type === 'custom') {
    if (!nonEmpty(value.description)) fail('custom route description must be non-empty')
    return { type: 'custom', description: value.description.trim() }
  }
  fail(`unsupported task route: ${value.type}; use ${ROUTE_SHAPES}`)
}

/**
 * Validate the dependency list of a task contract.
 *
 * Checked against the tasks that exist *now*, because a dependency naming a task
 * that does not exist is a typo that would block the work forever, and a cycle
 * would block it just as permanently while looking legitimate.
 */
function validateDependencies(value: unknown, selfId: string | undefined, tasks: readonly TeamTask[]): string[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) fail('dependsOn must be an array of task ids')
  if (value.length === 0) return undefined
  if (value.length > MAX_DEPENDENCIES) fail(`a task may depend on at most ${MAX_DEPENDENCIES} tasks`)
  const ids: string[] = []
  for (const entry of value) {
    if (typeof entry !== 'string' || !candidateId(entry)) fail('dependsOn must contain task ids')
    if (entry === selfId) fail('a task cannot depend on itself')
    if (ids.includes(entry)) fail(`dependsOn repeats ${entry}`)
    if (!tasks.some((task) => task.id === entry)) fail(`dependsOn names an unknown task: ${entry}`)
    ids.push(entry)
  }
  // Reachability, not a depth limit: an indirect cycle blocks work exactly like a
  // direct one, and the graph is tiny (<= 100 tasks, <= 8 edges each).
  const byId = new Map(tasks.map((task) => [task.id, task]))
  const seen = new Set<string>()
  const pending = [...ids]
  while (pending.length > 0) {
    const id = pending.pop() as string
    if (id === selfId) fail(`dependsOn would create a cycle through ${id}`)
    if (seen.has(id)) continue
    seen.add(id)
    for (const next of byId.get(id)?.dependsOn ?? []) pending.push(next)
  }
  return ids
}

/**
 * The dependencies that still stand between a task and its claim, in the order
 * the contract lists them. A dependency in a terminal non-completed state is
 * included on purpose: it blocks forever and the human must see that.
 */
export function blockedBy(task: Pick<TeamTask, 'dependsOn'>, tasks: readonly TeamTask[]): Array<{ id: string; title: string; status: TaskStatus }> {
  const ids = task.dependsOn ?? []
  if (ids.length === 0) return []
  const byId = new Map(tasks.map((entry) => [entry.id, entry]))
  return ids
    .filter((id) => byId.get(id)?.status !== 'completed')
    .map((id) => ({ id, title: byId.get(id)?.title ?? id, status: (byId.get(id)?.status ?? 'failed') as TaskStatus }))
}

function validateTaskRecord(value: unknown, teamId: string, archiveDirectory?: string): TeamTask {
  const candidate = objectRecord(value)
  const humanContact = candidate?.humanContact
  const archivedPath = candidate?.archivedPath
  // `archive/<file>.md` relative to the team directory is the current shape; an absolute path is
  // the older one. Both must resolve inside the archive directory, and nothing else is accepted.
  const archiveRoot = archiveDirectory === undefined ? undefined : path.resolve(archiveDirectory)
  const resolvedArchive = typeof archivedPath !== 'string' || archiveRoot === undefined
    ? undefined
    : path.isAbsolute(archivedPath) ? path.resolve(archivedPath) : path.resolve(path.dirname(archiveRoot), archivedPath)
  const archivePathValid = archivedPath === undefined || (typeof archivedPath === 'string' && archivedPath.length > 0 && resolvedArchive !== undefined
    && (resolvedArchive === archiveRoot || resolvedArchive.startsWith(`${archiveRoot}${path.sep}`)))
  if (candidate === undefined
    || typeof candidate.id !== 'string' || !candidateId(candidate.id)
    || candidate.teamId !== teamId
    || typeof candidate.title !== 'string' || candidate.title.trim().length === 0
    || !TASK_KINDS.includes(candidate.kind as TaskKind)
    || !TASK_STATUSES.includes(candidate.status as TaskStatus)
    || !Array.isArray(candidate.acceptance)
    || !candidate.acceptance.every((entry): entry is string => typeof entry === 'string')
    || (candidate.status === 'ready' && (candidate.assignee === undefined || candidate.route === undefined || candidate.acceptance.length === 0 || candidate.acceptance.some((entry) => entry.trim().length === 0)))
    || (candidate.assignee !== undefined && typeof candidate.assignee !== 'string')
    || (candidate.why !== undefined && typeof candidate.why !== 'string')
    || (candidate.body !== undefined && (typeof candidate.body !== 'string' || chars(candidate.body) > MAX_BODY))
    || (candidate.checks !== undefined && (!Array.isArray(candidate.checks)
      || !candidate.checks.every((entry: unknown): entry is string => typeof entry === 'string' && entry.trim().length > 0)))
    || (candidate.dependsOn !== undefined && (!Array.isArray(candidate.dependsOn)
      || candidate.dependsOn.length === 0 || candidate.dependsOn.length > MAX_DEPENDENCIES
      || !candidate.dependsOn.every((entry: unknown): entry is string => typeof entry === 'string' && candidateId(entry))
      || new Set(candidate.dependsOn).size !== candidate.dependsOn.length
      || candidate.dependsOn.includes(candidate.id)))
    || (candidate.paths !== undefined && normalizeScope(candidate.paths) === undefined)
    || (candidate.contractRevision !== undefined && (!Number.isInteger(candidate.contractRevision) || Number(candidate.contractRevision) < 1))
    || !archivePathValid
     || (humanContact !== undefined && humanContact !== 'none' && humanContact !== 'expected' && humanContact !== 'required')
    || (candidate.activeAttemptId !== undefined && (typeof candidate.activeAttemptId !== 'string' || !candidateId(candidate.activeAttemptId)))
    || !Number.isInteger(candidate.roundLimit) || Number(candidate.roundLimit) < 1 || Number(candidate.roundLimit) > 20
    || typeof candidate.createdBy !== 'string' || candidate.createdBy.length === 0
    || !Number.isInteger(candidate.createdAt) || !Number.isInteger(candidate.updatedAt)
    || !Number.isInteger(candidate.revision) || Number(candidate.revision) < 1) {
    throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, 'invalid task record')
  }
  if (candidate.lifecycleNotices !== undefined) validateLifecycleNotices(candidate.lifecycleNotices)
  if (candidate.submissionNoticeId !== undefined && (typeof candidate.submissionNoticeId !== 'string' || !candidateId(candidate.submissionNoticeId) || candidate.submissionNoticeId !== candidate.latestSubmissionId)) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, 'invalid submission notification intent')
  if (candidate.reviewReturn !== undefined) {
    try { parseReviewReturn(candidate.reviewReturn) } catch { throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, 'invalid task review return metadata') }
  }
  return candidate as unknown as TeamTask
}

function parseTasksState(value: unknown, teamId: string, archiveDirectory?: string): TasksState {
  const candidate = objectRecord(value)
  // Both numbers in the refusal: a state from a newer DSH is not corruption, and saying which
  // versions are involved is the difference between updating the product and hunting a bug.
  if (candidate !== undefined && Number.isInteger(candidate.schemaVersion) && Number(candidate.schemaVersion) !== TASKS_SCHEMA_VERSION) {
    const plan = planMigration(candidate.schemaVersion, TASKS_SCHEMA_VERSION, 'task state')
    if (plan.kind === 'future') throw plan.error
  }
  if (candidate === undefined || !Number.isInteger(candidate.schemaVersion) || Number(candidate.schemaVersion) > TASKS_SCHEMA_VERSION
    || candidate.teamId !== teamId || !Number.isInteger(candidate.revision) || Number(candidate.revision) < 0 || !Array.isArray(candidate.tasks)) {
    throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, 'invalid task state')
  }
  const tasks = candidate.tasks.map((entry) => validateTaskRecord(entry, teamId, archiveDirectory))
  return { ...candidate, revision: Number(candidate.revision), tasks } as unknown as TasksState
}

function validateAttempt(value: unknown, teamId: string): TaskAttempt {
  const candidate = objectRecord(value)
  if (candidate === undefined || typeof candidate.id !== 'string' || !candidateId(candidate.id)
    || typeof candidate.taskId !== 'string' || !candidateId(candidate.taskId)
    || candidate.memberId === undefined || typeof candidate.memberId !== 'string' || candidate.memberId.length === 0
    || typeof candidate.sessionId !== 'string' || candidate.sessionId.length === 0
    || !Number.isInteger(candidate.bindingGeneration) || Number(candidate.bindingGeneration) < 0
    || !Number.isInteger(candidate.generation) || Number(candidate.generation) < 1
    || candidate.status !== 'active' && candidate.status !== 'revoking' && candidate.status !== 'revoked' && candidate.status !== 'completed' && candidate.status !== 'failed'
    || !Number.isInteger(candidate.startedAt) || !Number.isInteger(candidate.revision) || Number(candidate.revision) < 1
    || (candidate.humanIntervenedAt !== undefined && !Number.isInteger(candidate.humanIntervenedAt))
    || (candidate.humanIntervenedContractRevision !== undefined && !Number.isInteger(candidate.humanIntervenedContractRevision))
    || (candidate.gitBase !== undefined && (objectRecord(candidate.gitBase) === undefined || typeof objectRecord(candidate.gitBase)?.ref !== 'string' || typeof objectRecord(candidate.gitBase)?.baseTipSha !== 'string'))
    || (candidate.stalled !== undefined && (objectRecord(candidate.stalled) === undefined || !Number.isInteger(objectRecord(candidate.stalled)?.at) || (objectRecord(candidate.stalled)?.reason !== 'unacknowledged' && objectRecord(candidate.stalled)?.reason !== 'idle') || typeof objectRecord(candidate.stalled)?.detail !== 'string'))) {
    throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, `invalid task attempt in ${teamId}`)
  }
  return candidate as unknown as TaskAttempt
}

function parseAttemptsState(value: unknown, teamId: string): AttemptsState {
  const candidate = objectRecord(value)
  if (candidate === undefined || !Number.isInteger(candidate.schemaVersion) || Number(candidate.schemaVersion) > CURRENT_SCHEMA_VERSION
    || candidate.teamId !== teamId || !Number.isInteger(candidate.revision) || Number(candidate.revision) < 0 || !Array.isArray(candidate.attempts)) {
    throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, 'invalid attempts state')
  }
  return { ...candidate, revision: Number(candidate.revision), attempts: candidate.attempts.map((entry) => validateAttempt(entry, teamId)) } as unknown as AttemptsState
}

/**
 * The fence of ADR 0005, applied where it was missing: a member acting on its own task must present
 * the Session and binding generation it is bound to *now*. `submitTask` always checked the triple;
 * `claimTask` and `acknowledgeTask` did not, so a rebind could leave an old Session's call landing on
 * the new one's attempt (found by an external review).
 */
function fenceMember(member: MemberRecord | undefined, request: { sessionId?: string; bindingGeneration?: number }, memberId: string): void {
  if (member === undefined) fail(`${memberId} is not a current team member`)
  if (member.sessionId === undefined) return
  if (request.sessionId !== member.sessionId || request.bindingGeneration !== member.bindingGeneration) {
    fail(`${memberId} is bound to Session ${member.sessionId} (generation ${member.bindingGeneration}); this call came from another binding. Re-read the task and act from the current Session`)
  }
}

/** A readable, collision-free ref name for a pinned submission commit. */
function submissionGitRefSuffix(generation: number, headSha: string): string {
  return `g${generation}-${headSha.slice(0, 12)}`
}

function validateCheck(value: unknown): SubmissionCheck {
  const candidate = objectRecord(value)
  // A refusal has to name the shape, not the symptom: the first live run showed a member
  // sending {"command":"npm test","result":"pass 3, fail 0"} and getting back only
  // "invalid submission check", which says nothing about what to send instead.
  const keys = candidate === undefined ? String(value) : Object.keys(candidate).join(', ')
  if (candidate === undefined || typeof candidate.command !== 'string' || candidate.command.trim().length === 0
    || (candidate.status !== 'passed' && candidate.status !== 'failed')
    || (candidate.output !== undefined && typeof candidate.output !== 'string')) fail(`check needs {"command":"…","status":"passed" | "failed"} and optionally {"output":"…"}; received keys: ${keys}`)
  return { command: candidate.command, status: candidate.status, ...(candidate.output === undefined ? {} : { output: candidate.output }) }
}

function validateSubmission(value: unknown, teamId: string): Submission {
  const candidate = objectRecord(value)
  const artifact = objectRecord(candidate?.artifact)
  if (candidate === undefined || typeof candidate.id !== 'string' || !candidateId(candidate.id) || typeof candidate.taskId !== 'string' || !candidateId(candidate.taskId)
    || typeof candidate.attemptId !== 'string' || !candidateId(candidate.attemptId) || !Number.isInteger(candidate.attemptGeneration) || Number(candidate.attemptGeneration) < 1
    || artifact === undefined || (artifact.type !== 'report' && artifact.type !== 'files') || typeof candidate.summary !== 'string'
    || !Array.isArray(candidate.checks) || !Number.isInteger(candidate.createdAt) || !Number.isInteger(candidate.revision) || Number(candidate.revision) < 1) {
    throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, `invalid submission in ${teamId}`)
  }
  if (artifact.type === 'report' && (typeof artifact.bodyRef !== 'string' || typeof artifact.bodyDigest !== 'string')) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, 'invalid report submission artifact')
  if (artifact.type === 'files' && (!Array.isArray(artifact.paths) || !artifact.paths.every((entry) => typeof entry === 'string') || typeof artifact.manifestDigest !== 'string')) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, 'invalid files submission artifact')
  if (candidate.git !== undefined) {
    const git = objectRecord(candidate.git)
    if (git === undefined || typeof git.baseRef !== 'string' || typeof git.baseTipSha !== 'string' || typeof git.headSha !== 'string'
      || !Array.isArray(git.commitPaths) || !git.commitPaths.every((entry) => typeof entry === 'string')
      || (git.mergeBaseSha !== undefined && typeof git.mergeBaseSha !== 'string')) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, 'invalid Git submission artifact')
  }
  // One vocabulary for every record, old or new: the first parallel run renamed
  // `collision` to `shared-tree` because in a single tree the observation is coexistence,
  // not proof that two attempts met. Records written before the rename still read.
  const scope = objectRecord(candidate.scope)
  const normalizedScope = scope === undefined ? undefined : {
    ...scope,
    state: scope.state === 'collision' ? 'shared-tree' : scope.state,
    ...(scope.sharedTree === undefined && Array.isArray(scope.collision) ? { sharedTree: scope.collision } : {}),
  }
  if (normalizedScope !== undefined) delete (normalizedScope as Record<string, unknown>).collision
  return { ...candidate, ...(normalizedScope === undefined ? {} : { scope: normalizedScope }), artifact: clone(artifact) as SubmissionArtifact, checks: candidate.checks.map(validateCheck) } as unknown as Submission
}

function parseSubmissionsState(value: unknown, teamId: string): SubmissionsState {
  const candidate = objectRecord(value)
  if (candidate === undefined || !Number.isInteger(candidate.schemaVersion) || Number(candidate.schemaVersion) > CURRENT_SCHEMA_VERSION || candidate.teamId !== teamId || !Number.isInteger(candidate.revision) || Number(candidate.revision) < 0 || !Array.isArray(candidate.submissions)) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, 'invalid submissions state')
  return { ...candidate, revision: Number(candidate.revision), submissions: candidate.submissions.map((entry) => validateSubmission(entry, teamId)) } as unknown as SubmissionsState
}

function validateFinding(value: unknown): ReviewFinding {
  const candidate = objectRecord(value)
  const keys = candidate === undefined ? String(value) : Object.keys(candidate).join(', ')
  if (candidate === undefined || !FINDING_SEVERITIES.includes(candidate.severity as ReviewFinding['severity']) || typeof candidate.problem !== 'string' || candidate.problem.trim().length === 0 || typeof candidate.requiredFix !== 'string' || candidate.requiredFix.trim().length === 0 || (candidate.artifactLocation !== undefined && typeof candidate.artifactLocation !== 'string')) {
    fail(`finding needs {"severity":"low" | "medium" | "high" | "blocker","problem":"…","requiredFix":"…"}; received keys: ${keys}`)
  }
  return { severity: candidate.severity as ReviewFinding['severity'], problem: candidate.problem, requiredFix: candidate.requiredFix, ...(candidate.artifactLocation === undefined ? {} : { artifactLocation: candidate.artifactLocation }) }
}

function validateReview(value: unknown, teamId: string): ReviewRound {
  const candidate = objectRecord(value)
  if (candidate === undefined || typeof candidate.id !== 'string' || !candidateId(candidate.id) || typeof candidate.taskId !== 'string' || !candidateId(candidate.taskId) || typeof candidate.submissionId !== 'string' || !candidateId(candidate.submissionId) || typeof candidate.reviewerMemberId !== 'string' || candidate.reviewerMemberId.length === 0 || !Number.isInteger(candidate.round) || Number(candidate.round) < 1 || !REVIEW_VERDICTS.includes(candidate.verdict as ReviewVerdict) || !Array.isArray(candidate.findings) || !Array.isArray(candidate.evidence) || !Number.isInteger(candidate.createdAt) || !Number.isInteger(candidate.revision) || Number(candidate.revision) < 1) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, `invalid review in ${teamId}`)
  return { ...candidate, findings: candidate.findings.map(validateFinding), evidence: candidate.evidence.map(validateCheck) } as unknown as ReviewRound
}

function parseReviewsState(value: unknown, teamId: string): ReviewsState {
  const candidate = objectRecord(value)
  if (candidate === undefined || !Number.isInteger(candidate.schemaVersion) || Number(candidate.schemaVersion) > CURRENT_SCHEMA_VERSION || candidate.teamId !== teamId || !Number.isInteger(candidate.revision) || Number(candidate.revision) < 0 || !Array.isArray(candidate.rounds)) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, 'invalid reviews state')
  return { ...candidate, revision: Number(candidate.revision), rounds: candidate.rounds.map((entry) => validateReview(entry, teamId)) } as unknown as ReviewsState
}

export function routeText(route: TaskRoute | undefined, team: TeamState): string {
  if (route === undefined) return '—'
  if (route.type === 'report') {
    if (route.to === 'human') return 'report → human'
    return `report → ${memberById(team, route.to)?.displayName ?? route.to}`
  }
  if (route.type === 'review') return `review → ${memberById(team, route.reviewer)?.displayName ?? route.reviewer}`
  if (route.type === 'custom') return `custom → ${route.description}`
  return `interactive → ${routeText(route.then, team)}`
}

export function assignmentRouteText(route: TaskRoute | undefined, team: TeamState): string {
  if (route === undefined) return 'not set'
  if (route.type === 'report') return route.to === 'human' ? 'report to the human' : `report to ${memberById(team, route.to)?.displayName ?? route.to}`
  if (route.type === 'review') return `review by ${memberById(team, route.reviewer)?.displayName ?? route.reviewer}, then the result goes to the lead`
  if (route.type === 'custom') return `custom route: ${route.description}`
  return `interactive route, then ${assignmentRouteText(route.then, team)}`
}

export function deriveRouteContacts(task: TeamTask, team: TeamState): string[] {
  if (task.assignee === undefined || task.route === undefined) return []
  if (!['ready', 'claimed', 'in_progress', 'waiting', 'needs_human'].includes(task.status)) return []
  if (task.route.type === 'report') return task.route.to === 'human' ? ['human'] : [task.route.to]
  if (task.route.type === 'review') return [task.assignee, task.route.reviewer]
  if (task.route.type === 'interactive') {
    const nested = { ...task, route: task.route.then }
    return deriveRouteContacts(nested, team)
  }
  return []
}

/**
 * Who a member may address, from one rule.
 *
 * Three places need this answer: the mailbox decides whether to deliver, the injected context tells
 * the member who it may talk to, and the panel shows the same list. Each had its own copy, and the
 * panel's was the narrowest — it showed the lead "contact with colleagues is not allowed" while the
 * mailbox was happily delivering the lead's messages to everyone (found on a real stand).
 *
 * The rule itself: the lead may address every member; anyone else may address the lead, whoever a
 * grant names, and whoever an active task's route opens — the same set the mailbox enforces.
 */
export function permittedContacts(state: TeamState, memberId: string, tasks: readonly TeamTask[]): string[] {
  const leadId = resolveLeadMemberId(state)
  const others = state.members.map((member) => member.memberId).filter((id) => id !== memberId)
  if (leadId !== undefined && memberId === leadId) return [...others, 'team', 'human']
  const grants = (state.contactGrants ?? []).filter((grant) => grant.from === memberId).map((grant) => grant.to)
  const derived = others.filter((target) => tasks.some((task) => routeAllowsContact(task, memberId, target, state)))
  const human = tasks.some((task) => routeAllowsContact(task, memberId, 'human', state)) ? ['human'] : []
  const allowed = new Set<string>([...(leadId === undefined ? [] : [leadId]), ...grants, ...derived, ...human])
  allowed.delete(memberId)
  return [...allowed]
}

export function routeAllowsContact(task: TeamTask, from: string, to: string, team: TeamState): boolean {
  if (task.assignee === undefined || task.route === undefined || !['ready', 'claimed', 'in_progress', 'waiting', 'needs_human'].includes(task.status)) return false
  if (task.route.type === 'report') return from === task.assignee && task.route.to === to
  if (task.route.type === 'review') return (from === task.assignee && to === task.route.reviewer) || (from === task.route.reviewer && to === task.assignee)
  if (task.route.type === 'interactive') return routeAllowsContact({ ...task, route: task.route.then }, from, to, team)
  return false
}

export function taskDocumentPath(workspacePath: string, teamId: string, taskId: string): string {
  return path.join(path.resolve(workspacePath), '.dsh-live-teams', 'teams', teamId, 'tasks', `${taskId}.md`)
}

function renderDocument(task: TeamTask, team: TeamState, fields: { why?: string; checks?: readonly string[]; body?: string; tasks?: readonly TeamTask[] } = {}): string {
  const why = fields.why ?? task.why
  const body = fields.body ?? task.body
  const taskChecks = fields.checks ?? task.checks ?? []
  const assignee = task.assignee === undefined ? '—' : `${memberById(team, task.assignee)?.displayName ?? task.assignee} (${task.assignee})`
  const checks = taskChecks.length === 0 ? '- —' : taskChecks.map((check) => `- \`${check}\``).join('\n')
  const acceptance = task.acceptance.length === 0 ? '- —' : task.acceptance.map((criterion) => `- ${criterion}`).join('\n')
  // The document is the contract a member reads, so a dependency it must wait for
  // belongs in it — naming the blocking task, not only its id.
  const tasks = fields.tasks ?? []
  const dependsOn = (task.dependsOn ?? []).length === 0
    ? ''
    : `\n\n## Depends on\n${(task.dependsOn ?? []).map((id) => {
        const dependency = tasks.find((entry) => entry.id === id)
        return `- ${id}${dependency === undefined ? '' : ` — ${dependency.title} (${dependency.status})`}`
      }).join('\n')}`
  // What the task may touch is part of the contract the member reads, not only a rule
  // the dispatcher applies: a declaration nobody can see cannot guide the work (B30).
  const paths = (task.paths ?? []).length === 0
    ? ''
    : `\n\n## Paths\nStay inside these; anything else is outside this task's scope.\n${(task.paths ?? []).map((entry) => `- \`${entry}\``).join('\n')}`
  return `# ${task.title}\n\n- **Task:** ${task.id}\n- **Kind:** ${task.kind}\n- **Assignee:** ${assignee}\n- **Route:** ${routeText(task.route, team)}\n- **Round limit:** ${task.roundLimit}\n\n## Why\n${why === undefined || why.trim().length === 0 ? '—' : why}\n\n## What to do\n${body === undefined || body.length === 0 ? '—' : body}${dependsOn}${paths}\n\n## Checks\n${checks}\n\n## Acceptance\n${acceptance}\n\n## Finish\nRun the checks. Report to your lead, or submit for review, according to the route.\nA task without a route is a defect: ask your lead rather than choosing one.\n`
}

export class TaskStore {
  private readonly location: TaskLocation
  private readonly workspacePath: string
  private readonly appendAudit: (event: unknown) => Promise<void>
  private readonly deliverEscalation?: TaskStoreOptions['deliverEscalation']
  private readonly deliverClosing?: TaskStoreOptions['deliverClosing']
  private readonly deliverReviewRequest?: TaskStoreOptions['deliverReviewRequest']
  private readonly deliverSubmissionNotice?: TaskStoreOptions['deliverSubmissionNotice']
  private readonly deliverLifecycleNotice?: TaskStoreOptions['deliverLifecycleNotice']
  private lifecycleCursor = 0
  private submissionNoticeCursor = 0
  private readonly deliverCancellation?: TaskStoreOptions['deliverCancellation']
  private readonly deliverDirection?: TaskStoreOptions['deliverDirection']
  private readonly deliverReviewReturn?: TaskStoreOptions['deliverReviewReturn']
  private readonly observeReviewReturn?: TaskStoreOptions['observeReviewReturn']
  private readonly notifyReviewReturn?: TaskStoreOptions['notifyReviewReturn']
  private readonly reviewReturnRuns = new Map<string, Promise<void>>()
  private reviewReturnCursor = 0
  private readonly interruptSession?: TaskStoreOptions['interruptSession']
  private readonly awaitQuiescence?: TaskStoreOptions['awaitQuiescence']
  private readonly quiescenceTimeoutMs: number
  private readonly changedPaths: TaskStoreOptions['changedPaths']
  private readonly committedPaths: TaskStoreOptions['committedPaths']
  private readonly git: TaskStoreOptions['git']
  private readonly migrations: Readonly<Record<number, Migration>>
  private readonly workspaceMode: TaskStoreOptions['workspaceMode']
  private readonly snapshotTree: TaskStoreOptions['snapshotTree']
  /** `null` means "no port": the answer is cached because a store lives with one workspace. */
  private resolvedMode: 'git' | 'files' | null | undefined

  constructor(options: TaskStoreOptions) {
    this.deliverEscalation = options.deliverEscalation
    this.deliverClosing = options.deliverClosing
    this.deliverReviewRequest = options.deliverReviewRequest
    this.deliverSubmissionNotice = options.deliverSubmissionNotice
    this.deliverLifecycleNotice = options.deliverLifecycleNotice
    this.deliverCancellation = options.deliverCancellation
    this.deliverDirection = options.deliverDirection
    this.deliverReviewReturn = options.deliverReviewReturn
    this.observeReviewReturn = options.observeReviewReturn
    this.notifyReviewReturn = options.notifyReviewReturn
    this.interruptSession = options.interruptSession
    this.awaitQuiescence = options.awaitQuiescence
    this.quiescenceTimeoutMs = options.quiescenceTimeoutMs ?? 5000
    this.changedPaths = options.changedPaths
    this.committedPaths = options.committedPaths
    this.git = options.git
    this.migrations = options.migrations ?? MIGRATIONS
    this.workspaceMode = options.workspaceMode
    this.snapshotTree = options.snapshotTree
    const workspacePath = path.resolve(options.workspacePath)
    this.workspacePath = workspacePath
    const directory = path.join(workspacePath, '.dsh-live-teams', 'teams', options.teamId)
    this.location = { directory, file: path.join(directory, 'tasks.json'), attemptsFile: path.join(directory, 'attempts.json'), submissionsFile: path.join(directory, 'submissions.json'), reviewsFile: path.join(directory, 'reviews.json'), teamFile: path.join(directory, 'team.json'), tasksDirectory: path.join(directory, 'tasks'), archiveDirectory: path.join(directory, 'archive'), snapshotsDirectory: path.join(directory, 'snapshots'), blobsDirectory: path.join(directory, 'artifacts', 'blobs') }
    this.appendAudit = options.appendAudit ?? (async () => undefined)
  }

  get filePath(): string { return this.location.file }
  get directoryPath(): string { return this.location.directory }

  async open(): Promise<TasksState> {
    return withProcessLock(this.location.teamFile, async () => this.readOrCreateLocked())
  }

  async listTasks(options: ListTasksOptions | boolean = {}): Promise<TeamTask[]> {
    const includeArchived = typeof options === 'boolean' ? options : options.includeArchived === true
    return clone(await withProcessLock(this.location.teamFile, async () => {
      const state = await this.readOrCreateLocked()
      const reviews = await this.readReviewsIfPresentLocked()
      const latestRound = new Map<string, number>()
      for (const round of reviews.rounds) {
        const prior = latestRound.get(round.taskId)
        if (prior === undefined || round.round > prior) latestRound.set(round.taskId, round.round)
      }
      const visible = includeArchived ? state.tasks : state.tasks.filter((task) => task.archivedPath === undefined)
      const projected = await Promise.all(visible.map(async (task) => {
        const round = latestRound.get(task.id)
        const withRound = round === undefined ? task : { ...task, round }
        const documentPath = task.archivedPath === undefined ? this.documentPath(task.id) : this.archivedPathOf(task.archivedPath)
        return (await fileExists(documentPath)) ? withRound : { ...withRound, documentMissing: true }
      }))
      return projected.sort((left, right) => right.updatedAt - left.updatedAt || right.createdAt - left.createdAt || right.revision - left.revision || left.id.localeCompare(right.id)).slice(0, MAX_TASKS)
    }))
  }

  async readTask(taskId: string): Promise<ReadTaskResult> {
    if (!candidateId(taskId)) fail('invalid task id')
    return withProcessLock(this.location.teamFile, async () => {
      const state = await this.readOrCreateLocked()
      const task = state.tasks.find((entry) => entry.id === taskId)
      if (task === undefined) fail(`task not found: ${taskId}`)
      const driftOf = async (submission: Submission): Promise<SubmissionDrift[]> => {
        const artifact = submission.artifact
        const checks: { path: string; expected: string }[] = artifact.type === 'report'
          ? [{ path: artifact.bodyRef, expected: artifact.bodyDigest }]
          : (artifact.blobs ?? []).map((blob) => ({ path: blob.path, expected: blob.digest }))
        const drift: SubmissionDrift[] = []
        for (const entry of checks) {
          const absolute = path.resolve(this.workspacePath, entry.path)
          let bytes: Buffer | undefined
          try { bytes = await fs.readFile(absolute) } catch { bytes = undefined }
          const actual = bytes === undefined ? null : createHash('sha256').update(bytes).digest('hex')
          if (actual !== entry.expected) drift.push({ path: entry.path, expected: entry.expected, actual })
        }
        return drift
      }
      const documentPath = task.archivedPath === undefined ? this.documentPath(taskId) : this.archivedPathOf(task.archivedPath)
      let document: string
      try { document = await fs.readFile(documentPath, 'utf8') } catch (error) {
        throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `task ${taskId} document is missing at ${documentPath}; ask the lead to restore the task document`, { cause: error })
      }
      const submissions = await Promise.all((await this.readSubmissionsIfPresentLocked()).submissions
        .filter((entry) => entry.taskId === taskId)
        .map(async (submission) => {
          const drift = await driftOf(submission)
          return drift.length === 0 ? submission : { ...submission, drift }
        }))
      const rounds = (await this.readReviewsIfPresentLocked()).rounds.filter((entry) => entry.taskId === taskId)
      const attempts = (await this.readAttemptsIfPresentLocked()).attempts.filter((entry) => entry.taskId === taskId)
      return { task: clone(task), document, submissions: clone(submissions), rounds: clone(rounds), attempts: clone(attempts) }
    })
  }

  async readAttempts(): Promise<AttemptsState> {
    return withProcessLock(this.location.teamFile, async () => this.readAttemptsIfPresentLocked())
  }

  async readSubmissions(): Promise<SubmissionsState> {
    return withProcessLock(this.location.teamFile, async () => this.readSubmissionsIfPresentLocked())
  }

  async readReviews(): Promise<ReviewsState> {
    return withProcessLock(this.location.teamFile, async () => this.readReviewsIfPresentLocked())
  }

  private ownedTaskForMember(tasks: readonly TeamTask[], attempts: readonly TaskAttempt[], memberId: string): TeamTask | undefined {
    // Assignment is a capability held by a current attempt, not merely a name on queued work.
    // A newer ready task must never displace the task this member is actually working on.
    const owned = tasks.filter((task) => task.assignee === memberId
      && task.archivedPath === undefined
      && ['claimed', 'in_progress', 'waiting', 'needs_human'].includes(task.status)
      && attempts.some((attempt) => attempt.id === task.activeAttemptId && attempt.taskId === task.id
        && attempt.memberId === memberId && (attempt.status === 'active' || attempt.status === 'revoking')))
    owned.sort((left, right) => right.updatedAt - left.updatedAt || left.id.localeCompare(right.id))
    return owned[0] === undefined ? undefined : clone(owned[0])
  }

  async activeTaskForMember(memberId: string): Promise<TeamTask | undefined> {
    return withProcessLock(this.location.teamFile, async () => {
      const state = await this.readTasksIfPresentLocked()
      const attempts = await this.readAttemptsIfPresentLocked()
      return this.ownedTaskForMember(state.tasks, attempts.attempts, memberId)
    })
  }

  activeTaskForMemberSync(memberId: string): TeamTask | undefined {
    try {
      const state = parseTasksState(JSON.parse(readFileSync(this.location.file, 'utf8')) as unknown, this.teamId, this.location.archiveDirectory)
      const attempts = parseAttemptsState(JSON.parse(readFileSync(this.location.attemptsFile, 'utf8')) as unknown, this.teamId)
      return this.ownedTaskForMember(state.tasks, attempts.attempts, memberId)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
      throw error
    }
  }

  /**
   * The latest attempt of one task, read synchronously for context assembly: the member
   * has to know that a human wrote into its Session mid-flight (B31).
   */
  latestAttemptForTaskSync(taskId: string): TaskAttempt | undefined {
    try {
      const state = parseAttemptsState(JSON.parse(readFileSync(this.location.attemptsFile, 'utf8')) as unknown, this.teamId)
      const attempts = state.attempts.filter((attempt) => attempt.taskId === taskId)
      attempts.sort((left, right) => right.generation - left.generation)
      return attempts[0] === undefined ? undefined : clone(attempts[0])
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
      throw error
    }
  }

  /**
   * Every task, read synchronously for context assembly. The authorization gate
   * scans all tasks — a reviewer holds a path to a task it is not the assignee of —
   * so the line a member reads about where it may send has to see the same set.
   */
  listTasksSync(): TeamTask[] {
    try {
      const state = parseTasksState(JSON.parse(readFileSync(this.location.file, 'utf8')) as unknown, this.teamId, this.location.archiveDirectory)
      return clone(state.tasks.filter((task) => task.archivedPath === undefined))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }
  }

  /**
   * Close attempts whose task has already ended (F5 of the first live run).
   *
   * Both acceptance paths are supposed to close the attempt, but "supposed to" is how
   * the member stayed busy forever: a stale active attempt blocks every later task for
   * that member and keeps the intervention observer watching a finished Session. This
   * heals the class rather than the instance — a task in a terminal status cannot have
   * work in flight.
   */
  async closeTerminalAttempts(): Promise<{ closed: { attemptId: string; taskId: string; memberId: string; status: 'completed' | 'failed' }[] }> {
    return await withProcessLock(this.location.teamFile, async () => {
      const attempts = await this.readAttemptsIfPresentLocked()
      const tasks = await this.readTasksIfPresentLocked()
      const terminal = new Map(tasks.tasks.filter((task) => task.status === 'completed' || task.status === 'cancelled' || task.status === 'failed').map((task) => [task.id, task.status]))
      const stale = attempts.attempts.filter((attempt) => attempt.status === 'active' && terminal.has(attempt.taskId))
      if (stale.length === 0) return { closed: [] }
      const closed = stale.map((attempt) => ({ attemptId: attempt.id, taskId: attempt.taskId, memberId: attempt.memberId, status: (terminal.get(attempt.taskId) === 'completed' ? 'completed' : 'failed') as 'completed' | 'failed' }))
      const byId = new Map(closed.map((entry) => [entry.attemptId, entry.status]))
      const nextAttempts: AttemptsState = { ...attempts, schemaVersion: CURRENT_SCHEMA_VERSION, revision: attempts.revision + 1, attempts: attempts.attempts.map((attempt) => byId.has(attempt.id) ? { ...attempt, status: byId.get(attempt.id) as 'completed' | 'failed', revision: attempt.revision + 1 } : attempt) }
      await atomicWriteJson(this.location.attemptsFile, nextAttempts)
      for (const entry of closed) await this.appendAudit({ kind: 'attempt/closed-stale', taskId: entry.taskId, attemptId: entry.attemptId, memberId: entry.memberId, status: entry.status, actor: 'reconciler', at: Date.now(), revision: nextAttempts.revision })
      return { closed }
    })
  }

  /**
   * Record that a human wrote into this member's Session mid-attempt (B31). Idempotent:
   * the first observation wins, and the task revision at that moment is stored so that a
   * later formal restatement of the contract resolves the mark without a second write.
   */
  async markHumanIntervention(attemptId: string, at: number): Promise<{ attempt: TaskAttempt; changed: boolean }> {
    if (!candidateId(attemptId) || !Number.isInteger(at)) fail('invalid human intervention request')
    return await withProcessLock(this.location.teamFile, async () => {
      const attempts = await this.readAttemptsIfPresentLocked()
      const index = attempts.attempts.findIndex((entry) => entry.id === attemptId)
      if (index < 0) fail(`unknown attempt: ${attemptId}`)
      const current = attempts.attempts[index] as TaskAttempt
      if (current.humanIntervenedAt !== undefined) return { attempt: clone(current), changed: false }
      const contractRevision = await this.contractRevisionLocked(current.taskId)
      const next: TaskAttempt = { ...current, humanIntervenedAt: at, ...(contractRevision === undefined ? {} : { humanIntervenedContractRevision: contractRevision }), revision: current.revision + 1 }
      const nextAttempts: AttemptsState = { ...attempts, revision: attempts.revision + 1, attempts: attempts.attempts.map((entry) => entry.id === attemptId ? next : entry) }
      await atomicWriteJson(this.location.attemptsFile, nextAttempts)
      await this.appendAudit({ kind: 'attempt/human-intervened', taskId: current.taskId, attemptId, memberId: current.memberId, at, actor: 'reconciler', revision: nextAttempts.revision })
      return { attempt: clone(next), changed: true }
    })
  }

  private async contractRevisionLocked(taskId: string): Promise<number | undefined> {
    const tasks = await this.readTasksIfPresentLocked()
    const task = tasks.tasks.find((entry) => entry.id === taskId)
    return task === undefined ? undefined : task.contractRevision ?? 0
  }

  async submitTask(request: SubmitTaskRequest): Promise<{ submission: Submission; notifications: SubmissionNotificationReceipt[] }> {
    if (!candidateId(request.taskId) || request.memberId.length === 0 || request.sessionId.length === 0 || !Number.isInteger(request.bindingGeneration)) fail('invalid submission request')
    if (typeof request.summary !== 'string' || request.summary.trim().length === 0) fail('submission summary must be non-empty')
    let handoff: { reviewer: string; assignee: string; taskId: string; submissionId: string; summary: string } | undefined
    const result = await withProcessLock(this.location.teamFile, async () => {
      const tasks = await this.readTasksIfPresentLocked()
      const task = tasks.tasks.find((entry) => entry.id === request.taskId)
      if (task === undefined) fail(`task not found: ${request.taskId}`)
      if (task.assignee !== request.memberId) fail('only the task assignee may submit work')
      if (task.status !== 'claimed' && task.status !== 'in_progress') fail(`task is not claimable for submission; current status is ${task.status}`)
      const attempts = await this.readAttemptsIfPresentLocked()
      const attempt = task.activeAttemptId === undefined ? undefined : attempts.attempts.find((entry) => entry.id === task.activeAttemptId && entry.status === 'active')
      if (attempt === undefined || attempt.memberId !== request.memberId || attempt.sessionId !== request.sessionId || attempt.bindingGeneration !== request.bindingGeneration) fail('submission requires the active attempt binding')
      const artifact = await this.freezeArtifact(request.artifact)
      const submissions = await this.readSubmissionsIfPresentLocked()
      // Convergence: a re-submission that is byte-identical to the one the reviewer just sent back
      // burns a round without changing anything the reviewer can judge. The digest is already there;
      // comparing it is what turns a silent loop into a refusal that says what to do instead
      // (external review, finding 5).
      const previous = submissions.submissions.filter((entry) => entry.taskId === task.id).sort((left, right) => left.createdAt - right.createdAt).at(-1)
      const lastRound = (await this.readReviewsIfPresentLocked()).rounds.filter((entry) => entry.taskId === task.id).sort((left, right) => left.round - right.round).at(-1)
      if (previous !== undefined && lastRound?.verdict === 'needs_revision') {
        const sameArtifact = previous.artifact.type === 'report' && artifact.type === 'report'
          ? previous.artifact.bodyDigest === artifact.bodyDigest
          : previous.artifact.type === 'files' && artifact.type === 'files'
            ? previous.artifact.manifestDigest === artifact.manifestDigest
            : false
        if (sameArtifact) fail('this submission is identical to the one the reviewer sent back; change something and say what, or escalate to the lead instead of spending another round')
      }
      const now = Date.now()
      const scope = await this.checkScope(task, tasks.tasks, attempts.attempts, artifact, attempt)
      // Phase 6: the reviewed artifact is a commit the plugin builds. Which paths it contains does
      // not depend on the shape of the member's report: a coding submission that arrives as a
      // report still has a diff, and it is the set the member changed *inside its declaration*.
      // Discovered by the fourth live run, where every coding submission was a report and the Git
      // half of the review therefore never happened.
      let git: SubmissionGit | undefined
      if (this.git !== undefined && await this.mode() === 'git' && CODING_KINDS.has(task.kind)) {
        if (attempt.gitBase === undefined) fail('the attempt has no recorded Git base; the submission cannot be frozen for review')
        // The paths this commit will contain. For a files artifact they are what the member named;
        // for a report they are what it actually changed inside its declaration. Only these paths
        // are replaced in the tree, which is exactly why the refresh check below is about them.
        const commitPaths = artifact.type === 'files' ? artifact.paths : (scope?.changed ?? []).filter((entry) => !(scope?.unexpected ?? []).includes(entry))
        // Say what to do, not only what is wrong: a member that committed its work has a clean tree,
        // and a report carries no paths, so the message has to name the way out. On a real stand a
        // Builder read the plugin's source to find it.
        if (commitPaths.length === 0) fail('nothing changed under the declaration and the submission names no files; there is nothing to review. If you committed your work, submit it as a file artifact naming those files ({"type":"files","paths":["…"]}) — a report carries no paths, so a clean tree leaves nothing behind')
        // The base recorded at claim time can already have moved by the time the work is frozen —
        // the fourth live round lost a task to a sibling's integration landing 1.1 seconds before the
        // submission. When the movement cannot touch this work, the commit is parented on the base
        // as it is *now*: the reviewer then judges the commit that would actually land, and the
        // acceptance precondition still guards everything that happens after this moment. When the
        // movement overlaps the declared paths, nothing is written and a human has to re-plan.
        let base = { ref: attempt.gitBase.ref, sha: attempt.gitBase.baseTipSha }
        let rebasedFrom: string | undefined
        const tip = await this.git.tip(this.workspacePath, base.ref).catch(() => undefined)
        if (tip !== undefined && tip !== base.sha) {
          const moved = await this.git.changedBetween(this.workspacePath, base.sha, tip).catch(() => undefined)
          const overlaps = moved === undefined || moved.some((entry) => {
            const path = normalizeScopePath(entry) ?? entry
            return commitPaths.some((target) => scopesIntersect(literalPrefix(target), path))
          })
          if (overlaps) fail(`the base moved since this attempt started (${base.ref} is at ${tip}, the attempt began at ${base.sha}) and the commits in between touch the same paths; ask the lead to re-plan this task rather than review work that cannot land`)
          rebasedFrom = base.sha
          base = { ref: base.ref, sha: tip }
        }
        const member = (await this.readTeamLocked()).members.find((entry) => entry.memberId === attempt.memberId)
        const message = [
          `${task.id}: ${task.title}`,
          '',
          request.summary.trim(),
          '',
          `Attempt: ${attempt.id} (generation ${attempt.generation})`,
          `Member: ${attempt.memberId}`,
        ].join('\n')
        const built = await this.git.commit(this.workspacePath, base, {
          paths: commitPaths,
          message,
          author: { name: member?.displayName ?? attempt.memberId, email: `${attempt.memberId}@live-teams.local` },
        })
        // A submission whose evidence could not be built is refused, not recorded without it.
        if (built === undefined) fail('the changed paths could not be frozen into a commit; nothing was recorded')
        git = {
          baseRef: base.ref,
          baseTipSha: base.sha,
          ...(rebasedFrom === undefined ? {} : { rebasedFrom }),
          headSha: built.headSha,
          commitPaths: [...built.commitPaths],
          ...(built.mergeBaseSha === undefined ? {} : { mergeBaseSha: built.mergeBaseSha }),
        }
        // Mandatory: a commit reachable only by sha can be taken by `git gc`, after which a late
        // acceptance reports a stale base for a reason nobody can see.
        const pinned = await this.git.pin(this.workspacePath, `refs/live-teams/${task.id}/${submissionGitRefSuffix(attempt.generation, git.headSha)}`, git.headSha).catch(() => false)
        if (!pinned) fail('the reviewed commit could not be pinned in the repository; nothing was recorded')
      }
      if (git !== undefined && scope !== undefined) scope.committed = [...git.commitPaths]
      const submission: Submission = { id: `submission-${randomUUID()}`, taskId: task.id, attemptId: attempt.id, attemptGeneration: attempt.generation, artifact, ...(git === undefined ? {} : { git }), summary: request.summary, checks: request.checks.map(validateCheck), ...(scope === undefined ? {} : { scope }), createdAt: now, revision: submissions.revision + 1 }
      const nextSubmissions: SubmissionsState = { ...submissions, schemaVersion: CURRENT_SCHEMA_VERSION, revision: submissions.revision + 1, submissions: [...submissions.submissions, submission] }
      const nextTask: TeamTask = { ...task, latestSubmissionId: submission.id, submissionNoticeId: submission.id, ...(task.reviewReturn === undefined ? {} : { reviewReturn: { ...task.reviewReturn, state: 'superseded', reason: 'new-submission', leadNotified: false } }), awaitsDecision: true, ...(task.route?.type === 'report' ? { status: 'waiting' as const } : {}), updatedAt: now, revision: task.revision + 1 }
      const nextTasks: TasksState = { ...tasks, revision: tasks.revision + 1, tasks: tasks.tasks.map((entry) => entry.id === task.id ? nextTask : entry) }
      await atomicWriteJson(this.location.submissionsFile, nextSubmissions)
      try { await atomicWriteJson(this.location.file, nextTasks) } catch (error) { await atomicWriteJson(this.location.submissionsFile, submissions); throw error }
      await this.appendAudit({ kind: 'submission/created', taskId: task.id, submissionId: submission.id, attemptId: attempt.id, actor: request.memberId, at: now, revision: nextSubmissions.revision })
      if (scope?.state === 'violation') {
        await this.appendAudit({ kind: 'submission/scope-violation', taskId: task.id, submissionId: submission.id, attemptId: attempt.id, declared: scope.declared, unexpected: scope.unexpected ?? [], actor: request.memberId, at: now, revision: submissions.revision + 1 })
      }
      // A shared-tree change is the loud case: the tree moved outside this
      // violation, and it is the one a human has to look at.
      if (scope?.state === 'shared-tree') {
        await this.appendAudit({ kind: 'submission/scope-shared-tree', taskId: task.id, submissionId: submission.id, attemptId: attempt.id, declared: scope.declared, unexpected: scope.unexpected ?? [], sharedTree: scope.sharedTree ?? [], actor: request.memberId, at: now, revision: submissions.revision + 1 })
      }
      // Collected here, delivered after the lock: the mailbox takes its own locks, and calling it
      // from inside this one deadlocks the whole store. The acceptance path does the same.
      handoff = task.route !== undefined && task.route.type === 'review'
        ? { reviewer: task.route.reviewer, assignee: request.memberId, taskId: task.id, submissionId: submission.id, summary: submission.summary }
        : undefined
      return { submission: clone(submission) }
    })
    if (this.deliverSubmissionNotice === undefined && handoff !== undefined) {
      // Legacy ports return no receipt: never pretend their best-effort callback proves admission.
      try { await this.deliverReviewRequest?.(handoff) } catch { /* explicit unavailable receipt below */ }
    }
    return { ...result, notifications: await this.processSubmissionNotification(request.taskId) }
  }

  private async lifecycleSnapshot(taskId: string, intentId: string) {
    return withProcessLock(this.location.teamFile, async () => {
      if (await fileExists(path.join(this.location.directory, 'disabled'))) return undefined
      const task = (await this.readTasksIfPresentLocked()).tasks.find(entry => entry.id === taskId)
      const intent = task?.lifecycleNotices?.find(entry => entry.id === intentId)
      if (task === undefined || intent === undefined || task.contractRevision !== intent.contractRevision) return undefined
      const team = await this.readTeamLocked()
      let recipient = intent.assignee
      let authorBinding: { sessionId: string; bindingGeneration: number } | undefined
      let detail = ''
      if (intent.kind === 'review-verdict') {
        const rounds = (await this.readReviewsIfPresentLocked()).rounds.filter(entry => entry.taskId === taskId).sort((a, b) => a.round - b.round)
        const round = rounds.at(-1)
        if (round === undefined || round.id !== intent.roundId || round.submissionId !== intent.submissionId || task.latestSubmissionId !== intent.submissionId || !['pass', 'escalate'].includes(round.verdict) || round.verdict === 'pass' && (task.status !== 'completed' || task.acceptedSubmissionId !== intent.submissionId) || round.verdict === 'escalate' && !['waiting', 'needs_human'].includes(task.status)) return undefined
        recipient = resolveLeadMemberId(team)
        detail = `Формальный вердикт: ${round.verdict.toUpperCase()}, раунд ${round.round} (${round.id}).\nSubmission: ${round.submissionId}.\n${round.verdict === 'pass' ? 'Работа уже принята по PASS и задача завершена; повторная приёмка не требуется.' : 'Reviewer запросил решение Lead; прочитай формальные findings перед решением.'}\nЗамечаний: ${round.findings.length}. Полные findings и evidence — в формальном вердикте.`
      } else if (intent.kind === 'acceptance') {
        if (task.status !== 'completed' || task.acceptedSubmissionId !== intent.submissionId) return undefined
        detail = `Сдача ${intent.submissionId} принята; задача завершена.${intent.text ? `\nПримечание Lead: ${intent.text}` : ''}\nЭто закрытие только указанной задачи; не останавливай и не возобновляй другие назначения.`
      } else if (intent.kind === 'cancellation') {
        if (task.status !== 'cancelled') return undefined
        detail = `Задача отменена без приёмки. Причина: ${intent.text}\nЭто закрытие только указанной задачи; не останавливай другие назначения.`
      } else {
        const attempt = (await this.readAttemptsIfPresentLocked()).attempts.find(entry => entry.id === task.activeAttemptId)
        if (task.status !== 'in_progress' || task.awaitsDecision === true || task.activeAttemptId !== intent.attemptId || attempt?.status !== 'active' || attempt.memberId !== intent.assignee || task.assignee !== intent.assignee) return undefined
        authorBinding = { sessionId: attempt.sessionId, bindingGeneration: attempt.bindingGeneration }
        detail = `Указание Lead: ${intent.text}\nПродолжай только если актуальны попытка ${intent.attemptId} и contractRevision ${intent.contractRevision}; не меняй контракт самостоятельно.`
      }
      const member = recipient === undefined ? undefined : memberById(team, recipient)
      if (authorBinding !== undefined && member?.sessionId !== undefined && (member.sessionId !== authorBinding.sessionId || member.bindingGeneration !== authorBinding.bindingGeneration)) return undefined
      const content = `Событие задачи: ${task.title} (${taskId}).\n${detail}\nСначала проверь актуальную задачу, последнюю сдачу и формальные решения через live_team_read_task. Устаревшее уведомление не является новым поручением. Подтверждать получение или повторять evidence сообщением не требуется.`
      return { taskId, intent, recipient, sessionId: member?.sessionId, bindingGeneration: member?.bindingGeneration, content }
    })
  }

  async isLifecycleNoticeCurrent(fence: LifecycleNoticeFence): Promise<boolean> {
    const snapshot = await this.lifecycleSnapshot(fence.taskId, fence.intentId)
    return snapshot !== undefined && snapshot.recipient === fence.recipient && snapshot.sessionId === fence.sessionId && snapshot.bindingGeneration === fence.bindingGeneration
  }

  private async processLifecycleNotification(taskId: string, intentId: string, kind: LifecycleNoticeIntent['kind']): Promise<SubmissionNotificationReceipt> {
    const snapshot = await this.lifecycleSnapshot(taskId, intentId)
    if (snapshot === undefined) return { purpose: kind, state: 'superseded', reason: 'lifecycle-action-no-longer-current' }
    const { recipient, sessionId, bindingGeneration, intent } = snapshot
    const base = { purpose: intent.kind, ...(recipient === undefined ? {} : { recipient }) }
    if (recipient === undefined || sessionId === undefined || bindingGeneration === undefined || this.deliverLifecycleNotice === undefined) return { ...base, state: 'unavailable', reason: recipient === undefined ? 'recipient-unavailable' : sessionId === undefined || bindingGeneration === undefined ? 'binding-unavailable' : 'notification-port-unavailable' }
    const fence: LifecycleNoticeFence = { taskId, intentId, recipient, sessionId, bindingGeneration }
    try {
      const receipt = await this.deliverLifecycleNotice({ ...snapshot, recipient, sessionId, bindingGeneration, stillCurrent: async () => this.isLifecycleNoticeCurrent(fence) })
      if (receipt.recipient !== recipient || receipt.purpose !== intent.kind || !['queued', 'pending', 'failed', 'unavailable', 'superseded'].includes(receipt.state) || receipt.state === 'queued' && (!receipt.messageId || !receipt.requestId)) return { ...base, state: 'failed', reason: 'invalid-notification-receipt' }
      return receipt
    } catch { return await this.isLifecycleNoticeCurrent(fence) ? { ...base, state: 'failed', reason: 'notification-error' } : { ...base, state: 'superseded', reason: 'lifecycle-action-no-longer-current' } }
  }

  async processLifecycleNotifications(taskId: string, kind: LifecycleNoticeIntent['kind']): Promise<SubmissionNotificationReceipt[]> {
    const intents = await withProcessLock(this.location.teamFile, async () => (await this.readTasksIfPresentLocked()).tasks.find(task => task.id === taskId)?.lifecycleNotices?.filter(intent => intent.kind === kind) ?? [])
    return Promise.all(intents.map(intent => this.processLifecycleNotification(taskId, intent.id, intent.kind)))
  }

  async recoverLifecycleNotifications(limit = 8): Promise<void> {
    if (this.deliverLifecycleNotice === undefined) return
    const candidates = await withProcessLock(this.location.teamFile, async () => (await this.readTasksIfPresentLocked()).tasks.flatMap(task => (task.lifecycleNotices ?? []).map(intent => ({ taskId: task.id, intentId: intent.id, kind: intent.kind }))))
    const count = Math.min(candidates.length, Math.max(1, limit))
    for (let i = 0; i < count; i++) { const next = candidates[(this.lifecycleCursor + i) % candidates.length]!; await this.processLifecycleNotification(next.taskId, next.intentId, next.kind) }
    this.lifecycleCursor = candidates.length === 0 ? 0 : (this.lifecycleCursor + count) % candidates.length
  }

  async requestReviewNotification(taskId: string, roundId: string, actor: string): Promise<SubmissionNotificationReceipt[]> {
    await withProcessLock(this.location.teamFile, async () => {
      const team = await this.readTeamLocked()
      if (!isLeadOrHuman(team, actor)) fail('only the lead or human may request a verdict handoff')
      const tasks = await this.readTasksIfPresentLocked()
      const task = tasks.tasks.find(entry => entry.id === taskId)
      const round = (await this.readReviewsIfPresentLocked()).rounds.filter(entry => entry.taskId === taskId).sort((a, b) => a.round - b.round).at(-1)
      if (task === undefined || round?.id !== roundId || task.latestSubmissionId !== round.submissionId || !['pass', 'escalate'].includes(round.verdict) || round.verdict === 'pass' && (task.status !== 'completed' || task.acceptedSubmissionId !== round.submissionId) || round.verdict === 'escalate' && !['waiting', 'needs_human'].includes(task.status)) fail('verdict no longer matches current task outcome')
      if (task.lifecycleNotices?.some(intent => intent.kind === 'review-verdict' && intent.roundId === roundId)) return
      const next = withLifecycleIntent(task, lifecycleIntent('review-verdict', task.contractRevision ?? 0, { roundId, submissionId: round.submissionId }))
      await atomicWriteJson(this.location.file, { ...tasks, revision: tasks.revision + 1, tasks: tasks.tasks.map(entry => entry.id === taskId ? { ...next, revision: task.revision + 1, updatedAt: Date.now() } : entry) })
      await this.appendAudit({ kind: 'review/notification-requested', taskId, roundId, actor, at: Date.now() })
    })
    return this.processLifecycleNotifications(taskId, 'review-verdict')
  }

  private async submissionNotificationSnapshot(taskId: string) {
    return withProcessLock(this.location.teamFile, async () => {
      if (await fileExists(path.join(this.location.directory, 'disabled'))) return undefined
      const task = (await this.readTasksIfPresentLocked()).tasks.find(entry => entry.id === taskId)
      if (!submissionAwaitsDecision(task) || task.submissionNoticeId === undefined || task.submissionNoticeId !== task.latestSubmissionId || task.route === undefined) return undefined
      const submission = (await this.readSubmissionsIfPresentLocked()).submissions.find(entry => entry.id === task.submissionNoticeId && entry.taskId === task.id)
      if (submission === undefined) return undefined
      const team = await this.readTeamLocked()
      const purpose = task.route.type === 'review' ? 'review' as const : 'lead-acceptance' as const
      const recipient = task.route.type === 'review' ? task.route.reviewer : resolveLeadMemberId(team)
      const member = recipient === undefined ? undefined : memberById(team, recipient)
      return { taskId, submissionId: submission.id, assignee: task.assignee ?? '', summary: submission.summary, purpose, recipient, sessionId: member?.sessionId, bindingGeneration: member?.bindingGeneration }
    })
  }

  async isSubmissionNotificationCurrent(taskId: string, submissionId: string, recipient: string, purpose: string, sessionId?: string, bindingGeneration?: number): Promise<boolean> {
    const current = await this.submissionNotificationSnapshot(taskId)
    return current !== undefined && current.submissionId === submissionId && current.recipient === recipient && current.purpose === purpose && current.sessionId === sessionId && current.bindingGeneration === bindingGeneration
  }

  async processSubmissionNotification(taskId: string): Promise<SubmissionNotificationReceipt[]> {
    const snapshot = await this.submissionNotificationSnapshot(taskId)
    if (snapshot === undefined) return [{ purpose: 'lead-acceptance', state: 'superseded', reason: 'submission-no-longer-awaits-notification' }]
    const { purpose, recipient, sessionId, bindingGeneration } = snapshot
    if (recipient === undefined || sessionId === undefined || bindingGeneration === undefined || this.deliverSubmissionNotice === undefined) return [{ purpose, ...(recipient === undefined ? {} : { recipient }), state: 'unavailable', reason: recipient === undefined ? 'recipient-unavailable' : sessionId === undefined || bindingGeneration === undefined ? 'binding-unavailable' : 'notification-port-unavailable' }]
    try {
      const receipt = await this.deliverSubmissionNotice({ ...snapshot, recipient, sessionId, bindingGeneration, stillCurrent: async () => this.isSubmissionNotificationCurrent(taskId, snapshot.submissionId, recipient, purpose, sessionId, bindingGeneration) })
      if (receipt.recipient !== recipient || receipt.purpose !== purpose || !['queued', 'pending', 'failed', 'unavailable', 'superseded'].includes(receipt.state) || receipt.state === 'queued' && (!receipt.messageId || !receipt.requestId)) return [{ recipient, purpose, state: 'failed', reason: 'invalid-notification-receipt' }]
      return [receipt]
    } catch {
      const current = await this.isSubmissionNotificationCurrent(taskId, snapshot.submissionId, recipient, purpose, sessionId, bindingGeneration)
      return [{ recipient, purpose, state: current ? 'failed' : 'superseded', reason: current ? 'notification-error' : 'submission-no-longer-current' }]
    }
  }

  /** Recovery is opt-in per immutable submission, not a historical broadcast. */
  async recoverSubmissionNotifications(limit = 8): Promise<void> {
    if (this.deliverSubmissionNotice === undefined) return
    const candidates = (await this.listTasks()).filter(task => submissionAwaitsDecision(task) && task.submissionNoticeId !== undefined && task.submissionNoticeId === task.latestSubmissionId)
    const count = Math.min(candidates.length, Math.max(1, limit))
    for (let i = 0; i < count; i++) await this.processSubmissionNotification(candidates[(this.submissionNoticeCursor + i) % candidates.length]!.id)
    this.submissionNoticeCursor = candidates.length === 0 ? 0 : (this.submissionNoticeCursor + count) % candidates.length
  }

  /** Explicit Lead/human-authorized repair for one existing immutable submission. */
  async requestSubmissionNotification(taskId: string, submissionId: string, actor: string): Promise<SubmissionNotificationReceipt[]> {
    await withProcessLock(this.location.teamFile, async () => {
      const team = await this.readTeamLocked()
      if (!isLeadOrHuman(team, actor)) fail('only the lead or human may request a submission handoff')
      const tasks = await this.readTasksIfPresentLocked()
      const task = tasks.tasks.find(entry => entry.id === taskId)
      if (!submissionAwaitsDecision(task, submissionId)) fail('submission no longer awaits a decision')
      if (task.submissionNoticeId === submissionId) return
      const next = { ...task, submissionNoticeId: submissionId, updatedAt: Date.now(), revision: task.revision + 1 }
      await atomicWriteJson(this.location.file, { ...tasks, revision: tasks.revision + 1, tasks: tasks.tasks.map(entry => entry.id === taskId ? next : entry) })
      await this.appendAudit({ kind: 'submission/notification-requested', taskId, submissionId, actor, at: Date.now() })
    })
    return this.processSubmissionNotification(taskId)
  }

  async acceptTask(request: AcceptTaskRequest): Promise<AcceptTaskResult> {
    if (!candidateId(request.taskId) || request.actor.length === 0) fail('invalid accept request')
    if (request.note !== undefined && typeof request.note !== 'string') fail('acceptance note must be a string')
    let closing: { assignee: string; taskId: string; note?: string } | undefined
    const result = await withProcessLock(this.location.teamFile, async () => {
      const tasks = await this.readTasksIfPresentLocked()
      const task = tasks.tasks.find((entry) => entry.id === request.taskId)
      if (task === undefined) fail(`task not found: ${request.taskId}`)
      const team = await this.readTeamLocked()
      if (!isLeadOrHuman(team, request.actor)) fail(`only the lead may accept tasks; ask ${leadMemberIdForMessage(team)}`)
      if (task.status === 'completed') fail('task is already completed')
      if (task.archivedPath !== undefined) fail('task is already archived')
      if (task.awaitsDecision !== true) fail(task.latestSubmissionId === undefined ? `task ${task.id} has no submission to accept` : `task ${task.id} has no submission awaiting a decision; the last one was already decided`)
      const attempts = await this.readAttemptsIfPresentLocked()
      const activeAttempt = task.activeAttemptId === undefined ? undefined : attempts.attempts.find((entry) => entry.id === task.activeAttemptId && entry.status === 'active')
      if (activeAttempt === undefined) fail('task has no active attempt')
      if (task.assignee === undefined || activeAttempt.memberId !== task.assignee) fail('task has no assignee attempt')
      const now = Date.now()
      // Phase 6: acceptance integrates the reviewed commit, refusing if the base moved since.
      const accepted = (await this.readSubmissionsIfPresentLocked()).submissions.find((entry) => entry.id === task.latestSubmissionId)
      // Integration writes the pending marker first and returns the task as it now stands; the write
      // below finishes the acceptance and drops the marker in the same record.
      const afterIntegration = accepted === undefined ? task : await this.integrateSubmission(accepted, task)
      const currentTask = afterIntegration.integrationPending === undefined ? afterIntegration : { ...afterIntegration, integrationPending: undefined }
      // Stored relative to the team directory, not as an absolute path: a workspace that moves (or
      // a team adopted under a new path, F16 of the first live run) otherwise leaves records that
      // point at a directory which no longer exists. Legacy absolute paths are still read.
      const archivedPath = path.join('archive', `${now}-${task.id}.md`)
      const archiveTarget = path.join(this.location.directory, archivedPath)
      const sourcePath = this.documentPath(task.id)
      const document = await fs.readFile(sourcePath)
      if (await fileExists(archiveTarget)) fail('archive target already exists')
      const { integrationPending: _finished, ...settled } = currentTask
      const nextTask: TeamTask = withLifecycleIntent({ ...settled, awaitsDecision: false, status: 'completed', ...(task.latestSubmissionId === undefined ? {} : { acceptedSubmissionId: task.latestSubmissionId }), archivedPath, contractRevision: (task.contractRevision ?? 0) + 1, updatedAt: now, revision: currentTask.revision + 1 }, lifecycleIntent('acceptance', (task.contractRevision ?? 0) + 1, { submissionId: task.latestSubmissionId!, assignee: activeAttempt.memberId, ...(request.note === undefined ? {} : { text: request.note }) }))
      const nextAttempts: AttemptsState = { ...attempts, schemaVersion: CURRENT_SCHEMA_VERSION, revision: attempts.revision + 1, attempts: attempts.attempts.map((entry) => entry.id === activeAttempt.id ? { ...entry, status: 'completed' as const, revision: entry.revision + 1 } : entry) }
      const nextTasks: TasksState = { ...tasks, schemaVersion: TASKS_SCHEMA_VERSION, revision: tasks.revision + 1, tasks: tasks.tasks.map((entry) => entry.id === task.id ? nextTask : entry) }
      try {
        await atomicWrite(archiveTarget, document)
        await atomicWriteJson(this.location.attemptsFile, nextAttempts)
        await atomicWriteJson(this.location.file, nextTasks)
        await fs.unlink(sourcePath)
      } catch (error) {
        await atomicWriteJson(this.location.file, tasks).catch(() => undefined)
        await atomicWriteJson(this.location.attemptsFile, attempts).catch(() => undefined)
        await fs.unlink(archiveTarget).catch(() => undefined)
         await atomicWrite(sourcePath, document).catch(() => undefined)
        throw error
      }
      await this.appendAudit({ kind: 'task/accepted', taskId: task.id, actor: request.actor, acceptedSubmissionId: nextTask.acceptedSubmissionId, archivedPath, ...(request.note === undefined ? {} : { note: request.note }), at: now, revision: nextTasks.revision })
      await this.appendAudit({ kind: 'task/archived', taskId: task.id, actor: request.actor, archivedPath, at: now, revision: nextTasks.revision })
      closing = { assignee: activeAttempt.memberId, taskId: task.id, ...(request.note === undefined ? {} : { note: request.note }) }
      return { task: clone(nextTask), archivedPath }
    })
    if (this.deliverLifecycleNotice === undefined && closing !== undefined) {
      try { await this.deliverClosing?.(closing) } catch { /* legacy callback supplies no admission receipt */ }
    }
    return { ...result, notifications: await this.processLifecycleNotifications(request.taskId, 'acceptance') }
  }

  /**
   * Close a task by hand, without a submission.
   *
   * The model always had a `cancelled` status and no way to reach it: accept needs a submission
   * awaiting a decision, and a task whose work was done by hand, dropped, or overtaken has none. On a
   * live stand a human closed three such tasks by editing their titles — the state never changed, and
   * the panel offered only "Edit contract" and "Release attempt", neither of which closes anything.
   */
  async cancelTask(request: { taskId: string; actor: string; reason: string; expectedRevision?: number }): Promise<{ task: TeamTask; archivedPath?: string; quiesced: boolean; notifications?: SubmissionNotificationReceipt[] }> {
    if (!candidateId(request.taskId) || request.actor.length === 0) fail('invalid cancel request')
    if (typeof request.reason !== 'string' || request.reason.trim().length === 0) fail('a cancellation must say why')
    const reason = request.reason.trim()
    const initial = await withProcessLock(this.location.teamFile, async () => {
      const tasks = await this.readTasksIfPresentLocked()
      const task = tasks.tasks.find((entry) => entry.id === request.taskId)
      if (task === undefined) fail(`task not found: ${request.taskId}`)
      const team = await this.readTeamLocked()
      if (!isLeadOrHuman(team, request.actor)) fail(`only the lead may close tasks; ask ${leadMemberIdForMessage(team)}`)
      if (request.expectedRevision !== undefined && request.expectedRevision !== tasks.revision) {
        throw new LiveTeamsError(ERROR_CODES.REVISION_CONFLICT, `expected revision ${request.expectedRevision}, actual ${tasks.revision}`)
      }
      if (task.status === 'completed') fail('task is already completed')
      if (task.status === 'cancelled') fail('task is already cancelled')
      if (task.archivedPath !== undefined) fail('task is already archived')
      if (task.integrationPending !== undefined) fail('task has an unresolved integration; reconcile its Git outcome before cancelling')
      const attempts = await this.readAttemptsIfPresentLocked()
      const bound = attempts.attempts.find((entry) => entry.id === task.activeAttemptId)
      if (task.activeAttemptId !== undefined && (bound === undefined || bound.taskId !== task.id || bound.memberId !== task.assignee)) fail('task attempt ownership is inconsistent; reconcile it before cancelling')
      if (task.activeAttemptId === undefined && ['claimed', 'in_progress', 'waiting'].includes(task.status)) fail('task has no accountable attempt; reconcile its ownership before cancelling')
      const live = bound?.status === 'active' || bound?.status === 'revoking' ? bound : undefined
      return { task, live, revision: tasks.revision }
    })
    let settledTask = initial.task
    if (initial.live !== undefined) {
      // Reuse the durable capability fence and bounded stop protocol. Never archive a running writer.
      const revoked = await this.revokeTask({ taskId: request.taskId, actor: request.actor, reason, expectedRevision: initial.revision })
      if (!revoked.quiesced) return { task: revoked.task, quiesced: false }
      settledTask = revoked.task
    }
    let cancellation: { assignee: string; taskId: string; reason: string } | undefined
    const result = await withProcessLock(this.location.teamFile, async () => {
      const tasks = await this.readTasksIfPresentLocked()
      const task = tasks.tasks.find((entry) => entry.id === request.taskId)
      if (task === undefined || task.revision !== settledTask.revision || task.activeAttemptId !== settledTask.activeAttemptId) {
        throw new LiveTeamsError(ERROR_CODES.REVISION_CONFLICT, 'task changed while cancellation was stopping its Session; read it again')
      }
      const team = await this.readTeamLocked()
      if (!isLeadOrHuman(team, request.actor)) fail(`only the lead may close tasks; ask ${leadMemberIdForMessage(team)}`)
      if (task.integrationPending !== undefined) fail('task has an unresolved integration; reconcile its Git outcome before cancelling')
      const now = Date.now()
      // Preserve authored bytes, including content not represented in the structured contract.
      let document: string
      try { document = await fs.readFile(this.documentPath(task.id), 'utf8') } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        fail('task document is missing; restore the authored document before cancelling')
      }
      const archivedPath = path.join('archive', `${now}-${task.id}.md`)
      const archiveTarget = path.join(this.location.directory, archivedPath)
      if (await fileExists(archiveTarget)) fail('archive target already exists')
      const closed: TeamTask = { ...task, awaitsDecision: false, status: 'cancelled', archivedPath, contractRevision: (task.contractRevision ?? 0) + 1, updatedAt: now, revision: task.revision + 1 }
      const nextTask = task.assignee === undefined ? closed : withLifecycleIntent(closed, lifecycleIntent('cancellation', closed.contractRevision ?? 0, { assignee: task.assignee, text: reason }))
      delete nextTask.activeAttemptId
      const nextTasks: TasksState = { ...tasks, schemaVersion: TASKS_SCHEMA_VERSION, revision: tasks.revision + 1, tasks: tasks.tasks.map((entry) => entry.id === task.id ? nextTask : entry) }
      await atomicWrite(archiveTarget, `${document}\n\n## Cancellation\n\nActor: ${request.actor}\n\nReason: ${reason}\n`)
      await atomicWriteJson(this.location.file, nextTasks)
      await this.appendAudit({ kind: 'task/cancelled', taskId: task.id, reason, actor: request.actor, at: now, revision: nextTasks.revision })
      if (task.assignee !== undefined) cancellation = { assignee: task.assignee, taskId: task.id, reason }
      return { task: clone(nextTask), archivedPath, quiesced: true }
    })
    if (this.deliverLifecycleNotice === undefined && cancellation !== undefined) {
      try { await this.deliverCancellation?.(cancellation) } catch { /* legacy callback supplies no admission receipt */ }
    }
    return { ...result, notifications: await this.processLifecycleNotifications(request.taskId, 'cancellation') }
  }

  async reviseTask(request: ReviseTaskRequest): Promise<ReviseTaskResult> {
    if (!candidateId(request.taskId) || request.actor.length === 0) fail('invalid revise request')
    if (typeof request.instructions !== 'string' || request.instructions.trim().length === 0) fail('revision instructions must be non-empty')
    const instructions = request.instructions.trim()
    let direction: { assignee: string; taskId: string; instructions: string } | undefined
    const result = await withProcessLock(this.location.teamFile, async () => {
      const tasks = await this.readTasksIfPresentLocked()
      const task = tasks.tasks.find((entry) => entry.id === request.taskId)
      if (task === undefined) fail(`task not found: ${request.taskId}`)
      const team = await this.readTeamLocked()
      if (!isLeadOrHuman(team, request.actor)) fail(`only the lead may revise tasks; ask ${leadMemberIdForMessage(team)}`)
      if (task.status !== 'waiting' && task.status !== 'needs_human') fail(`task cannot be revised in status ${task.status}`)
      if (task.assignee === undefined) fail('task has no assignee')
      const attempts = await this.readAttemptsIfPresentLocked()
      const activeAttempt = task.activeAttemptId === undefined ? undefined : attempts.attempts.find((entry) => entry.id === task.activeAttemptId && entry.status === 'active')
      if (activeAttempt === undefined || activeAttempt.memberId !== task.assignee) fail('task has no active attempt')
      const now = Date.now()
      // The return takes the decision away: the member owes a new submission, so nothing is waiting
      // for the lead or the human until it arrives.
      if (task.integrationPending !== undefined) fail('task has an unresolved integration; reconcile its Git outcome before revising')
      const nextTask: TeamTask = withLifecycleIntent({ ...task, status: 'in_progress', awaitsDecision: false, ...(task.reviewReturn === undefined ? {} : { reviewReturn: { ...task.reviewReturn, state: 'superseded', reason: 'manual-return', leadNotified: false } }), contractRevision: (task.contractRevision ?? 0) + 1, updatedAt: now, revision: task.revision + 1 }, lifecycleIntent('direction', (task.contractRevision ?? 0) + 1, { assignee: task.assignee, attemptId: activeAttempt.id, text: instructions }))
      const nextTasks: TasksState = { ...tasks, schemaVersion: TASKS_SCHEMA_VERSION, revision: tasks.revision + 1, tasks: tasks.tasks.map((entry) => entry.id === task.id ? nextTask : entry) }
      await atomicWriteJson(this.location.file, nextTasks)
      await this.appendAudit({ kind: 'task/revised', taskId: task.id, actor: request.actor, instructions, at: now, revision: nextTasks.revision })
      direction = { assignee: task.assignee, taskId: task.id, instructions }
      return { task: clone(nextTask) }
    })
    if (this.deliverLifecycleNotice === undefined && direction !== undefined) {
      try { await this.deliverDirection?.(direction) } catch { /* legacy callback supplies no admission receipt */ }
    }
    return { ...result, notifications: await this.processLifecycleNotifications(request.taskId, 'direction') }
  }

  async reviewTask(request: ReviewTaskRequest): Promise<ReviewTaskResult> {
    if (!candidateId(request.taskId) || !candidateId(request.submissionId) || request.reviewerMemberId.length === 0 || !REVIEW_VERDICTS.includes(request.verdict)) fail('invalid review request')
    let escalation: Parameters<NonNullable<TaskStoreOptions['deliverEscalation']>>[0] | undefined
    const audit: unknown[] = []
    const result = await withProcessLock(this.location.teamFile, async () => {
      const tasks = await this.readTasksIfPresentLocked()
      const task = tasks.tasks.find((entry) => entry.id === request.taskId)
      if (task === undefined) fail(`task not found: ${request.taskId}`)
      if (task.status === 'completed' || task.status === 'waiting' || task.status === 'cancelled' || task.status === 'failed') fail(`task cannot be reviewed in status ${task.status}`)
      if (task.route?.type !== 'review' || task.route.reviewer !== request.reviewerMemberId) fail('only the task review-route member may review it')
      if (task.assignee === request.reviewerMemberId) fail('the assignee cannot review their own work')
      if (task.latestSubmissionId !== request.submissionId) fail('review must target the latest submission')
      const attempts = await this.readAttemptsIfPresentLocked()
      const submissions = await this.readSubmissionsIfPresentLocked()
      const submission = submissions.submissions.find((entry) => entry.id === request.submissionId && entry.taskId === task.id)
      if (submission === undefined) fail('submission not found for task')
      // The generation a submission was produced under is part of its identity: a
      // submission whose attempt generation no longer matches the attempt it names
      // describes work nobody can vouch for (ADR 0005, B28).
      const authoring = attempts.attempts.find((entry) => entry.id === submission.attemptId)
      if (authoring === undefined || authoring.generation !== submission.attemptGeneration) fail('submission was produced by a superseded attempt')
      const reviews = await this.readReviewsIfPresentLocked()
      if (reviews.rounds.some((entry) => entry.submissionId === submission.id)) fail('submission already has a terminal review')
      const findings = (request.findings ?? []).map(validateFinding)
      const evidence = (request.evidence ?? []).map(validateCheck)
      if (request.verdict === 'pass' && findings.some((finding) => finding.severity === 'blocker' || finding.severity === 'high')) fail('PASS is refused while blocker or high findings remain unresolved')
      // A verdict that names no command is not reproducible: the reviewer is the one who runs the
      // checks, and the round is the record of that (F6 of the live pilot, where the role text asked
      // for evidence and the store accepted an empty list anyway). An inspection counts — record the
      // command you ran, even if it only reads the diff or opens the artifact.
      if (request.verdict === 'pass' && evidence.length === 0) fail('PASS needs at least one recorded check: run the verification and record the command with its output, so the verdict can be reproduced later')
      const priorRounds = reviews.rounds.filter((entry) => entry.taskId === task.id)
      const roundNumber = priorRounds.length + 1
      if (request.verdict === 'needs_revision' && priorRounds.filter((entry) => entry.verdict === 'needs_revision').length >= task.roundLimit) fail(`round limit ${task.roundLimit} reached; escalate to the lead instead`)
      const now = Date.now()
      const round: ReviewRound = { id: `review-${randomUUID()}`, taskId: task.id, submissionId: submission.id, reviewerMemberId: request.reviewerMemberId, round: roundNumber, verdict: request.verdict, findings, evidence, createdAt: now, revision: reviews.revision + 1 }
      const nextReviews: ReviewsState = { ...reviews, schemaVersion: CURRENT_SCHEMA_VERSION, revision: reviews.revision + 1, rounds: [...reviews.rounds, round] }
      // Phase 6: completing a task integrates its result, and the integration writes its intent to the
      // task before it moves the branch. It is called here, before the task record is built, so this
      // write is the one that drops the marker.
      const reviewedTask = request.verdict === 'pass' ? await this.integrateSubmission(submission, task) : task
      const { integrationPending: _pendingDrop, ...reviewedSettled } = reviewedTask
      let nextTask: TeamTask = { ...(request.verdict === 'pass' ? reviewedSettled : reviewedTask), awaitsDecision: false, updatedAt: now, revision: reviewedTask.revision + 1 }
      if (request.verdict === 'needs_revision') {
        const intent: ReviewReturn = { roundId: round.id, submissionId: submission.id, attemptId: authoring.id, generation: authoring.generation, assignee: authoring.memberId, sessionId: authoring.sessionId, bindingGeneration: authoring.bindingGeneration, state: 'pending', at: now }
        const reason = await this.reviewReturnBlockLocked(nextTask, intent, tasks.tasks, attempts.attempts)
        nextTask = { ...nextTask, status: reason === undefined ? 'in_progress' : 'waiting', reviewReturn: { ...intent, ...(reason === undefined ? {} : { state: 'blocked' as const, reason }) } }
      }
      // A reviewer's PASS accepts the work, so it restates the contract exactly like the
      // human's acceptance does. Without this bump a human intervention recorded earlier
      // stayed unresolved on a finished task — and every task depending on it stayed
      // `human-intervened` with no way out, because nothing can edit a completed contract
      // (found while scripting the B31 run; F17).
      if (request.verdict === 'pass') nextTask = { ...nextTask, acceptedSubmissionId: submission.id, status: 'completed', contractRevision: (task.contractRevision ?? 0) + 1 }
      else if (request.verdict === 'escalate') nextTask = { ...nextTask, status: 'waiting' }
      if (request.verdict === 'pass' || request.verdict === 'escalate') nextTask = withLifecycleIntent(nextTask, lifecycleIntent('review-verdict', nextTask.contractRevision ?? 0, { roundId: round.id, submissionId: submission.id }))
      // A reviewer's PASS completes the task, so the attempt that produced it ends here.
      // Leaving it active made the member look permanently busy to the dispatcher (the
      // first live run found exactly that) and kept the intervention observer watching a
      // finished task. The human acceptance path closed it; this one did not.
      //
      // The same asymmetry left the task itself in the active list: the human path files
      // the document and sets `archivedPath`, this one only flipped the status, so three
      // finished tasks sat under `Active` while the human watched (second live run).
      let archivedPath: string | undefined
      if (request.verdict === 'pass' && task.archivedPath === undefined) {
        archivedPath = path.join('archive', `${now}-${task.id}.md`)
        const target = path.join(this.location.directory, archivedPath)
        if (await fileExists(target)) fail('archive target already exists')
        await atomicWrite(target, await fs.readFile(this.documentPath(task.id)))
        nextTask = { ...nextTask, archivedPath }
      }
      const closedAttempts: AttemptsState | undefined = request.verdict === 'pass' && task.activeAttemptId !== undefined
        ? { ...attempts, schemaVersion: CURRENT_SCHEMA_VERSION, revision: attempts.revision + 1, attempts: attempts.attempts.map((entry) => entry.id === task.activeAttemptId && entry.status === 'active' ? { ...entry, status: 'completed' as const, revision: entry.revision + 1 } : entry) }
        : undefined
      await atomicWriteJson(this.location.reviewsFile, nextReviews)
      if (closedAttempts !== undefined) await atomicWriteJson(this.location.attemptsFile, closedAttempts)
      try { await atomicWriteJson(this.location.file, { ...tasks, revision: tasks.revision + 1, tasks: tasks.tasks.map((entry) => entry.id === task.id ? nextTask : entry) }) } catch (error) {
        if (archivedPath !== undefined) await fs.unlink(archivedPath).catch(() => undefined)
        await atomicWriteJson(this.location.reviewsFile, reviews)
        throw error
      }
      if (archivedPath !== undefined) {
        await fs.unlink(this.documentPath(task.id)).catch(() => undefined)
        audit.push({ kind: 'task/archived', taskId: task.id, actor: request.reviewerMemberId, archivedPath, at: now, revision: tasks.revision + 1 })
      }
      audit.push({ kind: 'review/round', taskId: task.id, submissionId: submission.id, reviewerMemberId: request.reviewerMemberId, verdict: request.verdict, round: round.round, at: now, revision: nextReviews.revision })
      if (request.verdict === 'pass') audit.push({ kind: 'task/accepted', taskId: task.id, submissionId: submission.id, actor: request.reviewerMemberId, at: now, revision: tasks.revision + 1 })
      if (request.verdict === 'escalate') {
        const leadMemberId = leadMemberIdForMessage(await this.readTeamLocked())
        const problem = findings.map((finding) => finding.problem).join('; ') || 'reviewer escalated without a finding'
        const tried = findings.map((finding) => finding.requiredFix).join('; ') || 'review evidence recorded'
        audit.push({ kind: 'review/escalated', taskId: task.id, submissionId: submission.id, reviewerMemberId: request.reviewerMemberId, leadMemberId, problem, tried, at: now, revision: nextReviews.revision })
        escalation = { leadMemberId, taskId: task.id, submissionId: submission.id, round, reviewerMemberId: request.reviewerMemberId, problem, tried }
      }
      return { round: clone(round), task: clone(nextTask) }
    })
    for (const event of audit) await this.appendAudit(event)
    if (this.deliverLifecycleNotice === undefined && escalation !== undefined) {
      try { await this.deliverEscalation?.(escalation) } catch { /* verdict is saved; legacy callback supplies no admission receipt */ }
    }
    if (request.verdict === 'needs_revision') {
      await this.processReviewReturn(request.taskId)
      return { ...result, task: (await this.readTask(request.taskId)).task, notifications: await this.reviewReturnNotifications(request.taskId) }
    }
    return { ...result, notifications: await this.processLifecycleNotifications(request.taskId, 'review-verdict') }
  }

  async isReviewReturnLeadCurrent(taskId: string, roundId: string, recipient: string, noticeClass: string | undefined, sessionId?: string, bindingGeneration?: number): Promise<boolean> {
    return withProcessLock(this.location.teamFile, async () => {
      if (noticeClass === undefined || sessionId === undefined || bindingGeneration === undefined || await fileExists(path.join(this.location.directory, 'disabled'))) return false
      const task = (await this.readTasksIfPresentLocked()).tasks.find(entry => entry.id === taskId)
      const intent = task?.reviewReturn
      const team = await this.readTeamLocked()
      const member = memberById(team, recipient)
      return task !== undefined && task.archivedPath === undefined && ['in_progress', 'waiting', 'needs_human'].includes(task.status) && intent !== undefined && intent.roundId === roundId && task.latestSubmissionId === intent.submissionId && reviewReturnNoticeClass(intent) === noticeClass && resolveLeadMemberId(team) === recipient && member?.sessionId === sessionId && member.bindingGeneration === bindingGeneration
    })
  }

  private async reviewReturnNotifications(taskId: string): Promise<SubmissionNotificationReceipt[]> {
    return withProcessLock(this.location.teamFile, async () => {
      const intent = (await this.readTasksIfPresentLocked()).tasks.find(task => task.id === taskId)?.reviewReturn
      if (intent === undefined) return []
      const team = await this.readTeamLocked()
      const lead = resolveLeadMemberId(team)
      const leadMember = lead === undefined ? undefined : memberById(team, lead)
      const ids = intent.messageId === undefined ? {} : { messageId: intent.messageId, requestId: intent.requestId! }
      const knownAdmitted = intent.admission === 'queued' || ['delivered', 'started', 'completed'].includes(intent.state)
      const author: SubmissionNotificationReceipt = { recipient: intent.assignee, purpose: 'review-return', ...ids, state: knownAdmitted ? 'queued' : intent.state === 'failed' ? 'failed' : ['blocked', 'superseded'].includes(intent.state) ? 'superseded' : intent.requestId === undefined && intent.state === 'unconfirmed' ? 'unavailable' : 'pending', ...(intent.reason === undefined ? {} : { reason: intent.reason }) }
      const receipt = intent.leadNotification
      const leadReceipt: SubmissionNotificationReceipt = receipt !== undefined && receipt.recipient === lead && (receipt.state !== 'queued' || receipt.sessionId !== undefined && receipt.sessionId === leadMember?.sessionId && receipt.bindingGeneration === leadMember?.bindingGeneration) && (receipt.state !== 'queued' || intent.leadNotified === true) && reviewReturnNoticeClass(intent) !== undefined ? receipt : { ...(lead === undefined ? {} : { recipient: lead }), purpose: 'review-return-lead', state: lead === undefined || intent.leadNotified === true ? 'unavailable' : 'pending', reason: lead === undefined ? 'recipient-unavailable' : intent.leadNotified === true ? 'legacy-notification-no-admission-receipt' : 'awaiting-semantic-lead-notification' }
      return [author, leadReceipt]
    })
  }

  private async reviewReturnBlockLocked(task: TeamTask, intent: ReviewReturn, tasks: TeamTask[], attempts: TaskAttempt[]): Promise<string | undefined> {
    if (task.archivedPath !== undefined || !['in_progress', 'claimed', 'waiting'].includes(task.status)) return 'task-not-active'
    if (task.latestSubmissionId !== intent.submissionId) return 'submission-changed'
    const attempt = attempts.find(entry => entry.id === intent.attemptId)
    if (task.activeAttemptId !== intent.attemptId || attempt?.status !== 'active' || attempt.generation !== intent.generation || attempt.memberId !== intent.assignee) return 'attempt-changed'
    if (attempt.humanIntervenedAt !== undefined && (attempt.humanIntervenedContractRevision === undefined || (task.contractRevision ?? 0) <= attempt.humanIntervenedContractRevision)) return 'human-intervened'
    if (task.integrationPending !== undefined) return 'integration-pending'
    const team = await this.readTeamLocked()
    if (team.dispatch?.mode === 'paused') return 'dispatch-paused'
    if (await fileExists(path.join(this.location.directory, 'disabled'))) return 'team-disabled'
    const member = team.members.find(entry => entry.memberId === intent.assignee)
    if (member === undefined || member.sessionId !== intent.sessionId || member.bindingGeneration !== intent.bindingGeneration || attempt.sessionId !== intent.sessionId || attempt.bindingGeneration !== intent.bindingGeneration) return 'binding-changed'
    if (member.availability !== 'available') return 'member-unavailable'
    if ((task.dependsOn ?? []).some(id => tasks.find(entry => entry.id === id)?.status !== 'completed')) return 'dependency-not-completed'
    if (attempts.some(entry => entry.id !== attempt.id && entry.status === 'active' && entry.memberId === intent.assignee)) return 'member-busy'
    if (CODING_KINDS.has(task.kind) && attempts.some(other => other.id !== attempt.id && other.status === 'active' && (tasks.find(entry => entry.id === other.taskId)?.paths ?? []).some(otherPath => (task.paths ?? []).some(ownPath => scopesIntersect(literalPrefix(otherPath), literalPrefix(ownPath)))))) return 'paths-overlap'
    return undefined
  }

  async isReviewReturnCurrent(taskId: string, identity: Pick<ReviewReturn, 'roundId' | 'submissionId' | 'attemptId' | 'generation' | 'assignee' | 'sessionId' | 'bindingGeneration'>): Promise<boolean> {
    return withProcessLock(this.location.teamFile, async () => {
      const tasks = await this.readTasksIfPresentLocked()
      const task = tasks.tasks.find(entry => entry.id === taskId)
      const intent = task?.reviewReturn
      if (task === undefined || intent === undefined || ['blocked', 'failed', 'superseded'].includes(intent.state)) return false
      if ((['roundId', 'submissionId', 'attemptId', 'generation', 'assignee', 'sessionId', 'bindingGeneration'] as const).some(key => identity[key] !== intent[key])) return false
      return await this.reviewReturnBlockLocked(task, intent, tasks.tasks, (await this.readAttemptsIfPresentLocked()).attempts) === undefined
    })
  }

  async blockReviewReturn(taskId: string, identity: Pick<ReviewReturn, 'roundId' | 'submissionId' | 'attemptId' | 'generation' | 'assignee' | 'sessionId' | 'bindingGeneration'>, reason: 'human-intervened' | 'intervention-unobservable'): Promise<void> {
    const blocked = await withProcessLock(this.location.teamFile, async () => {
      const tasks = await this.readTasksIfPresentLocked()
      const task = tasks.tasks.find(entry => entry.id === taskId)
      const intent = task?.reviewReturn
      if (task === undefined || intent === undefined || !['pending', 'sending', 'delivered', 'unconfirmed'].includes(intent.state) || (['roundId', 'submissionId', 'attemptId', 'generation', 'assignee', 'sessionId', 'bindingGeneration'] as const).some(key => intent[key] !== identity[key])) return undefined
      if (await this.reviewReturnBlockLocked(task, intent, tasks.tasks, (await this.readAttemptsIfPresentLocked()).attempts) !== undefined) return undefined
      const nextIntent: ReviewReturn = { ...intent, state: 'blocked', reason, leadNotified: false }
      const next: TeamTask = { ...task, status: 'waiting', reviewReturn: nextIntent, updatedAt: Date.now(), revision: task.revision + 1 }
      await atomicWriteJson(this.location.file, { ...tasks, revision: tasks.revision + 1, tasks: tasks.tasks.map(entry => entry.id === taskId ? next : entry) })
      return nextIntent
    })
    if (blocked !== undefined) await this.appendAudit({ kind: 'review/returned', taskId, roundId: blocked.roundId, attemptId: blocked.attemptId, state: blocked.state, reason, at: Date.now(), actor: 'scheduler' })
  }

  async recoverReviewReturns(limit = 8): Promise<void> {
    const candidates = await withProcessLock(this.location.teamFile, async () => {
      const team = await this.readTeamLocked()
      const leadId = resolveLeadMemberId(team)
      const lead = leadId === undefined ? undefined : memberById(team, leadId)
      return (await this.readTasksIfPresentLocked()).tasks.filter(task => {
        const intent = task.reviewReturn
        if (intent === undefined || task.archivedPath !== undefined || !['in_progress', 'waiting', 'needs_human'].includes(task.status)) return false
        const prior = intent.leadNotification
        const changed = prior?.sessionId !== undefined && (prior.recipient !== leadId || prior.sessionId !== lead?.sessionId || prior.bindingGeneration !== lead?.bindingGeneration)
        return ['pending', 'sending', 'delivered', 'unconfirmed'].includes(intent.state) || reviewReturnNoticeClass(intent) !== undefined && (!intent.leadNotified || changed)
      })
    })
    const count = Math.min(candidates.length, Math.max(1, limit))
    for (let i = 0; i < count; i++) await this.processReviewReturn(candidates[(this.reviewReturnCursor + i) % candidates.length]!.id)
    this.reviewReturnCursor = candidates.length === 0 ? 0 : (this.reviewReturnCursor + count) % candidates.length
  }

  /** Recover only explicit prospective intents, never old terminal review records. */
  async processReviewReturn(taskId: string): Promise<void> {
    const existing = this.reviewReturnRuns.get(taskId)
    if (existing !== undefined) return existing
    const operation = this.runReviewReturn(taskId)
    this.reviewReturnRuns.set(taskId, operation)
    try { await operation } finally { if (this.reviewReturnRuns.get(taskId) === operation) this.reviewReturnRuns.delete(taskId) }
  }

  private async runReviewReturn(taskId: string): Promise<void> {
    const snapshot = await withProcessLock(this.location.teamFile, async () => {
      const tasks = await this.readTasksIfPresentLocked()
      const task = tasks.tasks.find(entry => entry.id === taskId)
      const intent = task?.reviewReturn
      if (task === undefined || intent === undefined || task.archivedPath !== undefined || !['in_progress', 'waiting', 'needs_human'].includes(task.status)) return undefined
      const round = (await this.readReviewsIfPresentLocked()).rounds.find(entry => entry.id === intent.roundId && entry.submissionId === intent.submissionId && entry.verdict === 'needs_revision')
      if (round === undefined) return undefined
      const team = await this.readTeamLocked()
      const leadMemberId = leadMemberIdForMessage(team)
      const lead = memberById(team, leadMemberId)
      return { taskId, title: task.title, leadMemberId, ...(lead?.sessionId === undefined ? {} : { leadSessionId: lead.sessionId, leadBindingGeneration: lead.bindingGeneration }), intent: clone(intent), round: clone(round) }
    })
    if (snapshot === undefined) return
    const update = async (patch: Partial<Omit<ReviewReturn, 'reason'>> & { reason?: string | undefined }): Promise<ReviewReturn | undefined> => {
      const outcome = await withProcessLock(this.location.teamFile, async () => {
        const tasks = await this.readTasksIfPresentLocked()
        const task = tasks.tasks.find(entry => entry.id === taskId)
        if (task?.reviewReturn?.roundId !== snapshot.intent.roundId) return undefined
        if (patch.leadNotified === true && (task.reviewReturn.state !== snapshot.intent.state || task.reviewReturn.reason !== snapshot.intent.reason)) return undefined
        if (['superseded', 'blocked'].includes(task.reviewReturn.state) && patch.state !== undefined && patch.state !== task.reviewReturn.state) return undefined
        const block = patch.leadNotified === true ? undefined : await this.reviewReturnBlockLocked(task, snapshot.intent, tasks.tasks, (await this.readAttemptsIfPresentLocked()).attempts)
        const { reason, ...merged } = { ...task.reviewReturn, ...patch }
        const intent: ReviewReturn = { ...merged, ...(reason === undefined ? {} : { reason }), ...(block !== undefined && !['blocked', 'superseded'].includes(patch.state ?? task.reviewReturn.state) ? { state: 'superseded' as const, reason: block } : {}) }
        if (JSON.stringify(intent) === JSON.stringify(task.reviewReturn)) return undefined
        if (reviewReturnNoticeClass(intent) !== reviewReturnNoticeClass(task.reviewReturn)) { intent.leadNotified = false; delete intent.leadNotification }
        parseReviewReturn(intent)
        const next: TeamTask = { ...task, ...(intent.state === 'failed' && task.status === 'in_progress' ? { status: 'needs_human' } : {}), reviewReturn: intent, updatedAt: Date.now(), revision: task.revision + 1 }
        await atomicWriteJson(this.location.file, { ...tasks, revision: tasks.revision + 1, tasks: tasks.tasks.map(entry => entry.id === taskId ? next : entry) })
        return intent
      })
      if (outcome !== undefined) {
        snapshot.intent = outcome
        await this.appendAudit({ kind: patch.leadNotified === true ? 'review/lead-notified' : 'review/returned', taskId, roundId: outcome.roundId, attemptId: outcome.attemptId, submissionId: outcome.submissionId, ...(outcome.requestId === undefined ? {} : { requestId: outcome.requestId }), ...(outcome.turn === undefined ? {} : { turn: outcome.turn }), ...(outcome.inputSeq === undefined ? {} : { inputSeq: outcome.inputSeq }), state: outcome.state, ...(outcome.reason === undefined ? {} : { reason: outcome.reason }), at: Date.now(), actor: 'scheduler' })
      }
      return outcome
    }
    const stillCurrent = async (): Promise<boolean> => this.isReviewReturnCurrent(taskId, snapshot.intent)
    const refresh = async (): Promise<boolean> => withProcessLock(this.location.teamFile, async () => {
      const current = (await this.readTasksIfPresentLocked()).tasks.find(entry => entry.id === taskId)?.reviewReturn
      if (current?.roundId !== snapshot.intent.roundId) return false
      snapshot.intent = clone(current)
      return true
    })
    const request: ReviewReturnRequest = { ...snapshot, stillCurrent, leadStillCurrent: async () => this.isReviewReturnLeadCurrent(taskId, snapshot.intent.roundId, snapshot.leadMemberId, reviewReturnNoticeClass(snapshot.intent), snapshot.leadSessionId, snapshot.leadBindingGeneration) }
    if (['pending', 'sending', 'delivered', 'unconfirmed'].includes(snapshot.intent.state) && !await stillCurrent()) await update({ state: 'superseded', reason: 'capability-changed' })
    if (['pending', 'sending'].includes(snapshot.intent.state)) {
      if (!await stillCurrent()) await update({ state: 'superseded', reason: 'capability-changed' })
      else if (this.deliverReviewReturn === undefined) await update({ state: 'unconfirmed', reason: 'delivery-unavailable' })
      else {
        await update({ state: 'sending' })
        request.intent = snapshot.intent
        if (snapshot.intent.state === 'sending' && await stillCurrent()) {
          try {
            const receipt = await this.deliverReviewReturn(request)
            await update({ messageId: receipt.messageId, requestId: receipt.requestId, admission: receipt.pending ? 'pending' : 'queued', state: receipt.pending ? 'sending' : 'delivered', reason: receipt.pending ? 'delivery-pending' : undefined })
          } catch { await update({ state: 'failed', reason: 'delivery-failed' }) }
        }
      }
    }
    if (!await refresh()) return
    if (['sending', 'delivered', 'unconfirmed'].includes(snapshot.intent.state) && snapshot.intent.requestId !== undefined && await stillCurrent()) {
      request.intent = snapshot.intent
      try {
        let receipt = await this.observeReviewReturn?.(request)
        if (receipt !== undefined && ['started', 'completed'].includes(receipt.state) && (!Number.isSafeInteger(receipt.turn) || Number(receipt.turn) < 0 || !Number.isSafeInteger(receipt.inputSeq) || Number(receipt.inputSeq) < 0)) receipt = { state: 'unobservable', reason: 'invalid-execution-receipt' }
        const awaitingDelivery = snapshot.intent.state === 'sending'
        await update({ state: receipt?.state === 'started' || receipt?.state === 'completed' || receipt?.state === 'failed' ? receipt.state : awaitingDelivery ? 'sending' : 'unconfirmed', ...(receipt?.turn === undefined ? {} : { turn: receipt.turn }), ...(receipt?.inputSeq === undefined ? {} : { inputSeq: receipt.inputSeq }), reason: receipt?.reason ?? (awaitingDelivery && (receipt === undefined || receipt.state === 'pending' || receipt.state === 'unobservable') ? 'delivery-pending' : receipt?.state === 'pending' ? 'execution-not-yet-observed' : receipt?.state === 'unobservable' || receipt === undefined ? 'execution-unobservable' : undefined) })
      } catch { await update({ state: 'unconfirmed', reason: 'observation-failed' }) }
    }
    if (!await refresh()) return
    const previousLead = snapshot.intent.leadNotification
    if (previousLead !== undefined && previousLead.sessionId !== undefined && (previousLead.recipient !== snapshot.leadMemberId || previousLead.sessionId !== snapshot.leadSessionId || previousLead.bindingGeneration !== snapshot.leadBindingGeneration)) await update({ leadNotified: false })
    if (reviewReturnNoticeClass(snapshot.intent) !== undefined && !snapshot.intent.leadNotified && this.notifyReviewReturn !== undefined) {
      request.intent = snapshot.intent
      try {
        const receipt = await this.notifyReviewReturn(request)
        if (receipt === undefined) await update({ leadNotified: true }) // Legacy callback has no structured admission proof.
        else if (receipt.purpose === 'review-return-lead' && receipt.recipient === snapshot.leadMemberId) await update({ leadNotified: receipt.state === 'queued', leadNotification: receipt })
        else await update({ leadNotified: false, leadNotification: { recipient: snapshot.leadMemberId, purpose: 'review-return-lead', state: 'failed', reason: 'invalid-notification-receipt' } })
      } catch { await update({ leadNotified: false, leadNotification: { recipient: snapshot.leadMemberId, purpose: 'review-return-lead', state: 'failed', reason: 'notification-error' } }) }
    }
  }

  /**
   * What the declaration was worth at submission time. Only a writing task that
   * declared paths is checked: with nothing declared there is nothing to violate, and
   * an unobservable workspace is reported as `unchecked` rather than as clean (B30).
   */
  /**
   * Integrate a submission's commit into its base, refusing when the base moved.
   *
   * Nothing is checked out and nothing is merged: the working tree already holds the work, so
   * integration is one compare-and-swap ref update. `STALE_BASE` is a refusal — nothing is written,
   * and the decision has to be made again against the current base (ADR 0006).
   */
  private async integrateSubmission(submission: Submission, task: TeamTask): Promise<TeamTask> {
    const git = submission.git
    if (git === undefined || this.git === undefined) return task
    // The journal entry the reviewers asked for: the intent is durable before the branch moves, so a
    // crash between the two is visible instead of leaving an integrated branch and an open task.
    const pending = await this.writeIntegrationPendingLocked(task, git)
    const current = pending ?? task
    const outcome = await this.git.integrate(this.workspacePath, git.baseRef, git.headSha, git.baseTipSha, git.commitPaths).catch(() => 'stale' as const)
    if (outcome !== 'integrated') await this.clearIntegrationPendingLocked(current)
    if (outcome === 'index-failed') {
      // The branch is already at the reviewed commit, so this is not a stale base: the index kept the
      // old entries, and a later plain `git commit` could revert accepted work. Nothing is written;
      // retrying the acceptance repairs it, because integration is now idempotent.
      throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, `the base is at the reviewed commit ${String(git.headSha).slice(0, 12)} but the index could not be moved with it; retry the acceptance. If it persists, run: git reset -- ${git.commitPaths.join(' ')}`, { auditDetail: 'index repair failed' })
    }
    if (outcome === 'stale') {
      const tip = await this.git.tip(this.workspacePath, git.baseRef).catch(() => undefined)
      throw new LiveTeamsError(ERROR_CODES.STALE_BASE, `the base moved since the review: ${git.baseRef} is at ${tip ?? 'an unreadable tip'}, the reviewed base was ${git.baseTipSha}. Refresh the decision against the current base before accepting ${task.id}`, { auditDetail: 'stale base' })
    }
    return current
  }

  /**
   * Record the intent to integrate, and return the task as it now stands.
   *
   * `Locked` on purpose: the callers (both acceptance paths) already hold the team lock, and taking it
   * again deadlocks the process — which is exactly what the git suite reported, as a thirty-second
   * hang rather than a failure.
   */
  private async writeIntegrationPendingLocked(task: TeamTask, git: SubmissionGit): Promise<TeamTask | undefined> {
    const state = await this.readOrCreateLocked()
    const current = state.tasks.find((entry) => entry.id === task.id)
    if (current === undefined || current.integrationPending !== undefined) return current
    const next: TeamTask = { ...current, integrationPending: { baseRef: git.baseRef, headSha: git.headSha, baseTipSha: git.baseTipSha, at: Date.now() }, revision: current.revision + 1 }
    await atomicWriteJson(this.location.file, { ...state, revision: state.revision + 1, tasks: state.tasks.map((entry) => entry.id === task.id ? next : entry) })
    return next
  }

  /** Forget the intent: either the integration did not happen, or the caller is about to finish it. */
  private async clearIntegrationPendingLocked(task: TeamTask): Promise<void> {
    if (task.integrationPending === undefined) return
    const state = await this.readOrCreateLocked()
    const current = state.tasks.find((entry) => entry.id === task.id)
    if (current === undefined || current.integrationPending === undefined) return
    const { integrationPending: _dropped, ...withoutPending } = current
    await atomicWriteJson(this.location.file, { ...state, revision: state.revision + 1, tasks: state.tasks.map((entry) => entry.id === task.id ? { ...withoutPending, revision: current.revision + 1 } : entry) })
  }

  /**
   * Where an archived document lives. New records store the path relative to the team directory;
   * records written before that change hold an absolute path and are still honoured.
   */
  private archivedPathOf(archivedPath: string): string {
    return path.isAbsolute(archivedPath) ? archivedPath : path.resolve(this.location.directory, archivedPath)
  }

  /**
   * Record that an active attempt is not moving, once. Idempotent by design: a second call with the
   * same reason is a no-op, so the reconciler may call it on every pass without filling the journal.
   * Returns `true` when this call was the one that recorded it.
   */
  async markAttemptStalled(request: { attemptId: string; reason: 'unacknowledged' | 'idle'; detail: string; actor: string }): Promise<boolean> {
    return await withProcessLock(this.location.teamFile, async () => {
      const attempts = await this.readAttemptsIfPresentLocked()
      const attempt = attempts.attempts.find((entry) => entry.id === request.attemptId)
      if (attempt === undefined || attempt.status !== 'active') return false
      if (attempt.stalled !== undefined) return false
      const at = Date.now()
      const next: AttemptsState = {
        ...attempts,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        revision: attempts.revision + 1,
        attempts: attempts.attempts.map((entry) => entry.id === request.attemptId ? { ...entry, stalled: { at, reason: request.reason, detail: request.detail }, revision: entry.revision + 1 } : entry),
      }
      await atomicWriteJson(this.location.attemptsFile, next)
      await this.appendAudit({ kind: 'attempt/stalled', taskId: attempt.taskId, attemptId: attempt.id, memberId: attempt.memberId, reason: request.reason, detail: request.detail, actor: request.actor, at, revision: next.revision })
      return true
    })
  }

  /**
   * Keep a copy of submitted bytes, addressed by their digest. Returns the path relative to the team
   * directory, or `undefined` when the copy could not be written — a submission is never refused for
   * this, but it is then read back from the workspace and the drift check says so.
   */
  private async storeBlob(digest: string, bytes: Buffer): Promise<string | undefined> {
    const relative = path.join('artifacts', 'blobs', digest)
    const target = path.join(this.location.directory, relative)
    try {
      if (!(await fileExists(target))) {
        await fs.mkdir(this.location.blobsDirectory, { recursive: true })
        await fs.writeFile(target, bytes)
      }
      return relative
    } catch { return undefined }
  }

  /** The frozen bytes of a submission artifact, or `undefined` when no copy was kept. */
  async readBlob(blobPath: string): Promise<Buffer | undefined> {
    const resolved = path.resolve(this.location.directory, blobPath)
    const root = path.resolve(this.location.directory)
    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) return undefined
    try { return await fs.readFile(resolved) } catch { return undefined }
  }

  /**
   * Reconcile an integration that was interrupted: the marker is on the task, and the branch tells
   * the rest of the story. Reports once, and clears the marker only when nothing happened — a branch
   * that is already at the reviewed commit means the acceptance still has to be finished, and that is
   * a decision, not a cleanup.
   */
  async reconcilePendingIntegrations(request: { tipOf: (ref: string) => Promise<string | undefined>; actor: string }): Promise<{ taskId: string; state: 'moved' | 'untouched' | 'elsewhere'; detail: string }[]> {
    return await withProcessLock(this.location.teamFile, async () => {
      const state = await this.readOrCreateLocked()
      const pending = state.tasks.filter((task) => task.integrationPending !== undefined && task.integrationPending.reportedAt === undefined)
      if (pending.length === 0) return []
      const reported: { taskId: string; state: 'moved' | 'untouched' | 'elsewhere'; detail: string }[] = []
      const now = Date.now()
      let tasks = state.tasks
      for (const task of pending) {
        const marker = task.integrationPending as NonNullable<TeamTask['integrationPending']>
        const tip = await request.tipOf(marker.baseRef).catch(() => undefined)
        const outcome = tip === marker.headSha ? 'moved' as const : tip === marker.baseTipSha ? 'untouched' as const : 'elsewhere' as const
        const detail = outcome === 'moved'
          ? `the branch ${marker.baseRef} is already at the reviewed commit ${marker.headSha.slice(0, 12)}, but the acceptance never finished; retry it`
          : outcome === 'untouched'
            ? `the branch ${marker.baseRef} never moved; the acceptance can simply be retried`
            : `the branch ${marker.baseRef} is at ${tip ?? 'an unreadable tip'}, which is neither the reviewed base nor the reviewed commit; a human has to decide`
        const next: TeamTask = outcome === 'untouched'
          ? (() => { const { integrationPending: _cleared, ...rest } = task; return { ...rest, revision: task.revision + 1 } })()
          : { ...task, integrationPending: { ...marker, reportedAt: now }, revision: task.revision + 1 }
        tasks = tasks.map((entry) => entry.id === task.id ? next : entry)
        await this.appendAudit({ kind: 'integration/pending', taskId: task.id, state: outcome, detail, actor: request.actor, at: now, revision: state.revision + 1 })
        reported.push({ taskId: task.id, state: outcome, detail })
      }
      await atomicWriteJson(this.location.file, { ...state, revision: state.revision + 1, tasks })
      return reported
    })
  }

  /**
   * Bring every state file this store owns forward to the current schema version.
   *
   * Reading tolerates an older version, but nothing brought it forward: a field added later stayed
   * missing until something happened to write the file again, and no record said the state had been
   * read at an older version. A state from the future is refused with both versions named.
   *
   * The file is copied before it is rewritten, and the migration is recorded in the journal: a
   * migration is the one operation that changes history, and it should be possible to say when it
   * happened and to go back.
   */
  async migrate(): Promise<{ files: { file: string; from: number; to: number; backup: string }[] }> {
    const migrations = this.migrations
    const files: { file: string; from: number; to: number; backup: string }[] = []
    const targets: { file: string; what: string; version: number; stamp: (state: Record<string, unknown>) => Record<string, unknown> }[] = [
      { file: this.location.file, what: 'task state', version: TASKS_SCHEMA_VERSION, stamp: (state) => ({ ...state, schemaVersion: TASKS_SCHEMA_VERSION }) },
      { file: this.location.attemptsFile, what: 'attempts state', version: CURRENT_SCHEMA_VERSION, stamp: (state) => ({ ...state, schemaVersion: CURRENT_SCHEMA_VERSION }) },
      { file: this.location.submissionsFile, what: 'submissions state', version: CURRENT_SCHEMA_VERSION, stamp: (state) => ({ ...state, schemaVersion: CURRENT_SCHEMA_VERSION }) },
      { file: this.location.reviewsFile, what: 'reviews state', version: CURRENT_SCHEMA_VERSION, stamp: (state) => ({ ...state, schemaVersion: CURRENT_SCHEMA_VERSION }) },
    ]
    try {
      return await withProcessLock(this.location.teamFile, async () => {
        for (const target of targets) {
          let raw: unknown
          try { raw = JSON.parse(await fs.readFile(target.file, 'utf8')) } catch { continue }
          const state = objectRecord(raw)
          if (state === undefined) continue
          const plan = planMigration(state.schemaVersion, target.version, target.what, migrations)
          if (plan.kind === 'future') throw plan.error
          if (plan.kind === 'current') continue
          const backup = `${target.file}.v${plan.from}.bak`
          await fs.copyFile(target.file, backup)
          const migrated = target.stamp(objectRecord(applyMigration(state, plan, migrations)) ?? state)
          await atomicWriteJson(target.file, migrated)
          files.push({ file: path.basename(target.file), from: plan.from, to: plan.to, backup: path.basename(backup) })
        }
        return { files }
      })
    } finally {
      // The audit port may lazily open TeamStore, which takes this same lock.
      // Await it only after releasing the lock, including when a later file
      // fails migration: earlier durable writes still need their audit events.
      for (const file of files) {
        await this.appendAudit({ kind: 'state/migrated', ...file, actor: 'reconciler', at: Date.now() })
      }
    }
  }

  /** B32: resolved once per store; the answer cannot change while a store lives. */
  private async mode(): Promise<'git' | 'files' | undefined> {
    if (this.resolvedMode === undefined) {
      if (this.workspaceMode === undefined) {
        // A composition that supplies only the changed-paths port is observing git: that is
        // what the port has always meant, and it must not turn into "unreadable".
        this.resolvedMode = this.changedPaths === undefined ? null : 'git'
      } else {
        this.resolvedMode = await this.workspaceMode(this.workspacePath).catch(() => undefined) ?? null
      }
    }
    return this.resolvedMode ?? undefined
  }

  private async snapshotPathFor(attemptId: string): Promise<string> {
    return path.join(this.location.snapshotsDirectory, `${attemptId}.json`)
  }

  /** Take the fingerprint a `files`-mode submission will be compared against. */
  private async takeSnapshot(attemptId: string): Promise<void> {
    if (await this.mode() !== 'files' || this.snapshotTree === undefined) return
    const snapshot = await this.snapshotTree(this.workspacePath).catch(() => undefined)
    if (snapshot === undefined) return
    await fs.mkdir(this.location.snapshotsDirectory, { recursive: true })
    await atomicWriteJson(await this.snapshotPathFor(attemptId), snapshot).catch(() => undefined)
  }

  /** Delete fingerprints whose attempt is no longer running: garbage, not evidence. */
  async pruneSnapshots(): Promise<number> {
    let names: string[]
    try { names = await fs.readdir(this.location.snapshotsDirectory) } catch { return 0 }
    if (names.length === 0) return 0
    const attempts = await this.readAttemptsIfPresentLocked()
    const live = new Set(attempts.attempts.filter((attempt) => attempt.status === 'active').map((attempt) => attempt.id))
    let removed = 0
    for (const name of names) {
      if (!name.endsWith('.json')) continue
      const attemptId = name.slice(0, -'.json'.length)
      if (live.has(attemptId)) continue
      await fs.unlink(path.join(this.location.snapshotsDirectory, name)).catch(() => undefined)
      removed += 1
    }
    return removed
  }

  private async checkScope(task: TeamTask, tasks: readonly TeamTask[], attempts: readonly TaskAttempt[], artifact: SubmissionArtifact, attempt: TaskAttempt): Promise<SubmissionScope | undefined> {
    const declared = task.paths
    if (declared === undefined || declared.length === 0 || !CODING_KINDS.has(task.kind)) return undefined
    const mode = await this.mode()
    if (mode === undefined) return { declared, state: 'unchecked', reason: 'unreadable' }
    let changed: readonly string[] | undefined
    if (mode === 'git') {
      if (this.changedPaths === undefined) return { declared, state: 'unchecked', reason: 'unreadable', mode }
      try { changed = await this.changedPaths(this.workspacePath) } catch { changed = undefined }
      if (changed === undefined) return { declared, state: 'unchecked', reason: 'unreadable', mode }
      // A member that commits its work still wrote those paths. Without this the union is the working
      // tree alone, and a clean tree reads as "nothing changed" (found on a real stand).
      if (this.committedPaths !== undefined && attempt.gitBase !== undefined) {
        const committed = await this.committedPaths(this.workspacePath, attempt.gitBase.baseTipSha).catch(() => undefined)
        if (committed !== undefined) changed = [...changed, ...committed]
      }
    } else {
      // `files` mode: the changed set is the difference between the fingerprint taken when
      // the attempt claimed the task and the tree as it is now. A missing snapshot is
      // reported, never guessed around.
      if (this.snapshotTree === undefined) return { declared, state: 'unchecked', reason: 'unreadable', mode }
      let before: Readonly<Record<string, string>> | undefined
      try { before = JSON.parse(await fs.readFile(await this.snapshotPathFor(attempt.id), 'utf8')) as Record<string, string> } catch { before = undefined }
      if (before === undefined) return { declared, state: 'unchecked', reason: 'no-snapshot', mode }
      const after = await this.snapshotTree(this.workspacePath).catch(() => undefined)
      if (after === undefined) return { declared, state: 'unchecked', reason: 'too-many-files', mode }
      changed = diffSnapshots(before, after)
    }
    // Two things in the tree are not this task's work: the team's own state directory,
    // and the report the submission is made of. A `files` artifact is deliberately NOT
    // excluded — it names the changed files, so excluding them let a submission whitelist
    // any edit, and reported a real modification as an empty change set (F7 of the first
    // live run).
    const ignored = [TEAM_ROOT, ...(artifact.type === 'report' ? [artifact.bodyRef] : [])]
    const normalizedChanged = (changed ?? [])
      .map((entry) => normalizeScopePath(entry))
      .filter((entry): entry is string => entry !== undefined)
      .filter((entry) => !ignored.some((skip) => entry === skip || entry.startsWith(`${skip}/`)))
    const unexpected = outsideScope(normalizedChanged, declared)
    if (unexpected.length === 0) return { declared, changed: normalizedChanged, state: 'clean', mode }
    // An unexpected path inside another *active* task's declaration is not proof that
    // anybody touched anybody's file: in a shared tree it is usually the colleague's own
    // work in flight. It is reported as what it is — the tree is shared and moving.
    const sharedTree = unexpected.filter((candidate) => attempts.some((other) => other.status === 'active' && other.taskId !== task.id
      && (tasks.find((entry) => entry.id === other.taskId)?.paths ?? []).some((entry) => scopesIntersect(literalPrefix(entry), candidate))))
    return { declared, changed: normalizedChanged, unexpected, ...(sharedTree.length === 0 ? {} : { sharedTree }), state: sharedTree.length === 0 ? 'violation' : 'shared-tree', mode }
  }

  private async freezeArtifact(artifact: SubmissionSourceArtifact): Promise<SubmissionArtifact> {
    if (artifact.type === 'report') {
      if (typeof artifact.bodyRef !== 'string' || artifact.bodyRef.length === 0) fail('report bodyRef must be non-empty')
      const reportPath = path.resolve(this.workspacePath, artifact.bodyRef)
      if (reportPath !== this.workspacePath && !reportPath.startsWith(`${this.workspacePath}${path.sep}`)) fail('report bodyRef must stay inside the workspace')
      const body = await fs.readFile(reportPath)
      const bodyDigest = createHash('sha256').update(body).digest('hex')
      const blobPath = await this.storeBlob(bodyDigest, body)
      return { type: 'report', bodyRef: artifact.bodyRef, bodyDigest, ...(blobPath === undefined ? {} : { blobPath }) }
    }
    if (!Array.isArray(artifact.paths) || artifact.paths.length === 0 || !artifact.paths.every((entry) => typeof entry === 'string' && entry.length > 0)) fail('files artifact paths must be non-empty')
    const normalized = artifact.paths.map((file) => {
      const absolute = path.resolve(this.workspacePath, file)
      if (absolute !== this.workspacePath && !absolute.startsWith(`${this.workspacePath}${path.sep}`)) fail('file artifact paths must stay inside the workspace')
      return { input: file, absolute, relative: path.relative(this.workspacePath, absolute) }
    })
    const unique = new Set(normalized.map((entry) => entry.relative))
    if (unique.size !== normalized.length) fail('file artifact paths must be unique')
    const entries: { path: string; digest: string }[] = []
    const blobs: { path: string; digest: string; blobPath: string }[] = []
    for (const file of normalized) {
      // A list of files carries a digest per file, so it cannot name a file that is gone. A
      // deletion is submitted as a report: the commit is then built from the paths the work
      // actually changed, which includes removals. Saying so beats an ENOENT.
      let bytes: Buffer
      try { bytes = await fs.readFile(file.absolute) } catch { fail(`the file artifact names ${file.relative}, which is not on disk; a deletion is submitted as a report`) }
      const digest = createHash('sha256').update(bytes).digest('hex')
      entries.push({ path: file.relative, digest })
      const blobPath = await this.storeBlob(digest, bytes)
      if (blobPath !== undefined) blobs.push({ path: file.relative, digest, blobPath })
    }
    entries.sort((left, right) => left.path.localeCompare(right.path))
    return {
      type: 'files',
      paths: entries.map((entry) => entry.path),
      manifestDigest: createHash('sha256').update(JSON.stringify(entries)).digest('hex'),
      ...(blobs.length === entries.length ? { blobs } : {}),
    }
  }

  /**
   * Edit the contract of one task (B27).
   *
   * Only while nobody is working on it: an attempt is bound to the contract its
   * assignee is working from, and a human decision owns every later transition.
   */
  async updateTask(request: UpdateTaskRequest): Promise<UpdateTaskResult> {
    if (!candidateId(request.taskId) || request.actor.length === 0) fail('invalid update request')
    return withProcessLock(this.location.teamFile, async () => {
      const tasks = await this.readTasksIfPresentLocked()
      const task = tasks.tasks.find((entry) => entry.id === request.taskId)
      if (task === undefined) fail(`task not found: ${request.taskId}`)
      const team = await this.readTeamLocked()
      // The human holds the highest authority in the model, so the operations the lead may perform on
      // a contract the human may perform too — the routes fence who is asking, and the audit says which
      // of the two human actors it was (see `actorOf`).
      if (!isLeadOrHuman(team, request.actor)) fail(`only the lead may update tasks; ask ${leadMemberIdForMessage(team)}`)
      if (request.expectedRevision !== undefined && request.expectedRevision !== tasks.revision) {
        throw new LiveTeamsError(ERROR_CODES.REVISION_CONFLICT, `expected revision ${request.expectedRevision}, actual ${tasks.revision}`)
      }
      if (task.status !== 'draft' && task.status !== 'ready') {
        fail(`task cannot be updated in status ${task.status}; ${task.status === 'waiting' || task.status === 'needs_human' ? 'a human revision owns that transition' : 'only work nobody has started can be edited'}`)
      }
      const supplied = (['title', 'kind', 'assignee', 'route', 'acceptance', 'checks', 'why', 'body', 'roundLimit', 'humanContact', 'dependsOn', 'paths'] as const)
        .filter((field) => request[field] !== undefined)
      if (supplied.length === 0) fail('nothing to change')
      // Absent means "leave it"; null means "clear it" for the fields that may be empty.
      const merged = {
        title: request.title ?? task.title,
        kind: request.kind ?? task.kind,
        assignee: request.assignee === undefined ? task.assignee : request.assignee ?? undefined,
        route: request.route === undefined ? task.route : request.route ?? undefined,
        humanContact: request.humanContact ?? task.humanContact ?? 'none',
        acceptance: request.acceptance ?? task.acceptance,
        checks: request.checks ?? task.checks,
        why: request.why ?? task.why,
        body: request.body ?? task.body,
        roundLimit: request.roundLimit ?? task.roundLimit,
        dependsOn: request.dependsOn === undefined ? task.dependsOn : request.dependsOn ?? undefined,
        // Absent means "leave it"; null means "clear it", like the other optional fields.
        paths: request.paths === undefined ? task.paths : request.paths ?? undefined,
      }
      const normalized = this.validateContract(merged, team, tasks.tasks, task.id)
      // Absent checks and an empty list are the same contract; every other absent
      // field is compared as null, because undefined is not a stored value.
      const comparable = (field: string, value: unknown): string => JSON.stringify(field === 'checks' ? value ?? [] : value ?? null)
      const changed = (['title', 'kind', 'assignee', 'route', 'humanContact', 'acceptance', 'checks', 'why', 'body', 'roundLimit', 'dependsOn', 'paths'] as const)
        .filter((field) => comparable(field, task[field]) !== comparable(field, (normalized as Record<string, unknown>)[field]))
      // A no-op would bump the revision and write an audit record that says nothing.
      if (changed.length === 0) fail('nothing to change; the contract already matches')
      const attempts = await this.readAttemptsIfPresentLocked()
      // Fixing the contract of previously started, parked work is not an explicit restart.
      // Fresh drafts retain B27's normal readiness calculation; historical work needs resumeTask.
      const parked = task.status === 'draft' && attempts.attempts.some((entry) => entry.taskId === task.id)
      const now = Date.now()
      const nextTask: TeamTask = {
        ...task,
        title: normalized.title,
        kind: normalized.kind,
        status: parked ? 'draft' : normalized.status,
        acceptance: normalized.acceptance,
        roundLimit: normalized.roundLimit,
        humanContact: normalized.humanContact,
        contractRevision: (task.contractRevision ?? 0) + 1,
        updatedAt: now,
        revision: task.revision + 1,
      }
      // Clearing a field means the key is gone, not present-and-undefined: the
      // reader and every projection treat the two differently.
      const optional: Array<[ 'assignee' | 'route' | 'dependsOn' | 'why' | 'body' | 'checks' | 'paths', unknown ]> = [
        ['assignee', normalized.assignee],
        ['route', normalized.route],
        ['dependsOn', normalized.dependsOn],
        ['why', normalized.why],
        ['body', normalized.body],
        ['checks', normalized.checks === undefined || normalized.checks.length === 0 ? undefined : normalized.checks],
        ['paths', normalized.paths],
      ]
      for (const [field, value] of optional) {
        if (value === undefined) delete nextTask[field]
        else Object.assign(nextTask, { [field]: value })
      }
      const nextTasks: TasksState = { ...tasks, schemaVersion: TASKS_SCHEMA_VERSION, revision: tasks.revision + 1, tasks: tasks.tasks.map((entry) => entry.id === task.id ? nextTask : entry) }
      // The document is the contract a member reads, so it is re-rendered from the
      // record — never left showing the previous version.
      const document = renderDocument(nextTask, team, { tasks: tasks.tasks })
      await atomicWrite(this.documentPath(task.id), document)
      try {
        await atomicWriteJson(this.location.file, nextTasks)
      } catch (error) {
        await atomicWrite(this.documentPath(task.id), renderDocument(task, team, { tasks: tasks.tasks })).catch(() => undefined)
        throw error
      }
      await this.appendAudit({ kind: 'task/updated', taskId: task.id, actor: request.actor, fields: changed, at: now, revision: nextTasks.revision })
      const warnings = await diagnosePaths(this.workspacePath, nextTask.paths)
      return { task: clone(nextTask), document, changed, ...(warnings.length === 0 ? {} : { warnings }) }
    })
  }

  async claimTask(request: ClaimTaskRequest): Promise<ClaimTaskResult> {
    if (!candidateId(request.taskId) || request.memberId.length === 0 || request.sessionId.length === 0 || !Number.isInteger(request.bindingGeneration)) fail('invalid claim request')
    return withProcessLock(this.location.teamFile, async () => {
      const tasks = await this.readTasksIfPresentLocked()
      const task = tasks.tasks.find((entry) => entry.id === request.taskId)
      if (task === undefined) fail(`task not found: ${request.taskId}`)
      const attempts = await this.readAttemptsIfPresentLocked()
      const existing = task.activeAttemptId === undefined ? undefined : attempts.attempts.find((entry) => entry.id === task.activeAttemptId)
      if (existing?.status === 'active' && existing.memberId === request.memberId) return { task: clone(task), attempt: clone(existing) }
      if (task.assignee !== request.memberId) fail('only the task assignee may claim it')
      fenceMember((await this.readTeamLocked()).members.find((entry) => entry.memberId === request.memberId), request, request.memberId)
      if (task.status !== 'ready') fail(`task is not ready; current status is ${task.status}`)
      // The gate sits before any attempt is created, so a refused claim leaves no
      // trace: no attempt, no revision, no audit.
      const blockers = blockedBy(task, tasks.tasks)
      if (blockers.length > 0) {
        const first = blockers[0] as { id: string; title: string; status: TaskStatus }
        fail(`task is blocked by ${first.id} "${first.title}" (${first.status})${blockers.length > 1 ? ` and ${blockers.length - 1} more` : ''}`)
      }
      if (existing?.status === 'active') fail('task already has an active attempt owned by another member')
      if (attempts.attempts.some((entry) => entry.memberId === request.memberId && entry.status === 'active')) fail('member already has an active attempt')
      const now = Date.now()
      const priorGenerations = attempts.attempts.filter((entry) => entry.taskId === task.id).map((entry) => entry.generation)
      const generation = (priorGenerations.length === 0 ? 0 : Math.max(...priorGenerations)) + 1
      const attempt: TaskAttempt = { id: `attempt-${randomUUID()}`, taskId: task.id, memberId: request.memberId, sessionId: request.sessionId, bindingGeneration: request.bindingGeneration, generation, status: 'active', startedAt: now, revision: attempts.revision + 1 }
      const nextTask = { ...task, status: 'claimed' as const, activeAttemptId: attempt.id, updatedAt: now, revision: task.revision + 1 }
      const nextTasks: TasksState = { ...tasks, revision: tasks.revision + 1, tasks: tasks.tasks.map((entry) => entry.id === task.id ? nextTask : entry) }
      const nextAttempts: AttemptsState = { ...attempts, revision: attempts.revision + 1, attempts: [...attempts.attempts, attempt] }
      await atomicWriteJson(this.location.file, nextTasks)
      try { await atomicWriteJson(this.location.attemptsFile, nextAttempts) } catch (error) {
        await atomicWriteJson(this.location.file, tasks)
        throw error
      }
      // B32: in `files` mode the changed set at submission is a diff against this moment.
      await this.takeSnapshot(attempt.id)
      // Phase 6: in Git mode the attempt remembers the branch and tip it started from — that
      // record is what the acceptance precondition is checked against later.
      if (this.git !== undefined && await this.mode() === 'git') {
        const base = await this.git.base(this.workspacePath).catch(() => undefined)
        if (base !== undefined) {
          const current = await this.readAttemptsIfPresentLocked()
          const withBase: AttemptsState = {
            ...current,
            schemaVersion: CURRENT_SCHEMA_VERSION,
            revision: current.revision + 1,
            attempts: current.attempts.map((entry) => entry.id === attempt.id ? { ...entry, gitBase: { ref: base.ref, baseTipSha: base.sha }, revision: entry.revision + 1 } : entry),
          }
          await atomicWriteJson(this.location.attemptsFile, withBase)
        }
      }
      await this.appendAudit({ kind: 'task/claimed', taskId: task.id, memberId: request.memberId, attemptId: attempt.id, actor: request.memberId, at: now, revision: nextTasks.revision })
      await this.appendAudit({ kind: 'attempt/started', taskId: task.id, memberId: request.memberId, attemptId: attempt.id, actor: request.memberId, at: now, revision: nextAttempts.revision })
      return { task: clone(nextTask), attempt: clone(attempt) }
    })
  }

  /**
   * Take work away from its current attempt (B28, ADR 0005).
   *
   * The order matters and is the contract: the capability is invalidated and made
   * durable *before* the session is asked to stop, so a session that keeps running
   * cannot write anything; and `revoked` is only ever reported once quiescence has
   * actually been observed. When it has not, the attempt stays `revoking` and the
   * task goes to the human rather than claiming a stop that did not happen.
   */
  async revokeTask(request: RevokeTaskRequest): Promise<RevokeTaskResult> {
    if (!candidateId(request.taskId) || request.actor.length === 0) fail('invalid revoke request')
    if (typeof request.reason !== 'string' || request.reason.trim().length === 0) fail('revocation reason must be non-empty')
    const reason = request.reason.trim()
    const invalidated = await withProcessLock(this.location.teamFile, async () => {
      const tasks = await this.readTasksIfPresentLocked()
      const task = tasks.tasks.find((entry) => entry.id === request.taskId)
      if (task === undefined) fail(`task not found: ${request.taskId}`)
      const team = await this.readTeamLocked()
      if (!isLeadOrHuman(team, request.actor)) fail(`only the lead may revoke tasks; ask ${leadMemberIdForMessage(team)}`)
      if (request.expectedRevision !== undefined && request.expectedRevision !== tasks.revision) {
        throw new LiveTeamsError(ERROR_CODES.REVISION_CONFLICT, `expected revision ${request.expectedRevision}, actual ${tasks.revision}`)
      }
      if (!['claimed', 'in_progress', 'waiting', 'needs_human'].includes(task.status)) fail(`task cannot be revoked in status ${task.status}`)
      if (task.integrationPending !== undefined) fail('task has an unresolved integration; reconcile its Git outcome before revoking')
      const attempts = await this.readAttemptsIfPresentLocked()
      const bound = task.activeAttemptId === undefined ? undefined : attempts.attempts.find((entry) => entry.id === task.activeAttemptId)
      // A `revoking` attempt is resumable: the durable intermediate state exists
      // precisely so that a transaction interrupted after invalidation can be
      // finished instead of wedging the task forever.
      const attempt = bound?.status === 'active' || bound?.status === 'revoking' ? bound : undefined
      if (attempt === undefined) fail('task has no active attempt to revoke')
      // Everything that can refuse is checked *before* the attempt is invalidated:
      // a refusal that left the attempt revoking would wedge the task with nobody
      // able to write to it.
      if (request.nextAssignee !== undefined) {
        if (memberById(team, request.nextAssignee) === undefined) fail(`assignee is not a current team member: ${request.nextAssignee}`)
        if (task.route !== undefined) validateRoute(task.route, team, request.nextAssignee)
      }
      const now = Date.now()
      const revoking: TaskAttempt = { ...attempt, status: 'revoking', revision: attempt.revision + 1 }
      const nextAttempts: AttemptsState = { ...attempts, schemaVersion: CURRENT_SCHEMA_VERSION, revision: attempts.revision + 1, attempts: attempts.attempts.map((entry) => entry.id === attempt.id ? revoking : entry) }
      // The task keeps its status while the attempt is only revoking: the work is
      // still nominally owned until the session is observed to have stopped.
      await atomicWriteJson(this.location.attemptsFile, nextAttempts)
      // Only the transition into `revoking` is an event. Resuming an interrupted
      // transaction re-states the same invalidation, and logging it twice would
      // claim the attempt was invalidated twice.
      if (attempt.status === 'active') {
        await this.appendAudit({ kind: 'attempt/revoking', taskId: task.id, attemptId: attempt.id, memberId: attempt.memberId, reason, actor: request.actor, at: now, revision: nextAttempts.revision })
      }
      return { task, attempt: revoking }
    })

    const { task, attempt } = invalidated
    if (this.interruptSession === undefined || this.awaitQuiescence === undefined) {
      // Without the runtime hooks a revocation cannot be honest, so the attempt is
      // left revoking and the task escalates instead of silently succeeding.
      return this.settleRevocation(task, attempt, false, request, reason)
    }
    try { await this.interruptSession(attempt.sessionId, reason) } catch { /* the fence is what protects the task */ }
    const quiesced = await this.awaitQuiescence(attempt.sessionId, this.quiescenceTimeoutMs).catch(() => false)
    return this.settleRevocation(task, attempt, quiesced, request, reason)
  }

  /** Mark the settled outcome: revoked and re-owned, or escalated to the human. */
  private async settleRevocation(task: TeamTask, attempt: TaskAttempt, quiesced: boolean, request: RevokeTaskRequest, reason: string): Promise<RevokeTaskResult> {
    return withProcessLock(this.location.teamFile, async () => {
      const tasks = await this.readTasksIfPresentLocked()
      const current = tasks.tasks.find((entry) => entry.id === task.id)
      if (current === undefined) fail(`task not found: ${task.id}`)
      const attempts = await this.readAttemptsIfPresentLocked()
      const stored = attempts.attempts.find((entry) => entry.id === attempt.id)
      if (stored === undefined) fail(`attempt not found: ${attempt.id}`)
      if (current.activeAttemptId !== stored.id || stored.status !== 'revoking' || current.archivedPath !== undefined) {
        throw new LiveTeamsError(ERROR_CODES.REVISION_CONFLICT, 'task or attempt changed while waiting for Session quiescence; read it again')
      }
      const team = await this.readTeamLocked()
      const now = Date.now()
      if (!quiesced) {
        const escalated: TeamTask = { ...current, status: 'needs_human', updatedAt: now, revision: current.revision + 1 }
        const nextTasks: TasksState = { ...tasks, schemaVersion: TASKS_SCHEMA_VERSION, revision: tasks.revision + 1, tasks: tasks.tasks.map((entry) => entry.id === current.id ? escalated : entry) }
        await atomicWriteJson(this.location.file, nextTasks)
        await this.appendAudit({ kind: 'attempt/revoke-timeout', taskId: current.id, attemptId: attempt.id, memberId: attempt.memberId, reason, actor: request.actor, at: now, revision: nextTasks.revision })
        return { task: clone(escalated), attempt: clone(stored), quiesced: false, reassigned: false }
      }
      const revoked: TaskAttempt = { ...stored, status: 'revoked', revision: stored.revision + 1 }
      const nextAttempts: AttemptsState = { ...attempts, schemaVersion: CURRENT_SCHEMA_VERSION, revision: attempts.revision + 1, attempts: attempts.attempts.map((entry) => entry.id === stored.id ? revoked : entry) }
      // Ownership moves only here, and the route must still make sense for the new
      // owner: a reviewer cannot become the assignee of their own review route.
      // A member who has left the team cannot keep the task. The requested owner was
      // validated before invalidation; here the *previous* owner is the only
      // unknown, and "nobody owns it" is a real answer — the task returns to draft.
      const candidate = request.nextAssignee ?? current.assignee
      const nextAssignee = candidate !== undefined && memberById(team, candidate) !== undefined ? candidate : undefined
      const reassigned = nextAssignee !== undefined && nextAssignee !== current.assignee
      const ready: TeamTask = {
        ...current,
        // Revocation stops work; it is not permission for automatic dispatch to start it again.
        status: 'draft',
        awaitsDecision: false,
        updatedAt: now,
        revision: current.revision + 1,
      }
      if (nextAssignee === undefined) delete ready.assignee
      else ready.assignee = nextAssignee
      delete ready.activeAttemptId
      const nextTasks: TasksState = { ...tasks, schemaVersion: TASKS_SCHEMA_VERSION, revision: tasks.revision + 1, tasks: tasks.tasks.map((entry) => entry.id === current.id ? ready : entry) }
      await atomicWriteJson(this.location.attemptsFile, nextAttempts)
      await atomicWriteJson(this.location.file, nextTasks)
      await this.appendAudit({ kind: 'attempt/revoked', taskId: current.id, attemptId: stored.id, memberId: stored.memberId, reason, quiesced, actor: request.actor, at: now, revision: nextAttempts.revision })
      if (reassigned) await this.appendAudit({ kind: 'task/reassigned', taskId: current.id, from: current.assignee, to: nextAssignee, actor: request.actor, at: now, revision: nextTasks.revision })
      return { task: clone(ready), attempt: clone(revoked), quiesced: true, reassigned }
    })
  }

  /** Explicitly release parked work; no attempt is minted until the normal claim path runs. */
  async resumeTask(request: { taskId: string; actor: string; expectedRevision?: number }): Promise<{ task: TeamTask }> {
    if (!candidateId(request.taskId) || request.actor.length === 0) fail('invalid resume request')
    return withProcessLock(this.location.teamFile, async () => {
      const tasks = await this.readTasksIfPresentLocked()
      const task = tasks.tasks.find((entry) => entry.id === request.taskId)
      if (task === undefined) fail(`task not found: ${request.taskId}`)
      const team = await this.readTeamLocked()
      if (!isLeadOrHuman(team, request.actor)) fail(`only the lead may resume tasks; ask ${leadMemberIdForMessage(team)}`)
      if (request.expectedRevision !== undefined && request.expectedRevision !== tasks.revision) {
        throw new LiveTeamsError(ERROR_CODES.REVISION_CONFLICT, `expected revision ${request.expectedRevision}, actual ${tasks.revision}`)
      }
      if (task.status !== 'draft' || task.archivedPath !== undefined) fail('only a parked draft task can be resumed')
      const attempts = await this.readAttemptsIfPresentLocked()
      if (attempts.attempts.some((entry) => entry.taskId === task.id && (entry.status === 'active' || entry.status === 'revoking'))) fail('task still has an active or revoking attempt')
      if (task.integrationPending !== undefined) fail('task has an unresolved integration')
      const contract = this.validateContract({ ...task, humanContact: task.humanContact ?? 'none', assignee: task.assignee, route: task.route, checks: task.checks, why: task.why, body: task.body, dependsOn: task.dependsOn, paths: task.paths }, team, tasks.tasks, task.id)
      if (contract.status !== 'ready') fail('resume requires an assignee, route and acceptance criteria')
      const now = Date.now()
      const nextTask: TeamTask = { ...task, status: 'ready', awaitsDecision: false, revision: task.revision + 1, updatedAt: now }
      delete nextTask.activeAttemptId
      const nextTasks: TasksState = { ...tasks, revision: tasks.revision + 1, tasks: tasks.tasks.map((entry) => entry.id === task.id ? nextTask : entry) }
      await atomicWriteJson(this.location.file, nextTasks)
      await this.appendAudit({ kind: 'task/resumed', taskId: task.id, actor: request.actor, at: now, revision: nextTasks.revision })
      return { task: clone(nextTask) }
    })
  }

  async acknowledgeTask(request: AcknowledgeTaskRequest): Promise<{ task: TeamTask }> {
    if (!candidateId(request.taskId) || request.memberId.length === 0) fail('invalid acknowledge request')
    return withProcessLock(this.location.teamFile, async () => {
      const tasks = await this.readTasksIfPresentLocked()
      const task = tasks.tasks.find((entry) => entry.id === request.taskId)
      if (task === undefined) fail(`task not found: ${request.taskId}`)
      if (task.assignee !== request.memberId) fail('only the task assignee may acknowledge it')
      fenceMember((await this.readTeamLocked()).members.find((entry) => entry.memberId === request.memberId), request, request.memberId)
      if (task.status === 'in_progress') return { task: clone(task) }
      if (task.status !== 'claimed') fail(`task is not claimed; current status is ${task.status}`)
      const attempts = await this.readAttemptsIfPresentLocked()
      const attempt = task.activeAttemptId === undefined ? undefined : attempts.attempts.find((entry) => entry.id === task.activeAttemptId && entry.status === 'active')
      if (attempt === undefined || attempt.memberId !== request.memberId) fail('task has no active attempt for this member')
      const now = Date.now()
      const nextTask = { ...task, status: 'in_progress' as const, updatedAt: now, revision: task.revision + 1 }
      const nextTasks: TasksState = { ...tasks, revision: tasks.revision + 1, tasks: tasks.tasks.map((entry) => entry.id === task.id ? nextTask : entry) }
      await atomicWriteJson(this.location.file, nextTasks)
      await this.appendAudit({ kind: 'task/acknowledged', taskId: task.id, memberId: request.memberId, attemptId: attempt.id, actor: request.memberId, at: now, revision: nextTasks.revision })
      return { task: clone(nextTask) }
    })
  }

  async createTask(request: CreateTaskRequest): Promise<CreateTaskResult> {
    return withProcessLock(this.location.teamFile, async () => {
      const team = await this.readTeamLocked()
      if (!isLeadOrHuman(team, request.actor)) fail(`only the lead may create tasks; ask ${leadMemberIdForMessage(team)}`)
      // Do not initialise tasks.json before validation: a refused request must
      // leave no task-store write behind. The first successful creation publishes
      // the complete state atomically after its document.
      const current = await this.readTasksIfPresentLocked()
      if (request.expectedRevision !== undefined && request.expectedRevision !== current.revision) {
        throw new LiveTeamsError(ERROR_CODES.REVISION_CONFLICT, `expected revision ${request.expectedRevision}, actual ${current.revision}`)
      }
      const normalized = this.validateCreate(request, team, current.tasks)
      const now = Date.now()
      const id = `task-${randomUUID()}`
      const task: TeamTask = {
        id,
        teamId: this.teamId,
        title: normalized.title,
        kind: normalized.kind,
        status: normalized.status,
        ...(normalized.assignee === undefined ? {} : { assignee: normalized.assignee }),
        ...(normalized.route === undefined ? {} : { route: normalized.route }),
        humanContact: normalized.humanContact,
        ...(normalized.dependsOn === undefined ? {} : { dependsOn: normalized.dependsOn }),
        ...(normalized.why === undefined ? {} : { why: normalized.why }),
        ...(normalized.body === undefined ? {} : { body: normalized.body }),
        ...(normalized.checks.length === 0 ? {} : { checks: normalized.checks }),
        ...(normalized.paths === undefined ? {} : { paths: normalized.paths }),
        acceptance: normalized.acceptance,
        roundLimit: normalized.roundLimit,
        contractRevision: 1,
        createdBy: request.actor,
        createdAt: now,
        updatedAt: now,
        revision: current.revision + 1,
      }
      const documentPath = this.documentPath(id)
      const document = renderDocument(task, team, { tasks: current.tasks })
      await atomicWrite(documentPath, document)
      const next: TasksState = { ...current, schemaVersion: CURRENT_SCHEMA_VERSION, revision: current.revision + 1, tasks: [...current.tasks, task] }
      try {
        await atomicWriteJson(this.location.file, next)
      } catch (error) {
        await fs.unlink(documentPath).catch(() => undefined)
        throw error
      }
      const auditAt = Date.now()
      await this.appendAudit({ kind: 'task/created', id, taskId: id, title: task.title, assignee: task.assignee, routeType: task.route?.type, actor: request.actor, at: auditAt, revision: next.revision })
      await this.appendAudit({ kind: 'task/document', id, taskId: id, path: documentPath, actor: request.actor, at: Date.now() })
      const warnings = await diagnosePaths(this.workspacePath, task.paths)
      return { task: clone(task), documentPath, ...(warnings.length === 0 ? {} : { warnings }) }
    })
  }

  private get teamId(): string { return path.basename(this.location.directory) }

  private documentPath(taskId: string): string {
    return path.join(this.location.tasksDirectory, `${taskId}.md`)
  }

  private async readOrCreateLocked(): Promise<TasksState> {
    await fs.mkdir(this.location.directory, { recursive: true })
    return this.readTasksIfPresentLocked()
  }

  private async readTasksIfPresentLocked(): Promise<TasksState> {
    if (!(await fileExists(this.location.file))) return { schemaVersion: CURRENT_SCHEMA_VERSION, revision: 0, teamId: this.teamId, tasks: [] }
    try { return parseTasksState(await readJson(this.location.file), this.teamId, this.location.archiveDirectory) } catch (error) {
      if (error instanceof LiveTeamsError) throw error
      throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, `cannot read ${this.location.file}`, { cause: error })
    }
  }

  private async readAttemptsIfPresentLocked(): Promise<AttemptsState> {
    if (!(await fileExists(this.location.attemptsFile))) return { schemaVersion: CURRENT_SCHEMA_VERSION, revision: 0, teamId: this.teamId, attempts: [] }
    try { return parseAttemptsState(await readJson(this.location.attemptsFile), this.teamId) } catch (error) {
      if (error instanceof LiveTeamsError) throw error
      throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, `cannot read ${this.location.attemptsFile}`, { cause: error })
    }
  }

  private async readSubmissionsIfPresentLocked(): Promise<SubmissionsState> {
    if (!(await fileExists(this.location.submissionsFile))) return { schemaVersion: CURRENT_SCHEMA_VERSION, revision: 0, teamId: this.teamId, submissions: [] }
    try { return parseSubmissionsState(await readJson(this.location.submissionsFile), this.teamId) } catch (error) {
      if (error instanceof LiveTeamsError) throw error
      throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, `cannot read ${this.location.submissionsFile}`, { cause: error })
    }
  }

  private async readReviewsIfPresentLocked(): Promise<ReviewsState> {
    if (!(await fileExists(this.location.reviewsFile))) return { schemaVersion: CURRENT_SCHEMA_VERSION, revision: 0, teamId: this.teamId, rounds: [] }
    try { return parseReviewsState(await readJson(this.location.reviewsFile), this.teamId) } catch (error) {
      if (error instanceof LiveTeamsError) throw error
      throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, `cannot read ${this.location.reviewsFile}`, { cause: error })
    }
  }

  private async readTeamLocked(): Promise<TeamState> {
    let value: unknown
    try { value = await readJson(this.location.teamFile) } catch (error) {
      throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, `cannot read team state: ${this.location.teamFile}`, { cause: error })
    }
    const team = objectRecord(value)
    if (team === undefined || team.teamId !== this.teamId || !Array.isArray(team.members)) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, 'invalid team state')
    return team as unknown as TeamState
  }

  private validateCreate(request: CreateTaskRequest, team: TeamState, existing: readonly TeamTask[]): { title: string; kind: TaskKind; assignee?: string; route?: TaskRoute; humanContact: HumanContact; acceptance: string[]; checks: string[]; why?: string; body?: string; roundLimit: number; dependsOn?: string[]; paths?: string[]; status: TaskStatus } {
    return this.validateContract({
      title: request.title,
      kind: request.kind,
      assignee: request.assignee,
      route: request.route,
      humanContact: request.humanContact ?? 'none',
      acceptance: request.acceptance,
      checks: request.checks,
      why: request.why,
      body: request.body,
      roundLimit: request.roundLimit ?? 5,
      dependsOn: request.dependsOn,
      paths: request.paths,
    }, team, existing, undefined)
  }

  /**
   * The one place the contract rules live, shared by creation (B19) and editing
   * (B27): a second copy of them is how the writer and the reader start to
   * disagree about what a valid contract is.
   */
  private validateContract(
    input: { title: unknown; kind: unknown; assignee: unknown; route: unknown; humanContact: unknown; acceptance: unknown; checks: unknown; why: unknown; body: unknown; roundLimit: unknown; dependsOn: unknown; paths: unknown },
    team: TeamState,
    existing: readonly TeamTask[],
    selfId: string | undefined,
  ): { title: string; kind: TaskKind; assignee?: string; route?: TaskRoute; humanContact: HumanContact; acceptance: string[]; checks: string[]; why?: string; body?: string; roundLimit: number; dependsOn?: string[]; paths?: string[]; status: TaskStatus } {
    const request = input as { title: string; kind: TaskKind; assignee?: string; route?: TaskRoute; humanContact?: HumanContact; acceptance: readonly string[]; checks?: readonly string[]; why?: string; body?: string; roundLimit?: number; dependsOn?: readonly string[]; paths?: readonly string[] }
    if (!nonEmpty(request.title)) fail('title must be non-empty')
    const title = request.title.trim()
    if (chars(title) > MAX_TITLE) fail(`title must be at most ${MAX_TITLE} characters`)
    if (!TASK_KINDS.includes(request.kind)) fail(`unsupported task kind: ${String(request.kind)}`)
    if (request.assignee !== undefined) {
      if (typeof request.assignee !== 'string' || memberById(team, request.assignee) === undefined) fail(`assignee is not a current team member: ${String(request.assignee)}`)
    }
    const route = request.route === undefined ? undefined : validateRoute(request.route, team, request.assignee)
    const humanContact = request.humanContact ?? 'none'
    if (humanContact !== 'none' && humanContact !== 'expected' && humanContact !== 'required') fail('humanContact must be none, expected, or required')
    if (!Array.isArray(request.acceptance)) fail('acceptance must be an array')
    const acceptance = request.acceptance.map((entry) => typeof entry === 'string' ? entry.trim() : '')
    const status: TaskStatus = request.assignee !== undefined && route !== undefined ? 'ready' : 'draft'
    if (!acceptance.every((entry) => entry.length > 0) && status === 'ready') fail('acceptance criteria must be non-empty strings')
    if (status === 'ready' && acceptance.length === 0) fail('ready tasks require non-empty acceptance')
    const roundLimit = request.roundLimit ?? 5
    if (!Number.isInteger(roundLimit) || roundLimit < 1 || roundLimit > 20) fail('roundLimit must be an integer from 1 to 20')
    if (request.body !== undefined && (typeof request.body !== 'string' || chars(request.body) > MAX_BODY)) fail(`body must be at most ${MAX_BODY} characters`)
    if (request.why !== undefined && typeof request.why !== 'string') fail('why must be a string')
    if (request.checks !== undefined && (!Array.isArray(request.checks) || !request.checks.every((entry) => typeof entry === 'string'))) fail('checks must be an array of strings')
    const checks = request.checks === undefined ? [] : request.checks.map((entry) => entry.trim()).filter((entry) => entry.length > 0)
    const why = request.why === undefined ? undefined : request.why.trim()
    const body = request.body === undefined ? undefined : request.body
    // Keep the task status invariant explicit even if this method is extended:
    // a ready task always carries both its route and acceptance criteria.
    if (status === 'ready' && (route === undefined || acceptance.length === 0)) fail('ready tasks require route and acceptance')
    // A new task cannot be part of a cycle (nothing points at it yet), so the id is
    // only passed when an existing contract is being edited.
    const dependsOn = validateDependencies(request.dependsOn, selfId, existing)
    // A declaration is the lead's promise about what the task touches, so a malformed
    // one is refused here rather than stored and quietly compared later.
    let paths: string[] | undefined
    if (request.paths !== undefined && request.paths !== null) {
      paths = normalizeScope(request.paths)
      if (paths === undefined) fail(`paths must be 1 to ${MAX_PATHS} unique workspace-relative globs without ".." or an absolute path`)
    }
    return { title, kind: request.kind, ...(request.assignee === undefined ? {} : { assignee: request.assignee }), ...(route === undefined ? {} : { route }), humanContact, acceptance, checks, ...(why === undefined ? {} : { why }), ...(body === undefined ? {} : { body }), roundLimit, ...(dependsOn === undefined ? {} : { dependsOn }), ...(paths === undefined ? {} : { paths }), status }
  }
}

export function createTaskStore(options: TaskStoreOptions): TaskStore { return new TaskStore(options) }
export { renderDocument }
