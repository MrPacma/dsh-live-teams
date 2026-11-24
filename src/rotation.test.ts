import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_ROTATION_CONFIG,
  createRotationService,
  decideRotation,
  effectiveRotationConfig,
  readRotationConfig,
  type RotationConfig,
  type RotationFacts,
  type RotationOutcome,
  type RotationPorts,
} from './rotation.js'
import { readTeamRotation } from './team-store.js'
import { contextTokensOf, modelSelectionOf, type ModelSelection } from './session-bridge.js'
import type { MemberRecord, TeamState } from './team-store.js'

const config = (patch: Partial<RotationConfig> = {}): RotationConfig => ({ ...DEFAULT_ROTATION_CONFIG, enabled: true, ...patch })

const member = (patch: Partial<MemberRecord> = {}): MemberRecord => ({
  memberId: 'm-worker', displayName: 'Worker', role: 'builder', availability: 'available',
  sessionId: 'session-1', bindingGeneration: 1, contractRevision: 0, ...patch,
})

/** A member whose Session binding is missing: `sessionId` is optional, and an explicit `undefined`
 * is not assignable under `exactOptionalPropertyTypes`, so it is removed rather than set. */
const unboundMember = (): MemberRecord => {
  const record = member()
  delete record.sessionId
  return record
}

const facts = (patch: Partial<RotationFacts> = {}): RotationFacts => ({
  completedTasks: 0, openTasks: 0, activeAttempt: false, sessionStatus: 'idle', undeliveredMessages: 0, ...patch,
})

const team = (members: MemberRecord[], patch: Partial<TeamState> = {}): TeamState => ({
  schemaVersion: 1, revision: 7, teamId: 'team-1', workspaceId: 'ws-1', workspacePath: 'D:/work',
  members, archivedMemberIds: [], createdAt: 1, updatedAt: 1, ...patch,
})

describe('readRotationConfig', () => {
  it('is off unless explicitly enabled', () => {
    expect(readRotationConfig(undefined).config.enabled).toBe(false)
    expect(readRotationConfig({ maxContextTokens: 1000 }).config.enabled).toBe(false)
    expect(readRotationConfig({ enabled: 'yes' }).config.enabled).toBe(false)
    expect(readRotationConfig({ enabled: 'yes' }).warnings.join(' ')).toContain('rotation.enabled')
  })

  it('accepts the measured defaults when enabled without limits', () => {
    const { config: parsed, warnings } = readRotationConfig({ enabled: true })
    expect(parsed).toEqual({ ...DEFAULT_ROTATION_CONFIG, enabled: true })
    expect(warnings).toEqual([])
  })

  it('falls back on malformed numbers instead of refusing to mount', () => {
    const { config: parsed, warnings } = readRotationConfig({ enabled: true, maxContextTokens: -1, maxCompletedTasks: 'many' })
    expect(parsed.maxContextTokens).toBe(DEFAULT_ROTATION_CONFIG.maxContextTokens)
    expect(parsed.maxCompletedTasks).toBe(DEFAULT_ROTATION_CONFIG.maxCompletedTasks)
    expect(warnings).toHaveLength(2)
  })

  it('warns when an enabled rule can never fire', () => {
    const { warnings } = readRotationConfig({ enabled: true, maxContextTokens: 0, maxCompletedTasks: 0 })
    expect(warnings.join(' ')).toContain('nothing will ever rotate')
  })
})

describe('decideRotation', () => {
  const base = { config: config(), member: member(), completedTasks: 0, openTasks: 0, activeAttempt: false, sessionStatus: 'idle' as const, undeliveredMessages: 0, contextTokens: 20_000 }

  it('rotates on the context cap', () => {
    expect(decideRotation({ ...base, contextTokens: 150_000 })).toMatchObject({ rotate: true, reason: 'max-context-tokens' })
  })

  it('rotates on the completed-task cap, and the cap resets with the member id', () => {
    expect(decideRotation({ ...base, completedTasks: 4 })).toEqual({ rotate: false, skipped: 'below-threshold' })
    expect(decideRotation({ ...base, completedTasks: 5 })).toMatchObject({ rotate: true, reason: 'max-completed-tasks' })
  })

  it('never takes away work that is still owned', () => {
    expect(decideRotation({ ...base, openTasks: 1 })).toEqual({ rotate: false, skipped: 'open-tasks' })
    expect(decideRotation({ ...base, activeAttempt: true })).toEqual({ rotate: false, skipped: 'active-attempt' })
    expect(decideRotation({ ...base, sessionStatus: 'running' })).toEqual({ rotate: false, skipped: 'session-running' })
    expect(decideRotation({ ...base, undeliveredMessages: 1 })).toEqual({ rotate: false, skipped: 'undelivered-messages' })
  })

  it('reports why nothing happened', () => {
    expect(decideRotation(base)).toEqual({ rotate: false, skipped: 'below-threshold' })
    expect(decideRotation({ ...base, config: config({ enabled: false }) })).toEqual({ rotate: false, skipped: 'disabled' })
    expect(decideRotation({ ...base, member: unboundMember() })).toEqual({ rotate: false, skipped: 'no-session' })
    expect(decideRotation({ ...base, member: member({ availability: 'paused' }) })).toEqual({ rotate: false, skipped: 'paused' })
  })

  it('does not apply a size cap to an unmeasured Session', () => {
    expect(decideRotation({ ...base, contextTokens: undefined })).toEqual({ rotate: false, skipped: 'below-threshold' })
  })

  it('treats a disabled limit as absent', () => {
    const onlyTasks = config({ maxContextTokens: 0 })
    expect(decideRotation({ ...base, config: onlyTasks, contextTokens: 900_000 })).toEqual({ rotate: false, skipped: 'below-threshold' })
    const onlyContext = config({ maxCompletedTasks: 0 })
    expect(decideRotation({ ...base, config: onlyContext, completedTasks: 99 })).toEqual({ rotate: false, skipped: 'below-threshold' })
  })
})

/**
 * Two layers decide the limits: the deployment row, and what the human set in the Team tab. The
 * second is a *partial* override on purpose — a team can change one limit and leave the rest to the
 * operator, and turning rotation off in the panel must not erase the profile's numbers.
 */
describe('effectiveRotationConfig', () => {
  const base = config({ maxContextTokens: 150_000, maxCompletedTasks: 5 })

  it('overrides the deployment row key by key', () => {
    expect(effectiveRotationConfig(base, { enabled: false })).toMatchObject({ enabled: false, maxContextTokens: 150_000, maxCompletedTasks: 5 })
    expect(effectiveRotationConfig(base, { maxContextTokens: 40_000 })).toMatchObject({ enabled: true, maxContextTokens: 40_000, maxCompletedTasks: 5 })
    expect(effectiveRotationConfig(base, undefined)).toEqual(base)
  })

  it('ignores a malformed override instead of silently disabling a limit', () => {
    for (const broken of [null, 'nonsense', 7, { enabled: 'yes' }, { maxContextTokens: -5 }, { maxContextTokens: 1.5 }, { maxCompletedTasks: Number.NaN }]) {
      expect(effectiveRotationConfig(base, broken)).toMatchObject({ enabled: true, maxContextTokens: 150_000, maxCompletedTasks: 5 })
    }
  })
})

describe('readTeamRotation', () => {
  it('reads an absent block, a partial override, and refuses a malformed one', () => {
    expect(readTeamRotation({})).toEqual({})
    expect(readTeamRotation({ rotation: { enabled: true, maxCompletedTasks: 3 } })).toEqual({ enabled: true, maxCompletedTasks: 3 })
    expect(() => readTeamRotation({ rotation: { enabled: 'yes' } as never })).toThrow()
    expect(() => readTeamRotation({ rotation: { maxContextTokens: -1 } })).toThrow()
    expect(() => readTeamRotation({ rotation: { maxContextTokens: 1.5 } })).toThrow()
  })
})

/**
 * A Session carries its own model, and `session.create` accepts none. Rotation has to read the old
 * choice out of the log and record it on the replacement, or a member silently drops to the
 * deployment default — slower or weaker work that looks like the same member.
 */
describe('modelSelectionOf', () => {
  it('reads the pending selection', () => {
    const events = [
      { type: 'request/header', data: { header: { config: { provider: 'deepseek', model: 'v4.1-flash', reasoningEffort: 'high' } } } },
      { type: 'model/selection', data: { provider: 'chatgpt', model: 'sol-6.2', reasoningEffort: 'medium' } },
    ]
    expect(modelSelectionOf(events)).toEqual({ provider: 'chatgpt', model: 'sol-6.2', reasoningEffort: 'medium' })
  })

  it('falls back to the last request header', () => {
    const events = [
      { type: 'request/header', data: { header: { config: { provider: 'deepseek', model: 'v4.1-flash', reasoningEffort: 'high' } } } },
      { type: 'tool/result', data: {} },
    ]
    expect(modelSelectionOf(events)).toEqual({ provider: 'deepseek', model: 'v4.1-flash', reasoningEffort: 'high' })
  })

  it('does not freeze an effort the adapter defaulted', () => {
    const events = [{ type: 'request/header', data: { header: { config: { provider: 'p', model: 'm', reasoningEffort: 'high' }, adapterDefaults: { reasoningEffort: true } } } }]
    expect(modelSelectionOf(events)).toEqual({ provider: 'p', model: 'm' })
  })

  it('reports nothing when the Session never named a model', () => {
    expect(modelSelectionOf([])).toBeUndefined()
    expect(modelSelectionOf([{ type: 'user/message' }, { type: 'request/header', data: { header: { config: {} } } }])).toBeUndefined()
  })
})

describe('contextTokensOf', () => {  it('reads the newest prompt size, not a delta', () => {
    const events = [
      { type: 'assistant/message', seq: 1, data: { usage: { inputTokens: 100, cacheReadTokens: 900, outputTokens: 50, totalTokens: 1050 } } },
      { type: 'assistant/message', seq: 2, data: { usage: { inputTokens: 10, cacheReadTokens: 150_000, outputTokens: 40, totalTokens: 150_050 } } },
      { type: 'tool/result', seq: 3 },
    ]
    expect(contextTokensOf(events)).toBe(150_050)
    expect(contextTokensOf(events.slice(0, 1))).toBe(1050)
  })

  it('falls back to the parts and reports nothing when usage is absent', () => {
    expect(contextTokensOf([{ type: 'assistant/message', data: { usage: { inputTokens: 5, cacheReadTokens: 6, outputTokens: 7 } } }])).toBe(18)
    expect(contextTokensOf([{ type: 'user/message' }, { type: 'assistant/message', data: {} }])).toBeUndefined()
    expect(contextTokensOf([])).toBeUndefined()
  })
})

type Harness = {
  ports: RotationPorts
  outcomes: RotationOutcome[]
  audits: Record<string, unknown>[]
  sessions: string[]
  applied: { sessionId: string; selection: ModelSelection }[]
  retired: { sessionId: string; displayName: string; previousTitle?: string; at: number }[]
  state: TeamState
  notices: string[]
}

function harness(input: {
  members?: MemberRecord[]
  facts?: (member: MemberRecord) => Promise<RotationFacts>
  context?: number | ((sessionId: string) => number | undefined)
  config?: RotationConfig
  createSession?: (request: { sessionId: string; workspaceId: string; agentPreset?: string }) => Promise<void>
} = {}): Harness {
  const current = team(input.members ?? [member()])
  const h: Harness = { outcomes: [], audits: [], sessions: [], state: current, notices: [], applied: [], retired: [], ports: {} as RotationPorts }
  let counter = 0
  const contextInput = input.context
  const measure = typeof contextInput === 'function'
    ? contextInput
    : (): number | undefined => contextInput
  const ports: RotationPorts = {
    teamId: 'team-1',
    workspaceId: 'ws-1',
    config: input.config ?? config(),
    readTeam: async () => h.state,
    commit: async (request) => {
      const next: TeamState = { ...h.state, members: h.state.members.map((entry) => ({ ...entry })), archivedMemberIds: [...h.state.archivedMemberIds], revision: h.state.revision + 1 }
      const value = request.mutate(next)
      h.state = next
      return { state: next, value }
    },
    factsOf: input.facts ?? (async () => facts()),
    measureContextTokens: async (sessionId) => measure(sessionId),
    createSession: input.createSession ?? (async (request) => { h.sessions.push(request.sessionId) }),
    newSessionId: () => `session-new-${String(++counter)}`,
    applyModelSelection: async (sessionId, selection) => { h.applied.push({ sessionId, selection }); return true },
    retireTitle: async (request) => { h.retired.push(request); return `${request.previousTitle ?? request.displayName} (Rotated 24.11.2026 13:45)` },
    audit: async (event) => { h.audits.push(event) },
    onRotated: (outcome) => { h.outcomes.push(outcome); h.notices.push(outcome.sessionId) },
    titleSession: async (sessionId) => { h.notices.push(`title:${sessionId}`) },
  }
  h.ports = ports
  return h
}

describe('rotation service', () => {
  it('moves the rota onto a fresh Session and archives the old member id', async () => {
    const h = harness({ context: 200_000 })
    const service = createRotationService(h.ports)
    const outcomes = await service.check()
    expect(outcomes).toHaveLength(1)
    const rotated = h.state.members[0]
    expect(rotated).toMatchObject({ displayName: 'Worker', role: 'builder', availability: 'available', sessionId: 'session-new-1', bindingGeneration: 1 })
    expect(rotated?.memberId).not.toBe('m-worker')
    expect(rotated?.rotatedFrom).toBe('m-worker')
    expect(h.state.archivedMemberIds).toEqual(['m-worker'])
    expect(h.sessions).toEqual(['session-new-1'])
    expect(h.audits.map((event) => event.kind)).toContain('member/rotated')
    expect(h.notices).toContain('session-new-1')
    expect(h.notices).toContain('title:session-new-1')
  })

  it('carries grants, the lead selection and the note across the new id', async () => {
    const h = harness({
      members: [member({ note: 'owns Web', role: 'lead' })],
      context: 200_000,
      config: config({ maxContextTokens: 1000 }),
    })
    h.state = { ...h.state, leadMemberId: 'm-worker', contactGrants: [
      { from: 'm-worker', to: 'm-other', grantedBy: 'm-worker', at: 1 },
      { from: 'm-other', to: 'm-worker', grantedBy: 'm-worker', at: 2 },
      { from: 'm-other', to: 'human', grantedBy: 'm-other', at: 3 },
    ] }
    await createRotationService(h.ports).check()
    const rotated = h.state.members[0]
    expect(rotated?.note).toBe('owns Web')
    expect(h.state.leadMemberId).toBe(rotated?.memberId)
    expect(h.state.contactGrants?.map((grant) => [grant.from, grant.to])).toEqual([
      [rotated?.memberId, 'm-other'],
      ['m-other', rotated?.memberId],
      ['m-other', 'human'],
    ])
  })

  it('does nothing while despatch is disabled or the thresholds are not reached', async () => {
    const off = harness({ context: 900_000, config: config({ enabled: false }) })
    expect(await createRotationService(off.ports).check()).toEqual([])
    expect(off.sessions).toEqual([])

    const low = harness({ context: 20_000 })
    expect(await createRotationService(low.ports).check()).toEqual([])
    expect(low.state.archivedMemberIds).toEqual([])
  })

  it('rotates one member per pass so the host is not asked for a fleet at once', async () => {
    const h = harness({
      members: [member({ memberId: 'm-a', sessionId: 'session-a' }), member({ memberId: 'm-b', sessionId: 'session-b' })],
      // A replacement Session starts cheap: without this the fresh member would rotate again at once.
      context: (sessionId) => sessionId.includes('new') ? 20_000 : 200_000,
      config: config({ maxRotationsPerPass: 1 }),
    })
    const service = createRotationService(h.ports)
    expect(await service.check()).toHaveLength(1)
    expect(await service.check()).toHaveLength(1)
    expect(h.sessions).toHaveLength(2)
    expect(h.state.archivedMemberIds).toEqual(['m-a', 'm-b'])
  })

  it('keeps a member whose work is still open, even past the cap', async () => {
    const h = harness({ facts: async () => facts({ openTasks: 1 }), context: 900_000 })
    expect(await createRotationService(h.ports).check()).toEqual([])
    expect(h.sessions).toEqual([])
  })

  it('cools down after a failed rotation instead of minting a Session per pass', async () => {
    let attempts = 0
    const h = harness({
      context: 200_000,
      createSession: async () => { attempts += 1; throw new Error('controller refused') },
    })
    const service = createRotationService(h.ports)
    expect(await service.check()).toEqual([])
    expect(await service.check()).toEqual([])
    expect(attempts).toBe(1)
    expect(h.audits.map((event) => event.kind)).toEqual([])
  })

  it('records an orphaned Session when the membership commit is refused', async () => {
    const h = harness({ context: 200_000 })
    const realCommit = h.ports.commit
    // A rebind between the Session creation and the commit is the race this guard exists for: the
    // replacement Session now exists and nothing can delete it, so it is recorded instead.
    h.ports = {
      ...h.ports,
      commit: async (request) => {
        h.state = { ...h.state, members: [member({ sessionId: 'session-rebound' })] }
        return await realCommit(request)
      },
    }
    expect(await createRotationService(h.ports).check()).toEqual([])
    expect(h.audits.map((event) => event.kind)).toContain('session/orphaned')
    expect(h.state.archivedMemberIds).toEqual([])
  })

  it('takes the limits from the team state when a resolver is wired', async () => {
    const h = harness({ context: 200_000 })
    // The deployment row is off; the team's own block turns rotation on with its own limit.
    const base = config({ enabled: false })
    h.ports = { ...h.ports, config: base, configOf: (team) => effectiveRotationConfig(base, team.rotation) }
    h.state = { ...h.state, rotation: { enabled: true, maxContextTokens: 100_000 } }
    expect(await createRotationService(h.ports).check()).toHaveLength(1)
  })

  it('carries the Session model onto the replacement and records it in the journal', async () => {
    const selection = { provider: 'chatgpt', model: 'sol-6.2', reasoningEffort: 'medium' }
    const h = harness({ context: 200_000, facts: async () => facts({ modelSelection: selection }) })
    const [outcome] = await createRotationService(h.ports).check()
    expect(h.applied).toEqual([{ sessionId: 'session-new-1', selection }])
    expect(outcome?.model).toEqual(selection)
    expect(h.audits.find((event) => event.kind === 'member/rotated')?.model).toEqual(selection)
  })

  it('keeps the deployment default when the host cannot record a model, and still rotates', async () => {
    const selection = { provider: 'chatgpt', model: 'sol-6.2' }
    const h = harness({ context: 200_000, facts: async () => facts({ modelSelection: selection }) })
    const ports: RotationPorts = { ...h.ports, applyModelSelection: undefined }
    const outcomes = await createRotationService(ports).check()
    expect(outcomes).toHaveLength(1)
    expect(outcomes[0]?.model).toBeUndefined()
    expect(h.audits.find((event) => event.kind === 'member/rotated')?.model).toBeUndefined()
  })

  it('rotates when recording the model fails, without claiming it was carried', async () => {
    const selection = { provider: 'chatgpt', model: 'sol-6.2' }
    const h = harness({ context: 200_000, facts: async () => facts({ modelSelection: selection }) })
    const ports: RotationPorts = { ...h.ports, applyModelSelection: async () => { throw new Error('agent went away') } }
    const [outcome] = await createRotationService(ports).check()
    expect(outcome?.model).toBeUndefined()
    expect(h.sessions).toHaveLength(1)
  })

  it('stamps the replaced Session with the name it already had', async () => {
    const h = harness({ context: 200_000, facts: async () => facts({ sessionTitle: 'Лидер - Uniwire' }) })
    const [outcome] = await createRotationService(h.ports).check()
    expect(h.retired).toHaveLength(1)
    expect(h.retired[0]).toMatchObject({ sessionId: 'session-1', displayName: 'Worker', previousTitle: 'Лидер - Uniwire' })
    expect(outcome?.retiredTitle).toBe('Лидер - Uniwire (Rotated 24.11.2026 13:45)')
    expect(h.audits.find((event) => event.kind === 'member/rotated')?.retiredTitle).toBe('Лидер - Uniwire (Rotated 24.11.2026 13:45)')
  })

  it('leaves the title alone when the rotation itself was refused', async () => {
    const h = harness({ context: 200_000, facts: async () => facts({ sessionTitle: 'Worker - Uniwire' }) })
    const realCommit = h.ports.commit
    h.ports = {
      ...h.ports,
      commit: async (request) => {
        h.state = { ...h.state, members: [member({ sessionId: 'session-rebound' })] }
        return await realCommit(request)
      },
    }
    expect(await createRotationService(h.ports).check()).toEqual([])
    expect(h.retired).toEqual([])
  })

  it('rotates even when the retired Session cannot be renamed', async () => {
    const h = harness({ context: 200_000, facts: async () => facts({ sessionTitle: 'Worker - Uniwire' }) })
    const ports: RotationPorts = { ...h.ports, retireTitle: async () => { throw new Error('no title service') } }
    const [outcome] = await createRotationService(ports).check()
    expect(outcome?.retiredTitle).toBeUndefined()
    expect(h.sessions).toHaveLength(1)
  })

  it('does not require a title seam at all', async () => {
    const h = harness({ context: 200_000 })
    const ports: RotationPorts = { ...h.ports, retireTitle: undefined }
    const [outcome] = await createRotationService(ports).check()
    expect(outcome?.retiredTitle).toBeUndefined()
    expect(h.sessions).toHaveLength(1)
  })

  it('shares one pass between concurrent callers', async () => {
    const h = harness({ context: 200_000 })
    const service = createRotationService(h.ports)
    const [first, second] = await Promise.all([service.check(), service.check()])
    expect(second).toBe(first)
    expect(h.sessions).toHaveLength(1)
  })

  it('never throws at the dispatcher', async () => {
    const h = harness({ context: 200_000 })
    h.ports = { ...h.ports, readTeam: vi.fn(async () => { throw new Error('state unavailable') }) }
    await expect(createRotationService(h.ports).check()).resolves.toEqual([])
  })
})
