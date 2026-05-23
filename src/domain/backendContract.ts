import type { AppHealthReport } from "./appHealthReport";
import type {
  CommandResult,
  DomainCommand,
  DomainCommandContext
} from "./commandLayer";
import type { EngineeringHandoffPackage } from "./engineeringHandoffPackage";
import type { AppState } from "./types";

export type BackendEndpointId =
  | "POST /commands"
  | "GET /state"
  | "PUT /state/import"
  | "GET /projects/:id/handoff";

export type BackendHttpMethod = "GET" | "POST" | "PUT";

export type BackendExcludedFeature =
  | "login"
  | "auth"
  | "multi-user"
  | "permissions"
  | "complex sync conflict"
  | "realtime collaboration"
  | "database normalization migration"
  | "remote persistence implementation"
  | "actual HTTP routing/server"
  | "automatic AI command execution";

export type BackendContractErrorCode =
  | "invalid_request"
  | "missing_command"
  | "invalid_command_shape"
  | "missing_snapshot"
  | "invalid_snapshot_shape"
  | "invalid_import_mode"
  | "apply_not_allowed";

export interface BackendContractError {
  code: BackendContractErrorCode;
  message: string;
  evidence?: unknown[];
}

export interface BackendEndpointContract {
  id: BackendEndpointId;
  method: BackendHttpMethod;
  path: string;
  purpose: string;
  transportRole: string;
  requestShape: string;
  responseShape: string;
  mutationPolicy: string;
  requiredFlow: readonly string[];
  safetyRules: readonly string[];
  requiredConfirmationFlags: readonly string[];
  excludedCapabilities: readonly BackendExcludedFeature[];
}

export interface BackendContract {
  schemaVersion: "backend-contract/v0";
  localFirstStrategy: string;
  importStrategy: readonly ["Validate", "Dry Run", "Apply"];
  endpoints: readonly BackendEndpointContract[];
  excludedFeatures: readonly BackendExcludedFeature[];
  safetyRules: readonly string[];
}

export interface BackendCommandRequest {
  command: DomainCommand;
  ctx?: DomainCommandContext;
}

export interface BackendCommandResponse {
  endpoint: "POST /commands";
  result: CommandResult;
  safetyNotes: readonly string[];
}

export interface BackendStateSnapshotResponse {
  endpoint: "GET /state";
  state: AppState;
  appHealth?: Pick<AppHealthReport, "summary" | "findings">;
  localFirstSourceOfTruth: true;
  mutationApplied: false;
}

export type BackendStateImportMode = "validate" | "dry_run";

export interface BackendStateImportValidationRequest {
  snapshot: AppState;
  mode: BackendStateImportMode;
  apply: false;
}

export interface BackendStateImportApplyRequest {
  snapshot: AppState;
  apply: true;
}

export type BackendStateImportRequest =
  | BackendStateImportValidationRequest
  | BackendStateImportApplyRequest;

export interface BackendStateImportDryRunResponse {
  endpoint: "PUT /state/import";
  acceptedForDryRun: boolean;
  warningsVisible: true;
  applyRequiresUserConfirmation: true;
  mutationApplied: false;
  importFlow: readonly ["Validate", "Dry Run", "Apply"];
  error?: BackendContractError;
}

export interface BackendStateImportApplyResponse {
  endpoint: "PUT /state/import";
  importMode: "full_replace";
  warningsVisible: true;
  mutationApplied: true;
}

export type BackendStateImportResponse =
  | BackendStateImportDryRunResponse
  | BackendStateImportApplyResponse;

export interface BackendHandoffPackageResponse {
  endpoint: "GET /projects/:id/handoff";
  projectId: string;
  package: EngineeringHandoffPackage;
  mutationApplied: false;
}

export type BackendValidationResult<TRequest> =
  | {
      ok: true;
      endpoint: BackendEndpointId;
      request: TRequest;
      safetyNotes: readonly string[];
    }
  | {
      ok: false;
      endpoint: BackendEndpointId;
      error: BackendContractError;
      safetyNotes: readonly string[];
    };

const excludedFeatures = [
  "login",
  "auth",
  "multi-user",
  "permissions",
  "complex sync conflict",
  "realtime collaboration",
  "database normalization migration",
  "remote persistence implementation",
  "actual HTTP routing/server",
  "automatic AI command execution"
] as const satisfies readonly BackendExcludedFeature[];

const backendSafetyRules = [
  "local-first AppState remains source of truth for this phase.",
  "backend channel is a future transport boundary.",
  "command execution must still pass through Command Layer.",
  "snapshot import must still follow Validate -> Dry Run -> Apply.",
  "Backend command endpoint is a transport wrapper only.",
  "Command Layer remains the mutation gate.",
  "AI drafts and suggested command metadata cannot automatically mutate state."
] as const;

const commandEndpointSafetyRules = [
  "Backend command endpoint is a transport wrapper only.",
  "Command Layer remains the mutation gate.",
  "Transport must call executeDomainCommand(state, command, ctx).",
  "Direct mutation owner calls are forbidden.",
  "Unconfirmed AI commands must be rejected by Command Layer."
] as const;

const backendEndpointContracts = [
  {
    id: "POST /commands",
    method: "POST",
    path: "/commands",
    purpose: "Receive a DomainCommand and return a CommandResult.",
    transportRole: "Transport wrapper around executeDomainCommand(state, command, ctx).",
    requestShape: "BackendCommandRequest { command: DomainCommand; ctx?: DomainCommandContext }",
    responseShape: "BackendCommandResponse { result: CommandResult }",
    mutationPolicy: "Must use executeDomainCommand; must not call mutation owners directly.",
    requiredFlow: ["Validate command envelope", "Pass to Command Layer", "Return CommandResult"],
    safetyRules: commandEndpointSafetyRules,
    requiredConfirmationFlags: [
      "command.confirmedByUser must be true before mutation can pass Command Layer.",
      "command.source must be user or ai.",
      "AI commands without human confirmation must fail in Command Layer."
    ],
    excludedCapabilities: ["automatic AI command execution"]
  },
  {
    id: "GET /state",
    method: "GET",
    path: "/state",
    purpose: "Return the current local-first AppState snapshot and optional app health summary.",
    transportRole: "Read-only snapshot transport.",
    requestShape: "No body.",
    responseShape: "BackendStateSnapshotResponse { state: AppState; appHealth?: summary/findings }",
    mutationPolicy: "No mutation, no repair, and no normalization-save.",
    requiredFlow: ["Read current AppState", "Optionally build app health summary", "Return snapshot"],
    safetyRules: [
      "local-first AppState remains source of truth for this phase.",
      "GET /state must not mutate AppState.",
      "GET /state must not repair references.",
      "GET /state must not normalize-save imported or current state."
    ],
    requiredConfirmationFlags: [],
    excludedCapabilities: ["remote persistence implementation", "actual HTTP routing/server"]
  },
  {
    id: "PUT /state/import",
    method: "PUT",
    path: "/state/import",
    purpose: "Receive an AppState snapshot import candidate for validation, dry-run preview, or explicitly confirmed apply.",
    transportRole: "Snapshot import transport with a strict preview/apply boundary.",
    requestShape: "BackendStateImportRequest preview { snapshot: AppState; mode: validate | dry_run; apply?: false } or confirmed apply { snapshot: AppState; apply: true }",
    responseShape: "BackendStateImportResponse reports warnings and mutationApplied.",
    mutationPolicy: "validate, dry_run, and apply:false must not overwrite state; only explicit apply:true may full-replace state after validation succeeds.",
    requiredFlow: ["Validate", "Dry Run", "Apply"],
    safetyRules: [
      "snapshot import must still follow Validate -> Dry Run -> Apply.",
      "Import warnings must be visible before apply.",
      "Import warnings must not block explicit confirmed apply.",
      "validate, dry_run, and apply:false requests must not mutate AppState.",
      "Explicit apply:true is the only backend snapshot path that may full-replace AppState.",
      "Validation errors and rejected imports must never mutate AppState.",
      "Validation helpers must not import state.",
      "Validation helpers must not normalize-save.",
      "Apply requires explicit user confirmation."
    ],
    requiredConfirmationFlags: [
      "applyRequiresUserConfirmation must be true.",
      "apply must be false or omitted for validation/dry-run transport requests.",
      "apply:true is required for confirmed full-replace snapshot import."
    ],
    excludedCapabilities: [
      "remote persistence implementation",
      "database normalization migration",
      "complex sync conflict"
    ]
  },
  {
    id: "GET /projects/:id/handoff",
    method: "GET",
    path: "/projects/:id/handoff",
    purpose: "Return an EngineeringHandoffPackage for a project id.",
    transportRole: "Read-only handoff package transport.",
    requestShape: "Path param { id: string }",
    responseShape: "BackendHandoffPackageResponse { package: EngineeringHandoffPackage }",
    mutationPolicy: "Must not mark handoff_ready, execute commands, or mutate state.",
    requiredFlow: ["Resolve project id", "Build EngineeringHandoffPackage", "Return deterministic response"],
    safetyRules: [
      "GET /projects/:id/handoff must not mark handoff_ready.",
      "GET /projects/:id/handoff must not execute commands.",
      "GET /projects/:id/handoff must not mutate AppState.",
      "Missing projects must return deterministic invalid package responses."
    ],
    requiredConfirmationFlags: [],
    excludedCapabilities: ["automatic AI command execution", "actual HTTP routing/server"]
  }
] as const satisfies readonly BackendEndpointContract[];

const backendContract = {
  schemaVersion: "backend-contract/v0",
  localFirstStrategy:
    "local-first AppState remains source of truth for this phase; backend channel is a future transport boundary.",
  importStrategy: ["Validate", "Dry Run", "Apply"],
  endpoints: backendEndpointContracts,
  excludedFeatures,
  safetyRules: backendSafetyRules
} as const satisfies BackendContract;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function fail(
  endpoint: BackendEndpointId,
  code: BackendContractErrorCode,
  message: string,
  evidence: unknown[] = []
): BackendValidationResult<never> {
  return {
    ok: false,
    endpoint,
    error: {
      code,
      message,
      ...(evidence.length > 0 ? { evidence } : {})
    },
    safetyNotes: backendSafetyRules
  };
}

function commandRequestSafetyNotes() {
  return [
    ...commandEndpointSafetyRules,
    "Validation only checks transport shape; executeDomainCommand performs mutation validation."
  ] as const;
}

function targetShapeIsValid(target: unknown) {
  return target === undefined ||
    (isRecord(target) &&
      isNonEmptyString(target.type) &&
      isNonEmptyString(target.id));
}

function commandShapeIsValid(command: unknown): command is DomainCommand {
  if (!isRecord(command)) return false;
  if (!isNonEmptyString(command.id)) return false;
  if (!isNonEmptyString(command.type)) return false;
  if (command.source !== "user" && command.source !== "ai") return false;
  if (typeof command.confirmedByUser !== "boolean") return false;

  return targetShapeIsValid(command.target);
}

function requiredSnapshotArraysArePresent(snapshot: Record<string, unknown>) {
  return ["universes", "thoughts", "projects", "relationships", "aiInsights"]
    .every((key) => Array.isArray(snapshot[key]));
}

function optionalSnapshotCollectionsAreValid(snapshot: Record<string, unknown>) {
  return (snapshot.blockingQuestions === undefined || Array.isArray(snapshot.blockingQuestions)) &&
    (snapshot.decisionRecords === undefined || Array.isArray(snapshot.decisionRecords)) &&
    (snapshot.engineeringReadiness === undefined || isRecord(snapshot.engineeringReadiness)) &&
    (snapshot.nextActionState === undefined || isRecord(snapshot.nextActionState));
}

export function getBackendContract(): BackendContract {
  return {
    ...backendContract,
    endpoints: [...backendContract.endpoints],
    excludedFeatures: [...backendContract.excludedFeatures],
    safetyRules: [...backendContract.safetyRules],
    importStrategy: [...backendContract.importStrategy]
  };
}

export function validateBackendCommandRequest(
  request: unknown
): BackendValidationResult<BackendCommandRequest> {
  const endpoint: BackendEndpointId = "POST /commands";

  if (!isRecord(request)) {
    return fail(endpoint, "invalid_request", "Backend command request must be an object.");
  }

  if (!("command" in request)) {
    return fail(endpoint, "missing_command", "Backend command request requires command.", ["command"]);
  }

  if (!commandShapeIsValid(request.command)) {
    return fail(
      endpoint,
      "invalid_command_shape",
      "Command must include id, type, source, confirmedByUser, and optional target type/id.",
      [request.command]
    );
  }

  if (request.ctx !== undefined && !isRecord(request.ctx)) {
    return fail(endpoint, "invalid_request", "Command ctx must be an object when provided.", ["ctx"]);
  }

  return {
    ok: true,
    endpoint,
    request: {
      command: request.command,
      ...(request.ctx !== undefined ? { ctx: request.ctx as DomainCommandContext } : {})
    },
    safetyNotes: commandRequestSafetyNotes()
  };
}

export function validateStateImportRequest(
  request: unknown
): BackendValidationResult<BackendStateImportValidationRequest> {
  const endpoint: BackendEndpointId = "PUT /state/import";

  if (!isRecord(request)) {
    return fail(endpoint, "invalid_request", "State import request must be an object.");
  }

  if (request.apply === true) {
    return fail(
      endpoint,
      "apply_not_allowed",
      "State import validation cannot apply or overwrite state.",
      ["apply"]
    );
  }

  if (!("snapshot" in request)) {
    return fail(endpoint, "missing_snapshot", "State import request requires snapshot.", ["snapshot"]);
  }

  if (!isRecord(request.snapshot)) {
    return fail(endpoint, "invalid_snapshot_shape", "State import snapshot must be an object.", ["snapshot"]);
  }

  if (!requiredSnapshotArraysArePresent(request.snapshot)) {
    return fail(
      endpoint,
      "invalid_snapshot_shape",
      "State import snapshot requires universes, thoughts, projects, relationships, and aiInsights arrays.",
      ["universes", "thoughts", "projects", "relationships", "aiInsights"]
    );
  }

  if (!optionalSnapshotCollectionsAreValid(request.snapshot)) {
    return fail(
      endpoint,
      "invalid_snapshot_shape",
      "Optional snapshot collections must have valid transport shapes.",
      ["blockingQuestions", "decisionRecords", "engineeringReadiness", "nextActionState"]
    );
  }

  const mode = request.mode === undefined ? "dry_run" : request.mode;
  if (mode !== "validate" && mode !== "dry_run") {
    return fail(endpoint, "invalid_import_mode", "State import mode must be validate or dry_run.", ["mode"]);
  }

  return {
    ok: true,
    endpoint,
    request: {
      snapshot: request.snapshot as unknown as AppState,
      mode,
      apply: false
    },
    safetyNotes: [
      "snapshot import must still follow Validate -> Dry Run -> Apply.",
      "Validation helper does not mutate AppState.",
      "Validation helper does not import state.",
      "Validation helper does not normalize-save.",
      "Apply requires explicit user confirmation outside this helper."
    ]
  };
}
