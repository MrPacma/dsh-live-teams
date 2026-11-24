import { MailboxService, TeamMessage } from "./mailbox.js";
import { SubmissionNotificationReceipt, SubmissionNotificationRequest, TaskStore } from "./task-store.js";
export type SubmissionNoticeFence = Pick<SubmissionNotificationRequest, 'taskId' | 'submissionId' | 'recipient' | 'purpose' | 'sessionId' | 'bindingGeneration'>;
export declare function submissionNoticeThread(request: SubmissionNoticeFence): string;
export declare function submissionNoticeFence(message: Pick<TeamMessage, 'from' | 'to' | 'threadId'>): SubmissionNoticeFence | undefined;
export declare function submissionNoticeDeliveryAllowed(store: Pick<TaskStore, 'isSubmissionNotificationCurrent'>, message: Pick<TeamMessage, 'from' | 'to' | 'threadId'>, sessionId?: string, bindingGeneration?: number): Promise<boolean>;
export declare function createSubmissionNoticePort(options: {
  teamId: string;
  mailbox: () => Pick<MailboxService, 'sendFromSchedulerOnce'> | undefined;
}): (request: SubmissionNotificationRequest) => Promise<SubmissionNotificationReceipt>;