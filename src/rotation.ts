/**
 * Automatic member rotation.
 *
 * A member is a long-lived Session, and every turn re-sends the whole transcript. Measured on this
 * product's own team (200 tasks, 7 700 model calls) the average prompt was ~460k tokens while a
 * fresh Session starts at ~19k: the transcript, not the system prompt, is what costs. Compaction
 * does not fix that — it runs repeatedly (53–102 prunes per heavy Session) and the window still
 * settles around half a million tokens, while each compaction is itself a full-context call and a
 * lossy summary of ids and evidence that the review protocol depends on.
 *
 * Rotation is therefore a *membership* operation, not a Session delete: a new Session is created,
 * the rota moves onto it (name, role, note, contact grants, lead selection), and the old member id
 * is archived. The old Session stays readable, the durable record (task documents, submissions,
 * reviews, briefing, member note) carries the memory, and the new member id starts with a clean
 * completed-task count — which is what makes the task limit self-resetting.
 *
 * Two independent limits are supported on purpose. A context cap never fires for a member that
 * works in many short turns; a task cap never fires for one very long turn. Either one alone is a
 * half-measure, so both are configurable and both default to a value that was measured rather than
 * guessed.
 */
import { randomUUID } from 'node:crypto'
import { ERROR_CODES, LiveTeamsError } from './errors.js'
import type { ModelSelection } from './session-bridge.js'
import type { MemberRecord, TeamState } from './team-store.js'

export interface RotationConfig {
  readonly enabled: boolean
  /** Rotate once the member's last observed prompt reached this many tokens. `0` disables. */
  readonly maxContextTokens: number
  /** Rotate after this many completed tasks on the current member id. `0` disables. */
  readonly maxCompletedTasks: number
  /** Quiet period after a refused or failed rotation, so a broken member is not retried every pass. */
  readonly cooldownMs: number
  /** How many members one pass may rotate. One by default: each rotation creates a Session. */
  readonly maxRotationsPerPass: number
  /**
   * Roles that are never rotated.
   *
   * A coordinator's value is its accumulated state — which tasks it closed, which decisions it made,
   * what it already asked for. Rotation deliberately drops that, and a fresh coordinator then tends to
   * rebuild it from the archive: measured on a real team, a rotated lead spent thirteen minutes and
   * sixty calls reading sixteen accepted tasks — as much as three hours of its normal work. Workers
   * lose little by comparison, because their state is the task document.
   */
  readonly excludeRoles: readonly string[]
}

/**
 * The defaults are the numbers this team actually reached. 150k is roughly one task's worth of
 * context on top of a fresh Session, so a member rotates at the point where the transcript starts
 * costing more than the work; five accepted tasks is the point where the previous task's evidence
 * stops being read and starts being re-sent.
 */
export const DEFAULT_ROTATION_CONFIG: RotationConfig = Object.freeze({
  enabled: false,
  maxContextTokens: 150_000,
  maxCompletedTasks: 5,
  cooldownMs: 10 * 60_000,
  maxRotationsPerPass: 1,
  // The lead is excluded by default: it is the one member whose memory is the product, and a fresh
  // coordinator rebuilds it expensively (see the field's comment).
  excludeRoles: Object.freeze(['lead']),
})

export type RotationReason = 'max-context-tokens' | 'max-completed-tasks'

export type RotationSkip =
  | 'disabled'
  | 'no-session'
  | 'paused'
  | 'excluded-role'
  | 'active-attempt'
  | 'open-tasks'
  | 'session-running'
  | 'undelivered-messages'
  | 'below-threshold'

export interface RotationDecisionInput {
  readonly config: RotationConfig
  readonly member: Pick<MemberRecord, 'sessionId' | 'availability' | 'role'>
  readonly completedTasks: number
  readonly openTasks: number
  readonly activeAttempt: boolean
  readonly sessionStatus: 'running' | 'idle' | 'unknown'
  readonly undeliveredMessages: number
  /** The member's last observed prompt size, or `undefined` when this host cannot measure it. */
  readonly contextTokens: number | undefined
}

export type RotationDecision =
  | { readonly rotate: true; readonly reason: RotationReason; readonly detail: string }
  | { readonly rotate: false; readonly skipped: RotationSkip }

export interface RotationFacts {
  readonly completedTasks: number
  readonly openTasks: number
  readonly activeAttempt: boolean
  readonly sessionStatus: 'running' | 'idle' | 'unknown'
  /** Mail the host is about to push to this Session; see `pendingMailFor`. */
  readonly undeliveredMessages: number
  /** Comments parked for this member's own next turn: recorded, never blocking. */
  readonly parkedMessages: number
  /** The old Session's agent preset, copied so the replacement works the same way. */
  readonly agentPreset?: string | undefined
  /**
   * The old Session's model choice. A Session carries its own model, and `session.create` accepts
   * none: without this a rotated member silently falls back to the deployment default, which is the
   * one visible way rotation could change the quality of the work.
   */
  readonly modelSelection?: ModelSelection | undefined
  /** The old Session's current title, so the retired one keeps the name the human knows. */
  readonly sessionTitle?: string | undefined
}

export interface RotationOutcome {
  readonly previousMemberId: string
  readonly memberId: string
  readonly previousSessionId: string
  readonly sessionId: string
  readonly reason: RotationReason
  readonly detail: string
  readonly completedTasks: number
  readonly contextTokens?: number | undefined
  /** The model carried onto the replacement Session, when the old one named one. */
  readonly model?: ModelSelection | undefined
  /** The title the retired Session now carries, when it was stamped. */
  readonly retiredTitle?: string | undefined
}

export interface RotationCommit {
  readonly member: MemberRecord
  readonly previous: MemberRecord
}

export interface RotationPorts {
  readonly teamId: string
  readonly workspaceId: string
  readonly config: RotationConfig
  /** The effective config for this team: deployment row plus whatever the human set in the panel. */
  readonly configOf?: ((team: TeamState) => RotationConfig) | undefined
  readonly readTeam: () => Promise<TeamState>
  readonly commit: (request: {
    expectedRevision: number
    mutate: (state: TeamState) => RotationCommit
  }) => Promise<{ state: TeamState; value: RotationCommit }>
  readonly factsOf: (member: MemberRecord) => Promise<RotationFacts>
  readonly measureContextTokens: (sessionId: string) => Promise<number | undefined>
  readonly createSession: (request: { sessionId: string; workspaceId: string; agentPreset?: string }) => Promise<void>
  /**
   * Record a model selection on the replacement Session.
   *
   * Implemented as the same session event DSH's own composer writes, and deliberately *not* through
   * `sessionController.selectModel`: that call also persists the selection as the deployment-wide
   * default model, so copying one member's model would silently re-model every other Session in the
   * profile. Returns false when the host exposes no such seam.
   */
  readonly applyModelSelection?: ((sessionId: string, selection: ModelSelection) => Promise<boolean>) | undefined
  /**
   * Stamp the replaced Session so the two Sessions are distinguishable in the session list.
   *
   * Returns the title that was applied, or `undefined` when nothing was renamed (already stamped, no
   * title service, or the base was refused). Called only after the membership commit: a rotation that
   * was refused must not rename a Session that stays a member.
   */
  readonly retireTitle?: ((request: {
    sessionId: string
    displayName: string
    previousTitle?: string
    at: number
  }) => Promise<string | undefined>) | undefined
  readonly newSessionId: () => string
  readonly audit: (event: Record<string, unknown>) => Promise<void>
  /** Wire the new Session into the host's session→binding map before its first turn. */
  readonly onRotated?: ((outcome: RotationOutcome) => void) | undefined
  readonly titleSession?: ((sessionId: string, displayName: string) => Promise<void>) | undefined
  readonly logger?: ((message: string) => void) | undefined
  readonly now?: (() => number) | undefined
}

export interface RotationService {
  readonly config: RotationConfig
  /** One pass: at most `maxRotationsPerPass` rotations, never throwing at the caller. */
  readonly check: () => Promise<readonly RotationOutcome[]>
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Normalize the `rotation` config row.
 *
 * Like `codingDispatch`, this fails closed: a typo must not start replacing Sessions. Unknown keys
 * are ignored rather than refused, because a profile written for a newer build should still mount.
 */
export function readRotationConfig(value: unknown): { config: RotationConfig; warnings: readonly string[] } {
  const source = record(value)
  const warnings: string[] = []
  const enabled = source.enabled === true
  if (source.enabled !== undefined && typeof source.enabled !== 'boolean') {
    warnings.push('live-teams: rotation.enabled must be true or false; rotation stays disabled')
  }
  const amount = (name: 'maxContextTokens' | 'maxCompletedTasks' | 'cooldownMs' | 'maxRotationsPerPass', fallback: number): number => {
    const raw = source[name]
    if (raw === undefined) return fallback
    if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return Math.floor(raw)
    warnings.push(`live-teams: rotation.${name} must be a non-negative number; using ${fallback}`)
    return fallback
  }
  const config: RotationConfig = {
    enabled,
    maxContextTokens: amount('maxContextTokens', DEFAULT_ROTATION_CONFIG.maxContextTokens),
    maxCompletedTasks: amount('maxCompletedTasks', DEFAULT_ROTATION_CONFIG.maxCompletedTasks),
    cooldownMs: amount('cooldownMs', DEFAULT_ROTATION_CONFIG.cooldownMs),
    maxRotationsPerPass: amount('maxRotationsPerPass', DEFAULT_ROTATION_CONFIG.maxRotationsPerPass),
    excludeRoles: excludedRoles(source, warnings),
  }
  if (enabled && config.maxContextTokens === 0 && config.maxCompletedTasks === 0) {
    warnings.push('live-teams: rotation is enabled with both limits at 0; nothing will ever rotate')
  }
  return { config, warnings }
}

/**
 * The roles a deployment has excluded from rotation.
 *
 * A wrong entry is dropped rather than fatal: the setting is a guard, and half a guard is better than
 * a plugin that refuses to mount. The warning names what was ignored.
 */
function excludedRoles(source: Record<string, unknown>, warnings: string[]): readonly string[] {
  const raw = source.excludeRoles
  if (raw === undefined) return DEFAULT_ROTATION_CONFIG.excludeRoles
  if (!Array.isArray(raw)) {
    warnings.push('live-teams: rotation.excludeRoles must be a list of role ids; using the default')
    return DEFAULT_ROTATION_CONFIG.excludeRoles
  }
  const roles = raw.filter((role): role is string => typeof role === 'string' && role.trim().length > 0).map((role) => role.trim())
  if (roles.length !== raw.length) warnings.push('live-teams: rotation.excludeRoles ignored a value that is not a role id')
  return roles
}

/**
 * Apply a team's rotation overrides on top of the deployment row.
 *
 * Only the three numbers the panel owns are overridable here: `excludeRoles`, `cooldownMs` and
 * `maxRotationsPerPass` stay operator decisions, because they shape what the product does rather than
 * what one team wants this week.
 */
export function effectiveRotationConfig(base: RotationConfig, override: unknown): RotationConfig {
  const source = record(override)
  // Strict on purpose: the store rejects a fractional limit when it is written, so a fraction here
  // means the file was edited by hand. Flooring it would silently accept a number nobody chose.
  const amount = (name: 'maxContextTokens' | 'maxCompletedTasks', fallback: number): number => {
    const raw = source[name]
    return typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 ? raw : fallback
  }
  return {
    ...base,
    enabled: typeof source.enabled === 'boolean' ? source.enabled : base.enabled,
    maxContextTokens: amount('maxContextTokens', base.maxContextTokens),
    maxCompletedTasks: amount('maxCompletedTasks', base.maxCompletedTasks),
  }
}

/**
 * Split a member's stored mail into what blocks a rotation and what does not.
 *
 * `state === 'stored'` alone is too coarse. A `comment` carries `wakePolicy: 'never'`: it never wakes a
 * Session and waits for the member's own next turn, which on a busy team can be days — the first
 * version of this guard therefore froze a reviewer with 727k tokens of context for three days on
 * comments nobody was ever going to push. Only mail the host is about to push (`queue`/`steer`) may
 * block, because that is mail a rotation would actually drop mid-flight. Parked comments are counted
 * and recorded in the journal, and the mailbox marks them undelivered for the retired id on the next
 * pass — visible, not silent.
 */
export interface MailRow {
  readonly recipient?: unknown
  readonly state?: unknown
  readonly wakePolicy?: unknown
}

export function pendingMailFor(deliveries: readonly MailRow[], memberId: string): { pushPending: number; parked: number } {
  let pushPending = 0
  let parked = 0
  for (const delivery of deliveries) {
    if (delivery.recipient !== memberId || delivery.state !== 'stored') continue
    if (delivery.wakePolicy === 'never') parked += 1
    else pushPending += 1
  }
  return { pushPending, parked }
}

/**
 * Whether this member should be replaced now.
 *
 * Every refusal is named, because "rotation did not happen" is otherwise indistinguishable from a
 * broken plugin: the pass reports the reason instead of staying silent.
 */
export function decideRotation(input: RotationDecisionInput): RotationDecision {
  const { config, member } = input
  if (!config.enabled) return { rotate: false, skipped: 'disabled' }
  if (text(member.sessionId) === undefined) return { rotate: false, skipped: 'no-session' }
  // A coordinator's memory is the work; a worker's is the task document. Checked before the work
  // guards so an excluded role never even reads its metrics.
  if (config.excludeRoles.includes(member.role)) return { rotate: false, skipped: 'excluded-role' }
  if (member.availability === 'paused') return { rotate: false, skipped: 'paused' }
  // Work that is still owned is the one thing a rotation must never take away: the task contract,
  // its review route and the attempt all name this member id.
  if (input.activeAttempt) return { rotate: false, skipped: 'active-attempt' }
  if (input.openTasks > 0) return { rotate: false, skipped: 'open-tasks' }
  // A running turn is mid-write: the new Session would start while the old one is still finishing.
  if (input.sessionStatus === 'running') return { rotate: false, skipped: 'session-running' }
  // Mail that is stored but not yet delivered would be delivered to a member that no longer exists.
  if (input.undeliveredMessages > 0) return { rotate: false, skipped: 'undelivered-messages' }
  if (config.maxContextTokens > 0 && input.contextTokens !== undefined && input.contextTokens >= config.maxContextTokens) {
    return { rotate: true, reason: 'max-context-tokens', detail: `context ${input.contextTokens} ≥ ${config.maxContextTokens} tokens` }
  }
  if (config.maxCompletedTasks > 0 && input.completedTasks >= config.maxCompletedTasks) {
    return { rotate: true, reason: 'max-completed-tasks', detail: `${input.completedTasks} completed tasks ≥ ${config.maxCompletedTasks}` }
  }
  return { rotate: false, skipped: 'below-threshold' }
}

export function createRotationService(ports: RotationPorts): RotationService {
  const clock = ports.now ?? Date.now
  const logger = ports.logger ?? ((): void => undefined)
  const sessionIdFor = ports.newSessionId
  /** Member id → earliest moment it may be rotated again. Failure backoff, not a threshold. */
  const blockedUntil = new Map<string, number>()
  let running: Promise<readonly RotationOutcome[]> | undefined

  async function rotateOne(
    team: TeamState,
    member: MemberRecord,
    facts: RotationFacts,
    decision: Extract<RotationDecision, { rotate: true }>,
    contextTokens: number | undefined,
  ): Promise<RotationOutcome | undefined> {
    const previousSessionId = text(member.sessionId)
    if (previousSessionId === undefined) return undefined
    const sessionId = sessionIdFor()
    const now = clock()
    await ports.createSession({
      sessionId,
      workspaceId: ports.workspaceId,
      ...(facts.agentPreset === undefined ? {} : { agentPreset: facts.agentPreset }),
    })
    // Before the commit, so a replacement Session is never left on the wrong model even for the
    // window between creation and membership. A host without the seam keeps the default and says so
    // in the journal instead of pretending the choice was carried.
    let model: ModelSelection | undefined
    if (facts.modelSelection !== undefined && ports.applyModelSelection !== undefined) {
      const applied = await ports.applyModelSelection(sessionId, facts.modelSelection).catch((error: unknown) => {
        logger(`live-teams: rotation could not carry the model onto ${sessionId}: ${messageOf(error)}`)
        return false
      })
      if (applied) model = facts.modelSelection
    }
    const memberId = `m-${randomUUID()}`
    let committed: { state: TeamState; value: RotationCommit }
    try {
      committed = await ports.commit({
        expectedRevision: team.revision,
        mutate: (state) => {
          const index = state.members.findIndex((entry) => entry.memberId === member.memberId)
          const current = index < 0 ? undefined : state.members[index]
          if (current === undefined) {
            throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `rotation target ${member.memberId} is no longer a member`, { auditDetail: 'rotation target disappeared' })
          }
          // The Session is the identity that matters: a member whose binding changed while the
          // replacement Session was being created must not be rewritten by this pass.
          if (current.sessionId !== previousSessionId) {
            throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `member ${member.memberId} was rebound to another Session during rotation`, { auditDetail: 'rotation target was rebound' })
          }
          const previous: MemberRecord = { ...current }
          const rotated: MemberRecord = {
            ...previous,
            memberId,
            sessionId,
            bindingGeneration: 1,
            contractRevision: 0,
            rotatedFrom: previous.memberId,
            rotatedAt: now,
          }
          state.members[index] = rotated
          state.archivedMemberIds.push(previous.memberId)
          if (state.leadMemberId === previous.memberId) state.leadMemberId = memberId
          if (state.contactGrants !== undefined) {
            // Standing grants are the lead's promise that these two may talk; the id changing under
            // it is not a reason to revoke it (removeMember does revoke, which is why this path
            // rewrites the record instead of calling it).
            state.contactGrants = state.contactGrants.map((grant) => ({
              ...grant,
              from: grant.from === previous.memberId ? memberId : grant.from,
              to: grant.to === previous.memberId ? memberId : grant.to,
            }))
          }
          return { member: rotated, previous }
        },
      })
    } catch (error) {
      // The Session exists before the membership does, and nothing here can delete it: the same
      // orphan createSessionMember records. Visible is better than silent.
      await ports.audit({ kind: 'session/orphaned', teamId: ports.teamId, sessionId, reason: messageOf(error), actor: 'rotation', at: now }).catch(() => undefined)
      throw error
    }
    // The replaced Session keeps its name, so it has to say which rotation retired it: after the
    // first rotation a human sees two Sessions with the same name, and "which of these is the live
    // lead" is the first question they ask. Best effort and after the commit — a refused rotation
    // must not rename a member that is still on the team.
    let retiredTitle: string | undefined
    if (ports.retireTitle !== undefined) {
      try {
        const stamped = await ports.retireTitle({
          sessionId: previousSessionId,
          displayName: committed.value.previous.displayName,
          ...(facts.sessionTitle === undefined ? {} : { previousTitle: facts.sessionTitle }),
          at: now,
        })
        if (stamped !== undefined) retiredTitle = stamped
      } catch (error) {
        logger(`live-teams: retired Session ${previousSessionId} kept its title: ${messageOf(error)}`)
      }
    }
    const outcome: RotationOutcome = {
      previousMemberId: committed.value.previous.memberId,
      memberId,
      previousSessionId,
      sessionId,
      reason: decision.reason,
      detail: decision.detail,
      completedTasks: facts.completedTasks,
      ...(contextTokens === undefined ? {} : { contextTokens }),
      ...(model === undefined ? {} : { model }),
      ...(retiredTitle === undefined ? {} : { retiredTitle }),
    }
    await ports.audit({
      kind: 'member/rotated',
      teamId: ports.teamId,
      memberId,
      previousMemberId: outcome.previousMemberId,
      sessionId,
      previousSessionId,
      displayName: committed.value.member.displayName,
      role: committed.value.member.role,
      reason: decision.reason,
      detail: decision.detail,
      completedTasks: facts.completedTasks,
      ...(contextTokens === undefined ? {} : { contextTokens }),
      // The model is in the journal because "the lead got slower after a rotation" is otherwise
      // invisible: the member name and role look identical on both sides of the event.
      ...(model === undefined ? {} : { model }),
      ...(retiredTitle === undefined ? {} : { retiredTitle }),
      // Parked comments do not block, so the event says they were left behind.
      ...(facts.parkedMessages === 0 ? {} : { parkedMessages: facts.parkedMessages }),
      at: now,
      actor: 'rotation',
    })
    ports.onRotated?.(outcome)
    if (ports.titleSession !== undefined) {
      try { await ports.titleSession(sessionId, committed.value.member.displayName) } catch (error) { logger(`live-teams: rotated member ${memberId} kept its default title: ${messageOf(error)}`) }
    }
    return outcome
  }

  async function pass(): Promise<readonly RotationOutcome[]> {
    // The team is read even when the deployment row is off, because the panel can turn rotation on
    // for one team without touching the profile. One extra state read per sweep is the price of a
    // setting that belongs to the human rather than to the operator.
    let team: TeamState
    try { team = await ports.readTeam() } catch (error) { logger(`live-teams: rotation could not read the team: ${messageOf(error)}`); return [] }
    const config = ports.configOf === undefined ? ports.config : ports.configOf(team)
    if (!config.enabled) return []
    const outcomes: RotationOutcome[] = []
    for (const member of team.members) {
      if (outcomes.length >= config.maxRotationsPerPass) break
      if (text(member.sessionId) === undefined) continue
      const until = blockedUntil.get(member.memberId)
      if (until !== undefined && clock() < until) continue
      let facts: RotationFacts
      try { facts = await ports.factsOf(member) } catch (error) { logger(`live-teams: rotation could not read member ${member.memberId}: ${messageOf(error)}`); continue }
      const sessionId = text(member.sessionId)
      let contextTokens: number | undefined
      if (sessionId !== undefined) {
        try { contextTokens = await ports.measureContextTokens(sessionId) } catch { contextTokens = undefined }
      }
      const decision = decideRotation({
        config,
        member,
        completedTasks: facts.completedTasks,
        openTasks: facts.openTasks,
        activeAttempt: facts.activeAttempt,
        sessionStatus: facts.sessionStatus,
        undeliveredMessages: facts.undeliveredMessages,
        contextTokens,
      })
      if (!decision.rotate) continue
      if (facts.parkedMessages > 0) {
        logger(`live-teams: rotating ${member.memberId} with ${facts.parkedMessages} parked comment(s); the mailbox will record them as undelivered for the retired id`)
      }
      try {
        const outcome = await rotateOne(team, member, facts, decision, contextTokens)
        if (outcome === undefined) continue
        outcomes.push(outcome)
        blockedUntil.delete(member.memberId)
      } catch (error) {
        // A refused rotation is retried only after the cool-down: calling createSession in a loop
        // would mint a Session per pass and orphan every one of them.
        if (config.cooldownMs > 0) blockedUntil.set(member.memberId, clock() + config.cooldownMs)
        logger(`live-teams: rotation of ${member.memberId} failed: ${messageOf(error)}`)
      }
    }
    return outcomes
  }

  return {
    config: ports.config,
    check: async () => {
      // Single-flight: the dispatcher sweeps and signals can overlap, and two passes rotating the
      // same member would race two commits for one member id.
      if (running !== undefined) return running
      running = pass()
      try { return await running } finally { running = undefined }
    },
  }
}
