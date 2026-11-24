import { reviewReturnDeliveryAllowed, reviewReturnFence } from "./review-return-ports.js";
// src/review-return-guard.ts
/** Fresh authority observation outside every persistence lock, immediately before enqueue. */
function createReviewReturnGuard(deps) {
	return async (message, sessionId, bindingGeneration) => {
		if (!await reviewReturnDeliveryAllowed(deps.store, message, sessionId, bindingGeneration)) return false;
		const fence = reviewReturnFence(message);
		if (fence === void 0) return true;
		const attempt = (await deps.store.readAttempts()).attempts.find((entry) => entry.id === fence.attemptId && entry.generation === fence.generation && entry.sessionId === fence.sessionId);
		if (attempt === void 0) return false;
		let since = attempt.startedAt;
		for (const raw of await deps.readEvents()) {
			if (raw === null || typeof raw !== "object") continue;
			const event = raw;
			if (event.kind === "task/revised" && event.taskId === fence.taskId && typeof event.at === "number" && Number.isFinite(event.at)) since = Math.max(since, event.at);
		}
		const observed = await deps.bridge.observeHumanActivity(fence.sessionId, since, await deps.knownRequestIds(fence.sessionId));
		if (observed !== false) {
			const { taskId, ...identity } = fence;
			await deps.store.blockReviewReturn(taskId, identity, observed === true ? "human-intervened" : "intervention-unobservable");
			return false;
		}
		return reviewReturnDeliveryAllowed(deps.store, message, sessionId, bindingGeneration);
	};
}
export { createReviewReturnGuard };
