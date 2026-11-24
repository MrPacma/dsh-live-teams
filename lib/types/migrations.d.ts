import { LiveTeamsError } from './errors.js';
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
export declare const MIGRATIONS: Readonly<Record<number, Migration>>;
export type MigrationPlan = {
    readonly kind: 'current';
} | {
    readonly kind: 'migrate';
    readonly from: number;
    readonly to: number;
    readonly steps: readonly number[];
} | {
    readonly kind: 'future';
    readonly error: LiveTeamsError;
};
/**
 * What has to happen to read this state. `future` is a refusal with both numbers in it: a state
 * written by a newer product is not corruption, and saying so is the difference between a person
 * updating DSH and a person hunting a bug that is not there.
 */
export declare function planMigration(stored: unknown, current: number, what: string, migrations?: Readonly<Record<number, Migration>>): MigrationPlan;
/** Run the plan's steps in order. Returns the state as the current version sees it. */
export declare function applyMigration(state: unknown, plan: MigrationPlan, migrations?: Readonly<Record<number, Migration>>): unknown;
