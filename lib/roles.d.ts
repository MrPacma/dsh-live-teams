export type RolePermissions = {
  readonly workspaceWrite?: boolean;
  readonly canDelegate?: boolean;
  readonly [key: string]: boolean | undefined;
};
export type LiveTeamsRole = {
  readonly id: string;
  readonly name: string;
  readonly body: string;
  readonly description?: string;
  readonly capabilities: readonly string[];
  readonly preferredTaskKinds: readonly string[];
  readonly restrictions: readonly string[];
  readonly aliases: readonly string[];
  readonly permissions: RolePermissions;
  readonly source: 'global' | 'workspace';
  readonly overridden: boolean;
  readonly filePath: string;
};
export type ParsedRole = Omit<LiveTeamsRole, 'source' | 'overridden'>;
export type RoleRegistrySync = Pick<RoleRegistry, 'resolve'>;
export type RoleRegistry = {
  readonly roles: readonly LiveTeamsRole[];
  readonly globalRoleIds: ReadonlySet<string>;
  readonly globalRolePath: (id: string) => string | undefined;
  readonly globalDirectory: string;
  readonly workspaceDirectory: string;
  readonly workspaceDirectoryExists: boolean;
  readonly resolve: (value: string) => LiveTeamsRole | undefined;
};
export declare function readRoleRegistrySync(globalDirectory: string, workspaceDirectory: string): RoleRegistry;
export declare function readRoleRegistry(globalDirectory: string, workspaceDirectory: string): Promise<RoleRegistry>;
export declare function parseRoleDocument(id: string, contents: string, filePath?: string): ParsedRole;