/**
 * Bringing stored state forward.
 *
 * Every state file carries a `schemaVersion`. Reading already tolerates an older one — the fields
 * that exist are the fields the reader knows — but nothing *brings it forward*: a field added in a
 * later version would simply be missing until something happened to write the file again, and no
 * record said the state had been read at an older version. A version from the future was refused with
 * a bare "invalid state", which reads like corruption rather than "this was written by a newer DSH".
 *
 * A migration is a pure function from one version to the next. They are registered here by the
 * version they migrate *from*, so the chain is explicit and testable; the list is empty today because
 * version 1 is the first, and the framework exists so the first real change is a two-line addition
 * rather than a redesign.
 */
export type Migration = (state: unknown) => unknown;