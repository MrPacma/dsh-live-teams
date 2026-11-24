import type { TeamMember } from './api.js';
/** Presentation-only reconciliation: status/contact refreshes must not overwrite unsaved inputs. */
export declare function reconcileMemberDrafts(previous: readonly TeamMember[], next: readonly TeamMember[], drafts: Record<string, string>, field: 'role' | 'displayName'): Record<string, string>;
