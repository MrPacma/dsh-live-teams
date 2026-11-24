import { TaskStore } from "./task-store.js";
import { SessionBridge } from "./session-bridge.js";
import { TeamMessage } from "./mailbox.js";
/** Fresh authority observation outside every persistence lock, immediately before enqueue. */
export declare function createReviewReturnGuard(deps: {
  store: Pick<TaskStore, 'isReviewReturnCurrent' | 'readAttempts' | 'blockReviewReturn'>;
  bridge: Pick<SessionBridge, 'observeHumanActivity'>;
  readEvents: () => Promise<readonly unknown[]>;
  knownRequestIds: (sessionId: string) => Promise<readonly string[]>;
}): (message: Pick<TeamMessage, "from" | "threadId">, sessionId?: string, bindingGeneration?: number) => Promise<boolean>;