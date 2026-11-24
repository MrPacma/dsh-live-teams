import * as React from 'react';
import { type SessionsService } from './attention.js';
import { type LocaleKey } from './locales.js';
type LocaleService = {
    register(namespace: string, values: {
        readonly en: Record<string, string>;
        readonly ru: Record<string, string>;
    }): () => void;
    bind(namespace: string): (key: LocaleKey) => string;
};
type SlotRegistration = {
    name: string;
    id: string;
    order: number;
    locale: string;
    label: () => string;
};
type SlotsService = {
    inject(name: string, callback: () => unknown): unknown;
    register(registration: SlotRegistration, component: (props: unknown) => React.ReactElement): unknown;
};
type ClientContext = {
    slots: SlotsService;
    locale: LocaleService;
    sessions: SessionsService;
    effect(effect: () => void | (() => void), name?: string): unknown;
    /** Cordis throws when a service that was not declared in `inject` is read as a property. */
    get?(name: string): unknown;
};
export declare const name = "dsh-live-teams";
export declare const inject: readonly ["slots", "locale", "sessions"];
export { NS } from './locales.js';
export declare function apply(ctx: ClientContext): void;
