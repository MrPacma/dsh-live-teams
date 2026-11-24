import { defineTool, type ToolDefinition, type ToolRunContext } from '@deepseek-ai/dsh-tools'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { messageDeliveryOutcome, type MailboxService, type MessageDeliveryOutcome } from './mailbox.js'
import { resolveLeadMemberId, type MemberRecord, type TeamState } from './team-store.js'
import type { HumanContact, RevokeTaskRequest, TaskKind, TaskRoute, TaskStore, UpdateTaskRequest } from './task-store.js'

export const MEMBER_TOOL_NAMES = Object.freeze([
  'live_team_send',
  'live_team_ack_message',
  'live_team_context',
  'live_team_status',
  'live_team_brief',
  'live_team_member_note',
  'live_team_grant',
  'live_team_dispatch',
  'live_team_create_task',
  'live_team_read_task',
  'live_team_list_tasks',
  'live_team_claim_task',
  'live_team_ack_task',
  'live_team_submit',
  'live_team_review',
  'live_team_update_task',
  'live_team_accept_task',
  'live_team_revise_task',
  'live_team_revoke_task',
  'live_team_cancel_task',
  'live_team_resume_task',
] as const)

export type MemberToolName = (typeof MEMBER_TOOL_NAMES)[number]

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
const MEMBER_BASE_TOOLS: readonly MemberToolName[] = [
  'live_team_send', 'live_team_ack_message', 'live_team_context', 'live_team_status', 'live_team_brief',
  'live_team_read_task', 'live_team_list_tasks', 'live_team_claim_task', 'live_team_ack_task', 'live_team_submit',
]

const LEAD_TOOLS: readonly MemberToolName[] = [
  'live_team_create_task', 'live_team_update_task', 'live_team_revoke_task', 'live_team_accept_task',
  'live_team_revise_task', 'live_team_cancel_task', 'live_team_resume_task', 'live_team_grant', 'live_team_dispatch', 'live_team_member_note',
]

const REVIEW_TOOLS: readonly MemberToolName[] = ['live_team_review']

/** Reviewer and verifier both judge work; the role files are craft, the capability is this. */
const REVIEW_ROLES: readonly string[] = ['reviewer', 'verifier']

export function toolsForRole(role: string): { mine: readonly MemberToolName[]; notMine: readonly MemberToolName[] } {
  const mine = [...MEMBER_BASE_TOOLS, ...(role === 'lead' ? LEAD_TOOLS : []), ...(REVIEW_ROLES.includes(role) ? REVIEW_TOOLS : [])]
  return { mine, notMine: MEMBER_TOOL_NAMES.filter((name) => !mine.includes(name)) }
}

/** Every tool must have a home; the test suite calls this so a new one cannot be forgotten. */
export function assertToolRolesComplete(names: readonly string[] = MEMBER_TOOL_NAMES): void {
  const assigned = new Set<string>([...MEMBER_BASE_TOOLS, ...LEAD_TOOLS, ...REVIEW_TOOLS])
  const missing = names.filter((name) => !assigned.has(name))
  if (missing.length > 0) throw new Error(`team tools without a role: ${missing.join(', ')}`)
}

export type MemberToolsBinding = {
  readonly mailbox: MailboxService
  readonly teamId: string
  readonly teamName: string
  readonly member: MemberRecord
  readonly team: TeamState
  readonly workspacePath?: string
  readonly live: (member: MemberRecord) => boolean
  readonly taskStore?: TaskStore
  readonly setMemberNote?: (memberId: string, note: string, actor: string) => Promise<{ memberId: string; note: string }>
  readonly appendAudit?: (event: unknown) => Promise<void>
  readonly updateContactGrant?: (from: string, to: string, action: 'add' | 'remove', actor: string) => Promise<{ grants: { from: string; to: string; grantedBy: string; at: number }[] }>
  /** Flip the dispatch switch under the tool's own lead check (B29). */
  readonly setDispatch?: (request: { mode: 'auto' | 'paused'; actor: string; reason?: string }) => Promise<{ from: string; to: string }>
}

export type MemberToolsResolver = (sessionId: string) => Promise<MemberToolsBinding | undefined>
type ToolRegistry = { register: (tool: ToolDefinition) => unknown }
type SessionExecution = { readonly agent?: { readonly session?: { readonly id?: unknown } } }
type EmptyArgs = Record<string, never>

function sessionIdOf(exec: ToolRunContext): string {
  const value = (exec as unknown as SessionExecution).agent?.session?.id
  if (typeof value !== 'string' || value.length === 0) throw new Error('calling Session has no identity')
  return value
}
type MemberToolDelivery = {
  readonly recipient: string
  readonly name: string
  readonly state: 'stored' | 'leased' | 'delivered' | 'acknowledged' | 'failed'
  readonly outcome: MessageDeliveryOutcome
  readonly failure?: string
}
type MemberToolSendResult = {
  readonly accepted: true
  readonly messageId: string
  readonly delivered: number
  readonly inbox: number
  readonly pending: number
  readonly failed: number
  readonly deliveries: MemberToolDelivery[]
}
function memberName(binding: MemberToolsBinding, recipient: string): string {
  if (recipient === 'human') return 'human'
  return binding.team.members.find((member) => member.memberId === recipient)?.displayName ?? recipient
}
function sendResult(binding: MemberToolsBinding, messageId: string, deliveries: readonly { recipient: string; state: MemberToolDelivery['state']; wakePolicy: 'never' | 'queue' | 'steer'; failure?: string }[]): MemberToolSendResult {
  const projected = deliveries.map((delivery) => ({
    recipient: delivery.recipient,
    name: memberName(binding, delivery.recipient),
    state: delivery.state,
    outcome: messageDeliveryOutcome(delivery),
    ...(delivery.state === 'failed' && delivery.failure !== undefined ? { failure: delivery.failure } : {}),
  }))
  return {
    accepted: true,
    messageId,
    delivered: projected.filter((delivery) => delivery.outcome === 'delivered').length,
    inbox: projected.filter((delivery) => delivery.outcome === 'inbox').length,
    pending: projected.filter((delivery) => delivery.outcome === 'pending').length,
    failed: projected.filter((delivery) => delivery.outcome === 'failed').length,
    deliveries: projected,
  }
}
function memberContext(binding: MemberToolsBinding) {
  return {
    teamName: binding.teamName,
    memberName: binding.member.displayName,
    role: binding.member.role,
    availability: binding.member.availability,
    members: binding.team.members.map((member) => ({ memberId: member.memberId, name: member.displayName, role: member.role, availability: member.availability, live: binding.live(member) })),
  }
}
function memberStatus(binding: MemberToolsBinding) {
  return {
    memberId: binding.member.memberId,
    teamId: binding.team.teamId,
    role: binding.member.role,
    availability: binding.member.availability,
    bindingGeneration: binding.member.bindingGeneration,
    contractRevision: binding.member.contractRevision,
    live: binding.live(binding.member),
  }
}
function renderOutput(value: unknown) { return [{ type: 'text' as const, text: JSON.stringify(value) }] }
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }
type JsonRecord = Record<string, JsonValue>
type ListedTaskValue = { documentMissing?: boolean } & JsonRecord
function jsonRecord(value: unknown): JsonRecord { return JSON.parse(JSON.stringify(value)) as JsonRecord }
function jsonCreateResult(value: unknown): { task: JsonRecord; documentPath: string; warnings?: JsonValue[] } {
  const candidate = jsonRecord(value)
  return { task: jsonRecord(candidate.task), documentPath: String(candidate.documentPath), ...(Array.isArray(candidate.warnings) ? { warnings: candidate.warnings } : {}) }
}
function jsonReadResult(value: unknown): { task: JsonRecord; document: string; submissions: JsonValue[]; rounds: JsonValue[] } {
  const candidate = jsonRecord(value)
  return { task: jsonRecord(candidate.task), document: String(candidate.document), submissions: Array.isArray(candidate.submissions) ? candidate.submissions : [], rounds: Array.isArray(candidate.rounds) ? candidate.rounds : [] }
}
function jsonListedTasks(value: unknown): { tasks: ListedTaskValue[] } { return JSON.parse(JSON.stringify(value)) as { tasks: ListedTaskValue[] } }

export type MemberToolsOptions = { includeContext?: boolean; includeContact?: boolean; includeTasks?: boolean; includeSubmissions?: boolean; includeReview?: boolean; includeAcceptance?: boolean; includeDispatch?: boolean }
function normalizeOptions(options: MemberToolsOptions | boolean | undefined, b18?: boolean, b19?: boolean, b20?: boolean): Required<MemberToolsOptions> {
  if (typeof options === 'object' && options !== null) return { includeContext: options.includeContext === true, includeContact: options.includeContact === true, includeTasks: options.includeTasks === true, includeSubmissions: options.includeSubmissions === true, includeReview: options.includeReview === true, includeAcceptance: options.includeAcceptance === true, includeDispatch: options.includeDispatch === true }
  return { includeContext: options === true, includeContact: b18 === true, includeTasks: b19 === true, includeSubmissions: b20 === true, includeReview: false, includeAcceptance: false, includeDispatch: false }
}

/** Mount B13 only when the optional tools service is present. */
export function registerMemberToolsIfAvailable(registry: ToolRegistry | undefined, resolve: MemberToolsResolver, options: MemberToolsOptions | boolean = {}, legacyB18 = false, legacyB19 = false, legacyB20 = false): boolean {
  if (registry === undefined) return false
  const normalized = typeof options === 'boolean' ? { includeContext: true, includeContact: legacyB18, includeTasks: legacyB19, includeSubmissions: legacyB20 } : { includeContext: true, ...options }
  registerMemberTools(registry, resolve, normalized)
  return true
}

/** Register the member-tool surface. Object options prevent positional flag drift as gates grow. */
export function registerMemberTools(registry: ToolRegistry, resolve: MemberToolsResolver, options: MemberToolsOptions | boolean = false, legacyB18?: boolean, legacyB19?: boolean, legacyB20?: boolean): void {
  const flags = normalizeOptions(options, legacyB18, legacyB19, legacyB20)
  const includeContext = flags.includeContext
  const includeContact = flags.includeContact
  const includeTasks = flags.includeTasks
  const includeSubmissions = flags.includeSubmissions
  const includeReview = flags.includeReview
   const includeAcceptance = flags.includeAcceptance
  const includeDispatch = flags.includeDispatch
  registry.register(defineTool({
    name: 'live_team_send',
    description: 'Send a message, direction, or comment to a member id or display name, the team, or the human.',
    parameters: {
      to: { type: 'string', required: true, description: "A member id, display name, 'team', or 'human'." },
      // `kind` is optional with a default, and `report` is accepted as a synonym for `message`:
      // the fourth live round lost three calls to this argument alone — two omissions and one
      // `report`, which is a *task route* type the model reasonably reaches for when it means
      // "tell the human what I did". Refusing the word costs a turn; accepting it costs nothing.
      kind: { type: 'string', enum: ['message', 'direction', 'comment', 'report'], description: 'The message kind: `message` (the default), `direction` (the lead directing a member), `comment` (a note on someone else\'s work). `report` is accepted as a synonym for `message`.' },
      content: { type: 'string', required: true, description: 'The message body.' },
      threadId: { type: 'string', description: 'Optional thread to continue.' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { accepted: { type: 'boolean', required: true }, messageId: { type: 'string', required: true }, delivered: { type: 'number', required: true }, inbox: { type: 'number', required: true }, pending: { type: 'number', required: true }, failed: { type: 'number', required: true }, deliveries: { type: 'array', required: true, items: { type: 'object', additionalProperties: false, properties: { recipient: { type: 'string', required: true }, name: { type: 'string', required: true }, state: { type: 'string', required: true, enum: ['stored', 'leased', 'delivered', 'acknowledged', 'failed'] }, outcome: { type: 'string', required: true, enum: ['delivered', 'inbox', 'pending', 'failed'] }, failure: { type: 'string' } } } } } },
      render: (_args, value) => {
        const result = value as MemberToolSendResult
        const statements = result.deliveries.map((delivery) => {
          if (delivery.outcome === 'delivered') return `Delivered to ${delivery.name}.`
          if (delivery.outcome === 'inbox') return delivery.name === 'human'
            ? 'Stored in the human inbox (waits for the human).'
            : `Stored for ${delivery.name}'s context.`
          if (delivery.outcome === 'pending') return `Pending delivery to ${delivery.name}.`
          return `Failed to deliver to ${delivery.name}: ${delivery.failure ?? 'delivery failed'}.`
        })
        const undelivered = result.deliveries.filter((delivery) => delivery.outcome === 'failed' || delivery.outcome === 'pending')
        const warning = undelivered.length === 0 ? '' : result.delivered === 0 && result.inbox === 0
          ? ` Nothing was delivered to: ${undelivered.map((delivery) => `${delivery.name} (${delivery.outcome}${delivery.failure === undefined ? '' : `: ${delivery.failure}`})`).join(', ')}.`
          : ` Not delivered to: ${undelivered.map((delivery) => `${delivery.name} (${delivery.outcome}${delivery.failure === undefined ? '' : `: ${delivery.failure}`})`).join(', ')}.`
        return [{ type: 'text' as const, text: `Accepted. ${statements.join(' ')}${warning}` }]
      },
    },
    execute: async (args, exec) => {
      const sessionId = sessionIdOf(exec)
      const binding = await resolve(sessionId)
      if (binding === undefined) throw new Error('calling Session is not an active member of this team')
      const draft = { ...args, kind: args.kind === undefined || args.kind === 'report' ? 'message' as const : args.kind }
      const result = await binding.mailbox.sendFromSession(sessionId, draft)
      return sendResult(binding, result.message.id, result.deliveries)
    },
  }))
  registry.register(defineTool({
    name: 'live_team_ack_message',
    description: "Acknowledge the calling member's own delivery of a team message.",
    parameters: { messageId: { type: 'string', required: true } },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { acknowledged: { type: 'boolean', required: true }, messageId: { type: 'string', required: true } } },
      render: (_args, value) => renderOutput(value),
    },
    execute: async (args, exec) => {
      const binding = await resolve(sessionIdOf(exec))
      if (binding === undefined) throw new Error('calling Session is not an active member of this team')
      await binding.mailbox.acknowledge(args.messageId, binding.member.memberId)
      return { acknowledged: true, messageId: args.messageId }
    },
  }))
  registry.register(defineTool({
    name: 'live_team_context',
    description: 'Read the bounded current team context for the calling member.',
    parameters: {},
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { teamName: { type: 'string', required: true }, memberName: { type: 'string', required: true }, role: { type: 'string', required: true }, availability: { type: 'string', required: true }, members: { type: 'array', required: true, items: { type: 'object', additionalProperties: false, properties: { memberId: { type: 'string', required: true }, name: { type: 'string', required: true }, role: { type: 'string', required: true }, availability: { type: 'string', required: true }, live: { type: 'boolean', required: true } } } } } },
      render: (_args, value) => renderOutput(value),
    },
    execute: async (_args: EmptyArgs, exec) => {
      const binding = await resolve(sessionIdOf(exec))
      if (binding === undefined) throw new Error('calling Session is not an active member of this team')
      return memberContext(binding)
    },
  }))
  if (includeContact) registry.register(defineTool({
    name: 'live_team_grant',
    description: 'List your permitted contacts, or ask the lead to grant/revoke a contact.',
    parameters: { action: { type: 'string', required: true, enum: ['list', 'add', 'remove'] }, memberId: { type: 'string' }, allow: { type: 'string' } },
    output: { schema: { type: 'object', additionalProperties: false, properties: { grants: { type: 'array', required: true }, leadMemberId: { type: 'string' } } }, render: (_args, value) => renderOutput(value) },
    execute: async (args: { action: 'list' | 'add' | 'remove'; memberId?: string; allow?: string }, exec) => {
      const binding = await resolve(sessionIdOf(exec))
      if (binding === undefined) throw new Error('calling Session is not an active member of this team')
      const leadId = resolveLeadMemberId(binding.team)
      const ownGrants = (binding.team.contactGrants ?? []).filter((grant) => grant.from === binding.member.memberId)
      if (args.action === 'list') return { grants: ownGrants, ...(leadId === undefined ? {} : { leadMemberId: leadId }) }
      if (binding.member.memberId !== leadId) throw new Error(`only the lead may change contact grants; ask ${leadId ?? 'the lead'}`)
      if (typeof args.memberId !== 'string' || args.memberId.length === 0 || typeof args.allow !== 'string' || args.allow.length === 0) throw new Error('memberId and allow are required')
      if (binding.updateContactGrant === undefined) throw new Error('contact grants are unavailable')
      return binding.updateContactGrant(args.memberId, args.allow, args.action, binding.member.memberId)
    },
  }))
  if (includeDispatch) registry.register(defineTool({
    name: 'live_team_dispatch',
    description: 'Pause or resume automatic dispatch for this team. Only the lead may change it. Pausing stops new work from starting: it never revokes a running attempt, never moves ownership, and never drops a message already queued for a member.',
    parameters: { mode: { type: 'string', required: true, enum: ['auto', 'paused'] }, reason: { type: 'string' } },
    output: { schema: { type: 'object', additionalProperties: false, properties: { from: { type: 'string', required: true }, to: { type: 'string', required: true } } }, render: (_args, value) => renderOutput(value) },
    execute: async (args: { mode: 'auto' | 'paused'; reason?: string }, exec) => {
      const binding = await resolve(sessionIdOf(exec))
      if (binding === undefined) throw new Error('calling Session is not an active member of this team')
      const leadId = resolveLeadMemberId(binding.team)
      if (binding.member.memberId !== leadId) throw new Error(`only the lead may pause or resume dispatch; ask ${leadId ?? 'the lead'}`)
      if (binding.setDispatch === undefined) throw new Error('dispatch is unavailable')
      const result = await binding.setDispatch({ mode: args.mode, actor: binding.member.memberId, ...(typeof args.reason === 'string' && args.reason.trim().length > 0 ? { reason: args.reason.trim() } : {}) })
      return { from: result.from, to: result.to }
    },
  }))
  if (includeTasks) {
    registry.register(defineTool({
      name: 'live_team_create_task',
      description: 'Create a durable task. Only the team lead may create tasks.',
      parameters: {
        title: { type: 'string', required: true },
        kind: { type: 'string', required: true, enum: ['work', 'research', 'requirements', 'implementation', 'verification', 'review', 'repair', 'integration'] },
        assignee: { type: 'string' },
        route: { type: 'json', description: 'Who receives the finished work: {"type":"review","reviewer":"<Reviewer member id>"} or {"type":"report","to":"<Lead/member id>"}; use {"type":"report","to":"human"} only when the report is intended for the human. For small Builder → Lead work, name the Lead member id. Report recipient does not change Lead/human acceptance authority.' },
        humanContact: { type: 'string', enum: ['none', 'expected', 'required'] },
        acceptance: { type: 'array', required: true, items: { type: 'string' }, description: 'What "done" means, each criterion checkable inside this task declared paths (e.g. "node --test packages/alpha/test"). A repository-wide criterion needs a declared dependency: a sibling task in flight makes it unsatisfiable.' },
        checks: { type: 'array', items: { type: 'string' } },
        why: { type: 'string' },
        body: { type: 'string' },
        roundLimit: { type: 'integer' },
        dependsOn: { type: 'array', items: { type: 'string' } },
        paths: { type: 'array', items: { type: 'string' }, description: 'Workspace-relative globs this task may touch. Two writing tasks with intersecting paths never run at the same time, so declare them for any task that writes code.' },
      },
      output: { schema: { type: 'object', additionalProperties: false, properties: { task: { type: 'json', required: true }, documentPath: { type: 'string', required: true }, warnings: { type: 'array', items: { type: 'json' } } } }, render: (_args, value) => renderOutput(value) },
      execute: async (args: { title: string; kind: TaskKind; assignee?: string; route?: TaskRoute; humanContact?: HumanContact; acceptance: string[]; checks?: string[]; why?: string; body?: string; roundLimit?: number; dependsOn?: string[]; paths?: string[] }, exec) => {
        const binding = await resolve(sessionIdOf(exec))
        if (binding === undefined) throw new Error('calling Session is not an active member of this team')
        const leadId = resolveLeadMemberId(binding.team)
        if (binding.member.memberId !== leadId) throw new Error(`only the lead may create tasks; ask ${leadId ?? 'the lead'}`)
        if (binding.taskStore === undefined) throw new Error('task store is unavailable')
        return jsonCreateResult(await binding.taskStore.createTask({ ...args, actor: binding.member.memberId }))
      },
    }))
    registry.register(defineTool({
      name: 'live_team_update_task',
      description: 'Edit the contract of a task you created: title, kind, assignee, route, acceptance, checks, why, body, round limit, human contact, dependencies, declared paths. Only the lead may update tasks, and only while nobody has started them (draft or ready). Absent fields are left alone; assignee, route, dependsOn and paths accept null to clear them.',
      parameters: {
        taskId: { type: 'string', required: true },
        expectedRevision: { type: 'integer' },
        title: { type: 'string' },
        kind: { type: 'string', enum: ['work', 'research', 'requirements', 'implementation', 'verification', 'review', 'repair', 'integration'] },
        assignee: { type: 'string' },
        route: { type: 'json', description: 'Who receives the finished work: {"type":"review","reviewer":"<Reviewer member id>"} or {"type":"report","to":"<Lead/member id>"}; use {"type":"report","to":"human"} only when the report is intended for the human. For small Builder → Lead work, name the Lead member id. Report recipient does not change Lead/human acceptance authority.' },
        humanContact: { type: 'string', enum: ['none', 'expected', 'required'] },
        acceptance: { type: 'array', items: { type: 'string' }, description: 'What "done" means, each criterion checkable inside this task declared paths (e.g. "node --test packages/alpha/test"). A repository-wide criterion needs a declared dependency: a sibling task in flight makes it unsatisfiable.' },
        checks: { type: 'array', items: { type: 'string' } },
        why: { type: 'string' },
        body: { type: 'string' },
        roundLimit: { type: 'integer' },
        dependsOn: { type: 'array', items: { type: 'string' } },
        paths: { type: 'array', items: { type: 'string' }, description: 'Workspace-relative globs this task may touch; null clears the declaration.' },
      },
      output: { schema: { type: 'object', additionalProperties: false, properties: { task: { type: 'json', required: true }, document: { type: 'string', required: true }, changed: { type: 'array', required: true, items: { type: 'string' } }, warnings: { type: 'array', items: { type: 'json' } } } }, render: (_args, value) => renderOutput(value) },
      // The wire schema types `route` as arbitrary JSON, so the patch is cast once
      // here; the store validates every field it is given.
      execute: async (args, exec) => {
        const binding = await resolve(sessionIdOf(exec))
        if (binding === undefined) throw new Error('calling Session is not an active member of this team')
        if (binding.taskStore === undefined) throw new Error('task store is unavailable')
        // Authority is the store's: it is the only place that reads the team, and a
        // second check here is how two answers to one question appear.
        const result = await binding.taskStore.updateTask({ ...(args as unknown as UpdateTaskRequest), actor: binding.member.memberId })
        return { task: jsonRecord(result.task), document: result.document, changed: [...result.changed], ...(result.warnings === undefined ? {} : { warnings: result.warnings.map(jsonRecord) }) }
      },
    }))
    registry.register(defineTool({
      name: 'live_team_cancel_task',
      description: 'Cancel and archive a task without accepting its work. Only the lead may cancel. A running attempt is invalidated and its Session must be observed stopped first. If that cannot be established, returns quiesced:false and needs_human without archiving; retry after resolving the runtime stop. Historical submissions remain evidence. Inspect notifications for the author notice; saved cancellation is not delivery and must not be repeated to retry a handoff.',
      parameters: {
        taskId: { type: 'string', required: true },
        reason: { type: 'string', required: true },
        expectedRevision: { type: 'integer' },
      },
      output: { schema: { type: 'object', additionalProperties: false, properties: { task: { type: 'json', required: true }, archivedPath: { type: 'string' }, quiesced: { type: 'boolean', required: true }, notifications: { type: 'array', items: { type: 'json' }, required: true } } }, render: (_args, value) => renderOutput(value) },
      execute: async (args: { taskId: string; reason: string; expectedRevision?: number }, exec) => {
        const binding = await resolve(sessionIdOf(exec))
        if (binding === undefined) throw new Error('calling Session is not an active member of this team')
        if (binding.taskStore === undefined) throw new Error('task store is unavailable')
        const result = await binding.taskStore.cancelTask({ ...args, actor: binding.member.memberId })
        return { task: jsonRecord(result.task), quiesced: result.quiesced, notifications: (result.notifications ?? []).map(jsonRecord), ...(result.archivedPath === undefined ? {} : { archivedPath: result.archivedPath }) }
      },
    }))
    registry.register(defineTool({
      name: 'live_team_resume_task',
      description: 'Explicitly release a parked draft task back to the ready queue. Only the lead may resume. Revocation itself never automatically restarts work. The existing contract must have an assignee, route and acceptance criteria; no live/revoking attempt may remain.',
      parameters: { taskId: { type: 'string', required: true }, expectedRevision: { type: 'integer' } },
      output: { schema: { type: 'object', additionalProperties: false, properties: { task: { type: 'json', required: true } } }, render: (_args, value) => renderOutput(value) },
      execute: async (args: { taskId: string; expectedRevision?: number }, exec) => {
        const binding = await resolve(sessionIdOf(exec))
        if (binding === undefined) throw new Error('calling Session is not an active member of this team')
        if (binding.taskStore === undefined) throw new Error('task store is unavailable')
        return { task: jsonRecord((await binding.taskStore.resumeTask({ ...args, actor: binding.member.memberId })).task) }
      },
    }))
    registry.register(defineTool({
      name: 'live_team_revoke_task',
      description: 'Take a task away from the member working on it: invalidate their attempt, stop their Session, and park the task in draft (optionally for a new assignee). Only the lead may revoke. It will not be automatically reclaimed: use live_team_resume_task explicitly to restart. If the Session cannot be observed to have stopped, the task goes to needs_human instead of pretending it was revoked.',
      parameters: {
        taskId: { type: 'string', required: true },
        reason: { type: 'string', required: true },
        nextAssignee: { type: 'string' },
        expectedRevision: { type: 'integer' },
      },
      output: { schema: { type: 'object', additionalProperties: false, properties: { task: { type: 'json', required: true }, attempt: { type: 'json', required: true }, quiesced: { type: 'boolean', required: true }, reassigned: { type: 'boolean', required: true } } }, render: (_args, value) => renderOutput(value) },
      execute: async (args, exec) => {
        const binding = await resolve(sessionIdOf(exec))
        if (binding === undefined) throw new Error('calling Session is not an active member of this team')
        if (binding.taskStore === undefined) throw new Error('task store is unavailable')
        const result = await binding.taskStore.revokeTask({ ...(args as unknown as RevokeTaskRequest), actor: binding.member.memberId })
        return { task: jsonRecord(result.task), attempt: jsonRecord(result.attempt), quiesced: result.quiesced, reassigned: result.reassigned }
      },
    }))
    registry.register(defineTool({
      name: 'live_team_read_task',
      description: 'Read a durable task and its authored document. An archived task is history: read it for a specific question, never to rebuild state.',
      parameters: { taskId: { type: 'string', required: true } },
      output: { schema: { type: 'object', additionalProperties: false, properties: { task: { type: 'json', required: true }, document: { type: 'string', required: true }, submissions: { type: 'array', required: true }, rounds: { type: 'array', required: true } } }, render: (_args, value) => renderOutput(value) },
      execute: async (args: { taskId: string }, exec) => {
        const binding = await resolve(sessionIdOf(exec))
        if (binding === undefined) throw new Error('calling Session is not an active member of this team')
        if (binding.taskStore === undefined) throw new Error('task store is unavailable')
        return jsonReadResult(await binding.taskStore.readTask(args.taskId))
      },
    }))
    registry.register(defineTool({
      name: 'live_team_list_tasks',
      description: 'List durable tasks for this team, newest first; archived tasks are hidden unless requested. Archived rows are history: ask for them only to answer a specific question.',
      parameters: { includeArchived: { type: 'boolean' } },
      output: { schema: { type: 'object', additionalProperties: false, properties: { tasks: { type: 'array', required: true, items: { type: 'object', additionalProperties: true, properties: { documentMissing: { type: 'boolean' } } } } } }, render: (_args, value) => renderOutput(value) },
      execute: async (args: { includeArchived?: boolean }, exec) => {
        const binding = await resolve(sessionIdOf(exec))
        if (binding === undefined) throw new Error('calling Session is not an active member of this team')
        if (binding.taskStore === undefined) throw new Error('task store is unavailable')
        return jsonListedTasks({ tasks: await binding.taskStore.listTasks({ includeArchived: args.includeArchived === true }) })
      },
    }))
    if (includeSubmissions) {
      registry.register(defineTool({
        name: 'live_team_claim_task',
        description: 'Claim your assigned ready task and create its active attempt.',
        parameters: { taskId: { type: 'string', required: true } },
        output: { schema: { type: 'object', additionalProperties: false, properties: { task: { type: 'json', required: true }, attempt: { type: 'json', required: true } } }, render: (_args, value) => renderOutput(value) },
        execute: async (args: { taskId: string }, exec) => {
          const binding = await resolve(sessionIdOf(exec))
          if (binding === undefined) throw new Error('calling Session is not an active member of this team')
          if (binding.taskStore === undefined) throw new Error('task store is unavailable')
          const result = await binding.taskStore.claimTask({ taskId: args.taskId, memberId: binding.member.memberId, sessionId: binding.member.sessionId ?? sessionIdOf(exec), bindingGeneration: binding.member.bindingGeneration })
          return { task: jsonRecord(result.task), attempt: jsonRecord(result.attempt) }
        },
      }))
      registry.register(defineTool({
        name: 'live_team_ack_task',
        description: 'Acknowledge your claimed task and move it into progress.',
        parameters: { taskId: { type: 'string', required: true } },
        output: { schema: { type: 'object', additionalProperties: false, properties: { task: { type: 'json', required: true } } }, render: (_args, value) => renderOutput(value) },
        execute: async (args: { taskId: string }, exec) => {
          const binding = await resolve(sessionIdOf(exec))
          if (binding === undefined) throw new Error('calling Session is not an active member of this team')
          if (binding.taskStore === undefined) throw new Error('task store is unavailable')
          const result = await binding.taskStore.acknowledgeTask({ taskId: args.taskId, memberId: binding.member.memberId, sessionId: sessionIdOf(exec), bindingGeneration: binding.member.bindingGeneration })
          return { task: jsonRecord(result.task) }
        },
      }))
    }
  }
  if (includeReview) {
    registry.register(defineTool({
      name: 'live_team_submit',
      description: 'Submit an immutable report or file artifact for the active task attempt. Returns the saved submission and per-recipient notifications. Saving is not notification: queued means native admission, not execution or acceptance; pending/failed/unavailable needs attention without resubmitting or blind duplicate sends. Report routes notify current Lead; review routes notify their Reviewer. A refusal before saving changes nothing about the task.',
      parameters: {
        taskId: { type: 'string', required: true },
        artifact: {
          type: 'json',
          required: true,
          // The pilot proved this has to be spelled out: with an opaque `json`
          // parameter the member invented its own keys, the refusal named a branch
          // it never chose, and it went looking for the error text on disk.
          description: 'Exactly one of two shapes, with exactly these keys: {"type":"report","bodyRef":"<workspace-relative path to the report you wrote>"} or {"type":"files","paths":["<workspace-relative path>", "..."]}. `type` is required; no other keys are accepted. Write a report body under .dsh-live-teams/reports/<task-id>.md, never in the repository root: the root is the integration tree.',
        },
        summary: { type: 'string', required: true, description: 'One or two sentences: what you changed and what you observed.' },
        checks: { type: 'array', items: { type: 'json' }, description: 'The checks you actually ran: [{"command":"npm test","status":"passed" | "failed","output":"<short tail>"}]. Each entry needs `command` and `status`.' },
      },
      output: { schema: { type: 'object', additionalProperties: false, properties: { submission: { type: 'json', required: true }, notifications: { type: 'array', items: { type: 'json' }, required: true } } }, render: (_args, value) => renderOutput(value) },
      execute: async (args: { taskId: string; artifact: { type: 'report' | 'files'; bodyRef?: string; paths?: string[] }; summary: string; checks?: { command: string; status: 'passed' | 'failed'; output?: string }[] }, exec) => {
        const sessionId = sessionIdOf(exec)
        const binding = await resolve(sessionId)
        if (binding === undefined) throw new Error('calling Session is not an active member of this team')
        if (binding.taskStore === undefined) throw new Error('task store is unavailable')
        // The parameter is an opaque `json`, so the host validates nothing and the member's own
        // spelling arrives here. A trailing newline after "report", or the whole artifact sent as a
        // JSON string, is the same submission as far as the member is concerned — and refusing it
        // cost a Builder a blocked task and a long explanation on a live stand.
        const raw: unknown = args.artifact
        let artifactInput: { type?: unknown; bodyRef?: unknown; paths?: unknown } | undefined
        if (typeof raw === 'string') {
          try { artifactInput = JSON.parse(raw) as { type?: unknown } } catch { artifactInput = undefined }
        } else if (raw !== null && typeof raw === 'object') {
          artifactInput = raw as { type?: unknown }
        }
        const observed = raw === undefined ? 'undefined' : typeof raw === 'string' ? `a JSON string: ${JSON.stringify(raw.slice(0, 120))}` : JSON.stringify(raw)
        const declared = typeof artifactInput?.type === 'string' ? artifactInput.type.trim().toLowerCase() : artifactInput?.type
        const shape = artifactInput === undefined ? observed : Object.keys(artifactInput).join(', ')
        if (declared === 'report' && typeof artifactInput?.bodyRef !== 'string') {
          throw new Error(`artifact {"type":"report"} needs a string "bodyRef"; received keys: ${shape}. Accepted shapes: {"type":"report","bodyRef":"<path>"} or {"type":"files","paths":["<path>", "…"]}`)
        }
        if (declared === 'files' && (!Array.isArray(artifactInput?.paths) || artifactInput.paths.length === 0 || !artifactInput.paths.every((entry) => typeof entry === 'string'))) {
          throw new Error(`artifact {"type":"files"} needs a non-empty "paths" array of strings; received keys: ${shape}. Accepted shapes: {"type":"files","paths":["<path>", "…"]} or {"type":"report","bodyRef":"<path>"}`)
        }
        if (declared !== 'report' && declared !== 'files') {
          // Name the value, not only the keys: "received keys: type, bodyRef" told a member nothing
          // about why a shape it had copied from this very message was refused.
          throw new Error(`artifact must declare its shape with "type":"report" or "type":"files"; received keys: ${shape}; "type" was ${JSON.stringify(artifactInput?.type)}. Accepted shapes: {"type":"report","bodyRef":"<path>"} or {"type":"files","paths":["<path>", "…"]}`)
        }
        const artifact = declared === 'report'
          ? { type: 'report' as const, bodyRef: (artifactInput?.bodyRef as string).trim() }
          : { type: 'files' as const, paths: (artifactInput?.paths as string[]).map((entry) => entry.trim()) }
        const result = await binding.taskStore.submitTask({ taskId: args.taskId, memberId: binding.member.memberId, sessionId, bindingGeneration: binding.member.bindingGeneration, artifact, summary: args.summary, checks: args.checks ?? [] })
        return { submission: jsonRecord(result.submission), notifications: Array.isArray(result.notifications) ? result.notifications.map(jsonRecord) : [] }
      },
    }))
    registry.register(defineTool({
      name: 'live_team_review',
      description: 'Reviewer only. Save a terminal verdict on the latest immutable submission. PASS keeps existing automatic acceptance and notifies current Lead; ESCALATE requests Lead decision; NEEDS_REVISION returns through the existing author/Lead protocol. Inspect notifications: saved verdict is not delivery, queued is native admission not reading/execution, and absent/pending/failed/unavailable is not permission to claim notification or repeat review. PASS needs at least one check you ran, command and observed output; inspection counts.',
      parameters: {
        taskId: { type: 'string', required: true },
        submissionId: { type: 'string', required: true },
        verdict: { type: 'string', required: true, enum: ['pass', 'needs_revision', 'escalate'] },
        findings: { type: 'array', items: { type: 'json' }, description: 'One entry per problem: [{"severity":"low" | "medium" | "high" | "blocker","problem":"…","requiredFix":"…","artifactLocation":"<optional path>"}]. Required for a verdict other than pass.' },
        evidence: { type: 'array', items: { type: 'json' }, description: 'What you ran while judging: [{"command":"npm test","status":"passed" | "failed","output":"<short tail>"}].' },
      },
      output: { schema: { type: 'object', additionalProperties: false, properties: { round: { type: 'json', required: true }, task: { type: 'json', required: true }, notifications: { type: 'array', items: { type: 'json' }, required: true } } }, render: (_args, value) => renderOutput(value) },
      execute: async (args: { taskId: string; submissionId: string; verdict: 'pass' | 'needs_revision' | 'escalate'; findings?: { severity: 'low' | 'medium' | 'high' | 'blocker'; problem: string; requiredFix: string; artifactLocation?: string }[]; evidence?: { command: string; status: 'passed' | 'failed'; output?: string }[] }, exec) => {
        const binding = await resolve(sessionIdOf(exec))
        if (binding === undefined) throw new Error('calling Session is not an active member of this team')
        if (binding.taskStore === undefined) throw new Error('task store is unavailable')
        const result = await binding.taskStore.reviewTask({ taskId: args.taskId, submissionId: args.submissionId, reviewerMemberId: binding.member.memberId, verdict: args.verdict, findings: args.findings ?? [], evidence: args.evidence ?? [] })
        return { round: jsonRecord(result.round), task: jsonRecord(result.task), notifications: (result.notifications ?? []).map(jsonRecord) }
      },
    }))
  }
  if (includeAcceptance) {
    registry.register(defineTool({
      name: 'live_team_accept_task',
      description: 'Accept a waiting task as the team lead and archive its authored document. Inspect notifications for the author handoff: saved acceptance is not delivery; never accept again just to retry a notice.',
      parameters: { taskId: { type: 'string', required: true }, note: { type: 'string' } },
      output: { schema: { type: 'object', additionalProperties: false, properties: { task: { type: 'json', required: true }, archivedPath: { type: 'string', required: true }, notifications: { type: 'array', items: { type: 'json' }, required: true } } }, render: (_args, value) => renderOutput(value) },
      execute: async (args: { taskId: string; note?: string }, exec) => {
        const binding = await resolve(sessionIdOf(exec))
        if (binding === undefined) throw new Error('calling Session is not an active member of this team')
        if (binding.taskStore === undefined) throw new Error('task store is unavailable')
        const leadId = resolveLeadMemberId(binding.team)
        if (binding.member.memberId !== leadId) throw new Error(`only the lead may accept tasks; ask ${leadId ?? 'the lead'}`)
        const result = await binding.taskStore.acceptTask({ taskId: args.taskId, actor: binding.member.memberId, ...(args.note === undefined ? {} : { note: args.note }) })
        return { task: jsonRecord(result.task), archivedPath: result.archivedPath, notifications: (result.notifications ?? []).map(jsonRecord) }
      },
    }))
    registry.register(defineTool({
      name: 'live_team_revise_task',
      description: 'Return a waiting task to progress with high-priority instructions for its assignee. Inspect notifications: saved revision is not delivery; do not revise again just to retry a notice.',
      parameters: { taskId: { type: 'string', required: true }, instructions: { type: 'string', required: true } },
      output: { schema: { type: 'object', additionalProperties: false, properties: { task: { type: 'json', required: true }, notifications: { type: 'array', items: { type: 'json' }, required: true } } }, render: (_args, value) => renderOutput(value) },
      execute: async (args: { taskId: string; instructions: string }, exec) => {
        const binding = await resolve(sessionIdOf(exec))
        if (binding === undefined) throw new Error('calling Session is not an active member of this team')
        if (binding.taskStore === undefined) throw new Error('task store is unavailable')
        const leadId = resolveLeadMemberId(binding.team)
        if (binding.member.memberId !== leadId) throw new Error(`only the lead may revise tasks; ask ${leadId ?? 'the lead'}`)
        const result = await binding.taskStore.reviseTask({ taskId: args.taskId, actor: binding.member.memberId, instructions: args.instructions })
        return { task: jsonRecord(result.task), notifications: (result.notifications ?? []).map(jsonRecord) }
      },
    }))
  }
  if (includeContext) registry.register(defineTool({
    name: 'live_team_brief',
    description: 'Read or update the team briefing. Only the team lead may update it.',
    parameters: { action: { type: 'string', required: true, enum: ['read', 'update'] }, text: { type: 'string' } },
    output: { schema: { type: 'object', additionalProperties: false, properties: { text: { type: 'string' }, saved: { type: 'boolean' }, length: { type: 'number' } } }, render: (_args, value) => renderOutput(value) },
    execute: async (args: { action: 'read' | 'update'; text?: string }, exec) => {
      const binding = await resolve(sessionIdOf(exec))
      if (binding === undefined) throw new Error('calling Session is not an active member of this team')
      const leadId = resolveLeadMemberId(binding.team)
      if (args.action === 'read') {
        if (binding.workspacePath === undefined) return { text: '' }
        try { return { text: await readFile(path.join(binding.workspacePath, '.dsh-live-teams', 'BRIEF.md'), 'utf8') } } catch { return { text: '' } }
      }
      if (binding.member.memberId !== leadId) throw new Error('briefing is owned by the lead; ask the lead to update it')
      if (typeof args.text !== 'string') throw new Error('text is required for update')
      const next = args.text.trim().slice(0, 8000)
      if (binding.workspacePath === undefined) throw new Error('team workspace is unavailable')
      await mkdir(path.join(binding.workspacePath, '.dsh-live-teams'), { recursive: true })
      const file = path.join(binding.workspacePath, '.dsh-live-teams', 'BRIEF.md')
      if (next.length === 0) await writeFile(file, '', 'utf8')
      else await writeFile(file, next, 'utf8')
      await binding.appendAudit?.({ kind: 'briefing/updated', actor: binding.member.memberId, length: next.length, at: Date.now() })
      return { saved: true, length: next.length }
    },
  }))
  if (includeContext) registry.register(defineTool({
    name: 'live_team_member_note',
    description: 'Set a member note. Only the team lead may update notes.',
    parameters: { memberId: { type: 'string', required: true }, note: { type: 'string', required: true } },
    output: { schema: { type: 'object', additionalProperties: false, properties: { memberId: { type: 'string', required: true }, note: { type: 'string', required: true } } }, render: (_args, value) => renderOutput(value) },
    execute: async (args: { memberId: string; note: string }, exec) => {
      const binding = await resolve(sessionIdOf(exec))
      if (binding === undefined) throw new Error('calling Session is not an active member of this team')
      const leadId = resolveLeadMemberId(binding.team)
      if (binding.member.memberId !== leadId) throw new Error('briefing is owned by the lead; ask the lead to update the member note')
      const target = binding.team.members.find((entry) => entry.memberId === args.memberId)
      if (target === undefined) throw new Error('member not found')
      const note = args.note.trim().slice(0, 200)
      if (binding.setMemberNote !== undefined) await binding.setMemberNote(args.memberId, note, binding.member.memberId)
      await binding.appendAudit?.({ kind: 'member/note', memberId: args.memberId, note, actor: binding.member.memberId, at: Date.now() })
      return { memberId: args.memberId, note }
    },
  }))
  registry.register(defineTool({
    name: 'live_team_status',
    description: 'Read the calling member current binding and contract status.',
    parameters: {},
    output: { schema: { type: 'object', additionalProperties: false, properties: { memberId: { type: 'string', required: true }, teamId: { type: 'string', required: true }, role: { type: 'string', required: true }, availability: { type: 'string', required: true }, bindingGeneration: { type: 'number', required: true }, contractRevision: { type: 'number', required: true }, live: { type: 'boolean', required: true } } }, render: (_args, value) => renderOutput(value) },
    execute: async (_args: EmptyArgs, exec) => { const binding = await resolve(sessionIdOf(exec)); if (binding === undefined) throw new Error('calling Session is not an active member of this team'); return memberStatus(binding) },
  }))
}

export type { ToolRegistry }
