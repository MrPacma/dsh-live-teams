import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { permittedContacts } from './task-store.js'
import { LIVE_TEAMS_JOURNAL_ROUTE, LIVE_TEAMS_MEMBER_GRANT_ROUTE, LIVE_TEAMS_MESSAGES_ROUTE, LIVE_TEAMS_MESSAGES_ACKNOWLEDGE_ROUTE, LIVE_TEAMS_ATTENTION_ROUTE, LIVE_TEAMS_CANDIDATES_ROUTE, LIVE_TEAMS_MEMBER_AVAILABILITY_ROUTE, LIVE_TEAMS_MEMBER_CREATE_SESSION_ROUTE, LIVE_TEAMS_MEMBER_INTERRUPT_ROUTE, LIVE_TEAMS_MEMBER_NAME_ROUTE, LIVE_TEAMS_MEMBER_REMOVE_ROUTE, LIVE_TEAMS_MEMBER_ROLE_ROUTE, LIVE_TEAMS_TASKS_ROUTE, LIVE_TEAMS_TASK_ROUTE, LIVE_TEAMS_TASK_ACCEPT_ROUTE, LIVE_TEAMS_TASK_NOTIFY_SUBMISSION_ROUTE, LIVE_TEAMS_TASK_NOTIFY_REVIEW_ROUTE, LIVE_TEAMS_TASK_REVISE_ROUTE, LIVE_TEAMS_TEAM_ROTATION_ROUTE, liveTeamsRequestAllowed, projectLiveTeamsCandidates, projectLiveTeamsSnapshot, registerLiveTeamsRoutes, type LiveTeamsCreateMemberRequest, type LiveTeamsCreateMemberResult, type LiveTeamsCreateSessionMemberRequest, type LiveTeamsCreateSessionMemberResult, type LiveTeamsMutation, type LiveTeamsMutationResult, type LiveTeamsResponse, type LiveTeamsRotation, type LiveTeamsRotationRequest, type LiveTeamsWebServer, LIVE_TEAMS_TASK_CREATE_ROUTE, LIVE_TEAMS_TASK_UPDATE_ROUTE, LIVE_TEAMS_TASK_REVOKE_ROUTE } from './routes.js'
import { ERROR_CODES, LiveTeamsError } from './errors.js'
import { TeamStore, type TeamState } from './team-store.js'
import { createTaskStore, type ReadTaskResult, type TaskStore, type TeamTask } from './task-store.js'

const workspacePath = '/workspace'
const baseState: TeamState = {
  schemaVersion: 1,
  revision: 4,
  teamId: 'team-1',
  workspaceId: 'workspace-1',
  workspacePath,
  members: [
    { memberId: 'z-live', displayName: 'Zed', role: 'engineer', availability: 'available', sessionId: 's-live', bindingGeneration: 4, contractRevision: 7 },
    { memberId: 'a-unbound', displayName: 'Ada', role: 'researcher', availability: 'paused', bindingGeneration: 0, contractRevision: 0 },
    { memberId: 'm-dead', displayName: 'Mina', role: 'reviewer', availability: 'available', sessionId: 's-dead', bindingGeneration: 2, contractRevision: 3 },
  ],
  archivedMemberIds: [],
  createdAt: 1,
  updatedAt: 2,
}

function response(): LiveTeamsResponse & { body: string | undefined; headers: Record<string, string> } {
  const result = { statusCode: 0, headers: {} as Record<string, string>, body: undefined as string | undefined }
  return {
    get statusCode() { return result.statusCode },
    set statusCode(value: number) { result.statusCode = value },
    headers: result.headers,
    body: result.body,
    setHeader(name, value) { result.headers[name] = value },
    end(body) { result.body = body; this.body = body },
  }
}

type RouteHandler = (request: { method?: string; headers: Record<string, string>; socket: { remoteAddress?: string }; url?: string; body?: string }, response: LiveTeamsResponse) => unknown

function routeOf(readState: () => Promise<unknown>, agents: { get: (id: string) => unknown } = { get: () => undefined }, extra: { applyMutation?: (request: LiveTeamsMutation) => Promise<LiveTeamsMutationResult>; listCandidates?: () => Promise<readonly import('./session-bridge.js').SessionDescriptor[]>; createMember?: (request: LiveTeamsCreateMemberRequest) => Promise<LiveTeamsCreateMemberResult>; createSessionMember?: (request: LiveTeamsCreateSessionMemberRequest) => Promise<LiveTeamsCreateSessionMemberResult>; removeMember?: (request: import('./routes.js').LiveTeamsRemoveMemberRequest) => Promise<import('./routes.js').LiveTeamsRemoveMemberResult>; interrupt?: (sessionId: string, reason: string) => Promise<{ accepted: true }>; appendAudit?: (event: unknown) => Promise<void>; readEvents?: () => Promise<{ events: readonly unknown[]; torn: string | null }>; setContactGrant?: (from: string, to: string, action: 'add' | 'remove', actor: string) => Promise<{ grants: { from: string; to: string; grantedBy: string; at: number }[] }>; mailbox?: import('./mailbox.js').MailboxService; taskStore?: TaskStore; readRotation?: () => Promise<LiveTeamsRotation | undefined>; setRotation?: (request: LiveTeamsRotationRequest & { actor: string }) => Promise<LiveTeamsRotation> } = {}) {
  const handlers = new Map<string, RouteHandler>()
  const unregister = vi.fn()
  const server: LiveTeamsWebServer = {
    port: 43120,
    register(route) { handlers.set(route.path, route.handler as RouteHandler); return unregister },
  }
  const dispose = registerLiveTeamsRoutes({ webServer: server }, { teamId: 'team-1', workspacePath, readState, agents, ...extra })
  const handler = handlers.get('/api/live-teams/members')
  if (handler === undefined) throw new Error('handler was not registered')
  return { notifyReview: handlers.get(LIVE_TEAMS_TASK_NOTIFY_REVIEW_ROUTE), notifySubmission: handlers.get(LIVE_TEAMS_TASK_NOTIFY_SUBMISSION_ROUTE), taskCreate: handlers.get(LIVE_TEAMS_TASK_CREATE_ROUTE), taskUpdate: handlers.get(LIVE_TEAMS_TASK_UPDATE_ROUTE), taskRevoke: handlers.get(LIVE_TEAMS_TASK_REVOKE_ROUTE), handler, journal: handlers.get(LIVE_TEAMS_JOURNAL_ROUTE), grant: handlers.get(LIVE_TEAMS_MEMBER_GRANT_ROUTE), messages: handlers.get(LIVE_TEAMS_MESSAGES_ROUTE), attention: handlers.get(LIVE_TEAMS_ATTENTION_ROUTE), acknowledge: handlers.get(LIVE_TEAMS_MESSAGES_ACKNOWLEDGE_ROUTE), candidates: handlers.get(LIVE_TEAMS_CANDIDATES_ROUTE), createSession: handlers.get(LIVE_TEAMS_MEMBER_CREATE_SESSION_ROUTE), interrupt: handlers.get(LIVE_TEAMS_MEMBER_INTERRUPT_ROUTE), role: handlers.get(LIVE_TEAMS_MEMBER_ROLE_ROUTE), availability: handlers.get(LIVE_TEAMS_MEMBER_AVAILABILITY_ROUTE), name: handlers.get(LIVE_TEAMS_MEMBER_NAME_ROUTE), remove: handlers.get(LIVE_TEAMS_MEMBER_REMOVE_ROUTE), tasks: handlers.get(LIVE_TEAMS_TASKS_ROUTE), task: handlers.get(LIVE_TEAMS_TASK_ROUTE), accept: handlers.get(LIVE_TEAMS_TASK_ACCEPT_ROUTE), revise: handlers.get(LIVE_TEAMS_TASK_REVISE_ROUTE), rotation: handlers.get(LIVE_TEAMS_TEAM_ROTATION_ROUTE), unregister: dispose }
}

// The panel's own request: same-origin evidence, so the mutation is attributed to the human. A
// request without `origin` is now recorded as `local:unverified` — see `actorOf`.
const mutationHeaders = { host: '127.0.0.1:43120', origin: 'http://127.0.0.1:43120', 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' }
const plainHeaders = { host: '127.0.0.1:43120', 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' }

const authorized = { method: 'GET', headers: { host: '127.0.0.1:43120', 'sec-fetch-site': 'same-origin' }, socket: { remoteAddress: '127.0.0.1' } }

describe('B23 task routes', () => {
  it('repairs only one explicit verdict handoff without repeating review or acceptance', async () => {
    const requestReviewNotification = vi.fn(async () => [{ recipient: 'lead', purpose: 'review-verdict', state: 'queued', messageId: 'm1', requestId: 'q1' }])
    const routes = routeOf(async () => baseState, undefined, { taskStore: { requestReviewNotification } as unknown as TaskStore })
    for (const [body, status] of [[{ taskId: 't1', sessionId: 's-live' }, 400], [{ taskId: 't1', roundId: 'r1', sessionId: 's-live' }, 200]] as const) {
      const reply = response(); await routes.notifyReview!({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify(body) }, reply)
      expect(reply.statusCode).toBe(status)
    }
    expect(requestReviewNotification).toHaveBeenCalledExactlyOnceWith('t1', 'r1', 'human:desktop')
    const reply = response(); await routes.notifyReview!({ method: 'POST', headers: { ...mutationHeaders, origin: 'http://foreign.test', 'sec-fetch-site': 'cross-site' }, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify({ taskId: 't1', roundId: 'r1', sessionId: 's-live' }) }, reply)
    expect(reply.statusCode).toBe(403); expect(requestReviewNotification).toHaveBeenCalledOnce()
  })
  it('requests one exact saved submission handoff through the existing human authority fence', async () => {
    const requestSubmissionNotification = vi.fn(async () => [{ recipient: 'lead', purpose: 'lead-acceptance', state: 'queued', messageId: 'm1', requestId: 'q1' }])
    const routes = routeOf(async () => baseState, undefined, { taskStore: { requestSubmissionNotification } as unknown as TaskStore })
    const reply = response()
    await routes.notifySubmission!({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify({ taskId: 't1', submissionId: 'sub1', sessionId: 's-live' }) }, reply)
    expect(reply.statusCode).toBe(200)
    expect(requestSubmissionNotification).toHaveBeenCalledWith('t1', 'sub1', 'human:desktop')
    expect(JSON.parse(reply.body!)).toMatchObject({ notifications: [{ state: 'queued', requestId: 'q1' }] })
  })
  it('rejects repair without an exact submission or from a foreign origin', async () => {
    const requestSubmissionNotification = vi.fn()
    const routes = routeOf(async () => baseState, undefined, { taskStore: { requestSubmissionNotification } as unknown as TaskStore })
    for (const [headers, body, status] of [[mutationHeaders, { taskId: 't1', sessionId: 's-live' }, 400], [{ ...mutationHeaders, origin: 'http://foreign.test', 'sec-fetch-site': 'cross-site' }, { taskId: 't1', submissionId: 'sub1', sessionId: 's-live' }, 403]] as const) {
      const reply = response(); await routes.notifySubmission!({ method: 'POST', headers, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify(body) }, reply)
      expect(reply.statusCode).toBe(status)
    }
    expect(requestSubmissionNotification).not.toHaveBeenCalled()
  })
  const task: TeamTask = { id: 'task-1', teamId: 'team-1', title: 'Task one', kind: 'implementation', status: 'waiting', assignee: 'z-live', route: { type: 'report', to: 'human' }, acceptance: ['done'], roundLimit: 5, createdBy: 'z-live', createdAt: 1, updatedAt: 2, revision: 1 }
  const detail: ReadTaskResult = { task, document: '# Task one', submissions: [{ id: 'submission-1', taskId: 'task-1', attemptId: 'attempt-1', attemptGeneration: 1, artifact: { type: 'report', bodyRef: 'report.md', bodyDigest: 'digest' }, summary: 'done', checks: [], createdAt: 2, revision: 1 }], rounds: [{ id: 'round-1', taskId: 'task-1', submissionId: 'submission-1', reviewerMemberId: 'm-dead', round: 1, verdict: 'pass', evidence: [{ command: 'test', status: 'passed' }], findings: [], createdAt: 3, revision: 1 }], attempts: [{ id: 'attempt-1', taskId: 'task-1', memberId: 'z-live', sessionId: 's-live', bindingGeneration: 0, generation: 1, status: 'active', startedAt: 1, revision: 1 }] }
  function taskStore(overrides: Partial<TaskStore> = {}): TaskStore {
    return { listTasks: vi.fn(async () => [task]), readTask: vi.fn(async () => detail), acceptTask: vi.fn(async (request) => { expect(request.actor).toBe('human:desktop'); return { task: { ...task, status: 'completed' }, archivedPath: '/archive/task-1.md' } }), reviseTask: vi.fn(async (request) => { expect(request.actor).toBe('human:desktop'); return { task: { ...task, status: 'in_progress' } } }), ...overrides } as unknown as TaskStore
  }
  it('shows return execution uncertainty separately from confirmed Session input in the journal', async () => {
    const events = [{ kind: 'review/returned', taskId: 'task-1', actor: 'scheduler', state: 'unconfirmed', reason: 'execution-not-yet-observed', at: 1 }, { kind: 'review/returned', taskId: 'task-1', actor: 'scheduler', state: 'started', requestId: 'req1', turn: 2, inputSeq: 3, at: 2 }]
    const route = routeOf(async () => baseState, { get: () => undefined }, { readEvents: async () => ({ events, torn: null }) })
    const result = response(); await route.journal?.({ ...authorized, url: `${LIVE_TEAMS_JOURNAL_ROUTE}?session=s-live` }, result)
    const body = JSON.parse(result.body ?? '{}')
    expect(body.entries[0].summary).toContain('Session launch confirmed')
    expect(body.entries[1].summary).toContain('launch unconfirmed')
    expect(body.entries[0].fields).toContainEqual({ label: 'Return state', value: 'started' })
  })
  it('projects a bounded newest-first journal with categories, actor names and torn-tail tolerance', async () => {
    const events = [
      { kind: 'task/created', id: 'task-1', taskId: 'task-1', title: 'Build report', actor: 'z-live', at: 1 },
      { kind: 'message/sent', messageId: 'message-1', actor: 'human:desktop', to: 'z-live', content: 'hello', at: 2 },
      { kind: 'review/round', taskId: 'task-1', round: 2, verdict: 'pass', evidence: [{ command: 'test', status: 'passed' }], actor: 'z-live', at: 3 },
      { kind: 'future/event', actor: 'scheduler', at: 4 },
    ]
    const route = routeOf(async () => baseState, { get: () => undefined }, { readEvents: async () => ({ events, torn: '{torn' }) })
    const result = response(); await route.journal?.({ ...authorized, url: `${LIVE_TEAMS_JOURNAL_ROUTE}?session=s-live&limit=2` }, result)
    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body ?? '{}')
    expect(body.entries).toHaveLength(2)
    expect(body.entries.map((entry: { kind: string }) => entry.kind)).toEqual(['future/event', 'review/round'])
    expect(body.entries[0]).toMatchObject({ category: 'other', actorName: 'scheduler', summary: expect.stringContaining('future/event') })
    expect(body.entries[1]).toMatchObject({ category: 'review', actorName: 'Zed', refs: { taskId: 'task-1', taskTitle: 'Build report', round: 2 } })
  })

  /**
   * A delivery row is plumbing, but it still has to answer "whose message, and to whom". The
   * recipient is in the event; the sender is on the message, which the route reads for exactly this.
   */
  it('names the sender and the recipient in a delivery row, and keeps the ids for the unfolded view', async () => {
    const events = [
      { kind: 'message/sent', messageId: 'message-1', actor: 'm-dead', from: 'm-dead', to: 'z-live', messageKind: 'comment', at: 1 },
      { kind: 'delivery/leased', deliveryId: 'delivery-1', messageId: 'message-1', recipient: 'z-live', at: 2 },
    ]
    const mailbox = {
      listMessages: async () => [{ id: 'message-1', teamId: 'team-1', from: 'm-dead', to: 'z-live', kind: 'comment', content: 'the body', createdAt: 1 }],
      listDeliveries: async () => [],
    } as unknown as import('./mailbox.js').MailboxService
    const route = routeOf(async () => baseState, { get: () => undefined }, { readEvents: async () => ({ events, torn: null }), mailbox })
    const result = response(); await route.journal?.({ ...authorized, url: `${LIVE_TEAMS_JOURNAL_ROUTE}?session=s-live&limit=5` }, result)
    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body ?? '{}')
    const delivery = body.entries.find((entry: { kind: string }) => entry.kind === 'delivery/leased')
    expect(delivery.summary).toBe('Zed picked up a message from Mina')
    expect(delivery.summary).not.toContain('message-1')
    expect(delivery.summaryParts.filter((part: { strong?: boolean }) => part.strong === true).map((part: { text: string }) => part.text)).toEqual(['Zed', 'Mina'])
    expect(delivery.fields).toEqual(expect.arrayContaining([expect.objectContaining({ label: 'Message from' }), expect.objectContaining({ label: 'Recipient' }), expect.objectContaining({ label: 'Message' })]))
    const sent = body.entries.find((entry: { kind: string }) => entry.kind === 'message/sent')
    expect(sent.detail).toBe('the body')
  })

  /**
   * The panel, the injected context and the mailbox answer one question — who may this member
   * address — and they had three copies of the answer. The panel's was the narrowest: it showed the
   * lead "contact with colleagues is not allowed" while the mailbox was delivering the lead's
   * messages to all of them.
   */
  it('shows the lead every member, and a builder the lead, from one rule', () => {
    const tasks = [{ ...task, id: 'task-1', title: 'Routed', status: 'ready' as const, assignee: 'z-live', route: { type: 'review' as const, reviewer: 'm-dead' } }]
    const leadState = { ...baseState, leadMemberId: 'z-live' }
    const lead = projectLiveTeamsSnapshot(leadState, { teamId: 'team-1', workspacePath }, tasks)
    const leadRow = lead.members.find((member) => member.memberId === 'z-live')
    // The lead may address every other member: the panel said the opposite while the mailbox was
    // delivering exactly those messages.
    expect(leadRow?.permittedContacts).toEqual(expect.arrayContaining(['Ada', 'Mina', 'team', 'human']))

    // A member that is not the lead gets the lead, and whoever a route opens. The reviewer holds the
    // path to a task it is not the assignee of, so the panel and the mailbox must both see it.
    const forReviewer = permittedContacts(leadState, 'm-dead', tasks)
    expect(forReviewer).toContain('z-live')
    const reviewerRow = lead.members.find((member) => member.memberId === 'm-dead')
    expect(reviewerRow?.permittedContacts).toContain('Zed')
    // Same rule, same answer: the panel's list is the mailbox's list, by construction.
    expect(permittedContacts(leadState, 'z-live', tasks)).toEqual(expect.arrayContaining(['a-unbound', 'm-dead']))
  })

  /**
   * A `ready` task that is blocked must never look identical to a claimable one:
   * that difference is the whole point of B26, and it must survive projection.
   */
  it('reports the unfinished dependencies of every listed task, and only those', async () => {
    const dependency: TeamTask = { ...task, id: 'task-1', title: 'Publish the schema', status: 'waiting' }
    const finished: TeamTask = { ...task, id: 'task-9', title: 'Finished dependency', status: 'completed' }
    const blocked: TeamTask = { ...task, id: 'task-2', title: 'Build on the schema', status: 'ready', dependsOn: ['task-1'] }
    const satisfied: TeamTask = { ...task, id: 'task-3', title: 'Already satisfied', status: 'ready', dependsOn: ['task-9'] }
    const dangling: TeamTask = { ...task, id: 'task-4', title: 'Names a task that is gone', status: 'ready', dependsOn: ['task-missing'] }
    const store = taskStore({ listTasks: vi.fn(async () => [dependency, finished, blocked, satisfied, dangling]) })
    const route = routeOf(async () => baseState, { get: () => undefined }, { taskStore: store })
    const result = response()
    await route.tasks?.({ ...authorized, url: `${LIVE_TEAMS_TASKS_ROUTE}?session=s-live` }, result)
    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body ?? '{}') as { tasks: Array<{ id: string; dependsOn?: string[]; blockedBy?: Array<{ id: string; title: string; status: string }> }> }
    const byId = new Map(body.tasks.map((entry) => [entry.id, entry]))
    expect(byId.get('task-2')).toMatchObject({ dependsOn: ['task-1'], blockedBy: [{ id: 'task-1', title: 'Publish the schema', status: 'waiting' }] })
    // A completed dependency is not a blocker, and a task with no dependencies
    // omits both fields rather than reporting empty lists.
    expect(byId.get('task-3')?.dependsOn).toEqual(['task-9'])
    expect(byId.get('task-3')?.blockedBy).toBeUndefined()
    expect(byId.get('task-1')?.dependsOn).toBeUndefined()
    expect(byId.get('task-1')?.blockedBy).toBeUndefined()
    // A stored reference to a task that is gone can never be satisfied, so it is
    // reported as blocking rather than silently ignored.
    expect(byId.get('task-4')?.blockedBy).toEqual([{ id: 'task-missing', title: 'task-missing', status: 'failed' }])
  })

  it('does not duplicate the direction already delivered by the task store', async () => {
    const sendFromScheduler = vi.fn(async () => undefined)
    const store = taskStore({ reviseTask: async () => {
      await sendFromScheduler()
      return { task: { ...task, status: 'in_progress' } }
    } })
    const route = routeOf(async () => baseState, { get: () => undefined }, { taskStore: store, mailbox: { sendFromScheduler } as unknown as import('./mailbox.js').MailboxService })
    const result = response()
    await route.revise?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify({ sessionId: 's-live', taskId: 'task-1', instructions: 'fix it' }) }, result)
    expect(result.statusCode).toBe(200)
    expect(sendFromScheduler).toHaveBeenCalledTimes(1)
  })

  it('lists, reads, accepts and revises through the existing task store with the human actor', async () => {
    const store = taskStore()
    const route = routeOf(async () => baseState, { get: () => undefined }, { taskStore: store })
    const list = response(); await route.tasks?.({ ...authorized, url: '/api/live-teams/tasks?session=s-live' }, list)
    expect(list.statusCode).toBe(200); expect(JSON.parse(list.body ?? '{}').tasks[0]).toMatchObject({ title: 'Task one', status: 'waiting' })
    const read = response(); await route.task?.({ ...authorized, url: '/api/live-teams/task?session=s-live&taskId=task-1' }, read)
    expect(read.statusCode).toBe(200); expect(JSON.parse(read.body ?? '{}')).toMatchObject({ document: '# Task one', submissions: [{ id: 'submission-1' }], rounds: [{ verdict: 'pass', evidence: [{ command: 'test', status: 'passed' }] }] })
    const accept = response(); await route.accept?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify({ sessionId: 's-live', taskId: 'task-1' }) }, accept)
    expect(accept.statusCode).toBe(200)
    const revise = response(); await route.revise?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify({ sessionId: 's-live', taskId: 'task-1', instructions: 'fix it' }) }, revise)
    expect(revise.statusCode).toBe(200)
  })
  it('preserves a task refusal reason in the browser response', async () => {
    const reason = 'task cannot be accepted in status in_progress'
    const store = taskStore({ acceptTask: vi.fn(async () => { throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, reason) }) })
    const route = routeOf(async () => baseState, { get: () => undefined }, { taskStore: store })
    const result = response(); await route.accept?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify({ sessionId: 's-live', taskId: 'task-1' }) }, result)
    expect(result.statusCode).toBe(400); expect(JSON.parse(result.body ?? '{}')).toEqual({ error: reason })
  })
})

describe('live teams snapshot projection', () => {
  it('projects bound, unbound and not-live members in stable order', () => {
    const snapshot = projectLiveTeamsSnapshot(baseState, { teamId: 'team-1', workspacePath, agents: { get: (id) => id === 's-live' ? { status: 'running' } : undefined } })
    expect(snapshot.members.map((member) => member.memberId)).toEqual(['a-unbound', 'm-dead', 'z-live'])
    expect(snapshot.members[0]).toMatchObject({ sessionId: null, live: false, status: 'unknown' })
    expect(snapshot.members[1]).toMatchObject({ sessionId: 's-dead', live: false, status: 'unknown' })
    expect(snapshot.members[2]).toMatchObject({ sessionId: 's-live', live: true, status: 'running', bindingGeneration: 4, contractRevision: 7 })
  })

  it('does not leak extra member fields', () => {
    const state: TeamState = { ...baseState, members: [{ memberId: 'z-live', displayName: 'Zed', role: 'engineer', availability: 'available', sessionId: 's-live', bindingGeneration: 4, contractRevision: 7, secret: 'nope' }] }
    expect(projectLiveTeamsSnapshot(state, { teamId: 'team-1', workspacePath })).not.toHaveProperty('members[0].secret')
  })

  /**
   * The snapshot used to answer with the configured name while `/team` answered
   * with the persisted one, so the same team had two names and the client could
   * not strip the suffix its own titles carry. Captured live: `/team` said
   * `B1 Check` and `/members` said `live-teams-workspace`.
   */
  it('names the team exactly as the persisted state does', () => {
    const named: TeamState = { ...baseState, name: 'B1 Check' }
    expect(projectLiveTeamsSnapshot(named, { teamId: 'team-1', teamName: 'configured', workspacePath }).teamName).toBe('B1 Check')
    expect(projectLiveTeamsCandidates(named, [], { teamId: 'team-1', teamName: 'configured', workspacePath }).teamName).toBe('B1 Check')
  })

  it('falls back to the configured name, then the id, for a never-renamed team', () => {
    expect(projectLiveTeamsSnapshot(baseState, { teamId: 'team-1', teamName: 'configured', workspacePath }).teamName).toBe('configured')
    expect(projectLiveTeamsSnapshot(baseState, { teamId: 'team-1', workspacePath }).teamName).toBe('team-1')
  })
})

describe('live teams candidates', () => {
  it('filters by workspace, bound state and subagent ownership', () => {
    const descriptors = [
      { sessionId: 'z', cwd: '/workspace', title: undefined, live: false, status: 'unknown' as const, subagentOwned: false, workspaceId: undefined, seq: 0, agentPreset: undefined },
      { sessionId: 'a', cwd: '/workspace', title: 'Alpha', live: true, status: 'running' as const, subagentOwned: false, workspaceId: undefined, seq: 0, agentPreset: undefined },
      { sessionId: 'bound', cwd: '/workspace', title: undefined, live: false, status: 'unknown' as const, subagentOwned: false, workspaceId: undefined, seq: 0, agentPreset: undefined },
      { sessionId: 'foreign', cwd: '/other', title: undefined, live: false, status: 'unknown' as const, subagentOwned: false, workspaceId: undefined, seq: 0, agentPreset: undefined },
      { sessionId: 'child', cwd: '/workspace', title: undefined, live: false, status: 'unknown' as const, subagentOwned: true, workspaceId: undefined, seq: 0, agentPreset: undefined },
    ]
    const projected = projectLiveTeamsCandidates({ ...baseState, members: [{ ...baseState.members[0]!, sessionId: 'bound' }] }, descriptors, { teamId: 'team-1', workspacePath })
    expect(projected.candidates.map((candidate) => candidate.sessionId)).toEqual(['a', 'z'])
    expect(projected.candidates[0]).toMatchObject({ title: 'Alpha', cwd: '/workspace', live: true, status: 'running' })
  })

  it('never offers a blank Session, which DSH keeps out of the session list', () => {
    const descriptors = [
      { sessionId: 'placeholder', cwd: '/workspace', title: undefined, live: false, status: 'idle' as const, subagentOwned: false, workspaceId: undefined, seq: 0, agentPreset: undefined, blank: true },
      { sessionId: 'real', cwd: '/workspace', title: 'Builder - B1 Check', live: false, status: 'idle' as const, subagentOwned: false, workspaceId: undefined, seq: 12, agentPreset: undefined, blank: false },
      { sessionId: 'unreported', cwd: '/workspace', title: undefined, live: false, status: 'idle' as const, subagentOwned: false, workspaceId: undefined, seq: 3, agentPreset: undefined },
    ]
    const projected = projectLiveTeamsCandidates(baseState, descriptors, { teamId: 'team-1', workspacePath })
    expect(projected.candidates.map((candidate) => candidate.sessionId)).toEqual(['real', 'unreported'])
  })

  it('creates a member with generated id and audit before success', async () => {
    const audit: unknown[] = []
    const state = { ...baseState, revision: 4, members: [...baseState.members] }
    const route = routeOf(async () => state, { get: () => undefined }, {
      createMember: async (request) => {
        const memberId = request.memberId ?? 'm-generated'
        const member = { memberId, displayName: request.displayName, role: request.role, availability: 'available', sessionId: request.sessionId, bindingGeneration: 1, contractRevision: 0 }
        state.revision += 1
        state.members.push(member)
        return { state, member }
      },
      appendAudit: async (event) => { audit.push(event) },
    })
    const result = response()
    await route.handler({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify({ sessionId: 'new-session', displayName: '  New  ', role: ' reviewer ', expectedRevision: 4 }) }, result)
    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body ?? '{}') as { memberId?: string; member?: Record<string, unknown> }
    expect(body.memberId).toMatch(/^m-/u)
    expect(body.member).toMatchObject({ availability: 'available', bindingGeneration: 1, contractRevision: 0, displayName: 'New', role: 'reviewer' })
    expect(audit).toEqual([expect.objectContaining({ kind: 'member/added', memberId: body.memberId, sessionId: 'new-session', displayName: 'New', role: 'reviewer', expectedRevision: 4, appliedRevision: 5 })])
  })

  it('keeps the request scope apart from the Session that joins', async () => {
    // The regression the human hit: the scope and the joining Session both used to
    // travel as `sessionId`, so the caller's own Session was added instead — and
    // refused, because it was already a member.
    const scopeState = { ...baseState, revision: 4, members: [{ ...baseState.members[0]!, sessionId: 's-caller' }] }
    const createMember = vi.fn(async (request: LiveTeamsCreateMemberRequest) => {
      const member = { memberId: request.memberId ?? 'm-generated', displayName: request.displayName, role: request.role, availability: 'available' as const, sessionId: request.sessionId, bindingGeneration: 1, contractRevision: 0 }
      scopeState.revision += 1
      scopeState.members.push(member)
      return { state: scopeState, member }
    })
    const route = routeOf(async () => scopeState, { get: () => undefined }, { createMember, appendAudit: async () => {} })
    const result = response()
    await route.handler({
      method: 'POST',
      url: '/api/live-teams/members?session=s-caller',
      headers: mutationHeaders,
      socket: { remoteAddress: '127.0.0.1' },
      body: JSON.stringify({ sessionId: 's-newcomer', displayName: 'Newcomer', role: 'reviewer', expectedRevision: 4 }),
    }, result)
    expect(result.statusCode).toBe(200)
    expect(createMember).toHaveBeenCalledTimes(1)
    expect(createMember.mock.calls[0]?.[0]).toMatchObject({ sessionId: 's-newcomer', displayName: 'Newcomer' })
  })

  it('still reads the scope from the body when no query names it', async () => {
    const state = { ...baseState, revision: 4, members: [...baseState.members] }
    const createMember = vi.fn(async (request: LiveTeamsCreateMemberRequest) => {
      const member = { memberId: request.memberId ?? 'm-generated', displayName: request.displayName, role: request.role, availability: 'available' as const, sessionId: request.sessionId, bindingGeneration: 1, contractRevision: 0 }
      state.revision += 1
      state.members.push(member)
      return { state, member }
    })
    const route = routeOf(async () => state, { get: () => undefined }, { createMember, appendAudit: async () => {} })
    const result = response()
    await route.handler({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify({ sessionId: 'new-session', displayName: 'New', role: 'reviewer', expectedRevision: 4 }) }, result)
    expect(result.statusCode).toBe(200)
    expect(createMember).toHaveBeenCalledTimes(1)
  })

  it('records the Session title only when it actually changed', async () => {
    const audit: unknown[] = []
    const titledMember = { memberId: 'm-titled', displayName: 'New', role: 'reviewer', availability: 'available' as const, sessionId: 'new-session', bindingGeneration: 1, contractRevision: 0 }
    // The pre-check reads the state before the mutation; the mutation reports the
    // state after it, which is what the route projects the member out of.
    const before = { ...baseState, revision: 4, members: [...baseState.members] }
    const after = { ...baseState, revision: 5, members: [...baseState.members, titledMember] }
    const body = JSON.stringify({ sessionId: 'new-session', displayName: 'New', role: 'reviewer', expectedRevision: 4 })
    const options = (sessionTitle?: LiveTeamsCreateMemberResult['sessionTitle']) => ({
      createMember: async () => ({ state: after, member: titledMember, ...(sessionTitle === undefined ? {} : { sessionTitle }) }),
      appendAudit: async (event: unknown) => { audit.push(event) },
    })

    // A rename that happened is recorded after the membership record, with the previous title preserved.
    const renamed = routeOf(async () => before, { get: () => undefined }, options({ from: 'Old title', to: 'New - Team', reason: 'member-added', renamed: true }))
    const first = response()
    await renamed.handler({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body }, first)
    expect(first.statusCode).toBe(200)
    expect(audit.map((entry) => (entry as { kind?: string }).kind)).toEqual(['member/added', 'session/titled'])
    expect(audit[1]).toMatchObject({ kind: 'session/titled', sessionId: 'new-session', from: 'Old title', to: 'New - Team', reason: 'member-added' })

    // A title that already matched, or was never applied, produces no second record.
    for (const sessionTitle of [{ from: 'New - Team', to: 'New - Team', reason: 'member-added' as const, renamed: false }, undefined]) {
      audit.length = 0
      const quiet = routeOf(async () => before, { get: () => undefined }, options(sessionTitle))
      const result = response()
      await quiet.handler({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body }, result)
      expect(result.statusCode).toBe(200)
      expect(audit.map((entry) => (entry as { kind?: string }).kind)).toEqual(['member/added'])
    }
  })

  it('succeeds even when the Session title record cannot be appended', async () => {
    const titledMember = { memberId: 'm-titled', displayName: 'New', role: 'reviewer', availability: 'available' as const, sessionId: 'new-session', bindingGeneration: 1, contractRevision: 0 }
    const appended: string[] = []
    const route = routeOf(async () => ({ ...baseState, revision: 4, members: [...baseState.members] }), { get: () => undefined }, {
      createMember: async () => ({
        state: { ...baseState, revision: 5, members: [...baseState.members, titledMember] },
        member: titledMember,
        sessionTitle: { from: null, to: 'New - Team', reason: 'member-added' as const, renamed: true },
      }),
      appendAudit: async (event: unknown) => {
        const kind = (event as { kind?: string }).kind ?? 'unknown'
        appended.push(kind)
        // The membership record is mandatory; the title record is best effort.
        if (kind === 'session/titled') throw new Error('audit sink refused the title record')
      },
    })
    const result = response()
    await route.handler({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify({ sessionId: 'new-session', displayName: 'New', role: 'reviewer', expectedRevision: 4 }) }, result)
    expect(result.statusCode).toBe(200)
    expect(appended).toEqual(['member/added', 'session/titled'])
  })

  it('rejects invalid create fields and duplicate member/session', async () => {
    const createMember = vi.fn(async (request: LiveTeamsCreateMemberRequest) => ({ state: baseState, member: { memberId: request.memberId ?? 'generated', displayName: request.displayName, role: request.role, availability: 'available', sessionId: request.sessionId, bindingGeneration: 1, contractRevision: 0 } }))
    const route = routeOf(async () => baseState, { get: () => undefined }, { createMember, appendAudit: async () => {} })
    for (const fields of [{ displayName: '', role: 'x' }, { displayName: 'x'.repeat(65), role: 'x' }, { displayName: 'x', role: ' '.repeat(65) }]) {
      const result = response()
      await route.handler({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify({ sessionId: 'new', expectedRevision: 4, ...fields }) }, result)
      expect(result.statusCode).toBe(400)
    }
    const result = response()
    await route.handler({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify({ sessionId: 's-live', displayName: 'New', role: 'x', expectedRevision: 4 }) }, result)
    expect(result.statusCode).toBe(400)
    expect(createMember).not.toHaveBeenCalled()
  })

  it('creates a workspace Session member without prompt and keeps the frozen audit shape', async () => {
    const audit: unknown[] = []
    const createSessionMember = vi.fn(async (request: LiveTeamsCreateSessionMemberRequest) => {
      const member = { memberId: 'm-created', displayName: request.displayName, role: request.role, availability: 'available', sessionId: 'created-session', bindingGeneration: 1, contractRevision: 0 }
      return { state: { ...baseState, revision: 5, members: [...baseState.members, member] }, member }
    })
    const route = routeOf(async () => baseState, { get: () => undefined }, { createSessionMember, appendAudit: async (event) => { audit.push(event) } })
    const result = response()
    await route.createSession?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify({ displayName: '  New  ', role: ' reviewer ', expectedRevision: 4 }) }, result)
    expect(result.statusCode).toBe(200)
    expect(createSessionMember).toHaveBeenCalledWith(expect.objectContaining({ displayName: 'New', role: 'reviewer', expectedRevision: 4, sessionId: expect.stringMatching(/^session-/u) }))
    expect(audit).toEqual([expect.objectContaining({ kind: 'member/added', memberId: 'm-created', sessionId: 'created-session', displayName: 'New', role: 'reviewer', expectedRevision: 4, appliedRevision: 5 })])
  })

  it('returns 409 after one retry and checks authority before state', async () => {
    const readState = vi.fn(async () => baseState)
    let calls = 0
    const route = routeOf(readState, { get: () => undefined }, { createSessionMember: async () => { calls += 1; throw new LiveTeamsError(ERROR_CODES.REVISION_CONFLICT, 'conflict') }, appendAudit: async () => {} })
    const forbidden = response()
    await route.createSession?.({ method: 'POST', headers: { ...mutationHeaders, 'sec-fetch-site': 'cross-site' }, socket: { remoteAddress: '127.0.0.1' }, body: '{' }, forbidden)
    expect(forbidden.statusCode).toBe(403)
    expect(readState).not.toHaveBeenCalled()
    const conflict = response()
    await route.createSession?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify({ displayName: 'New', role: 'reviewer', expectedRevision: 4 }) }, conflict)
    expect(conflict.statusCode).toBe(409)
    expect(calls).toBe(2)
  })

  it('serves candidates and rejects unauthorized before reading state', async () => {
    const readState = vi.fn(async () => baseState)
    const descriptors = [{ sessionId: 's', cwd: workspacePath, title: undefined, live: false, status: 'unknown' as const, subagentOwned: false, workspaceId: undefined, seq: 0, agentPreset: undefined }]
    const route = routeOf(readState, { get: () => undefined }, { listCandidates: async () => descriptors })
    const candidatesHandler = route.candidates
    expect(candidatesHandler).toBeDefined()
    const result = response()
    await candidatesHandler?.(authorized, result)
    expect(result.statusCode).toBe(200)
    expect(JSON.parse(result.body ?? '{}')).toMatchObject({ teamId: 'team-1', candidates: [{ sessionId: 's', title: null }] })
    readState.mockClear()
    await candidatesHandler?.({ ...authorized, headers: { ...authorized.headers, 'sec-fetch-site': 'cross-site' } }, response())
    expect(readState).not.toHaveBeenCalled()
  })
})

describe('live teams route authority and failures', () => {
  it('rejects unauthorized requests before reading state', async () => {
    const readState = vi.fn(async () => baseState)
    const { handler } = routeOf(readState)
    const result = response()
    await handler({ ...authorized, headers: { ...authorized.headers, 'sec-fetch-site': 'cross-site' } }, result)
    expect(result.statusCode).toBe(403)
    expect(result.body).toBe(JSON.stringify({ error: 'live-teams request authority rejected' }))
    expect(readState).not.toHaveBeenCalled()
  })

  it('returns 405 before reading state for a valid authority', async () => {
    const readState = vi.fn(async () => baseState)
    const { handler } = routeOf(readState)
    const result = response()
    await handler({ ...authorized, method: 'PUT' }, result)
    expect(result.statusCode).toBe(405)
    expect(readState).not.toHaveBeenCalled()
  })

  it('returns 503 for unavailable state and 200 for empty state', async () => {
    const unavailable = routeOf(async () => { throw new Error('missing') })
    const failed = response()
    await unavailable.handler(authorized, failed)
    expect(failed.statusCode).toBe(503)
    const empty = routeOf(async () => ({ ...baseState, members: [] }))
    const success = response()
    await empty.handler(authorized, success)
    expect(success.statusCode).toBe(200)
    expect(JSON.parse(success.body ?? '{}').members).toEqual([])
  })

  it('sets the frozen response headers and disposer is idempotent', async () => {
    const { handler } = routeOf(async () => baseState)
    const result = response()
    await handler(authorized, result)
    expect(result.headers).toEqual({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' })
    const other = routeOf(async () => baseState)
    other.unregister()
    other.unregister()
  })

  it('mirrors community-market authority signals', () => {
    expect(liveTeamsRequestAllowed({ remoteAddress: '127.0.0.8', host: '127.0.0.1:43120', expectedPort: 43120 })).toBe(true)
    expect(liveTeamsRequestAllowed({ remoteAddress: '::1', host: '127.0.0.1:43120', expectedPort: 43120, secFetchSite: 'cross-site' })).toBe(false)
    expect(liveTeamsRequestAllowed({ remoteAddress: '192.168.1.5', host: '127.0.0.1:43120', expectedPort: 43120 })).toBe(false)
    expect(liveTeamsRequestAllowed({ remoteAddress: '127.0.0.1', host: 'localhost:43120', expectedPort: 43120 })).toBe(false)
  })
})

describe('live teams mutations', () => {
  function mutatingRoute(state: TeamState = baseState, mutate: (request: LiveTeamsMutation) => Promise<LiveTeamsMutationResult> = async (request) => {
    const member = state.members.find((entry) => entry.memberId === request.memberId)
    if (member === undefined) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'missing')
    const from = request.kind === 'role' ? member.role : request.kind === 'availability' ? member.availability : member.displayName
    const updated = { ...member, ...(request.kind === 'role' ? { role: request.value } : request.kind === 'availability' ? { availability: request.value } : { displayName: request.value }) }
    state = { ...state, revision: state.revision + 1, members: state.members.map((entry) => entry.memberId === member.memberId ? updated : entry) }
    return { state, member: updated, from, to: request.value }
  }) {
    return routeOf(async () => state, { get: () => undefined }, { applyMutation: mutate, appendAudit: async () => {} })
  }

  it('applies role and availability with frozen success shape', async () => {
    const route = mutatingRoute()
    const role = response()
    await route.role?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify({ memberId: 'z-live', role: '  architect  ', expectedRevision: 4 }) }, role)
    expect(role.statusCode).toBe(200)
    expect(JSON.parse(role.body ?? '{}')).toMatchObject({ memberId: 'z-live', revision: 5, applied: true, retried: false, member: { role: 'architect' } })
    const availability = response()
    await route.availability?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify({ memberId: 'z-live', availability: 'paused', expectedRevision: 5 }) }, availability)
    expect(availability.statusCode).toBe(200)
    expect(JSON.parse(availability.body ?? '{}').member.availability).toBe('paused')
  })

  it('rejects invalid values, unknown members and malformed bodies', async () => {
    const route = mutatingRoute()
    for (const body of [
      { memberId: 'z-live', role: 'x'.repeat(65), expectedRevision: 4 },
      { memberId: 'z-live', availability: 'PAUSED', expectedRevision: 4 },
      { memberId: 'missing', role: 'engineer', expectedRevision: 4 },
    ]) {
      const result = response()
      await (body.availability === undefined ? route.role : route.availability)?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify(body) }, result)
      expect(result.statusCode).toBe(400)
    }
    const malformed = response()
    await route.role?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: '{' }, malformed)
    expect(malformed.statusCode).toBe(400)
  })

  it('renames a member with trimmed validation and audit shape', async () => {
    const audit: unknown[] = []
    const route = routeOf(async () => baseState, { get: () => undefined }, { applyMutation: async (request) => {
      const member = baseState.members.find((entry) => entry.memberId === request.memberId)
      if (member === undefined) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'missing')
      const updated = { ...member, displayName: request.value }
      return { state: { ...baseState, revision: baseState.revision + 1, members: [updated, ...baseState.members.filter((entry) => entry.memberId !== member.memberId)] }, member: updated, from: member.displayName, to: request.value }
    }, appendAudit: async (event) => { audit.push(event) } })
    const result = response()
    await route.name?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify({ memberId: 'z-live', displayName: '  Reviewer One  ', expectedRevision: 4 }) }, result)
    expect(result.statusCode).toBe(200)
    expect(JSON.parse(result.body ?? '{}')).toMatchObject({ memberId: 'z-live', revision: 5, member: { displayName: 'Reviewer One' } })
    expect(audit).toEqual([expect.objectContaining({ kind: 'member/name-changed', memberId: 'z-live', from: 'Zed', to: 'Reviewer One', actor: 'human:desktop', expectedRevision: 4, appliedRevision: 5 })])
    for (const displayName of ['', '   ', 'x'.repeat(65)]) {
      const invalid = response()
      await route.name?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify({ memberId: 'z-live', displayName, expectedRevision: 4 }) }, invalid)
      expect(invalid.statusCode).toBe(400)
    }
    const unknown = response()
    await route.name?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify({ memberId: 'missing', displayName: 'New', expectedRevision: 4 }) }, unknown)
    expect(unknown.statusCode).toBe(400)
  })

  it('removes only membership, archives id, and writes the frozen audit record', async () => {
    const audit: unknown[] = []
    const state: TeamState = { ...baseState, members: [...baseState.members], archivedMemberIds: [] }
    const route = routeOf(async () => state, { get: () => undefined }, {
      removeMember: async (request) => {
        const index = state.members.findIndex((entry) => entry.memberId === request.memberId)
        if (index < 0 || state.archivedMemberIds.includes(request.memberId)) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'missing')
        if (request.expectedRevision !== state.revision) throw new LiveTeamsError(ERROR_CODES.REVISION_CONFLICT, 'conflict')
        const removed = state.members.splice(index, 1)[0]
        if (removed === undefined) throw new Error('missing')
        state.archivedMemberIds.push(request.memberId)
        state.revision += 1
        return { state, removed }
      },
      appendAudit: async (event) => { audit.push(event) },
    })
    const result = response()
    await route.remove?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify({ memberId: 'm-dead', expectedRevision: 4 }) }, result)
    expect(result.statusCode).toBe(200)
    expect(state.members.map((entry) => entry.memberId)).toEqual(['z-live', 'a-unbound'])
    expect(state.archivedMemberIds).toEqual(['m-dead'])
    expect(audit).toEqual([expect.objectContaining({ kind: 'member/removed', memberId: 'm-dead', displayName: 'Mina', role: 'reviewer', sessionId: 's-dead', expectedRevision: 4, appliedRevision: 5 })])
    expect(JSON.parse(result.body ?? '{}')).toMatchObject({ teamId: 'team-1', memberId: 'm-dead', revision: 5, applied: true, retried: false, removed: { memberId: 'm-dead', displayName: 'Mina', role: 'reviewer', sessionId: 's-dead' } })
    const again = response()
    await route.remove?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify({ memberId: 'm-dead', expectedRevision: 5 }) }, again)
    expect(again.statusCode).toBe(400)
  })

  it('rejects unknown member, unauthorized requests before state, and retries exactly once before 409', async () => {
    const readState = vi.fn(async () => baseState)
    let calls = 0
    const route = routeOf(readState, { get: () => undefined }, {
      removeMember: async () => { calls += 1; throw new LiveTeamsError(ERROR_CODES.REVISION_CONFLICT, 'conflict') },
      appendAudit: async () => {},
    })
    const unknown = response()
    await route.remove?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify({ memberId: 'missing', expectedRevision: 4 }) }, unknown)
    expect(unknown.statusCode).toBe(400)
    const forbidden = response()
    await route.remove?.({ method: 'POST', headers: { ...mutationHeaders, 'sec-fetch-site': 'cross-site' }, socket: { remoteAddress: '127.0.0.1' }, body: '{' }, forbidden)
    expect(forbidden.statusCode).toBe(403)
    expect(readState).toHaveBeenCalledTimes(1)
    const conflict = response()
    await route.remove?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify({ memberId: 'z-live', expectedRevision: 4 }) }, conflict)
    expect(conflict.statusCode).toBe(409)
    expect(calls).toBe(2)
    expect(JSON.parse(conflict.body ?? '{}')).toMatchObject({ error: 'live-teams revision conflict', revision: 4, members: expect.any(Array) })
  })

  it('rejects authority before body or state and retries once then returns 409', async () => {
    const readState = vi.fn(async () => baseState)
    let calls = 0
    const route = routeOf(readState, { get: () => undefined }, { applyMutation: async () => { calls += 1; throw new LiveTeamsError(ERROR_CODES.REVISION_CONFLICT, 'conflict') }, appendAudit: async () => {} })
    const forbidden = response()
    await route.role?.({ method: 'POST', headers: { ...mutationHeaders, 'sec-fetch-site': 'cross-site' }, socket: { remoteAddress: '127.0.0.1' }, body: '{' }, forbidden)
    expect(forbidden.statusCode).toBe(403)
    expect(readState).not.toHaveBeenCalled()
    const conflict = response()
    await route.role?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify({ memberId: 'z-live', role: 'engineer', expectedRevision: 4 }) }, conflict)
    expect(conflict.statusCode).toBe(409)
    expect(calls).toBe(2)
    expect(JSON.parse(conflict.body ?? '{}')).toMatchObject({ revision: 4, members: expect.any(Array) })
  })
})

describe('human task control', () => {
  it('creates, updates and releases through the same operations the lead uses', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'live-teams-control-'))
    try {
      const team = new TeamStore({ workspacePath: workspace, workspaceId: 'ws', teamId: 'team-1' })
      await team.open(); const opened = await team.open()
      await team.commit('team-1', { expectedRevision: opened.revision, mutate: (state) => {
        state.leadMemberId = 'm-lead'
        state.members.push({ memberId: 'm-lead', displayName: 'Lead', role: 'lead', availability: 'available', bindingGeneration: 1, contractRevision: 0 })
        state.members.push({ memberId: 'm-worker', displayName: 'Worker', role: 'builder', availability: 'available', sessionId: 's-worker', bindingGeneration: 1, contractRevision: 0 })
      } })
      const store = createTaskStore({ workspacePath: workspace, teamId: 'team-1', appendAudit: async () => undefined })
      const route = routeOf(async () => await team.open(), { get: () => undefined }, { taskStore: store })
      const call = async (path: string, body: Record<string, unknown>): Promise<{ status: number; body: Record<string, unknown> }> => {
        const result = response()
        const handler = path === 'create' ? route.taskCreate : path === 'update' ? route.taskUpdate : route.taskRevoke
        await handler?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify(body) }, result)
        return { status: result.statusCode, body: JSON.parse(result.body ?? '{}') as Record<string, unknown> }
      }

      const created = await call('create', { title: 'From the panel', kind: 'implementation', assignee: 'm-worker', acceptance: ['works'], paths: ['packages/a/**'], route: { type: 'report', to: 'human' } })
      expect(created.status).toBe(200)
      const taskId = (created.body.task as { id: string }).id

      const updated = await call('update', { taskId, acceptance: ['works differently'] })
      expect(updated.status).toBe(200)
      expect((updated.body.task as { acceptance: string[] }).acceptance).toEqual(['works differently'])

      // A reason is part of the decision, not an optional note.
      expect((await call('revoke', { taskId })).status).toBe(400)

      const claimed = await store.claimTask({ taskId, memberId: 'm-worker', sessionId: 's-worker', bindingGeneration: 1 })
      const revoked = await call('revoke', { taskId, reason: 'the human stopped it' })
      expect(revoked.status).toBe(200)
      expect((await store.readAttempts()).attempts.find((entry) => entry.id === claimed.attempt.id)?.status).not.toBe('active')
      // A clean release returns the task to `ready`; when the member's Session cannot be confirmed
      // stopped, the store asks for a human instead of guessing. Both mean the attempt is gone.
      expect(['ready', 'needs_human']).toContain((await store.readTask(taskId)).task.status)
    } finally { await rm(workspace, { recursive: true, force: true }) }
  })
})

describe('mutation attribution', () => {
  it('tells a browser request from a local one instead of calling both the human', async () => {
    const audit: unknown[] = []
    const route = routeOf(async () => baseState, { get: () => ({ status: 'running' }) }, { interrupt: async () => ({ accepted: true as const }), appendAudit: async (event) => { audit.push(event) } })
    const asBrowser = response()
    await route.interrupt?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify({ memberId: 'z-live', sessionId: 'caller' }) }, asBrowser)
    expect(audit[0]).toMatchObject({ kind: 'member/interrupted', actor: 'human:desktop' })
    // The same call from a local process that did not come from the panel's page: allowed by the
    // fence, but the journal must not claim a person did it.
    const asLocal = response()
    await route.interrupt?.({ method: 'POST', headers: plainHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify({ memberId: 'z-live', sessionId: 'caller' }) }, asLocal)
    expect(audit[1]).toMatchObject({ kind: 'member/interrupted', actor: 'local:unverified' })
  })
})

describe('member interrupt route', () => {
  function interruptState(memberId = 'z-live', sessionId: string | undefined = 's-live'): TeamState {
    const source = baseState.members.find((entry) => entry.memberId === memberId) ?? baseState.members[0]!
    const { sessionId: _sessionId, ...withoutSession } = source
    return { ...baseState, revision: 4, members: [{ ...withoutSession, ...(sessionId === undefined || sessionId.length === 0 ? {} : { sessionId }) }] }
  }

  it('interrupts a running member exactly once and returns the re-read status', async () => {
    const audit: unknown[] = []
    let status: 'idle' | 'running' = 'running'
    const cancel = vi.fn(async (_sessionId: string) => { status = 'idle' })
    const route = routeOf(async () => interruptState(), { get: () => ({ get status() { return status } }) }, { interrupt: async (sessionId) => { await cancel(sessionId); return { accepted: true as const }; }, appendAudit: async (event) => { audit.push(event) } })
    const result = response()
    await route.interrupt?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify({ memberId: 'z-live', sessionId: 'caller' }) }, result)
    expect(result.statusCode).toBe(200)
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(cancel).toHaveBeenCalledWith('s-live')
    expect(JSON.parse(result.body ?? '{}')).toMatchObject({ memberId: 'z-live', interrupted: true, status: 'idle' })
    expect(audit).toEqual([expect.objectContaining({ kind: 'member/interrupted', memberId: 'z-live', sessionId: 's-live', actor: 'human:desktop' })])
  })

  it('refuses an idle member without cancelling, and records the refusal (F18)', async () => {
    const cancel = vi.fn(async () => {})
    const audit: unknown[] = []
    const route = routeOf(async () => interruptState('z-live', 's-idle'), { get: () => ({ status: 'idle' }) }, { interrupt: async () => { await cancel(); return { accepted: true as const } }, appendAudit: async (event) => { audit.push(event) } })
    const result = response()
    await route.interrupt?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify({ memberId: 'z-live', sessionId: 'caller' }) }, result)
    expect(result.statusCode).toBe(409)
    expect(JSON.parse(result.body ?? '{}')).toEqual({ error: 'live-teams member has no running turn' })
    expect(cancel).not.toHaveBeenCalled()
    // The pressure to interrupt came from a human who then saw nothing happen: the refusal
    // is the only place that can explain it afterwards.
    expect(audit).toEqual([expect.objectContaining({ kind: 'member/interrupt-refused', memberId: 'z-live', sessionId: 's-idle', reason: 'idle (idle)', actor: 'human:desktop' })])
  })

  it('records a refusal for an unbound member too (F18)', async () => {
    const audit: unknown[] = []
    const route = routeOf(async () => interruptState('z-live', ''), { get: () => ({ status: 'running' }) }, { interrupt: async () => ({ accepted: true as const }), appendAudit: async (event) => { audit.push(event) } })
    const result = response()
    await route.interrupt?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify({ memberId: 'z-live', sessionId: 'caller' }) }, result)
    expect(result.statusCode).toBe(409)
    expect(audit).toEqual([expect.objectContaining({ kind: 'member/interrupt-refused', memberId: 'z-live', reason: 'no-session' })])
  })

  it('refuses an already-finished turn without cancelling', async () => {
    const cancel = vi.fn(async () => {})
    const route = routeOf(async () => interruptState('m-dead', 's-finished'), { get: () => ({ status: 'unknown' }) }, { interrupt: async () => { await cancel(); return { accepted: true as const } }, appendAudit: async () => {} })
    const result = response()
    await route.interrupt?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify({ memberId: 'm-dead', sessionId: 'caller' }) }, result)
    expect(result.statusCode).toBe(409)
    expect(JSON.parse(result.body ?? '{}')).toEqual({ error: 'live-teams member has no running turn' })
    expect(cancel).not.toHaveBeenCalled()
  })

  it('refuses an unbound member without cancelling', async () => {
    const cancel = vi.fn(async () => {})
    const route = routeOf(async () => interruptState('z-live', ''), { get: () => ({ status: 'running' }) }, { interrupt: async () => { await cancel(); return { accepted: true as const } }, appendAudit: async () => {} })
    const result = response()
    await route.interrupt?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify({ memberId: 'z-live', sessionId: 'caller' }) }, result)
    expect(result.statusCode).toBe(409)
    expect(cancel).not.toHaveBeenCalled()
  })

  it('changes no team state, availability, membership, revision or binding', async () => {
    const state = interruptState()
    const before = JSON.parse(JSON.stringify(state)) as TeamState
    const cancel = vi.fn(async () => {})
    const route = routeOf(async () => state, { get: () => ({ status: 'running' }) }, { interrupt: async () => { await cancel(); return { accepted: true as const } }, appendAudit: async () => {} })
    const result = response()
    await route.interrupt?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify({ memberId: 'z-live', sessionId: 'caller' }) }, result)
    expect(result.statusCode).toBe(200)
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(state).toEqual(before)
  })

  it('rejects a foreign member id with no audit', async () => {
    const audit = vi.fn(async () => {})
    const cancel = vi.fn(async () => {})
    const route = routeOf(async () => interruptState(), { get: () => ({ status: 'running' }) }, { interrupt: async () => { await cancel(); return { accepted: true as const } }, appendAudit: audit })
    const result = response()
    await route.interrupt?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify({ memberId: 'foreign', sessionId: 'caller' }) }, result)
    expect(result.statusCode).toBe(400)
    expect(cancel).not.toHaveBeenCalled()
    expect(audit).not.toHaveBeenCalled()
  })
})

describe('human mailbox routes', () => {
  const humanMessage = (overrides: Record<string, unknown> = {}) => JSON.stringify({ sessionId: 's-1', to: 'z-live', kind: 'comment', content: 'hello', ...overrides })

  async function mailboxHarness(recipients: readonly import('./mailbox.js').MailboxRecipient[] = [
    { memberId: 'z-live', sessionId: 's-live', bindingGeneration: 4, active: true, displayName: 'Zed' },
    { memberId: 'a-unbound', sessionId: 's-1', bindingGeneration: 1, active: true, displayName: 'Ada' },
  ]) {
    const { createMailbox } = await import('./mailbox.js')
    const { mkdtemp } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const workspacePath = await mkdtemp(join(tmpdir(), 'live-teams-messages-'))
    const commands = new Map<string, import('./mailbox.js').CommandQueueRecord>()
    const mailbox = createMailbox({
      workspacePath,
      teamId: 'team-1',
      autoDeliver: false,
      listRecipients: async () => recipients,
      resolveSessionSender: (sessionId) => recipients.find((recipient) => recipient.sessionId === sessionId)?.memberId,
      queue: {
        admit: async (request) => {
          const existing = commands.get(request.idempotencyKey)
          if (existing !== undefined) return { record: existing, duplicate: true }
          const record: import('./mailbox.js').CommandQueueRecord = { commandId: `c-${commands.size + 1}`, ...request, requestId: `team-1:${request.idempotencyKey}`, state: 'admitted', receipt: 'accepted', failureCode: undefined, failureDetail: undefined, revision: 1 }
          commands.set(request.idempotencyKey, record)
          return { record, duplicate: false }
        },
        dispatch: async (commandId) => {
          const found = [...commands.values()].find((entry) => entry.commandId === commandId)
          if (found === undefined) throw new Error('missing command')
          return found
        },
      },
    })
    const audit: unknown[] = []
    const route = routeOf(async () => baseState, { get: () => undefined }, { mailbox, appendAudit: async (event) => { audit.push(event) } })
    return { mailbox, route, audit }
  }

  it('lists only deliveries addressed to the human, newest first and capped', async () => {
    const { mailbox, route } = await mailboxHarness()
    await mailbox.sendFromHuman({ to: 'z-live', kind: 'comment', content: 'to member' })
    const older = await mailbox.sendFromHuman({ to: 'human', kind: 'comment', content: 'first to human' })
    const newer = await mailbox.sendFromHuman({ to: 'human', kind: 'comment', content: 'second to human' })
    const listed = response()
    await route.messages?.({ method: 'GET', url: '/api/live-teams/messages?limit=2', headers: authorized.headers, socket: { remoteAddress: '127.0.0.1' } }, listed)
    expect(listed.statusCode).toBe(200)
    const body = JSON.parse(listed.body ?? '{}') as { messages: Array<{ id: string; content: string; fromName: string }> }
    // A member's delivery never appears here.
    expect(body.messages.map((entry) => entry.content)).toEqual(['second to human', 'first to human'])
    expect(body.messages.map((entry) => entry.id)).toContain(newer.message.id)
    expect(body.messages.map((entry) => entry.id)).not.toContain(older.message.id === newer.message.id ? 'impossible' : '')
  })

  it('rejects an invalid limit rather than silently defaulting', async () => {    const { route } = await mailboxHarness()
    for (const limit of ['abc', '0', '-3']) {
      const result = response()
      await route.messages?.({ method: 'GET', url: `/api/live-teams/messages?limit=${limit}`, headers: authorized.headers, socket: { remoteAddress: '127.0.0.1' } }, result)
      expect(result.statusCode).toBe(400)
    }
    const ok = response()
    await route.messages?.({ method: 'GET', url: '/api/live-teams/messages?limit=5', headers: authorized.headers, socket: { remoteAddress: '127.0.0.1' } }, ok)
    expect(ok.statusCode).toBe(200)
  })

  /**
   * The chip in the Session header answers "does anyone need me?" from anywhere,
   * so this projection must stay small and must not count the human's own notes.
   */
  it('reports who is waiting for the human, one entry per member, longest wait first', async () => {
    const { mailbox, route } = await mailboxHarness()
    // The human's own note to their inbox is not someone waiting.
    await mailbox.sendFromHuman({ to: 'human', kind: 'comment', content: 'note to self' })
    // A member's message to another member is the team's business, not the human's.
    await mailbox.sendFromSession('s-live', { to: 'a-unbound', kind: 'message', content: 'peer talk' })
    const first = await mailbox.sendFromSession('s-live', { to: 'human', kind: 'comment', content: 'relay one' })
    const second = await mailbox.sendFromSession('s-live', { to: 'human', kind: 'message', content: 'relay two' })

    const listed = response()
    await route.attention?.({ method: 'GET', url: '/api/live-teams/attention', headers: authorized.headers, socket: { remoteAddress: '127.0.0.1' } }, listed)
    expect(listed.statusCode).toBe(200)
    const body = JSON.parse(listed.body ?? '{}') as { teamId: string; attention: Array<{ memberId: string; name: string; sessionId: string | null; waiting: number; since: number; kind: string }> }
    expect(body.teamId).toBe('team-1')
    expect(body.attention).toEqual([{
      memberId: 'z-live',
      name: 'Zed',
      sessionId: 's-live',
      waiting: 2,
      since: first.message.createdAt,
      // The newest of the two decides what the chip says it is.
      kind: second.message.kind,
    }])
  })

  it('drops a member from attention once the human acknowledged, in one request', async () => {
    const { mailbox, route } = await mailboxHarness()
    const first = await mailbox.sendFromSession('s-live', { to: 'human', kind: 'comment', content: 'relay one' })
    const second = await mailbox.sendFromSession('s-live', { to: 'human', kind: 'comment', content: 'relay two' })

    const cleared = response()
    await route.acknowledge?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify({ sessionId: 's-live', messageIds: [first.message.id, second.message.id] }) }, cleared)
    expect(cleared.statusCode).toBe(200)
    expect(JSON.parse(cleared.body ?? '{}')).toMatchObject({ state: 'acknowledged', messageIds: [first.message.id, second.message.id] })

    const listed = response()
    await route.attention?.({ method: 'GET', url: '/api/live-teams/attention', headers: authorized.headers, socket: { remoteAddress: '127.0.0.1' } }, listed)
    expect(JSON.parse(listed.body ?? '{}')).toEqual({ teamId: 'team-1', attention: [] })
  })

  it('refuses an empty or malformed bulk acknowledgement instead of guessing', async () => {
    const { route } = await mailboxHarness()
    for (const body of [JSON.stringify({ sessionId: 's-live', messageIds: [] }), JSON.stringify({ sessionId: 's-live', messageIds: ['ok', 7] })]) {
      const result = response()
      await route.acknowledge?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body }, result)
      expect(result.statusCode).toBe(400)
    }
  })

  it('sends as the human no matter what the body claims', async () => {
    const { route, mailbox } = await mailboxHarness()
    const result = response()
    await route.messages?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: humanMessage({ from: 'z-live', to: 'z-live' }) }, result)
    expect(result.statusCode).toBe(200)
    const messages = await mailbox.listMessages()
    expect(messages[0]?.from).toBe('human')
  })

  it('resolves a human route recipient by trimmed case-insensitive display name and reports delivery outcomes', async () => {
    const { route, mailbox } = await mailboxHarness()
    const result = response()
    await route.messages?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: humanMessage({ to: '  zEd  ' }) }, result)
    expect(result.statusCode).toBe(200)
    expect(JSON.parse(result.body ?? '{}')).toMatchObject({ accepted: true, delivered: 0, inbox: 1, pending: 0, failed: 0, deliveries: [{ recipient: 'z-live', name: 'Zed', state: 'stored', outcome: 'inbox' }] })
    expect((await mailbox.listMessages())[0]?.to).toBe('z-live')
  })

  it('reports a human-addressed message as inbox without an undelivered warning', async () => {
    const { route, mailbox } = await mailboxHarness()
    const result = response()
    await route.messages?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: humanMessage({ to: 'human', kind: 'message' }) }, result)
    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body ?? '{}') as Record<string, unknown>
    expect(body).toMatchObject({ accepted: true, delivered: 0, inbox: 1, pending: 0, failed: 0, deliveries: [{ recipient: 'human', name: 'human', state: 'stored', outcome: 'inbox' }] })
    expect(body).not.toHaveProperty('warning')
    expect((await mailbox.listDeliveries())[0]).toMatchObject({ recipient: 'human', state: 'stored', wakePolicy: 'never' })
  })

  it('refuses unknown, ambiguous, and foreign human route recipients with 400', async () => {
    const { route } = await mailboxHarness([
      { memberId: 'z-live', sessionId: 's-live', bindingGeneration: 4, active: true, displayName: 'Zed' },
      { memberId: 'z-other', sessionId: 's-other', bindingGeneration: 1, active: true, displayName: 'zed' },
    ])
    const ambiguous = response()
    await route.messages?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: humanMessage({ to: 'zed' }) }, ambiguous)
    expect(ambiguous.statusCode).toBe(400)
    expect(JSON.parse(ambiguous.body ?? '{}')).toMatchObject({ candidates: expect.arrayContaining(['z-live (Zed)', 'z-other (zed)']) })
    const unknown = response()
    await route.messages?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: humanMessage({ to: 'stranger' }) }, unknown)
    expect(unknown.statusCode).toBe(400)
    const foreign = response()
    await route.messages?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: humanMessage({ to: 'foreign-id' }) }, foreign)
    expect(foreign.statusCode).toBe(400)
  })

  it('refuses a recipient outside the team and invalid content', async () => {
    const { route } = await mailboxHarness()
    for (const body of [humanMessage({ to: 'stranger' }), humanMessage({ content: '   ' }), humanMessage({ content: 'x'.repeat(8001) }), humanMessage({ kind: 'shout' }), humanMessage({ sessionId: undefined })]) {
      const result = response()
      await route.messages?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body }, result)
      expect(result.statusCode).toBe(400)
    }
  })

  it('acknowledges only the human delivery and treats a repeat as success', async () => {
    const { route, mailbox } = await mailboxHarness()
    const sent = await mailbox.sendFromHuman({ to: 'human', kind: 'comment', content: 'ack me' })
    const memberDelivery = await mailbox.sendFromHuman({ to: 'z-live', kind: 'comment', content: 'not yours' })

    const foreign = response()
    await route.acknowledge?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify({ sessionId: 's-1', messageId: memberDelivery.message.id }) }, foreign)
    expect(foreign.statusCode).toBe(400)

    const first = response()
    await route.acknowledge?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify({ sessionId: 's-1', messageId: sent.message.id }) }, first)
    expect(first.statusCode).toBe(200)
    expect(JSON.parse(first.body ?? '{}')).toMatchObject({ state: 'acknowledged' })

    const repeat = response()
    await route.acknowledge?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify({ sessionId: 's-1', messageId: sent.message.id }) }, repeat)
    expect(repeat.statusCode).toBe(200)
  })
})

describe('human contact grant route', () => {
  function grantState(contactGrants: TeamState['contactGrants'] = []): TeamState {
    return {
      ...baseState,
      leadMemberId: 'z-live',
      members: [...baseState.members],
      ...(contactGrants.length === 0 ? {} : { contactGrants }),
    }
  }

  function grantRoute(state: TeamState, audit: unknown[]) {
    return routeOf(async () => state, { get: () => undefined }, {
      setContactGrant: async (from, to, action, actor) => {
        const current = state.contactGrants ?? []
        const exists = current.some((grant) => grant.from === from && grant.to === to)
        const changed = action === 'add' ? !exists : exists
        if (changed) {
          state.contactGrants = action === 'add'
            ? [...current, { from, to, grantedBy: actor, at: 1 }]
            : current.filter((grant) => !(grant.from === from && grant.to === to))
          audit.push({ kind: action === 'add' ? 'contact/granted' : 'contact/revoked', from, to, actor, at: 1 })
        }
        if (state.contactGrants?.length === 0) delete state.contactGrants
        return { grants: (state.contactGrants ?? []).filter((grant) => grant.from === from) }
      },
    })
  }

  it('adds a grant, audits it once as the human, and removes it again', async () => {
    const state = grantState()
    const audit: unknown[] = []
    const route = grantRoute(state, audit)
    const add = response()
    await route.grant?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify({ sessionId: 'human-session', memberId: 'z-live', allow: 'm-dead', action: 'add' }) }, add)
    expect(add.statusCode).toBe(200)
    expect(JSON.parse(add.body ?? '{}')).toMatchObject({ grants: [{ from: 'z-live', to: 'm-dead', grantedBy: 'human:desktop' }] })
    expect(audit).toEqual([{ kind: 'contact/granted', from: 'z-live', to: 'm-dead', actor: 'human:desktop', at: 1 }])

    const remove = response()
    await route.grant?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify({ sessionId: 'human-session', memberId: 'z-live', allow: 'm-dead', action: 'remove' }) }, remove)
    expect(remove.statusCode).toBe(200)
    expect(JSON.parse(remove.body ?? '{}')).toEqual({ grants: [] })
    expect(state.contactGrants).toBeUndefined()
    expect(audit).toHaveLength(2)
    expect(audit[1]).toEqual({ kind: 'contact/revoked', from: 'z-live', to: 'm-dead', actor: 'human:desktop', at: 1 })
  })

  it('rejects a memberId or allow outside this team with 400 and no audit', async () => {
    const state = grantState()
    const audit: unknown[] = []
    const route = grantRoute(state, audit)
    for (const body of [
      { sessionId: 'human-session', memberId: 'foreign', allow: 'm-dead', action: 'add' },
      { sessionId: 'human-session', memberId: 'z-live', allow: 'foreign', action: 'add' },
    ]) {
      const result = response()
      await route.grant?.({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify(body) }, result)
      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.body ?? '{}')).toEqual({ error: 'live-teams invalid request' })
    }
    expect(audit).toEqual([])
    expect(state.contactGrants).toBeUndefined()
  })
})

/**
 * The panel's rotation card talks to this route. It is the human's own surface, so it is fenced like
 * dispatch: same-origin evidence in, an expected revision out, and a request that changes nothing is
 * refused rather than committed.
 */
describe('team rotation route', () => {
  const settings: LiveTeamsRotation = { enabled: true, maxContextTokens: 150_000, maxCompletedTasks: 5, cooldownMs: 600_000, maxRotationsPerPass: 1, source: 'profile', revision: 4 }

  it('reports the limits in force and refuses a foreign origin', async () => {
    const readRotation = vi.fn(async () => settings)
    const routes = routeOf(async () => baseState, undefined, { readRotation })
    const reply = response()
    await routes.rotation!(authorized, reply)
    expect(reply.statusCode).toBe(200)
    expect(JSON.parse(reply.body!)).toEqual(settings)

    const foreign = response()
    await routes.rotation!({ ...authorized, headers: { host: '127.0.0.1:43120', origin: 'http://foreign.test', 'sec-fetch-site': 'cross-site' } }, foreign)
    expect(foreign.statusCode).toBe(403)
  })

  it('commits exactly the fields the human changed, as the human', async () => {
    const updated: LiveTeamsRotation = { ...settings, enabled: false, maxContextTokens: 40_000, source: 'team', revision: 5 }
    const setRotation = vi.fn(async () => updated)
    const routes = routeOf(async () => baseState, undefined, { setRotation })
    const reply = response()
    await routes.rotation!({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify({ enabled: false, maxContextTokens: 40_000, expectedRevision: 4, sessionId: 's-live' }) }, reply)
    expect(reply.statusCode).toBe(200)
    expect(JSON.parse(reply.body!)).toEqual(updated)
    expect(setRotation).toHaveBeenCalledExactlyOnceWith({ enabled: false, maxContextTokens: 40_000, expectedRevision: 4, actor: 'human:desktop' })
  })

  it('refuses a malformed limit, a fractional limit, a missing revision and an empty patch', async () => {
    const setRotation = vi.fn(async () => settings)
    const routes = routeOf(async () => baseState, undefined, { setRotation })
    for (const body of [
      { enabled: 'yes', expectedRevision: 4 },
      { maxContextTokens: -1, expectedRevision: 4 },
      { maxContextTokens: 1.5, expectedRevision: 4 },
      { maxCompletedTasks: 10_000_000_000, expectedRevision: 4 },
      { enabled: true },
      { expectedRevision: 4 },
      { enabled: true, expectedRevision: 'now' },
    ]) {
      const reply = response()
      await routes.rotation!({ method: 'POST', headers: mutationHeaders, socket: { remoteAddress: '127.0.0.1' }, body: JSON.stringify(body) }, reply)
      expect(reply.statusCode).toBe(400)
    }
    expect(setRotation).not.toHaveBeenCalled()
  })

  it('reports an unavailable host instead of inventing limits', async () => {
    const routes = routeOf(async () => baseState)
    const reply = response()
    await routes.rotation!(authorized, reply)
    expect(reply.statusCode).toBe(503)
  })
})
