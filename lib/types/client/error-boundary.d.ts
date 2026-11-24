import React, { type ErrorInfo, type ReactNode } from 'react';
/**
 * A panel that cannot render must say so, not vanish.
 *
 * The Team tab went blank on DSH 0.1.7 and the only trace was one line in the application log. A
 * blank tab tells a person nothing: not whether the plugin is missing, disabled, or crashing. React
 * throws while rendering a slot when a component it is given is `undefined` — a host rename does
 * exactly that — and the throw takes the whole slot with it.
 *
 * This boundary catches it and shows what happened, so the next rename reads as a sentence in the
 * panel instead of an empty space. The fallbacks in `primitives.ts` and `icons.ts` are the first
 * line of defence; this is the second, for anything they do not cover.
 */
type Props = {
    children?: ReactNode;
    label: string;
};
type State = {
    message?: string;
    stack?: string;
};
export declare class PanelErrorBoundary extends React.Component<Props, State> {
    state: State;
    static getDerivedStateFromError(error: unknown): State;
    componentDidCatch(error: unknown, info: ErrorInfo): void;
    render(): ReactNode;
}
export {};
