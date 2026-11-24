import type { ComponentType } from 'react';
/**
 * Icons, resolved by name at runtime instead of imported by name at build time.
 *
 * The host renamed every icon between 0.1.5-rc.2 and 0.1.7-rc.1: `IconEditOutline16` became
 * `IconEditOutlineRegular` (stroke 1, what the host itself uses) or `IconEditOutlineMedium`
 * (stroke 1.3). A named import of a name that no longer exists is not an error at load time — it is
 * `undefined` — and React then throws "element type is invalid" (error #130) while rendering the
 * whole panel. That is exactly what happened: the Team tab was empty, and the host log said
 * `slot entry crashed in 'conversation.view'` with nothing about icons.
 *
 * So each icon is looked up by a list of names, newest first, and an icon that cannot be found
 * renders nothing. One renamed icon costs one icon, never the panel.
 */
type IconProps = {
    size?: number;
    className?: string;
};
type IconComponent = ComponentType<IconProps>;
/** Newest naming scheme first, then the one this plugin was written against. */
export declare const IconEdit: IconComponent;
export declare const IconPlus: IconComponent;
export declare const IconPause: IconComponent;
export declare const IconPlay: IconComponent;
export declare const IconRefresh: IconComponent;
export declare const IconChevronDown: IconComponent;
export {};
