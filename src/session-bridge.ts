import { LiveTeamsError, translatePlatformError } from './errors.js'

export interface SessionDescriptor {
  sessionId: string
  workspaceId: string | undefined
  cwd: string | undefined
  title: string | undefined
  status: 'idle' | 'running' | 'unknown'
  live: boolean
  subagentOwned: boolean
  seq: number
  agentPreset: string | undefined
  /**
   * DSH's Session-list projection keeps a Session blank until its first
   * `turn/start`, and the session list hides blank Sessions: the Workspace
   * browser adopts one as its provisional "New session" row and never lists it
   * (`sessionVisible` / `connectWorkspace` in @deepseek-ai/dsh-client-ui-workspace).
   *
   * Only `list` reports this flag, so `undefined` means "not reported", never
   * "known to be visible".
   */
  blank?: boolean
}

export interface SessionController {
  create(payload: Record<string, unknown>): Promise<unknown>
  /**
   * Removed in DSH 0.2.2-rc.1. Kept optional so this bridge still works on older hosts; new
   * hosts are served through `SessionQuerySource.load`.
   */
  inspect?(sessionId: string): Promise<unknown>
  list?(request: Record<string, unknown>, signal?: AbortSignal): Promise<unknown>
  rename(payload: { sessionId: string; title: string }): Promise<unknown>
  prompt(payload: { requestId: string; sessionId: string; mode: 'queue' | 'steer'; content: readonly unknown[] }, signal: AbortSignal): Promise<unknown>
  cancel(payload: { sessionId: string }): void
  updateQueue?(payload: { sessionId: string; itemId: string; action: { kind: 'remove' } }): Promise<unknown>
}

export type SessionExecutionReceipt = {
  state: 'pending' | 'started' | 'completed' | 'failed' | 'unobservable'
  turn?: number
  inputSeq?: number
  reason?: string
}

export type QueueRemovalReceipt = { state: 'removed' | 'not-pending' | 'unobservable' | 'refused'; itemId?: string; reason?: string }

export interface SessionBridge {
  removeQueuedRequest(sessionId: string, requestId: string): Promise<QueueRemovalReceipt>
  create(request: { sessionId?: string; workspaceId?: string; cwd?: string; agentPreset?: string }): Promise<SessionDescriptor>
  inspect(sessionId: string): Promise<SessionDescriptor | undefined>
  /**
   * Observe an exact prompt's turn using metadata only, not generic agent liveness.
   */
  observeRequest(sessionId: string, requestId: string): Promise<SessionExecutionReceipt>
  /**
   * The prompt size of this Session's latest turn, or `undefined` when the host records no usage.
   * A rotation limit is only applied to a measured Session.
   */
  contextTokens(sessionId: string): Promise<number | undefined>
  observeHumanActivity(sessionId: string, since: number, knownRequestIds: readonly string[]): Promise<boolean | undefined>
  validateAttachment(sessionId: string, workspaceId: string): Promise<SessionDescriptor>
  rename(sessionId: string, title: string): Promise<{ title: string; seq: number | undefined }>
  selectModel(sessionId: string, selection: unknown): never
  deliver(sessionId: string, envelope: { requestId: string; mode: 'queue' | 'steer'; content: readonly unknown[] }): Promise<{ accepted: true }>
  interrupt(sessionId: string, reason: string): Promise<{ accepted: true }>
  reconcile(sessionIds: readonly string[]): Promise<SessionDescriptor[]>
}

type RecordValue = Record<string, unknown>
function record(value: unknown): RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {}
}
function text(value: unknown): string | undefined { return typeof value === 'string' && value.length > 0 ? value : undefined }
function amount(value: unknown): number | undefined { return typeof value === 'number' && Number.isFinite(value) ? value : undefined }

/**
 * The prompt size of a Session's latest turn, read from the Session's own usage record.
 *
 * `totalTokens` on an `assistant/message` is the size of the context that call sent — input, plus
 * cached input, plus output — not a per-turn delta, so the newest one is the current window. Rotation
 * reads it as "how much would the next turn re-send". Older hosts and some routes record no usage at
 * all; `undefined` then means unmeasured, and no size limit is applied rather than a guessed one.
 */
export function contextTokensOf(events: readonly unknown[]): number | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = record(events[index])
    if (event.type !== 'assistant/message') continue
    const data = record(event.data)
    const usage = record(data.usage ?? record(data.message).usage)
    const total = amount(usage.totalTokens)
    if (total !== undefined && total > 0) return total
    const input = amount(usage.inputTokens)
    const cached = amount(usage.cacheReadTokens)
    const output = amount(usage.outputTokens)
    if (input !== undefined && cached !== undefined && output !== undefined) return input + cached + output
  }
  return undefined
}
function isSubagentHeader(header: unknown): boolean {
  const value = record(header)
  return value.origin === 'subagent' || text(value.parentSession) !== undefined
}
function isMissingSession(error: unknown): boolean {
  const value = record(error)
  if (value.code === 'session/not-found') return true
  if (typeof value.code === 'string' && value.code.length > 0) return false
  return /not found/i.test(String(value.message ?? ''))
}
function isSubagentOwnership(error: unknown): boolean {
  const value = record(error)
  if (value.code !== 'session/agent-busy') return false
  const details = record(value.details)
  return /subagent/i.test(String(details.reason ?? value.message ?? ''))
}

export function toBridgeError(error: unknown): LiveTeamsError {
  if (error instanceof LiveTeamsError) return error
  const translated = translatePlatformError(error)
  if (!isSubagentOwnership(error)) return translated
  return new LiveTeamsError('CAPABILITY_UNAVAILABLE', 'Session is owned by subagent routing and cannot be a team member', translated.auditDetail === undefined ? { cause: error } : { cause: error, auditDetail: translated.auditDetail })
}

function descriptorOf(inspection: RecordValue, liveAgent: unknown): SessionDescriptor {
  const liveSession = record(record(liveAgent).session)
  const meta = record(inspection.meta ?? inspection.header ?? liveSession.header)
  const session = record(liveAgent).session
  const ownerHeader = record(session).header ?? meta
  const events = Array.isArray(inspection.events) ? inspection.events : []
  let title = text(meta.title)
  let seq = typeof meta.seq === 'number' ? meta.seq : 0
  for (const event of events) {
    const value = record(event)
    if (typeof value.seq === 'number' && value.seq > seq) seq = value.seq
    if (value.type === 'session/title') title = text(record(value.data).title) ?? title
  }
  const statusValue = record(liveAgent).status
  return {
    sessionId: text(meta.id) ?? '',
    workspaceId: text(meta.workspaceId),
    cwd: text(meta.cwd),
    title,
    status: statusValue === 'idle' || statusValue === 'running' ? statusValue : 'unknown',
    live: liveAgent !== undefined && liveAgent !== null,
    subagentOwned: isSubagentHeader(ownerHeader),
    seq,
    agentPreset: text(meta.agentPreset),
  }
}

/**
 * The host's cold-safe Session reader.
 *
 * DSH 0.2.2-rc.1 moved inspection off `sessionController` onto `ctx.sessionQuery.load`, which
 * returns `{ header, inheritedEventCount, events }`. The bridge normalizes both shapes, so a
 * deployment may upgrade without losing member validation or delivery observation.
 */
export interface SessionQuerySource {
  load?(sessionId: string, signal?: AbortSignal): Promise<unknown>
}

export interface SessionBridgeDeps {
  controller: SessionController | null | undefined
  agents?: { get?: (sessionId: string) => unknown }
  /**
   * The query service may be provided after this plugin mounts (it is mounted by a later
   * composition row), so a function is accepted and resolved per call.
   */
  sessionQuery?: SessionQuerySource | (() => SessionQuerySource | undefined)
  /**
   * The live Session service. A freshly created Session is live before any cold-read service is
   * reachable, so this is the authoritative fallback for member creation and live observation.
   */
  liveSession?: (sessionId: string) => unknown
}
export function createSessionBridge({ controller, agents, sessionQuery, liveSession }: SessionBridgeDeps): SessionBridge {
  if (controller === null || typeof controller !== 'object') throw new LiveTeamsError('CAPABILITY_UNAVAILABLE', 'sessionController is not available in this composition')
  const liveAgentOf = (sessionId: string): unknown => agents?.get?.(sessionId)
  const queryService = (): SessionQuerySource | undefined => typeof sessionQuery === 'function' ? sessionQuery() : sessionQuery
  /**
   * Read one Session through whichever inspection API the host still offers.
   * Inspection is deliberately not cached: delivery receipts depend on current history.
   */
  const snapshotOf = async (sessionId: string): Promise<RecordValue> => {
    if (typeof controller.inspect === 'function') return record(await controller.inspect(sessionId))
    // A live Session is readable without any cold-read service. This is the path that makes a
    // freshly created member Session usable even before sessionQuery is injected or started.
    try {
      const live = record(liveSession?.(sessionId))
      const header = record(live.header)
      if (header.id === sessionId) {
        const events = typeof live.snapshotEvents === 'function' ? (live.snapshotEvents as () => unknown)() : []
        return { meta: header, inheritedEventCount: live.inheritedEventCount, events: Array.isArray(events) ? events : [] }
      }
    } catch { /* fall through to the cold-read service */ }
    const query = queryService()
    if (typeof query?.load === 'function') {
      const loaded = record(await query.load(sessionId))
      const meta = record(loaded.header ?? loaded.meta)
      return {
        meta,
        ...(loaded.inheritedEventCount === undefined ? {} : { inheritedEventCount: loaded.inheritedEventCount }),
        events: Array.isArray(loaded.events) ? loaded.events : [],
      }
    }
    // Last resort for a cold descriptor: the visible Session list carries identity and cwd even
    // when the history service is not reachable. It cannot prove request history, so events stay
    // empty; binding can still resolve and delivery observation degrades honestly.
    if (typeof controller.list === 'function') {
      const page = record(await controller.list({}))
      const items = Array.isArray(page.items) ? page.items : Array.isArray(page) ? page : []
      const found = items.map(record).find((item) => text(item.sessionId) === sessionId || text(item.id) === sessionId)
      if (found !== undefined) return { meta: { ...found, id: sessionId }, events: [] }
    }
    throw new LiveTeamsError('CAPABILITY_UNAVAILABLE', 'Session inspection is unavailable: this host offers neither sessionController.inspect, a live Session, sessionQuery.load nor a readable Session list', { auditDetail: 'host compatibility: no Session inspection API' })
  }
  const bridge: SessionBridge = {
    async removeQueuedRequest(sessionId, requestId) {
      if (text(sessionId) === undefined || text(requestId) === undefined) return { state: 'refused', reason: 'invalid-request-identity' }
      const agent = record(liveAgentOf(sessionId))
      const header = record(record(agent.session).header)
      if (header.id !== sessionId || controller.updateQueue === undefined) return { state: 'unobservable', reason: 'pending-queue-unavailable' }
      if (isSubagentHeader(header)) return { state: 'refused', reason: 'subagent-owned' }
      const inbox = record(agent.inbox)
      if (!Array.isArray(inbox.nextTurn) || !Array.isArray(inbox.nextStep)) return { state: 'unobservable', reason: 'pending-queue-unavailable' }
      const matches = [...inbox.nextTurn, ...inbox.nextStep].map(record).filter(message => record(message.source).kind === 'user' && record(message.source).rpcId === requestId)
      if (matches.length === 0) return { state: 'not-pending' }
      const itemId = text(matches[0]?.id)
      if (matches.length !== 1 || itemId === undefined) return { state: 'refused', reason: 'pending-identity-ambiguous' }
      try {
        await controller.updateQueue({ sessionId, itemId, action: { kind: 'remove' } })
        return { state: 'removed', itemId }
      } catch (error) {
        return record(error).code === 'session/queue-item-not-found' ? { state: 'not-pending', itemId } : { state: 'refused', itemId, reason: 'native-queue-removal-refused' }
      }
    },
    async create(request) {
      const sessionId = text(request?.sessionId)
      if (sessionId === undefined) throw new LiveTeamsError('CAPABILITY_UNAVAILABLE', 'create requires an explicit plugin-owned sessionId')
      const payload: Record<string, unknown> = { sessionId }
      if (text(request.workspaceId) !== undefined) payload.workspaceId = request.workspaceId
      if (text(request.cwd) !== undefined) payload.cwd = request.cwd
      if (text(request.agentPreset) !== undefined) payload.agentPreset = request.agentPreset
      try { await controller.create(payload) } catch (error) { throw toBridgeError(error) }
      const descriptor = await bridge.inspect(sessionId)
      if (descriptor === undefined) throw new LiveTeamsError('SESSION_NOT_FOUND', `Session "${sessionId}" was not readable after create`, { auditDetail: 'create succeeded but inspect could not observe the Session' })
      return descriptor
    },
    async inspect(sessionId) {
      try { return descriptorOf(await snapshotOf(sessionId), liveAgentOf(sessionId)) } catch (error) {
        if (isMissingSession(error)) return undefined
        throw toBridgeError(error)
      }
    },
    /**
     * Deliberately silent on failure: an unreadable Session is an unmeasured one, and a rotation
     * limit that guessed a size would rotate for the wrong reason. The caller treats `undefined` as
     * "no evidence", which is what the decision table already does.
     */
    async contextTokens(sessionId) {
      try { return contextTokensOf((await snapshotOf(sessionId)).events as readonly unknown[]) } catch { return undefined }
    },
    async validateAttachment(sessionId, workspaceId) {
      const descriptor = await bridge.inspect(sessionId)
      if (descriptor === undefined) throw new LiveTeamsError('SESSION_NOT_FOUND', `Session "${sessionId}" does not exist`, { auditDetail: 'validateAttachment: inspect returned no Session' })
      if (descriptor.subagentOwned) throw new LiveTeamsError('CAPABILITY_UNAVAILABLE', `Session "${sessionId}" is owned by subagent routing`, { auditDetail: 'validateAttachment: subagent-owned Session cannot be a member' })
      const expected = text(workspaceId)
      if (expected !== undefined && descriptor.workspaceId !== expected) throw new LiveTeamsError('SESSION_WRONG_WORKSPACE', `Session "${sessionId}" is not attached to workspace "${expected}"`, { auditDetail: `observed workspaceId=${String(descriptor.workspaceId)}` })
      return descriptor
    },
    async rename(sessionId, title) {
      try { const result = record(await controller.rename({ sessionId, title })); return { title: text(result.title) ?? title, seq: typeof result.seq === 'number' ? result.seq : undefined } } catch (error) { throw toBridgeError(error) }
    },
    selectModel() {
      throw new LiveTeamsError('CAPABILITY_UNAVAILABLE', 'Model selection is intentionally unavailable in this build', { auditDetail: 'Phase 2 policy omits member model selection because selectModel also rewrites the deployment-wide default model. This must not be worked around silently.' })
    },
    async observeHumanActivity(sessionId, since, knownRequestIds) {
      let inspection: RecordValue
      try { inspection = await snapshotOf(sessionId) } catch { return undefined }
      if (record(inspection.meta ?? inspection.header).id !== sessionId || !Array.isArray(inspection.events)) return undefined
      const known = new Set(knownRequestIds)
      for (const raw of inspection.events) {
        const event = record(raw)
        if (event.type !== 'user/message') continue
        if (typeof event.time !== 'number' || !Number.isFinite(event.time)) return undefined
        if (event.time <= since) continue
        const source = record(record(event.data).source)
        if (source.kind !== 'user' && source.kind !== undefined) continue
        if (typeof source.rpcId !== 'string' || !known.has(source.rpcId)) return true
      }
      return false
    },
    async observeRequest(sessionId, requestId) {
      if (text(sessionId) === undefined || text(requestId) === undefined) return { state: 'unobservable', reason: 'invalid-request-identity' }
      let inspection: RecordValue
      try { inspection = await snapshotOf(sessionId) } catch (error) {
        return isMissingSession(error) ? { state: 'failed', reason: 'session-missing' } : { state: 'unobservable', reason: 'inspection-failed' }
      }
      const meta = record(inspection.meta ?? inspection.header)
      if (meta.id !== sessionId) return { state: 'unobservable', reason: 'session-identity-unconfirmed' }
      if (!Array.isArray(inspection.events)) return { state: 'unobservable', reason: 'event-inspection-unavailable' }
      const events = inspection.events.map(record).filter(event => Number.isInteger(event.seq)).sort((a, b) => Number(a.seq) - Number(b.seq))
      const input = events.find(event => event.type === 'user/message' && record(record(event.data).source).rpcId === requestId)
      if (input === undefined) return { state: 'pending' }
      const inputSeq = Number(input.seq)
      const start = events.filter(event => event.type === 'turn/start' && Number(event.seq) < inputSeq).at(-1)
      const turn = record(start?.data).turn
      if (typeof turn !== 'number' || !Number.isInteger(turn)) return { state: 'unobservable', inputSeq, reason: 'turn-identity-unconfirmed' }
      const end = events.find(event => event.type === 'turn/end' && Number(event.seq) > inputSeq && record(event.data).turn === turn)
      if (end === undefined) return { state: 'started', turn, inputSeq }
      const kind = text(record(record(end.data).reason).kind)
      // Do not retain source objects or error/message bodies in a team receipt.
      if (kind === 'completed') return { state: 'completed', turn, inputSeq }
      return { state: 'failed', turn, inputSeq, reason: kind ?? 'turn-ended-without-completion' }
    },
    async deliver(sessionId, envelope) {
      if (envelope.mode !== 'queue' && envelope.mode !== 'steer') throw new LiveTeamsError('DELIVERY_REJECTED', `Unsupported delivery mode "${String(envelope.mode)}"`)
      try { await controller.prompt({ requestId: envelope.requestId, sessionId, mode: envelope.mode, content: envelope.content }, new AbortController().signal); return { accepted: true } } catch (error) { throw toBridgeError(error) }
    },
    async interrupt(sessionId, _reason) {
      try { controller.cancel({ sessionId }); return { accepted: true } } catch (error) { throw toBridgeError(error) }
    },
    async reconcile(sessionIds) {
      const descriptors: SessionDescriptor[] = []
      for (const sessionId of sessionIds) { const descriptor = await bridge.inspect(sessionId); if (descriptor !== undefined) descriptors.push(descriptor) }
      return descriptors
    },
  }
  return Object.freeze(bridge)
}
