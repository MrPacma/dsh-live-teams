import { opendir, realpath } from "node:fs/promises";
import path from "node:path";
import { literalPrefix, normalizeScope, scopesIntersect } from "./scope.js";
// src/path-diagnostics.ts
/** Advisory only. Never follows symlinks, executes commands, or makes a contract invalid. */
async function diagnosePaths(workspace, declared, options = {}) {
	if (declared === void 0 || declared.length === 0) return [];
	const patterns = normalizeScope([...declared]);
	if (patterns === void 0) throw new Error("path diagnostics require normalized safe workspace-relative patterns");
	const matched = /* @__PURE__ */ new Set();
	const uncertain = [];
	let exhausted = false;
	let visited = 0;
	const limit = options.maxEntries ?? 5e3;
	const deadline = Date.now() + (options.maxMillis ?? 1e3);
	let root;
	try {
		root = await realpath(workspace);
	} catch {
		return patterns.map((pattern) => ({
			code: "path-scan-incomplete",
			pattern,
			message: `Could not inspect declared path "${pattern}"; workspace inspection was unavailable.`
		}));
	}
	const queue = [""];
	for (let index = 0; index < queue.length && matched.size < patterns.length; index += 1) {
		const relativeDirectory = queue[index];
		if (Date.now() > deadline) {
			exhausted = true;
			break;
		}
		try {
			const absolute = path.join(root, relativeDirectory);
			const resolved = await realpath(absolute);
			if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
				uncertain.push(relativeDirectory);
				continue;
			}
			const directory = await opendir(absolute);
			for await (const entry of directory) {
				if (++visited > limit || Date.now() > deadline) {
					exhausted = true;
					break;
				}
				const relative = relativeDirectory.length === 0 ? entry.name : `${relativeDirectory}/${entry.name}`;
				for (const pattern of patterns) try {
					if (path.matchesGlob(relative, pattern) || entry.isDirectory() && path.matchesGlob(`${relative}/`, pattern)) matched.add(pattern);
				} catch {
					uncertain.push(literalPrefix(pattern));
				}
				if (entry.isSymbolicLink()) {
					uncertain.push(relative);
					continue;
				}
				if (!entry.isDirectory()) continue;
				if (relative === ".git" || relative === ".dsh-live-teams" || relative.split("/").length > 32) {
					uncertain.push(relative);
					continue;
				}
				if (patterns.some((pattern) => !matched.has(pattern) && scopesIntersect(relative, literalPrefix(pattern)))) queue.push(relative);
			}
			if (exhausted) break;
		} catch {
			uncertain.push(relativeDirectory);
		}
	}
	return patterns.filter((pattern) => !matched.has(pattern)).map((pattern) => {
		return exhausted || uncertain.some((prefix) => scopesIntersect(prefix, literalPrefix(pattern))) ? {
			code: "path-scan-incomplete",
			pattern,
			message: `Could not establish whether "${pattern}" matches existing paths; inspection was incomplete.`
		} : {
			code: "path-no-match",
			pattern,
			message: `Declared path "${pattern}" matches no existing file or directory. Confirm that this is a new path rather than a typo.`
		};
	});
}
export { diagnosePaths };
