// src/session-title.ts
/** The one place the title format is defined. */
function sessionTitleFor(displayName, teamName) {
	return `${displayName} - ${teamName}`;
}
/**
* Bring one Session's title in line with its membership.
*
* @returns the outcome, or `undefined` when the title could not be set — the
*   caller must treat that as a reported inconvenience, not as a failure.
*/
async function applySessionTitle(dependencies, request) {
	const to = sessionTitleFor(request.displayName, request.teamName);
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
export { applySessionTitle, sessionTitleFor };
