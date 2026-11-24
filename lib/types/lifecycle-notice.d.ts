import type { MailboxService, TeamMessage } from './mailbox.js';
import type { TaskStore, TeamTask, SubmissionNotificationReceipt } from './task-store.js';
export type LifecycleNoticeKind = 'review-verdict' | 'acceptance' | 'cancellation' | 'direction';
export interface LifecycleNoticeIntent {
    id: string;
    kind: LifecycleNoticeKind;
    contractRevision: number;
    roundId?: string;
    submissionId?: string;
    assignee?: string;
    attemptId?: string;
    text?: string;
}
export interface LifecycleNoticeRequest {
    taskId: string;
    intent: LifecycleNoticeIntent;
    recipient: string;
    sessionId: string;
    bindingGeneration: number;
    content: string;
    stillCurrent: () => Promise<boolean>;
}
export declare function lifecycleIntent(kind: LifecycleNoticeKind, contractRevision: number, fields: Omit<LifecycleNoticeIntent, 'id' | 'kind' | 'contractRevision'>): LifecycleNoticeIntent;
export declare function withLifecycleIntent(task: TeamTask, intent: LifecycleNoticeIntent): TeamTask;
export declare function validateLifecycleNotices(value: unknown): asserts value is LifecycleNoticeIntent[];
export type LifecycleNoticeFence = {
    taskId: string;
    intentId: string;
    recipient: string;
    sessionId: string;
    bindingGeneration: number;
};
export declare function lifecycleNoticeThread(request: LifecycleNoticeRequest): string;
export declare function lifecycleNoticeFence(message: Pick<TeamMessage, 'from' | 'to' | 'threadId'>): LifecycleNoticeFence | undefined;
export declare function lifecycleNoticeDeliveryAllowed(store: Pick<TaskStore, 'isLifecycleNoticeCurrent'>, message: Pick<TeamMessage, 'from' | 'to' | 'threadId'>, sessionId?: string, bindingGeneration?: number): Promise<boolean>;
export declare function createLifecycleNoticePort(options: {
    teamId: string;
    mailbox: () => Pick<MailboxService, 'sendFromSchedulerOnce'> | undefined;
}): (request: LifecycleNoticeRequest) => Promise<SubmissionNotificationReceipt>;
