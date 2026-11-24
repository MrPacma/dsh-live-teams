/**
 * Session titles follow membership.
 *
 * A member's Session is titled `<member name> - <team name>` so the human can
 * find it by name in the session list. Two properties are deliberate and are
 * pinned by tests:
 *
 * - a Session whose title already matches is left alone, so repeated operations
 *   produce no rename and no audit noise;
 * - a title is a convenience, never a precondition. The only capability this
 *   module is given is `rename`, so it cannot prompt, resume or deliver, and a
 *   failure is reported instead of failing the membership operation.
 *
 * Rotation adds a third case: the Session that was replaced stays readable, and
 * two Sessions with the same name — one live, one retired — is exactly the
 * confusion a human hits after the first rotation. The retired one is stamped
 * `(Rotated DD.MM.YYYY HH:mm)` on top of whatever name it already had, so a
 * manual rename by the human survives.
 */
export type SessionTitleReason = 'member-added' | 'member-renamed' | 'member-rotated';
export type SessionTitleResult = {
  readonly from: string | null;
  readonly to: string;
  readonly reason: SessionTitleReason;
  readonly renamed: boolean;
};
export type SessionTitleDependencies = {
  rename: (sessionId: string, title: string) => Promise<unknown>;
  warn?: (message: string) => void;
};
/** The one place the title format is defined. */
export declare function sessionTitleFor(displayName: string, teamName: string): string;
/**
 * The stamp a retired Session carries.
 *
 * Local time from the date getters rather than `toLocaleString`: a title is durable data that a human
 * compares across sessions, and it must not change shape with the host's locale. `padStart` keeps
 * `01.02.2026 03:04` sortable and unambiguous.
 */
export declare function rotationStamp(at: number): string;
/** Whether a title already carries a rotation stamp, so a repeated pass renames nothing. */
export declare function isRetiredTitle(title: string): boolean;
/**
 * The title a replaced Session keeps: its own name, plus which rotation retired it.
 *
 * The base is the Session's *current* title, not the member's display name — a human who renamed the
 * conversation to something meaningful should not lose that to a bookkeeping suffix.
 */
export declare function retiredSessionTitle(base: string, at: number): string;
/**
 * Bring one Session's title in line with its membership.
 *
 * @param request.title - an explicit title, used by rotation; every membership path keeps deriving
 *   `<name> - <team>` from the member.
 * @returns the outcome, or `undefined` when the title could not be set — the
 *   caller must treat that as a reported inconvenience, not as a failure.
 */
export declare function applySessionTitle(dependencies: SessionTitleDependencies, request: {
  sessionId: string;
  displayName: string;
  teamName: string;
  reason: SessionTitleReason;
  previousTitle?: string;
  title?: string;
}): Promise<SessionTitleResult | undefined>;