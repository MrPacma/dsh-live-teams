import type { TaskStore } from './task-store.js'
import type { SessionBridge } from './session-bridge.js'
import type { TeamMessage } from './mailbox.js'
import type { CommandRecord } from './command-queue.js'
import { assignmentDeliveryAllowed, assignmentFence } from './assignment-guard.js'

type OwnedCommand = Pick<CommandRecord, 'requestId' | 'causationId' | 'sessionId' | 'bindingGeneration' | 'mode'>
/** Bounded reconciliation of exact plugin-owned input; no task mutation or Agent interruption. */
export function createAssignmentRecovery(deps: {
  teamId: string
  store: Pick<TaskStore, 'listTasks' | 'readAttempts'>
  bridge: Pick<SessionBridge, 'removeQueuedRequest'>
  listMessages: () => Promise<readonly TeamMessage[]>
  listCommands: () => Promise<readonly OwnedCommand[]>
  appendAudit: (event: Record<string, unknown>) => Promise<void>
  limit?: number
}) {
  const settled = new Set<string>()
  const observed = new Map<string, string>()
  /**
   * Set once the host has refused to remove queued input because the capability is absent.
   *
   * In that state the command stays pending forever, so every pass would report the same items again
   * — and after a restart every stored command is reported once more. Measured on a real team: 1 387
   * such events for three days of work, growing by two a minute with nothing changing. One event per
   * process carries the count; the rest is silence, because the removal cannot succeed anyway.
   */
  let removalUnavailable = false
  let unavailableReported = false
  let cursor = 0
  let running: Promise<void> | undefined
  const pass = async () => {
    const messages = new Map((await deps.listMessages()).map(message => [message.id, message]))
    const candidates = (await deps.listCommands()).flatMap(command => {
      const message = command.causationId === undefined ? undefined : messages.get(command.causationId)
      if (message === undefined || message.teamId !== deps.teamId || command.mode !== 'queue' || settled.has(command.requestId)) return []
      const fence = assignmentFence(message)
      if (fence === undefined || command.requestId !== `${deps.teamId}:${message.id}:${fence.assignee}:queue`) return []
      return [{ command, message, fence }]
    })
    if (candidates.length === 0) { cursor = 0; return }
    const count = Math.min(candidates.length, Math.max(1, deps.limit ?? 8))
    for (let i = 0; i < count; i++) {
      const { command, message, fence } = candidates[(cursor + i) % candidates.length]!
      if (removalUnavailable) continue
      if (await assignmentDeliveryAllowed(deps.store, message, command.sessionId, command.bindingGeneration)) continue
      const result = await deps.bridge.removeQueuedRequest(command.sessionId, command.requestId)
      if (result.state === 'removed' || result.state === 'not-pending') settled.add(command.requestId)
      if (result.state === 'refused' && result.reason === 'pending-queue-unavailable') {
        // The host cannot take the input back. Repeating the attempt cannot change that and only
        // writes journal rows, so it is recorded once, with how much work this covers.
        removalUnavailable = true
        if (!unavailableReported) {
          unavailableReported = true
          await deps.appendAudit({ kind: 'dispatch/obsolete-input', state: result.state, reason: result.reason, skipped: candidates.length, at: Date.now(), actor: 'scheduler' })
        }
        continue
      }
      const fingerprint = `${result.state}:${result.reason ?? ''}`
      if (observed.get(command.requestId) === fingerprint) continue
      await deps.appendAudit({ kind: 'dispatch/obsolete-input', taskId: fence.taskId, attemptId: fence.attemptId, messageId: message.id, requestId: command.requestId, memberId: fence.assignee, state: result.state, ...(result.itemId === undefined ? {} : { itemId: result.itemId }), ...(result.reason === undefined ? {} : { reason: result.reason }), at: Date.now(), actor: 'scheduler' })
      observed.set(command.requestId, fingerprint)
    }
    cursor = (cursor + count) % candidates.length
  }
  return async (): Promise<void> => {
    if (running !== undefined) return running
    const operation = pass(); running = operation
    try { await operation } finally { if (running === operation) running = undefined }
  }
}
