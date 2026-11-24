import { createRequire } from "node:module";
// src/compatibility.ts
/**
* Read a host service the way the plugin itself does.
*
* Cordis **throws** when a service that was not declared in `inject` is read as a property, so a
* compatibility check that pokes at `ctx.tools` does not report a missing service — it crashes the
* plugin it was meant to protect. The safe reader is `ctx.get(name)`; the property access stays as a
* fallback for a plain object, wrapped so that a throwing host reads as "not available".
*/
function service(host, name) {
	try {
		const get = host.get;
		if (typeof get === "function") return get.call(host, name);
	} catch {
		return;
	}
	try {
		return host[name];
	} catch {
		return;
	}
}
function hasFunction(host, name, member) {
	const value = service(host, name);
	if (value === void 0 || value === null) return false;
	if (member === void 0) return true;
	try {
		return typeof value[member] === "function";
	} catch {
		return false;
	}
}
/**
* The host surfaces this plugin calls, and whether it can live without them.
*
* Keep this list honest: it is the contract with the host. Adding a call to a new service without
* adding it here means the next DSH release can remove it silently.
*/
const HOST_CAPABILITIES = Object.freeze([
	{
		name: "sessionController.create",
		required: true,
		present: (host) => hasFunction(host, "sessionController", "create")
	},
	{
		name: "agents.get",
		required: true,
		present: (host) => hasFunction(host, "agents", "get")
	},
	{
		name: "systemPrompt",
		required: true,
		present: (host) => service(host, "systemPrompt") !== void 0 && service(host, "systemPrompt") !== null
	},
	{
		name: "workspaceRegistry",
		required: true,
		present: (host) => service(host, "workspaceRegistry") !== void 0 && service(host, "workspaceRegistry") !== null
	},
	{
		name: "tools.register",
		required: false,
		present: (host) => hasFunction(host, "tools", "register")
	},
	{
		name: "webServer.register",
		required: false,
		present: (host) => hasFunction(host, "webServer", "register")
	}
]);
/** The version of the host packages this plugin is running against, when it can be read. */
function hostVersion() {
	try {
		const require = createRequire(import.meta.url);
		for (const name of ["@deepseek-ai/dsh-agent", "@deepseek-ai/dsh-session"]) try {
			const manifest = require(`${name}/package.json`);
			if (typeof manifest.version === "string") return manifest.version;
		} catch {}
	} catch {}
}
/** The versions this plugin declares support for, read from its own manifest. */
function declaredReleases() {
	try {
		const manifest = createRequire(import.meta.url)("../package.json");
		return Object.keys(manifest.dsh?.compatibility?.dshReleases ?? {});
	} catch {
		return [];
	}
}
function checkCompatibility(host, options = {}) {
	const capabilities = options.capabilities ?? HOST_CAPABILITIES;
	const missing = capabilities.filter((capability) => capability.required && !capability.present(host)).map((capability) => capability.name);
	const absent = capabilities.filter((capability) => !capability.required && !capability.present(host)).map((capability) => capability.name);
	const version = options.hostVersion ?? hostVersion();
	const declared = options.declared ?? declaredReleases();
	const undeclared = version !== void 0 && declared.length > 0 && !declared.includes(version);
	const verdict = missing.length > 0 ? "incompatible" : absent.length > 0 || undeclared ? "degraded" : "compatible";
	const detail = missing.length > 0 ? `DSH ${version ?? "of unknown version"} does not offer ${missing.join(", ")}; the team stays off until the plugin is updated` : absent.length > 0 ? `running without ${absent.join(", ")}; the team works, the surfaces they serve do not` : undeclared ? `DSH ${version ?? "of unknown version"} is not in this plugin's declared releases (${declared.join(", ")}); everything the plugin calls is present` : `DSH ${version ?? "of unknown version"} offers everything this plugin calls`;
	return {
		verdict,
		...version === void 0 ? {} : { hostVersion: version },
		missing,
		absent,
		detail
	};
}
export { HOST_CAPABILITIES, checkCompatibility, declaredReleases, hostVersion };
