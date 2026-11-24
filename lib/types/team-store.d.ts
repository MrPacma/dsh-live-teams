export type TeamId = string;
export type MemberId = string;
export type SessionId = string;
export type BindingGeneration = number;
export type ContactTarget = string | 'human' | 'team';
export interface ContactGrant {
    from: MemberId;
    to: ContactTarget;
    grantedBy: string;
    at: number;
}
export interface MemberRecord {
    memberId: MemberId;
    displayName: string;
    role: string;
    roles?: readonly string[];
    /** Short statement of this member's purpose in the team. */
    note?: string;
    availability: string;
    sessionId?: SessionId;
    bindingGeneration: BindingGeneration;
    contractRevision: number;
    [key: string]: unknown;
}
/**
 * Whether the dispatcher may start assigned work. `paused` stops starts and
 * nothing else: an attempt already running keeps running, ownership does not
 * move, and a delivery already queued for a member still reaches that member.
 */
export interface DispatchSwitch {
    mode: 'auto' | 'paused';
    /** Who flipped it: `human:desktop` or a lead member id. */
    by: string;
    reason?: string;
    at: number;
}
/**
 * Rotation limits set from the Team tab.
 *
 * Absent keys fall back to the deployment row in the profile, so a team can turn rotation on or
 * change one limit without an operator editing `cordis.patch.yml` — and can turn it off again
 * without losing what the profile says.
 */
export interface TeamRotationSettings {
    enabled?: boolean;
    maxContextTokens?: number;
    maxCompletedTasks?: number;
}
export interface TeamState {
    schemaVersion: number;
    revision: number;
    teamId: TeamId;
    workspaceId: string;
    workspacePath: string;
    members: MemberRecord[];
    archivedMemberIds: string[];
    createdAt: number;
    updatedAt: number;
    /** Persisted human-readable team name (optional for pre-B10 state). */
    name?: string;
    /** Human-selected lead member; omitted for legacy state until resolved by role. */
    leadMemberId?: MemberId;
    /** Standing contact grants issued by the lead. */
    contactGrants?: ContactGrant[];
    /** Dispatch switch; absent means `auto` (the pre-B29 state). */
    dispatch?: DispatchSwitch;
    /** Rotation overrides set by the human in the Team tab (B43). */
    rotation?: TeamRotationSettings;
    [key: string]: unknown;
}
type StoreDefaults = {
    workspacePath?: string;
    workspaceId?: string;
    teamId?: string;
    name?: string;
};
export type TeamCandidate = {
    readonly teamId: string;
    readonly name?: string;
    readonly memberCount?: number;
    readonly updatedAt?: number;
    readonly usable?: boolean;
    readonly reason?: string;
};
export type TeamAdoption = {
    readonly state: TeamState;
    readonly adoptedFrom: string;
};
/**
 * Names the transport and the product already use for actors that are not members. A member with one
 * of these ids would send mail *as* that actor — `human` is trusted by the mailbox as a human
 * instruction — so the store refuses to persist such a member at all. The check lives here, not on
 * the HTTP boundary, because a route parser protects one door while the store protects every caller.
 */
export declare const RESERVED_ACTOR_NAMES: readonly string[];
export declare function isReservedActorName(memberId: string): boolean;
/**
 * Who leads this team: the recorded lead when it is still a member, otherwise the single member
 * holding the lead role, otherwise nobody. One definition, because the roster a member is shown and
 * the gate that admits its calls must agree — the expression used to be inlined in a dozen places,
 * and the first change to the rule would have desynchronised them (external review, finding 7).
 */
export declare function resolveLeadMemberId(team: Pick<TeamState, 'leadMemberId' | 'members'>): string | undefined;
declare const TEAM_ROOT = ".dsh-live-teams";
export declare class TeamStore {
    private readonly defaults;
    private readonly locations;
    constructor(defaults?: StoreDefaults);
    open(request?: StoreDefaults): Promise<TeamState>;
    isDisabledSync(teamId: string): boolean;
    readExisting(request?: StoreDefaults): Promise<TeamState | undefined>;
    isDisabled(teamId: string): Promise<boolean>;
    /** Discover old team directories in this workspace without creating state. */
    listAdoptionCandidates(request: {
        workspacePath: string;
        derivedTeamId: string;
    }): Promise<TeamCandidate[]>;
    /** Adopt one old team into the workspace-derived directory. */
    adoptTeam(request: {
        workspacePath: string;
        workspaceId: string;
        derivedTeamId: string;
        candidateTeamId: string;
        replaceEmptyDerived: boolean;
        actor?: string;
    }): Promise<TeamAdoption>;
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
    adoptByPath(request: {
        workspacePath: string;
        workspaceId: string;
        teamId: string;
        actor?: string;
    }): Promise<{
        adoptedFrom: string;
        memberCount: number;
    } | undefined>;
    setDisabled(teamId: string, disabled: boolean): Promise<void>;
    renameTeam(teamId: string, expectedRevision: number, name: string): Promise<{
        state: TeamState;
        from: string;
    }>;
    /**
     * Flip the dispatch switch. Authority belongs to the callers, exactly as it does
     * for `renameTeam`: the desktop route admits the human, and the lead-only tool
     * admits the lead. A request that changes nothing is refused rather than silently
     * accepted, so a double click cannot look like a state change that never happened.
     */
    setDispatchMode(teamId: string, mode: DispatchSwitch['mode'], request: {
        actor: string;
        reason?: string;
    }, expectedRevision: number): Promise<{
        state: TeamState;
        from: DispatchSwitch['mode'];
        to: DispatchSwitch['mode'];
    }>;
    commit<T>(teamId: string, request: {
        expectedRevision: number;
        mutate: (state: TeamState) => T | Promise<T>;
    }): Promise<{
        state: TeamState;
        value: T;
    }>;
    memberBySession(teamId: string, sessionId: string): Promise<MemberRecord | undefined>;
    bindSession(teamId: string, memberId: string, sessionId: string, expectedRevision: number): Promise<MemberRecord>;
    unbindSession(teamId: string, memberId: string, expectedRevision: number): Promise<MemberRecord>;
    /**
     * Name the lead, or clear the name.
     *
     * Clearing is a real operation, not an empty request: it returns the team to the fallback rule —
     * whoever holds the `lead` role — which is what a team with one lead relies on anyway. The panel
     * offered "Not set" and the server refused it with a 400, so the option did nothing.
     */
    setLead(teamId: string, memberId: string | undefined, expectedRevision: number): Promise<TeamState>;
    updateContactGrant(teamId: string, from: MemberId, to: ContactTarget, action: 'add' | 'remove', grantedBy: string): Promise<{
        state: TeamState;
        grants: ContactGrant[];
        changed: boolean;
    }>;
    setMemberNote(teamId: string, memberId: string, note: string, expectedRevision: number): Promise<{
        state: TeamState;
        member: MemberRecord;
    }>;
    removeMember(teamId: string, memberId: string, expectedRevision: number): Promise<{
        state: TeamState;
        removed: MemberRecord;
    }>;
    appendEvent(teamId: string, event: unknown): Promise<void>;
    /**
     * The audit, read from a byte offset when the caller has one.
     *
     * The journal grows forever and the panel re-reads it every few seconds; reading the whole file was
     * the one part of polling that got worse with age (a ten-times-longer journal meant seventeen
     * megabytes a minute). The file is append-only, so an offset is a safe cursor: the caller passes
     * back the offset this returned and pays only for what is new. Without an offset the tail is read —
     * never the whole history, which nobody reads in a panel anyway.
     */
    readEvents(teamId: string, after?: number): Promise<{
        events: unknown[];
        torn: string | null;
        nextOffset: number;
        truncated: boolean;
    }>;
    private location;
    private requireLocation;
    private read;
    memberBySessionSync(teamId: string, sessionId: string): MemberRecord | undefined;
}
export declare function createTeamStore(options?: StoreDefaults): TeamStore;
export { TEAM_ROOT };
/**
 * Read the dispatch switch strictly: an absent switch is `auto`, and anything
 * malformed is corrupt state rather than a quiet fallback to automatic dispatch.
 */
export declare function readDispatchSwitch(state: TeamState): DispatchSwitch;
/**
 * Read the team's rotation overrides strictly: an absent block means "nothing set here, use the
 * profile", and a malformed one is corrupt state rather than a quiet fallback to someone's guess
 * about which limit was meant.
 */
export declare function readTeamRotation(state: Pick<TeamState, 'rotation'>): TeamRotationSettings;
export declare function readTeamStateSync(request: {
    workspacePath: string;
    teamId: string;
}): TeamState | undefined;
export declare function readMemberBySessionSync(request: {
    workspacePath: string;
    teamId: string;
    sessionId: string;
}): MemberRecord | undefined;
