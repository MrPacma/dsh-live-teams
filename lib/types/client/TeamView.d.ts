import React from 'react';
import type { MessageKind, TaskStatus, TeamAttemptStatus, TeamSubmissionScope } from './api.js';
import type { LocaleKey } from './locales.js';
import './styles.js';
export type TeamViewContext = {
    /** Kept for the roster and the attention chip; opening a session no longer goes through it. */
    readonly sessions?: {
        open?(sessionId: string): void;
    };
    /**
     * Opens a member's session, returning whether this host offers a way to do it at all. The host
     * changed how sessions are opened between 0.1.5 and 0.1.7, so the panel asks for the behaviour
     * rather than for a service by name.
     */
    readonly openSession?: (sessionId: string) => boolean;
    readonly t: (key: LocaleKey) => string;
};
export type TeamViewProps = {
    readonly ctx?: TeamViewContext;
    /** Session the view belongs to; the host serves this Session's workspace team. */
    readonly sessionId?: string;
    /** How often the tab re-reads tasks while visible. Exposed so the test can watch it. */
    readonly pollMs?: number;
};
export type TaskFilter = 'active' | 'waiting' | 'archived';
export declare const attemptStatusKeys: Record<TeamAttemptStatus, LocaleKey>;
export declare const scopeKeys: Record<TeamSubmissionScope['state'], LocaleKey>;
export declare const scopeReasonKeys: Record<NonNullable<TeamSubmissionScope['reason']>, LocaleKey>;
export declare const taskStatusKeys: Record<TaskStatus, LocaleKey>;
export declare const taskFilterKeys: Record<TaskFilter, LocaleKey>;
export declare const messageKindKeys: Record<MessageKind, LocaleKey>;
export declare function TeamView(props: TeamViewProps): React.ReactElement;
export default TeamView;
