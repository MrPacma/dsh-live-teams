/** Stable host-side error taxonomy and platform translation. */
export declare const ERROR_CODES: Readonly<{
  readonly SESSION_NOT_FOUND: "SESSION_NOT_FOUND";
  readonly SESSION_WRONG_WORKSPACE: "SESSION_WRONG_WORKSPACE";
  readonly SESSION_BUSY: "SESSION_BUSY";
  readonly DELIVERY_REJECTED: "DELIVERY_REJECTED";
  readonly MODEL_UNAVAILABLE: "MODEL_UNAVAILABLE";
  readonly INTERRUPT_UNSUPPORTED: "INTERRUPT_UNSUPPORTED";
  readonly PLUGIN_DISPOSING: "PLUGIN_DISPOSING";
  readonly CAPABILITY_UNAVAILABLE: "CAPABILITY_UNAVAILABLE";
  readonly REVISION_CONFLICT: "REVISION_CONFLICT";
  readonly BINDING_STALE: "BINDING_STALE";
  readonly SCHEMA_UNSUPPORTED: "SCHEMA_UNSUPPORTED";
  readonly STATE_CORRUPT: "STATE_CORRUPT";
  /** ADR 0006: the reviewed base moved before integration, so the decision must be refreshed. */
  readonly STALE_BASE: "STALE_BASE";
}>;
export type ErrorCode = keyof typeof ERROR_CODES;
export type ErrorOptions = {
  cause?: unknown;
  auditDetail?: string;
  details?: Record<string, unknown>;
};
/** Audit text used when a member was rebound after command admission. */
export declare const BINDING_STALE_MESSAGE = "the member was rebound after this command was admitted";
export declare class LiveTeamsError extends Error {
  readonly code: ErrorCode;
  readonly auditDetail: string | undefined;
  readonly details: Record<string, unknown>;
  constructor(code: ErrorCode | string, message: string, options?: ErrorOptions);
}
/** Translate platform failures into stable domain errors. */
export declare function translatePlatformError(error: unknown): LiveTeamsError;
export declare function platformErrorMappings(): ReadonlyMap<string, ErrorCode>;