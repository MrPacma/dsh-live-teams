import { SubmissionNotificationReceipt } from "./task-store.js";
export declare const REVIEW_RETURN_STATES: readonly ["pending", "sending", "delivered", "started", "completed", "blocked", "failed", "unconfirmed", "superseded"];
export interface ReviewReturn {
  roundId: string;
  submissionId: string;
  attemptId: string;
  generation: number;
  assignee: string;
  sessionId: string;
  bindingGeneration: number;
  state: typeof REVIEW_RETURN_STATES[number];
  at: number;
  reason?: string;
  messageId?: string;
  requestId?: string;
  admission?: 'queued' | 'pending';
  turn?: number;
  inputSeq?: number;
  leadNotified?: boolean;
  leadNotification?: SubmissionNotificationReceipt;
}
/** Semantic notification budget; raw state transitions remain in audit/GUI. */
export declare function reviewReturnNoticeClass(intent: Pick<ReviewReturn, 'state' | 'reason'>): string | undefined;
/** Whitelist operational metadata; never expose arbitrary source/message bodies. */
export declare function parseReviewReturn(value: unknown): ReviewReturn;