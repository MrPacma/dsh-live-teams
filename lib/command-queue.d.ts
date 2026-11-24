import { ErrorCode } from "./errors.js";
export type CommandState = 'pending' | 'leased' | 'admitted' | 'applied' | 'failed';
export interface CommandRecord {
  commandId: string;
  idempotencyKey: string;
  causationId: string | undefined;
  sessionId: string;
  bindingGeneration: number;
  mode: 'queue' | 'steer';
  reason: string;
  content: readonly unknown[];
  requestId: string;
  state: CommandState;
  receipt: string | undefined;
  failureCode: ErrorCode | undefined;
  failureDetail: string | undefined;
  revision: number;
}
type QueueOptions = {
  workspacePath: string;
  teamId: string;
  deliver: (record: CommandRecord) => Promise<{
    accepted?: true;
  } | void>;
  bindingGenerationOf?: ((sessionId: string) => Promise<number | undefined> | number | undefined) | undefined;
  now?: (() => number) | undefined;
};
type AdmissionRequest = {
  idempotencyKey: string;
  sessionId: string;
  bindingGeneration: number;
  mode: 'queue' | 'steer';
  content: readonly unknown[];
  reason?: string;
  causationId?: string;
};
export declare class SessionCommandQueue {
  private readonly workspacePath;
  private readonly teamId;
  private readonly deliver;
  private readonly bindingGenerationOf;
  private readonly now;
  private readonly file;
  constructor(options: QueueOptions);
  list(): Promise<CommandRecord[]>;
  listPending(teamId?: string): Promise<CommandRecord[]>;
  admit(request: AdmissionRequest): Promise<{
    record: CommandRecord;
    duplicate: boolean;
  }>;
  dispatch(commandId: string): Promise<CommandRecord>;
  retry(commandId: string): Promise<CommandRecord>;
  get(commandId: string): Promise<CommandRecord | undefined>;
  private transition;
  private mutate;
  private read;
}
export declare function createCommandQueue(options: QueueOptions): SessionCommandQueue;
export {};