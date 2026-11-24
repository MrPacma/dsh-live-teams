export type MessageKind = 'message' | 'direction' | 'comment';
export type MessageWakePolicy = 'never' | 'queue' | 'steer';
export type MessageAckPolicy = 'delivery' | 'consumption' | 'formal';
export type MessageDeliveryState = 'stored' | 'leased' | 'delivered' | 'acknowledged' | 'failed';
export type MessageDeliveryOutcome = 'delivered' | 'inbox' | 'pending' | 'failed';
/**
 * The one delivery failure the dispatcher may retry on its own: the recipient had
 * no usable binding yet. Every other failure is terminal and stays visible —
 * the reconciler never resurrects a delivery for a reason it cannot name.
 */
export declare const NO_SESSION_FAILURE = "recipient has no current session binding";
/** The immutable, frozen B12 message envelope. */
export interface TeamMessage {
    id: string;
    teamId: string;
    from: string | 'human' | 'scheduler';
    to: string | 'human' | 'team';
    kind: MessageKind;
    content: string;
    threadId?: string;
    createdAt: number;
}
/** Recipient-specific mutable delivery state. */
export interface MessageDelivery {
    id: string;
    messageId: string;
    recipient: string | 'human';
    wakePolicy: MessageWakePolicy;
    ackPolicy: MessageAckPolicy;
    state: MessageDeliveryState;
    claimedAt?: number;
    deliveredAt?: number;
    acknowledgedAt?: number;
    failure?: string;
    revision: number;
}
export type MessageDraft = {
    to: string | 'human' | 'team';
    kind: MessageKind;
    content: string;
    threadId?: string;
};
/** Identity is an operation context, not a field supplied in MessageDraft. */
export type MailboxActor = {
    type: 'session';
    sessionId: string;
} | {
    type: 'human';
} | {
    type: 'scheduler';
};
export type MailboxRecipient = {
    memberId: string;
    displayName?: string;
    sessionId?: string;
    bindingGeneration?: number;
    active?: boolean;
};
export type ResolvedMailboxRecipient = {
    readonly recipient: TeamMessage['to'];
    readonly name: string;
};
/** Resolve the one addressing vocabulary shared by member and human sends. */
export declare function resolveMailboxRecipient(value: string, recipients: readonly MailboxRecipient[]): ResolvedMailboxRecipient;
export type MailboxAuditEvent = {
    kind: 'message/sent';
    teamId: string;
    messageId: string;
    from: TeamMessage['from'];
    /** The sender, which is the actor of this transition. */
    actor: TeamMessage['from'];
    to: TeamMessage['to'];
    messageKind: MessageKind;
    at: number;
} | {
    kind: 'delivery/leased';
    teamId: string;
    deliveryId: string;
    messageId: string;
    recipient: string;
    at: number;
    revision: number;
} | {
    kind: 'delivery/delivered';
    teamId: string;
    deliveryId: string;
    messageId: string;
    recipient: string;
    at: number;
    revision: number;
} | {
    kind: 'delivery/acknowledged';
    teamId: string;
    deliveryId: string;
    messageId: string;
    recipient: string;
    /** The recipient acknowledges its own delivery, so it is the actor. */
    actor: string;
    at: number;
    revision: number;
} | {
    kind: 'delivery/failed';
    teamId: string;
    deliveryId: string;
    messageId: string;
    recipient: string;
    reason: string;
    at: number;
    revision: number;
} | {
    /** A direction could not be steered and was queued instead. */
    kind: 'delivery/steer-fallback';
    teamId: string;
    deliveryId: string;
    messageId: string;
    reason: string;
    at: number;
};
export type CommandQueueRecord = {
    commandId: string;
    idempotencyKey: string;
    sessionId: string;
    bindingGeneration: number;
    mode: 'queue' | 'steer';
    requestId: string;
    state: 'pending' | 'leased' | 'admitted' | 'applied' | 'failed';
    receipt: string | undefined;
    failureCode: string | undefined;
    failureDetail: string | undefined;
    revision: number;
};
type CommandRecordLike = {
    commandId: string;
    idempotencyKey: string;
    sessionId: string;
    bindingGeneration: number;
    mode: 'queue' | 'steer';
    requestId: string;
    state: 'pending' | 'leased' | 'admitted' | 'applied' | 'failed';
    receipt: string | undefined;
    failureCode: string | undefined;
    failureDetail: string | undefined;
    revision: number;
};
export type CommandQueueLike = {
    admit(request: {
        idempotencyKey: string;
        sessionId: string;
        bindingGeneration: number;
        mode: 'queue' | 'steer';
        content: readonly unknown[];
        reason?: string;
        causationId?: string;
    }): Promise<{
        record: CommandRecordLike;
        duplicate: boolean;
    }>;
    dispatch(commandId: string): Promise<CommandRecordLike>;
};
export type MailboxAuthorizeRequest = {
    from: TeamMessage['from'];
    to: string;
};
export type MailboxOptions = {
    workspacePath: string;
    teamId: string;
    queue: CommandQueueLike;
    listRecipients: () => Promise<readonly MailboxRecipient[]>;
    /** Optional policy gate, called before any mailbox row is persisted. */
    authorize?: (request: MailboxAuthorizeRequest) => void | Promise<void>;
    resolveSessionSender?: (sessionId: string) => Promise<string | undefined> | string | undefined;
    /** Durable guarded scheduler traffic must still be authorized on background retries. */
    canDeliver?: (message: TeamMessage, recipient: MailboxRecipient) => Promise<boolean>;
    appendAudit?: (event: MailboxAuditEvent) => Promise<void>;
    now?: () => number;
    leaseMs?: number;
    /** Defaults to true: send persists before attempting each live delivery. */
    autoDeliver?: boolean;
};
export type SendResult = {
    message: TeamMessage;
    deliveries: MessageDelivery[];
};
export type AcknowledgeResult = {
    delivery: MessageDelivery;
    duplicate: boolean;
};
declare function messagePolicy(kind: MessageKind, recipient: TeamMessage['to']): Pick<MessageDelivery, 'wakePolicy' | 'ackPolicy'>;
/** Derive the externally reported outcome from a final delivery state and policy. */
export declare function messageDeliveryOutcome(delivery: Pick<MessageDelivery, 'state' | 'wakePolicy'>): MessageDeliveryOutcome;
export declare class MailboxService {
    private readonly workspacePath;
    private readonly teamId;
    private readonly queue;
    private readonly listRecipients;
    private readonly authorize;
    private readonly resolveSessionSender;
    private readonly canDeliver;
    private readonly appendAudit;
    private readonly now;
    private readonly leaseMs;
    private readonly autoDeliver;
    private readonly directory;
    private readonly messagesFile;
    private readonly deliveriesFile;
    private readonly lockFile;
    constructor(options: MailboxOptions);
    listMessages(): Promise<TeamMessage[]>;
    listDeliveries(): Promise<MessageDelivery[]>;
    getMessage(messageId: string): Promise<TeamMessage | undefined>;
    getDelivery(deliveryId: string): Promise<MessageDelivery | undefined>;
    deliveriesFor(messageId: string): Promise<MessageDelivery[]>;
    /**
     * Internal send path.
     *
     * Deliberately private: an actor argument that any caller may supply would let
     * a member send as `human` or as another member, which ADR 0004 forbids. The
     * public entries derive the sender instead — from the calling Session binding
     * for member traffic, and from the host itself for human and scheduler paths.
     */
    private send;
    sendFromSession(sessionId: string, draft: MessageDraft): Promise<SendResult>;
    sendFromHuman(draft: MessageDraft): Promise<SendResult>;
    sendFromScheduler(draft: MessageDraft): Promise<SendResult>;
    /** Internal outbox identity uses the existing immutable thread field; no mailbox schema change. */
    sendFromSchedulerOnce(draft: MessageDraft): Promise<SendResult>;
    claimDelivery(deliveryId: string): Promise<MessageDelivery | undefined>;
    deliver(deliveryId: string): Promise<MessageDelivery>;
    /**
     * One transport attempt in one mode.
     *
     * The idempotency key carries the mode, because the key is bound to the first
     * command admitted under it: reusing one key for a queue retry after a steer
     * attempt would return the steer command and change nothing. The mode is part
     * of what makes this attempt distinct, and `(messageId, recipient)` still
     * identifies the delivery itself.
     */
    private attemptDelivery;
    private admitOnce;
    retryExpiredLeases(): Promise<MessageDelivery[]>;
    retryDelivery(deliveryId: string): Promise<MessageDelivery>;
    acknowledge(messageId: string, recipient: string, _formal?: boolean): Promise<AcknowledgeResult>;
    private resolveFrom;
    /**
     * A message persisted without its delivery rows is a message nobody will ever see: the snapshot is
     * two files, and a process that dies between them leaves exactly that. The reconciler calls this,
     * and the orphan becomes a visible failed delivery instead of silence (external review, mailbox
     * atomicity).
     */
    healOrphanMessages(): Promise<{
        messageId: string;
        recipient: string;
    }[]>;
    private markDelivered;
    private fail;
    private snapshot;
    /**
     * Comments this member has not acknowledged, read synchronously.
     *
     * The membership context is assembled synchronously, and a comment is stored with
     * `wakePolicy: never` — nothing wakes the Session for it. Without a sync reader the recipient only
     * ever learns about a comment if it happens to ask (external review, finding 13).
     */
    unreadCommentsForSync(memberId: string): {
        from: string;
        content: string;
        at: number;
    }[];
    private readSnapshot;
    private readMessages;
    private readDeliveries;
    private persist;
    private audit;
}
export type CreateMailboxOptions = MailboxOptions;
export declare function createMailbox(options: MailboxOptions): MailboxService;
export { messagePolicy };
