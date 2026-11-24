import { TaskStore } from "./task-store.js";
import { SessionBridge } from "./session-bridge.js";
import { TeamMessage } from "./mailbox.js";
import { CommandRecord } from "./command-queue.js";
type OwnedCommand = Pick<CommandRecord, 'requestId' | 'causationId' | 'sessionId' | 'bindingGeneration' | 'mode'>;
/** Bounded reconciliation of exact plugin-owned input; no task mutation or Agent interruption. */
export declare function createAssignmentRecovery(deps: {
  teamId: string;
  store: Pick<TaskStore, 'listTasks' | 'readAttempts'>;
  bridge: Pick<SessionBridge, 'removeQueuedRequest'>;
  listMessages: () => Promise<readonly TeamMessage[]>;
  listCommands: () => Promise<readonly OwnedCommand[]>;
  appendAudit: (event: Record<string, unknown>) => Promise<void>;
  limit?: number;
}): () => Promise<void>;
export {};