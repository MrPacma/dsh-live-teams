import { type ComponentType } from 'react';
/**
 * Host components, resolved by name at runtime with a working fallback.
 *
 * The icons were the first thing to break this way: the host renamed them, a named import became
 * `undefined`, and React took the whole Team tab down with "element type is invalid". The six
 * components below are imported the same way and carry the same risk — `Modal`, `Button`,
 * `MarkdownText`, `StateDot`, `Tag`, `Tooltip` are exactly as renameable as an icon.
 *
 * So they are resolved too. A missing component now degrades to something plain that still works —
 * a dialog that opens, a button that clicks, markdown shown as text — instead of a blank panel. The
 * fallbacks are deliberately dull: the point is that the human can still see the team and act.
 */
type AnyProps = Record<string, unknown>;
export declare const Button: ComponentType<AnyProps>;
export declare const MarkdownText: ComponentType<AnyProps>;
export declare const Modal: ComponentType<AnyProps>;
export declare const StateDot: ComponentType<AnyProps>;
export declare const Tag: ComponentType<AnyProps>;
export declare const Tooltip: ComponentType<AnyProps>;
/** Which of them the host actually provided, for a check or a log line. */
export declare function resolvedFromHost(): readonly string[];
export {};
