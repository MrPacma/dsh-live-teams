import React from 'react';
import type { TeamMember, TeamSnapshot } from './api.js';
import type { LocaleKey } from './locales.js';
import './styles.js';
export type RosterContext = {
    readonly sessions: {
        open(sessionId: string): void;
    };
    readonly t: (key: LocaleKey) => string;
};
export type RosterProps = {
    readonly ctx?: RosterContext;
};
export declare function rosterIsVisible(snapshot: TeamSnapshot | null, sessions?: unknown): boolean;
export declare function liveMemberCount(snapshot: TeamSnapshot): number;
export declare function memberMarkerLabel(member: TeamMember, t: (key: LocaleKey) => string): string;
export declare function canOpenMember(member: TeamMember): boolean;
export declare function openMember(member: TeamMember, sessions: RosterContext['sessions']): void;
export type RosterRowProps = {
    readonly member: TeamMember;
    readonly sessions: RosterContext['sessions'];
    readonly t: (key: LocaleKey) => string;
};
export declare function RosterRow(props: RosterRowProps): React.ReactElement;
export declare function Roster(props: RosterProps): React.ReactElement | null;
export default Roster;
