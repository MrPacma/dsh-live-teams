/**
 * The icon names this plugin looks for, newest naming scheme first.
 *
 * Kept apart from the resolver so it can be checked without loading the host's primitives package:
 * the resolver imports the real module, a test cannot.
 */
export declare const ICON_CANDIDATES: Readonly<Record<string, readonly string[]>>;
