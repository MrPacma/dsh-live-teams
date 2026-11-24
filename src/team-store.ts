import { promises as fs, readFileSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { ERROR_CODES, LiveTeamsError } from './errors.js'
import { CURRENT_SCHEMA_VERSION, atomicWriteJson, clone, fileExists, readJson, withProcessLock } from './storage.js'

export type TeamId = string
export type MemberId = string
export type SessionId = string
export type BindingGeneration = number
export type ContactTarget = string | 'human' | 'team'
export interface ContactGrant {
  from: MemberId
  to: ContactTarget
  grantedBy: string
  at: number
}

export interface MemberRecord {
  memberId: MemberId
  displayName: string
  role: string
  roles?: readonly string[]
  /** Short statement of this member's purpose in the team. */
  note?: string
  availability: string
  sessionId?: SessionId
  bindingGeneration: BindingGeneration
  contractRevision: number
  [key: string]: unknown
}

/**
 * Whether the dispatcher may start assigned work. `paused` stops starts and
 * nothing else: an attempt already running keeps running, ownership does not
 * move, and a delivery already queued for a member still reaches that member.
 */
export interface DispatchSwitch {
  mode: 'auto' | 'paused'
  /** Who flipped it: `human:desktop` or a lead member id. */
  by: string
  reason?: string
  at: number
}

/**
 * Rotation limits set from the Team tab.
 *
 * Absent keys fall back to the deployment row in the profile, so a team can turn rotation on or
 * change one limit without an operator editing `cordis.patch.yml` — and can turn it off again
 * without losing what the profile says.
 */
export interface TeamRotationSettings {
  enabled?: boolean
  maxContextTokens?: number
  maxCompletedTasks?: number
}

export interface TeamState {
  schemaVersion: number
  revision: number
  teamId: TeamId
  workspaceId: string
  workspacePath: string
  members: MemberRecord[]
  archivedMemberIds: string[]
  createdAt: number
  updatedAt: number
  /** Persisted human-readable team name (optional for pre-B10 state). */
  name?: string
  /** Human-selected lead member; omitted for legacy state until resolved by role. */
  leadMemberId?: MemberId
  /** Standing contact grants issued by the lead. */
  contactGrants?: ContactGrant[]
  /** Dispatch switch; absent means `auto` (the pre-B29 state). */
  dispatch?: DispatchSwitch
  /** Rotation overrides set by the human in the Team tab (B43). */
  rotation?: TeamRotationSettings
  [key: string]: unknown
}

type TeamLocation = {
  directory: string
  file: string
  eventsFile: string
  workspacePath: string
  workspaceId: string
  teamId: string
}

type StoreDefaults = { workspacePath?: string; workspaceId?: string; teamId?: string; name?: string }
export type TeamCandidate = {
  readonly teamId: string
  readonly name?: string
  readonly memberCount?: number
  readonly updatedAt?: number
  readonly usable?: boolean
  readonly reason?: string
}
/**
 * Replace one team id wherever it appears as a `teamId`, at any depth.
 *
 * Records repeat the id inside their own objects (`tasks[].teamId`,
 * `messages[].teamId`, …) and the read paths validate each record, so a shallow
 * rewrite is not enough.
 */
function restampTeamId(value: unknown, from: string, to: string): { value: unknown; changed: boolean } {
  if (Array.isArray(value)) {
    let changed = false
    const next = value.map((entry) => {
      const result = restampTeamId(entry, from, to)
      if (result.changed) changed = true
      return result.value
    })
    return changed ? { value: next, changed: true } : { value, changed: false }
  }
  // A string may *contain* the identity rather than equal it: an accepted task records the
  // absolute path of its archived document, and adopting the team moves that directory. The
  // first automatic adoption left `archivedPath` pointing into the old directory, and the
  // task then failed validation ("invalid task record") — the panel answered
  // `state unavailable` while the journal and the team status kept working.
  if (typeof value === 'string') {
    const marker = `${path.sep}teams${path.sep}${from}${path.sep}`
    return value.includes(marker) ? { value: value.split(marker).join(`${path.sep}teams${path.sep}${to}${path.sep}`), changed: true } : { value, changed: false }
  }
  if (value === null || typeof value !== 'object') return { value, changed: false }
  let changed = false
  const next: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (key === 'teamId' && entry === from) { next[key] = to; changed = true; continue }
    const result = restampTeamId(entry, from, to)
    if (result.changed) changed = true
    next[key] = result.value
  }
  return changed ? { value: next, changed: true } : { value, changed: false }
}

/**
 * Re-stamp every sibling state file an adopted team directory carries.
 *
 * Adoption moves `teams/<candidate>` to `teams/<derived>`, and each store
 * validates that the `teamId` inside its own files matches the team it was
 * opened for. Re-stamping only `team.json` therefore leaves every other store
 * unreadable. Observed live: after adopting `076467b6-…` as
 * `live-teams-workspace`, `tasks.json`, `messages.json`, `deliveries.json`,
 * `attempts.json`, `submissions.json`, `reviews.json` and `commands.json` still
 * named the old id, so the Tasks and Messages panels answered
 * `503 live-teams state unavailable` on every read.
 *
 * Preparation and writing are separate on purpose: a file that cannot be read
 * refuses the adoption *before* anything is written, so a failed adoption never
 * leaves a half-renamed candidate behind.
 */
async function prepareRestampedTeamState(directory: string, from: string, to: string): Promise<Array<{ file: string; value: unknown }>> {
  const names = await fs.readdir(directory)
  const prepared: Array<{ file: string; value: unknown }> = []
  for (const name of names.filter((entry) => entry.endsWith('.json') && entry !== 'team.json')) {
    let raw: unknown
    try {
      raw = await readJson(path.join(directory, name))
    } catch (error) {
      throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, `cannot adopt a team whose ${name} is unreadable`, { auditDetail: `invalid adoption state file ${name}`, cause: error })
    }
    const restamped = restampTeamId(raw, from, to)
    if (restamped.changed) prepared.push({ file: path.join(directory, name), value: restamped.value })
  }
  return prepared
}

export type TeamAdoption = { readonly state: TeamState; readonly adoptedFrom: string }
/**
 * Names the transport and the product already use for actors that are not members. A member with one
 * of these ids would send mail *as* that actor — `human` is trusted by the mailbox as a human
 * instruction — so the store refuses to persist such a member at all. The check lives here, not on
 * the HTTP boundary, because a route parser protects one door while the store protects every caller.
 */
export const RESERVED_ACTOR_NAMES: readonly string[] = ['human', 'scheduler', 'team', 'system', 'plugin', 'reconciler', 'mailbox', 'live-teams', 'live_teams']

export function isReservedActorName(memberId: string): boolean {
  return RESERVED_ACTOR_NAMES.includes(memberId.trim().toLowerCase())
}

/**
 * Who leads this team: the recorded lead when it is still a member, otherwise the single member
 * holding the lead role, otherwise nobody. One definition, because the roster a member is shown and
 * the gate that admits its calls must agree — the expression used to be inlined in a dozen places,
 * and the first change to the rule would have desynchronised them (external review, finding 7).
 */
export function resolveLeadMemberId(team: Pick<TeamState, 'leadMemberId' | 'members'>): string | undefined {
  if (team.leadMemberId !== undefined && team.members.some((member) => member.memberId === team.leadMemberId)) return team.leadMemberId
  const leads = team.members.filter((member) => member.role === 'lead')
  return leads.length === 1 ? leads[0]?.memberId : undefined
}

const TEAM_ROOT = '.dsh-live-teams'

/**
 * Make the state directory ignore itself.
 *
 * The plugin writes `.dsh-live-teams/` into the *user's* project, and whether that shows up as
 * untracked depends on the project's own `.gitignore` — which is not ours to edit. A one-line
 * `.gitignore` inside the directory makes it invisible to git everywhere, the way `.git/` is, so a
 * `git add -A` in a project that never heard of this plugin cannot pick up a team's tasks, attempts
 * and journal. Written only when missing: an existing file is the project's business, not ours.
 */
async function ensureSelfIgnoringRoot(root: string): Promise<void> {
  const marker = path.join(root, '.gitignore')
  try {
    if (await fileExists(marker)) return
    await fs.writeFile(marker, '# Written by dsh-live-teams: team state is data, not source.\n*\n', 'utf8')
  } catch { /* a read-only or absent workspace is not a reason to fail opening a team */ }
}
const DISABLED_MARKER = 'disabled'

function canonicalWorkspacePath(value: string): string {
  const resolved = path.resolve(value)
  try { return realpathSync.native(resolved) } catch { return resolved }
}

function candidateId(value: string): boolean { return value.length > 0 && value !== '.' && value !== '..' && !value.includes('/') && !value.includes('\\') }

function objectRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function safeAdoptionPath(root: string, candidate: string): boolean {
  const resolvedRoot = path.resolve(root)
  const resolvedCandidate = path.resolve(candidate)
  return resolvedCandidate.startsWith(`${resolvedRoot}${path.sep}`)
}

function adoptionState(value: unknown): TeamState {
  const candidate = objectRecord(value)
  if (candidate === undefined
    || !Number.isInteger(candidate.schemaVersion) || Number(candidate.schemaVersion) > CURRENT_SCHEMA_VERSION
    || !Number.isInteger(candidate.revision)
    || typeof candidate.teamId !== 'string' || candidate.teamId.length === 0
    || typeof candidate.workspaceId !== 'string' || candidate.workspaceId.length === 0
    || typeof candidate.workspacePath !== 'string' || candidate.workspacePath.length === 0
    || !Array.isArray(candidate.members) || !Array.isArray(candidate.archivedMemberIds)
    || !Number.isInteger(candidate.createdAt) || !Number.isInteger(candidate.updatedAt)) {
    throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, 'invalid candidate state')
  }
  const members: MemberRecord[] = []
  for (const raw of candidate.members) {
    const member = objectRecord(raw)
    // Validate a candidate exactly as the read path does. A laxer check here
    // adopts state the reader then refuses, which shows as an enabled team whose
    // members are unavailable — worse than refusing the candidate outright.
    if (member === undefined || typeof member.memberId !== 'string' || member.memberId.length === 0
      || typeof member.displayName !== 'string' || member.displayName.length === 0
      || typeof member.role !== 'string' || member.role.length === 0
      || typeof member.availability !== 'string' || member.availability.length === 0
      || (member.sessionId !== undefined && (typeof member.sessionId !== 'string' || member.sessionId.length === 0))
      || !Number.isInteger(member.bindingGeneration) || Number(member.bindingGeneration) < 0
      || !Number.isInteger(member.contractRevision) || Number(member.contractRevision) < 0) {
      throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, 'invalid candidate member')
    }
    members.push(member as MemberRecord)
  }
  if (!candidate.archivedMemberIds.every((id): id is string => typeof id === 'string' && id.length > 0)) {
    throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, 'invalid archived member list')
  }
  return candidate as unknown as TeamState
}

async function adoptionDirectoryOccupied(directory: string): Promise<{ hasMembers: boolean; hasOtherAudit: boolean }> {
  try {
    const raw = await readJson(path.join(directory, 'team.json'))
    const state = adoptionState(raw)
    if (state.members.length > 0) return { hasMembers: true, hasOtherAudit: true }
    let events: unknown[] = []
    try {
      const contents = await fs.readFile(path.join(directory, 'events.jsonl'), 'utf8')
      // The audit is one JSON object per line. Splitting on a literal backslash-n
      // parsed nothing, and a parse failure here reads as "occupied", which made
      // every adoption fail once the audit held more than one event.
      events = contents.split('\n').filter((line) => line.trim().length > 0).map((line) => JSON.parse(line) as unknown)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') return { hasMembers: true, hasOtherAudit: true }
    }
    const hasOtherAudit = events.some((event) => {
      const kind = objectRecord(event)?.kind
      return kind !== 'team/enabled' && kind !== 'team/disabled'
    })
    return { hasMembers: false, hasOtherAudit }
  } catch {
    return { hasMembers: true, hasOtherAudit: true }
  }
}

export class TeamStore {
  private readonly defaults: StoreDefaults
  private readonly locations = new Map<string, TeamLocation>()

  constructor(defaults: StoreDefaults = {}) { this.defaults = defaults }

  async open(request: StoreDefaults = {}): Promise<TeamState> {
    const workspacePath = request.workspacePath ?? this.defaults.workspacePath
    const workspaceId = request.workspaceId ?? this.defaults.workspaceId
    if (!workspacePath || !workspaceId) throw new TypeError('workspacePath and workspaceId are required')
    const teamId = request.teamId ?? this.defaults.teamId ?? workspaceId
    const initialName = request.name ?? this.defaults.name
    const location = this.location(workspacePath, workspaceId, teamId)
    await withProcessLock(location.file, async () => {
      await fs.mkdir(location.directory, { recursive: true })
      await ensureSelfIgnoringRoot(path.resolve(workspacePath, TEAM_ROOT))
      if (!(await fileExists(location.file))) {
        const now = Date.now()
        await atomicWriteJson(location.file, {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          revision: 0,
          teamId,
          workspaceId,
          workspacePath: path.resolve(workspacePath),
          ...(typeof initialName === 'string' && initialName.length > 0 ? { name: initialName } : {}),
          members: [],
          archivedMemberIds: [],
          createdAt: now,
          updatedAt: now,
        } satisfies TeamState)
      }
      await this.read(location)
    })
    this.locations.set(teamId, location)
    return this.read(location)
  }

  isDisabledSync(teamId: string): boolean {
    try { readFileSync(path.join(this.requireLocation(teamId).directory, DISABLED_MARKER), 'utf8'); return true } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
      throw error
    }
  }

  async readExisting(request: StoreDefaults = {}): Promise<TeamState | undefined> {
    const workspacePath = request.workspacePath ?? this.defaults.workspacePath
    const workspaceId = request.workspaceId ?? this.defaults.workspaceId
    if (!workspacePath || !workspaceId) throw new TypeError('workspacePath and workspaceId are required')
    const teamId = request.teamId ?? this.defaults.teamId ?? workspaceId
    const location = this.location(workspacePath, workspaceId, teamId)
    if (!(await fileExists(location.file))) return undefined
    this.locations.set(teamId, location)
    return this.read(location)
  }

  async isDisabled(teamId: string): Promise<boolean> {
    return fileExists(path.join(this.requireLocation(teamId).directory, DISABLED_MARKER))
  }

  /** Discover old team directories in this workspace without creating state. */
  async listAdoptionCandidates(request: { workspacePath: string; derivedTeamId: string }): Promise<TeamCandidate[]> {
    const teamsDirectory = path.resolve(request.workspacePath, TEAM_ROOT, 'teams')
    let entries: import('node:fs').Dirent[]
    try { entries = await fs.readdir(teamsDirectory, { withFileTypes: true }) } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }
    const candidates: TeamCandidate[] = []
    for (const entry of entries) {
      // Anything the plugin set aside next to the derived team is its own
      // bookkeeping — a replaced copy, or a directory parked by hand — and is
      // not a team the human can choose.
      if (!entry.isDirectory() || entry.name.startsWith(`${request.derivedTeamId}.`) || !candidateId(entry.name) || entry.name === request.derivedTeamId) continue
      const directory = path.join(teamsDirectory, entry.name)
      try {
        const state = await readJson(path.join(directory, 'team.json'))
        const checked = adoptionState(state)
        candidates.push({
          teamId: entry.name,
          name: typeof checked.name === 'string' && checked.name.trim().length > 0 ? checked.name.trim() : entry.name,
          memberCount: checked.members.length,
          updatedAt: checked.updatedAt,
        })
      } catch {
        candidates.push({ teamId: entry.name, usable: false, reason: 'invalid state' })
      }
    }
    return candidates.sort((left, right) => {
      const leftUsable = left.usable !== false
      const rightUsable = right.usable !== false
      if (leftUsable !== rightUsable) return leftUsable ? -1 : 1
      const memberOrder = (right.memberCount ?? -1) - (left.memberCount ?? -1)
      if (memberOrder !== 0) return memberOrder
      const updatedOrder = (right.updatedAt ?? -1) - (left.updatedAt ?? -1)
      if (updatedOrder !== 0) return updatedOrder
      return left.teamId < right.teamId ? -1 : left.teamId > right.teamId ? 1 : 0
    })
  }

  /** Adopt one old team into the workspace-derived directory. */
  async adoptTeam(request: { workspacePath: string; workspaceId: string; derivedTeamId: string; candidateTeamId: string; replaceEmptyDerived: boolean; actor?: string }): Promise<TeamAdoption> {
    if (!candidateId(request.candidateTeamId) || !candidateId(request.derivedTeamId) || request.candidateTeamId === request.derivedTeamId) {
      throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'invalid request', { auditDetail: 'invalid adoption path' })
    }
    const canonicalWorkspace = canonicalWorkspacePath(request.workspacePath)
    const teamsDirectory = path.join(canonicalWorkspace, TEAM_ROOT, 'teams')
    const candidateDirectory = path.join(teamsDirectory, request.candidateTeamId)
    const derivedDirectory = path.join(teamsDirectory, request.derivedTeamId)
    if (!safeAdoptionPath(teamsDirectory, candidateDirectory) || !safeAdoptionPath(teamsDirectory, derivedDirectory)) {
      throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'invalid request', { auditDetail: 'invalid adoption path' })
    }
    let candidateRealPath: string
    try { candidateRealPath = realpathSync.native(candidateDirectory) } catch (error) {
      throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'invalid request', { auditDetail: 'invalid adoption path', cause: error })
    }
    if (!safeAdoptionPath(realpathSync.native(teamsDirectory), candidateRealPath)) {
      throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'invalid request', { auditDetail: 'invalid adoption path' })
    }
    let candidateRaw: unknown
    try { candidateRaw = await readJson(path.join(candidateDirectory, 'team.json')) } catch (error) {
      throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'invalid request', { auditDetail: 'invalid candidate state', cause: error })
    }
    const candidate = adoptionState(candidateRaw)
    if (await fileExists(derivedDirectory)) {
      const occupied = await adoptionDirectoryOccupied(derivedDirectory)
      if (occupied.hasMembers || occupied.hasOtherAudit) {
        throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'live-teams derived team already exists', { auditDetail: 'derived team already exists' })
      }
      if (!request.replaceEmptyDerived) {
        throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'live-teams derived team already exists', { auditDetail: 'derived team already exists' })
      }
      const replaced = `${derivedDirectory}.${Date.now()}.replaced`
      await fs.rename(derivedDirectory, replaced)
    }
    const rewritten = {
      ...candidate,
      teamId: request.derivedTeamId,
      workspaceId: request.workspaceId,
      workspacePath: canonicalWorkspace,
    } as TeamState
    // Read everything that must be re-stamped before writing anything, so a
    // refusal leaves the candidate exactly as it was found.
    const restamped = await prepareRestampedTeamState(candidateDirectory, request.candidateTeamId, request.derivedTeamId)
    await atomicWriteJson(path.join(candidateDirectory, 'team.json'), rewritten)
    for (const entry of restamped) await atomicWriteJson(entry.file, entry.value)
    await fs.rename(candidateDirectory, derivedDirectory)
    await fs.unlink(path.join(derivedDirectory, DISABLED_MARKER)).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    })
    const location = this.location(canonicalWorkspace, request.workspaceId, request.derivedTeamId)
    this.locations.set(request.derivedTeamId, location)
    await this.appendEvent(request.derivedTeamId, {
      kind: 'team/adopted',
      teamId: request.derivedTeamId,
      fromTeamId: request.candidateTeamId,
      name: typeof candidate.name === 'string' && candidate.name.trim().length > 0 ? candidate.name.trim() : request.candidateTeamId,
      memberCount: candidate.members.length,
      at: Date.now(),
      // A human clicked adopt, or the plugin found the workspace's own team under another
      // id after the registry re-created the entry. The audit says which.
      actor: request.actor ?? 'human:desktop',
    })
    return { state: rewritten, adoptedFrom: request.candidateTeamId }
  }

  /**
   * Adopt the workspace's own team when it sits under another workspace id.
   *
   * The registry mints a new id whenever an entry is re-created, and the team directory is
   * named by id — so after such an event the panel showed an empty team while the real one
   * (members, tasks, journal) sat right next to it, and only a human clicking "adopt" could
   * bring it back. The canonical path is the stable identity here; the id is a registry
   * variable, so it is adopted rather than treated as a reason to refuse.
   *
   * Deliberately conservative: only one usable candidate, only if it has members, only if it
   * declares this path, and never when the current directory already holds a live team. An
   * ambiguous set stays a human decision — the panel already offers the choice.
   */
  async adoptByPath(request: { workspacePath: string; workspaceId: string; teamId: string; actor?: string }): Promise<{ adoptedFrom: string; memberCount: number } | undefined> {
    const canonical = canonicalWorkspacePath(request.workspacePath)
    const candidates = (await this.listAdoptionCandidates({ workspacePath: request.workspacePath, derivedTeamId: request.teamId }))
      .filter((candidate) => candidate.usable !== false && (candidate.memberCount ?? 0) > 0)
    if (candidates.length !== 1) return undefined
    const candidate = candidates[0] as TeamCandidate
    // A directory that declares another workspace path is not ours, whatever it is doing
    // inside our teams folder (a hand copy, a restore).
    try {
      const declared = await readJson(path.join(canonical, TEAM_ROOT, 'teams', candidate.teamId, 'team.json'))
      const declaredPath = typeof declared === 'object' && declared !== null ? (declared as { workspacePath?: unknown }).workspacePath : undefined
      if (typeof declaredPath === 'string' && canonicalWorkspacePath(declaredPath) !== canonical) return undefined
    } catch { return undefined }
    try {
      const adopted = await this.adoptTeam({
        workspacePath: canonical,
        workspaceId: request.workspaceId,
        derivedTeamId: request.teamId,
        candidateTeamId: candidate.teamId,
        replaceEmptyDerived: true,
        ...(request.actor === undefined ? {} : { actor: request.actor }),
      })
      return { adoptedFrom: adopted.adoptedFrom, memberCount: candidate.memberCount ?? 0 }
    } catch {
      // The current directory already holds a team of its own (its members, or its audit):
      // that one wins, and the candidate stays for the human to choose.
      return undefined
    }
  }

  async setDisabled(teamId: string, disabled: boolean): Promise<void> {
    const location = this.requireLocation(teamId)
    await withProcessLock(location.file, async () => {
      if (disabled) await fs.writeFile(path.join(location.directory, DISABLED_MARKER), '', { flag: 'wx', mode: 0o600 }).catch((error: unknown) => {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      })
      else await fs.unlink(path.join(location.directory, DISABLED_MARKER)).catch((error: unknown) => {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      })
    })
  }

  async renameTeam(teamId: string, expectedRevision: number, name: string): Promise<{ state: TeamState; from: string }> {
    const result = await this.commit(teamId, {
      expectedRevision,
      mutate: (state) => {
        const from = state.name ?? state.teamId
        state.name = name
        return from
      },
    })
    return { state: result.state, from: result.value }
  }

  /**
   * Flip the dispatch switch. Authority belongs to the callers, exactly as it does
   * for `renameTeam`: the desktop route admits the human, and the lead-only tool
   * admits the lead. A request that changes nothing is refused rather than silently
   * accepted, so a double click cannot look like a state change that never happened.
   */
  async setDispatchMode(teamId: string, mode: DispatchSwitch['mode'], request: { actor: string; reason?: string }, expectedRevision: number): Promise<{ state: TeamState; from: DispatchSwitch['mode']; to: DispatchSwitch['mode'] }> {
    if (mode !== 'auto' && mode !== 'paused') throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `unknown dispatch mode: ${String(mode)}`)
    const result = await this.commit(teamId, {
      expectedRevision,
      mutate: (state) => {
        const from = readDispatchSwitch(state).mode
        if (from === mode) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `dispatch is already ${mode}`)
        state.dispatch = { mode, by: request.actor, ...(request.reason === undefined || request.reason.trim().length === 0 ? {} : { reason: request.reason.trim() }), at: Date.now() }
        return from
      },
    })
    return { state: result.state, from: result.value, to: mode }
  }

  async commit<T>(teamId: string, request: { expectedRevision: number; mutate: (state: TeamState) => T | Promise<T> }): Promise<{ state: TeamState; value: T }> {
    const location = this.requireLocation(teamId)
    if (!request || typeof request.mutate !== 'function' || !Number.isInteger(request.expectedRevision)) {
      throw new TypeError('expectedRevision and mutate are required')
    }
    return withProcessLock(location.file, async () => {
      const current = await this.read(location)
      if (current.revision !== request.expectedRevision) {
        throw new LiveTeamsError(ERROR_CODES.REVISION_CONFLICT, `expected revision ${request.expectedRevision}, actual ${current.revision}`)
      }
      const working = clone(current)
      const value = await request.mutate(working)
      // The last door before the state is persisted: no mutation may mint a member whose id is one of
      // the transport's own actors. A member called `human` would send mail as the human, because the
      // mailbox trusts that name, and the audit would record work nobody did.
      const impostor = working.members.find((member) => isReservedActorName(member.memberId))
      if (impostor !== undefined) {
        throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `"${impostor.memberId}" is a reserved actor name and cannot be a member id; ids the transport uses for the human, the scheduler and the team itself are refused`)
      }
      working.revision = current.revision + 1
      working.updatedAt = Date.now()
      await atomicWriteJson(location.file, working)
      return { state: working, value }
    })
  }

  async memberBySession(teamId: string, sessionId: string): Promise<MemberRecord | undefined> {
    const state = await this.read(this.requireLocation(teamId))
    const member = state.members.find((entry) => entry.sessionId === sessionId)
    return member === undefined ? undefined : clone(member)
  }

  async bindSession(teamId: string, memberId: string, sessionId: string, expectedRevision: number): Promise<MemberRecord> {
    const result = await this.commit(teamId, {
      expectedRevision,
      mutate: (state) => {
        const member = state.members.find((entry) => entry.memberId === memberId)
        if (!member) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `member not found: ${memberId}`)
        const owner = state.members.find((entry) => entry.memberId !== memberId && entry.sessionId === sessionId)
        if (owner) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `session ${sessionId} is already bound to ${owner.memberId}`)
        member.sessionId = sessionId
        member.bindingGeneration += 1
        member.contractRevision = (member.contractRevision ?? 0) + 1
        return member
      },
    })
    return clone(result.value)
  }

  async unbindSession(teamId: string, memberId: string, expectedRevision: number): Promise<MemberRecord> {
    const result = await this.commit(teamId, {
      expectedRevision,
      mutate: (state) => {
        const member = state.members.find((entry) => entry.memberId === memberId)
        if (!member) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `member not found: ${memberId}`)
        delete member.sessionId
        member.bindingGeneration += 1
        member.contractRevision = (member.contractRevision ?? 0) + 1
        return member
      },
    })
    return clone(result.value)
  }

  /**
   * Name the lead, or clear the name.
   *
   * Clearing is a real operation, not an empty request: it returns the team to the fallback rule —
   * whoever holds the `lead` role — which is what a team with one lead relies on anyway. The panel
   * offered "Not set" and the server refused it with a 400, so the option did nothing.
   */
  async setLead(teamId: string, memberId: string | undefined, expectedRevision: number): Promise<TeamState> {
    const result = await this.commit(teamId, {
      expectedRevision,
      mutate: (state) => {
        if (memberId === undefined) { delete state.leadMemberId; return }
        if (!state.members.some((entry) => entry.memberId === memberId)) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `member not found: ${memberId}`)
        state.leadMemberId = memberId
      },
    })
    return result.state
  }

  async updateContactGrant(teamId: string, from: MemberId, to: ContactTarget, action: 'add' | 'remove', grantedBy: string): Promise<{ state: TeamState; grants: ContactGrant[]; changed: boolean }> {
    const location = this.requireLocation(teamId)
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const current = await this.read(location)
      const grants = current.contactGrants ?? []
      const exists = grants.some((grant) => grant.from === from && grant.to === to)
      if ((action === 'add' && exists) || (action === 'remove' && !exists)) return { state: clone(current), grants: clone(grants.filter((grant) => grant.from === from)), changed: false }
      try {
        const result = await this.commit(teamId, {
          expectedRevision: current.revision,
          mutate: (state) => {
            const next = state.contactGrants ?? []
            if (action === 'add') next.push({ from, to, grantedBy, at: Date.now() })
            else state.contactGrants = next.filter((grant) => !(grant.from === from && grant.to === to))
            if (action === 'add') state.contactGrants = next
            if (state.contactGrants?.length === 0) delete state.contactGrants
            return state.contactGrants?.filter((grant) => grant.from === from) ?? []
          },
        })
        return { state: result.state, grants: clone(result.value), changed: true }
      } catch (error) {
        if (error instanceof LiveTeamsError && error.code === ERROR_CODES.REVISION_CONFLICT && attempt < 2) continue
        throw error
      }
    }
    throw new LiveTeamsError(ERROR_CODES.REVISION_CONFLICT, 'contact grant revision conflict')
  }

  async setMemberNote(teamId: string, memberId: string, note: string, expectedRevision: number): Promise<{ state: TeamState; member: MemberRecord }> {
    const result = await this.commit(teamId, {
      expectedRevision,
      mutate: (state) => {
        const member = state.members.find((entry) => entry.memberId === memberId)
        if (member === undefined) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `member not found: ${memberId}`)
        member.note = note
        return member
      },
    })
    return { state: result.state, member: clone(result.value) }
  }

  async removeMember(teamId: string, memberId: string, expectedRevision: number): Promise<{ state: TeamState; removed: MemberRecord }> {
    const result = await this.commit(teamId, {
      expectedRevision,
      mutate: (state) => {
        if (state.archivedMemberIds.includes(memberId)) {
          throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `member already archived: ${memberId}`)
        }
        const index = state.members.findIndex((entry) => entry.memberId === memberId)
        if (index < 0) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `member not found: ${memberId}`)
        const removed = state.members[index]
        if (removed === undefined) throw new LiveTeamsError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `member not found: ${memberId}`)
        state.members.splice(index, 1)
        state.archivedMemberIds.push(memberId)
        if (state.leadMemberId === memberId) delete state.leadMemberId
        if (state.contactGrants !== undefined) {
          state.contactGrants = state.contactGrants.filter((grant) => grant.from !== memberId && grant.to !== memberId)
          if (state.contactGrants.length === 0) delete state.contactGrants
        }
        return clone(removed)
      },
    })
    return { state: result.state, removed: result.value }
  }

  async appendEvent(teamId: string, event: unknown): Promise<void> {
    const location = this.requireLocation(teamId)
    return withProcessLock(location.eventsFile, async () => {
      await fs.mkdir(location.directory, { recursive: true })
      const handle = await fs.open(location.eventsFile, 'a', 0o600)
      try { await handle.writeFile(`${JSON.stringify(event)}\n`, 'utf8'); await handle.sync() } finally { await handle.close() }
    })
  }

  /**
   * The audit, read from a byte offset when the caller has one.
   *
   * The journal grows forever and the panel re-reads it every few seconds; reading the whole file was
   * the one part of polling that got worse with age (a ten-times-longer journal meant seventeen
   * megabytes a minute). The file is append-only, so an offset is a safe cursor: the caller passes
   * back the offset this returned and pays only for what is new. Without an offset the tail is read —
   * never the whole history, which nobody reads in a panel anyway.
   */
  async readEvents(teamId: string, after?: number): Promise<{ events: unknown[]; torn: string | null; nextOffset: number; truncated: boolean }> {
    const location = this.requireLocation(teamId)
    if (!(await fileExists(location.eventsFile))) return { events: [], torn: null, nextOffset: 0, truncated: false }
    const size = (await fs.stat(location.eventsFile)).size
    const TAIL_BYTES = 256 * 1024
    // A negative offset means "the last N bytes"; that is the first read, when the caller has no
    // cursor yet and only recent history is worth showing.
    const from = after !== undefined && after >= 0 && after <= size ? after : Math.max(0, size - TAIL_BYTES)
    const truncated = after === undefined && from > 0
    const handle = await fs.open(location.eventsFile, 'r')
    let contents: string
    try {
      const length = size - from
      const buffer = Buffer.alloc(length)
      await handle.read(buffer, 0, length, from)
      contents = buffer.toString('utf8')
      // Drop a partial first line only when the offset really landed mid-record. Our cursors sit on
      // line boundaries, and dropping unconditionally threw away the whole delta — the check found it
      // as "a delta read returned nothing".
      if (from > 0) {
        const boundary = Buffer.alloc(1)
        await handle.read(boundary, 0, 1, from - 1)
        if (boundary[0] !== 0x0a) contents = contents.slice(contents.indexOf('\n') + 1)
      }
    } finally { await handle.close() }
    if (contents.length === 0) return { events: [], torn: null, nextOffset: size, truncated }
    const hasTrailingNewline = contents.endsWith('\n')
    const lines = contents.split('\n')
    if (hasTrailingNewline) lines.pop()
    const torn = hasTrailingNewline ? null : (lines.pop() ?? null)
    const events: unknown[] = []
    for (const line of lines) {
      if (!line.trim()) continue
      try { events.push(JSON.parse(line) as unknown) } catch (error) {
        throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, `invalid event record: ${error instanceof Error ? error.message : String(error)}`, { cause: error })
      }
    }
    // The cursor points at the end of the last complete line: a torn record stays for the next read.
    const consumed = contents.endsWith('\n') ? contents.length : contents.length - (torn?.length ?? 0)
    return { events, torn, nextOffset: from + Buffer.byteLength(contents.slice(0, consumed), 'utf8'), truncated }
  }

  private location(workspacePath: string, workspaceId: string, teamId: string): TeamLocation {
    const root = path.resolve(workspacePath, TEAM_ROOT, 'teams', teamId)
    return { directory: root, file: path.join(root, 'team.json'), eventsFile: path.join(root, 'events.jsonl'), workspacePath: path.resolve(workspacePath), workspaceId, teamId }
  }

  private requireLocation(teamId: string): TeamLocation {
    const location = this.locations.get(teamId)
    if (!location) throw new Error(`Team ${teamId} has not been opened`)
    return location
  }

  private async read(location: TeamLocation): Promise<TeamState> {
    let state: unknown
    try { state = await readJson(location.file) } catch (error) {
      const code = error !== null && typeof error === 'object' && 'code' in error ? (error as { code?: unknown }).code : undefined
      if (code === 'ENOENT') throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, `missing state file: ${location.file}`, { cause: error })
      if (error instanceof SyntaxError) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, `invalid JSON in ${location.file}: ${error.message}`, { cause: error })
      if (error instanceof LiveTeamsError) throw error
      throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, `cannot read ${location.file}: ${error instanceof Error ? error.message : String(error)}`, { cause: error })
    }
    if (state === null || typeof state !== 'object' || Array.isArray(state)) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, `state is not an object: ${location.file}`)
    const candidate = state as Partial<TeamState>
    if (!Number.isInteger(candidate.schemaVersion)) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, 'state schemaVersion is missing or invalid')
    const schemaVersion = candidate.schemaVersion
    if (schemaVersion === undefined) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, 'state schemaVersion is missing or invalid')
    if (schemaVersion > CURRENT_SCHEMA_VERSION) throw new LiveTeamsError(ERROR_CODES.SCHEMA_UNSUPPORTED, `schemaVersion ${candidate.schemaVersion} is newer than ${CURRENT_SCHEMA_VERSION}`)
    if (candidate.teamId !== location.teamId || candidate.workspaceId !== location.workspaceId || !Number.isInteger(candidate.revision) || !Array.isArray(candidate.members) || !Array.isArray(candidate.archivedMemberIds)) {
      throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, 'state identity or required fields are invalid')
    }
    return candidate as TeamState
  }

  memberBySessionSync(teamId: string, sessionId: string): MemberRecord | undefined {
    const location = this.requireLocation(teamId)
    return readMemberBySessionSync({ workspacePath: location.workspacePath, teamId, sessionId })
  }
}

export function createTeamStore(options: StoreDefaults = {}): TeamStore { return new TeamStore(options) }
export { TEAM_ROOT }

/**
 * Read the dispatch switch strictly: an absent switch is `auto`, and anything
 * malformed is corrupt state rather than a quiet fallback to automatic dispatch.
 */
export function readDispatchSwitch(state: TeamState): DispatchSwitch {
  const candidate = objectRecord(state.dispatch)
  if (candidate === undefined) return { mode: 'auto', by: 'default', at: 0 }
  if (candidate.mode !== 'auto' && candidate.mode !== 'paused') throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, 'state dispatch mode is invalid')
  if (typeof candidate.by !== 'string' || candidate.by.length === 0) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, 'state dispatch actor is invalid')
  if (!Number.isInteger(candidate.at)) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, 'state dispatch timestamp is invalid')
  if (candidate.reason !== undefined && typeof candidate.reason !== 'string') throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, 'state dispatch reason is invalid')
  return candidate as unknown as DispatchSwitch
}

/**
 * Read the team's rotation overrides strictly: an absent block means "nothing set here, use the
 * profile", and a malformed one is corrupt state rather than a quiet fallback to someone's guess
 * about which limit was meant.
 */
export function readTeamRotation(state: Pick<TeamState, 'rotation'>): TeamRotationSettings {
  const candidate = objectRecord(state.rotation)
  if (candidate === undefined) return {}
  const settings: TeamRotationSettings = {}
  if (candidate.enabled !== undefined) {
    if (typeof candidate.enabled !== 'boolean') throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, 'state rotation switch is invalid')
    settings.enabled = candidate.enabled
  }
  for (const key of ['maxContextTokens', 'maxCompletedTasks'] as const) {
    const raw = candidate[key]
    if (raw === undefined) continue
    if (!Number.isInteger(raw) || Number(raw) < 0) throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, `state rotation ${key} is invalid`)
    settings[key] = Number(raw)
  }
  return settings
}

export function readTeamStateSync(request: { workspacePath: string; teamId: string }): TeamState | undefined {
  const file = path.join(path.resolve(request.workspacePath), TEAM_ROOT, 'teams', request.teamId, 'team.json')
  let contents: string
  try { contents = readFileSync(file, 'utf8') } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
  let state: unknown
  try { state = JSON.parse(contents) as unknown } catch (error) {
    throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, `invalid JSON in ${file}`, { cause: error })
  }
  if (state === null || typeof state !== 'object' || Array.isArray(state) || !Array.isArray((state as { members?: unknown }).members)) {
    throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, `team state has no member list: ${file}`)
  }
  return clone(state as TeamState)
}

export function readMemberBySessionSync(request: { workspacePath: string; teamId: string; sessionId: string }): MemberRecord | undefined {
  const file = path.join(path.resolve(request.workspacePath), TEAM_ROOT, 'teams', request.teamId, 'team.json')
  let contents: string
  try { contents = readFileSync(file, 'utf8') } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
  const state: unknown = JSON.parse(contents)
  if (state === null || typeof state !== 'object' || !Array.isArray((state as { members?: unknown }).members)) {
    throw new LiveTeamsError(ERROR_CODES.STATE_CORRUPT, `team state has no member list: ${file}`)
  }
  const member = (state as { members: unknown[] }).members.find((entry): entry is MemberRecord => entry !== null && typeof entry === 'object' && (entry as { sessionId?: unknown }).sessionId === request.sessionId)
  return member === undefined ? undefined : clone(member)
}
