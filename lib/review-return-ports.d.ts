import { ReviewReturn } from "./review-return-state.js";
import { SessionBridge, SessionExecutionReceipt } from "./session-bridge.js";
import { MailboxService, TeamMessage } from "./mailbox.js";
import { ReviewReturnRequest, TaskStore } from "./task-store.js";
type Fence = Pick<ReviewReturn, 'roundId' | 'submissionId' | 'attemptId' | 'generation' | 'assignee' | 'sessionId' | 'bindingGeneration'> & {
  taskId: string;
};
export declare function reviewReturnThread(request: ReviewReturnRequest): string;
export declare function reviewReturnFence(message: Pick<TeamMessage, 'from' | 'threadId'>): Fence | undefined;
export declare function reviewReturnDeliveryAllowed(store: Pick<TaskStore, 'isReviewReturnCurrent'>, message: Pick<TeamMessage, 'from' | 'threadId'>, sessionId?: string, bindingGeneration?: number): Promise<boolean>;
export declare function reviewReturnLeadDeliveryAllowed(store: Pick<TaskStore, 'isReviewReturnLeadCurrent'>, message: Pick<TeamMessage, 'from' | 'to' | 'threadId'>, sessionId?: string, bindingGeneration?: number): Promise<boolean>;
export declare function createReviewReturnPorts(deps: {
  mailbox: () => Pick<MailboxService, 'sendFromSchedulerOnce'> | undefined;
  bridge: Pick<SessionBridge, 'observeRequest'>;
  teamId: string;
  observationTimeoutMs?: number;
  observationIntervalMs?: number;
}): {
  deliverReviewReturn: (request: ReviewReturnRequest) => Promise<{
    messageId: string;
    requestId: string;
    pending: boolean;
  }>;
  observeReviewReturn: (request: ReviewReturnRequest) => Promise<SessionExecutionReceipt>;
  notifyReviewReturn: (request: ReviewReturnRequest) => Promise<{
    state: "unavailable";
    reason: string;
    recipient: string;
    purpose: "review-return-lead";
  } | {
    state: "superseded";
    reason: string;
    recipient: string;
    purpose: "review-return-lead";
  } | {
    state: "failed";
    reason: string;
    recipient: string;
    purpose: "review-return-lead";
    sessionId: string;
    bindingGeneration: number;
    messageId: string;
    requestId: string;
  } | {
    state: "pending" | "queued";
    recipient: string;
    purpose: "review-return-lead";
    sessionId: string;
    bindingGeneration: number;
    messageId: string;
    requestId: string;
  } | undefined>;
};
export {};