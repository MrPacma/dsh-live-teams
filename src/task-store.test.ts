import { promises as fs } from 'node:fs'
import { mkdtemp, readFile, readdir, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { ToolDefinition, ToolRunContext } from '@deepseek-ai/dsh-tools'
import { ERROR_CODES } from './errors.js'
import { registerMemberTools, type MemberToolsBinding } from './member-tools.js'
import { TeamStore, type TeamState } from './team-store.js'
import { blockedBy, createTaskStore, deriveRouteContacts, routeAllowsContact, type CreateTaskRequest, type TaskStore, type UpdateTaskRequest } from './task-store.js'

function teamState(): TeamState {
  return {
    schemaVersion: 1,
    revision: 1,
    teamId: 'team-1',
    workspaceId: 'workspace-1',
    workspacePath: '/tmp',
    members: [
      { memberId: 'lead', displayName: 'Lead', role: 'lead', availability: 'available', sessionId: 's-lead', bindingGeneration: 1, contractRevision: 0 },
      { memberId: 'worker', displayName: 'Worker', role: 'builder', availability: 'available', sessionId: 's-worker', bindingGeneration: 1, contractRevision: 0 },
      { memberId: 'reviewer', displayName: 'Reviewer', role: 'reviewer', availability: 'available', sessionId: 's-reviewer', bindingGeneration: 1, contractRevision: 0 },
    ],
    archivedMemberIds: [],
    createdAt: 1,
    updatedAt: 1,
    leadMemberId: 'lead',
  }
}

async function fresh(): Promise<{ workspace: string; store: TaskStore; team: TeamStore; audit: unknown[] }> {
  const workspace = await mkdtemp(join(tmpdir(), 'live-teams-b19-'))
  const team = new TeamStore({ workspacePath: workspace, workspaceId: 'workspace-1', teamId: 'team-1' })
  await team.open()
  const opened = await team.open()
  await team.commit('team-1', { expectedRevision: opened.revision, mutate: (state) => Object.assign(state, teamState()) })
  const audit: unknown[] = []
  return { workspace, team, store: createTaskStore({ workspacePath: workspace, teamId: 'team-1', appendAudit: async (event) => { audit.push(event) } }), audit }
}

function request(overrides: Record<string, unknown> = {}): CreateTaskRequest {
  return { title: 'Implement the thing', kind: 'implementation', assignee: 'worker', route: { type: 'review', reviewer: 'reviewer' }, acceptance: ['Tests pass'], actor: 'lead', ...overrides } as CreateTaskRequest
}

async function cleanup(workspace: string): Promise<void> { await rm(workspace, { recursive: true, force: true }) }
function execution(sessionId: string): ToolRunContext { return { agent: { session: { id: sessionId } } } as unknown as ToolRunContext }

describe('B19 durable task store', () => {
  /**
   * The route is the field a model gets wrong, and every wrong shape costs a turn. The lead sent
   * `"route":"report"` and then `"route":"{\"type\":\"review\",…}"` — eight consecutive refusals with a
   * message that only said what was wrong, never what works. The store now parses a JSON string, accepts
   * a display name or `lead` where an id was expected, and names the valid targets when it refuses.
   */
  it('accepts a route as an object, as JSON text, and by display name', async () => {
    const value = await fresh()
    try {
      const object = await value.store.createTask(request({ title: 'object route' }))
      expect(object.task.route).toEqual({ type: 'review', reviewer: 'reviewer' })

      const text = await value.store.createTask(request({ title: 'json text route', route: '{"type":"review","reviewer":"reviewer"}' }))
      expect(text.task.route).toEqual({ type: 'review', reviewer: 'reviewer' })

      const byName = await value.store.createTask(request({ title: 'display name route', route: { type: 'review', reviewer: 'Reviewer' } }))
      expect(byName.task.route).toEqual({ type: 'review', reviewer: 'reviewer' })

      const toLead = await value.store.createTask(request({ title: 'lead route', route: { type: 'report', to: 'lead' } }))
      expect(toLead.task.route).toEqual({ type: 'report', to: 'lead' })

      const toHuman = await value.store.createTask(request({ title: 'human route', route: '{"type":"report","to":"human"}' }))
      expect(toHuman.task.route).toEqual({ type: 'report', to: 'human' })
    } finally { await cleanup(value.workspace) }
  })

  it('names the accepted shapes and the valid targets when a route is refused', async () => {
    const value = await fresh()
    try {
      // A bare word is not a route: the message has to say so, and say what is.
      await expect(value.store.createTask(request({ title: 'bare', route: 'report' }))).rejects.toThrow(/route must be an object, not a string[\s\S]*"type":"report"/u)
      await expect(value.store.createTask(request({ title: 'unknown target', route: { type: 'report', to: 'nobody' } }))).rejects.toThrow(/report route must name a current member[\s\S]*Worker/u)
      await expect(value.store.createTask(request({ title: 'unknown reviewer', route: { type: 'review', reviewer: 'nobody' } }))).rejects.toThrow(/review route must name a current member[\s\S]*Reviewer/u)
    } finally { await cleanup(value.workspace) }
  })

  it('warns about unmatched contract paths without refusing creation or update', async () => {
    const value = await fresh()
    try {
      const created = await value.store.createTask(request({ paths: ['backend/alembic/**'] }))
      expect(created.task.status).toBe('ready')
      expect(created).toMatchObject({ warnings: [{ code: 'path-no-match', pattern: 'backend/alembic/**' }] })
      const updated = await value.store.updateTask({ taskId: created.task.id, actor: 'lead', paths: ['new-module/**'] })
      expect(updated).toMatchObject({ warnings: [{ code: 'path-no-match', pattern: 'new-module/**' }] })
      expect(updated.task.paths).toEqual(['new-module/**'])
    } finally { await cleanup(value.workspace) }
  })
  it('creates a ready task when assignee and route are present', async () => {
    const value = await fresh()
    try {
      const result = await value.store.createTask(request())
      expect(result.task.status).toBe('ready')
      expect(result.task.assignee).toBe('worker')
      expect(result.task.route).toEqual({ type: 'review', reviewer: 'reviewer' })
      expect(result.task.acceptance).toEqual(['Tests pass'])
    } finally { await cleanup(value.workspace) }
  })

  it('creates a draft task when either assignee or route is absent', async () => {
    const value = await fresh()
    try {
      await expect(value.store.createTask(request({ route: undefined }))).resolves.toMatchObject({ task: { status: 'draft' } })
      await expect(value.store.createTask(request({ assignee: undefined }))).resolves.toMatchObject({ task: { status: 'draft' } })
    } finally { await cleanup(value.workspace) }
  })

  it('never creates ready without both route and acceptance', async () => {
    const value = await fresh()
    try {
      await expect(value.store.createTask(request({ acceptance: [] }))).rejects.toThrow(/acceptance/u)
      expect(value.audit).toEqual([])
      expect((await value.store.open()).tasks).toEqual([])
    } finally { await cleanup(value.workspace) }
  })

  it('writes the declared task document before exposing the record', async () => {
    const value = await fresh()
    try {
      const result = await value.store.createTask(request({ title: '  Documented task  ', checks: ['pnpm test'], why: 'because', body: 'Detailed body' }))
      const expectedPath = join(value.workspace, '.dsh-live-teams', 'teams', 'team-1', 'tasks', `${result.task.id}.md`)
      expect(result.documentPath).toBe(expectedPath)
      const document = await readFile(expectedPath, 'utf8')
      expect(document).toContain('# Documented task')
      expect(document).toContain('- `pnpm test`')
      expect(document).toContain('- Tests pass')
      expect(document).toContain('Run the checks. Report to your lead')
      expect(document).toContain('Detailed body')
      expect((await value.store.readTask(result.task.id)).document).toBe(document)
    } finally { await cleanup(value.workspace) }
  })

  it('removes the document when the record write fails', async () => {
    const value = await fresh()
    const originalRename = fs.rename
    const rename = vi.spyOn(fs, 'rename')
    let calls = 0
    rename.mockImplementation(async (from, to) => {
      calls += 1
      if (calls === 2) throw new Error('simulated record publication failure')
      await originalRename(from, to)
    })
    try {
      await expect(value.store.createTask(request())).rejects.toThrow(/publication failure/u)
      const tasksDirectory = join(value.workspace, '.dsh-live-teams', 'teams', 'team-1', 'tasks')
      await expect(readdir(tasksDirectory)).resolves.toEqual([])
      expect((await value.store.open()).tasks).toEqual([])
      expect(value.audit).toEqual([])
    } finally {
      rename.mockRestore()
      await cleanup(value.workspace)
    }
  })

  it('rejects unknown assignee without record, document, or audit', async () => {
    const value = await fresh()
    try {
      await expect(value.store.createTask(request({ assignee: 'missing' }))).rejects.toThrow(/assignee.*current team member/u)
      expect((await value.store.open()).tasks).toEqual([])
      expect(value.audit).toEqual([])
    } finally { await cleanup(value.workspace) }
  })

  it('rejects a reviewer who is the assignee without writing anything', async () => {
    const value = await fresh()
    try {
      await expect(value.store.createTask(request({ route: { type: 'review', reviewer: 'worker' } }))).rejects.toThrow(/reviewer cannot be the assignee/u)
      expect((await value.store.open()).tasks).toEqual([])
      expect(value.audit).toEqual([])
    } finally { await cleanup(value.workspace) }
  })

  it('rejects an empty title', async () => {
    const value = await fresh()
    try {
      await expect(value.store.createTask(request({ title: '  ' }))).rejects.toThrow(/title.*non-empty/u)
      expect(value.audit).toEqual([])
    } finally { await cleanup(value.workspace) }
  })

  it('rejects a title above 200 characters', async () => {
    const value = await fresh()
    try {
      await expect(value.store.createTask(request({ title: 'x'.repeat(201) }))).rejects.toThrow(/200/u)
      expect(value.audit).toEqual([])
    } finally { await cleanup(value.workspace) }
  })

  it('rejects round limits outside 1..20', async () => {
    const value = await fresh()
    try {
      for (const roundLimit of [0, 21, 1.5]) await expect(value.store.createTask(request({ roundLimit }))).rejects.toThrow(/roundLimit/u)
      expect(value.audit).toEqual([])
    } finally { await cleanup(value.workspace) }
  })

  it('defaults roundLimit to five', async () => {
    const value = await fresh()
    try { await expect(value.store.createTask(request())).resolves.toMatchObject({ task: { roundLimit: 5 } }) } finally { await cleanup(value.workspace) }
  })

  it('rejects a body over 20000 characters', async () => {
    const value = await fresh()
    try {
      await expect(value.store.createTask(request({ body: 'x'.repeat(20_001) }))).rejects.toThrow(/20000/u)
      expect(value.audit).toEqual([])
    } finally { await cleanup(value.workspace) }
  })

  it('accepts future route and record fields without migration', async () => {
    const value = await fresh()
    try {
      const created = await value.store.createTask(request({ assignee: undefined, route: { type: 'custom', description: 'human-defined route' } }))
      const file = join(value.workspace, '.dsh-live-teams', 'teams', 'team-1', 'tasks.json')
      const state = JSON.parse(await readFile(file, 'utf8')) as { tasks: Record<string, unknown>[] }
      state.tasks[0] = { ...state.tasks[0], dependencies: ['other-task'], completionGate: 'accepted-submission', interactive: true }
      await fs.writeFile(file, `${JSON.stringify(state)}\n`, 'utf8')
      await expect(value.store.readTask(created.task.id)).resolves.toMatchObject({ task: { dependencies: ['other-task'], completionGate: 'accepted-submission', interactive: true } })
    } finally { await cleanup(value.workspace) }
  })

  it('reads a task and lists bounded newest-first records', async () => {
    const value = await fresh()
    try {
      const first = await value.store.createTask(request({ title: 'First', route: undefined }))
      await value.store.createTask(request({ title: 'Second', route: undefined }))
      await expect(value.store.readTask(first.task.id)).resolves.toMatchObject({ task: { title: 'First' }, document: expect.stringContaining('# First') })
      expect((await value.store.listTasks()).map((task) => task.title)).toEqual(['Second', 'First'])
      expect((await value.store.listTasks()).length).toBeLessThanOrEqual(100)
    } finally { await cleanup(value.workspace) }
  })

  it('reads the whole task set synchronously, which is what the address line needs', async () => {
    const value = await fresh()
    try {
      const review = await value.store.createTask(request())
      await value.store.createTask(request({ title: 'Second', assignee: 'reviewer', route: undefined }))
      expect(value.store.listTasksSync().map((task) => task.title).sort()).toEqual(['Implement the thing', 'Second'])
      // The gate scans every task, so the reviewer of this one holds the path to its
      // assignee although it is not the assignee itself.
      const running = value.store.listTasksSync().find((task) => task.id === review.task.id)
      expect(running).toBeDefined()
      expect(routeAllowsContact(running!, 'reviewer', 'worker', teamState())).toBe(true)
      expect(routeAllowsContact(running!, 'worker', 'reviewer', teamState())).toBe(true)
    } finally { await cleanup(value.workspace) }
  })

  it('keeps missing documents local and visible while other tasks remain usable', async () => {
    const value = await fresh()
    try {
      const first = await value.store.createTask(request({ title: 'Intact task', route: undefined }))
      const second = await value.store.createTask(request({ title: 'Missing task', route: undefined }))
      await unlink(first.documentPath)
      const listed = await value.store.listTasks()
      expect(listed).toHaveLength(2)
      expect(listed.find((task) => task.id === first.task.id)).toMatchObject({ documentMissing: true })
      expect(listed.find((task) => task.id === second.task.id)).not.toHaveProperty('documentMissing')
      await expect(value.store.readTask(second.task.id)).resolves.toMatchObject({ task: { id: second.task.id }, document: expect.stringContaining('# Missing task') })
      await expect(value.store.createTask(request({ title: 'New after loss', route: undefined }))).resolves.toMatchObject({ task: { title: 'New after loss' } })
      await expect(value.store.readTask(first.task.id)).rejects.toMatchObject({ code: ERROR_CODES.CAPABILITY_UNAVAILABLE, message: expect.stringContaining(`task ${first.task.id} document is missing`) })
      await expect(value.store.readTask(first.task.id)).rejects.toThrow(/ask the lead/u)
    } finally { await cleanup(value.workspace) }
  })

  it('uses the same locked CAS revision for parallel mutations', async () => {
    const value = await fresh()
    try {
      const state = await value.store.open()
      const outcomes = await Promise.allSettled([
        value.store.createTask(request({ title: 'A', expectedRevision: state.revision })),
        value.store.createTask(request({ title: 'B', expectedRevision: state.revision })),
      ])
      expect(outcomes.filter((entry) => entry.status === 'fulfilled')).toHaveLength(1)
      expect(outcomes.filter((entry) => entry.status === 'rejected')).toHaveLength(1)
      expect((await value.store.open()).tasks).toHaveLength(1)
      expect(value.audit.filter((event) => (event as { kind?: string }).kind === 'task/created')).toHaveLength(1)
    } finally { await cleanup(value.workspace) }
  })

  it('audits one creation and one document, and no refused call', async () => {
    const value = await fresh()
    try {
      const created = await value.store.createTask(request())
      expect(value.audit).toEqual([
        expect.objectContaining({ kind: 'task/created', id: created.task.id, title: created.task.title, assignee: 'worker', routeType: 'review', actor: 'lead' }),
        expect.objectContaining({ kind: 'task/document', id: created.task.id, taskId: created.task.id, path: created.documentPath, actor: 'lead' }),
      ])
      await expect(value.store.createTask(request({ title: '' }))).rejects.toThrow()
      expect(value.audit).toHaveLength(2)
    } finally { await cleanup(value.workspace) }
  })

  it('claims and acknowledges a task idempotently with auditable attempts', async () => {
    const value = await fresh()
    try {
      const created = await value.store.createTask(request({ humanContact: 'required' }))
      const first = await value.store.claimTask({ taskId: created.task.id, memberId: 'worker', sessionId: 's-worker', bindingGeneration: 1 })
      const second = await value.store.claimTask({ taskId: created.task.id, memberId: 'worker', sessionId: 's-worker', bindingGeneration: 1 })
      expect(first.task.status).toBe('claimed'); expect(first.attempt.status).toBe('active'); expect(second).toEqual(first)
      await expect(value.store.acknowledgeTask({ taskId: created.task.id, memberId: 'worker', sessionId: 's-worker', bindingGeneration: 1 })).resolves.toMatchObject({ task: { status: 'in_progress' } })
      await expect(value.store.acknowledgeTask({ taskId: created.task.id, memberId: 'worker', sessionId: 's-worker', bindingGeneration: 1 })).resolves.toMatchObject({ task: { status: 'in_progress' } })
      expect(value.audit.filter((event) => (event as { kind?: string }).kind === 'task/claimed')).toHaveLength(1)
      expect(value.audit.filter((event) => (event as { kind?: string }).kind === 'attempt/started')).toHaveLength(1)
      expect(value.audit.filter((event) => (event as { kind?: string }).kind === 'task/acknowledged')).toHaveLength(1)
      expect((await value.store.readAttempts()).attempts).toHaveLength(1)
    } finally { await cleanup(value.workspace) }
  })

  it('refuses claim callers and states without writing or auditing', async () => {
    const value = await fresh()
    try {
      const created = await value.store.createTask(request())
      const before = { tasks: JSON.stringify(await value.store.open()), attempts: JSON.stringify(await value.store.readAttempts()), audit: value.audit.length }
      await expect(value.store.claimTask({ taskId: created.task.id, memberId: 'reviewer', sessionId: 's-reviewer', bindingGeneration: 1 })).rejects.toThrow(/assignee/u)
      expect(JSON.stringify(await value.store.open())).toBe(before.tasks); expect(JSON.stringify(await value.store.readAttempts())).toBe(before.attempts); expect(value.audit.length).toBe(before.audit)
      await value.store.claimTask({ taskId: created.task.id, memberId: 'worker', sessionId: 's-worker', bindingGeneration: 1 })
      await expect(value.store.claimTask({ taskId: created.task.id, memberId: 'reviewer', sessionId: 's-reviewer', bindingGeneration: 1 })).rejects.toThrow(/assignee|ready|active/u)
      expect(value.audit.filter((event) => (event as { kind?: string }).kind === 'task/claimed')).toHaveLength(1)
    } finally { await cleanup(value.workspace) }
  })

  it('derives only active route contacts and closes them on completion', async () => {
    const value = await fresh()
    try {
      const created = await value.store.createTask(request({ route: { type: 'review', reviewer: 'reviewer' } }))
      expect(deriveRouteContacts(created.task, teamState())).toEqual(['worker', 'reviewer'])
      expect(routeAllowsContact(created.task, 'worker', 'reviewer', teamState())).toBe(true)
      const completed = { ...created.task, status: 'completed' as const }
      expect(deriveRouteContacts(completed, teamState())).toEqual([])
      expect(routeAllowsContact(completed, 'worker', 'reviewer', teamState())).toBe(false)
    } finally { await cleanup(value.workspace) }
  })

  describe('B27 contract editing', () => {
    const update = (overrides: Record<string, unknown> = {}): UpdateTaskRequest => ({ taskId: '', actor: 'lead', ...overrides } as UpdateTaskRequest)

    it('edits every stored field and re-renders the document from the record', async () => {
      const value = await fresh()
      try {
        const created = await value.store.createTask(request({ why: 'first why', body: 'first body', checks: ['node --version'] }))
        const updated = await value.store.updateTask(update({
          taskId: created.task.id,
          title: 'Implement the other thing',
          acceptance: ['the checks pass', 'the document names its dependency'],
          why: 'second why',
          body: 'second body',
          checks: ['node --version', 'pnpm --filter dsh-live-teams test'],
          roundLimit: 3,
          humanContact: 'expected',
        }))
        expect(updated.changed).toEqual(expect.arrayContaining(['title', 'acceptance', 'why', 'body', 'checks', 'roundLimit', 'humanContact']))
        expect(updated.task).toMatchObject({ title: 'Implement the other thing', roundLimit: 3, humanContact: 'expected', status: 'ready' })
        // The document is a rendering of the record, never a stale second copy.
        expect(updated.document).toContain('second body')
        expect(updated.document).toContain('second why')
        expect(updated.document).toContain('the document names its dependency')
        expect(updated.document).toContain('pnpm --filter dsh-live-teams test')
        // Read back through the store: the file on disk is the same document.
        expect((await value.store.readTask(created.task.id)).document).toBe(updated.document)
        expect(value.audit.filter((event) => (event as { kind: string }).kind === 'task/updated')).toHaveLength(1)
      } finally { await cleanup(value.workspace) }
    })

    it('clears assignee, route and dependencies with null and recomputes the status', async () => {
      const value = await fresh()
      try {
        const dependency = await value.store.createTask(request({ title: 'Dependency' }))
        const created = await value.store.createTask(request({ title: 'Dependent', dependsOn: [dependency.task.id] }))
        const parked = await value.store.updateTask(update({ taskId: created.task.id, assignee: null, route: null, dependsOn: null }))
        // A ready task always carries route, assignee and acceptance: losing them
        // parks the contract back in draft rather than breaking the invariant.
        expect(parked.task.status).toBe('draft')
        expect(parked.task.assignee).toBeUndefined()
        expect(parked.task.route).toBeUndefined()
        expect(parked.task.dependsOn).toBeUndefined()
        expect(parked.task).not.toHaveProperty('assignee')
        const reactivated = await value.store.updateTask(update({ taskId: created.task.id, assignee: 'worker', route: { type: 'review', reviewer: 'reviewer' } }))
        expect(reactivated.task.status).toBe('ready')
      } finally { await cleanup(value.workspace) }
    })

    /**
     * The contract of work in flight is not editable: the assignee's attempt was
     * created against the version they are working from, and judging the result
     * against a different contract is how a submission becomes unjudgeable.
     */
    it('refuses to edit a contract once work has started, and writes nothing', async () => {
      const value = await fresh()
      try {
        const created = await value.store.createTask(request())
        await value.store.claimTask({ taskId: created.task.id, memberId: 'worker', sessionId: 's-worker', bindingGeneration: 1 })
        await value.store.acknowledgeTask({ taskId: created.task.id, memberId: 'worker', sessionId: 's-worker', bindingGeneration: 1 })
        const before = await value.store.readTask(created.task.id)
        await expect(value.store.updateTask(update({ taskId: created.task.id, title: 'Too late' }))).rejects.toThrow(/cannot be updated in status in_progress/u)
        const after = await value.store.readTask(created.task.id)
        expect(after.task.title).toBe(before.task.title)
        expect(after.task.revision).toBe(before.task.revision)
        expect(after.document).toBe(before.document)
        expect(value.audit.filter((event) => (event as { kind: string }).kind === 'task/updated')).toHaveLength(0)
      } finally { await cleanup(value.workspace) }
    })

    it('refuses an empty or no-op patch, a non-lead actor, an unknown task and a stale revision', async () => {
      const value = await fresh()
      try {
        const created = await value.store.createTask(request())
        const before = await value.store.readTask(created.task.id)
        await expect(value.store.updateTask(update({ taskId: created.task.id }))).rejects.toThrow(/nothing to change/u)
        await expect(value.store.updateTask(update({ taskId: created.task.id, title: created.task.title }))).rejects.toThrow(/already matches/u)
        await expect(value.store.updateTask(update({ taskId: created.task.id, title: 'Nope', actor: 'worker' }))).rejects.toThrow(/only the lead/u)
        await expect(value.store.updateTask(update({ taskId: 'task-nope', title: 'Nope' }))).rejects.toThrow(/task not found/u)
        await expect(value.store.updateTask(update({ taskId: created.task.id, title: 'Stale', expectedRevision: 99 }))).rejects.toMatchObject({ code: ERROR_CODES.REVISION_CONFLICT })
        const after = await value.store.readTask(created.task.id)
        expect(after.task.revision).toBe(before.task.revision)
        expect(after.document).toBe(before.document)
        expect(value.audit.filter((event) => (event as { kind: string }).kind === 'task/updated')).toHaveLength(0)
      } finally { await cleanup(value.workspace) }
    })

    it('validates dependencies on update, including the cycle the task itself would close', async () => {
      const value = await fresh()
      try {
        const first = await value.store.createTask(request({ title: 'First' }))
        const second = await value.store.createTask(request({ title: 'Second', dependsOn: [first.task.id] }))
        await expect(value.store.updateTask(update({ taskId: first.task.id, dependsOn: [second.task.id] }))).rejects.toThrow(/cycle/u)
        await expect(value.store.updateTask(update({ taskId: first.task.id, dependsOn: ['task-nope'] }))).rejects.toThrow(/unknown task/u)
        await expect(value.store.updateTask(update({ taskId: first.task.id, dependsOn: [second.task.id, second.task.id] }))).rejects.toThrow(/repeats/u)
        await expect(value.store.updateTask(update({ taskId: first.task.id, dependsOn: Array.from({ length: 9 }, () => second.task.id) }))).rejects.toThrow(/at most 8/u)
        // A dependency that points somewhere harmless is a legal edit.
        const third = await value.store.createTask(request({ title: 'Third' }))
        const ok = await value.store.updateTask(update({ taskId: first.task.id, dependsOn: [third.task.id] }))
        expect(ok.task.dependsOn).toEqual([third.task.id])
      } finally { await cleanup(value.workspace) }
    })
  })

  describe('B28 revocation and reassignment', () => {
    const claim = { taskId: '', memberId: 'worker', sessionId: 's-worker', bindingGeneration: 1 }

    /** A store whose session runtime can be driven: this is what ADR 0005 needs to observe. */
    async function revocable(options: { quiesce: boolean } = { quiesce: true }): Promise<{ store: TaskStore; calls: string[]; workspace: string; audit: unknown[] }> {
      const workspace = await mkdtemp(join(tmpdir(), 'live-teams-b28-'))
      const team = new TeamStore({ workspacePath: workspace, workspaceId: 'workspace-1', teamId: 'team-1' })
      await team.open()
      const opened = await team.open()
      await team.commit('team-1', { expectedRevision: opened.revision, mutate: (state) => Object.assign(state, teamState()) })
      const calls: string[] = []
      const audit: unknown[] = []
      const store = createTaskStore({
        workspacePath: workspace,
        teamId: 'team-1',
        appendAudit: async (event) => { audit.push(event) },
        interruptSession: async (sessionId, reason) => { calls.push(`interrupt:${sessionId}:${reason}`) },
        awaitQuiescence: async (sessionId) => { calls.push(`quiesce:${sessionId}`); return options.quiesce },
      })
      return { store, calls, workspace, audit }
    }

    async function inFlight(store: TaskStore): Promise<{ taskId: string; attemptId: string }> {
      const created = await store.createTask(request({ title: 'Work in flight' }))
      const claimed = await store.claimTask({ ...claim, taskId: created.task.id })
      return { taskId: created.task.id, attemptId: claimed.attempt.id }
    }

    it('parks revoked work instead of making it automatically dispatchable', async () => {
      const value = await revocable()
      try {
        const { taskId } = await inFlight(value.store)
        const revoked = await value.store.revokeTask({ taskId, actor: 'lead', reason: 'stop, do not restart' })
        expect(revoked.task.status).toBe('draft')
        expect(revoked.task.assignee).toBe('worker')
        expect(revoked.task.activeAttemptId).toBeUndefined()
        await expect(value.store.claimTask({ ...claim, taskId })).rejects.toThrow(/not ready|status/u)
      } finally { await cleanup(value.workspace) }
    })

    it('does not cancel and archive a task when its running Session cannot be stopped', async () => {
      const value = await revocable({ quiesce: false })
      try {
        const { taskId, attemptId } = await inFlight(value.store)
        await value.store.cancelTask({ taskId, actor: 'lead', reason: 'cancel running work' })
        const task = (await value.store.listTasks({ includeArchived: true })).find((entry) => entry.id === taskId)
        expect(task?.status).toBe('needs_human')
        expect(task?.archivedPath).toBeUndefined()
        const attempt = (await value.store.readAttempts()).attempts.find((entry) => entry.id === attemptId)
        expect(attempt?.status).toBe('revoking')
        expect(value.calls).toEqual(['interrupt:s-worker:cancel running work', 'quiesce:s-worker'])
        expect(value.audit.map((event) => (event as { kind: string }).kind)).not.toContain('task/cancelled')
      } finally { await cleanup(value.workspace) }
    })

    it('does not claim a stop when runtime hooks are absent or quiescence observation throws', async () => {
      const value = await fresh()
      try {
        const { taskId } = await inFlight(value.store)
        expect((await value.store.cancelTask({ taskId, actor: 'lead', reason: 'cannot observe runtime' })).task.status).toBe('needs_human')
        const throwing = createTaskStore({ workspacePath: value.workspace, teamId: 'team-1', appendAudit: async () => undefined, interruptSession: async () => { throw new Error('runtime unavailable') }, awaitQuiescence: async () => { throw new Error('status unavailable') } })
        const result = await throwing.cancelTask({ taskId, actor: 'lead', reason: 'runtime still unavailable' })
        expect(result.quiesced).toBe(false)
        expect(result.task.status).toBe('needs_human')
        expect(result.archivedPath).toBeUndefined()
      } finally { await cleanup(value.workspace) }
    })

    it('refuses cancellation when the active attempt pointer cannot account for the writer', async () => {
      const value = await fresh()
      try {
        const { taskId } = await inFlight(value.store)
        const tasksFile = join(value.workspace, '.dsh-live-teams', 'teams', 'team-1', 'tasks.json')
        const state = JSON.parse(await readFile(tasksFile, 'utf8')) as { tasks: Array<{ id: string; activeAttemptId?: string }> }
        const task = state.tasks.find((entry) => entry.id === taskId)!
        task.activeAttemptId = 'attempt-missing'
        await writeFile(tasksFile, JSON.stringify(state))
        await expect(value.store.cancelTask({ taskId, actor: 'lead', reason: 'unknown runtime' })).rejects.toThrow(/ownership is inconsistent/)
        expect((await value.store.readTask(taskId)).task.archivedPath).toBeUndefined()
        expect(value.audit.map((event) => (event as { kind: string }).kind)).not.toContain('task/cancelled')
      } finally { await cleanup(value.workspace) }
    })

    it('cancels never-started work without runtime hooks, preserving it in the archive', async () => {
      const value = await fresh()
      try {
        const created = await value.store.createTask(request())
        const result = await value.store.cancelTask({ taskId: created.task.id, actor: 'lead', reason: 'superseded before dispatch' })
        expect(result.quiesced).toBe(true)
        expect(result.task.status).toBe('cancelled')
        expect(result.archivedPath).toBeDefined()
        expect((await value.store.readAttempts()).attempts).toEqual([])
      } finally { await cleanup(value.workspace) }
    })

    it('retries cancellation after an unobserved stop, without inventing a new attempt', async () => {
      const runtime = { quiesce: false }
      const value = await revocable(runtime)
      try {
        const { taskId, attemptId } = await inFlight(value.store)
        const pending = await value.store.cancelTask({ taskId, actor: 'lead', reason: 'stop before archiving' })
        expect(pending.quiesced).toBe(false)
        runtime.quiesce = true
        const closed = await value.store.cancelTask({ taskId, actor: 'lead', reason: 'stop before archiving' })
        expect(closed.quiesced).toBe(true)
        expect(closed.task.status).toBe('cancelled')
        const attempts = (await value.store.readAttempts()).attempts.filter((entry) => entry.taskId === taskId)
        expect(attempts).toHaveLength(1)
        expect(attempts[0]).toMatchObject({ id: attemptId, status: 'revoked' })
        expect(await value.store.activeTaskForMember('worker')).toBeUndefined()
        expect(value.store.activeTaskForMemberSync('worker')).toBeUndefined()
      } finally { await cleanup(value.workspace) }
    })

    it('keeps revoked work parked even when its contract is corrected', async () => {
      const value = await revocable()
      try {
        const { taskId } = await inFlight(value.store)
        await value.store.revokeTask({ taskId, actor: 'lead', reason: 'correct the typo before restarting' })
        const corrected = await value.store.updateTask({ taskId, actor: 'lead', title: 'Corrected title' })
        expect(corrected.task.status).toBe('draft')
        await expect(value.store.claimTask({ ...claim, taskId })).rejects.toThrow(/not ready/)
        expect((await value.store.resumeTask({ taskId, actor: 'lead' })).task.status).toBe('ready')
      } finally { await cleanup(value.workspace) }
    })

    it('requires an explicit authorized restart and fences stale decisions', async () => {
      const value = await revocable()
      try {
        const { taskId } = await inFlight(value.store)
        await value.store.revokeTask({ taskId, actor: 'lead', reason: 'park it' })
        await expect(value.store.resumeTask({ taskId, actor: 'worker' })).rejects.toThrow(/only the lead/)
        await expect(value.store.resumeTask({ taskId, actor: 'lead', expectedRevision: 0 })).rejects.toThrow(/expected revision/)
        expect(await value.store.activeTaskForMember('worker')).toBeUndefined()
        const resumed = await value.store.resumeTask({ taskId, actor: 'human:desktop' })
        expect(resumed.task.status).toBe('ready')
        expect(await value.store.activeTaskForMember('worker')).toBeUndefined()
        await expect(value.store.resumeTask({ taskId, actor: 'lead' })).rejects.toThrow(/parked draft/)
      } finally { await cleanup(value.workspace) }
    })

    it('selects the actual owned attempt rather than a newer queued task for context', async () => {
      const value = await revocable()
      try {
        const { taskId } = await inFlight(value.store)
        const queued = await value.store.createTask(request({ title: 'Queued, not my current assignment' }))
        expect(queued.task.status).toBe('ready')
        expect((await value.store.activeTaskForMember('worker'))?.id).toBe(taskId)
        expect(value.store.activeTaskForMemberSync('worker')?.id).toBe(taskId)
      } finally { await cleanup(value.workspace) }
    })

    it('invalidates the attempt before asking the session to stop, then parks the task', async () => {
      const value = await revocable()
      try {
        const { taskId, attemptId } = await inFlight(value.store)
        const revoked = await value.store.revokeTask({ taskId, actor: 'lead', reason: 'session is wedged' })
        expect(revoked.quiesced).toBe(true)
        expect(revoked.reassigned).toBe(false)
        expect(revoked.attempt).toMatchObject({ id: attemptId, status: 'revoked' })
        expect(revoked.task).toMatchObject({ status: 'draft', assignee: 'worker' })
        expect(revoked.task.activeAttemptId).toBeUndefined()
        // The fence is durable before the interrupt: order is the contract.
        expect(value.calls).toEqual(['interrupt:s-worker:session is wedged', 'quiesce:s-worker'])
        const kinds = value.audit.map((event) => (event as { kind: string }).kind)
        expect(kinds).toEqual(expect.arrayContaining(['task/claimed', 'attempt/started', 'attempt/revoking', 'attempt/revoked']))
      } finally { await cleanup(value.workspace) }
    })

    it('stops the old attempt from writing anything afterwards', async () => {
      const value = await revocable()
      try {
        const { taskId } = await inFlight(value.store)
        await value.store.acknowledgeTask({ taskId, memberId: 'worker', sessionId: 's-worker', bindingGeneration: 1 })
        await value.store.revokeTask({ taskId, actor: 'lead', reason: 'wrong owner' })
        const submission = { type: 'report' as const, bodyRef: 'report.md' }
        await expect(value.store.submitTask({ taskId, memberId: 'worker', sessionId: 's-worker', bindingGeneration: 1, summary: 'late', artifact: submission, checks: [] })).rejects.toThrow(/not claimable for submission|active attempt binding/u)
        await expect(value.store.acknowledgeTask({ taskId, memberId: 'worker', sessionId: 's-worker', bindingGeneration: 1 })).rejects.toThrow(/not claimed|active attempt|not acknowledged/u)
        await expect(value.store.reviewTask({ taskId, submissionId: 'submission-1', reviewerMemberId: 'reviewer', verdict: 'pass', evidence: [{ command: 'test', status: 'passed' }], findings: []})).rejects.toThrow(/not found|latest submission|status/u)
      } finally { await cleanup(value.workspace) }
    })

    it('moves ownership when a new assignee is given, and re-validates the route for them', async () => {
      const value = await revocable()
      try {
        const { taskId, attemptId } = await inFlight(value.store)
        // A reviewer cannot become the assignee of their own review route, and the
        // refusal must leave the attempt untouched rather than half-revoked.
        await expect(value.store.revokeTask({ taskId, actor: 'lead', reason: 'route conflict', nextAssignee: 'reviewer' })).rejects.toThrow(/nobody reviews their own work/u)
        const untouched = (await value.store.readAttempts()).attempts.find((entry) => entry.id === attemptId)
        expect(untouched?.status).toBe('active')
        expect((await value.store.listTasks()).find((task) => task.id === taskId)?.status).toBe('claimed')
        const moved = await value.store.revokeTask({ taskId, actor: 'lead', reason: 'route conflict', nextAssignee: 'lead' })
        expect(moved.reassigned).toBe(true)
        expect(moved.task.assignee).toBe('lead')
        const kinds = value.audit.map((event) => (event as { kind: string }).kind)
        expect(kinds).toContain('task/reassigned')
        expect(value.audit.find((event) => (event as { kind: string }).kind === 'task/reassigned')).toMatchObject({ from: 'worker', to: 'lead' })
      } finally { await cleanup(value.workspace) }
    })

    it('escalates to the human when the session cannot be observed to have stopped', async () => {
      const value = await revocable({ quiesce: false })
      try {
        const { taskId } = await inFlight(value.store)
        const stuck = await value.store.revokeTask({ taskId, actor: 'lead', reason: 'unresponsive' })
        expect(stuck.quiesced).toBe(false)
        // Reporting "revoked" for a session still running would be the one lie this
        // transaction must not tell.
        expect(stuck.attempt.status).toBe('revoking')
        expect(stuck.task.status).toBe('needs_human')
        expect(stuck.task.activeAttemptId).toBeDefined()
        expect(value.audit.map((event) => (event as { kind: string }).kind)).toContain('attempt/revoke-timeout')
        // And nothing can start it again while it carries a revoking attempt.
        await expect(value.store.claimTask({ ...claim, taskId })).rejects.toThrow(/not ready|status/u)
      } finally { await cleanup(value.workspace) }
    })

    it('returns a task to draft when its owner has left the team', async () => {
      const value = await revocable()
      try {
        const { taskId } = await inFlight(value.store)
        // The member is archived: the task they hold outlives their membership.
        const team = new TeamStore({ workspacePath: value.workspace, workspaceId: 'workspace-1', teamId: 'team-1' })
        const current = await team.open()
        await team.commit('team-1', { expectedRevision: current.revision, mutate: (state) => {
          state.members = state.members.filter((member) => member.memberId !== 'worker')
          state.archivedMemberIds.push('worker')
        } })
        const revoked = await value.store.revokeTask({ taskId, actor: 'lead', reason: 'owner left' })
        expect(revoked.attempt.status).toBe('revoked')
        // Nobody owns it now, and saying otherwise would invent an owner.
        expect(revoked.task.status).toBe('draft')
        expect(revoked.task.assignee).toBeUndefined()
        expect(revoked.reassigned).toBe(false)
      } finally { await cleanup(value.workspace) }
    })

    it('resumes an attempt left revoking by an interrupted transaction', async () => {
      const value = await revocable()
      try {
        const { taskId, attemptId } = await inFlight(value.store)
        // Simulate the crash: the invalidation landed, the settlement did not.
        const attemptsFile = join(value.workspace, '.dsh-live-teams', 'teams', 'team-1', 'attempts.json')
        const raw = JSON.parse(await readFile(attemptsFile, 'utf8')) as { attempts: Array<{ id: string; status: string }> }
        for (const attempt of raw.attempts) if (attempt.id === attemptId) attempt.status = 'revoking'
        await writeFile(attemptsFile, `${JSON.stringify(raw, null, 2)}\n`)
        const resumed = await value.store.revokeTask({ taskId, actor: 'lead', reason: 'finish what was started' })
        expect(resumed.attempt.status).toBe('revoked')
        expect(resumed.task.status).toBe('draft')
        // The crash was simulated outside the store, so the resume must not claim a
        // fresh invalidation: it settles the one that already happened.
        const kinds = value.audit.map((event) => (event as { kind: string }).kind)
        expect(kinds.filter((kind) => kind === 'attempt/revoking')).toHaveLength(0)
        expect(kinds.filter((kind) => kind === 'attempt/revoked')).toHaveLength(1)
      } finally { await cleanup(value.workspace) }
    })

    it('refuses a revocation that has nothing to revoke, and writes nothing', async () => {
      const value = await revocable()
      try {
        const created = await value.store.createTask(request({ title: 'Never started' }))
        const before = await value.store.readAttempts()
        await expect(value.store.revokeTask({ taskId: created.task.id, actor: 'lead', reason: 'why not' })).rejects.toThrow(/cannot be revoked in status ready/u)
        await expect(value.store.revokeTask({ taskId: 'task-nope', actor: 'lead', reason: 'x' })).rejects.toThrow(/task not found/u)
        await expect(value.store.revokeTask({ taskId: created.task.id, actor: 'worker', reason: 'x' })).rejects.toThrow(/only the lead/u)
        await expect(value.store.revokeTask({ taskId: created.task.id, actor: 'lead', reason: '  ' })).rejects.toThrow(/reason/u)
        expect((await value.store.readAttempts()).revision).toBe(before.revision)
        expect(value.audit.filter((event) => (event as { kind: string }).kind.startsWith('attempt/revok'))).toHaveLength(0)
      } finally { await cleanup(value.workspace) }
    })

    it('numbers attempts monotonically, so a re-claim is a later attempt and not a first one', async () => {
      const value = await revocable()
      try {
        const { taskId } = await inFlight(value.store)
        const first = (await value.store.readAttempts()).attempts.filter((entry) => entry.taskId === taskId)
        expect(first.map((entry) => entry.generation)).toEqual([1])
        await value.store.revokeTask({ taskId, actor: 'lead', reason: 'restart' })
        await value.store.resumeTask({ taskId, actor: 'lead' })
        const second = await value.store.claimTask({ ...claim, taskId })
        expect(second.attempt.generation).toBe(2)
        const all = (await value.store.readAttempts()).attempts.filter((entry) => entry.taskId === taskId)
        expect(all.map((entry) => entry.generation)).toEqual([1, 2])
        expect(all[0]?.status).toBe('revoked')
      } finally { await cleanup(value.workspace) }
    })
  })

  describe('B26 dependencies and the claim gate', () => {
    const claim = { taskId: '', memberId: 'worker', sessionId: 's-worker', bindingGeneration: 1 }

    /**
     * Produce a terminal status for a stored task without replaying B21/B22
     * acceptance: this increment is about what a status *means* to a dependent
     * task, and producing one through the review contract is pinned there.
     */
    async function forceStatus(store: TaskStore, taskId: string, status: string): Promise<void> {
      const raw = JSON.parse(await readFile(store.filePath, 'utf8')) as { tasks: Array<{ id: string; status: string }> }
      for (const task of raw.tasks) if (task.id === taskId) task.status = status
      await writeFile(store.filePath, `${JSON.stringify(raw, null, 2)}\n`)
    }

    it('stores valid dependencies and names them in the authored document', async () => {
      const value = await fresh()
      try {
        const first = await value.store.createTask(request({ title: 'Publish the schema' }))
        const second = await value.store.createTask(request({ title: 'Build on the schema', dependsOn: [first.task.id] }))
        expect(second.task.dependsOn).toEqual([first.task.id])
        const read = await value.store.readTask(second.task.id)
        expect(read.document).toContain('## Depends on')
        expect(read.document).toContain(`- ${first.task.id} — Publish the schema (ready)`)
      } finally { await cleanup(value.workspace) }
    })

    /**
     * Every rule below protects the same thing: a dependency that can never be
     * satisfied blocks work forever, so it must be refused while someone is still
     * looking at the request — and a refused request writes nothing.
     */
    it('refuses unknown, repeated and oversized dependencies without writing', async () => {
      const value = await fresh()
      try {
        const first = await value.store.createTask(request({ title: 'First' }))
        const before = await value.store.listTasks()
        const auditBefore = value.audit.length
        await expect(value.store.createTask(request({ title: 'Unknown', dependsOn: ['task-nope'] }))).rejects.toThrow(/unknown task/u)
        await expect(value.store.createTask(request({ title: 'Repeated', dependsOn: [first.task.id, first.task.id] }))).rejects.toThrow(/repeats/u)
        await expect(value.store.createTask(request({ title: 'Too many', dependsOn: Array.from({ length: 9 }, (_, index) => `task-${index}`) }))).rejects.toThrow(/at most 8/u)
        await expect(value.store.createTask(request({ title: 'Not a list', dependsOn: 'task-1' as unknown as string[] }))).rejects.toThrow(/array of task ids/u)
        expect(await value.store.listTasks()).toEqual(before)
        expect(value.audit.length).toBe(auditBefore)
      } finally { await cleanup(value.workspace) }
    })

    it('refuses a stored task whose dependencies repeat, name itself or form a cycle', async () => {
      const value = await fresh()
      try {
        const first = await value.store.createTask(request({ title: 'First' }))
        const second = await value.store.createTask(request({ title: 'Second' }))
        // A cycle cannot be created through the API — a new task has no dependents
        // yet — so the reader is the guard that matters for one that appears on disk.
        const raw = JSON.parse(await readFile(value.store.filePath, 'utf8')) as { tasks: Array<{ id: string; dependsOn?: string[] }> }
        for (const task of raw.tasks) {
          if (task.id === first.task.id) task.dependsOn = [second.task.id]
          if (task.id === second.task.id) task.dependsOn = [first.task.id]
        }
        await writeFile(value.store.filePath, `${JSON.stringify(raw, null, 2)}\n`)
        // The reader accepts the shape (it cannot walk the graph), and the gate
        // then refuses to start either task — which is the honest outcome.
        await expect(value.store.claimTask({ ...claim, taskId: first.task.id })).rejects.toThrow(/blocked by/u)
      } finally { await cleanup(value.workspace) }
    })

    it('refuses the claim while a dependency is unfinished, and names the blocker', async () => {
      const value = await fresh()
      try {
        const first = await value.store.createTask(request({ title: 'Publish the schema' }))
        const second = await value.store.createTask(request({ title: 'Build on the schema', dependsOn: [first.task.id] }))
        await expect(value.store.claimTask({ ...claim, taskId: second.task.id })).rejects.toThrow(new RegExp(`blocked by ${first.task.id} "Publish the schema" \\(ready\\)`, 'u'))
        // A refused claim leaves no attempt and no revision behind.
        const listed = await value.store.listTasks()
        expect(listed.find((task) => task.id === second.task.id)?.status).toBe('ready')
        expect(listed.find((task) => task.id === second.task.id)?.revision).toBe(second.task.revision)
        expect((await value.store.readAttempts()).attempts).toHaveLength(0)
      } finally { await cleanup(value.workspace) }
    })

    it('lets the claim through once every dependency is completed', async () => {
      const value = await fresh()
      try {
        const first = await value.store.createTask(request({ title: 'First' }))
        const second = await value.store.createTask(request({ title: 'Second', dependsOn: [first.task.id] }))
        await expect(value.store.claimTask({ ...claim, taskId: second.task.id })).rejects.toThrow(/blocked by/u)
        await forceStatus(value.store, first.task.id, 'completed')
        await expect(value.store.claimTask({ ...claim, taskId: second.task.id })).resolves.toMatchObject({ task: { status: 'claimed' } })
      } finally { await cleanup(value.workspace) }
    })

    it('blocks a task whose dependency is itself blocked', async () => {
      const value = await fresh()
      try {
        const first = await value.store.createTask(request({ title: 'First' }))
        const second = await value.store.createTask(request({ title: 'Second', dependsOn: [first.task.id] }))
        const third = await value.store.createTask(request({ title: 'Third', dependsOn: [second.task.id] }))
        // Nothing completes here: the middle task is ready but unclaimable, and the
        // last one is blocked by it — the chain needs no rule of its own.
        await expect(value.store.claimTask({ ...claim, taskId: third.task.id })).rejects.toThrow(new RegExp(`blocked by ${second.task.id} "Second" \\(ready\\)`, 'u'))
        await forceStatus(value.store, first.task.id, 'completed')
        await expect(value.store.claimTask({ ...claim, taskId: third.task.id })).rejects.toThrow(new RegExp(`blocked by ${second.task.id}`, 'u'))
      } finally { await cleanup(value.workspace) }
    })

    it('stays blocked forever when a dependency died, and says which one', async () => {
      const value = await fresh()
      try {
        const first = await value.store.createTask(request({ title: 'Doomed' }))
        const second = await value.store.createTask(request({ title: 'Waits forever', dependsOn: [first.task.id] }))
        await forceStatus(value.store, first.task.id, 'cancelled')
        // The store does not move the dependent task on its own: a human decides.
        expect((await value.store.listTasks()).find((task) => task.id === second.task.id)?.status).toBe('ready')
        await expect(value.store.claimTask({ ...claim, taskId: second.task.id })).rejects.toThrow(/blocked by .* \(cancelled\)/u)
        expect(blockedBy(second.task, await value.store.listTasks())).toEqual([{ id: first.task.id, title: 'Doomed', status: 'cancelled' }])
      } finally { await cleanup(value.workspace) }
    })
  })

  it('registers three B19 tools and permits creation only to the lead', async () => {
    const value = await fresh()
    try {
      const tools: ToolDefinition[] = []
      const current = await value.team.open()
      const binding = (sessionId: string): MemberToolsBinding | undefined => {
        const member = current.members.find((entry) => entry.sessionId === sessionId)
        return member === undefined ? undefined : { mailbox: {} as never, teamId: current.teamId, teamName: 'B19', member, team: current, taskStore: value.store, live: () => true }
      }
      registerMemberTools({ register: (tool) => { tools.push(tool); return undefined } }, async (sessionId) => binding(sessionId), false, false, true)
      expect(tools.map((tool) => tool.name)).toEqual(['live_team_send', 'live_team_ack_message', 'live_team_context', 'live_team_create_task', 'live_team_update_task', 'live_team_cancel_task', 'live_team_resume_task', 'live_team_revoke_task', 'live_team_read_task', 'live_team_list_tasks', 'live_team_status'])
      const create = tools.find((tool) => tool.name === 'live_team_create_task')!
      await expect(create.execute({ ...request(), actor: 'worker' }, execution('s-worker'))).rejects.toThrow(/only the lead/u)
      await expect(create.execute(request(), execution('s-lead'))).resolves.toMatchObject({ task: { status: 'ready' } })
    } finally { await cleanup(value.workspace) }
  })
})

/**
 * The oh-my-claude bridge marks every DSH tool `readOnlyHint: true`, which is what makes Claude Code
 * run them concurrently — so two mutating team calls can arrive in one answer, from one member, at
 * the same moment. The store must serialize them and refuse the loser rather than lose an update.
 */
describe('concurrent mutations from one member', () => {
  it('keeps one of two parallel contract edits and refuses the other by revision', async () => {
    const { mkdtemp, rm } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const { TeamStore } = await import('./team-store.js')
    const workspace = await mkdtemp(join(tmpdir(), 'live-teams-concurrent-'))
    try {
      const team = new TeamStore({ workspacePath: workspace, workspaceId: 'ws', teamId: 'team-1' })
      await team.open(); const opened = await team.open()
      await team.commit('team-1', { expectedRevision: opened.revision, mutate: (state) => { state.members.push({ memberId: 'm-lead', displayName: 'Lead', role: 'lead', availability: 'available', bindingGeneration: 1, contractRevision: 0 }); state.leadMemberId = 'm-lead' } })
      const store = createTaskStore({ workspacePath: workspace, teamId: 'team-1', appendAudit: async () => undefined })
      const created = await store.createTask({ title: 'Contested', kind: 'research', assignee: 'm-lead', route: { type: 'report', to: 'human' }, acceptance: ['notes'], actor: 'm-lead' })

      // Both edits read the same revision, as two calls in one model answer would.
      const revision = created.task.revision
      const results = await Promise.allSettled([
        store.updateTask({ taskId: created.task.id, expectedRevision: revision, title: 'First writer', actor: 'm-lead' }),
        store.updateTask({ taskId: created.task.id, expectedRevision: revision, title: 'Second writer', actor: 'm-lead' }),
      ])
      const won = results.filter((entry) => entry.status === 'fulfilled')
      const lost = results.filter((entry) => entry.status === 'rejected')
      expect(won).toHaveLength(1)
      expect(lost).toHaveLength(1)
      // The loser is refused by the revision fence, not silently dropped.
      expect(String((lost[0] as PromiseRejectedResult).reason)).toMatch(/revision|conflict|stale/iu)
      const after = (await store.readTask(created.task.id)).task
      expect(['First writer', 'Second writer']).toContain(after.title)
      expect(after.revision).toBe(revision + 1)

      // A revocation racing an edit: the task must not end up revoked and edited at once.
      const racing = await Promise.allSettled([
        store.updateTask({ taskId: created.task.id, expectedRevision: after.revision, title: 'Edited during revoke', actor: 'm-lead' }),
        store.revokeTask({ taskId: created.task.id, reason: 'racing revocation', actor: 'm-lead' }),
      ])
      expect(racing.some((entry) => entry.status === 'fulfilled')).toBe(true)
      const settled = (await store.readTask(created.task.id)).task
      expect(['draft', 'ready', 'cancelled', 'needs_human']).toContain(settled.status)
      expect(settled.revision).toBeGreaterThan(after.revision)
    } finally { await rm(workspace, { recursive: true, force: true }) }
  })
})

describe('the migration that reaches a live stand', () => {
  it('gives a task with an undecided submission its flag back', async () => {
    // The flag was added after a real stand: the store and the panel both derived "is a decision
    // owed" from the status, and a returned task is `in_progress` while its submission sits on the
    // table. State written before the flag existed must gain it, or the task cannot be closed.
    const { applyMigration, planMigration } = await import('./migrations.js')
    const state = { schemaVersion: 1, teamId: 'team-1', revision: 3, tasks: [
      { id: 'task-1', latestSubmissionId: 'sub-1', acceptedSubmissionId: 'sub-1' },
      { id: 'task-2', latestSubmissionId: 'sub-2' },
      { id: 'task-3' },
    ] }
    const plan = planMigration(1, 2, 'task state')
    expect(plan.kind).toBe('migrate')
    const migrated = applyMigration(state, plan) as { tasks: { id: string; awaitsDecision?: boolean }[] }
    expect(migrated.tasks.find((task) => task.id === 'task-1')?.awaitsDecision).toBeUndefined()
    expect(migrated.tasks.find((task) => task.id === 'task-2')?.awaitsDecision).toBe(true)
    expect(migrated.tasks.find((task) => task.id === 'task-3')?.awaitsDecision).toBeUndefined()
  })
})

describe('state migrations', () => {
  it.each([false, true])('releases the team lock before a migration audit lazily opens the TeamStore (cold boot; late future state: %s)', async (lateFuture) => {
    const { mkdtemp, mkdir, readFile, rm, writeFile } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const { TeamStore } = await import('./team-store.js')
    const workspace = await mkdtemp(join(tmpdir(), 'live-teams-cold-migration-'))
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      const directory = join(workspace, '.dsh-live-teams', 'teams', 'team-1')
      await mkdir(directory, { recursive: true })
      const original = JSON.stringify({ schemaVersion: 1, revision: 0, teamId: 'team-1', tasks: [] })
      await writeFile(join(directory, 'tasks.json'), original)
      if (lateFuture) await writeFile(join(directory, 'attempts.json'), JSON.stringify({ schemaVersion: 99, teamId: 'team-1', attempts: [] }))
      const team = new TeamStore({ workspacePath: workspace, workspaceId: 'ws', teamId: 'team-1' })
      let opening: Promise<TeamStore> | undefined
      const ensureStore = () => opening ??= team.open().then(() => team)
      const store = createTaskStore({ workspacePath: workspace, teamId: 'team-1', appendAudit: async (event) => { await (await ensureStore()).appendEvent('team-1', event) } })
      // Deliberately do not open the team first: that used to hide the startup cycle.
      const migrated = Promise.race([
        store.migrate(),
        new Promise<never>((_resolve, reject) => { timeout = setTimeout(() => reject(new Error('cold migration deadlocked after writing schema 2')), 1500) }),
      ])
      if (lateFuture) await expect(migrated).rejects.toThrow(/written by a newer DSH/u)
      else await migrated
      expect(await readFile(join(directory, 'tasks.json.v1.bak'), 'utf8')).toBe(original)
      expect(JSON.parse(await readFile(join(directory, 'tasks.json'), 'utf8')).schemaVersion).toBe(2)
      expect(await store.listTasks()).toEqual([])
      expect((await team.readEvents('team-1')).events).toEqual([expect.objectContaining({ kind: 'state/migrated', file: 'tasks.json', from: 1, to: 2 })])
    } finally {
      if (timeout !== undefined) clearTimeout(timeout)
      await rm(workspace, { recursive: true, force: true })
    }
  })

  it('brings an older state forward, with a backup and a journal entry, and refuses a newer one', async () => {
    const { mkdtemp, readFile, readdir, rm, writeFile } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const { TeamStore } = await import('./team-store.js')
    const workspace = await mkdtemp(join(tmpdir(), 'live-teams-migrate-'))
    try {
      const team = new TeamStore({ workspacePath: workspace, workspaceId: 'ws', teamId: 'team-1' })
      await team.open(); const opened = await team.open()
      await team.commit('team-1', { expectedRevision: opened.revision, mutate: (state) => { state.members.push({ memberId: 'm-lead', displayName: 'Lead', role: 'lead', availability: 'available', bindingGeneration: 1, contractRevision: 0 }); state.leadMemberId = 'm-lead' } })
      const audit: unknown[] = []
      // A migration from 0 to 1 that adds the field the current reader expects. The registry is empty
      // in the product today (version 1 is the first), so the step is injected here.
      const store = createTaskStore({
        workspacePath: workspace, teamId: 'team-1', appendAudit: async (event) => { audit.push(event) },
        // The chain has to reach the current version: 1 → 2 is the real one, so the test supplies a
        // no-op for it and keeps its own step at 0.
        migrations: { 0: (state: unknown) => ({ ...(state as Record<string, unknown>), migratedFromZero: true }), 1: (state: unknown) => state },
      })
      const created = await store.createTask({ title: 'Before the migration', kind: 'research', assignee: 'm-lead', route: { type: 'report', to: 'human' }, acceptance: ['notes'], actor: 'm-lead' })
      const statePath = join(workspace, '.dsh-live-teams', 'teams', 'team-1', 'tasks.json')
      const state = JSON.parse(await readFile(statePath, 'utf8')) as Record<string, unknown>
      await writeFile(statePath, JSON.stringify({ ...state, schemaVersion: 0 }))

      const result = await store.migrate()
      expect(result.files).toEqual([expect.objectContaining({ file: 'tasks.json', from: 0, to: 2 })])
      const migrated = JSON.parse(await readFile(statePath, 'utf8')) as Record<string, unknown>
      expect(migrated.schemaVersion).toBe(2)
      expect(migrated.migratedFromZero).toBe(true)
      // The task survived the migration and the original file is kept beside it.
      expect((await store.listTasks({ includeArchived: true })).map((task) => task.id)).toContain(created.task.id)
      const backups = (await readdir(join(workspace, '.dsh-live-teams', 'teams', 'team-1'))).filter((name) => name.includes('.bak'))
      expect(backups).toEqual(['tasks.json.v0.bak'])
      expect(audit.some((event) => (event as { kind?: string }).kind === 'state/migrated')).toBe(true)
      // Running it again is a no-op.
      expect((await store.migrate()).files).toEqual([])

      // A state from the future is refused with both versions named, not as corruption.
      await writeFile(statePath, JSON.stringify({ ...migrated, schemaVersion: 99 }))
      await expect(store.migrate()).rejects.toThrow(/written by a newer DSH \(schema 99, this build understands 2\)/u)
    } finally { await rm(workspace, { recursive: true, force: true }) }
  })
})

describe('the review loop converges (external review, finding 5)', () => {
  it('refuses a re-submission that is identical to the one sent back, and accepts a changed one', async () => {
    const { mkdtemp, rm, writeFile } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const { TeamStore } = await import('./team-store.js')
    const workspace = await mkdtemp(join(tmpdir(), 'live-teams-converge-'))
    try {
      const team = new TeamStore({ workspacePath: workspace, workspaceId: 'ws', teamId: 'team-1' })
      await team.open(); const opened = await team.open()
      await team.commit('team-1', { expectedRevision: opened.revision, mutate: (state) => { state.members.push({ memberId: 'm-lead', displayName: 'Lead', role: 'lead', availability: 'available', bindingGeneration: 1, contractRevision: 0 }, { memberId: 'm-worker', displayName: 'Worker', role: 'builder', availability: 'available', sessionId: 's-worker', bindingGeneration: 1, contractRevision: 0 }, { memberId: 'm-reviewer', displayName: 'Reviewer', role: 'verifier', availability: 'available', bindingGeneration: 1, contractRevision: 0 }); state.leadMemberId = 'm-lead' } })
      const store = createTaskStore({ workspacePath: workspace, teamId: 'team-1', appendAudit: async () => undefined })
      const created = await store.createTask({ title: 'Loop', kind: 'implementation', assignee: 'm-worker', route: { type: 'review', reviewer: 'm-reviewer' }, acceptance: ['ok'], actor: 'm-lead' })
      await store.claimTask({ taskId: created.task.id, memberId: 'm-worker', sessionId: 's-worker', bindingGeneration: 1 })
      await writeFile(join(workspace, 'work.md'), 'the same words\n')
      const first = await store.submitTask({ taskId: created.task.id, memberId: 'm-worker', sessionId: 's-worker', bindingGeneration: 1, artifact: { type: 'report', bodyRef: 'work.md' }, summary: 'first', checks: [] })
      await store.reviewTask({ taskId: created.task.id, submissionId: first.submission.id, reviewerMemberId: 'm-reviewer', verdict: 'needs_revision', findings: [{ severity: 'high', problem: 'the words are wrong', requiredFix: 'say something else' }] })
      // Byte-identical: another round would teach the reviewer nothing.
      await expect(store.submitTask({ taskId: created.task.id, memberId: 'm-worker', sessionId: 's-worker', bindingGeneration: 1, artifact: { type: 'report', bodyRef: 'work.md' }, summary: 'again', checks: [] }))
        .rejects.toThrow(/identical to the one the reviewer sent back/u)
      // A changed artifact is accepted and can be reviewed.
      await writeFile(join(workspace, 'work.md'), 'different words\n')
      const second = await store.submitTask({ taskId: created.task.id, memberId: 'm-worker', sessionId: 's-worker', bindingGeneration: 1, artifact: { type: 'report', bodyRef: 'work.md' }, summary: 'changed', checks: [] })
      const passed = await store.reviewTask({ taskId: created.task.id, submissionId: second.submission.id, reviewerMemberId: 'm-reviewer', verdict: 'pass', findings: [], evidence: [{ command: 'node --test', status: 'passed' }] })
      expect(passed.task.status).toBe('completed')
    } finally { await rm(workspace, { recursive: true, force: true }) }
  })
})

describe('PASS needs evidence (F6)', () => {
  it('refuses a verdict that names no check, and accepts one that does', async () => {
    const { mkdtemp, rm, writeFile } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const { TeamStore } = await import('./team-store.js')
    const workspace = await mkdtemp(join(tmpdir(), 'live-teams-f6-'))
    try {
      const team = new TeamStore({ workspacePath: workspace, workspaceId: 'ws', teamId: 'team-1' })
      await team.open(); const opened = await team.open()
      await team.commit('team-1', { expectedRevision: opened.revision, mutate: (state) => { state.members.push({ memberId: 'm-lead', displayName: 'Lead', role: 'lead', availability: 'available', bindingGeneration: 1, contractRevision: 0 }, { memberId: 'm-worker', displayName: 'Worker', role: 'builder', availability: 'available', sessionId: 's-worker', bindingGeneration: 1, contractRevision: 0 }, { memberId: 'm-reviewer', displayName: 'Reviewer', role: 'verifier', availability: 'available', bindingGeneration: 1, contractRevision: 0 }); state.leadMemberId = 'm-lead' } })
      const store = createTaskStore({ workspacePath: workspace, teamId: 'team-1', appendAudit: async () => undefined })
      const created = await store.createTask({ title: 'Evidence', kind: 'implementation', assignee: 'm-worker', route: { type: 'review', reviewer: 'm-reviewer' }, acceptance: ['ok'], actor: 'm-lead' })
      await store.claimTask({ taskId: created.task.id, memberId: 'm-worker', sessionId: 's-worker', bindingGeneration: 1 })
      await writeFile(join(workspace, 'report.md'), 'work\n')
      const submitted = await store.submitTask({ taskId: created.task.id, memberId: 'm-worker', sessionId: 's-worker', bindingGeneration: 1, artifact: { type: 'report', bodyRef: 'report.md' }, summary: 'done', checks: [] })
      await expect(store.reviewTask({ taskId: created.task.id, submissionId: submitted.submission.id, reviewerMemberId: 'm-reviewer', verdict: 'pass', findings: [] }))
        .rejects.toThrow(/PASS needs at least one recorded check/u)
      const rounds = (await store.readTask(created.task.id)).rounds
      expect(rounds).toHaveLength(0)
      const passed = await store.reviewTask({ taskId: created.task.id, submissionId: submitted.submission.id, reviewerMemberId: 'm-reviewer', verdict: 'pass', findings: [], evidence: [{ command: 'node --test', status: 'passed', output: 'ok' }] })
      expect(passed.task.status).toBe('completed')
      // A route call that did not carry browser evidence is still the human's authority: the two
      // actor values differ in the journal, not in what they may do.
      const other = await store.createTask({ title: 'Local caller', kind: 'implementation', assignee: 'm-worker', route: { type: 'report', to: 'human' }, acceptance: ['ok'], actor: 'm-lead' })
      await store.claimTask({ taskId: other.task.id, memberId: 'm-worker', sessionId: 's-worker', bindingGeneration: 1 })
      await writeFile(join(workspace, 'local.md'), 'work\n')
      await store.submitTask({ taskId: other.task.id, memberId: 'm-worker', sessionId: 's-worker', bindingGeneration: 1, artifact: { type: 'report', bodyRef: 'local.md' }, summary: 'done', checks: [] })
      const acceptedLocally = await store.acceptTask({ taskId: other.task.id, actor: 'local:unverified' })
      expect(acceptedLocally.task.status).toBe('completed')
    } finally { await rm(workspace, { recursive: true, force: true }) }
  })
})
