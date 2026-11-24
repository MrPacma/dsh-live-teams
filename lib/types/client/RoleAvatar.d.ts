import React from 'react';
type RoleMetadata = {
    readonly id: string;
    readonly aliases?: readonly string[];
};
export declare const agentRoleKinds: readonly ["lead", "builder", "reviewer", "verifier", "oracle", "researcher", "scout", "delegate", "custom"];
export type AgentRoleKind = typeof agentRoleKinds[number];
/** Use the declared role/registry aliases only, never member names, notes or Session activity. */
export declare function agentRoleKind(role: string, roles?: readonly RoleMetadata[]): AgentRoleKind;
export declare function RoleAvatar({ role, label, roles }: {
    role: string;
    label: string;
    roles?: readonly RoleMetadata[];
}): React.ReactElement;
export {};
