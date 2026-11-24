import path from "node:path";
// src/scope.ts
/**
* Declared task scope: what a task says it may touch, and how two declarations are
* compared. The comparison is deliberately conservative — it reports an overlap when
* a declaration *could* collide, because a missed overlap costs somebody's edits while
* a reported one costs throughput (B30).
*/
const MAX_PATHS = 32;
/**
* Work that writes code, and therefore needs the isolation Gate C has not built yet
* (ADR 0008; design §22), and the same set the parallel-write rules apply to. `work` is
* listed because a generic kind does not promise it is documentation — the safe reading
* of an unknown is "it writes", and the refusals name the kinds that are exempt.
*/
const CODING_KINDS = /* @__PURE__ */ new Set([
	"implementation",
	"repair",
	"integration",
	"work"
]);
const GLOB_CHARS = /[*?[\]{}!()]/;
/**
* Paths that every task effectively shares, so touching one collides with any active
* writer: manifests and lockfiles, repository internals, CI configuration and build
* entry points. The deployment may extend this list with `sharedPaths`.
*/
const SHARED_PATH_DEFAULTS = Object.freeze([
	"package.json",
	"package-lock.json",
	"pnpm-lock.yaml",
	"pnpm-workspace.yaml",
	"yarn.lock",
	"pyproject.toml",
	"requirements.txt",
	"Cargo.toml",
	"Cargo.lock",
	"go.mod",
	"go.sum",
	".git/**",
	".github/**",
	".gitlab-ci.yml",
	"Jenkinsfile",
	"Dockerfile",
	"docker-compose.yml",
	"docker-compose.yaml",
	"Makefile"
]);
/** Normalise one entry, or refuse it. Returns undefined for an unusable value. */
function normalizeScopePath(value) {
	if (typeof value !== "string") return void 0;
	const trimmed = value.trim();
	if (trimmed.length === 0 || trimmed.length > 512) return void 0;
	const slashed = trimmed.replace(/\\/gu, "/");
	if (slashed.startsWith("/") || /^[A-Za-z]:/u.test(slashed)) return void 0;
	const segments = slashed.split("/").filter((segment) => segment.length > 0 && segment !== ".");
	if (segments.length === 0) return void 0;
	if (segments.some((segment) => segment === "..")) return void 0;
	return segments.join("/");
}
/** Normalise a whole declaration; undefined when any entry is unusable, or on duplicates. */
function normalizeScope(paths) {
	if (!Array.isArray(paths)) return void 0;
	if (paths.length === 0 || paths.length > 32) return void 0;
	const normalized = [];
	for (const entry of paths) {
		const value = normalizeScopePath(entry);
		if (value === void 0) return void 0;
		if (normalized.includes(value)) return void 0;
		normalized.push(value);
	}
	return normalized;
}
/**
* The literal prefix a pattern can be reduced to: everything before the first segment
* that contains a wildcard. `src/**\/*.ts` reduces to `src`, `a/b*` to `a`.
*/
function literalPrefix(entry) {
	const segments = entry.split("/");
	const first = segments.findIndex((segment) => GLOB_CHARS.test(segment));
	return (first < 0 ? segments : segments.slice(0, first)).join("/");
}
/**
* True when the two entries could touch the same file. Segment-boundary prefixes only,
* so `a/b` and `a/bc` stay apart; a wildcard reduces to its literal prefix, which makes
* this report overlaps that a particular run would not have produced.
*/
function scopesIntersect(left, right) {
	if (left.length === 0 || right.length === 0) return true;
	if (left === right) return true;
	return left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}
/**
* Compare two declarations. Shared hotspots are reported separately from concrete
* overlaps: the lead's action differs — one is "narrow the scope or serialise the two
* tasks", the other is "these files are shared by everything".
*/
function scopeConflict(left, right, shared = SHARED_PATH_DEFAULTS) {
	const reduce = (entry) => literalPrefix(entry);
	const overlaps = (entry, other) => scopesIntersect(reduce(entry), reduce(other));
	let sharedHit;
	for (const a of left) for (const b of right) {
		if (!overlaps(a, b)) continue;
		if (!shared.some((candidate) => overlaps(a, candidate) || overlaps(b, candidate))) return {
			kind: "overlap",
			left: a,
			right: b
		};
		sharedHit ??= {
			kind: "shared",
			left: a,
			right: b
		};
	}
	return sharedHit;
}
/** Changed paths that fall outside a declaration. */
function outsideScope(changed, declared) {
	return changed.filter((candidate) => {
		const normalized = normalizeScopePath(candidate);
		if (normalized === void 0) return false;
		return !declared.some((entry) => scopesIntersect(literalPrefix(entry), normalized));
	});
}
/** Two declarations that a reviewer can compare without re-reading the contract. */
function scopeSummary(paths) {
	return paths === void 0 || paths.length === 0 ? "not declared" : paths.join(", ");
}
function resolveWorkspacePath(workspacePath, entry) {
	return path.join(workspacePath, ...entry.split("/"));
}
export { CODING_KINDS, MAX_PATHS, SHARED_PATH_DEFAULTS, literalPrefix, normalizeScope, normalizeScopePath, outsideScope, resolveWorkspacePath, scopeConflict, scopeSummary, scopesIntersect };
