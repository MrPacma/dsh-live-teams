import * as path from "node:path";
import * as fsp from "node:fs/promises";
import { execFile } from "node:child_process";
// src/git-artifacts.ts
/**
* Git plumbing for Git-bound submissions (Phase 6, ADR 0006).
*
* The plugin — not the member — turns the submitted paths into one commit, and it does so without
* touching the branch, the index or any other file in the tree. That matters because members share
* one checkout: switching branches or staging paths would disturb a colleague's work in progress.
* Everything here is plumbing, so the only visible effect is a new object and a plugin-owned ref.
*
* `undefined` means "not observable" everywhere: no repository, no commit, an unreadable answer.
* The caller records that honestly rather than inventing a result.
*/
const GIT_TIMEOUT_MS = 2e4;
async function git(workspacePath, args, options = {}) {
	return await new Promise((resolve) => {
		const child = execFile("git", [
			"-C",
			workspacePath,
			...args
		], {
			timeout: GIT_TIMEOUT_MS,
			maxBuffer: 8388608,
			env: options.env === void 0 ? process.env : {
				...process.env,
				...options.env
			}
		}, (error, stdout) => resolve({
			stdout: String(stdout),
			ok: error === null
		}));
		if (options.input !== void 0) child.stdin?.end(options.input);
	});
}
/** The branch and tip a piece of work is based on. `undefined` in a repository with no commits. */
async function baseInfo(workspacePath) {
	const head = await git(workspacePath, ["rev-parse", "HEAD"]);
	if (!head.ok) return void 0;
	const sha = head.stdout.trim();
	const symbolic = await git(workspacePath, [
		"symbolic-ref",
		"-q",
		"HEAD"
	]);
	if (!symbolic.ok) return void 0;
	const ref = symbolic.stdout.trim();
	return ref.length === 0 || !/^[0-9a-f]{40}$/u.test(sha) ? void 0 : {
		ref,
		sha
	};
}
/** The entries of a commit's tree, flattened to `path → mode:sha`, for building on top of it. */
async function baseTree(workspacePath, base) {
	const entries = /* @__PURE__ */ new Map();
	if (base === void 0) return entries;
	const listed = await git(workspacePath, [
		"ls-tree",
		"-r",
		"-z",
		base.sha
	]);
	if (!listed.ok) return void 0;
	for (const record of listed.stdout.split("\0")) {
		if (record.length === 0) continue;
		const match = /^(\d{6}) (\w+) ([0-9a-f]{40})\t(.+)$/su.exec(record);
		if (match === null || match[2] !== "blob") continue;
		entries.set(match[4], {
			mode: match[1],
			sha: match[3]
		});
	}
	return entries;
}
/**
* Build one commit from exactly these paths, parented on `base`.
*
* The tree is the *base tree* with the submitted paths replaced: a commit built from scratch would
* delete everything the submission did not mention, which the first probe of this module caught by
* showing four changed paths where two were submitted. Blobs are written with `hash-object -w`,
* directories assembled bottom-up with `mktree`, and `commit-tree` writes the commit — no index, no
* checkout, no branch moved.
*
* A submitted path that is missing from disk is a deletion when the base had it, and a refusal when
* it did not: a submission cannot claim a file that never existed.
*/
async function commitPaths(workspacePath, base, request) {
	if (request.paths.length === 0) return void 0;
	const sorted = [...new Set(request.paths)].sort((left, right) => left.localeCompare(right));
	const entries = await baseTree(workspacePath, base);
	if (entries === void 0) return void 0;
	for (const relative of sorted) {
		const absolute = path.resolve(workspacePath, relative);
		if (absolute !== workspacePath && !absolute.startsWith(`${workspacePath}${path.sep}`)) return void 0;
		let content;
		let mode = "100644";
		try {
			const stat = await fsp.lstat(absolute);
			if (stat.isSymbolicLink()) {
				content = Buffer.from(await fsp.readlink(absolute));
				mode = "120000";
			} else {
				content = await fsp.readFile(absolute);
				if ((stat.mode & 73) !== 0) mode = "100755";
			}
		} catch {
			content = void 0;
		}
		if (content === void 0) {
			if (!entries.has(relative)) return void 0;
			entries.delete(relative);
			continue;
		}
		const written = await git(workspacePath, [
			"hash-object",
			"-w",
			"--stdin"
		], { input: content });
		if (!written.ok) return void 0;
		entries.set(relative, {
			mode,
			sha: written.stdout.trim()
		});
	}
	const treeOf = async (prefix) => {
		const fileLines = [];
		const parentOf = (directory) => {
			const trimmed = directory.endsWith("/") ? directory.slice(0, -1) : directory;
			const cut = trimmed.lastIndexOf("/");
			return cut < 0 ? "" : trimmed.slice(0, cut + 1);
		};
		const directories = /* @__PURE__ */ new Set();
		for (const [relative, entry] of entries) {
			if (!relative.startsWith(prefix)) continue;
			const rest = relative.slice(prefix.length);
			const slash = rest.indexOf("/");
			if (slash >= 0) {
				directories.add(`${prefix}${rest.slice(0, slash)}/`);
				continue;
			}
			fileLines.push(`${entry.mode} blob ${entry.sha}\t${rest}`);
		}
		const treeLines = [];
		for (const directory of [...directories].sort()) {
			if (parentOf(directory) !== prefix) continue;
			const child = await treeOf(directory);
			if (child === void 0) return void 0;
			treeLines.push(`040000 tree ${child}\t${directory.slice(prefix.length, -1)}`);
		}
		const built = await git(workspacePath, ["mktree"], { input: `${[...treeLines, ...fileLines].join("\n")}\n` });
		if (!built.ok) return void 0;
		return built.stdout.trim();
	};
	const treeSha = await treeOf("");
	if (treeSha === void 0) return void 0;
	const args = ["commit-tree", treeSha];
	if (base !== void 0) args.push("-p", base.sha);
	args.push("-m", request.message);
	const committed = await git(workspacePath, args, { env: {
		GIT_AUTHOR_NAME: request.author.name,
		GIT_AUTHOR_EMAIL: request.author.email,
		GIT_COMMITTER_NAME: "live-teams",
		GIT_COMMITTER_EMAIL: "live-teams@localhost"
	} });
	if (!committed.ok) return void 0;
	const headSha = committed.stdout.trim();
	if (!/^[0-9a-f]{40}$/u.test(headSha)) return void 0;
	let mergeBaseSha;
	if (base !== void 0) {
		const baseMerge = await git(workspacePath, [
			"merge-base",
			base.sha,
			headSha
		]);
		if (baseMerge.ok) mergeBaseSha = baseMerge.stdout.trim() || void 0;
	}
	return {
		headSha,
		treeSha,
		commitPaths: sorted,
		...mergeBaseSha === void 0 ? {} : { mergeBaseSha }
	};
}
/** Keep a built commit reachable, so `git gc` cannot take the reviewed artifact away. */
async function pinCommit(workspacePath, ref, sha) {
	return (await git(workspacePath, [
		"update-ref",
		ref,
		sha
	])).ok;
}
/** The current tip of a branch, for the acceptance precondition. */
async function refTip(workspacePath, ref) {
	const tip = await git(workspacePath, [
		"rev-parse",
		"--verify",
		"--quiet",
		ref
	]);
	return tip.ok && /^[0-9a-f]{40}$/u.test(tip.stdout.trim()) ? tip.stdout.trim() : void 0;
}
async function repairIndex(workspacePath, commitPaths) {
	if (commitPaths.length === 0) return true;
	return (await git(workspacePath, [
		"reset",
		"-q",
		"--",
		...commitPaths
	])).ok;
}
async function integrateCommit(workspacePath, ref, headSha, expectedTip, commitPaths = []) {
	const current = await git(workspacePath, [
		"rev-parse",
		"--verify",
		"--quiet",
		ref
	]);
	const tip = current.ok && /^[0-9a-f]{40}$/u.test(current.stdout.trim()) ? current.stdout.trim() : void 0;
	if (tip === headSha) return await repairIndex(workspacePath, commitPaths) ? "integrated" : "index-failed";
	if (expectedTip !== void 0 && tip !== expectedTip) return "stale";
	const args = [
		"update-ref",
		ref,
		headSha
	];
	if (expectedTip !== void 0) args.push(expectedTip);
	if (!(await git(workspacePath, args)).ok) return "stale";
	return await repairIndex(workspacePath, commitPaths) ? "integrated" : "index-failed";
}
/** Paths a commit changes relative to a base, for a reviewer that wants the list. */
async function commitPathsOf(workspacePath, from, to) {
	const diff = await git(workspacePath, [
		"diff",
		"--name-only",
		`${from}..${to}`
	]);
	if (!diff.ok) return void 0;
	return diff.stdout.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
}
export { baseInfo, commitPaths, commitPathsOf, integrateCommit, pinCommit, refTip };
