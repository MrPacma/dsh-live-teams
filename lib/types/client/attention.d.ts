/**
 * The attention chip.
 *
 * The Messages panel answered "what was said to me", which is a question nobody
 * asks — the human asks "does anyone need me?", and then wants the conversation,
 * which lives in the member's own Session. This chip answers that question from
 * anywhere: it sits in the Session header, resolves the team from the Session it
 * is rendered in, and a click opens the member who is waiting.
 *
 * Acknowledging on click is deliberate: the delivery record is the only durable
 * "the human was told" evidence, and opening the source is the human acting on
 * it. Without that the chip would keep asking forever.
 */
import React from 'react';
import { type TeamAttentionEntry } from './api.js';
import type { LocaleKey } from './locales.js';
import './styles.js';
export type SessionsService = {
    readonly open: (sessionId: string) => void;
    readonly list?: {
        readonly getSnapshot: () => {
            readonly current?: string;
        };
        readonly subscribe?: (listener: () => void) => () => void;
    };
};
export type AttentionContext = {
    readonly sessions: SessionsService;
    readonly t: (key: LocaleKey) => string;
};
export type AttentionChipProps = {
    readonly ctx?: AttentionContext;
};
/** How often the chip re-asks while a Session is open. */
export declare const ATTENTION_POLL_MS = 20000;
/**
 * How long a started acknowledgement may suppress a member before the chip
 * stops trusting the attempt and asks the mailbox again.
 */
export declare const PENDING_CLEAR_TTL_MS = 15000;
export declare function isClearPending(memberId: string, now?: number): boolean;
/** Test seam: the marker is module state, so a test file must be able to reset it. */
export declare function resetAttentionClears(): void;
/**
 * The Session the chip speaks for: the one being viewed, not the one it happens
 * to be mounted in. The `conversation.session.header.utilities` slot passes no
 * props (`renderSlot(name, {})`), so this is the only way to the Session id.
 */
export declare function currentSessionId(sessions: SessionsService | undefined): string | undefined;
/** What the chip says: the longest-waiting member, plus how many others follow. */
export declare function attentionLabel(entries: readonly TeamAttentionEntry[]): {
    name: string;
    extra: number;
    waiting: number;
} | undefined;
/**
 * Mark everything one member is waiting on as read by the human.
 *
 * The waiting count comes from deliveries, whose ids only the inbox carries, so
 * this reads the inbox once and acknowledges in a single request. Returns false
 * when the state could not be cleared, so the chip can keep asking instead of
 * pretending the human saw something they did not.
 */
export declare function acknowledgeMemberWaiting(sessionId: string, memberId: string): Promise<boolean>;
export declare function AttentionChip(props: AttentionChipProps): React.ReactElement | null;
