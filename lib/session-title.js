// src/session-title.ts
/** The one place the title format is defined. */
function sessionTitleFor(displayName, teamName) {
	return `${displayName} - ${teamName}`;
}
/**
* Longest title this plugin writes. The base is what gets trimmed, never the stamp: a truncated
* marker would make two rotations look identical.
*/
const MAX_TITLE_LENGTH = 200;
const RETIRED_TITLE = / \(Rotated \d{2}\.\d{2}\.\d{4} \d{2}:\d{2}\)$/u;
/**
* The stamp a retired Session carries.
*
* Local time from the date getters rather than `toLocaleString`: a title is durable data that a human
* compares across sessions, and it must not change shape with the host's locale. `padStart` keeps
* `01.02.2026 03:04` sortable and unambiguous.
*/
function rotationStamp(at) {
	const date = new Date(at);
	const pad = (value) => String(value).padStart(2, "0");
	return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
/** Whether a title already carries a rotation stamp, so a repeated pass renames nothing. */
function isRetiredTitle(title) {
	return RETIRED_TITLE.test(title.trim());
}
/**
* The title a replaced Session keeps: its own name, plus which rotation retired it.
*
* The base is the Session's *current* title, not the member's display name — a human who renamed the
* conversation to something meaningful should not lose that to a bookkeeping suffix.
*/
function retiredSessionTitle(base, at) {
	const suffix = ` (Rotated ${rotationStamp(at)})`;
	const trimmed = base.trim().length > 0 ? base.trim() : "Session";
	const room = Math.max(0, MAX_TITLE_LENGTH - suffix.length);
	return `${trimmed.length <= room ? trimmed : `${trimmed.slice(0, Math.max(0, room - 1)).trimEnd()}…`}${suffix}`;
}
/**
* Bring one Session's title in line with its membership.
*
* @param request.title - an explicit title, used by rotation; every membership path keeps deriving
*   `<name> - <team>` from the member.
* @returns the outcome, or `undefined` when the title could not be set — the
*   caller must treat that as a reported inconvenience, not as a failure.
*/
async function applySessionTitle(dependencies, request) {
	const to = request.title ?? sessionTitleFor(request.displayName, request.teamName);
	const from = request.previousTitle ?? null;
	if (request.previousTitle === to) return {
		from,
		to,
		reason: request.reason,
		renamed: false
	};
	try {
		await dependencies.rename(request.sessionId, to);
		return {
			from,
			to,
			reason: request.reason,
			renamed: true
		};
	} catch (error) {
		dependencies.warn?.(`live-teams: could not title Session "${request.sessionId}": ${String(error)}`);
		return;
	}
}
export { applySessionTitle, isRetiredTitle, retiredSessionTitle, rotationStamp, sessionTitleFor };
