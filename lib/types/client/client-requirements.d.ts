/**
 * What this panel needs the host's client packages to export.
 *
 * On DSH 0.1.7 the host renamed every icon (`IconEditOutline16` → `IconEditOutlineRegular`) and the
 * Team tab went blank: a named import that no longer exists is `undefined`, and React throws
 * "element type is invalid" while rendering the whole slot. Nothing in the build or the tests
 * noticed, because the tests mock the package.
 *
 * So the requirement is written down here, next to the code that uses it, and checked twice: a unit
 * test holds this list against the real import in the panel, and `b36-client-names-check.mjs` holds
 * it against whatever host is installed. The next rename fails a check instead of a person's tab.
 */
export declare const REQUIRED_PRIMITIVES: readonly string[];
/** Every icon name the panel may ask for, from the resolver's candidate lists. */
export declare function requiredIconNames(): readonly string[];
/** One icon per entry is enough: the resolver only needs a hit somewhere in its list. */
export declare function iconFamilies(): readonly (readonly string[])[];
