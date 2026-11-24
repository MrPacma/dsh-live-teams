import { promises } from "node:fs";
import path from "node:path";
// src/storage.ts
let temporaryFileCounter = 0;
const locks = /* @__PURE__ */ new Map();
async function withProcessLock(key, operation) {
	const previous = locks.get(key) ?? Promise.resolve();
	let release;
	const current = new Promise((resolve) => {
		release = resolve;
	});
	locks.set(key, current);
	await previous;
	try {
		return await operation();
	} finally {
		release();
		if (locks.get(key) === current) locks.delete(key);
	}
}
async function atomicWrite(filePath, contents) {
	const directory = path.dirname(filePath);
	await promises.mkdir(directory, { recursive: true });
	const basename = path.basename(filePath);
	const temporaryPath = path.join(directory, `.${basename}.${process.pid}.${Date.now()}.${temporaryFileCounter++}.tmp`);
	let handle;
	try {
		handle = await promises.open(temporaryPath, "wx", 384);
		await handle.writeFile(contents);
		await handle.sync();
		await handle.close();
		handle = void 0;
		await promises.rename(temporaryPath, filePath);
		const directoryHandle = await promises.open(directory, "r");
		try {
			await directoryHandle.sync();
		} catch (error) {
			if (process.platform !== "win32" || error.code !== "EPERM") throw error;
		} finally {
			await directoryHandle.close();
		}
	} finally {
		if (handle !== void 0) await handle.close().catch(() => void 0);
		await promises.unlink(temporaryPath).catch(() => void 0);
	}
}
async function atomicWriteJson(filePath, value) {
	await atomicWrite(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
async function readJson(filePath) {
	return JSON.parse(await promises.readFile(filePath, "utf8"));
}
async function fileExists(filePath) {
	try {
		await promises.access(filePath);
		return true;
	} catch (error) {
		if (error.code === "ENOENT") return false;
		throw error;
	}
}
function clone(value) {
	return value === void 0 ? value : JSON.parse(JSON.stringify(value));
}
const CURRENT_SCHEMA_VERSION = 1;
export { CURRENT_SCHEMA_VERSION, atomicWrite, atomicWriteJson, clone, fileExists, readJson, withProcessLock };
