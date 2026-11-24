/**
 * Package root.
 *
 * The DSH loader imports a plugin by its package main entry, so this module must
 * itself be the Cordis plugin: an object (or function) carrying `apply`. The
 * programmatic API of the package is re-exported alongside it, which is how the
 * installed third-party plugins structure their root as well.
 *
 * Exporting only a barrel here silently fails at mount time with
 * `invalid plugin, expect function or object with an "apply" method`.
 */
export { apply, inject, name } from './plugin.js'
export { apply as default } from './plugin.js'

export {
  BINDING_STALE_MESSAGE,
  ERROR_CODES,
  LiveTeamsError,
  platformErrorMappings,
  translatePlatformError,
} from './errors.js'
export type { ErrorCode, ErrorOptions } from './errors.js'
export {
  CURRENT_SCHEMA_VERSION,
  atomicWrite,
  atomicWriteJson,
  clone,
  fileExists,
  readJson,
  withProcessLock,
} from './storage.js'
export { TEAM_ROOT, TeamStore, createTeamStore, readMemberBySessionSync, readTeamRotation, readTeamStateSync } from './team-store.js'
export type { TeamId, MemberId, SessionId, BindingGeneration, ContactTarget, ContactGrant, MemberRecord, TeamState, TeamCandidate, TeamAdoption, TeamRotationSettings } from './team-store.js'
export { TaskStore, createTaskStore, renderDocument, routeText, assignmentRouteText, deriveRouteContacts, routeAllowsContact, taskDocumentPath } from './task-store.js'
export type { TaskKind, TaskStatus, TaskRoute, HumanContact, TeamTask, TaskAttempt, AttemptsState, TasksState, ClaimTaskRequest, ClaimTaskResult, AcknowledgeTaskRequest, CreateTaskRequest, CreateTaskResult, ListTasksOptions, ReadTaskResult, SubmissionArtifact, SubmissionSourceArtifact, SubmissionCheck, Submission, ReviewFinding, ReviewVerdict, ReviewRound, SubmissionsState, ReviewsState, SubmitTaskRequest, AcceptTaskRequest, AcceptTaskResult, ReviseTaskRequest, ReviseTaskResult, ReviewTaskRequest, ReviewTaskResult } from './task-store.js'
export { contextTokensOf, createSessionBridge, modelSelectionOf, toBridgeError } from './session-bridge.js'
export { assertSessionDescriptorInTeamWorkspace, assertSessionInTeamWorkspace, canonicalPath } from './binding.js'
export { parseRoleDocument, readRoleRegistry, readRoleRegistrySync } from './roles.js'
export type { LiveTeamsRole, ParsedRole, RolePermissions, RoleRegistry, RoleRegistrySync } from './roles.js'
export type { LiveTeamsService, PluginConfig } from './plugin.js'
export type { WorkspaceGuardOptions } from './binding.js'
export type { SessionDescriptor, SessionController, SessionBridge, SessionBridgeDeps, ModelSelection } from './session-bridge.js'
export { SessionCommandQueue, createCommandQueue } from './command-queue.js'
export type { CommandState, CommandRecord } from './command-queue.js'
export { DEFAULT_ROTATION_CONFIG, createRotationService, decideRotation, effectiveRotationConfig, readRotationConfig } from './rotation.js'
export type {
  RotationConfig,
  RotationDecision,
  RotationDecisionInput,
  RotationFacts,
  RotationOutcome,
  RotationReason,
  RotationService,
  RotationSkip,
} from './rotation.js'
export { MailboxService, createMailbox, messageDeliveryOutcome, messagePolicy, resolveMailboxRecipient } from './mailbox.js'
export { MEMBER_TOOL_NAMES, registerMemberTools, registerMemberToolsIfAvailable } from './member-tools.js'
export type { MessageKind, MessageWakePolicy, MessageAckPolicy, MessageDeliveryState, MessageDeliveryOutcome, TeamMessage, MessageDelivery, MessageDraft, MailboxActor, MailboxRecipient, ResolvedMailboxRecipient, MailboxAuditEvent, MailboxAuthorizeRequest, MailboxOptions, CommandQueueLike, SendResult, AcknowledgeResult, CreateMailboxOptions } from './mailbox.js'
export type { MemberToolsBinding, MemberToolsResolver, MemberToolsOptions, ToolRegistry } from './member-tools.js'
export {
  MEMBERSHIP_CONTEXT_NAME,
  MEMBERSHIP_CONTEXT_ORDER,
  createMembershipContextProvider,
  renderMembership,
  sessionIdOf,
} from './context-provider.js'
export type { MembershipMember, MembershipScope, MembershipContextBinding, MembershipContextOptions, MembershipContextProvider } from './context-provider.js'
export {
  LIVE_TEAMS_TEAM_ROUTE,
  LIVE_TEAMS_TEAM_ENABLE_ROUTE,
  LIVE_TEAMS_TEAM_DISABLE_ROUTE,
  LIVE_TEAMS_TEAM_NAME_ROUTE,
  LIVE_TEAMS_TEAM_CANDIDATES_ROUTE,
  LIVE_TEAMS_TEAM_ADOPT_ROUTE,
  LIVE_TEAMS_TEAM_ROTATION_ROUTE,
  LIVE_TEAMS_MEMBERS_ROUTE,
  LIVE_TEAMS_CANDIDATES_ROUTE,
  LIVE_TEAMS_MEMBER_ROLE_ROUTE,
  LIVE_TEAMS_MEMBER_AVAILABILITY_ROUTE,
  LIVE_TEAMS_MEMBER_NAME_ROUTE,
  LIVE_TEAMS_MEMBER_REMOVE_ROUTE,
  LIVE_TEAMS_MEMBER_CREATE_SESSION_ROUTE,
  LIVE_TEAMS_MEMBER_INTERRUPT_ROUTE,
  LIVE_TEAMS_ROLES_ROUTE,
  LIVE_TEAMS_ROLES_OPEN_ROUTE,
  LIVE_TEAMS_ROLES_OVERRIDE_ROUTE,
  LIVE_TEAMS_MESSAGES_ROUTE,
  LIVE_TEAMS_MESSAGES_ACKNOWLEDGE_ROUTE,
  LIVE_TEAMS_JOURNAL_ROUTE,
  LIVE_TEAMS_TEAM_LEAD_ROUTE,
  LIVE_TEAMS_TEAM_BRIEFING_OPEN_ROUTE,
  LIVE_TEAMS_TASKS_ROUTE,
  LIVE_TEAMS_TASK_ROUTE,
  LIVE_TEAMS_TASK_ACCEPT_ROUTE,
  LIVE_TEAMS_TASK_REVISE_ROUTE,
  liveTeamsRequestAllowed,
  projectLiveTeamsCandidates,
  projectLiveTeamsSnapshot,
  registerLiveTeamsRoutes,
} from './routes.js'
export type {
  LiveTeamsAuditRecord,
  LiveTeamsJournalCategory,
  JournalCategory,
  JournalRefs,
  LiveTeamsJournalEntry,
  JournalEntry,
  LiveTeamsJournal,
  LiveTeamsCandidate,
  LiveTeamsCandidates,
  LiveTeamsCreateMemberRequest,
  LiveTeamsCreateMemberResult,
  LiveTeamsCreateSessionMemberRequest,
  LiveTeamsCreateSessionMemberResult,
  LiveTeamsRemoveMemberRequest,
  LiveTeamsRemoveMemberResult,
  LiveTeamsMutation,
  LiveTeamsMutationResult,
  LiveTeamsRotation,
  LiveTeamsRotationRequest,
  LiveTeamsSessionTitleResult,
  LiveTeamsTitleResult,
  LiveTeamsRequestContext,
  LiveTeamsRouteContext,
  LiveTeamsRouteOptions,
  LiveTeamsSnapshot,
  LiveTeamsSnapshotMember,
  LiveTeamsRoles,
  LiveTeamsRoleSummary,
  LiveTeamsRoleOpenRequest,
  LiveTeamsAdoptionCandidate,
  LiveTeamsTeamCandidates,
  LiveTeamsTaskRouteSummary,
  LiveTeamsTaskSummary,
  LiveTeamsTasks,
  LiveTeamsTaskDetail,
  LiveTeamsWebServer,
} from './routes.js'
