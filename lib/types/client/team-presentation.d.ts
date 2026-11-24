import type { TaskSummary, TeamJournalEntry } from './api.js';
import type { LocaleKey } from './locales.js';
/** Remove only an exact, typed task-title suffix. Never parse or rewrite event meaning. */
export declare function activityHeading(entry: {
    summary: string;
    refs: {
        taskTitle?: string;
    };
    summaryParts?: readonly {
        text: string;
        strong?: boolean;
    }[];
}): {
    summary: string;
    parts?: Array<{
        text: string;
        strong?: boolean;
    }>;
};
export type ActivityMode = 'important' | 'all' | 'technical';
type Activity = Pick<TeamJournalEntry, 'kind' | 'category'>;
/** Classification uses formal event metadata, never private message text or inferred model intent. */
export declare function activityMatchesMode(entry: Activity, mode: ActivityMode): boolean;
/** A route tells us where the decision is expected, not whether that Session started working. */
export declare function taskDecisionStage(task: TaskSummary): LocaleKey | undefined;
/** Assignment references only: a running Session is not proof of work on an assigned task. */
export declare function memberTaskReferences(tasks: readonly TaskSummary[], memberId: string): TaskSummary[];
export {};
