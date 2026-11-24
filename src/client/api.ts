import { parseReviewReturn, type ReviewReturn } from '../review-return-state.js'
export type { ReviewReturn } from '../review-return-state.js'

export type TeamMember = {
  memberId: string
  note?: string
  displayName: string
  role: string
  availability: string
  sessionId: string | null
  live: boolean
  status: 'idle' | 'running' | 'unknown'
  bindingGeneration: number
  contractRevision: number
  permittedContacts?: string[]
}

export type TeamSnapshot = {
  teamName?: string
  leadMemberId?: string
  teamId: string
  workspacePath: string
  revision: number
  members: TeamMember[]
}

export type MessageKind = 'message' | 'direction' | 'comment'
export type TeamInboxMessage = {
  id: string
  from: string
  fromName: string
  kind: MessageKind
  content: string
  createdAt: number
  delivery: { id: string; state: 'stored' | 'acknowledged'; acknowledgedAt?: number }
}
export type TeamInbox = { teamId: string; messages: TeamInboxMessage[] }

/**
 * One member who is waiting for the human. Small on purpose: the chip that shows
 * this lives in the Session header of every Session and must not pull the inbox.
 */
export type TeamAttentionEntry = {
  memberId: string
  name: string
  sessionId: string | null
  waiting: number
  since: number
  kind: MessageKind
}
export type TeamAttention = { teamId: string; attention: TeamAttentionEntry[] }
export type JournalCategory = 'message' | 'delivery' | 'task' | 'review' | 'contact' | 'team' | 'member' | 'other'
export type TeamJournalEntry = {
  id: string
  kind: string
  category: JournalCategory
  at: number
  actor?: string
  actorName?: string
  summary: string
  refs: { taskId?: string; taskTitle?: string; messageId?: string; round?: number   /** Everything the row knows, resolved for a person: who, to whom, which task, which attempt. */
  fields?: { label: string; value: string }[]
  /** The summary split into plain and emphasised runs: names are names, not words. */
  summaryParts?: { text: string; strong?: boolean }[]
}
  detail?: string
}
export type TeamJournal = { teamId: string; entries: TeamJournalEntry[] }
export type SendMessageResult = {
  messageId: string
  recipients: string[]
  deliveries: Array<{ id: string; recipient: string; state: string; failure?: string }>
}

export type TeamCandidate = {
  sessionId: string
  title: string | null
  cwd: string
  live: boolean
  status: 'idle' | 'running' | 'unknown'
}

export type TeamCandidates = {
  teamId: string
  /** Name the listed Sessions are titled with, so `"<member> - <team>"` can be undone. */
  teamName: string
  workspacePath: string
  revision: number
  candidates: TeamCandidate[]
}

export type TeamAdoptionCandidate = {
  teamId: string
  name?: string
  memberCount?: number
  updatedAt?: number
  usable?: boolean
  reason?: string
}

export type TeamAdoptionCandidates = {
  teamId: string
  workspacePath: string
  candidates: TeamAdoptionCandidate[]
}

export type TeamRole = {
  id: string
  name: string
  description?: string
  aliases: string[]
  source: 'global' | 'workspace'
  overridden: boolean
}

export type TeamRoles = {
  roles: TeamRole[]
  globalDirectory: string
  workspaceDirectory: string
  workspaceDirectoryExists: boolean
  openAvailable: boolean
  globalOpenAvailable: boolean
}

export type TaskStatus = 'draft' | 'ready' | 'claimed' | 'in_progress' | 'waiting' | 'needs_human' | 'completed' | 'failed' | 'cancelled'
export type TaskRoute =
  | { type: 'report'; to: string | 'human' }
  | { type: 'review'; reviewer: string }
  | { type: 'interactive'; then: TaskRoute }
  | { type: 'custom'; description: string }
export type TaskRouteSummary =
  | { type: 'report'; to: string | 'human'; toName?: string }
  | { type: 'review'; reviewer: string; reviewerName?: string }
  | { type: 'interactive'; then: TaskRouteSummary }
  | { type: 'custom'; description: string }

export type TeamTask = {
  reviewReturn?: ReviewReturn
  id: string
  teamId: string
  title: string
  kind: string
  status: TaskStatus
  assignee?: string
  route?: TaskRoute
  humanContact?: 'none' | 'expected' | 'required'
  activeAttemptId?: string
  latestSubmissionId?: string
  acceptedSubmissionId?: string
  acceptance: string[]
  /** Checks and declared paths are part of the contract the human edits. */
  checks?: string[]
  paths?: string[]
  roundLimit: number
  createdBy: string
  createdAt: number
  updatedAt: number
  revision: number
  archivedPath?: string
  documentMissing?: boolean
}

export type TaskSummary = {
  reviewReturn?: ReviewReturn
  id: string
  title: string
  status: TaskStatus
  assignee?: string
  assigneeName?: string
  route?: TaskRouteSummary
  round?: number
  roundLimit?: number
  updatedAt: number
  archivedPath?: string
  documentMissing?: boolean
  dependsOn?: string[]
  blockedBy?: Array<{ id: string; title: string; status: TaskStatus }>
  /** A submission is in and nobody has decided on it. */
  awaitsDecision?: boolean
  /** Declared write paths, so the contract form can be filled without a second read. */
  paths?: string[]
  checks?: string[]
}

export type SubmissionArtifact =
  | { type: 'report'; bodyRef: string; bodyDigest: string }
  | { type: 'files'; paths: string[]; manifestDigest: string }
export type SubmissionCheck = { command: string; status: 'passed' | 'failed'; output?: string }
export type TeamSubmissionScope = {
  declared?: string[]
  changed?: string[]
  unexpected?: string[]
  sharedTree?: string[]
  state: 'clean' | 'violation' | 'shared-tree' | 'unchecked'
  /** B32: `git` in a work tree, `files` in a folder that is not a repository. */
  mode?: 'git' | 'files'
  reason?: 'no-repository' | 'too-many-files' | 'no-snapshot' | 'unreadable'
}
export type Submission = {
  id: string
  taskId: string
  attemptId: string
  attemptGeneration: number
  artifact: SubmissionArtifact
  summary: string
  checks: SubmissionCheck[]
  scope?: TeamSubmissionScope
  createdAt: number
  revision: number
}
export type ReviewFinding = { severity: 'low' | 'medium' | 'high' | 'blocker'; problem: string; requiredFix: string; artifactLocation?: string }
export type ReviewRound = {
  id: string
  taskId: string
  submissionId: string
  reviewerMemberId: string
  round: number
  verdict: 'pass' | 'needs_revision' | 'escalate'
  findings: ReviewFinding[]
  evidence: SubmissionCheck[]
  createdAt: number
  revision: number
}
export type TeamTasks = { teamId: string; tasks: TaskSummary[] }
export type TeamAttemptStatus = 'active' | 'revoking' | 'revoked' | 'completed' | 'failed'
export type TeamTaskAttempt = {
  id: string
  memberId: string
  sessionId: string
  generation: number
  status: TeamAttemptStatus
  startedAt: number
  humanIntervenedAt?: number
}
export type TeamTaskDetail = { task: TeamTask; document: string; documentMissing?: true; submissions: Submission[]; rounds: ReviewRound[]; attempts: TeamTaskAttempt[] }
export type AcceptTaskResult = { task: TeamTask; archivedPath: string }
export type CancelTaskResult = { task: TeamTask; archivedPath?: string; quiesced: boolean }
export type PathWarning = { code: 'path-no-match' | 'path-scan-incomplete'; pattern: string; message: string }
function pathWarnings(value: unknown): PathWarning[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new Error('invalid path warnings')
  return value.map((item) => {
    const entry = record(item)
    if ((entry.code !== 'path-no-match' && entry.code !== 'path-scan-incomplete') || text(entry.pattern) === undefined || text(entry.message) === undefined) throw new Error('invalid path warning')
    return { code: entry.code, pattern: entry.pattern as string, message: entry.message as string }
  })
}
export type ReviseTaskResult = { task: TeamTask }

/** The workspace folder action only exists after override created its folder. */
export function canOpenWorkspaceRoles(roles: Pick<TeamRoles, 'openAvailable' | 'workspaceDirectoryExists'>): boolean {
  return roles.openAvailable && roles.workspaceDirectoryExists
}

export type CreateSessionSuccess = {
  teamId: string
  memberId: string
  sessionId: string
  revision: number
  applied: true
  retried: boolean
  member: TeamMember
}

export type MutationSuccess = {
  teamId: string
  memberId: string
  revision: number
  applied: true
  retried: boolean
  member: TeamMember
}

export type InterruptTurnSuccess = {
  memberId: string
  interrupted: true
  status: 'idle' | 'running' | 'unknown'
}

export type RemoveMemberSuccess = {
  teamId: string
  memberId: string
  revision: number
  applied: true
  retried: boolean
  removed: {
    memberId: string
    displayName: string
    role: string
    sessionId: string | null
  }
}

export type MutationConflict = {
  revision: number
  members: TeamMember[]
}

export class LiveTeamsApiError extends Error {
  readonly status: number
  readonly error: string
  readonly conflict: MutationConflict | null

  constructor(status: number, error: string, conflict: MutationConflict | null = null) {
    super(error)
    this.name = 'LiveTeamsApiError'
    this.status = status
    this.error = error
    this.conflict = conflict
  }
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function member(value: unknown): TeamMember {
  const candidate = record(value)
  const memberId = text(candidate.memberId)
  const displayName = text(candidate.displayName)
  const role = text(candidate.role)
  const availability = text(candidate.availability)
  const sessionId = candidate.sessionId
  const status = candidate.status
  if (memberId === undefined || displayName === undefined || role === undefined || availability === undefined
    || (sessionId !== null && text(sessionId) === undefined)
    || typeof candidate.live !== 'boolean'
    || (status !== 'idle' && status !== 'running' && status !== 'unknown')
    || !nonNegativeInteger(candidate.bindingGeneration) || !nonNegativeInteger(candidate.contractRevision)) {
    throw new Error('invalid team member response')
  }
  const permittedContacts = candidate.permittedContacts
  if (permittedContacts !== undefined && (!Array.isArray(permittedContacts) || !permittedContacts.every((contact): contact is string => text(contact) !== undefined))) {
    throw new Error('invalid team member response')
  }
  return {
    memberId,
    ...(typeof candidate.note === 'string' ? { note: candidate.note } : {}),
    displayName,
    role,
    availability,
    sessionId: sessionId === null ? null : String(sessionId),
    live: candidate.live,
    status,
    bindingGeneration: candidate.bindingGeneration,
    contractRevision: candidate.contractRevision,
    ...(permittedContacts === undefined ? {} : { permittedContacts: [...permittedContacts] }),
  }
}

function members(value: unknown): TeamMember[] {
  if (!Array.isArray(value)) throw new Error('invalid team members response')
  return value.map(member)
}

function candidate(value: unknown): TeamCandidate {
  const entry = record(value)
  const sessionId = text(entry.sessionId)
  const title = entry.title
  const cwd = text(entry.cwd)
  const status = entry.status
  if (sessionId === undefined || (title !== null && text(title) === undefined) || cwd === undefined
    || typeof entry.live !== 'boolean' || (status !== 'idle' && status !== 'running' && status !== 'unknown')) {
    throw new Error('invalid team candidate response')
  }
  return { sessionId, title: title === null ? null : String(title), cwd, live: entry.live, status }
}

function role(value: unknown): TeamRole {
  const entry = record(value)
  const id = text(entry.id)
  const name = text(entry.name)
  const description = entry.description
  const aliases = entry.aliases
  const source = entry.source
  if (id === undefined || name === undefined || (description !== undefined && text(description) === undefined)
    || !Array.isArray(aliases) || !aliases.every((alias): alias is string => text(alias) !== undefined)
    || (source !== 'global' && source !== 'workspace') || typeof entry.overridden !== 'boolean') throw new Error('invalid team role response')
  return { id, name, ...(description === undefined ? {} : { description: String(description) }), aliases, source, overridden: entry.overridden }
}

function roles(value: unknown): TeamRoles {
  const entry = record(value)
  const globalDirectory = text(entry.globalDirectory)
  const workspaceDirectory = text(entry.workspaceDirectory)
  if (globalDirectory === undefined || workspaceDirectory === undefined || typeof entry.workspaceDirectoryExists !== 'boolean' || typeof entry.openAvailable !== 'boolean' || typeof entry.globalOpenAvailable !== 'boolean' || !Array.isArray(entry.roles)) throw new Error('invalid team roles response')
  return { roles: entry.roles.map(role), globalDirectory, workspaceDirectory, workspaceDirectoryExists: entry.workspaceDirectoryExists, openAvailable: entry.openAvailable, globalOpenAvailable: entry.globalOpenAvailable }
}

function candidates(value: unknown): TeamCandidates {
  const entry = record(value)
  const teamId = text(entry.teamId)
  const teamName = text(entry.teamName)
  const workspacePath = text(entry.workspacePath)
  if (teamId === undefined || teamName === undefined || workspacePath === undefined || !nonNegativeInteger(entry.revision) || !Array.isArray(entry.candidates)) {
    throw new Error('invalid team candidates response')
  }
  return { teamId, teamName, workspacePath, revision: entry.revision, candidates: entry.candidates.map(candidate) }
}

function adoptionCandidate(value: unknown): TeamAdoptionCandidate {
  const entry = record(value)
  const teamId = text(entry.teamId)
  if (teamId === undefined || (entry.name !== undefined && text(entry.name) === undefined)
    || (entry.memberCount !== undefined && !nonNegativeInteger(entry.memberCount))
    || (entry.updatedAt !== undefined && !nonNegativeInteger(entry.updatedAt))
    || (entry.usable !== undefined && typeof entry.usable !== 'boolean')
    || (entry.reason !== undefined && text(entry.reason) === undefined)) throw new Error('invalid adoption candidate response')
  return {
    teamId,
    ...(entry.name === undefined ? {} : { name: String(entry.name) }),
    ...(entry.memberCount === undefined ? {} : { memberCount: entry.memberCount as number }),
    ...(entry.updatedAt === undefined ? {} : { updatedAt: entry.updatedAt as number }),
    ...(entry.usable === undefined ? {} : { usable: entry.usable as boolean }),
    ...(entry.reason === undefined ? {} : { reason: String(entry.reason) }),
  }
}

function adoptionCandidates(value: unknown): TeamAdoptionCandidates {
  const entry = record(value)
  const teamId = text(entry.teamId)
  const workspacePath = text(entry.workspacePath)
  if (teamId === undefined || workspacePath === undefined || !Array.isArray(entry.candidates)) throw new Error('invalid adoption candidates response')
  return { teamId, workspacePath, candidates: entry.candidates.map(adoptionCandidate) }
}

function teamState(value: unknown): TeamStateStatus {
  const candidate = record(value)
  const teamId = text(candidate.teamId)
  const teamName = text(candidate.teamName)
  const workspacePath = text(candidate.workspacePath)
  if (typeof candidate.enabled !== 'boolean' || teamId === undefined || teamName === undefined || workspacePath === undefined) {
    throw new Error('invalid team state response')
  }
  return {
    enabled: candidate.enabled,
    ...(typeof candidate.briefing === 'string' ? { briefing: candidate.briefing } : {}),
    ...(typeof candidate.openAvailable === 'boolean' ? { openAvailable: candidate.openAvailable } : {}),
    teamId,
    teamName,
    workspacePath,
    ...(typeof candidate.revision === 'number' ? { revision: candidate.revision } : {}),
    ...(typeof candidate.memberCount === 'number' ? { memberCount: candidate.memberCount } : {}),
  }
}

function inboxMessage(value: unknown): TeamInboxMessage {
  const entry = record(value)
  const id = text(entry.id)
  const from = text(entry.from)
  const fromName = text(entry.fromName)
  const kind = entry.kind
  const content = typeof entry.content === 'string' ? entry.content : undefined
  const createdAt = entry.createdAt
  const delivery = record(entry.delivery)
  const deliveryId = text(delivery.id)
  const state = delivery.state
  if (id === undefined || from === undefined || fromName === undefined || !messageKindValue(kind) || content === undefined || !nonNegativeInteger(createdAt) || deliveryId === undefined || (state !== 'stored' && state !== 'acknowledged') || (delivery.acknowledgedAt !== undefined && !nonNegativeInteger(delivery.acknowledgedAt))) throw new Error('invalid team inbox response')
  return { id, from, fromName, kind, content, createdAt, delivery: { id: deliveryId, state, ...(delivery.acknowledgedAt === undefined ? {} : { acknowledgedAt: delivery.acknowledgedAt }) } }
}
function messageKindValue(value: unknown): value is MessageKind { return value === 'message' || value === 'direction' || value === 'comment' }
function inbox(value: unknown): TeamInbox {
  const entry = record(value)
  const teamId = text(entry.teamId)
  if (teamId === undefined || !Array.isArray(entry.messages)) throw new Error('invalid team inbox response')
  return { teamId, messages: entry.messages.map(inboxMessage) }
}
function attentionEntry(value: unknown): TeamAttentionEntry {
  const entry = record(value)
  const memberId = text(entry.memberId)
  const name = text(entry.name)
  const sessionId = entry.sessionId === null ? null : text(entry.sessionId)
  const kind = entry.kind
  if (memberId === undefined || name === undefined || sessionId === undefined || !messageKindValue(kind)
    || !nonNegativeInteger(entry.waiting) || entry.waiting < 1 || !nonNegativeInteger(entry.since)) throw new Error('invalid team attention response')
  return { memberId, name, sessionId, waiting: entry.waiting, since: entry.since, kind }
}
function attention(value: unknown): TeamAttention {
  const entry = record(value)
  const teamId = text(entry.teamId)
  if (teamId === undefined || !Array.isArray(entry.attention)) throw new Error('invalid team attention response')
  return { teamId, attention: entry.attention.map(attentionEntry) }
}
function journalEntry(value: unknown): TeamJournalEntry {
  const entry = record(value)
  const id = text(entry.id)
  const kind = text(entry.kind)
  const category = entry.category
  const at = entry.at
  const summary = text(entry.summary)
  const refs = record(entry.refs)
  if (id === undefined || kind === undefined || !['message', 'delivery', 'task', 'review', 'contact', 'team', 'member', 'other'].includes(category as string)
    || !nonNegativeInteger(at) || summary === undefined || entry.refs === null || Array.isArray(entry.refs)) throw new Error('invalid team journal response')
  const taskId = refs.taskId; const taskTitle = refs.taskTitle; const messageId = refs.messageId; const round = refs.round
  if (taskId !== undefined && text(taskId) === undefined || taskTitle !== undefined && text(taskTitle) === undefined || messageId !== undefined && text(messageId) === undefined || round !== undefined && !nonNegativeInteger(round)) throw new Error('invalid team journal response')
  const actor = entry.actor; const actorName = entry.actorName; const detail = entry.detail
  if (actor !== undefined && text(actor) === undefined || actorName !== undefined && text(actorName) === undefined || detail !== undefined && text(detail) === undefined) throw new Error('invalid team journal response')
  return { id, kind, category: category as JournalCategory, at, ...(actor === undefined ? {} : { actor: String(actor) }), ...(actorName === undefined ? {} : { actorName: String(actorName) }), summary, refs: {
    ...(taskId === undefined ? {} : { taskId: String(taskId) }), ...(taskTitle === undefined ? {} : { taskTitle: String(taskTitle) }), ...(messageId === undefined ? {} : { messageId: String(messageId) }), ...(round === undefined ? {} : { round: round as number }),
  }, ...(detail === undefined ? {} : { detail: String(detail) }) }
}
function journal(value: unknown): TeamJournal {
  const entry = record(value)
  const teamId = text(entry.teamId)
  if (teamId === undefined || !Array.isArray(entry.entries)) throw new Error('invalid team journal response')
  return { teamId, entries: entry.entries.map(journalEntry) }
}
function sendMessageResult(value: unknown): SendMessageResult {
  const entry = record(value)
  const messageId = text(entry.messageId)
  const recipients = entry.recipients
  const deliveries = entry.deliveries
  if (messageId === undefined || !Array.isArray(recipients) || !recipients.every((item): item is string => text(item) !== undefined) || !Array.isArray(deliveries)) throw new Error('invalid team send response')
  const parsed = deliveries.map((item) => { const delivery = record(item); const id = text(delivery.id); const recipient = text(delivery.recipient); const state = text(delivery.state); if (id === undefined || recipient === undefined || state === undefined || (delivery.failure !== undefined && text(delivery.failure) === undefined)) throw new Error('invalid team send response'); return { id, recipient, state, ...(delivery.failure === undefined ? {} : { failure: String(delivery.failure) }) } })
  return { messageId, recipients, deliveries: parsed }
}

function snapshot(value: unknown): TeamSnapshot {
  const candidate = record(value)
  const teamId = text(candidate.teamId)
  const workspacePath = text(candidate.workspacePath)
  if (teamId === undefined || workspacePath === undefined || !nonNegativeInteger(candidate.revision)) {
    throw new Error('invalid team snapshot response')
  }
  const teamName = text(candidate.teamName)
  return {
    teamId,
    ...(teamName === undefined ? {} : { teamName }),
    ...(typeof candidate.leadMemberId === 'string' ? { leadMemberId: candidate.leadMemberId } : {}),
    workspacePath,
    revision: candidate.revision,
    members: members(candidate.members),
  }
}

function createSessionSuccess(value: unknown): CreateSessionSuccess {
  const candidate = record(value)
  const teamId = text(candidate.teamId)
  const memberId = text(candidate.memberId)
  const sessionId = text(candidate.sessionId)
  if (teamId === undefined || memberId === undefined || sessionId === undefined || !nonNegativeInteger(candidate.revision)
    || candidate.applied !== true || typeof candidate.retried !== 'boolean') throw new Error('invalid team session creation response')
  return { teamId, memberId, sessionId, revision: candidate.revision, applied: true, retried: candidate.retried, member: member(candidate.member) }
}

function mutationSuccess(value: unknown): MutationSuccess {
  const candidate = record(value)
  const teamId = text(candidate.teamId)
  const memberId = text(candidate.memberId)
  if (teamId === undefined || memberId === undefined || !nonNegativeInteger(candidate.revision)
    || candidate.applied !== true || typeof candidate.retried !== 'boolean') throw new Error('invalid team mutation response')
  return { teamId, memberId, revision: candidate.revision, applied: true, retried: candidate.retried, member: member(candidate.member) }
}

function interruptTurnSuccess(value: unknown): InterruptTurnSuccess {
  const candidate = record(value)
  const memberId = text(candidate.memberId)
  const status = candidate.status
  if (memberId === undefined || candidate.interrupted !== true || (status !== 'idle' && status !== 'running' && status !== 'unknown')) throw new Error('invalid team interrupt response')
  return { memberId, interrupted: true, status }
}

function removeMemberSuccess(value: unknown): RemoveMemberSuccess {
  const candidate = record(value)
  const teamId = text(candidate.teamId)
  const memberId = text(candidate.memberId)
  const removed = record(candidate.removed)
  const removedId = text(removed.memberId)
  const displayName = text(removed.displayName)
  const role = text(removed.role)
  const sessionId = removed.sessionId
  if (teamId === undefined || memberId === undefined || memberId !== removedId || !nonNegativeInteger(candidate.revision)
    || candidate.applied !== true || typeof candidate.retried !== 'boolean'
    || removedId === undefined || displayName === undefined || role === undefined
    || (sessionId !== null && text(sessionId) === undefined)) throw new Error('invalid team removal response')
  return {
    teamId,
    memberId,
    revision: candidate.revision,
    applied: true,
    retried: candidate.retried,
    removed: { memberId: removedId, displayName, role, sessionId: sessionId === null ? null : String(sessionId) },
  }
}

function conflict(value: unknown): MutationConflict | null {
  const candidate = record(value)
  if (!nonNegativeInteger(candidate.revision)) return null
  try { return { revision: candidate.revision, members: members(candidate.members) } } catch { return null }
}

const TASK_STATUSES: readonly TaskStatus[] = ['draft', 'ready', 'claimed', 'in_progress', 'waiting', 'needs_human', 'completed', 'failed', 'cancelled']
const REVIEW_VERDICTS: readonly ReviewRound['verdict'][] = ['pass', 'needs_revision', 'escalate']
const FINDING_SEVERITIES: readonly ReviewFinding['severity'][] = ['low', 'medium', 'high', 'blocker']

function taskStatus(value: unknown): value is TaskStatus { return typeof value === 'string' && TASK_STATUSES.includes(value as TaskStatus) }
function route(value: unknown): TaskRoute | undefined {
  if (value === undefined) return undefined
  const entry = record(value)
  const type = entry.type
  if (type === 'report') {
    const to = entry.to
    if ((typeof to !== 'string' || to.length === 0) && to !== 'human') throw new Error('invalid team task route')
    return { type, to }
  }
  if (type === 'review') {
    const reviewer = text(entry.reviewer)
    if (reviewer === undefined) throw new Error('invalid team task route')
    return { type, reviewer }
  }
  if (type === 'interactive') {
    const nested = route(entry.then)
    if (nested === undefined) throw new Error('invalid team task route')
    return { type, then: nested }
  }
  if (type === 'custom') {
    const description = text(entry.description)
    if (description === undefined) throw new Error('invalid team task route')
    return { type, description }
  }
  throw new Error('invalid team task route')
}
function summaryRoute(value: unknown): TaskRouteSummary | undefined {
  if (value === undefined) return undefined
  const entry = record(value)
  const type = entry.type
  if (type === 'report') {
    const to = entry.to
    if ((typeof to !== 'string' || to.length === 0) && to !== 'human') throw new Error('invalid team task route')
    const toName = entry.toName
    if (toName !== undefined && text(toName) === undefined) throw new Error('invalid team task route')
    return { type, to, ...(toName === undefined ? {} : { toName: String(toName) }) }
  }
  if (type === 'review') {
    const reviewer = text(entry.reviewer)
    const reviewerName = entry.reviewerName
    if (reviewer === undefined || (reviewerName !== undefined && text(reviewerName) === undefined)) throw new Error('invalid team task route')
    return { type, reviewer, ...(reviewerName === undefined ? {} : { reviewerName: String(reviewerName) }) }
  }
  if (type === 'interactive') {
    const nested = summaryRoute(entry.then)
    if (nested === undefined) throw new Error('invalid team task route')
    return { type, then: nested }
  }
  if (type === 'custom') {
    const description = text(entry.description)
    if (description === undefined) throw new Error('invalid team task route')
    return { type, description }
  }
  throw new Error('invalid team task route')
}
function task(value: unknown): TeamTask {
  const entry = record(value)
  const id = text(entry.id)
  const teamId = text(entry.teamId)
  const title = text(entry.title)
  const kind = text(entry.kind)
  const status = entry.status
  const acceptance = entry.acceptance
  if (id === undefined || teamId === undefined || title === undefined || kind === undefined || !taskStatus(status)
    || !Array.isArray(acceptance) || !acceptance.every((item): item is string => text(item) !== undefined)
    || !nonNegativeInteger(entry.roundLimit) || text(entry.createdBy) === undefined
    || !nonNegativeInteger(entry.createdAt) || !nonNegativeInteger(entry.updatedAt) || !nonNegativeInteger(entry.revision)) throw new Error('invalid team task response')
  const assignee = entry.assignee
  const humanContact = entry.humanContact
  const optionalText = (value: unknown): string | undefined => value === undefined ? undefined : text(value)
  if (assignee !== undefined && text(assignee) === undefined) throw new Error('invalid team task response')
  if (humanContact !== undefined && humanContact !== 'none' && humanContact !== 'expected' && humanContact !== 'required') throw new Error('invalid team task response')
  const activeAttemptId = optionalText(entry.activeAttemptId)
  const latestSubmissionId = optionalText(entry.latestSubmissionId)
  const acceptedSubmissionId = optionalText(entry.acceptedSubmissionId)
  const archivedPath = optionalText(entry.archivedPath)
  if (entry.activeAttemptId !== undefined && activeAttemptId === undefined || entry.latestSubmissionId !== undefined && latestSubmissionId === undefined || entry.acceptedSubmissionId !== undefined && acceptedSubmissionId === undefined || entry.archivedPath !== undefined && archivedPath === undefined) throw new Error('invalid team task response')
  if (entry.documentMissing !== undefined && typeof entry.documentMissing !== 'boolean') throw new Error('invalid team task response')
  return {
    id, teamId, title, kind, status,
    ...(entry.reviewReturn === undefined ? {} : { reviewReturn: parseReviewReturn(entry.reviewReturn) }),
    ...(assignee === undefined ? {} : { assignee: String(assignee) }),
    ...(entry.route === undefined ? {} : { route: route(entry.route) as TaskRoute }),
    ...(humanContact === undefined ? {} : { humanContact }),
    ...(activeAttemptId === undefined ? {} : { activeAttemptId }),
    ...(latestSubmissionId === undefined ? {} : { latestSubmissionId }),
    ...(acceptedSubmissionId === undefined ? {} : { acceptedSubmissionId }),
    acceptance: [...acceptance], roundLimit: entry.roundLimit, createdBy: String(entry.createdBy), createdAt: entry.createdAt, updatedAt: entry.updatedAt, revision: entry.revision,
    ...(archivedPath === undefined ? {} : { archivedPath }),
    ...(entry.documentMissing === undefined ? {} : { documentMissing: entry.documentMissing }),
  }
}
function taskBlockers(value: unknown): Array<{ id: string; title: string; status: TaskStatus }> {
  if (!Array.isArray(value)) throw new Error('invalid team tasks response')
  return value.map((entry) => {
    const fields = record(entry)
    const id = text(fields.id)
    const title = text(fields.title)
    if (id === undefined || title === undefined || !taskStatus(fields.status)) throw new Error('invalid team tasks response')
    return { id, title, status: fields.status as TaskStatus }
  })
}
function taskSummary(value: unknown): TaskSummary {
  const entry = record(value)
  const id = text(entry.id)
  const title = text(entry.title)
  const status = entry.status
  if (id === undefined || title === undefined || !taskStatus(status) || !nonNegativeInteger(entry.updatedAt)) throw new Error('invalid team tasks response')
  const assignee = entry.assignee
  const assigneeName = entry.assigneeName
  if (assignee !== undefined && text(assignee) === undefined || assigneeName !== undefined && text(assigneeName) === undefined) throw new Error('invalid team tasks response')
  const round = entry.round
  const roundLimit = entry.roundLimit
  if (round !== undefined && !nonNegativeInteger(round) || roundLimit !== undefined && !nonNegativeInteger(roundLimit)) throw new Error('invalid team tasks response')
  const archivedPath = entry.archivedPath
  const documentMissing = entry.documentMissing
  const awaitsDecision = entry.awaitsDecision
  if (awaitsDecision !== undefined && typeof awaitsDecision !== 'boolean') throw new Error('invalid team tasks response')
  if (archivedPath !== undefined && text(archivedPath) === undefined || documentMissing !== undefined && typeof documentMissing !== 'boolean') throw new Error('invalid team tasks response')
  const dependsOn = entry.dependsOn
  if (dependsOn !== undefined && (!Array.isArray(dependsOn) || !dependsOn.every((item) => typeof item === 'string'))) throw new Error('invalid team tasks response')
  const blockedBy = entry.blockedBy === undefined ? undefined : taskBlockers(entry.blockedBy)
  return {
    id, title, status,
    ...(entry.reviewReturn === undefined ? {} : { reviewReturn: parseReviewReturn(entry.reviewReturn) }),
    ...(awaitsDecision === true ? { awaitsDecision: true } : {}),
    ...(assignee === undefined ? {} : { assignee: String(assignee) }),
    ...(assigneeName === undefined ? {} : { assigneeName: String(assigneeName) }),
    ...(entry.route === undefined ? {} : { route: summaryRoute(entry.route) as TaskRouteSummary }),
    ...(round === undefined ? {} : { round }), ...(roundLimit === undefined ? {} : { roundLimit }), updatedAt: entry.updatedAt,
    ...(dependsOn === undefined ? {} : { dependsOn: dependsOn as string[] }),
    ...(blockedBy === undefined ? {} : { blockedBy }),
    ...(archivedPath === undefined ? {} : { archivedPath: String(archivedPath) }),
    ...(documentMissing === undefined ? {} : { documentMissing }),
  }
}
function tasks(value: unknown): TeamTasks {
  const entry = record(value)
  const teamId = text(entry.teamId)
  if (teamId === undefined || !Array.isArray(entry.tasks)) throw new Error('invalid team tasks response')
  return { teamId, tasks: entry.tasks.map(taskSummary) }
}
function check(value: unknown): SubmissionCheck {
  const entry = record(value)
  const command = text(entry.command)
  const status = entry.status
  if (command === undefined || (status !== 'passed' && status !== 'failed') || (entry.output !== undefined && text(entry.output) === undefined)) throw new Error('invalid team task response')
  return { command, status, ...(entry.output === undefined ? {} : { output: String(entry.output) }) }
}
const SCOPE_STATES: readonly TeamSubmissionScope['state'][] = ['clean', 'violation', 'shared-tree', 'unchecked']
const SCOPE_REASONS: readonly string[] = ['no-repository', 'too-many-files', 'no-snapshot', 'unreadable']
function submissionScope(value: unknown): TeamSubmissionScope | undefined {
  if (value === undefined) return undefined
  const entry = record(value)
  const state = entry.state === 'collision' ? 'shared-tree' : entry.state
  if (!SCOPE_STATES.includes(state as TeamSubmissionScope['state'])) return undefined
  const reason: NonNullable<TeamSubmissionScope['reason']> | undefined = typeof entry.reason === 'string' && (SCOPE_REASONS as readonly string[]).includes(entry.reason) ? entry.reason as NonNullable<TeamSubmissionScope['reason']> : undefined
  const list = (name: string): string[] | undefined => Array.isArray(entry[name]) ? (entry[name] as unknown[]).filter((item): item is string => typeof item === 'string') : undefined
  return {
    state: state as TeamSubmissionScope['state'],
    ...(list('declared') === undefined ? {} : { declared: list('declared') as string[] }),
    ...(list('changed') === undefined ? {} : { changed: list('changed') as string[] }),
    ...(list('unexpected') === undefined ? {} : { unexpected: list('unexpected') as string[] }),
    // A record written before the rename carries `collision`; read it as shared-tree.
    ...((list('sharedTree') ?? list('collision')) === undefined ? {} : { sharedTree: (list('sharedTree') ?? list('collision')) as string[] }),
    ...(entry.mode === 'git' || entry.mode === 'files' ? { mode: entry.mode } : {}),
    ...(reason === undefined ? {} : { reason }),
  }
}
function submission(value: unknown): Submission {
  const entry = record(value)
  const id = text(entry.id); const taskId = text(entry.taskId); const attemptId = text(entry.attemptId); const summary = text(entry.summary)
  const artifact = record(entry.artifact); const artifactType = artifact.type
  if (id === undefined || taskId === undefined || attemptId === undefined || summary === undefined || !nonNegativeInteger(entry.attemptGeneration) || !nonNegativeInteger(entry.createdAt) || !nonNegativeInteger(entry.revision) || !Array.isArray(entry.checks)) throw new Error('invalid team task response')
  let parsedArtifact: SubmissionArtifact
  if (artifactType === 'report') {
    const bodyRef = text(artifact.bodyRef); const bodyDigest = text(artifact.bodyDigest)
    if (bodyRef === undefined || bodyDigest === undefined) throw new Error('invalid team task response')
    parsedArtifact = { type: artifactType, bodyRef, bodyDigest }
  } else if (artifactType === 'files') {
    const paths = artifact.paths
    const manifestDigest = text(artifact.manifestDigest)
    if (!Array.isArray(paths) || !paths.every((item): item is string => text(item) !== undefined) || manifestDigest === undefined) throw new Error('invalid team task response')
    parsedArtifact = { type: artifactType, paths: [...paths], manifestDigest }
  } else throw new Error('invalid team task response')
  const scope = submissionScope(entry.scope)
  return { id, taskId, attemptId, attemptGeneration: entry.attemptGeneration, artifact: parsedArtifact, summary, checks: entry.checks.map(check), ...(scope === undefined ? {} : { scope }), createdAt: entry.createdAt, revision: entry.revision }
}
function finding(value: unknown): ReviewFinding {
  const entry = record(value)
  const severity = entry.severity; const problem = text(entry.problem); const requiredFix = text(entry.requiredFix); const artifactLocation = entry.artifactLocation
  if (!FINDING_SEVERITIES.includes(severity as ReviewFinding['severity']) || problem === undefined || requiredFix === undefined || artifactLocation !== undefined && text(artifactLocation) === undefined) throw new Error('invalid team task response')
  return { severity: severity as ReviewFinding['severity'], problem, requiredFix, ...(artifactLocation === undefined ? {} : { artifactLocation: String(artifactLocation) }) }
}
function reviewRound(value: unknown): ReviewRound {
  const entry = record(value)
  const id = text(entry.id); const taskId = text(entry.taskId); const submissionId = text(entry.submissionId); const reviewerMemberId = text(entry.reviewerMemberId); const verdict = entry.verdict
  if (id === undefined || taskId === undefined || submissionId === undefined || reviewerMemberId === undefined || !nonNegativeInteger(entry.round) || entry.round < 1 || !REVIEW_VERDICTS.includes(verdict as ReviewRound['verdict']) || !Array.isArray(entry.findings) || !Array.isArray(entry.evidence) || !nonNegativeInteger(entry.createdAt) || !nonNegativeInteger(entry.revision)) throw new Error('invalid team task response')
  return { id, taskId, submissionId, reviewerMemberId, round: entry.round, verdict: verdict as ReviewRound['verdict'], findings: entry.findings.map(finding), evidence: entry.evidence.map(check), createdAt: entry.createdAt, revision: entry.revision }
}
const ATTEMPT_STATUSES: readonly TeamAttemptStatus[] = ['active', 'revoking', 'revoked', 'completed', 'failed']
function taskAttempt(value: unknown): TeamTaskAttempt {
  const entry = record(value)
  if (typeof entry.id !== 'string' || typeof entry.memberId !== 'string' || typeof entry.sessionId !== 'string'
    || !Number.isInteger(entry.generation) || !Number.isInteger(entry.startedAt)
    || !ATTEMPT_STATUSES.includes(entry.status as TeamAttemptStatus)) throw new Error('invalid team task attempt')
  if (entry.humanIntervenedAt !== undefined && !Number.isInteger(entry.humanIntervenedAt)) throw new Error('invalid team task attempt')
  return {
    id: entry.id, memberId: entry.memberId, sessionId: entry.sessionId, generation: entry.generation as number,
    status: entry.status as TeamAttemptStatus, startedAt: entry.startedAt as number,
    ...(entry.humanIntervenedAt === undefined ? {} : { humanIntervenedAt: entry.humanIntervenedAt as number }),
  }
}
function taskDetail(value: unknown): TeamTaskDetail {
  const entry = record(value)
  if (typeof entry.document !== 'string' || !Array.isArray(entry.submissions) || !Array.isArray(entry.rounds) || !Array.isArray(entry.attempts)) throw new Error('invalid team task response')
  if (entry.documentMissing !== undefined && entry.documentMissing !== true) throw new Error('invalid team task response')
  return { task: task(entry.task), document: entry.document, ...(entry.documentMissing === undefined ? {} : { documentMissing: true }), submissions: entry.submissions.map(submission), rounds: entry.rounds.map(reviewRound), attempts: entry.attempts.map(taskAttempt) }
}
function acceptTaskResult(value: unknown): AcceptTaskResult {
  const entry = record(value); const archivedPath = text(entry.archivedPath)
  if (archivedPath === undefined) throw new Error('invalid team task response')
  return { task: task(entry.task), archivedPath }
}
function reviseTaskResult(value: unknown): ReviseTaskResult { return { task: task(record(value).task) } }
function cancelTaskResult(value: unknown): CancelTaskResult {
  const entry = record(value)
  const parsedTask = task(entry.task)
  const archivedPath = text(entry.archivedPath)
  if (typeof entry.quiesced !== 'boolean') throw new Error('invalid cancellation response')
  if (entry.quiesced && (parsedTask.status !== 'cancelled' || archivedPath === undefined)) throw new Error('invalid completed cancellation')
  if (!entry.quiesced && (parsedTask.status !== 'needs_human' || archivedPath !== undefined)) throw new Error('invalid pending cancellation')
  return { task: parsedTask, quiesced: entry.quiesced, ...(archivedPath === undefined ? {} : { archivedPath }) }
}

async function requestJson(path: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(path, { ...init, cache: 'no-store', credentials: 'same-origin', redirect: 'error', headers: { accept: 'application/json', ...(init.headers ?? {}) } })
  let body: unknown
  try {
    body = await response.json() as unknown
  } catch {
    throw new LiveTeamsApiError(response.status, `invalid team response (HTTP ${response.status}; non-JSON body)`)
  }
  if (!response.ok) {
    const bodyRecord = record(body)
    throw new LiveTeamsApiError(response.status, text(bodyRecord.error) ?? 'team request failed', response.status === 409 ? conflict(body) : null)
  }
  return body
}

export type TeamStateStatus = {
  enabled: boolean
  briefing?: string
  openAvailable?: boolean
  teamId: string
  teamName: string
  workspacePath: string
  revision?: number
  memberCount?: number
  compatibility?: {
    verdict: 'compatible' | 'degraded' | 'incompatible'
    hostVersion?: string
    missing: string[]
    absent: string[]
    detail: string
  }
}

/**
 * Every team request is scoped by the Session the view belongs to, so the host
 * can serve the team of that Session's workspace. A view without a Session id
 * still works against a pinned deployment.
 */
function scoped(path: string, session?: string): string {
  return session === undefined || session.length === 0 ? path : `${path}?session=${encodeURIComponent(session)}`
}

/** Add the scope to a mutation body only when there is one. */
function withSession(body: Record<string, unknown>, session?: string): Record<string, unknown> {
  return session === undefined || session.length === 0 ? body : { ...body, sessionId: session }
}

export async function fetchTeamState(session?: string, signal?: AbortSignal): Promise<TeamStateStatus> {
  const init: RequestInit = { method: 'GET', headers: { accept: 'application/json' } }
  if (signal !== undefined) init.signal = signal
  try { return teamState(await requestJson(scoped('/api/live-teams/team', session), init)) } catch (cause: unknown) {
    if (cause instanceof LiveTeamsApiError) throw cause
    throw new LiveTeamsApiError(500, 'invalid team response')
  }
}

export async function enableTeam(name?: string, session?: string, createNew = false): Promise<TeamStateStatus> {
  const body = withSession({ ...(name === undefined ? {} : { name }), ...(createNew ? { createNew: true } : {}) }, session)
  try { return teamState(await requestJson('/api/live-teams/team/enable', { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify(body) })) } catch (cause: unknown) {
    if (cause instanceof LiveTeamsApiError) throw cause
    throw new LiveTeamsApiError(500, 'invalid team response')
  }
}

export async function disableTeam(session?: string): Promise<TeamStateStatus> {
  try { return teamState(await requestJson('/api/live-teams/team/disable', { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify(withSession({}, session)) })) } catch (cause: unknown) {
    if (cause instanceof LiveTeamsApiError) throw cause
    throw new LiveTeamsApiError(500, 'invalid team response')
  }
}

export async function renameTeam(name: string, expectedRevision: number, session?: string): Promise<TeamStateStatus> {
  const body = withSession({ name, expectedRevision }, session)
  try { return teamState(await requestJson('/api/live-teams/team/name', { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify(body) })) } catch (cause: unknown) {
    if (cause instanceof LiveTeamsApiError) throw cause
    throw new LiveTeamsApiError(500, 'invalid team response')
  }
}

export async function fetchTeamTasks(session?: string, includeArchived = false, signal?: AbortSignal): Promise<TeamTasks> {
  const base = scoped('/api/live-teams/tasks', session)
  const separator = base.includes('?') ? '&' : '?'
  const init: RequestInit = { method: 'GET', headers: { accept: 'application/json' } }
  if (signal !== undefined) init.signal = signal
  try { return tasks(await requestJson(`${base}${separator}includeArchived=${includeArchived ? 'true' : 'false'}`, init)) } catch (cause: unknown) {
    if (cause instanceof LiveTeamsApiError) throw cause
    throw new LiveTeamsApiError(500, 'invalid team response')
  }
}

/** One task's dispatch verdict, in the same words the journal uses (B29). */
export type DispatchTaskVerdict = {
  taskId: string
  title: string
  status: string
  assignee?: string
  decision: 'assign' | 'active' | 'wait' | 'refused'
  reason: string
  detail: string
  warning?: string
  /** F3: this attempt has been silent long enough to show. Detection only, never an auto-revoke. */
  stalled?: { at: number; reason: 'unacknowledged' | 'idle'; detail: string }
}
export type TeamDispatch = {
  teamId: string
  paused: boolean
  coding: 'manual' | 'automatic'
  pausedBy?: string
  pausedReason?: string
  counts: Record<'assign' | 'active' | 'wait' | 'refused', number>
  tasks: DispatchTaskVerdict[]
}

function dispatchProjection(value: unknown): TeamDispatch {
  const candidate = value as Partial<TeamDispatch> | null
  if (candidate === null || typeof candidate !== 'object' || typeof candidate.paused !== 'boolean' || !Array.isArray(candidate.tasks) || typeof candidate.counts !== 'object' || candidate.counts === null) throw new LiveTeamsApiError(500, 'invalid dispatch response')
  return candidate as TeamDispatch
}

export async function fetchTeamDispatch(session?: string, signal?: AbortSignal): Promise<TeamDispatch> {
  const init: RequestInit = { method: 'GET', headers: { accept: 'application/json' } }
  if (signal !== undefined) init.signal = signal
  try { return dispatchProjection(await requestJson(scoped('/api/live-teams/dispatch', session), init)) } catch (cause: unknown) {
    if (cause instanceof LiveTeamsApiError) throw cause
    throw new LiveTeamsApiError(500, 'invalid dispatch response')
  }
}

/** Only the human and the lead may flip this; the server decides which one the caller is. */
export async function setTeamDispatch(mode: 'auto' | 'paused', reason?: string, session?: string): Promise<{ from: string; to: string }> {
  const body = withSession({ mode, ...(reason === undefined ? {} : { reason }) }, session)
  try {
    const value = await requestJson('/api/live-teams/dispatch', { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const candidate = value as { from?: unknown; to?: unknown } | null
    if (candidate === null || typeof candidate !== 'object' || typeof candidate.from !== 'string' || typeof candidate.to !== 'string') throw new LiveTeamsApiError(500, 'invalid dispatch response')
    return { from: candidate.from, to: candidate.to }
  } catch (cause: unknown) {
    if (cause instanceof LiveTeamsApiError) throw cause
    throw new LiveTeamsApiError(500, 'invalid dispatch response')
  }
}

/**
 * Rotation limits in force for this team.
 *
 * `source` says whether the panel's overrides or the deployment row decide, so the card can show
 * "from profile" without pretending the numbers were chosen here.
 */
export type TeamRotation = {
  enabled: boolean
  maxContextTokens: number
  maxCompletedTasks: number
  cooldownMs: number
  maxRotationsPerPass: number
  source: 'team' | 'profile'
  revision: number
}

function rotationPayload(value: unknown): TeamRotation {
  const candidate = record(value)
  if (typeof candidate.enabled !== 'boolean'
    || !Number.isInteger(candidate.maxContextTokens) || !Number.isInteger(candidate.maxCompletedTasks)
    || typeof candidate.cooldownMs !== 'number' || typeof candidate.maxRotationsPerPass !== 'number'
    || (candidate.source !== 'team' && candidate.source !== 'profile')
    || !Number.isInteger(candidate.revision)) {
    throw new LiveTeamsApiError(500, 'invalid rotation response')
  }
  return candidate as TeamRotation
}

export async function fetchTeamRotation(session?: string, signal?: AbortSignal): Promise<TeamRotation> {
  const init: RequestInit = { method: 'GET', headers: { accept: 'application/json' } }
  if (signal !== undefined) init.signal = signal
  try { return rotationPayload(await requestJson(scoped('/api/live-teams/team/rotation', session), init)) } catch (cause: unknown) {
    if (cause instanceof LiveTeamsApiError) throw cause
    throw new LiveTeamsApiError(500, 'invalid rotation response')
  }
}

/** The human's own surface, like dispatch: the host commits under the revision it was shown. */
export async function setTeamRotation(request: { enabled?: boolean; maxContextTokens?: number; maxCompletedTasks?: number; expectedRevision: number }, session?: string): Promise<TeamRotation> {
  const body = withSession({ ...request }, session)
  try {
    return rotationPayload(await requestJson('/api/live-teams/team/rotation', { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify(body) }))
  } catch (cause: unknown) {
    if (cause instanceof LiveTeamsApiError) throw cause
    throw new LiveTeamsApiError(500, 'invalid rotation response')
  }
}

export async function fetchTeamTask(taskId: string, session?: string, signal?: AbortSignal): Promise<TeamTaskDetail> {  const base = scoped('/api/live-teams/task', session)
  const separator = base.includes('?') ? '&' : '?'
  const init: RequestInit = { method: 'GET', headers: { accept: 'application/json' } }
  if (signal !== undefined) init.signal = signal
  try { return taskDetail(await requestJson(`${base}${separator}taskId=${encodeURIComponent(taskId)}`, init)) } catch (cause: unknown) {
    if (cause instanceof LiveTeamsApiError) throw cause
    throw new LiveTeamsApiError(500, 'invalid team response')
  }
}

export async function acceptTeamTask(taskId: string, note?: string, session?: string): Promise<AcceptTaskResult> {
  const body = withSession({ taskId, ...(note === undefined ? {} : { note }) }, session)
  try { return acceptTaskResult(await requestJson('/api/live-teams/task/accept', { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify(body) })) } catch (cause: unknown) {
    if (cause instanceof LiveTeamsApiError) throw cause
    throw new LiveTeamsApiError(500, 'invalid team response')
  }
}

/**
 * Close a task by hand, without a submission.
 *
 * Accept needs a submission awaiting a decision; a task whose work was done by hand, dropped, or
 * overtaken has none, and the panel offered no way to close it.
 */
export async function cancelTeamTask(taskId: string, reason: string, session?: string): Promise<CancelTaskResult> {
  const body = withSession({ taskId, reason }, session)
  try {
    return cancelTaskResult(await requestJson('/api/live-teams/task/cancel', { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify(body) }))
  } catch (cause) {
    if (cause instanceof LiveTeamsApiError) throw cause
    throw new LiveTeamsApiError(500, 'invalid team response')
  }
}

export async function resumeTeamTask(taskId: string, session?: string): Promise<ReviseTaskResult> {
  const body = withSession({ taskId }, session)
  try { return reviseTaskResult(await requestJson('/api/live-teams/task/resume', { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify(body) })) } catch (cause: unknown) {
    if (cause instanceof LiveTeamsApiError) throw cause
    throw new LiveTeamsApiError(500, 'invalid team response')
  }
}

export async function reviseTeamTask(taskId: string, instructions: string, session?: string): Promise<ReviseTaskResult> {
  const body = withSession({ taskId, instructions }, session)
  try { return reviseTaskResult(await requestJson('/api/live-teams/task/revise', { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify(body) })) } catch (cause: unknown) {
    if (cause instanceof LiveTeamsApiError) throw cause
    throw new LiveTeamsApiError(500, 'invalid team response')
  }
}

export async function fetchTeamRoles(session?: string, signal?: AbortSignal): Promise<TeamRoles> {
  const init: RequestInit = { method: 'GET', headers: { accept: 'application/json' } }
  if (signal !== undefined) init.signal = signal
  try { return roles(await requestJson(scoped('/api/live-teams/roles', session), init)) } catch (cause: unknown) {
    if (cause instanceof LiveTeamsApiError) throw cause
    throw new LiveTeamsApiError(500, 'invalid team response')
  }
}

export async function openTeamRoles(kind: 'global' | 'workspace', id?: string, session?: string): Promise<string> {
  const body = withSession(id === undefined ? { scope: kind } : { scope: kind, id }, session)
  const result = record(await requestJson('/api/live-teams/roles/open', { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify(body) }))
  const opened = text(result.opened)
  if (opened === undefined) throw new LiveTeamsApiError(500, 'invalid team response')
  return opened
}

export async function overrideTeamRole(id: string, session?: string): Promise<{ id: string; path: string }> {
  const result = record(await requestJson('/api/live-teams/roles/override', { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify(withSession({ id }, session)) }))
  const path = text(result.path)
  if (text(result.id) === undefined || path === undefined) throw new LiveTeamsApiError(500, 'invalid team response')
  return { id: String(result.id), path }
}

export async function fetchTeamAdoptionCandidates(session?: string, signal?: AbortSignal): Promise<TeamAdoptionCandidates> {
  const init: RequestInit = { method: 'GET', headers: { accept: 'application/json' } }
  if (signal !== undefined) init.signal = signal
  try { return adoptionCandidates(await requestJson(scoped('/api/live-teams/team/candidates', session), init)) } catch (cause: unknown) {
    if (cause instanceof LiveTeamsApiError) throw cause
    throw new LiveTeamsApiError(500, 'invalid team response')
  }
}

export async function adoptTeam(teamId: string, replaceEmptyDerived: boolean, session?: string): Promise<TeamStateStatus & { adoptedFrom: string }> {
  const body = withSession({ teamId, replaceEmptyDerived }, session)
  try {
    const value = record(await requestJson('/api/live-teams/team/adopt', { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify(body) }))
    const result = teamState(value)
    const adoptedFrom = text(value.adoptedFrom)
    if (adoptedFrom === undefined) throw new LiveTeamsApiError(500, 'invalid team response')
    return { ...result, adoptedFrom }
  } catch (cause: unknown) {
    if (cause instanceof LiveTeamsApiError) throw cause
    throw new LiveTeamsApiError(500, 'invalid team response')
  }
}

export async function fetchTeamCandidates(session?: string, signal?: AbortSignal): Promise<TeamCandidates> {
  const init: RequestInit = { method: 'GET', headers: { accept: 'application/json' } }
  if (signal !== undefined) init.signal = signal
  try {
    return candidates(await requestJson(scoped('/api/live-teams/candidates', session), init))
  } catch (cause: unknown) {
    if (cause instanceof LiveTeamsApiError) throw cause
    throw new LiveTeamsApiError(500, 'invalid team response')
  }
}

export async function fetchTeamInbox(session?: string, limit = 50, signal?: AbortSignal): Promise<TeamInbox> {
  const init: RequestInit = { method: 'GET', headers: { accept: 'application/json' } }
  if (signal !== undefined) init.signal = signal
  try { return inbox(await requestJson(`${scoped('/api/live-teams/messages', session)}${session === undefined || session.length === 0 ? '?' : '&'}limit=${encodeURIComponent(String(limit))}`, init)) } catch (cause: unknown) { if (cause instanceof LiveTeamsApiError) throw cause; throw new LiveTeamsApiError(500, 'invalid team response') }
}

/** Who is waiting for the human, one entry per member. Polled by the header chip. */
export async function fetchTeamAttention(session?: string, signal?: AbortSignal): Promise<TeamAttention> {
  const init: RequestInit = { method: 'GET', headers: { accept: 'application/json' } }
  if (signal !== undefined) init.signal = signal
  try { return attention(await requestJson(scoped('/api/live-teams/attention', session), init)) } catch (cause: unknown) { if (cause instanceof LiveTeamsApiError) throw cause; throw new LiveTeamsApiError(500, 'invalid team response') }
}

/**
 * Clear a whole member's backlog in one request. The chip opens the Session the
 * human was taken to, so acknowledging 22 rows one by one would be busywork.
 */
export async function acknowledgeTeamMessages(messageIds: readonly string[], session?: string): Promise<{ messageIds: string[] }> {
  try {
    const result = record(await requestJson('/api/live-teams/messages/acknowledge', { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify(withSession({ messageIds: [...messageIds] }, session)) }))
    if (!Array.isArray(result.messageIds) || !result.messageIds.every((entry) => typeof entry === 'string')) throw new LiveTeamsApiError(500, 'invalid team response')
    return { messageIds: result.messageIds as string[] }
  } catch (cause: unknown) { if (cause instanceof LiveTeamsApiError) throw cause; throw new LiveTeamsApiError(500, 'invalid team response') }
}

export async function fetchTeamJournal(session?: string, limit = 100, signal?: AbortSignal): Promise<TeamJournal> {  const init: RequestInit = { method: 'GET', headers: { accept: 'application/json' } }
  if (signal !== undefined) init.signal = signal
  const base = scoped('/api/live-teams/journal', session)
  const separator = base.includes('?') ? '&' : '?'
  try { return journal(await requestJson(`${base}${separator}limit=${encodeURIComponent(String(limit))}`, init)) } catch (cause: unknown) { if (cause instanceof LiveTeamsApiError) throw cause; throw new LiveTeamsApiError(500, 'invalid team response') }
}

export async function sendTeamMessage(request: { to: string; kind: MessageKind; content: string; threadId?: string }, session?: string): Promise<SendMessageResult> {
  try { return sendMessageResult(await requestJson('/api/live-teams/messages', { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify(withSession(request, session)) })) } catch (cause: unknown) { if (cause instanceof LiveTeamsApiError) throw cause; throw new LiveTeamsApiError(500, 'invalid team response') }
}

export async function acknowledgeTeamMessage(messageId: string, session?: string): Promise<{ messageId: string; state: 'acknowledged' }> {
  try {
    const result = record(await requestJson('/api/live-teams/messages/acknowledge', { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify(withSession({ messageId }, session)) }))
    if (text(result.messageId) === undefined || result.state !== 'acknowledged') throw new LiveTeamsApiError(500, 'invalid team response')
    return { messageId: String(result.messageId), state: 'acknowledged' }
  } catch (cause: unknown) { if (cause instanceof LiveTeamsApiError) throw cause; throw new LiveTeamsApiError(500, 'invalid team response') }
}

export type TeamLead = { leadMemberId?: string; resolvedFrom: 'state' | 'role' | 'none' }
function lead(value: unknown): TeamLead {
  const candidate = record(value)
  if (candidate.resolvedFrom !== 'state' && candidate.resolvedFrom !== 'role' && candidate.resolvedFrom !== 'none') throw new Error('invalid team lead response')
  return { ...(typeof candidate.leadMemberId === 'string' ? { leadMemberId: candidate.leadMemberId } : {}), resolvedFrom: candidate.resolvedFrom }
}
export async function openTeamBriefing(session?: string): Promise<string> {
  const result = record(await requestJson('/api/live-teams/team/briefing/open', { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify(withSession({}, session)) }))
  const opened = text(result.opened)
  if (opened === undefined) throw new LiveTeamsApiError(500, 'invalid team response')
  return opened
}
export async function fetchTeamLead(session?: string): Promise<TeamLead> {
  return lead(await requestJson(scoped('/api/live-teams/team/lead', session), { method: 'GET', headers: { accept: 'application/json' } }))
}
export async function setTeamLead(memberId: string, session?: string): Promise<{ leadMemberId: string }> {
  const value = record(await requestJson('/api/live-teams/team/lead', { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify(withSession({ memberId }, session)) }))
  const leadMemberId = text(value.leadMemberId)
  if (leadMemberId === undefined) throw new LiveTeamsApiError(500, 'invalid team response')
  return { leadMemberId }
}

export async function fetchTeamSnapshot(session?: string, signal?: AbortSignal): Promise<TeamSnapshot> {
  const init: RequestInit = { method: 'GET', headers: { accept: 'application/json' } }
  if (signal !== undefined) init.signal = signal
  try {
    return snapshot(await requestJson(scoped('/api/live-teams/members', session), init))
  } catch (cause: unknown) {
    if (cause instanceof LiveTeamsApiError) throw cause
    throw new LiveTeamsApiError(500, 'invalid team response')
  }
}

async function mutate(path: string, body: Record<string, unknown>, session?: string): Promise<MutationSuccess> {
  try {
    return mutationSuccess(await requestJson(path, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(withSession(body, session)),
    }))
  } catch (cause: unknown) {
    if (cause instanceof LiveTeamsApiError) throw cause
    throw new LiveTeamsApiError(500, 'invalid team response')
  }
}

export function changeMemberRole(memberId: string, role: string, expectedRevision: number, session?: string): Promise<MutationSuccess> {
  return mutate('/api/live-teams/members/role', { memberId, role, expectedRevision }, session)
}

export function changeMemberAvailability(memberId: string, availability: 'available' | 'paused', expectedRevision: number, session?: string): Promise<MutationSuccess> {
  return mutate('/api/live-teams/members/availability', { memberId, availability, expectedRevision }, session)
}

export function changeMemberDisplayName(memberId: string, displayName: string, expectedRevision: number, session?: string): Promise<MutationSuccess> {
  return mutate('/api/live-teams/members/name', { memberId, displayName, expectedRevision }, session)
}

/**
 * The body's `sessionId` names the Session that JOINS, so the request scope travels
 * in the query instead. Passing it through `withSession` overwrote the joining
 * Session with the caller's, and the server refused it as already a member.
 */
/**
 * The human's own control over work (review finding 4): the same operations the lead's tools call.
 * The panel used to read tasks, accept them and send them back — creating one, changing a contract or
 * releasing a held attempt meant asking the lead and waiting a model turn.
 */
export type TaskControlDraft = {
  title: string
  kind: string
  assignee: string
  acceptance: string[]
  paths?: string[]
  checks?: string[]
  body?: string
  why?: string
  route?: { type: string; to?: string; reviewer?: string }
  roundLimit?: number
}

export async function createTeamTask(draft: TaskControlDraft, session?: string): Promise<{ task: TeamTask; documentPath: string; warnings: PathWarning[] }> {
  try {
    const result = record(await requestJson('/api/live-teams/task/create', {
      method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify(withSession(draft, session)),
    }))
    const documentPath = text(result.documentPath)
    if (documentPath === undefined) throw new Error('invalid create response')
    return { task: task(result.task), documentPath, warnings: pathWarnings(result.warnings) }
  } catch (cause) {
    if (cause instanceof LiveTeamsApiError) throw cause
    throw new LiveTeamsApiError(500, 'invalid team response')
  }
}

export async function updateTeamTask(request: { taskId: string; acceptance?: string[]; paths?: string[]; checks?: string[]; title?: string; assignee?: string; body?: string; expectedRevision?: number }, session?: string): Promise<{ task: TeamTask; document: string; changed: string[]; warnings: PathWarning[] }> {
  try {
    const result = record(await requestJson(scoped('/api/live-teams/task/update', session), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) }))
    if (typeof result.document !== 'string' || !Array.isArray(result.changed) || !result.changed.every((item) => typeof item === 'string')) throw new Error('invalid update response')
    return { task: task(result.task), document: result.document, changed: result.changed as string[], warnings: pathWarnings(result.warnings) }
  } catch (cause) {
    if (cause instanceof LiveTeamsApiError) throw cause
    throw new LiveTeamsApiError(500, 'invalid team response')
  }
}

export async function revokeTeamTask(request: { taskId: string; reason: string }, session?: string): Promise<{ task: TeamTask; attempt: TeamTaskAttempt; quiesced: boolean; reassigned: boolean }> {
  try {
    const result = record(await requestJson(scoped('/api/live-teams/task/revoke', session), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) }))
    if (typeof result.quiesced !== 'boolean' || typeof result.reassigned !== 'boolean') throw new Error('invalid revoke response')
    return { task: task(result.task), attempt: taskAttempt(result.attempt), quiesced: result.quiesced, reassigned: result.reassigned }
  } catch (cause) {
    if (cause instanceof LiveTeamsApiError) throw cause
    throw new LiveTeamsApiError(500, 'invalid team response')
  }
}

export function addTeamMember(request: { sessionId: string; displayName: string; role: string; memberId?: string; expectedRevision: number }, session?: string): Promise<MutationSuccess> {
  return mutate(scoped('/api/live-teams/members', session), request)
}

export async function createTeamSessionMember(request: { displayName: string; role: string; expectedRevision: number }, session?: string): Promise<CreateSessionSuccess> {
  try {
    return createSessionSuccess(await requestJson('/api/live-teams/members/create-session', {
      method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify(withSession(request, session)),
    }))
  } catch (cause: unknown) {
    if (cause instanceof LiveTeamsApiError) throw cause
    throw new LiveTeamsApiError(500, 'invalid team response')
  }
}

export async function interruptTeamMember(memberId: string, session?: string): Promise<InterruptTurnSuccess> {
  try {
    return interruptTurnSuccess(await requestJson('/api/live-teams/member/interrupt', {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(withSession({ memberId }, session)),
    }))
  } catch (cause: unknown) {
    if (cause instanceof LiveTeamsApiError) throw cause
    throw new LiveTeamsApiError(500, 'invalid team response')
  }
}

export type ContactGrant = { from: string; to: string; grantedBy: string; at: number }
export type ContactGrantResult = { grants: ContactGrant[]; leadMemberId?: string }
export async function grantTeamContact(request: { memberId: string; allow: string; action: 'add' | 'remove' }, session?: string): Promise<ContactGrantResult> {
  const value = record(await requestJson('/api/live-teams/member/grant', { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify(withSession(request, session)) }))
  if (!Array.isArray(value.grants)) throw new LiveTeamsApiError(500, 'invalid team response')
  return { grants: value.grants as ContactGrant[], ...(typeof value.leadMemberId === 'string' ? { leadMemberId: value.leadMemberId } : {}) }
}

export async function removeTeamMember(memberId: string, expectedRevision: number, session?: string): Promise<RemoveMemberSuccess> {
  try {
    return removeMemberSuccess(await requestJson('/api/live-teams/members/remove', {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(withSession({ memberId, expectedRevision }, session)),
    }))
  } catch (cause: unknown) {
    if (cause instanceof LiveTeamsApiError) throw cause
    throw new LiveTeamsApiError(500, 'invalid team response')
  }
}
