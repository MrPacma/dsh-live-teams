import { promises, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
// src/roles.ts
function record(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function scalar(value) {
	const trimmed = value.trim();
	if (trimmed.length === 0) return void 0;
	if (trimmed.startsWith("\"") && trimmed.endsWith("\"") || trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1);
	if (trimmed === "true") return true;
	if (trimmed === "false") return false;
	return trimmed;
}
function scalarList(value) {
	const trimmed = value.trim();
	if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return void 0;
	const inner = trimmed.slice(1, -1).trim();
	if (inner.length === 0) return [];
	const parts = [];
	let current = "";
	let quote;
	for (const character of inner) if (quote !== void 0) {
		current += character;
		if (character === quote) quote = void 0;
	} else if (character === "\"" || character === "'") {
		quote = character;
		current += character;
	} else if (character === ",") {
		const item = scalar(current);
		if (typeof item !== "string") return void 0;
		parts.push(item);
		current = "";
	} else current += character;
	if (quote !== void 0) return void 0;
	const item = scalar(current);
	if (typeof item !== "string") return void 0;
	parts.push(item);
	return parts;
}
/** Parse the deliberately small, YAML-like role metadata format without executing YAML. */
function parseFrontMatter(lines) {
	const result = {};
	const permissions = {};
	let inPermissions = false;
	for (const line of lines) {
		if (line.trim().length === 0 || line.trimStart().startsWith("#")) continue;
		const match = /^(\s*)([A-Za-z][A-Za-z0-9_-]*):(?:\s*(.*))?$/u.exec(line);
		if (match === null) return void 0;
		const indent = match[1]?.length ?? 0;
		const key = match[2];
		const raw = match[3] ?? "";
		if (key === void 0) return void 0;
		if (indent > 0 && inPermissions) {
			const value = scalar(raw);
			if (typeof value !== "boolean") return void 0;
			permissions[key] = value;
			continue;
		}
		inPermissions = false;
		if (key === "permissions") {
			if (raw.trim().length > 0) return void 0;
			inPermissions = true;
			continue;
		}
		const list = scalarList(raw);
		const value = scalar(raw);
		if (key === "description") {
			if (typeof value !== "string") return void 0;
			result.description = value;
		} else if (key === "capabilities") {
			if (list === void 0) return void 0;
			result.capabilities = list;
		} else if (key === "preferredTaskKinds") {
			if (list === void 0) return void 0;
			result.preferredTaskKinds = list;
		} else if (key === "restrictions") {
			if (list !== void 0) result.restrictions = list;
			else if (typeof value === "string") result.restrictions = [value];
			else return void 0;
		} else if (key === "aliases") {
			if (list === void 0) return void 0;
			result.aliases = list;
		}
	}
	if (Object.keys(permissions).length > 0) result.permissions = permissions;
	return result;
}
function splitRoleDocument(contents) {
	const normalized = contents.replace(/^\uFEFF/u, "");
	if (!normalized.startsWith("---\n") && !normalized.startsWith("---\r\n")) return {
		metadata: void 0,
		body: normalized
	};
	const lines = normalized.split(/\r?\n/u);
	if (lines[0] !== "---") return {
		metadata: void 0,
		body: normalized
	};
	const closing = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
	if (closing < 0) return {
		metadata: void 0,
		body: normalized
	};
	const metadata = parseFrontMatter(lines.slice(1, closing));
	if (metadata === void 0) return {
		metadata: void 0,
		body: normalized
	};
	return {
		metadata,
		body: lines.slice(closing + 1).join("\n")
	};
}
function firstHeading(body, fallback) {
	for (const line of body.split(/\r?\n/u)) {
		const match = /^#\s+(.+?)\s*#*\s*$/u.exec(line);
		if (match?.[1] !== void 0 && match[1].trim().length > 0) return match[1].trim();
	}
	return fallback;
}
function roleId(file) {
	const basename = path.basename(file);
	if (!basename.endsWith(".md")) return void 0;
	const id = basename.slice(0, -3);
	return /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(id) ? id : void 0;
}
async function readRole(file, source, overridden) {
	const id = roleId(file);
	if (id === void 0) return void 0;
	let contents;
	try {
		contents = await promises.readFile(file, "utf8");
	} catch {
		return;
	}
	const document = splitRoleDocument(contents);
	const metadata = document.metadata ?? {};
	return {
		id,
		name: firstHeading(document.body, id),
		body: document.body.trim(),
		...metadata.description === void 0 ? {} : { description: metadata.description },
		capabilities: metadata.capabilities ?? [],
		preferredTaskKinds: metadata.preferredTaskKinds ?? [],
		restrictions: metadata.restrictions ?? [],
		aliases: metadata.aliases ?? [],
		permissions: metadata.permissions ?? {},
		source,
		overridden,
		filePath: path.resolve(file)
	};
}
async function readDirectory(directory, source, overriddenIds) {
	let entries;
	try {
		entries = await promises.readdir(directory);
	} catch (error) {
		if (record(error).code === "ENOENT") return [];
		return [];
	}
	const roles = [];
	for (const entry of entries.sort()) {
		const role = await readRole(path.join(directory, entry), source, source === "workspace" && overriddenIds.has(entry.slice(0, -3)));
		if (role !== void 0) roles.push(role);
	}
	return roles;
}
function readDirectorySync(directory, source, overriddenIds) {
	let entries;
	try {
		entries = readdirSync(directory);
	} catch {
		return [];
	}
	const roles = [];
	for (const entry of entries.sort()) {
		const file = path.join(directory, entry);
		const id = roleId(file);
		if (id === void 0) continue;
		let contents;
		try {
			contents = readFileSync(file, "utf8");
		} catch {
			continue;
		}
		const document = splitRoleDocument(contents);
		const metadata = document.metadata ?? {};
		roles.push({
			id,
			name: firstHeading(document.body, id),
			body: document.body.trim(),
			...metadata.description === void 0 ? {} : { description: metadata.description },
			capabilities: metadata.capabilities ?? [],
			preferredTaskKinds: metadata.preferredTaskKinds ?? [],
			restrictions: metadata.restrictions ?? [],
			aliases: metadata.aliases ?? [],
			permissions: metadata.permissions ?? {},
			source,
			overridden: source === "workspace" && overriddenIds.has(id),
			filePath: path.resolve(file)
		});
	}
	return roles;
}
function readRoleRegistrySync(globalDirectory, workspaceDirectory) {
	const globalPath = path.resolve(globalDirectory);
	const workspacePath = path.resolve(workspaceDirectory);
	const globalRoles = readDirectorySync(globalPath, "global", /* @__PURE__ */ new Set());
	const globalIds = new Set(globalRoles.map((role) => role.id));
	const workspaceRoles = readDirectorySync(workspacePath, "workspace", globalIds);
	const workspaceIds = new Set(workspaceRoles.map((role) => role.id));
	const roles = [...globalRoles.filter((role) => !workspaceIds.has(role.id)), ...workspaceRoles].sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
	const byIdentifier = /* @__PURE__ */ new Map();
	for (const role of roles) {
		byIdentifier.set(role.id, role);
		for (const alias of role.aliases) if (!byIdentifier.has(alias)) byIdentifier.set(alias, role);
	}
	const globalPaths = new Map(globalRoles.map((role) => [role.id, role.filePath]));
	let workspaceDirectoryExists = false;
	try {
		workspaceDirectoryExists = statSync(workspacePath).isDirectory();
	} catch {
		workspaceDirectoryExists = false;
	}
	return {
		roles,
		globalRoleIds: globalIds,
		globalRolePath: (id) => globalPaths.get(id),
		globalDirectory: globalPath,
		workspaceDirectory: workspacePath,
		workspaceDirectoryExists,
		resolve: (value) => byIdentifier.get(value)
	};
}
async function readRoleRegistry(globalDirectory, workspaceDirectory) {
	const globalPath = path.resolve(globalDirectory);
	const workspacePath = path.resolve(workspaceDirectory);
	const globalRoles = await readDirectory(globalPath, "global", /* @__PURE__ */ new Set());
	const globalIds = new Set(globalRoles.map((role) => role.id));
	const workspaceRoles = await readDirectory(workspacePath, "workspace", globalIds);
	const workspaceIds = new Set(workspaceRoles.map((role) => role.id));
	const roles = [...globalRoles.filter((role) => !workspaceIds.has(role.id)), ...workspaceRoles].sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
	const byIdentifier = /* @__PURE__ */ new Map();
	for (const role of roles) {
		byIdentifier.set(role.id, role);
		for (const alias of role.aliases) if (!byIdentifier.has(alias)) byIdentifier.set(alias, role);
	}
	let workspaceDirectoryExists = false;
	try {
		workspaceDirectoryExists = (await promises.stat(workspacePath)).isDirectory();
	} catch {
		workspaceDirectoryExists = false;
	}
	const globalPaths = new Map(globalRoles.map((role) => [role.id, role.filePath]));
	return {
		roles,
		globalRoleIds: globalIds,
		globalRolePath: (id) => globalPaths.get(id),
		globalDirectory: globalPath,
		workspaceDirectory: workspacePath,
		workspaceDirectoryExists,
		resolve: (value) => byIdentifier.get(value)
	};
}
function parseRoleDocument(id, contents, filePath = id) {
	if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(id)) throw new Error("invalid role id");
	const document = splitRoleDocument(contents);
	const metadata = document.metadata ?? {};
	return {
		id,
		name: firstHeading(document.body, id),
		body: document.body.trim(),
		...metadata.description === void 0 ? {} : { description: metadata.description },
		capabilities: metadata.capabilities ?? [],
		preferredTaskKinds: metadata.preferredTaskKinds ?? [],
		restrictions: metadata.restrictions ?? [],
		aliases: metadata.aliases ?? [],
		permissions: metadata.permissions ?? {},
		filePath: path.resolve(filePath)
	};
}
export { parseRoleDocument, readRoleRegistry, readRoleRegistrySync };
