import { createHash, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { BlockList, isIP } from 'node:net'
import path from 'node:path'
import { ERROR_CODES, LiveTeamsError } from './errors.js'
import { TEAM_ROOT, type MemberRecord, type TeamState } from './team-store.js'
import { canonicalPath } from './binding.js'
import type { SessionDescriptor } from './session-bridge.js'
import type { RoleRegistry } from './roles.js'
import { messageDeliveryOutcome, type MailboxService, type MessageKind, type TeamMessage } from './mailbox.js'
import type { MessageDelivery } from './mailbox.js'
import { resolveLeadMemberId } from './team-store.js'
import { permittedContacts } from './task-store.js'
import { blockedBy, type CreateTaskRequest, type ReadTaskResult, type TaskRoute, type TaskStore, type TeamTask } from './task-store.js'
import type { DispatchEvaluation } from './dispatch.js'
import { parseReviewReturn } from './review-return-state.js'

export const LIVE_TEAMS_MEMBERS_ROUTE = '/api/live-teams/members'
export const LIVE_TEAMS_CANDIDATES_ROUTE = '/api/live-teams/candidates'
export const LIVE_TEAMS_MEMBER_ROLE_ROUTE = '/api/live-teams/members/role'
export const LIVE_TEAMS_MEMBER_AVAILABILITY_ROUTE = '/api/live-teams/members/availability'
export const LIVE_TEAMS_MEMBER_NAME_ROUTE = '/api/live-teams/members/name'
export const LIVE_TEAMS_MEMBER_REMOVE_ROUTE = '/api/live-teams/members/remove'
export const LIVE_TEAMS_MEMBER_CREATE_SESSION_ROUTE = '/api/live-teams/members/create-session'
export const LIVE_TEAMS_MEMBER_INTERRUPT_ROUTE = '/api/live-teams/member/interrupt'
export const LIVE_TEAMS_ROLES_ROUTE = '/api/live-teams/roles'
export const LIVE_TEAMS_ROLES_OPEN_ROUTE = '/api/live-teams/roles/open'
export const LIVE_TEAMS_ROLES_OVERRIDE_ROUTE = '/api/live-teams/roles/override'
export const LIVE_TEAMS_TEAM_ROUTE = '/api/live-teams/team'
export const LIVE_TEAMS_TEAM_ENABLE_ROUTE = '/api/live-teams/team/enable'
export const LIVE_TEAMS_TEAM_DISABLE_ROUTE = '/api/live-teams/team/disable'
export const LIVE_TEAMS_TEAM_NAME_ROUTE = '/api/live-teams/team/name'
export const LIVE_TEAMS_TEAM_CANDIDATES_ROUTE = '/api/live-teams/team/candidates'
export const LIVE_TEAMS_TEAM_ADOPT_ROUTE = '/api/live-teams/team/adopt'
export const LIVE_TEAMS_MESSAGES_ROUTE = '/api/live-teams/messages'
export const LIVE_TEAMS_ATTENTION_ROUTE = '/api/live-teams/attention'
export const LIVE_TEAMS_MESSAGES_ACKNOWLEDGE_ROUTE = '/api/live-teams/messages/acknowledge'
export const LIVE_TEAMS_JOURNAL_ROUTE = '/api/live-teams/journal'
export const LIVE_TEAMS_TEAM_LEAD_ROUTE = '/api/live-teams/team/lead'
export const LIVE_TEAMS_TEAM_BRIEFING_OPEN_ROUTE = '/api/live-teams/team/briefing/open'
export const LIVE_TEAMS_MEMBER_GRANT_ROUTE = '/api/live-teams/member/grant'
export const LIVE_TEAMS_DISPATCH_ROUTE = '/api/live-teams/dispatch'
export const LIVE_TEAMS_TEAM_ROTATION_ROUTE = '/api/live-teams/team/rotation'
export const LIVE_TEAMS_TASKS_ROUTE = '/api/live-teams/tasks'
export const LIVE_TEAMS_TASK_ROUTE = '/api/live-teams/task'
export const LIVE_TEAMS_TASK_ACCEPT_ROUTE = '/api/live-teams/task/accept'
export const LIVE_TEAMS_TASK_NOTIFY_SUBMISSION_ROUTE = '/api/live-teams/task/notify-submission'
export const LIVE_TEAMS_TASK_NOTIFY_REVIEW_ROUTE = '/api/live-teams/task/notify-review'
export const LIVE_TEAMS_TASK_REVISE_ROUTE = '/api/live-teams/task/revise'
export const LIVE_TEAMS_TASK_CANCEL_ROUTE = '/api/live-teams/task/cancel'
export const LIVE_TEAMS_TASK_RESUME_ROUTE = '/api/live-teams/task/resume'
/** The human's own control over work: create it, change its contract, release a held attempt. */
export const LIVE_TEAMS_TASK_CREATE_ROUTE = '/api/live-teams/task/create'
export const LIVE_TEAMS_TASK_UPDATE_ROUTE = '/api/live-teams/task/update'
export const LIVE_TEAMS_TASK_REVOKE_ROUTE = '/api/live-teams/task/revoke'
const MAX_MUTATION_BODY_BYTES = 8 * 1024

type HeaderValue = string | readonly string[] | undefined
type RequestHeaders = Record<string, HeaderValue>
type BodyValue = string | Uint8Array | AsyncIterable<Uint8Array | string>
type BodyStream = AsyncIterable<Uint8Array | string>

export type LiveTeamsRequest = {
  readonly method?: string
  readonly headers: RequestHeaders
  readonly socket: { readonly remoteAddress?: string }
  readonly url?: string
  readonly body?: BodyValue
}

export type LiveTeamsResponse = {
  statusCode: number
  setHeader(name: string, value: string): void
  end(body?: string): void
}

type ExactRoute = {
  kind: 'exact'
  path: string
  handler: (request: LiveTeamsRequest, response: LiveTeamsResponse) => void | Promise<void>
}

export type LiveTeamsWebServer = {
  readonly port: number
  register(route: ExactRoute): () => void
}

export type LiveTeamsRouteContext = { readonly webServer: LiveTeamsWebServer }

/** The registry is deliberately queried only for the bound Session's liveness. */
export type LiveAgentRegistry = { get(sessionId: string): unknown }

export type LiveTeamsMutation = {
  readonly kind: 'role' | 'availability' | 'name'
  readonly memberId: string
  readonly value: string
  readonly expectedRevision: number
}

export type LiveTeamsRemoveMemberRequest = {
  readonly memberId: string
  readonly expectedRevision: number
}

export type LiveTeamsRemoveMemberResult = {
  readonly state: TeamState
  readonly removed: MemberRecord
}

export type LiveTeamsTitleResult = LiveTeamsSessionTitleResult

export type LiveTeamsMutationResult = {
  readonly state: TeamState
  readonly member: MemberRecord
  readonly from: string
  readonly to: string
  readonly sessionTitle?: LiveTeamsTitleResult
}

export type LiveTeamsCreateMemberRequest = {
  readonly sessionId: string
  readonly displayName: string
  readonly role: string
  readonly memberId?: string
  readonly expectedRevision: number
}

export type LiveTeamsSessionTitleResult = {
  readonly from: string | null
  readonly to: string
  readonly reason: 'member-added' | 'member-renamed'
  readonly renamed: boolean
}

export type LiveTeamsCreateMemberResult = {
  readonly state: TeamState
  readonly member: MemberRecord
  readonly sessionTitle?: LiveTeamsSessionTitleResult
}

export type LiveTeamsCreateSessionMemberRequest = {
  readonly sessionId: string
  readonly displayName: string
  readonly role: string
  readonly expectedRevision: number
}

export type LiveTeamsCreateSessionMemberResult = {
  readonly state: TeamState
  readonly member: MemberRecord
  readonly sessionTitle?: LiveTeamsSessionTitleResult
}

export type LiveTeamsCandidate = {
  readonly sessionId: string
  readonly title: string | null
  readonly cwd: string
  readonly live: boolean
  readonly status: 'idle' | 'running' | 'unknown'
}

export type LiveTeamsJournalCategory = 'message' | 'delivery' | 'task' | 'review' | 'contact' | 'team' | 'member' | 'other'
export type JournalCategory = LiveTeamsJournalCategory
export type JournalRefs = { readonly taskId?: string; readonly taskTitle?: string; readonly messageId?: string; readonly round?: number }

export type LiveTeamsJournalEntry = {
  readonly id: string
  readonly kind: string
  readonly category: LiveTeamsJournalCategory
  readonly at: number
  readonly actor?: string
  readonly actorName?: string
  readonly summary: string
  readonly refs: JournalRefs
  readonly detail?: string
  /**
   * Everything the row knows, resolved for a person: who, to whom, which task, which attempt.
   * The summary is one line; this is what the row unfolds into.
   */
  fields?: { label: string; value: string }[]
  /**
   * The summary split into plain and emphasised runs. The server knows exactly which words are
   * people's names, so the panel does not have to guess them back out of a sentence.
   */
  summaryParts?: { text: string; strong?: boolean }[]
}
export type JournalEntry = LiveTeamsJournalEntry
export type LiveTeamsJournal = { readonly teamId: string; readonly entries: LiveTeamsJournalEntry[] }

export type LiveTeamsAuditRecord = {
  readonly kind: 'briefing/updated'
  readonly actor: string
  readonly length: number
  readonly at: number
} | {
  readonly kind: 'member/note'
  readonly memberId: string
  readonly note: string
  readonly actor: string
  readonly at: number
} | {
  readonly kind: 'team/lead'
  readonly memberId: string
  readonly actor: MutationActor
  readonly at: number
} | {
  /** The lead name was cleared; there is no member to name. */
  readonly kind: 'team/lead-cleared'
  readonly actor: MutationActor
  readonly at: number
} | {
  readonly kind: 'member/interrupted'
  readonly memberId: string
  readonly sessionId: string
  readonly actor: MutationActor
  readonly at: number
} | {
  /**
   * The host refused to interrupt — the member was idle, unbound, or the interrupt failed.
   * Recorded because an operator action that changes nothing is still an operator action,
   * and without this the panel's "nothing happened" is indistinguishable from a lost click
   * (F18 of the third live run).
   */
  readonly kind: 'member/interrupt-refused'
  readonly memberId: string
  readonly sessionId?: string
  readonly reason: string
  readonly actor: MutationActor
  readonly at: number
} | {
  readonly kind: 'team/adopted'
  readonly teamId: string
  readonly fromTeamId: string
  readonly name: string
  readonly memberCount: number
  readonly at: number
  readonly actor: MutationActor
} | {
  readonly kind: 'member/role-changed' | 'member/availability-changed' | 'member/name-changed'
  readonly memberId: string
  readonly from: string
  readonly to: string
  readonly at: number
  readonly actor: MutationActor
  readonly expectedRevision: number
  readonly appliedRevision: number
} | {
  readonly kind: 'member/added'
  readonly memberId: string
  readonly sessionId: string
  readonly displayName: string
  readonly role: string
  readonly at: number
  readonly actor: MutationActor
  readonly expectedRevision: number
  readonly appliedRevision: number
} | {
  readonly kind: 'member/removed'
  readonly memberId: string
  readonly displayName: string
  readonly role: string
  readonly sessionId: string | null
  readonly at: number
  readonly actor: MutationActor
  readonly expectedRevision: number
  readonly appliedRevision: number
} | {
  readonly kind: 'session/titled'
  readonly sessionId: string
  readonly from: string | null
  readonly to: string
  readonly reason: 'member-added' | 'member-renamed'
  readonly at: number
  readonly actor: MutationActor
} | {
  readonly kind: 'team/enabled' | 'team/disabled'
  readonly teamId: string
  readonly name?: string
  readonly at: number
  readonly actor: MutationActor
} | {
  readonly kind: 'team/renamed'
  readonly teamId: string
  readonly from: string
  readonly to: string
  readonly at: number
  readonly actor: MutationActor
}

export type LiveTeamsRoleSummary = {
  readonly id: string
  readonly name: string
  readonly description?: string
  readonly aliases: string[]
  readonly source: 'global' | 'workspace'
  readonly overridden: boolean
}

export type LiveTeamsRoles = {
  readonly roles: LiveTeamsRoleSummary[]
  readonly globalDirectory: string
  readonly workspaceDirectory: string
  readonly workspaceDirectoryExists: boolean
  readonly openAvailable: boolean
  readonly globalOpenAvailable: boolean
}

export type LiveTeamsRoleOpenRequest = { readonly scope: 'global' | 'workspace'; readonly id?: string }

export type LiveTeamsTeamStatus = {
  readonly enabled: boolean
  /** What the plugin found when it asked the host for the surfaces it calls. */
  readonly compatibility?: {
    readonly verdict: 'compatible' | 'degraded' | 'incompatible'
    readonly hostVersion?: string
    readonly missing: readonly string[]
    readonly absent: readonly string[]
    readonly detail: string
  }
  readonly briefing?: string
  readonly openAvailable?: boolean
  readonly teamId: string
  readonly teamName: string
  readonly workspacePath: string
  readonly revision?: number
  readonly memberCount: number
}

export type LiveTeamsAdoptionCandidate = {
  readonly teamId: string
  readonly name?: string
  readonly memberCount?: number
  readonly updatedAt?: number
  readonly usable?: boolean
  readonly reason?: string
}

export type LiveTeamsTeamCandidates = {
  readonly teamId: string
  readonly workspacePath: string
  readonly candidates: readonly LiveTeamsAdoptionCandidate[]
}

export type LiveTeamsTaskRouteSummary =
  | { readonly type: 'report'; readonly to: string | 'human'; readonly toName?: string }
  | { readonly type: 'review'; readonly reviewer: string; readonly reviewerName?: string }
  | { readonly type: 'interactive'; readonly then: LiveTeamsTaskRouteSummary }
  | { readonly type: 'custom'; readonly description: string }

export type LiveTeamsTaskSummary = {
  readonly reviewReturn?: NonNullable<TeamTask['reviewReturn']>
  readonly id: string
  readonly title: string
  readonly status: TeamTask['status']
  /** A submission is in and nobody has decided on it: the lead or the human owes an accept or a return. */
  readonly awaitsDecision?: boolean
  readonly assignee?: string
  readonly assigneeName?: string
  readonly route?: LiveTeamsTaskRouteSummary
  readonly round?: number
  readonly roundLimit?: number
  readonly updatedAt: number
  readonly archivedPath?: string
  readonly documentMissing?: true
  readonly dependsOn?: readonly string[]
  /**
   * Dependencies that are not `completed`, in contract order. A client must be
   * able to tell a claimable task from a blocked one without joining two lists,
   * and a dependency that died is included on purpose: it blocks forever.
   */
  readonly blockedBy?: readonly LiveTeamsTaskBlocker[]
}

export type LiveTeamsTaskBlocker = { readonly id: string; readonly title: string; readonly status: TeamTask['status'] }

/**
 * The dispatch projection: for every task, the decision the reconciler would take
 * and the reason for it, in the same words the journal uses. One source answers
 * both the lead's question ("why is this not running?") and the panel's chip.
 */
export type LiveTeamsDispatch = {
  readonly teamId: string
  readonly paused: boolean
  /** `manual` means coding work is never started automatically (design §22, Gate C). */
  readonly coding: 'manual' | 'automatic'
  readonly pausedBy?: string
  readonly pausedReason?: string
  readonly counts: Record<'assign' | 'active' | 'wait' | 'refused', number>
  readonly tasks: readonly DispatchEvaluation[]
}

export type LiveTeamsTasks = { readonly teamId: string; readonly tasks: LiveTeamsTaskSummary[] }
export type LiveTeamsTaskDetail = ReadTaskResult & { readonly documentMissing?: true }

export type LiveTeamsRouteOptions = {
  /** Resolve a request to the workspace/team context. Undefined means invalid request. */
  readonly resolveRequest?: (request: LiveTeamsRequest, sessionId?: string) => Promise<LiveTeamsRouteOptions | undefined>
  /** Read lifecycle state without creating a team. */
  readonly teamStatus?: () => Promise<LiveTeamsTeamStatus>
  readonly enableTeam?: (name?: string, createNew?: boolean) => Promise<LiveTeamsTeamStatus>
  readonly disableTeam?: () => Promise<LiveTeamsTeamStatus>
  readonly renameTeam?: (name: string, expectedRevision: number) => Promise<{ status: LiveTeamsTeamStatus; from: string }>
  readonly requestSessionId?: string
  readonly teamEnabled?: () => Promise<boolean>
  readonly teamId: string
  /** Human-readable team name shown in the interface; falls back to the id. */
  readonly teamName?: string
  readonly workspacePath: string
  readonly agents?: LiveAgentRegistry
  /** Read the current state without creating or mutating it. Runtime shape is validated here. */
  readonly readState?: () => Promise<unknown>
  /** Apply one compare-and-set mutation. A REVISION_CONFLICT result is retried once. */
  readonly applyMutation?: (request: LiveTeamsMutation) => Promise<LiveTeamsMutationResult>
  /** Discover cold-readable Sessions; the route applies workspace and ownership filtering. */
  readonly listCandidates?: () => Promise<readonly SessionDescriptor[]>
  /** Create one member after the provider has performed the workspace guard. */
  readonly createMember?: (request: LiveTeamsCreateMemberRequest) => Promise<LiveTeamsCreateMemberResult>
  /** Create and bind a new Session-backed member in the team's workspace. */
  readonly createSessionMember?: (request: LiveTeamsCreateSessionMemberRequest) => Promise<LiveTeamsCreateSessionMemberResult>
  /** Resolve whether the team's canonical workspace is registered in DSH. */
  readonly workspaceRegistered?: () => boolean | Promise<boolean>
  /** Remove one member record without touching its Session. */
  readonly removeMember?: (request: LiveTeamsRemoveMemberRequest) => Promise<LiveTeamsRemoveMemberResult>
  /** Append the audit record before a successful mutation is reported to the caller. */
  readonly appendAudit?: (event: LiveTeamsAuditRecord) => Promise<void>
  /** Read the existing append-only audit; this route never writes to it. */
  readonly readEvents?: (after?: number) => Promise<{ events: readonly unknown[]; torn: string | null; nextOffset?: number; truncated?: boolean }>
  /** Cancel one currently-running member turn through the existing Session bridge. */
  readonly interrupt?: (sessionId: string, reason: string) => Promise<{ accepted: true }>
  /** Discover legacy team directories for adoption. */
  readonly listTeamCandidates?: () => Promise<readonly LiveTeamsAdoptionCandidate[]>
  /** Adopt a legacy team into this workspace's derived id. */
  readonly adoptTeam?: (teamId: string, replaceEmptyDerived: boolean) => Promise<{ status: LiveTeamsTeamStatus; adoptedFrom: string }>
  /** Apply a Session title after membership state commits. */
  readonly titleSession?: (request: { sessionId: string; displayName: string; reason: 'member-added' | 'member-renamed'; previousTitle?: string }) => Promise<LiveTeamsSessionTitleResult | undefined>
  /** Report best-effort title/audit failures without changing membership success. */
  readonly logger?: { warn?: (message: string) => void }
  readonly roles?: RoleRegistry
  readonly readRoles?: () => Promise<RoleRegistry>
  readonly roleRegistry?: () => Promise<RoleRegistry>
  readonly canOpenWorkspacePath?: () => boolean | Promise<boolean>
  readonly openWorkspacePath?: (request: { path: string; action: 'reveal' | 'open' }, signal: AbortSignal) => Promise<unknown>
  readonly copyRoleOverride?: (id: string) => Promise<{ id: string; path: string }>
  /** Human-facing mailbox for the bound team. */
  readonly mailbox?: MailboxService
  /** The host-compatibility verdict, so the panel can say why the team is off. */
  readonly compatibility?: () => LiveTeamsTeamStatus['compatibility']
  /** Durable B19-B22 task store for the human task surface. */
  readonly taskStore?: TaskStore
  /** `undefined` clears the name; the team falls back to whoever holds the `lead` role. */
  readonly setLead?: (memberId: string | undefined, expectedRevision: number) => Promise<{ state: TeamState; leadMemberId?: string }>
  readonly setContactGrant?: (from: string, to: string, action: 'add' | 'remove', actor: string) => Promise<{ grants: { from: string; to: string; grantedBy: string; at: number }[] }>
  /** Read the dispatch projection; never mutates and never creates a team. */
  readonly readDispatch?: () => Promise<LiveTeamsDispatch | undefined>
  /** Flip the dispatch switch under the actor's own authority; the store refuses a no-op. */
  readonly setDispatch?: (request: { mode: 'auto' | 'paused'; reason?: string; actor: string }) => Promise<{ from: string; to: string }>
  /** Rotation limits in force for this team, with where they came from. */
  readonly readRotation?: () => Promise<LiveTeamsRotation | undefined>
  /** Set this team's rotation overrides; the human's own surface, like dispatch. */
  readonly setRotation?: (request: LiveTeamsRotationRequest & { actor: string }) => Promise<LiveTeamsRotation>
}

export type LiveTeamsRotation = {
  readonly enabled: boolean
  readonly maxContextTokens: number
  readonly maxCompletedTasks: number
  readonly cooldownMs: number
  readonly maxRotationsPerPass: number
  /** `team` when the panel has overrides in force, `profile` when the deployment row decides. */
  readonly source: 'team' | 'profile'
  readonly revision: number
}

export type LiveTeamsRotationRequest = {
  readonly enabled?: boolean
  readonly maxContextTokens?: number
  readonly maxCompletedTasks?: number
  readonly expectedRevision: number
}

export type LiveTeamsSnapshotMember = {
  memberId: string
  permittedContacts: readonly string[]
  displayName: string
  role: string
  availability: string
  sessionId: string | null
  live: boolean
  status: 'idle' | 'running' | 'unknown'
  bindingGeneration: number
  contractRevision: number
}

export type LiveTeamsSnapshot = {
  teamId: string
  leadMemberId?: string
  /** Human-readable team name when one is configured; the id otherwise. */
  teamName: string
  workspacePath: string
  revision: number
  members: LiveTeamsSnapshotMember[]
}

export type LiveTeamsCandidates = {
  teamId: string
  /**
   * The name the Sessions above were titled with, so a client can undo the
   * `<member> - <team>` suffix without asking a second endpoint. The two
   * endpoints that report a team name must never disagree: `/team` answers from
   * the persisted state, so this one does too.
   */
  teamName: string
  workspacePath: string
  revision: number
  candidates: LiveTeamsCandidate[]
}

/**
 * Who is waiting for the human, in one entry per member.
 *
 * This exists because the inbox was the wrong shape for the question the human
 * actually asks — "does anyone need me?" — and the answer must be reachable from
 * any Session, not only from the Team tab.
 */
export type LiveTeamsAttentionEntry = {
  memberId: string
  name: string
  /** Session to open on click; `null` when the member lost its binding. */
  sessionId: string | null
  /** Unread human-addressed deliveries from this member. */
  waiting: number
  /** Arrival of the oldest unread one: how long they have been waiting. */
  since: number
  /** Kind of the newest unread message, so the chip can say what it is. */
  kind: MessageKind
}

export type LiveTeamsAttention = {
  teamId: string
  attention: LiveTeamsAttentionEntry[]
}

class StateUnavailableError extends Error {}

function headerValue(value: HeaderValue): string | undefined {
  if (typeof value === 'string') return value
  return Array.isArray(value) && typeof value[0] === 'string' ? value[0] : undefined
}

function sendJson(response: LiveTeamsResponse, status: number, value: unknown): void {
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.setHeader('cache-control', 'no-store')
  response.setHeader('x-content-type-options', 'nosniff')
  response.end(JSON.stringify(value))
}

const loopbackAddresses = new BlockList()
loopbackAddresses.addSubnet('127.0.0.0', 8, 'ipv4')
loopbackAddresses.addSubnet('::1', 128, 'ipv6')

export type LiveTeamsRequestContext = {
  readonly remoteAddress: string | undefined
  readonly host: string | undefined
  readonly secFetchSite?: string
  readonly expectedPort: number
}

/**
 * Who a mutation is attributed to: a request that carried browser evidence, or one that did not.
 * Both exist and the journal says which — see `actorOf`.
 */
export type MutationActor = 'human:desktop' | 'local:unverified'

/** Mirrors the shipped community-market read authority fence. */
export function liveTeamsRequestAllowed(context: LiveTeamsRequestContext): boolean {
  if (context.remoteAddress === undefined || context.host === undefined) return false
  const address = context.remoteAddress.replace(/^\[|\]$/gu, '').split('%', 1)[0] ?? ''
  const family = isIP(address)
  if (family === 0 || !loopbackAddresses.check(address, family === 4 ? 'ipv4' : 'ipv6')) return false
  let authority: URL
  try {
    authority = new URL(`http://${context.host}`)
  } catch {
    return false
  }
  if (authority.protocol !== 'http:'
    || Number(authority.port || '80') !== context.expectedPort
    || authority.hostname !== '127.0.0.1'
    || context.secFetchSite === 'cross-site') return false
  return true
}

/**
 * Who a mutation is attributed to, decided by what the request actually proves.
 *
 * The fence (`liveTeamsRequestAllowed`) keeps the network and a cross-site page out, but it cannot
 * tell a browser from `curl` on the same machine: any local process can send the same headers, and a
 * member is a full Session with a shell. Pretending otherwise put "the human accepted this" into the
 * journal for work a process did.
 *
 * So the audit says which of the two it saw. `human:desktop` means the request carried the evidence
 * only a same-origin page sends — `Sec-Fetch-Site: same-origin` and an `Origin` whose host is the
 * `Host` it was sent to. Everything else is `local:unverified`: it may well be the human's own
 * script, and the journal does not claim to know. This is attribution, not authentication; making it
 * authentication needs a credential the panel holds and a local process cannot read (see
 * `docs/implementation/open-questions-to-dsh.md`).
 */
export function actorOf(context: { host: string | undefined; origin: string | undefined; secFetchSite: string | undefined }): 'human:desktop' | 'local:unverified' {
  if (context.secFetchSite !== 'same-origin') return 'local:unverified'
  if (context.host === undefined || context.origin === undefined) return 'local:unverified'
  try {
    const origin = new URL(context.origin)
    const host = new URL(`http://${context.host}`)
    return origin.protocol === 'http:' && origin.hostname === host.hostname && (origin.port || '80') === (host.port || '80') ? 'human:desktop' : 'local:unverified'
  } catch { return 'local:unverified' }
}

function actorFor(request: LiveTeamsRequest, expectedPort: number): 'human:desktop' | 'local:unverified' {
  if (!authorityAllowed(request, expectedPort)) return 'local:unverified'
  return actorOf({
    host: headerValue(request.headers.host),
    origin: headerValue(request.headers.origin),
    secFetchSite: headerValue(request.headers['sec-fetch-site']),
  })
}

function authorityAllowed(request: LiveTeamsRequest, expectedPort: number): boolean {
  const secFetchSite = headerValue(request.headers['sec-fetch-site'])
  return liveTeamsRequestAllowed({
    remoteAddress: request.socket.remoteAddress,
    host: headerValue(request.headers.host),
    ...(secFetchSite === undefined ? {} : { secFetchSite }),
    expectedPort,
  })
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function requiredText(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function validInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function memberOf(value: unknown): MemberRecord {
  const candidate = record(value)
  const memberId = requiredText(candidate.memberId)
  const displayName = requiredText(candidate.displayName)
  const role = requiredText(candidate.role)
  const availability = requiredText(candidate.availability)
  const sessionIdValue = candidate.sessionId
  const note = candidate.note
  const bindingGeneration = candidate.bindingGeneration
  const contractRevision = candidate.contractRevision
  if (memberId === undefined || displayName === undefined || role === undefined || availability === undefined
    || (sessionIdValue !== undefined && requiredText(sessionIdValue) === undefined)
    || !validInteger(bindingGeneration) || !validInteger(contractRevision)) {
    throw new StateUnavailableError('invalid member state')
  }
  return {
    memberId,
    displayName,
    role,
    availability,
    ...(sessionIdValue === undefined ? {} : { sessionId: String(sessionIdValue) }),
    ...(note === undefined ? {} : typeof note === 'string' ? { note } : {}),
    bindingGeneration,
    contractRevision,
  }
}

function stateOf(value: unknown, options: Pick<LiveTeamsRouteOptions, 'teamId' | 'workspacePath'>): TeamState {
  const candidate = record(value)
  const schemaVersion = candidate.schemaVersion
  const revision = candidate.revision
  const teamId = requiredText(candidate.teamId)
  const workspaceId = requiredText(candidate.workspaceId)
  const workspacePath = requiredText(candidate.workspacePath)
  const membersValue = candidate.members
  const archivedMemberIds = candidate.archivedMemberIds
  const createdAt = candidate.createdAt
  const updatedAt = candidate.updatedAt
  const name = candidate.name
  const leadMemberId = candidate.leadMemberId
  const rawContactGrants = candidate.contactGrants
  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0 || Array.from(name.trim()).length > 64)) throw new StateUnavailableError('invalid team name')
  if (!validInteger(schemaVersion) || schemaVersion > 1 || !validInteger(revision)
    || teamId !== options.teamId || workspaceId === undefined || workspacePath === undefined
    || canonicalPath(workspacePath) !== canonicalPath(options.workspacePath)
    || !Array.isArray(membersValue) || !Array.isArray(archivedMemberIds)
    || !archivedMemberIds.every((memberId): memberId is string => requiredText(memberId) !== undefined)
    || !validInteger(createdAt) || !validInteger(updatedAt)) {
    throw new StateUnavailableError('invalid team state')
  }
  const members = membersValue.map(memberOf)
  if (leadMemberId !== undefined && (typeof leadMemberId !== 'string' || !members.some((member) => member.memberId === leadMemberId))) throw new StateUnavailableError('invalid lead member')
  const contactGrants = rawContactGrants === undefined ? undefined : rawContactGrants
  if (contactGrants !== undefined && (!Array.isArray(contactGrants) || !contactGrants.every((grant): grant is { from: string; to: string; grantedBy: string; at: number } => grant !== null && typeof grant === 'object' && typeof grant.from === 'string' && typeof grant.to === 'string' && typeof grant.grantedBy === 'string' && validInteger(grant.at) && members.some((member) => member.memberId === grant.from) && (grant.to === 'human' || grant.to === 'team' || members.some((member) => member.memberId === grant.to))))) throw new StateUnavailableError('invalid contact grants')
  const memberIds = new Set<string>()
  for (const member of members) {
    if (memberIds.has(member.memberId)) throw new StateUnavailableError('duplicate member id')
    memberIds.add(member.memberId)
  }
  return {
    schemaVersion,
    revision,
    teamId,
    workspaceId,
    workspacePath,
    members,
    archivedMemberIds: [...archivedMemberIds],
    createdAt,
    updatedAt,
    ...(typeof name === 'string' ? { name: name.trim() } : {}),
    ...(typeof leadMemberId === 'string' ? { leadMemberId } : {}),
    ...(contactGrants === undefined ? {} : { contactGrants }),
  }
}

async function readTeamState(options: LiveTeamsRouteOptions): Promise<TeamState> {
  if (options.readState !== undefined) return stateOf(await options.readState(), options)
  const file = path.join(path.resolve(options.workspacePath), TEAM_ROOT, 'teams', options.teamId, 'team.json')
  let parsed: unknown
  try {
    parsed = JSON.parse(await readFile(file, 'utf8')) as unknown
  } catch (error) {
    throw new StateUnavailableError(error instanceof Error ? error.message : String(error))
  }
  return stateOf(parsed, options)
}

function statusOf(agent: unknown): 'idle' | 'running' | 'unknown' {
  try {
    const status = record(agent).status
    return status === 'idle' || status === 'running' ? status : 'unknown'
  } catch {
    return 'unknown'
  }
}

function liveAgentOf(registry: LiveAgentRegistry | undefined, sessionId: string): unknown {
  if (registry === undefined) return undefined
  try {
    return registry.get(sessionId)
  } catch {
    return undefined
  }
}

/**
 * One entry per member who has something the human has not read yet.
 *
 * Only deliveries the human has not acknowledged count: an acknowledged delivery
 * is the record that the human saw it, and that is the only thing that makes the
 * chip stop asking. `since` is the *oldest* unread arrival, because "waiting
 * since 11:33" is the number that matters, not the newest.
 */
export function projectLiveTeamsAttention(
  state: TeamState,
  messages: readonly TeamMessage[],
  deliveries: readonly MessageDelivery[],
): LiveTeamsAttention {
  const checked = stateOf(state, { teamId: state.teamId, workspacePath: state.workspacePath })
  const byId = new Map(messages.map((message) => [message.id, message]))
  type Accumulated = { waiting: number; since: number; newestAt: number; kind: MessageKind }
  const grouped = new Map<string, Accumulated>()
  for (const delivery of deliveries) {
    if (delivery.recipient !== 'human' || delivery.state !== 'stored') continue
    const message = byId.get(delivery.messageId)
    if (message === undefined || message.from === 'human' || message.from === 'scheduler') continue
    const prior = grouped.get(message.from)
    grouped.set(message.from, prior === undefined
      ? { waiting: 1, since: message.createdAt, newestAt: message.createdAt, kind: message.kind }
      : {
          waiting: prior.waiting + 1,
          since: Math.min(prior.since, message.createdAt),
          newestAt: Math.max(prior.newestAt, message.createdAt),
          kind: message.createdAt >= prior.newestAt ? message.kind : prior.kind,
        })
  }
  const attention = [...grouped.entries()]
    .map(([memberId, entry]): LiveTeamsAttentionEntry => {
      const member = checked.members.find((candidate) => candidate.memberId === memberId)
      return {
        memberId,
        name: member?.displayName ?? memberId,
        sessionId: member?.sessionId ?? null,
        waiting: entry.waiting,
        since: entry.since,
        kind: entry.kind,
      }
    })
    .sort((left, right) => left.since - right.since || (left.memberId < right.memberId ? -1 : 1))
  return { teamId: checked.teamId, attention }
}

/**
 * The one answer to "what is this team called".
 *
 * The persisted name wins because the Session titles were derived from it; a
 * configured name is only a default for a team that was never renamed, and the
 * team id is the last resort. Two endpoints once answered this differently —
 * `/team` said `B1 Check` while `/members` said `live-teams-workspace` — which
 * is how the client ended up unable to strip its own title suffix.
 */
function teamNameOf(state: Pick<TeamState, 'name' | 'teamId'>, options: Pick<LiveTeamsRouteOptions, 'teamName'>): string {
  const persisted = typeof state.name === 'string' && state.name.trim().length > 0 ? state.name.trim() : undefined
  if (persisted !== undefined) return persisted
  const configured = options.teamName
  return configured === undefined || configured.length === 0 ? state.teamId : configured
}

export function projectLiveTeamsSnapshot(state: TeamState, options: Pick<LiveTeamsRouteOptions, 'teamId' | 'teamName' | 'workspacePath' | 'agents'>, tasks: readonly TeamTask[] = []): LiveTeamsSnapshot {
  const checked = stateOf(state, options)
  const members = checked.members
    .map((member) => {
      const sessionId = typeof member.sessionId === 'string' && member.sessionId.length > 0 ? member.sessionId : null
      const agent = sessionId === null ? undefined : liveAgentOf(options.agents, sessionId)
      const live = agent !== undefined && agent !== null
      return {
        memberId: member.memberId,
        // Names, not ids: this list is read by the human in the tab, and a raw
        // member id tells them nothing. Unknown ids keep their id rather than vanish.
        // The same rule the mailbox enforces: a narrower list here told the lead that contact with
        // colleagues was not allowed while its messages were being delivered to all of them.
        permittedContacts: permittedContacts(checked, member.memberId, tasks)
          .filter((value, index, values) => value.length > 0 && values.indexOf(value) === index)
          .map((target) => target === 'human' || target === 'team'
            ? target
            : checked.members.find((candidate) => candidate.memberId === target)?.displayName ?? target),
        displayName: member.displayName,
        role: member.role,
        availability: member.availability,
        sessionId,
        live,
        status: live ? statusOf(agent) : 'unknown',
        bindingGeneration: member.bindingGeneration,
        contractRevision: member.contractRevision,
      } satisfies LiveTeamsSnapshotMember
    })
    .sort((left, right) => left.memberId < right.memberId ? -1 : left.memberId > right.memberId ? 1 : 0)
  return {
    teamId: checked.teamId,
    ...(checked.leadMemberId === undefined ? {} : { leadMemberId: checked.leadMemberId }),
    teamName: teamNameOf(checked, options),
    workspacePath: checked.workspacePath,
    revision: checked.revision,
    members,
  }
}

function mutationMember(state: TeamState, memberId: string): MemberRecord | undefined {
  return state.members.find((member) => member.memberId === memberId)
}

function mutationConflict(error: unknown): boolean {
  return error instanceof LiveTeamsError && error.code === ERROR_CODES.REVISION_CONFLICT
}

async function appendSessionTitleAudit(options: LiveTeamsRouteOptions, sessionId: string, title: LiveTeamsSessionTitleResult | undefined, actor: MutationActor): Promise<void> {
  if (title === undefined || !title.renamed || options.appendAudit === undefined) return
  try {
    await options.appendAudit({ kind: 'session/titled', sessionId, from: title.from, to: title.to, reason: title.reason, at: Date.now(), actor })
  } catch (error) {
    options.logger?.warn?.(`live-teams: could not append Session title audit for "${sessionId}": ${String(error)}`)
  }
}

function invalidMutation(error: unknown): boolean {
  return error instanceof LiveTeamsError && error.code === ERROR_CODES.CAPABILITY_UNAVAILABLE
}

/**
 * A refused mutation leaves no audit by design, so without this line the reason
 * exists only in the response body. Write it to the host log as well.
 */
function logMutationFailure(options: Pick<LiveTeamsRouteOptions, 'logger'>, operation: string, error: unknown): void {
  if (typeof options.logger?.warn !== 'function') return
  if (error instanceof LiveTeamsError) {
    options.logger.warn(`live-teams: ${operation} refused (${error.code}): ${error.message}${error.auditDetail === undefined ? '' : ` [${error.auditDetail}]`}`)
    return
  }
  options.logger.warn(`live-teams: ${operation} failed: ${String(error)}`)
}

function createErrorStatus(error: unknown): 400 | 500 {
  if (!(error instanceof LiveTeamsError)) return 500
  if (error.code === ERROR_CODES.SESSION_NOT_FOUND || error.code === ERROR_CODES.SESSION_WRONG_WORKSPACE || error.code === ERROR_CODES.CAPABILITY_UNAVAILABLE) return 400
  return 500
}

function createErrorBody(error: unknown): { error: string } {
  if (error instanceof LiveTeamsError && error.auditDetail === 'workspace not registered') return { error: 'live-teams workspace not registered' }
  if (error instanceof LiveTeamsError && error.code === ERROR_CODES.SESSION_NOT_FOUND) return { error: 'live-teams session not found' }
  if (error instanceof LiveTeamsError && error.code === ERROR_CODES.SESSION_WRONG_WORKSPACE) return { error: 'live-teams session not in workspace' }
  if (error instanceof LiveTeamsError && error.code === ERROR_CODES.CAPABILITY_UNAVAILABLE && error.auditDetail?.startsWith('workspace guard:') === true) return { error: 'live-teams session not in workspace' }
  return { error: 'live-teams invalid request' }
}

function safeTeamId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value !== '.' && value !== '..' && !value.includes('/') && !value.includes('\\\\')
}

function adoptionErrorStatus(error: unknown): 400 | 409 | 500 {
  if (error instanceof LiveTeamsError && error.auditDetail === 'derived team already exists') return 409
  if (error instanceof LiveTeamsError && (error.code === ERROR_CODES.STATE_CORRUPT || error.code === ERROR_CODES.SCHEMA_UNSUPPORTED
    || error.auditDetail === 'invalid adoption path' || error.auditDetail === 'invalid candidate state' || error.auditDetail === 'invalid candidate member' || error.auditDetail === 'invalid archived member list')) return 400
  return 500
}


export function projectLiveTeamsCandidates(
  state: TeamState,
  descriptors: readonly SessionDescriptor[],
  options: Pick<LiveTeamsRouteOptions, 'teamId' | 'teamName' | 'workspacePath'>,
): LiveTeamsCandidates {
  const checked = stateOf(state, options)
  const bound = new Set(checked.members.flatMap((member) => typeof member.sessionId === 'string' && member.sessionId.length > 0 ? [member.sessionId] : []))
  const seen = new Set<string>()
  const candidates = descriptors
    .filter((descriptor) => descriptor.sessionId.length > 0
      && descriptor.cwd !== undefined
      && canonicalPath(descriptor.cwd) === canonicalPath(checked.workspacePath)
      && !descriptor.subagentOwned
      // A blank Session is the Workspace browser's own provisional "New session"
      // row: it is absent from the session list, so offering it would bind a
      // member to a Session the human can neither see nor find.
      && descriptor.blank !== true
      && !bound.has(descriptor.sessionId)
      && !seen.has(descriptor.sessionId))
    .map((descriptor) => {
      seen.add(descriptor.sessionId)
      return {
        sessionId: descriptor.sessionId,
        title: descriptor.title ?? null,
        cwd: descriptor.cwd as string,
        live: descriptor.live,
        status: descriptor.status,
      } satisfies LiveTeamsCandidate
    })
    .sort((left, right) => left.sessionId < right.sessionId ? -1 : left.sessionId > right.sessionId ? 1 : 0)
  return { teamId: checked.teamId, teamName: teamNameOf(checked, options), workspacePath: checked.workspacePath, revision: checked.revision, candidates }
}

async function readRequestBody(request: LiveTeamsRequest): Promise<string> {
  if (typeof request.body === 'string') {
    if (new TextEncoder().encode(request.body).byteLength > MAX_MUTATION_BODY_BYTES) throw new Error('body too large')
    return request.body
  }
  if (request.body !== undefined && typeof request.body !== 'string' && Symbol.asyncIterator in Object(request.body)) {
    const chunks: Uint8Array[] = []
    let size = 0
    for await (const chunk of request.body as AsyncIterable<Uint8Array | string>) {
      const bytes = typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk
      size += bytes.byteLength
      if (size > MAX_MUTATION_BODY_BYTES) throw new Error('body too large')
      chunks.push(bytes)
    }
    const result = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength }
    return new TextDecoder().decode(result)
  }
  if (request.body !== undefined && typeof request.body !== 'string' && !(Symbol.asyncIterator in Object(request.body))) {
    const body = new TextDecoder().decode(request.body as Uint8Array)
    if (new TextEncoder().encode(body).byteLength > MAX_MUTATION_BODY_BYTES) throw new Error('body too large')
    return body
  }
  const stream = request.body !== undefined && typeof request.body !== 'string' && Symbol.asyncIterator in Object(request.body)
    ? request.body as AsyncIterable<Uint8Array | string>
    : request as unknown as BodyStream
  const chunks: Uint8Array[] = []
  let size = 0
  for await (const chunk of stream) {
    const bytes = typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk
    size += bytes.byteLength
    if (size > MAX_MUTATION_BODY_BYTES) throw new Error('body too large')
    chunks.push(bytes)
  }
  const result = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(result)
}

function codePointText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 && Array.from(trimmed).length <= 64 ? trimmed : undefined
}

function parseCreateMember(body: string): LiveTeamsCreateMemberRequest {
  const candidate = record(JSON.parse(body) as unknown)
  const sessionId = requiredText(candidate.sessionId)
  const displayName = codePointText(candidate.displayName)
  const role = codePointText(candidate.role)
  const memberIdValue = candidate.memberId
  const memberId = memberIdValue === undefined ? undefined : requiredText(memberIdValue)
  const expectedRevision = candidate.expectedRevision
  if (sessionId === undefined || displayName === undefined || role === undefined
    || (memberIdValue !== undefined && memberId === undefined) || !validInteger(expectedRevision)) throw new Error('invalid member creation')
  return { sessionId, displayName, role, ...(memberId === undefined ? {} : { memberId }), expectedRevision }
}

function parseCreateSessionMember(body: string): LiveTeamsCreateSessionMemberRequest {
  const candidate = record(JSON.parse(body) as unknown)
  const displayName = codePointText(candidate.displayName)
  const role = codePointText(candidate.role)
  const expectedRevision = candidate.expectedRevision
  if (displayName === undefined || role === undefined || !validInteger(expectedRevision)) throw new Error('invalid session member creation')
  return { displayName, role, expectedRevision, sessionId: `session-${randomUUID()}` }
}

type LiveTeamsGrantRequest = { readonly sessionId: string; readonly memberId: string; readonly allow: string; readonly action: 'add' | 'remove' }
function parseGrant(body: string): LiveTeamsGrantRequest {
  const candidate = record(JSON.parse(body) as unknown)
  const sessionId = requiredText(candidate.sessionId)
  const memberId = requiredText(candidate.memberId)
  const allow = requiredText(candidate.allow)
  if (sessionId === undefined || memberId === undefined || allow === undefined || (candidate.action !== 'add' && candidate.action !== 'remove')) throw new Error('invalid contact grant')
  return { sessionId, memberId, allow, action: candidate.action }
}

function parseRemoveMember(body: string): LiveTeamsRemoveMemberRequest {
  const candidate = record(JSON.parse(body) as unknown)
  if (typeof candidate.memberId !== 'string' || candidate.memberId.length === 0 || !validInteger(candidate.expectedRevision)) throw new Error('invalid member removal')
  return { memberId: candidate.memberId, expectedRevision: candidate.expectedRevision }
}

function parseMutation(body: string, kind: LiveTeamsMutation['kind']): Omit<LiveTeamsMutation, 'kind'> {
  const candidate = record(JSON.parse(body) as unknown)
  const memberId = candidate.memberId
  const expectedRevision = candidate.expectedRevision
  if (typeof memberId !== 'string' || memberId.length === 0 || !validInteger(expectedRevision)) throw new Error('invalid mutation')
  if (kind === 'role') {
    if (typeof candidate.role !== 'string') throw new Error('invalid role')
    const role = candidate.role.trim()
    if (role.length === 0 || Array.from(role).length > 64) throw new Error('invalid role')
    return { memberId, value: role, expectedRevision }
  }
  if (kind === 'name') {
    if (typeof candidate.displayName !== 'string') throw new Error('invalid display name')
    const displayName = candidate.displayName.trim()
    if (displayName.length === 0 || Array.from(displayName).length > 64) throw new Error('invalid display name')
    return { memberId, value: displayName, expectedRevision }
  }
  if (candidate.availability !== 'available' && candidate.availability !== 'paused') throw new Error('invalid availability')
  return { memberId, value: candidate.availability, expectedRevision }
}

function bodyContentType(request: LiveTeamsRequest): string | undefined {
  const value = headerValue(request.headers['content-type'])
  return value?.split(';', 1)[0]?.trim().toLowerCase()
}

function roleList(registry: RoleRegistry, openAvailable = false, globalOpenAvailable = false): LiveTeamsRoles {
  return {
    roles: registry.roles.map((role) => ({
      id: role.id,
      name: role.name,
      ...(role.description === undefined ? {} : { description: role.description }),
      aliases: [...role.aliases],
      source: role.source,
      overridden: role.overridden,
    })),
    globalDirectory: registry.globalDirectory,
    workspaceDirectory: registry.workspaceDirectory,
    workspaceDirectoryExists: registry.workspaceDirectoryExists,
    openAvailable,
    globalOpenAvailable,
  }
}

function safeInside(directory: string, candidate: string): boolean {
  const root = path.resolve(directory)
  const resolved = path.resolve(candidate)
  return resolved === root || resolved.startsWith(`${root}${path.sep}`)
}

function parseRoleOpen(body: string): LiveTeamsRoleOpenRequest {
  const candidate = record(JSON.parse(body) as unknown)
  const scope = candidate.scope
  if (scope !== 'global' && scope !== 'workspace') throw new Error('invalid role scope')
  const id = candidate.id
  if (id !== undefined && (typeof id !== 'string' || id.length === 0 || roleIdFromValue(id) === undefined)) throw new Error('invalid role id')
  return id === undefined ? { scope } : { scope, id }
}

function roleIdFromValue(value: string): string | undefined {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value) ? value : undefined
}

async function currentRoles(options: LiveTeamsRouteOptions): Promise<RoleRegistry | undefined> {
  if (options.readRoles !== undefined) return options.readRoles()
  if (options.roles !== undefined) return options.roles
  return options.roleRegistry === undefined ? undefined : options.roleRegistry()
}

async function handleRolesList(request: LiveTeamsRequest, response: LiveTeamsResponse, ctx: LiveTeamsRouteContext, options: LiveTeamsRouteOptions): Promise<void> {
  if (!authorityAllowed(request, ctx.webServer.port)) { sendJson(response, 403, { error: 'live-teams request authority rejected' }); return }
  if (request.method !== 'GET') { sendJson(response, 405, { error: 'live-teams method not allowed' }); return }
  const registry = await currentRoles(options)
  if (registry === undefined) { sendJson(response, 503, { error: 'live-teams state unavailable' }); return }
  let openAvailable = false
  if (options.canOpenWorkspacePath !== undefined) {
    try { openAvailable = await options.canOpenWorkspacePath() } catch { openAvailable = false }
  }
  // Capability only says that an opener exists. Global path acceptance is tested
  // by the host at open time and is never inferred from this probe.
  sendJson(response, 200, roleList(registry, openAvailable, openAvailable))
}

async function handleRolesOpen(request: LiveTeamsRequest, response: LiveTeamsResponse, ctx: LiveTeamsRouteContext, options: LiveTeamsRouteOptions): Promise<void> {
  if (!authorityAllowed(request, ctx.webServer.port)) { sendJson(response, 403, { error: 'live-teams request authority rejected' }); return }
  if (request.method !== 'POST') { sendJson(response, 405, { error: 'live-teams method not allowed' }); return }
  if (bodyContentType(request) !== 'application/json') { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
  const declaredLength = headerValue(request.headers['content-length'])
  if (declaredLength !== undefined && /^\d+$/u.test(declaredLength) && Number(declaredLength) > MAX_MUTATION_BODY_BYTES) { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
  const registry = await currentRoles(options)
  if (registry === undefined || options.canOpenWorkspacePath === undefined || options.openWorkspacePath === undefined) { sendJson(response, 503, { error: 'live-teams open unavailable' }); return }
  let parsed: LiveTeamsRoleOpenRequest
  try { parsed = parseRoleOpen(await requestBody(request)) } catch { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
  const directory = parsed.scope === 'global' ? registry.globalDirectory : registry.workspaceDirectory
  const role = parsed.id === undefined ? undefined : parsed.scope === 'global'
    ? (registry.globalRoleIds.has(parsed.id) ? parsed.id : undefined)
    : registry.roles.find((entry) => entry.id === parsed.id && entry.source === 'workspace')
  if (parsed.id !== undefined && role === undefined) { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
  const target = parsed.id === undefined ? directory : parsed.scope === 'global'
    ? (registry.globalRolePath(parsed.id) ?? path.join(directory, `${parsed.id}.md`))
    : path.join(directory, `${parsed.id}.md`)
  if (!safeInside(directory, target)) { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
  let canOpen = false
  try { canOpen = await options.canOpenWorkspacePath() } catch { canOpen = false }
  if (!canOpen) { sendJson(response, 503, { error: 'live-teams open unavailable' }); return }
  try {
    await options.openWorkspacePath({ path: target, action: parsed.id === undefined ? 'reveal' : 'open' }, new AbortController().signal)
  } catch { sendJson(response, 503, { error: 'live-teams open unavailable' }); return }
  sendJson(response, 200, { opened: target })
}

async function handleRolesOverride(request: LiveTeamsRequest, response: LiveTeamsResponse, ctx: LiveTeamsRouteContext, options: LiveTeamsRouteOptions): Promise<void> {
  if (!authorityAllowed(request, ctx.webServer.port)) { sendJson(response, 403, { error: 'live-teams request authority rejected' }); return }
  if (request.method !== 'POST') { sendJson(response, 405, { error: 'live-teams method not allowed' }); return }
  if (bodyContentType(request) !== 'application/json') { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
  const declaredLength = headerValue(request.headers['content-length'])
  if (declaredLength !== undefined && /^\d+$/u.test(declaredLength) && Number(declaredLength) > MAX_MUTATION_BODY_BYTES) { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
  const registry = await currentRoles(options)
  if (registry === undefined || options.copyRoleOverride === undefined) { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
  let id: string
  try {
    const body = record(JSON.parse(await requestBody(request)) as unknown)
    if (typeof body.id !== 'string' || roleIdFromValue(body.id) === undefined) throw new Error('invalid id')
    id = body.id
  } catch { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
  if (!registry.globalRoleIds.has(id) || registry.globalRolePath(id) === undefined) { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
  try {
    const result = await options.copyRoleOverride(id)
    sendJson(response, 200, result)
  } catch (error) {
    if (error instanceof LiveTeamsError && error.code === ERROR_CODES.CAPABILITY_UNAVAILABLE && error.auditDetail === 'role already overridden') { sendJson(response, 409, { error: 'live-teams role already overridden' }); return }
    sendJson(response, 500, { error: 'live-teams mutation failed' })
  }
}

async function handleCreateMember(
  request: LiveTeamsRequest,
  response: LiveTeamsResponse,
  ctx: LiveTeamsRouteContext,
  options: LiveTeamsRouteOptions,
): Promise<void> {
  if (!authorityAllowed(request, ctx.webServer.port)) {
    sendJson(response, 403, { error: 'live-teams request authority rejected' })
    return
  }
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'live-teams method not allowed' })
    return
  }
  if (bodyContentType(request) !== 'application/json') {
    sendJson(response, 400, { error: 'live-teams invalid request' })
    return
  }
  const declaredLength = headerValue(request.headers['content-length'])
  if (declaredLength !== undefined && /^\d+$/u.test(declaredLength) && Number(declaredLength) > MAX_MUTATION_BODY_BYTES) {
    sendJson(response, 400, { error: 'live-teams invalid request' })
    return
  }
  let parsed: LiveTeamsCreateMemberRequest
  try {
    const requestPayload = parseCreateMember(await requestBody(request))
    parsed = requestPayload.memberId === undefined ? { ...requestPayload, memberId: `m-${randomUUID()}` } : requestPayload
  } catch {
    sendJson(response, 400, { error: 'live-teams invalid request' })
    return
  }
  if (options.createMember === undefined || options.appendAudit === undefined) {
    sendJson(response, 500, { error: 'live-teams mutation failed' })
    return
  }
  if (options.roles !== undefined || options.readRoles !== undefined || options.roleRegistry !== undefined) {
    let registry: RoleRegistry | undefined
    try { registry = await currentRoles(options) } catch { sendJson(response, 503, { error: 'live-teams state unavailable' }); return }
    const resolvedRole = registry?.resolve(parsed.role)
    if (resolvedRole === undefined) { sendJson(response, 400, { error: 'live-teams unknown role' }); return }
    parsed = { ...parsed, role: resolvedRole.id }
  }
  let state: TeamState
  try {
    state = await readTeamState(options)
  } catch {
    sendJson(response, 503, { error: 'live-teams state unavailable' })
    return
  }
  if (state.members.some((member) => member.sessionId === parsed.sessionId)
    || (parsed.memberId !== undefined && state.members.some((member) => member.memberId === parsed.memberId))) {
    logMutationFailure(options, `adding Session "${parsed.sessionId}" as a member`, new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'that Session is already a member of this team'))
    sendJson(response, 400, { error: 'live-teams invalid request' })
    return
  }

  let retried = false
  let applied: LiveTeamsCreateMemberResult | undefined
  const originalExpectedRevision = parsed.expectedRevision
  let expectedRevision = parsed.expectedRevision
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) retried = true
    try {
      applied = await options.createMember({ ...parsed, expectedRevision })
      break
    } catch (error) {
      if (!mutationConflict(error)) {
        const status = createErrorStatus(error)
        logMutationFailure(options, 'adding a member', error)
        sendJson(response, status, status === 400 ? createErrorBody(error) : { error: 'live-teams mutation failed' })
        return
      }
      if (attempt === 1) break
      try {
        state = await readTeamState(options)
      } catch {
        sendJson(response, 503, { error: 'live-teams state unavailable' })
        return
      }
      if (state.members.some((member) => member.sessionId === parsed.sessionId)
        || (parsed.memberId !== undefined && state.members.some((member) => member.memberId === parsed.memberId))) {
        sendJson(response, 400, { error: 'live-teams invalid request' })
        return
      }
      expectedRevision = state.revision
    }
  }

  if (applied === undefined) {
    try {
      state = await readTeamState(options)
    } catch {
      sendJson(response, 503, { error: 'live-teams state unavailable' })
      return
    }
    sendJson(response, 409, {
      error: 'live-teams revision conflict',
      revision: state.revision,
      members: projectLiveTeamsSnapshot(state, options).members,
    })
    return
  }

  const event: LiveTeamsAuditRecord = {
    kind: 'member/added',
    memberId: applied.member.memberId,
    sessionId: parsed.sessionId,
    displayName: applied.member.displayName,
    role: applied.member.role,
    at: Date.now(),
    actor: actorFor(request, ctx.webServer.port),
    expectedRevision: originalExpectedRevision,
    appliedRevision: applied.state.revision,
  }
  try {
    await options.appendAudit(event)
  } catch {
    sendJson(response, 500, { error: 'live-teams mutation failed' })
    return
  }
  await appendSessionTitleAudit(options, parsed.sessionId, applied.sessionTitle, actorFor(request, ctx.webServer.port))
  const snapshot = projectLiveTeamsSnapshot(applied.state, options)
  const member = snapshot.members.find((entry) => entry.memberId === applied.member.memberId)
  if (member === undefined) {
    sendJson(response, 500, { error: 'live-teams mutation failed' })
    return
  }
  sendJson(response, 200, {
    teamId: options.teamId,
    memberId: applied.member.memberId,
    revision: applied.state.revision,
    applied: true,
    retried,
    member,
  })
}

async function handleCreateSessionMember(
  request: LiveTeamsRequest,
  response: LiveTeamsResponse,
  ctx: LiveTeamsRouteContext,
  options: LiveTeamsRouteOptions,
): Promise<void> {
  if (!authorityAllowed(request, ctx.webServer.port)) { sendJson(response, 403, { error: 'live-teams request authority rejected' }); return }
  if (request.method !== 'POST') { sendJson(response, 405, { error: 'live-teams method not allowed' }); return }
  if (bodyContentType(request) !== 'application/json') { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
  const declaredLength = headerValue(request.headers['content-length'])
  if (declaredLength !== undefined && /^\d+$/u.test(declaredLength) && Number(declaredLength) > MAX_MUTATION_BODY_BYTES) { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
  let parsed: LiveTeamsCreateSessionMemberRequest
  try { parsed = parseCreateSessionMember(await requestBody(request)) } catch { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
  if (options.createSessionMember === undefined || options.appendAudit === undefined) { sendJson(response, 500, { error: 'live-teams mutation failed' }); return }
  if (options.workspaceRegistered !== undefined) {
    try {
      if (!await options.workspaceRegistered()) { sendJson(response, 400, { error: 'live-teams workspace not registered' }); return }
    } catch { sendJson(response, 400, { error: 'live-teams workspace not registered' }); return }
  }
  if (options.roles !== undefined || options.readRoles !== undefined || options.roleRegistry !== undefined) {
    let registry: RoleRegistry | undefined
    try { registry = await currentRoles(options) } catch { sendJson(response, 503, { error: 'live-teams state unavailable' }); return }
    const resolvedRole = registry?.resolve(parsed.role)
    if (resolvedRole === undefined) { sendJson(response, 400, { error: 'live-teams unknown role' }); return }
    parsed = { ...parsed, role: resolvedRole.id }
  }
  let state: TeamState
  try { state = await readTeamState(options) } catch { sendJson(response, 503, { error: 'live-teams state unavailable' }); return }
  let retried = false
  let applied: LiveTeamsCreateSessionMemberResult | undefined
  const originalExpectedRevision = parsed.expectedRevision
  let expectedRevision = parsed.expectedRevision
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) retried = true
    try {
      applied = await options.createSessionMember({ ...parsed, expectedRevision })
      break
    } catch (error) {
      if (!mutationConflict(error)) {
        const status = error instanceof LiveTeamsError && error.auditDetail === 'workspace not registered' ? 400 : (createErrorStatus(error))
        logMutationFailure(options, 'creating a member Session', error)
        sendJson(response, status, status === 400 ? createErrorBody(error) : { error: 'live-teams mutation failed' }); return
      }
      if (attempt === 1) break
      try { state = await readTeamState(options) } catch { sendJson(response, 503, { error: 'live-teams state unavailable' }); return }
      expectedRevision = state.revision
    }
  }
  if (applied === undefined) {
    try { state = await readTeamState(options) } catch { sendJson(response, 503, { error: 'live-teams state unavailable' }); return }
    sendJson(response, 409, { error: 'live-teams revision conflict', revision: state.revision, members: projectLiveTeamsSnapshot(state, options).members }); return
  }
  const sessionId = applied.member.sessionId
  if (typeof sessionId !== 'string' || sessionId.length === 0) { sendJson(response, 500, { error: 'live-teams mutation failed' }); return }
  const event: LiveTeamsAuditRecord = {
    kind: 'member/added', memberId: applied.member.memberId, sessionId, displayName: applied.member.displayName, role: applied.member.role,
    at: Date.now(), actor: actorFor(request, ctx.webServer.port), expectedRevision: originalExpectedRevision, appliedRevision: applied.state.revision,
  }
  try { await options.appendAudit(event) } catch { sendJson(response, 500, { error: 'live-teams mutation failed' }); return }
  await appendSessionTitleAudit(options, sessionId, applied.sessionTitle, actorFor(request, ctx.webServer.port))
  const snapshot = projectLiveTeamsSnapshot(applied.state, options)
  const member = snapshot.members.find((entry) => entry.memberId === applied.member.memberId)
  if (member === undefined || member.sessionId === null) { sendJson(response, 500, { error: 'live-teams mutation failed' }); return }
  sendJson(response, 200, { teamId: options.teamId, memberId: member.memberId, sessionId: member.sessionId, revision: applied.state.revision, applied: true, retried, member })
}

async function handleRemoveMember(
  request: LiveTeamsRequest,
  response: LiveTeamsResponse,
  ctx: LiveTeamsRouteContext,
  options: LiveTeamsRouteOptions,
): Promise<void> {
  if (!authorityAllowed(request, ctx.webServer.port)) {
    sendJson(response, 403, { error: 'live-teams request authority rejected' })
    return
  }
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'live-teams method not allowed' })
    return
  }
  if (bodyContentType(request) !== 'application/json') {
    sendJson(response, 400, { error: 'live-teams invalid request' })
    return
  }
  const declaredLength = headerValue(request.headers['content-length'])
  if (declaredLength !== undefined && /^\d+$/u.test(declaredLength) && Number(declaredLength) > MAX_MUTATION_BODY_BYTES) {
    sendJson(response, 400, { error: 'live-teams invalid request' })
    return
  }
  let parsed: LiveTeamsRemoveMemberRequest
  try {
    parsed = parseRemoveMember(await requestBody(request))
  } catch {
    sendJson(response, 400, { error: 'live-teams invalid request' })
    return
  }
  if (options.removeMember === undefined || options.appendAudit === undefined) {
    sendJson(response, 500, { error: 'live-teams mutation failed' })
    return
  }
  let state: TeamState
  try {
    state = await readTeamState(options)
  } catch {
    sendJson(response, 503, { error: 'live-teams state unavailable' })
    return
  }
  const member = mutationMember(state, parsed.memberId)
  if (member === undefined || state.archivedMemberIds.includes(parsed.memberId)) {
    sendJson(response, 400, { error: 'live-teams invalid request' })
    return
  }

  let retried = false
  let applied: LiveTeamsRemoveMemberResult | undefined
  const originalExpectedRevision = parsed.expectedRevision
  let expectedRevision = parsed.expectedRevision
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) retried = true
    try {
      applied = await options.removeMember({ memberId: parsed.memberId, expectedRevision })
      break
    } catch (error) {
      if (!mutationConflict(error)) {
        if (invalidMutation(error)) sendJson(response, 400, { error: 'live-teams invalid request' })
        else sendJson(response, 500, { error: 'live-teams mutation failed' })
        return
      }
      if (attempt === 1) break
      try {
        state = await readTeamState(options)
      } catch {
        sendJson(response, 503, { error: 'live-teams state unavailable' })
        return
      }
      if (mutationMember(state, parsed.memberId) === undefined || state.archivedMemberIds.includes(parsed.memberId)) {
        sendJson(response, 400, { error: 'live-teams invalid request' })
        return
      }
      expectedRevision = state.revision
    }
  }

  if (applied === undefined) {
    try {
      state = await readTeamState(options)
    } catch {
      sendJson(response, 503, { error: 'live-teams state unavailable' })
      return
    }
    sendJson(response, 409, {
      error: 'live-teams revision conflict',
      revision: state.revision,
      members: projectLiveTeamsSnapshot(state, options).members,
    })
    return
  }

  const removedSessionId = typeof applied.removed.sessionId === 'string' ? applied.removed.sessionId : null
  const event: LiveTeamsAuditRecord = {
    kind: 'member/removed',
    memberId: applied.removed.memberId,
    displayName: applied.removed.displayName,
    role: applied.removed.role,
    sessionId: removedSessionId,
    at: Date.now(),
    actor: actorFor(request, ctx.webServer.port),
    expectedRevision: originalExpectedRevision,
    appliedRevision: applied.state.revision,
  }
  try {
    await options.appendAudit(event)
  } catch {
    sendJson(response, 500, { error: 'live-teams mutation failed' })
    return
  }
  sendJson(response, 200, {
    teamId: options.teamId,
    memberId: applied.removed.memberId,
    revision: applied.state.revision,
    applied: true,
    retried,
    removed: {
      memberId: applied.removed.memberId,
      displayName: applied.removed.displayName,
      role: applied.removed.role,
      sessionId: removedSessionId,
    },
  })
}

async function handleInterrupt(
  request: LiveTeamsRequest,
  response: LiveTeamsResponse,
  ctx: LiveTeamsRouteContext,
  options: LiveTeamsRouteOptions,
): Promise<void> {
  if (!authorityAllowed(request, ctx.webServer.port)) {
    sendJson(response, 403, { error: 'live-teams request authority rejected' })
    return
  }
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'live-teams method not allowed' })
    return
  }
  if (bodyContentType(request) !== 'application/json') {
    sendJson(response, 400, { error: 'live-teams invalid request' })
    return
  }
  const declaredLength = headerValue(request.headers['content-length'])
  if (declaredLength !== undefined && /^\d+$/u.test(declaredLength) && Number(declaredLength) > MAX_MUTATION_BODY_BYTES) {
    sendJson(response, 400, { error: 'live-teams invalid request' })
    return
  }
  let memberId: string | undefined
  try {
    const body = record(JSON.parse(await requestBody(request)) as unknown)
    memberId = requiredText(body.memberId)
    if (requiredText(body.sessionId) === undefined || memberId === undefined) throw new Error('invalid interrupt')
  } catch {
    sendJson(response, 400, { error: 'live-teams invalid request' })
    return
  }
  if (options.interrupt === undefined || options.appendAudit === undefined) {
    sendJson(response, 500, { error: 'live-teams mutation failed' })
    return
  }
  let state: TeamState
  try {
    state = await readTeamState(options)
  } catch {
    sendJson(response, 503, { error: 'live-teams state unavailable' })
    return
  }
  const member = mutationMember(state, memberId)
  if (member === undefined) {
    sendJson(response, 400, { error: 'live-teams invalid request' })
    return
  }
  // A refused operator action is still an operator action: it is audited, so a human who
  // pressed something can see what the host decided (F18 of the third live run — the
  // refusal used to return before the audit and left no trace anywhere).
  if (typeof member.sessionId !== 'string' || member.sessionId.length === 0) {
    await options.appendAudit?.({ kind: 'member/interrupt-refused', memberId, reason: 'no-session', actor: actorFor(request, ctx.webServer.port), at: Date.now() })
    sendJson(response, 409, { error: 'live-teams member has no running turn' })
    return
  }
  const sessionId = member.sessionId
  const before = statusOf(liveAgentOf(options.agents, sessionId))
  if (before !== 'running') {
    await options.appendAudit?.({ kind: 'member/interrupt-refused', memberId, sessionId, reason: `idle (${before})`, actor: actorFor(request, ctx.webServer.port), at: Date.now() })
    sendJson(response, 409, { error: 'live-teams member has no running turn' })
    return
  }
  try {
    await options.interrupt(sessionId, 'human:desktop interrupt turn')
  } catch {
    await options.appendAudit?.({ kind: 'member/interrupt-refused', memberId, sessionId, reason: 'interrupt failed', actor: actorFor(request, ctx.webServer.port), at: Date.now() })
    sendJson(response, 500, { error: 'live-teams mutation failed' })
    return
  }
  const after = statusOf(liveAgentOf(options.agents, sessionId))
  try {
    await options.appendAudit?.({ kind: 'member/interrupted', memberId, sessionId, actor: actorFor(request, ctx.webServer.port), at: Date.now() })
  } catch {
    sendJson(response, 500, { error: 'live-teams mutation failed' })
    return
  }
  sendJson(response, 200, { memberId, interrupted: true, status: after })
}

async function handleMutation(
  request: LiveTeamsRequest,
  response: LiveTeamsResponse,
  ctx: LiveTeamsRouteContext,
  options: LiveTeamsRouteOptions,
  kind: LiveTeamsMutation['kind'],
): Promise<void> {
  if (!authorityAllowed(request, ctx.webServer.port)) {
    sendJson(response, 403, { error: 'live-teams request authority rejected' })
    return
  }
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'live-teams method not allowed' })
    return
  }
  if (bodyContentType(request) !== 'application/json') {
    sendJson(response, 400, { error: 'live-teams invalid request' })
    return
  }
  const declaredLength = headerValue(request.headers['content-length'])
  if (declaredLength !== undefined && /^\d+$/u.test(declaredLength) && Number(declaredLength) > MAX_MUTATION_BODY_BYTES) {
    sendJson(response, 400, { error: 'live-teams invalid request' })
    return
  }
  let parsed: Omit<LiveTeamsMutation, 'kind'>
  try {
    parsed = parseMutation(await requestBody(request), kind)
  } catch {
    sendJson(response, 400, { error: 'live-teams invalid request' })
    return
  }
  if (options.applyMutation === undefined || options.appendAudit === undefined) {
    sendJson(response, 500, { error: 'live-teams mutation failed' })
    return
  }
  if (kind === 'role' && (options.roles !== undefined || options.readRoles !== undefined || options.roleRegistry !== undefined)) {
    let registry: RoleRegistry | undefined
    try { registry = await currentRoles(options) } catch { sendJson(response, 503, { error: 'live-teams state unavailable' }); return }
    const resolvedRole = registry?.resolve(parsed.value)
    if (resolvedRole === undefined) { sendJson(response, 400, { error: 'live-teams unknown role' }); return }
    parsed = { ...parsed, value: resolvedRole.id }
  }
  let state: TeamState
  try {
    state = await readTeamState(options)
  } catch {
    sendJson(response, 503, { error: 'live-teams state unavailable' })
    return
  }
  if (mutationMember(state, parsed.memberId) === undefined) {
    sendJson(response, 400, { error: 'live-teams invalid request' })
    return
  }

  let retried = false
  let applied: LiveTeamsMutationResult | undefined
  const originalExpectedRevision = parsed.expectedRevision
  let expectedRevision = parsed.expectedRevision
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) retried = true
    try {
      applied = await options.applyMutation({ kind, memberId: parsed.memberId, value: parsed.value, expectedRevision })
      break
    } catch (error) {
      if (!mutationConflict(error)) {
        if (invalidMutation(error)) sendJson(response, 400, { error: 'live-teams invalid request' })
        else sendJson(response, 500, { error: 'live-teams mutation failed' })
        return
      }
      if (attempt === 1) break
      try {
        state = await readTeamState(options)
      } catch {
        sendJson(response, 503, { error: 'live-teams state unavailable' })
        return
      }
      if (mutationMember(state, parsed.memberId) === undefined) {
        sendJson(response, 400, { error: 'live-teams invalid request' })
        return
      }
      expectedRevision = state.revision
    }
  }

  if (applied === undefined) {
    try {
      state = await readTeamState(options)
    } catch {
      sendJson(response, 503, { error: 'live-teams state unavailable' })
      return
    }
    sendJson(response, 409, {
      error: 'live-teams revision conflict',
      revision: state.revision,
      members: projectLiveTeamsSnapshot(state, options).members,
    })
    return
  }

  const event: LiveTeamsAuditRecord = {
    kind: kind === 'role' ? 'member/role-changed' : kind === 'availability' ? 'member/availability-changed' : 'member/name-changed',
    memberId: parsed.memberId,
    from: applied.from,
    to: applied.to,
    at: Date.now(),
    actor: actorFor(request, ctx.webServer.port),
    expectedRevision: originalExpectedRevision,
    appliedRevision: applied.state.revision,
  }
  try {
    await options.appendAudit(event)
  } catch {
    sendJson(response, 500, { error: 'live-teams mutation failed' })
    return
  }
  if (kind === 'name') await appendSessionTitleAudit(options, applied.member.sessionId ?? '', applied.sessionTitle, actorFor(request, ctx.webServer.port))
  const snapshot = projectLiveTeamsSnapshot(applied.state, options)
  const member = snapshot.members.find((entry) => entry.memberId === parsed.memberId)
  if (member === undefined) {
    sendJson(response, 500, { error: 'live-teams mutation failed' })
    return
  }
  sendJson(response, 200, {
    teamId: options.teamId,
    memberId: parsed.memberId,
    revision: applied.state.revision,
    applied: true,
    retried,
    member,
  })
}

const requestBodies = new WeakMap<object, Promise<string>>()

async function requestBody(request: LiveTeamsRequest): Promise<string> {
  const key = request as object
  const existing = requestBodies.get(key)
  if (existing !== undefined) return existing
  const pending = readRequestBody(request)
  requestBodies.set(key, pending)
  return pending
}

/**
 * Which Session scopes this request — not which Session the request is about.
 *
 * Those are two different subjects, and one field cannot carry both: a body
 * `sessionId` on `POST /api/live-teams/members` names the Session that JOINS the
 * team, while the scope names the Session whose tab is asking. Reading the query
 * first keeps them apart; the body form stays supported for the routes whose
 * payload has no Session of its own.
 */
async function requestSessionId(request: LiveTeamsRequest): Promise<string | undefined> {
  try {
    const raw = request.url === undefined ? undefined : new URL(request.url, 'http://127.0.0.1').searchParams.get('session')
    const scoped = raw === null ? undefined : requiredText(raw)
    if (scoped !== undefined) return scoped
  } catch { /* an unparseable url falls back to the body form below */ }
  if (request.method === 'GET') return undefined
  try { return requiredText(record(JSON.parse(await requestBody(request)) as unknown).sessionId) } catch { return undefined }
}

async function resolveOptions(request: LiveTeamsRequest, options: LiveTeamsRouteOptions, sessionId?: string): Promise<LiveTeamsRouteOptions | undefined> {
  if (options.resolveRequest === undefined) return options
  return options.resolveRequest(request, sessionId)
}

async function withResolvedOptions(
  request: LiveTeamsRequest,
  response: LiveTeamsResponse,
  options: LiveTeamsRouteOptions,
  handler: (resolved: LiveTeamsRouteOptions) => Promise<void>,
  requireEnabled = false,
): Promise<void> {
  let resolved: LiveTeamsRouteOptions | undefined
  const sessionId = await requestSessionId(request)
  try { resolved = await resolveOptions(request, options, sessionId) } catch { resolved = undefined }
  if (resolved === undefined || (options.resolveRequest !== undefined && sessionId === undefined && request.method === 'GET')) {
    sendJson(response, 400, { error: 'live-teams invalid request' })
    return
  }
  if (requireEnabled && resolved.teamEnabled !== undefined) {
    try {
      if (!await resolved.teamEnabled()) { sendJson(response, 503, { error: 'live-teams team disabled' }); return }
    } catch { sendJson(response, 503, { error: 'live-teams state unavailable' }); return }
  }
  await handler(resolved)
}

function taskRouteSummary(route: TaskRoute | undefined, state: TeamState): LiveTeamsTaskRouteSummary | undefined {
  if (route === undefined) return undefined
  if (route.type === 'report') {
    if (route.to === 'human') return { type: 'report', to: 'human' }
    const recipient = state.members.find((member) => member.memberId === route.to)
    return recipient === undefined ? { type: 'report', to: route.to } : { type: 'report', to: route.to, toName: recipient.displayName }
  }
  if (route.type === 'review') {
    const reviewer = state.members.find((member) => member.memberId === route.reviewer)
    return reviewer === undefined ? { type: 'review', reviewer: route.reviewer } : { type: 'review', reviewer: route.reviewer, reviewerName: reviewer.displayName }
  }
  if (route.type === 'interactive') {
    const nested = taskRouteSummary(route.then, state)
    return nested === undefined ? undefined : { type: 'interactive', then: nested }
  }
  return { type: 'custom', description: route.description }
}

function taskSummary(task: TeamTask, state: TeamState, tasks: readonly TeamTask[] = []): LiveTeamsTaskSummary {
  const assignee = task.assignee === undefined ? undefined : state.members.find((member) => member.memberId === task.assignee)
  const route = taskRouteSummary(task.route, state)
  const blockers = blockedBy(task, tasks)
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    ...(task.awaitsDecision === true ? { awaitsDecision: true } : {}),
    ...(task.reviewReturn === undefined ? {} : { reviewReturn: parseReviewReturn(task.reviewReturn) }),
    ...(task.assignee === undefined ? {} : { assignee: task.assignee }),
    ...(assignee === undefined ? {} : { assigneeName: assignee.displayName }),
    ...(route === undefined ? {} : { route }),
    ...(task.round === undefined ? {} : { round: task.round }),
    roundLimit: task.roundLimit,
    updatedAt: task.updatedAt,
    ...(task.archivedPath === undefined ? {} : { archivedPath: task.archivedPath }),
    ...(task.documentMissing === true ? { documentMissing: true as const } : {}),
    ...(task.dependsOn === undefined ? {} : { dependsOn: task.dependsOn }),
    ...(blockers.length === 0 ? {} : { blockedBy: blockers }),
  }
}

function taskErrorStatus(error: unknown): 400 | 503 | 500 {
  if (error instanceof LiveTeamsError && error.code === ERROR_CODES.STATE_CORRUPT) return 503
  if (error instanceof LiveTeamsError && error.code === ERROR_CODES.CAPABILITY_UNAVAILABLE) return 400
  return 500
}

function taskErrorBody(error: unknown): { error: string } {
  const status = taskErrorStatus(error)
  if (status === 503) return { error: 'live-teams state unavailable' }
  if (error instanceof LiveTeamsError) return { error: error.message }
  return { error: 'live-teams mutation failed' }
}

function journalCategory(kind: string): LiveTeamsJournalCategory {
  const family = kind.split('/', 1)[0] ?? ''
  if (family === 'message') return 'message'
  if (family === 'delivery') return 'delivery'
  if (family === 'task' || family === 'attempt' || family === 'submission') return 'task'
  if (family === 'review') return 'review'
  if (family === 'contact') return 'contact'
  if (family === 'team' || kind === 'briefing/updated') return 'team'
  if (family === 'member' || kind === 'session/titled') return 'member'
  return 'other'
}

function journalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function journalActor(recordValue: Record<string, unknown>, members: ReadonlyMap<string, string>): { actor?: string; actorName?: string } {
  const actor = journalText(recordValue.actor)
  if (actor === undefined) return {}
  if (actor === 'scheduler') return { actor, actorName: 'scheduler' }
  if (actor === 'human' || actor === 'human:desktop') return { actor, actorName: 'human' }
  const name = members.get(actor)
  return name === undefined ? { actor } : { actor, actorName: name }
}

function journalVerb(kind: string): string {
  const action = kind.split('/')[1] ?? kind
  return action.replaceAll('-', ' ')
}

function journalSummary(recordValue: Record<string, unknown>, kind: string, actorName: string | undefined, refs: LiveTeamsJournalEntry['refs'], nameOf: (id: string) => string, info?: MessageInfo): string {
  const actor = actorName === undefined ? '' : `${actorName} `
  const task = refs.taskTitle ?? refs.taskId
  const action = journalVerb(kind)
  // Ids are for machines. A person reading "sent message to m-17c86302-…" cannot tell whether that
  // is the builder or the reviewer, which is the whole point of the journal.
  const who = (value: unknown): string | undefined => {
    const id = journalText(value)
    return id === undefined ? undefined : nameOf(id)
  }
  if (kind === 'review/returned') {
    const labels: Record<string, string> = { pending: 'review return queued', sending: 'review notification delivery pending', delivered: 'review notification delivered; launch unconfirmed', started: 'Session launch confirmed', completed: 'Session processed review request (not acceptance)', blocked: 'automatic review return blocked', failed: 'review return or launch failed', unconfirmed: 'Session launch unconfirmed', superseded: 'review return no longer current' }
    return `${actor}${labels[String(recordValue.state)] ?? 'review return state unknown'}${task === undefined ? '' : ` · ${task}`}`
  }
  if (kind === 'review/lead-notified') return `${actor}lead notified of review return${task === undefined ? '' : ` · ${task}`}`
  if (kind === 'message/sent') return `${actor}sent ${journalText(recordValue.messageKind) ?? 'message'} to ${who(recordValue.to) ?? 'the team'}`
  if (kind.startsWith('delivery/')) {
    // "delivered message 1dae64e3-…" tells a person nothing. The recipient is in the event and the
    // sender is on the message, so the line can read like a sentence.
    const recipient = who(recordValue.recipient) ?? 'someone'
    const sender = info?.from === undefined ? undefined : nameOf(info.from)
    const whose = sender === undefined ? 'a message' : `a message from ${sender}`
    const failure = journalText(recordValue.reason) ?? journalText(recordValue.failure)
    if (kind === 'delivery/failed') return `${whose} to ${recipient} failed${failure === undefined ? '' : `: ${failure}`}`
    if (kind === 'delivery/acknowledged') return `${recipient} acknowledged ${whose}`
    if (kind === 'delivery/leased') return `${recipient} picked up ${whose}`
    if (kind === 'delivery/delivered') return `${whose} reached ${recipient}`
    return `${whose} queued for ${recipient}`
  }
  if (journalCategory(kind) === 'task') return `${actor}${action}${task === undefined ? '' : ` · ${task}`}`
  if (journalCategory(kind) === 'review') return `${actor}review ${refs.round === undefined ? '' : `round ${refs.round} `}${journalText(recordValue.verdict) ?? action}${task === undefined ? '' : ` · ${task}`}`
  if (journalCategory(kind) === 'contact') return `${actor}${action}${journalText(recordValue.from) === undefined ? '' : ` · ${who(recordValue.from) ?? 'someone'} → ${who(recordValue.to) ?? 'target'}`}`
  if (journalCategory(kind) === 'member') return `${actor}${action}${journalText(recordValue.displayName) === undefined && journalText(recordValue.memberId) === undefined ? '' : ` · ${journalText(recordValue.displayName) ?? journalText(recordValue.memberId)}`}`
  if (journalCategory(kind) === 'team') {
    const from = journalText(recordValue.from)
    const to = journalText(recordValue.to)
    const transition = from === undefined || to === undefined ? journalText(recordValue.name) : `${from} → ${to}`
    return `${actor}${action}${transition === undefined ? '' : ` · ${transition}`}`
  }
  const detail = journalText(recordValue.detail) ?? journalText(recordValue.note) ?? journalText(recordValue.content)
  return `${actor}${kind || 'audit event'}${detail === undefined ? '' : ` · ${detail}`}`
}

type MessageInfo = { content: string; from: string; to: string; kind: string }

function projectJournal(events: readonly unknown[], state: TeamState, limit: number, messages: ReadonlyMap<string, MessageInfo> = new Map()): LiveTeamsJournalEntry[] {
  const memberNames = new Map(state.members.map((member) => [member.memberId, member.displayName]))
  // One place that turns an id into something a person recognises; every summary uses it.
  const nameOf = (id: string): string => memberNames.get(id) ?? (id === 'human' ? 'the human' : id === 'scheduler' ? 'the scheduler' : id)
  const taskTitles = new Map<string, string>()
  for (const raw of events) {
    const value = record(raw)
    const createdTaskId = journalText(value.taskId) ?? (journalText(value.kind) === 'task/created' ? journalText(value.id) : undefined)
    const title = journalText(value.taskTitle) ?? (journalText(value.kind) === 'task/created' ? journalText(value.title) : undefined)
    if (createdTaskId !== undefined && title !== undefined) taskTitles.set(createdTaskId, title)
  }
  const start = Math.max(0, events.length - limit)
  return events.slice(start).reverse().map((raw, offset) => {
    const value = record(raw)
    const kind = journalText(value.kind) ?? 'unknown'
    const category = journalCategory(kind)
    const actor = journalActor(value, memberNames)
    const taskId = journalText(value.taskId) ?? (category === 'task' ? journalText(value.id) : undefined)
    const taskTitle = journalText(value.taskTitle) ?? journalText(value.title) ?? (taskId === undefined ? undefined : taskTitles.get(taskId))
    const messageId = journalText(value.messageId)
    const round = typeof value.round === 'number' && Number.isInteger(value.round) && value.round > 0 ? value.round : undefined
    const refs: LiveTeamsJournalEntry['refs'] = {
      ...(taskId === undefined ? {} : { taskId }),
      ...(taskTitle === undefined ? {} : { taskTitle }),
      ...(messageId === undefined ? {} : { messageId }),
      ...(round === undefined ? {} : { round }),
    }
    const at = typeof value.at === 'number' && Number.isFinite(value.at) && value.at >= 0 ? value.at : 0
    // The audit stores the message id, not its body: the text comes from the mailbox, so a person can
    // read what was actually said without leaving the journal.
    const info = messageId === undefined ? undefined : messages.get(messageId)
    const detail = kind === 'message/sent'
      ? journalText(value.content) ?? journalText(value.body) ?? info?.content
      : undefined
    const fields: { label: string; value: string }[] = []
    if (actor.actorName !== undefined || journalText(value.actor) !== undefined) fields.push({ label: 'Actor', value: `${actor.actorName ?? journalText(value.actor) ?? '—'}${journalText(value.actor) === undefined ? '' : ` (${journalText(value.actor)})`}` })
    for (const [label, raw] of [['To', value.to], ['From', value.from], ['Member', value.memberId], ['Recipient', value.recipient]] as const) {
      const id = journalText(raw)
      if (id !== undefined) fields.push({ label, value: `${nameOf(id)}${nameOf(id) === id ? '' : ` (${id})`}` })
    }
    if (info !== undefined) fields.push({ label: 'Message from', value: `${nameOf(info.from)} (${info.from})` }, { label: 'Message kind', value: info.kind })
    if (taskId !== undefined) fields.push({ label: 'Task', value: `${taskTitle ?? '—'} (${taskId})` })
    for (const [label, raw] of [['Attempt', value.attemptId], ['Submission', value.submissionId], ['Message', value.messageId], ['Delivery', value.deliveryId]] as const) {
      const id = journalText(raw)
      if (id !== undefined) fields.push({ label, value: id })
    }
    if (round !== undefined) fields.push({ label: 'Round', value: String(round) })
    if (kind === 'review/returned' || kind === 'review/lead-notified') {
      if (journalText(value.state) !== undefined) fields.push({ label: 'Return state', value: String(value.state) })
      for (const [label, field] of [['Review', 'roundId'], ['Request', 'requestId'], ['Turn', 'turn'], ['Input seq', 'inputSeq']] as const) if (typeof value[field] === 'string' || typeof value[field] === 'number') fields.push({ label, value: String(value[field]) })
    }
    const verdict = journalText(value.verdict)
    if (verdict !== undefined) fields.push({ label: 'Verdict', value: verdict })
    const reason = journalText(value.reason) ?? journalText(value.detail) ?? journalText(value.note)
    if (reason !== undefined) fields.push({ label: 'Why', value: reason })
    fields.push({ label: 'At', value: new Date(at).toISOString() })
    const summary = journalSummary(value, kind, actor.actorName, refs, nameOf, info).replaceAll(/\s+/gu, ' ').trim() || 'Team audit event'
    // The people this row is about: the actor, and whoever the event names as a counterpart.
    const namedIds = [value.to, value.from, value.recipient, value.memberId].map((raw) => journalText(raw)).filter((id): id is string => id !== undefined)
    const summaryParts = splitByNames(summary, [actor.actorName ?? '', ...(info === undefined ? [] : [nameOf(info.from), nameOf(info.to)]), ...namedIds.map(nameOf)])
    const sourcePosition = start + (events.slice(start).length - 1 - offset)
    const digest = createHash('sha1').update(`${sourcePosition}:${JSON.stringify(raw)}`).digest('hex').slice(0, 16)
    return { id: `journal-${sourcePosition}-${digest}`, kind, category, at, ...actor, summary, summaryParts, refs, fields, ...(detail === undefined ? {} : { detail }) }
  })
}

/** Split a summary so the names in it can be shown as names. Word boundaries keep a short name from
 * matching inside a longer word. */
function splitByNames(text: string, names: readonly string[]): { text: string; strong?: boolean }[] {
  const unique = [...new Set(names.filter((name) => name.length > 0))].sort((left, right) => right.length - left.length)
  if (unique.length === 0) return [{ text }]
  const pattern = new RegExp(`\\b(${unique.map((name) => name.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&')).join('|')})\\b`, 'gu')
  const parts: { text: string; strong?: boolean }[] = []
  let cursor = 0
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0
    if (start > cursor) parts.push({ text: text.slice(cursor, start) })
    parts.push({ text: match[0], strong: true })
    cursor = start + match[0].length
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) })
  return parts.length === 0 ? [{ text }] : parts
}

function journalQuery(request: LiveTeamsRequest): number | undefined {
  try {
    const raw = request.url === undefined ? undefined : new URL(request.url, 'http://127.0.0.1').searchParams.get('limit')
    if (raw === null || raw === undefined) return 100
    if (!/^\d+$/u.test(raw)) return undefined
    const value = Number(raw)
    return Number.isSafeInteger(value) && value >= 1 ? Math.min(500, value) : undefined
  } catch { return undefined }
}

async function handleJournalList(request: LiveTeamsRequest, response: LiveTeamsResponse, ctx: LiveTeamsRouteContext, options: LiveTeamsRouteOptions): Promise<void> {
  if (!authorityAllowed(request, ctx.webServer.port)) { sendJson(response, 403, { error: 'live-teams request authority rejected' }); return }
  if (request.method !== 'GET') { sendJson(response, 405, { error: 'live-teams method not allowed' }); return }
  const limit = journalQuery(request)
  if (limit === undefined) { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
  await withResolvedOptions(request, response, options, async (resolved) => {
    if (resolved.readEvents === undefined) { sendJson(response, 503, { error: 'live-teams state unavailable' }); return }
    try {
      const state = await readTeamState(resolved)
      const after = journalOffset(request)
      if (after === null) { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
      const audit = await resolved.readEvents(after)
      // The bodies of the messages in this window, so a row can unfold into what was actually said.
      // One read, bounded by the window: the journal stores ids, the mailbox stores text.
      const messages = new Map<string, MessageInfo>()
      const kinds = new Set(audit.events.map((event) => journalText(record(event)?.kind) ?? ''))
      if (resolved.mailbox !== undefined && (kinds.has('message/sent') || [...kinds].some((kind) => kind.startsWith('delivery/')))) {
        try {
          for (const message of await resolved.mailbox.listMessages()) messages.set(message.id, { content: message.content, from: message.from, to: message.to, kind: message.kind })
        } catch { /* a missing mailbox leaves the row without its body; the fields still explain it */ }
      }
      sendJson(response, 200, {
        teamId: resolved.teamId,
        entries: projectJournal(audit.events, state, limit, messages),
        ...(audit.nextOffset === undefined ? {} : { nextOffset: audit.nextOffset }),
        ...(audit.truncated === true ? { truncated: true } : {}),
      } satisfies LiveTeamsJournal)
    } catch (error) {
      sendJson(response, error instanceof LiveTeamsError && error.code === ERROR_CODES.STATE_CORRUPT ? 503 : 500, { error: 'live-teams state unavailable' })
    }
  }, true)
}

/**
 * The journal cursor: the byte offset the previous read left off at.
 * `undefined` means the caller has none; `null` means it sent a broken one (which is a 400, not a
 * silent full read).
 */
function journalOffset(request: LiveTeamsRequest): number | null | undefined {
  try {
    const raw = new URL(request.url ?? '', 'http://127.0.0.1').searchParams.get('after')
    if (raw === null || raw.length === 0) return undefined
    const value = Number(raw)
    return Number.isInteger(value) && value >= 0 ? value : null
  } catch { return null }
}

function taskQuery(request: LiveTeamsRequest, taskIdRequired: boolean): { includeArchived: boolean; taskId?: string } | undefined {
  try {
    const url = new URL(request.url ?? '', 'http://127.0.0.1')
    const includeArchivedValue = url.searchParams.get('includeArchived')
    if (includeArchivedValue !== null && includeArchivedValue !== 'true' && includeArchivedValue !== 'false') return undefined
    const taskId = url.searchParams.get('taskId')
    if (taskIdRequired && (taskId === null || requiredText(taskId) === undefined)) return undefined
    return { includeArchived: includeArchivedValue === 'true', ...(taskId === null ? {} : { taskId }) }
  } catch { return undefined }
}

async function handleDispatch(request: LiveTeamsRequest, response: LiveTeamsResponse, ctx: LiveTeamsRouteContext, options: LiveTeamsRouteOptions): Promise<void> {
  if (!authorityAllowed(request, ctx.webServer.port)) { sendJson(response, 403, { error: 'live-teams request authority rejected' }); return }
  if (request.method === 'GET') {
    await withResolvedOptions(request, response, options, async (resolved) => {
      if (resolved.readDispatch === undefined) { sendJson(response, 503, { error: 'live-teams dispatch unavailable' }); return }
      try {
        const projection = await resolved.readDispatch()
        if (projection === undefined) { sendJson(response, 503, { error: 'live-teams dispatch unavailable' }); return }
        sendJson(response, 200, projection)
      } catch (error) { sendJson(response, taskErrorStatus(error), taskErrorBody(error)) }
    }, true)
    return
  }
  if (request.method !== 'POST' || bodyContentType(request) !== 'application/json') { sendJson(response, request.method === 'POST' ? 400 : 405, { error: request.method === 'POST' ? 'live-teams invalid request' : 'live-teams method not allowed' }); return }
  let body: Record<string, unknown>
  try { body = record(JSON.parse(await requestBody(request)) as unknown) } catch { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
  const mode = body.mode
  const reason = body.reason
  if ((mode !== 'auto' && mode !== 'paused') || (reason !== undefined && typeof reason !== 'string')) { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
  await withResolvedOptions(request, response, options, async (resolved) => {
    if (resolved.setDispatch === undefined) { sendJson(response, 503, { error: 'live-teams dispatch unavailable' }); return }
    try {
      const result = await resolved.setDispatch({ mode, actor: actorFor(request, ctx.webServer.port), ...(reason === undefined ? {} : { reason: reason as string }) })
      sendJson(response, 200, result)
    } catch (error) { sendJson(response, taskErrorStatus(error), taskErrorBody(error)) }
  }, true)
}

/**
 * The panel's rotation control.
 *
 * Rotation replaces a member's Session, so this is the human's surface exactly like dispatch: the
 * route admits the caller, the store commits under an expected revision, and the journal records
 * what changed. It is a separate route from `/team` because it must stay readable on a team whose
 * profile row says nothing about rotation at all.
 */
async function handleTeamRotation(request: LiveTeamsRequest, response: LiveTeamsResponse, ctx: LiveTeamsRouteContext, options: LiveTeamsRouteOptions): Promise<void> {
  if (!authorityAllowed(request, ctx.webServer.port)) { sendJson(response, 403, { error: 'live-teams request authority rejected' }); return }
  if (request.method === 'GET') {
    await withResolvedOptions(request, response, options, async (resolved) => {
      if (resolved.readRotation === undefined) { sendJson(response, 503, { error: 'live-teams rotation unavailable' }); return }
      try {
        const rotation = await resolved.readRotation()
        if (rotation === undefined) { sendJson(response, 503, { error: 'live-teams rotation unavailable' }); return }
        sendJson(response, 200, rotation)
      } catch (error) { sendJson(response, taskErrorStatus(error), taskErrorBody(error)) }
    }, true)
    return
  }
  if (request.method !== 'POST' || bodyContentType(request) !== 'application/json') {
    sendJson(response, request.method === 'POST' ? 400 : 405, { error: request.method === 'POST' ? 'live-teams invalid request' : 'live-teams method not allowed' })
    return
  }
  let parsed: LiveTeamsRotationRequest | undefined
  try { parsed = rotationRequest(record(JSON.parse(await requestBody(request)) as unknown)) } catch { parsed = undefined }
  if (parsed === undefined) { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
  await withResolvedOptions(request, response, options, async (resolved) => {
    if (resolved.setRotation === undefined) { sendJson(response, 503, { error: 'live-teams rotation unavailable' }); return }
    try {
      sendJson(response, 200, await resolved.setRotation({ ...parsed as LiveTeamsRotationRequest, actor: actorFor(request, ctx.webServer.port) }))
    } catch (error) { sendJson(response, taskErrorStatus(error), taskErrorBody(error)) }
  }, true)
}

/** A limit is a token or task count: a non-negative integer, and bounded so a typo is refused. */
const ROTATION_LIMIT_CEILING = 100_000_000
function rotationRequest(body: Record<string, unknown>): LiveTeamsRotationRequest | undefined {
  const enabled = body.enabled
  if (enabled !== undefined && typeof enabled !== 'boolean') return undefined
  const limit = (value: unknown): number | undefined | null => {
    if (value === undefined) return undefined
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > ROTATION_LIMIT_CEILING) return null
    return value
  }
  const maxContextTokens = limit(body.maxContextTokens)
  const maxCompletedTasks = limit(body.maxCompletedTasks)
  if (maxContextTokens === null || maxCompletedTasks === null) return undefined
  if (!Number.isInteger(body.expectedRevision)) return undefined
  // A request that changes nothing is refused rather than written: the panel would otherwise show a
  // save that committed a revision nobody asked for.
  if (enabled === undefined && maxContextTokens === undefined && maxCompletedTasks === undefined) return undefined
  return {
    ...(enabled === undefined ? {} : { enabled }),
    ...(maxContextTokens === undefined ? {} : { maxContextTokens }),
    ...(maxCompletedTasks === undefined ? {} : { maxCompletedTasks }),
    expectedRevision: Number(body.expectedRevision),
  }
}

async function handleTasksList(request: LiveTeamsRequest, response: LiveTeamsResponse, ctx: LiveTeamsRouteContext, options: LiveTeamsRouteOptions): Promise<void> {
  if (!authorityAllowed(request, ctx.webServer.port)) { sendJson(response, 403, { error: 'live-teams request authority rejected' }); return }
  if (request.method !== 'GET') { sendJson(response, 405, { error: 'live-teams method not allowed' }); return }
  const query = taskQuery(request, false)
  if (query === undefined) { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
  await withResolvedOptions(request, response, options, async (resolved) => {
    if (resolved.taskStore === undefined) { sendJson(response, 503, { error: 'live-teams state unavailable' }); return }
    let state: TeamState
    try { state = await readTeamState(resolved) } catch { sendJson(response, 503, { error: 'live-teams state unavailable' }); return }
    try {
      const listed = await resolved.taskStore.listTasks({ includeArchived: query.includeArchived })
      // Every summary is projected against the whole list, so `blockedBy` never
      // depends on which page of tasks a client happens to hold.
      sendJson(response, 200, { teamId: resolved.teamId, tasks: listed.map((task) => taskSummary(task, state, listed)) } satisfies LiveTeamsTasks)
    } catch (error) { sendJson(response, taskErrorStatus(error), taskErrorStatus(error) === 503 ? { error: 'live-teams state unavailable' } : { error: 'live-teams snapshot unavailable' }) }
  }, true)
}

async function handleTaskRead(request: LiveTeamsRequest, response: LiveTeamsResponse, ctx: LiveTeamsRouteContext, options: LiveTeamsRouteOptions): Promise<void> {
  if (!authorityAllowed(request, ctx.webServer.port)) { sendJson(response, 403, { error: 'live-teams request authority rejected' }); return }
  if (request.method !== 'GET') { sendJson(response, 405, { error: 'live-teams method not allowed' }); return }
  const query = taskQuery(request, true)
  if (query === undefined || query.taskId === undefined) { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
  const taskId = query.taskId
  await withResolvedOptions(request, response, options, async (resolved) => {
    if (resolved.taskStore === undefined) { sendJson(response, 503, { error: 'live-teams state unavailable' }); return }
    try { sendJson(response, 200, await resolved.taskStore.readTask(taskId)) }
    catch (error) { sendJson(response, taskErrorStatus(error), taskErrorBody(error)) }
  }, true)
}

/**
 * The human's task surface (review finding 4): create a task, change a draft or ready contract,
 * release an attempt. Until this existed the highest authority in the model had to write to the lead
 * and wait a model turn to get work started, and a wedged attempt had no direct control path at all.
 *
 * The operations are the same ones the lead's tools call — no second implementation, no second set of
 * rules. What differs is who is asking, and the audit says which of the two human actors it was.
 */
async function handleTaskControl(request: LiveTeamsRequest, response: LiveTeamsResponse, ctx: LiveTeamsRouteContext, options: LiveTeamsRouteOptions, operation: 'create' | 'update' | 'revoke'): Promise<void> {
  if (!authorityAllowed(request, ctx.webServer.port)) { sendJson(response, 403, { error: 'live-teams request authority rejected' }); return }
  if (request.method !== 'POST' || bodyContentType(request) !== 'application/json') { sendJson(response, request.method === 'POST' ? 400 : 405, { error: request.method === 'POST' ? 'live-teams invalid request' : 'live-teams method not allowed' }); return }
  let body: Record<string, unknown>
  try { body = record(JSON.parse(await requestBody(request)) as unknown) } catch { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
  const actor = actorFor(request, ctx.webServer.port)
  await withResolvedOptions(request, response, options, async (resolved) => {
    if (resolved.taskStore === undefined) { sendJson(response, 503, { error: 'live-teams state unavailable' }); return }
    try {
      if (operation === 'create') {
        const title = requiredText(body.title)
        const kind = requiredText(body.kind)
        const assignee = requiredText(body.assignee)
        const acceptance = stringList(body.acceptance)
        if (title === undefined || kind === undefined || assignee === undefined || acceptance === undefined || acceptance.length === 0) { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
        const why = requiredText(body.why)
        const taskBody = requiredText(body.body)
        const checks = stringList(body.checks)
        const paths = stringList(body.paths)
        const route = record(body.route)
        const result = await resolved.taskStore.createTask({
          title, kind: kind as TeamTask['kind'], assignee, acceptance, actor,
          ...(why === undefined ? {} : { why }),
          ...(taskBody === undefined ? {} : { body: taskBody }),
          ...(checks === undefined ? {} : { checks }),
          ...(paths === undefined ? {} : { paths }),
          ...(route === undefined ? {} : { route: route as unknown as NonNullable<CreateTaskRequest['route']> }),
          ...(typeof body.roundLimit === 'number' ? { roundLimit: body.roundLimit } : {}),
        })
        sendJson(response, 200, result)
        return
      }
      const taskId = requiredText(body.taskId)
      if (taskId === undefined) { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
      if (operation === 'update') {
        const result = await resolved.taskStore.updateTask({
          taskId, actor,
          ...(requiredText(body.title) === undefined ? {} : { title: requiredText(body.title) as string }),
          ...(requiredText(body.kind) === undefined ? {} : { kind: requiredText(body.kind) as TeamTask['kind'] }),
          ...(requiredText(body.assignee) === undefined ? {} : { assignee: requiredText(body.assignee) as string }),
          ...(stringList(body.acceptance) === undefined ? {} : { acceptance: stringList(body.acceptance) as string[] }),
          ...(stringList(body.checks) === undefined ? {} : { checks: stringList(body.checks) as string[] }),
          ...(stringList(body.paths) === undefined ? {} : { paths: stringList(body.paths) as string[] }),
          ...(requiredText(body.body) === undefined ? {} : { body: requiredText(body.body) as string }),
          ...(typeof body.expectedRevision === 'number' ? { expectedRevision: body.expectedRevision } : {}),
        })
        sendJson(response, 200, result)
        return
      }
      // Releasing an attempt is a decision, and the store requires the reason for it.
      const reason = requiredText(body.reason)
      if (reason === undefined) { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
      const result = await resolved.taskStore.revokeTask({ taskId, actor, reason })
      sendJson(response, 200, result)
    } catch (error) { sendJson(response, taskErrorStatus(error), taskErrorBody(error)) }
  }, true)
}

function stringList(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string') ? value as string[] : undefined
}

async function handleTaskMutation(request: LiveTeamsRequest, response: LiveTeamsResponse, ctx: LiveTeamsRouteContext, options: LiveTeamsRouteOptions, operation: 'accept' | 'revise' | 'cancel' | 'resume' | 'notify-submission' | 'notify-review'): Promise<void> {
  if (!authorityAllowed(request, ctx.webServer.port)) { sendJson(response, 403, { error: 'live-teams request authority rejected' }); return }
  if (request.method !== 'POST' || bodyContentType(request) !== 'application/json') { sendJson(response, request.method === 'POST' ? 400 : 405, { error: request.method === 'POST' ? 'live-teams invalid request' : 'live-teams method not allowed' }); return }
  let body: Record<string, unknown>
  try { body = record(JSON.parse(await requestBody(request)) as unknown) } catch { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
  const taskId = requiredText(body.taskId)
  const sessionId = requiredText(body.sessionId)
  const note = body.note
  const instructions = body.instructions
  const reason = body.reason
  const expectedRevision = body.expectedRevision
  if (expectedRevision !== undefined && (typeof expectedRevision !== 'number' || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0)) { sendJson(response, 400, { error: 'live-teams invalid revision' }); return }
  if (operation === 'cancel' && (typeof reason !== 'string' || reason.trim().length === 0)) { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
  if (operation === 'notify-submission' && requiredText(body.submissionId) === undefined) { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
  if (operation === 'notify-review' && requiredText(body.roundId) === undefined) { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
  if (taskId === undefined || sessionId === undefined || operation === 'revise' && (typeof instructions !== 'string' || instructions.trim().length === 0) || operation === 'accept' && note !== undefined && typeof note !== 'string') {
    sendJson(response, 400, { error: 'live-teams invalid request' }); return
  }
  await withResolvedOptions(request, response, options, async (resolved) => {
    if (resolved.taskStore === undefined) { sendJson(response, 503, { error: 'live-teams state unavailable' }); return }
    try {
      if (operation === 'notify-review') {
        const notifications = await resolved.taskStore.requestReviewNotification(taskId, requiredText(body.roundId)!, actorFor(request, ctx.webServer.port))
        sendJson(response, 200, { notifications })
      } else if (operation === 'notify-submission') {
        const notifications = await resolved.taskStore.requestSubmissionNotification(taskId, requiredText(body.submissionId)!, actorFor(request, ctx.webServer.port))
        sendJson(response, 200, { notifications })
      } else if (operation === 'cancel') {
        const result = await resolved.taskStore.cancelTask({ taskId, actor: actorFor(request, ctx.webServer.port), reason: (reason as string).trim(), ...(expectedRevision === undefined ? {} : { expectedRevision: expectedRevision as number }) })
        sendJson(response, 200, result)
      } else if (operation === 'resume') {
        sendJson(response, 200, await resolved.taskStore.resumeTask({ taskId, actor: actorFor(request, ctx.webServer.port), ...(expectedRevision === undefined ? {} : { expectedRevision: expectedRevision as number }) }))
      } else if (operation === 'accept') {
        const result = await resolved.taskStore.acceptTask({ taskId, actor: actorFor(request, ctx.webServer.port), ...(note === undefined ? {} : { note: note as string }) })
        sendJson(response, 200, result)
      } else {
        const result = await resolved.taskStore.reviseTask({ taskId, actor: actorFor(request, ctx.webServer.port), instructions: instructions as string })
        // TaskStore owns direction delivery for both lead tools and the panel. Sending
        // it again here would enqueue a second wake-up after the same durable revision.
        sendJson(response, 200, result)
      }
    } catch (error) { sendJson(response, taskErrorStatus(error), taskErrorBody(error)) }
  }, true)
}

function leadResolution(state: TeamState): { leadMemberId?: string; resolvedFrom: 'state' | 'role' | 'none' } {
  const resolved = resolveLeadMemberId(state)
  if (resolved === undefined) return { resolvedFrom: 'none' }
  return { leadMemberId: resolved, resolvedFrom: state.leadMemberId === resolved ? 'state' : 'role' }
}

async function handleTeamLead(request: LiveTeamsRequest, response: LiveTeamsResponse, ctx: LiveTeamsRouteContext, options: LiveTeamsRouteOptions): Promise<void> {
  if (!authorityAllowed(request, ctx.webServer.port)) { sendJson(response, 403, { error: 'live-teams request authority rejected' }); return }
  if (request.method === 'GET') {
    try { sendJson(response, 200, leadResolution(await readTeamState(options))) } catch { sendJson(response, 503, { error: 'live-teams state unavailable' }) }
    return
  }
  if (request.method !== 'POST' || bodyContentType(request) !== 'application/json') { sendJson(response, request.method === 'POST' ? 400 : 405, { error: request.method === 'POST' ? 'live-teams invalid request' : 'live-teams method not allowed' }); return }
  let memberId: string | undefined
  // An empty string is the panel's "Not set" and means clear; a missing field is a malformed request.
  try {
    const body = record(JSON.parse(await requestBody(request)) as unknown)
    if (body.sessionId === undefined) throw new Error('invalid lead')
    if (typeof body.memberId !== 'string') throw new Error('invalid lead')
    memberId = body.memberId.length === 0 ? undefined : requiredText(body.memberId)
  } catch { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
  try {
    const state = await readTeamState(options)
    if (memberId !== undefined && !state.members.some((member) => member.memberId === memberId)) { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
    if (options.setLead === undefined) { sendJson(response, 500, { error: 'live-teams mutation failed' }); return }
    const expectedRevision = state.revision
    const result = await options.setLead(memberId, expectedRevision)
    await options.appendAudit?.(memberId === undefined
      ? { kind: 'team/lead-cleared', actor: actorFor(request, ctx.webServer.port), at: Date.now() }
      : { kind: 'team/lead', memberId, actor: actorFor(request, ctx.webServer.port), at: Date.now() })
    sendJson(response, 200, { ...(result.leadMemberId === undefined ? {} : { leadMemberId: result.leadMemberId }) })
  } catch (error) { if (mutationConflict(error)) sendJson(response, 409, { error: 'live-teams revision conflict' }); else sendJson(response, 500, { error: 'live-teams mutation failed' }) }
}

async function handleBriefingOpen(request: LiveTeamsRequest, response: LiveTeamsResponse, ctx: LiveTeamsRouteContext, options: LiveTeamsRouteOptions): Promise<void> {
  if (!authorityAllowed(request, ctx.webServer.port)) { sendJson(response, 403, { error: 'live-teams request authority rejected' }); return }
  if (request.method !== 'POST' || bodyContentType(request) !== 'application/json') { sendJson(response, request.method === 'POST' ? 400 : 405, { error: request.method === 'POST' ? 'live-teams invalid request' : 'live-teams method not allowed' }); return }
  if (options.canOpenWorkspacePath === undefined || options.openWorkspacePath === undefined) { sendJson(response, 503, { error: 'live-teams open unavailable' }); return }
  let canOpen = false
  try { canOpen = await options.canOpenWorkspacePath() } catch { canOpen = false }
  if (!canOpen) { sendJson(response, 503, { error: 'live-teams open unavailable' }); return }
  try {
    const file = path.join(options.workspacePath, '.dsh-live-teams', 'BRIEF.md')
    await options.openWorkspacePath({ path: file, action: 'open' }, new AbortController().signal)
    sendJson(response, 200, { opened: file })
  } catch { sendJson(response, 503, { error: 'live-teams open unavailable' }) }
}

async function handleTeamStatus(request: LiveTeamsRequest, response: LiveTeamsResponse, ctx: LiveTeamsRouteContext, options: LiveTeamsRouteOptions): Promise<void> {
  if (!authorityAllowed(request, ctx.webServer.port)) { sendJson(response, 403, { error: 'live-teams request authority rejected' }); return }
  if (request.method !== 'GET') { sendJson(response, 405, { error: 'live-teams method not allowed' }); return }
  await withResolvedOptions(request, response, options, async (resolved) => {
    if (resolved.teamStatus === undefined) { sendJson(response, 503, { error: 'live-teams state unavailable' }); return }
    try {
      const status = await resolved.teamStatus()
      let briefing = ''
      try { briefing = (await readFile(path.join(resolved.workspacePath, '.dsh-live-teams', 'BRIEF.md'), 'utf8')).trim() } catch { /* missing/unreadable uses default in context */ }
      let openAvailable = false
      try { openAvailable = resolved.canOpenWorkspacePath === undefined ? false : await resolved.canOpenWorkspacePath() } catch { openAvailable = false }
      sendJson(response, 200, { ...status, briefing, openAvailable })
    } catch { sendJson(response, 503, { error: 'live-teams state unavailable' }) }
  })
}

async function handleTeamEnable(request: LiveTeamsRequest, response: LiveTeamsResponse, ctx: LiveTeamsRouteContext, options: LiveTeamsRouteOptions): Promise<void> {
  if (!authorityAllowed(request, ctx.webServer.port)) { sendJson(response, 403, { error: 'live-teams request authority rejected' }); return }
  if (request.method !== 'POST' || bodyContentType(request) !== 'application/json') { sendJson(response, request.method === 'POST' ? 400 : 405, { error: request.method === 'POST' ? 'live-teams invalid request' : 'live-teams method not allowed' }); return }
  let name: string | undefined
  let createNew = false
  try {
    const body = record(JSON.parse(await requestBody(request)) as unknown)
    if (body.name !== undefined && codePointText(body.name) === undefined) throw new Error('invalid name')
    if (body.createNew !== undefined && typeof body.createNew !== 'boolean') throw new Error('invalid createNew')
    name = body.name === undefined ? undefined : codePointText(body.name)
    createNew = body.createNew === true
    if (body.sessionId === undefined) throw new Error('missing session')
  } catch { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
  await withResolvedOptions(request, response, options, async (resolved) => {
    if (resolved.enableTeam === undefined) { sendJson(response, 500, { error: 'live-teams mutation failed' }); return }
    try { sendJson(response, 200, await resolved.enableTeam(name, createNew)) }
    catch (error) {
      if (error instanceof LiveTeamsError && error.auditDetail === 'existing team found') {
        sendJson(response, 409, { error: 'live-teams existing team found', candidates: error.details.candidates ?? [] }); return
      }
      sendJson(response, 500, { error: 'live-teams mutation failed' })
    }
  })
}

async function handleTeamCandidates(request: LiveTeamsRequest, response: LiveTeamsResponse, ctx: LiveTeamsRouteContext, options: LiveTeamsRouteOptions): Promise<void> {
  if (!authorityAllowed(request, ctx.webServer.port)) { sendJson(response, 403, { error: 'live-teams request authority rejected' }); return }
  if (request.method !== 'GET') { sendJson(response, 405, { error: 'live-teams method not allowed' }); return }
  await withResolvedOptions(request, response, options, async (resolved) => {
    if (resolved.listTeamCandidates === undefined) { sendJson(response, 500, { error: 'live-teams snapshot unavailable' }); return }
    try { sendJson(response, 200, { teamId: resolved.teamId, workspacePath: resolved.workspacePath, candidates: await resolved.listTeamCandidates() }) }
    catch { sendJson(response, 503, { error: 'live-teams state unavailable' }) }
  })
}

async function handleTeamAdopt(request: LiveTeamsRequest, response: LiveTeamsResponse, ctx: LiveTeamsRouteContext, options: LiveTeamsRouteOptions): Promise<void> {
  if (!authorityAllowed(request, ctx.webServer.port)) { sendJson(response, 403, { error: 'live-teams request authority rejected' }); return }
  if (request.method !== 'POST' || bodyContentType(request) !== 'application/json') { sendJson(response, request.method === 'POST' ? 400 : 405, { error: request.method === 'POST' ? 'live-teams invalid request' : 'live-teams method not allowed' }); return }
  let candidateTeamId: string | undefined
  let replaceEmptyDerived = false
  try {
    const body = record(JSON.parse(await requestBody(request)) as unknown)
    if (!safeTeamId(body.teamId)) throw new Error('invalid team id')
    if (body.replaceEmptyDerived !== undefined && typeof body.replaceEmptyDerived !== 'boolean') throw new Error('invalid replacement flag')
    if (body.sessionId === undefined) throw new Error('missing session')
    candidateTeamId = body.teamId
    replaceEmptyDerived = body.replaceEmptyDerived === true
  } catch { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
  await withResolvedOptions(request, response, options, async (resolved) => {
    if (resolved.adoptTeam === undefined || candidateTeamId === undefined) { sendJson(response, 500, { error: 'live-teams mutation failed' }); return }
    try {
      const adopted = await resolved.adoptTeam(candidateTeamId, replaceEmptyDerived)
      sendJson(response, 200, { ...adopted.status, adoptedFrom: adopted.adoptedFrom })
    } catch (error) {
      const status = adoptionErrorStatus(error)
      sendJson(response, status, status === 400 ? { error: 'live-teams invalid request' } : status === 409 ? { error: 'live-teams derived team already exists' } : { error: 'live-teams mutation failed' })
    }
  })
}

async function handleTeamDisable(request: LiveTeamsRequest, response: LiveTeamsResponse, ctx: LiveTeamsRouteContext, options: LiveTeamsRouteOptions): Promise<void> {
  if (!authorityAllowed(request, ctx.webServer.port)) { sendJson(response, 403, { error: 'live-teams request authority rejected' }); return }
  if (request.method !== 'POST') { sendJson(response, 405, { error: 'live-teams method not allowed' }); return }
  if (bodyContentType(request) !== 'application/json') { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
  await withResolvedOptions(request, response, options, async (resolved) => {
    if (resolved.disableTeam === undefined) { sendJson(response, 500, { error: 'live-teams mutation failed' }); return }
    try { sendJson(response, 200, await resolved.disableTeam()) } catch { sendJson(response, 500, { error: 'live-teams mutation failed' }) }
  })
}

type HumanInboxMessage = {
  readonly id: string
  readonly from: string
  readonly fromName: string
  readonly kind: MessageKind
  readonly content: string
  readonly createdAt: number
  readonly delivery: { readonly id: string; readonly state: 'stored' | 'acknowledged'; readonly acknowledgedAt?: number }
}

function messageKind(value: unknown): value is MessageKind {
  return value === 'message' || value === 'direction' || value === 'comment'
}

function mailboxErrorStatus(error: unknown): 400 | 500 | 503 {
  if (error instanceof LiveTeamsError && error.code === ERROR_CODES.STATE_CORRUPT) return 503
  if (error instanceof LiveTeamsError && (error.code === ERROR_CODES.CAPABILITY_UNAVAILABLE || error.code === ERROR_CODES.DELIVERY_REJECTED)) return 400
  return 500
}

function mailboxErrorBody(error: unknown): { error: string; candidates?: readonly string[]; recipients?: readonly string[] } {
  const status = mailboxErrorStatus(error)
  if (status !== 400) return { error: status === 503 ? 'live-teams state unavailable' : 'live-teams mutation failed' }
  if (error instanceof LiveTeamsError) {
    const candidates = error.details.candidates
    const recipients = error.details.recipients
    if (Array.isArray(candidates) && candidates.every((value): value is string => typeof value === 'string')) return { error: 'live-teams invalid request', candidates }
    if (Array.isArray(recipients) && recipients.every((value): value is string => typeof value === 'string')) return { error: 'live-teams invalid request', recipients }
  }
  return { error: 'live-teams invalid request' }
}

async function handleGrant(request: LiveTeamsRequest, response: LiveTeamsResponse, ctx: LiveTeamsRouteContext, options: LiveTeamsRouteOptions): Promise<void> {
  if (!authorityAllowed(request, ctx.webServer.port)) { sendJson(response, 403, { error: 'live-teams request authority rejected' }); return }
  if (request.method !== 'POST' || bodyContentType(request) !== 'application/json') { sendJson(response, request.method === 'POST' ? 400 : 405, { error: request.method === 'POST' ? 'live-teams invalid request' : 'live-teams method not allowed' }); return }
  let parsed: LiveTeamsGrantRequest
  try { parsed = parseGrant(await requestBody(request)) } catch { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
  try {
    const state = await readTeamState(options)
    if (!state.members.some((member) => member.memberId === parsed.memberId) || !(state.members.some((member) => member.memberId === parsed.allow) || parsed.allow === 'human' || parsed.allow === 'team')) { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
    if (options.setContactGrant === undefined) { sendJson(response, 500, { error: 'live-teams mutation failed' }); return }
    const result = await options.setContactGrant(parsed.memberId, parsed.allow, parsed.action, 'human:desktop')
    sendJson(response, 200, { grants: result.grants })
  } catch (error) { sendJson(response, mailboxErrorStatus(error), mailboxErrorBody(error)) }
}

async function handleMessagesList(request: LiveTeamsRequest, response: LiveTeamsResponse, ctx: LiveTeamsRouteContext, options: LiveTeamsRouteOptions): Promise<void> {
  if (!authorityAllowed(request, ctx.webServer.port)) { sendJson(response, 403, { error: 'live-teams request authority rejected' }); return }
  if (request.method !== 'GET') { sendJson(response, 405, { error: 'live-teams method not allowed' }); return }
  if (options.mailbox === undefined) { sendJson(response, 503, { error: 'live-teams state unavailable' }); return }
  let limit = 50
  try {
    const raw = request.url === undefined ? undefined : new URL(request.url, 'http://127.0.0.1').searchParams.get('limit')
    if (raw !== null && raw !== undefined) {
      if (!/^\d+$/u.test(raw)) throw new Error('invalid limit')
      limit = Math.min(200, Number(raw))
      if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('invalid limit')
    }
  } catch { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
  try {
    const [messages, deliveries] = await Promise.all([options.mailbox.listMessages(), options.mailbox.listDeliveries()])
    const memberNames = new Map((await readTeamState(options)).members.map((member) => [member.memberId, member.displayName]))
    const byMessage = new Map(messages.map((message) => [message.id, message]))
    const inbox: HumanInboxMessage[] = deliveries
      .filter((delivery) => delivery.recipient === 'human')
      .map((delivery) => {
        const message = byMessage.get(delivery.messageId)
        if (message === undefined) return undefined
        const fromName = message.from === 'human' ? 'human' : memberNames.get(message.from) ?? message.from
        const state = delivery.state === 'acknowledged' ? 'acknowledged' : 'stored'
        return {
          id: message.id, from: message.from, fromName, kind: message.kind, content: message.content, createdAt: message.createdAt,
          delivery: { id: delivery.id, state, ...(delivery.acknowledgedAt === undefined ? {} : { acknowledgedAt: delivery.acknowledgedAt }) },
        } satisfies HumanInboxMessage
      })
      .filter((entry): entry is HumanInboxMessage => entry !== undefined)
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, limit)
    sendJson(response, 200, { teamId: options.teamId, messages: inbox })
  } catch (error) { sendJson(response, mailboxErrorStatus(error), mailboxErrorBody(error)) }
}

/**
 * Who is waiting for the human.
 *
 * Deliberately small and cheap: the chip that renders it lives in the Session
 * header of every Session, so it must not pull the whole inbox to answer one
 * question.
 */
async function handleAttentionList(request: LiveTeamsRequest, response: LiveTeamsResponse, ctx: LiveTeamsRouteContext, options: LiveTeamsRouteOptions): Promise<void> {
  if (!authorityAllowed(request, ctx.webServer.port)) { sendJson(response, 403, { error: 'live-teams request authority rejected' }); return }
  if (request.method !== 'GET') { sendJson(response, 405, { error: 'live-teams method not allowed' }); return }
  if (options.mailbox === undefined) { sendJson(response, 503, { error: 'live-teams state unavailable' }); return }
  try {
    const [state, messages, deliveries] = await Promise.all([readTeamState(options), options.mailbox.listMessages(), options.mailbox.listDeliveries()])
    sendJson(response, 200, projectLiveTeamsAttention(state, messages, deliveries))
  } catch { sendJson(response, 503, { error: 'live-teams state unavailable' }) }
}

async function handleMessagesSend(request: LiveTeamsRequest, response: LiveTeamsResponse, ctx: LiveTeamsRouteContext, options: LiveTeamsRouteOptions): Promise<void> {
  if (!authorityAllowed(request, ctx.webServer.port)) { sendJson(response, 403, { error: 'live-teams request authority rejected' }); return }
  if (request.method !== 'POST') { sendJson(response, 405, { error: 'live-teams method not allowed' }); return }
  if (bodyContentType(request) !== 'application/json' || options.mailbox === undefined) { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
  let body: Record<string, unknown>
  try { body = record(JSON.parse(await requestBody(request)) as unknown) } catch { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
  const to = requiredText(body.to)
  const kind = body.kind
  const rawContent = body.content
  const content = typeof rawContent === 'string' ? rawContent.trim() : undefined
  const threadId = body.threadId
  if (body.sessionId === undefined || to === undefined || !messageKind(kind) || content === undefined || content.length === 0 || Array.from(content).length > 8000
    || (threadId !== undefined && requiredText(threadId) === undefined)) { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
  let state: TeamState
  try { state = await readTeamState(options) } catch { sendJson(response, 503, { error: 'live-teams state unavailable' }); return }
  try {
    // Deliberately construct a clean draft: a caller-provided `from` field is
    // ignored, and the mailbox derives the sender from this host operation.
    // Recipient resolution itself lives in the mailbox send path, before any
    // persistence, and is shared with member sends.
    const sent = await options.mailbox.sendFromHuman({ to, kind, content, ...(threadId === undefined ? {} : { threadId: threadId as string }) })
    const names = new Map(state.members.map((member) => [member.memberId, member.displayName]))
    const deliveries = sent.deliveries.map((delivery) => {
      const outcome = messageDeliveryOutcome(delivery)
      return {
        id: delivery.id,
        recipient: delivery.recipient,
        name: delivery.recipient === 'human' ? 'human' : names.get(delivery.recipient) ?? delivery.recipient,
        state: delivery.state,
        outcome,
        ...(outcome === 'failed' && delivery.failure !== undefined ? { failure: delivery.failure } : {}),
      }
    })
    sendJson(response, 200, {
      accepted: true,
      messageId: sent.message.id,
      delivered: deliveries.filter((delivery) => delivery.outcome === 'delivered').length,
      inbox: deliveries.filter((delivery) => delivery.outcome === 'inbox').length,
      pending: deliveries.filter((delivery) => delivery.outcome === 'pending').length,
      failed: deliveries.filter((delivery) => delivery.outcome === 'failed').length,
      recipients: sent.deliveries.map((delivery) => delivery.recipient),
      deliveries,
    })
  } catch (error) { sendJson(response, mailboxErrorStatus(error), mailboxErrorBody(error)) }
}

async function handleMessagesAcknowledge(request: LiveTeamsRequest, response: LiveTeamsResponse, ctx: LiveTeamsRouteContext, options: LiveTeamsRouteOptions): Promise<void> {
  if (!authorityAllowed(request, ctx.webServer.port)) { sendJson(response, 403, { error: 'live-teams request authority rejected' }); return }
  if (request.method !== 'POST' || bodyContentType(request) !== 'application/json' || options.mailbox === undefined) { sendJson(response, request.method === 'POST' ? 400 : 405, { error: request.method === 'POST' ? 'live-teams invalid request' : 'live-teams method not allowed' }); return }
  let messageId: string | undefined
  let messageIds: string[] | undefined
  try {
    const body = record(JSON.parse(await requestBody(request)) as unknown)
    messageId = requiredText(body.messageId)
    // The attention chip clears everything a member is waiting on in one step:
    // a person who has been taken to the source does not acknowledge 22 rows.
    if (Array.isArray(body.messageIds)) {
      const listed = body.messageIds.map((entry) => requiredText(entry))
      if (listed.some((entry) => entry === undefined) || listed.length === 0 || listed.length > 200) throw new Error('invalid acknowledgement')
      messageIds = listed as string[]
    }
    if (body.sessionId === undefined || messageId === undefined && messageIds === undefined) throw new Error('invalid acknowledgement')
  } catch { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
  try {
    // The recipient is fixed to the human actor. A member delivery for the
    // same message therefore cannot be acknowledged through this route.
    if (messageIds !== undefined) {
      const acknowledged: string[] = []
      for (const id of messageIds) acknowledged.push((await options.mailbox.acknowledge(id, 'human')).delivery.messageId)
      sendJson(response, 200, { messageIds: acknowledged, state: 'acknowledged' })
      return
    }
    const acknowledged = await options.mailbox.acknowledge(messageId as string, 'human')
    sendJson(response, 200, { messageId, state: acknowledged.delivery.state === 'acknowledged' ? 'acknowledged' : acknowledged.delivery.state })
  } catch (error) { sendJson(response, mailboxErrorStatus(error), mailboxErrorBody(error)) }
}

async function handleTeamName(request: LiveTeamsRequest, response: LiveTeamsResponse, ctx: LiveTeamsRouteContext, options: LiveTeamsRouteOptions): Promise<void> {
  if (!authorityAllowed(request, ctx.webServer.port)) { sendJson(response, 403, { error: 'live-teams request authority rejected' }); return }
  if (request.method !== 'POST' || bodyContentType(request) !== 'application/json') { sendJson(response, request.method === 'POST' ? 400 : 405, { error: request.method === 'POST' ? 'live-teams invalid request' : 'live-teams method not allowed' }); return }
  let name: string, expectedRevision: number
  try {
    const body = record(JSON.parse(await requestBody(request)) as unknown)
    const parsedName = codePointText(body.name)
    if (parsedName === undefined || !validInteger(body.expectedRevision) || body.sessionId === undefined) throw new Error('invalid team name')
    name = parsedName; expectedRevision = body.expectedRevision
  } catch { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
  await withResolvedOptions(request, response, options, async (resolved) => {
    if (resolved.renameTeam === undefined) { sendJson(response, 500, { error: 'live-teams mutation failed' }); return }
    let result: { status: LiveTeamsTeamStatus; from: string }
    try { result = await resolved.renameTeam(name, expectedRevision) } catch (error) {
      if (mutationConflict(error)) { sendJson(response, 409, { error: 'live-teams revision conflict', revision: resolved.teamStatus === undefined ? expectedRevision : (await resolved.teamStatus()).revision ?? expectedRevision }); return }
      sendJson(response, 500, { error: 'live-teams mutation failed' }); return
    }
    sendJson(response, 200, result.status)
  }, true)
}

export function registerLiveTeamsRoutes(ctx: LiveTeamsRouteContext, options: LiveTeamsRouteOptions): () => void {
  const registered: Array<() => void> = []
  registered.push(ctx.webServer.register({ kind: 'exact', path: LIVE_TEAMS_TEAM_ROUTE, handler: (request, response) => handleTeamStatus(request, response, ctx, options) }))
  registered.push(ctx.webServer.register({ kind: 'exact', path: LIVE_TEAMS_TEAM_BRIEFING_OPEN_ROUTE, handler: (request, response) => withResolvedOptions(request, response, options, (resolved) => handleBriefingOpen(request, response, ctx, resolved)) }))
  registered.push(ctx.webServer.register({ kind: 'exact', path: LIVE_TEAMS_TEAM_LEAD_ROUTE, handler: (request, response) => withResolvedOptions(request, response, options, (resolved) => handleTeamLead(request, response, ctx, resolved), request.method === 'POST') }))
  registered.push(ctx.webServer.register({ kind: 'exact', path: LIVE_TEAMS_TEAM_ENABLE_ROUTE, handler: (request, response) => handleTeamEnable(request, response, ctx, options) }))
  registered.push(ctx.webServer.register({ kind: 'exact', path: LIVE_TEAMS_TEAM_DISABLE_ROUTE, handler: (request, response) => handleTeamDisable(request, response, ctx, options) }))
  registered.push(ctx.webServer.register({ kind: 'exact', path: LIVE_TEAMS_TEAM_NAME_ROUTE, handler: (request, response) => handleTeamName(request, response, ctx, options) }))
  registered.push(ctx.webServer.register({ kind: 'exact', path: LIVE_TEAMS_TEAM_CANDIDATES_ROUTE, handler: (request, response) => handleTeamCandidates(request, response, ctx, options) }))
  registered.push(ctx.webServer.register({ kind: 'exact', path: LIVE_TEAMS_TEAM_ADOPT_ROUTE, handler: (request, response) => handleTeamAdopt(request, response, ctx, options) }))
  registered.push(ctx.webServer.register({ kind: 'exact', path: LIVE_TEAMS_MEMBER_GRANT_ROUTE, handler: (request, response) => withResolvedOptions(request, response, options, (resolved) => handleGrant(request, response, ctx, resolved), true) }))
  registered.push(ctx.webServer.register({ kind: 'exact', path: LIVE_TEAMS_JOURNAL_ROUTE, handler: (request, response) => handleJournalList(request, response, ctx, options) }))
  registered.push(ctx.webServer.register({ kind: 'exact', path: LIVE_TEAMS_TASKS_ROUTE, handler: (request, response) => handleTasksList(request, response, ctx, options) }))
  registered.push(ctx.webServer.register({ kind: 'exact', path: LIVE_TEAMS_TASK_ROUTE, handler: (request, response) => handleTaskRead(request, response, ctx, options) }))
  registered.push(ctx.webServer.register({ kind: 'exact', path: LIVE_TEAMS_TASK_NOTIFY_REVIEW_ROUTE, handler: (request, response) => handleTaskMutation(request, response, ctx, options, 'notify-review') }))
  registered.push(ctx.webServer.register({ kind: 'exact', path: LIVE_TEAMS_TASK_NOTIFY_SUBMISSION_ROUTE, handler: (request, response) => handleTaskMutation(request, response, ctx, options, 'notify-submission') }))
  registered.push(ctx.webServer.register({ kind: 'exact', path: LIVE_TEAMS_TASK_ACCEPT_ROUTE, handler: (request, response) => handleTaskMutation(request, response, ctx, options, 'accept') }))
  registered.push(ctx.webServer.register({ kind: 'exact', path: LIVE_TEAMS_TASK_REVISE_ROUTE, handler: (request, response) => handleTaskMutation(request, response, ctx, options, 'revise') }))
  registered.push(ctx.webServer.register({ kind: 'exact', path: LIVE_TEAMS_TASK_CANCEL_ROUTE, handler: (request, response) => handleTaskMutation(request, response, ctx, options, 'cancel') }))
  registered.push(ctx.webServer.register({ kind: 'exact', path: LIVE_TEAMS_TASK_RESUME_ROUTE, handler: (request, response) => handleTaskMutation(request, response, ctx, options, 'resume') }))
  registered.push(ctx.webServer.register({ kind: 'exact', path: LIVE_TEAMS_TASK_CREATE_ROUTE, handler: (request, response) => handleTaskControl(request, response, ctx, options, 'create') }))
  registered.push(ctx.webServer.register({ kind: 'exact', path: LIVE_TEAMS_TASK_UPDATE_ROUTE, handler: (request, response) => handleTaskControl(request, response, ctx, options, 'update') }))
  registered.push(ctx.webServer.register({ kind: 'exact', path: LIVE_TEAMS_TASK_REVOKE_ROUTE, handler: (request, response) => handleTaskControl(request, response, ctx, options, 'revoke') }))
  registered.push(ctx.webServer.register({ kind: 'exact', path: LIVE_TEAMS_MESSAGES_ROUTE, handler: (request, response) => {
    if (request.method === 'GET') return withResolvedOptions(request, response, options, (resolved) => handleMessagesList(request, response, ctx, resolved), true)
    return withResolvedOptions(request, response, options, (resolved) => handleMessagesSend(request, response, ctx, resolved), true)
  } }))
  registered.push(ctx.webServer.register({ kind: 'exact', path: LIVE_TEAMS_MESSAGES_ACKNOWLEDGE_ROUTE, handler: (request, response) => withResolvedOptions(request, response, options, (resolved) => handleMessagesAcknowledge(request, response, ctx, resolved), true) }))
  registered.push(ctx.webServer.register({ kind: 'exact', path: LIVE_TEAMS_ATTENTION_ROUTE, handler: (request, response) => withResolvedOptions(request, response, options, (resolved) => handleAttentionList(request, response, ctx, resolved), true) }))
  registered.push(ctx.webServer.register({ kind: 'exact', path: LIVE_TEAMS_DISPATCH_ROUTE, handler: (request, response) => handleDispatch(request, response, ctx, options) }))
  registered.push(ctx.webServer.register({ kind: 'exact', path: LIVE_TEAMS_TEAM_ROTATION_ROUTE, handler: (request, response) => handleTeamRotation(request, response, ctx, options) }))
  registered.push(ctx.webServer.register({ kind: 'exact', path: LIVE_TEAMS_ROLES_ROUTE, handler: (request, response) => withResolvedOptions(request, response, options, (resolved) => handleRolesList(request, response, ctx, resolved)) }))
  registered.push(ctx.webServer.register({ kind: 'exact', path: LIVE_TEAMS_ROLES_OPEN_ROUTE, handler: (request, response) => withResolvedOptions(request, response, options, (resolved) => handleRolesOpen(request, response, ctx, resolved)) }))
  registered.push(ctx.webServer.register({ kind: 'exact', path: LIVE_TEAMS_ROLES_OVERRIDE_ROUTE, handler: (request, response) => withResolvedOptions(request, response, options, (resolved) => handleRolesOverride(request, response, ctx, resolved)) }))
  registered.push(ctx.webServer.register({
    kind: 'exact',
    path: LIVE_TEAMS_MEMBER_CREATE_SESSION_ROUTE,
    handler: (request, response) => withResolvedOptions(request, response, options, (resolved) => handleCreateSessionMember(request, response, ctx, resolved), true),
  }))
  registered.push(ctx.webServer.register({
    kind: 'exact',
    path: LIVE_TEAMS_MEMBER_ROLE_ROUTE,
    handler: (request, response) => withResolvedOptions(request, response, options, (resolved) => handleMutation(request, response, ctx, resolved, 'role'), true),
  }))
  registered.push(ctx.webServer.register({
    kind: 'exact',
    path: LIVE_TEAMS_MEMBER_AVAILABILITY_ROUTE,
    handler: (request, response) => withResolvedOptions(request, response, options, (resolved) => handleMutation(request, response, ctx, resolved, 'availability'), true),
  }))
  registered.push(ctx.webServer.register({
    kind: 'exact',
    path: LIVE_TEAMS_MEMBER_NAME_ROUTE,
    handler: (request, response) => withResolvedOptions(request, response, options, (resolved) => handleMutation(request, response, ctx, resolved, 'name'), true),
  }))
  registered.push(ctx.webServer.register({
    kind: 'exact',
    path: LIVE_TEAMS_MEMBER_REMOVE_ROUTE,
    handler: (request, response) => withResolvedOptions(request, response, options, (resolved) => handleRemoveMember(request, response, ctx, resolved), true),
  }))
  registered.push(ctx.webServer.register({
    kind: 'exact',
    path: LIVE_TEAMS_MEMBER_INTERRUPT_ROUTE,
    handler: (request, response) => withResolvedOptions(request, response, options, (resolved) => handleInterrupt(request, response, ctx, resolved), true),
  }))
  registered.push(ctx.webServer.register({
    kind: 'exact',
    path: LIVE_TEAMS_CANDIDATES_ROUTE,
    handler: async (request, response) => {
      if (!authorityAllowed(request, ctx.webServer.port)) {
        sendJson(response, 403, { error: 'live-teams request authority rejected' })
        return
      }
      if (request.method !== 'GET') {
        sendJson(response, 405, { error: 'live-teams method not allowed' })
        return
      }
      const candidateSessionId = await requestSessionId(request)
      // A resolver that throws — an unreachable Session controller, for example —
      // is an unresolved request, not a server fault: the shared wrapper treats it
      // the same way, and this handler must not answer differently.
      let candidateOptions: LiveTeamsRouteOptions | undefined
      try {
        candidateOptions = await resolveOptions(request, options, candidateSessionId)
      } catch {
        candidateOptions = undefined
      }
      if (candidateOptions === undefined || (options.resolveRequest !== undefined && candidateSessionId === undefined)) { sendJson(response, 400, { error: 'live-teams invalid request' }); return }
      try {
        if (candidateOptions.teamEnabled !== undefined && !await candidateOptions.teamEnabled()) { sendJson(response, 503, { error: 'live-teams team disabled' }); return }
      } catch { sendJson(response, 503, { error: 'live-teams state unavailable' }); return }
       if (candidateOptions.listCandidates === undefined) {
        sendJson(response, 500, { error: 'live-teams snapshot unavailable' })
        return
      }
      let state: TeamState
      try {
        state = await readTeamState(candidateOptions)
      } catch {
        sendJson(response, 503, { error: 'live-teams state unavailable' })
        return
      }
      try {
        sendJson(response, 200, projectLiveTeamsCandidates(state, await candidateOptions.listCandidates(), candidateOptions))
      } catch {
        sendJson(response, 500, { error: 'live-teams snapshot unavailable' })
      }
    },
  }))
  registered.push(ctx.webServer.register({
    kind: 'exact',
    path: LIVE_TEAMS_MEMBERS_ROUTE,
    handler: async (request, response) => {
      if (request.method === 'POST') {
        await withResolvedOptions(request, response, options, (resolved) => handleCreateMember(request, response, ctx, resolved), true)
        return
      }
      if (!authorityAllowed(request, ctx.webServer.port)) {
        sendJson(response, 403, { error: 'live-teams request authority rejected' })
        return
      }
      if (request.method !== 'GET') {
        sendJson(response, 405, { error: 'live-teams method not allowed' })
        return
      }
      // The read path resolves and gates exactly like the write path: a request
      // for one workspace must never read another workspace's team.
      await withResolvedOptions(request, response, options, async (resolved) => {
        let state: TeamState
        try {
          state = await readTeamState(resolved)
        } catch {
          sendJson(response, 503, { error: 'live-teams state unavailable' })
          return
        }
        try {
          sendJson(response, 200, projectLiveTeamsSnapshot(state, resolved))
        } catch {
          sendJson(response, 500, { error: 'live-teams snapshot unavailable' })
        }
      }, true)
    },
  }))
  let disposed = false
  return () => {
    if (disposed) return
    disposed = true
    for (const dispose of registered) dispose()
  }
}
