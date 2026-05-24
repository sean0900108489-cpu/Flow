import { buildAppHealthReport } from "./appHealthReport";
import {
  validateStateImportRequest,
  type BackendEndpointId
} from "./backendContract";
import { applyConfirmedCommandImport } from "./commands/confirmedCommandImport";
import {
  validateCommandImport,
  type CommandImportIssue
} from "./commands/commandImport";
import {
  buildEngineeringHandoffPackageExport,
  type EngineeringHandoffPackageExport
} from "./engineeringHandoffExport";
import type { DomainCommand, DomainCommandContext } from "./commandLayer";
import type { AppState } from "./types";

export interface BackendAdapterIssue {
  code: string;
  message: string;
  target?: unknown;
}

export interface BackendAdapterMeta {
  endpoint: BackendEndpointId;
  timestamp: string;
  adapter: "local-in-memory";
}

export interface BackendAdapterResult<TData> {
  ok: boolean;
  data?: TData;
  errors: BackendAdapterIssue[];
  warnings: BackendAdapterIssue[];
  meta: BackendAdapterMeta;
  mutationApplied: boolean;
}

export interface BackendGetStateData {
  endpoint: "GET /state";
  state: AppState;
  appHealth: ReturnType<typeof buildAppHealthReport>["summary"];
  localFirstSourceOfTruth: true;
  mutationApplied: false;
}

export type BackendImportStateMode = "validate" | "dry_run";

export type BackendImportStateRequest = {
  snapshot: AppState;
  mode?: BackendImportStateMode;
  apply?: false;
} | {
  snapshot: AppState;
  apply: true;
  mode?: never;
};

export interface BackendImportStatePreviewData {
  endpoint: "PUT /state/import";
  state: AppState;
  importedProjectCount: number;
  importedThoughtCount: number;
  importMode: BackendImportStateMode;
  mutationApplied: false;
}

export interface BackendImportStateApplyData {
  endpoint: "PUT /state/import";
  state: AppState;
  importedProjectCount: number;
  importedThoughtCount: number;
  importMode: "full_replace";
  mutationApplied: true;
}

export type BackendImportStateData = BackendImportStatePreviewData | BackendImportStateApplyData;

export interface BackendPostCommandsRequest {
  command?: DomainCommand;
  commands?: readonly DomainCommand[];
  confirmed?: boolean;
  ctx?: DomainCommandContext;
}

export interface BackendPostCommandsData {
  endpoint: "POST /commands";
  state: AppState;
  appliedCount: number;
  mutationApplied: true;
}

export interface BackendProjectHandoffData {
  endpoint: "GET /projects/:id/handoff";
  projectId: string;
  export: EngineeringHandoffPackageExport;
  readinessSummary: {
    canGenerateEngineeringDraft: boolean;
    canMarkHandoffReady: boolean;
    blockerCount: number;
    warningCount: number;
  };
  mutationApplied: false;
}

export interface BackendSnapshotAdapterOptions {
  now?: () => string;
}

export type BackendSnapshotAdapter = {
  getState(): BackendAdapterResult<BackendGetStateData>;
  importState(request: BackendImportStateRequest): BackendAdapterResult<BackendImportStateData>;
  postCommands(request: BackendPostCommandsRequest): BackendAdapterResult<BackendPostCommandsData>;
  getProjectHandoff(projectId: string): BackendAdapterResult<BackendProjectHandoffData>;
};

const adapterName = "local-in-memory" as const;

function cloneAppState(state: AppState): AppState {
  return JSON.parse(JSON.stringify(state)) as AppState;
}

function timestamp(options: BackendSnapshotAdapterOptions) {
  return options.now?.() ?? new Date().toISOString();
}

function meta(endpoint: BackendEndpointId, options: BackendSnapshotAdapterOptions): BackendAdapterMeta {
  return {
    endpoint,
    timestamp: timestamp(options),
    adapter: adapterName
  };
}

function ok<TData>(
  endpoint: BackendEndpointId,
  options: BackendSnapshotAdapterOptions,
  data: TData,
  warnings: BackendAdapterIssue[] = []
): BackendAdapterResult<TData> {
  return {
    ok: true,
    data,
    errors: [],
    warnings,
    meta: meta(endpoint, options),
    mutationApplied: typeof data === "object" &&
      data !== null &&
      "mutationApplied" in data &&
      (data as { mutationApplied?: unknown }).mutationApplied === true
  };
}

function fail<TData>(
  endpoint: BackendEndpointId,
  options: BackendSnapshotAdapterOptions,
  code: string,
  message: string,
  target?: unknown,
  warnings: BackendAdapterIssue[] = []
): BackendAdapterResult<TData> {
  return {
    ok: false,
    errors: [
      {
        code,
        message,
        ...(target !== undefined ? { target } : {})
      }
    ],
    warnings,
    meta: meta(endpoint, options),
    mutationApplied: false
  };
}

function commandIssueToAdapterIssue(issue: CommandImportIssue): BackendAdapterIssue {
  return {
    code: issue.code,
    message: issue.message,
    target: {
      commandId: issue.commandId,
      commandType: issue.commandType,
      path: issue.path,
      evidence: issue.evidence
    }
  };
}

function healthWarnings(state: AppState): BackendAdapterIssue[] {
  return buildAppHealthReport(state).findings.map((finding) => ({
    code: finding.code,
    message: finding.reason,
    target: {
      severity: finding.severity,
      target: finding.target,
      evidenceIds: finding.evidenceIds
    }
  }));
}

function commandPayload(request: BackendPostCommandsRequest) {
  if (request.commands !== undefined) return request.commands;
  if (request.command !== undefined) return request.command;
  return undefined;
}

export function createBackendSnapshotAdapter(
  initialState: AppState,
  options: BackendSnapshotAdapterOptions = {}
): BackendSnapshotAdapter {
  let currentState = cloneAppState(initialState);

  return {
    getState() {
      const state = cloneAppState(currentState);

      return ok("GET /state", options, {
        endpoint: "GET /state",
        state,
        appHealth: buildAppHealthReport(state).summary,
        localFirstSourceOfTruth: true,
        mutationApplied: false
      });
    },

    importState(request) {
      const endpoint = "PUT /state/import" as const;
      const rawApply = (request as { apply?: unknown }).apply;
      const isConfirmedApply = rawApply === true;

      if (rawApply !== undefined && rawApply !== false && rawApply !== true) {
        return fail(
          endpoint,
          options,
          "invalid_request",
          "PUT /state/import apply must be a boolean when provided.",
          ["apply"]
        );
      }

      if (isConfirmedApply && (request as { mode?: unknown }).mode !== undefined) {
        return fail(
          endpoint,
          options,
          "invalid_import_mode",
          "Confirmed snapshot import uses apply:true without validate or dry_run mode.",
          ["mode", "apply"]
        );
      }

      const validation = validateStateImportRequest({
        snapshot: request.snapshot,
        mode: isConfirmedApply ? "dry_run" : request.mode ?? "dry_run",
        apply: false
      });

      if (!validation.ok) {
        return fail(
          endpoint,
          options,
          validation.error.code,
          validation.error.message,
          validation.error.evidence
        );
      }

      const nextState = cloneAppState(validation.request.snapshot);
      const warnings = healthWarnings(cloneAppState(nextState));

      if (!isConfirmedApply) {
        return ok(endpoint, options, {
          endpoint,
          state: cloneAppState(nextState),
          importedProjectCount: nextState.projects.length,
          importedThoughtCount: nextState.thoughts.length,
          importMode: validation.request.mode,
          mutationApplied: false
        }, warnings);
      }

      currentState = nextState;

      return ok(endpoint, options, {
        endpoint,
        state: cloneAppState(currentState),
        importedProjectCount: currentState.projects.length,
        importedThoughtCount: currentState.thoughts.length,
        importMode: "full_replace",
        mutationApplied: true
      }, warnings);
    },

    postCommands(request) {
      const endpoint = "POST /commands" as const;
      const payload = commandPayload(request);

      if (!request.confirmed) {
        return fail(
          endpoint,
          options,
          "command_confirmation_required",
          "POST /commands requires explicit confirmed:true before applying commands."
        );
      }

      if (payload === undefined) {
        return fail(endpoint, options, "missing_command", "POST /commands requires command or commands.");
      }

      const validation = validateCommandImport(payload);
      const validationWarnings = validation.warnings.map(commandIssueToAdapterIssue);

      if (!validation.ok) {
        return fail(
          endpoint,
          options,
          "invalid_command_payload",
          "POST /commands command payload failed import validation.",
          validation.errors.map(commandIssueToAdapterIssue),
          validationWarnings
        );
      }

      const applied = applyConfirmedCommandImport(currentState, validation.commands, {
        confirmed: true,
        actorId: request.ctx?.actorId ?? "backend-snapshot-adapter"
      });
      const applyWarnings = applied.warnings.map(commandIssueToAdapterIssue);

      if (!applied.ok) {
        return fail(
          endpoint,
          options,
          "command_apply_failed",
          "POST /commands batch failed and no commands were committed.",
          applied.errors.map(commandIssueToAdapterIssue),
          [...validationWarnings, ...applyWarnings]
        );
      }

      currentState = cloneAppState(applied.state);

      return ok(endpoint, options, {
        endpoint,
        state: cloneAppState(currentState),
        appliedCount: applied.appliedCount,
        mutationApplied: true
      }, [...validationWarnings, ...applyWarnings]);
    },

    getProjectHandoff(projectId) {
      const endpoint = "GET /projects/:id/handoff" as const;

      if (!currentState.projects.some((project) => project.id === projectId)) {
        return fail(
          endpoint,
          options,
          "project_not_found",
          "Project target was not found for handoff package export.",
          { projectId }
        );
      }

      const before = JSON.stringify(currentState);
      const exportPackage = buildEngineeringHandoffPackageExport(currentState, projectId, {
        exportedAt: timestamp(options)
      });
      const report = exportPackage.package.readinessReport;
      const after = JSON.stringify(currentState);

      if (before !== after) {
        return fail(
          endpoint,
          options,
          "handoff_generation_mutated_state",
          "GET /projects/:id/handoff must be read-only."
        );
      }

      return ok(endpoint, options, {
        endpoint,
        projectId,
        export: exportPackage,
        readinessSummary: {
          canGenerateEngineeringDraft: report.canGenerateEngineeringDraft,
          canMarkHandoffReady: report.canMarkHandoffReady,
          blockerCount: exportPackage.package.blockers.length,
          warningCount: report.findings.filter((finding) => finding.severity !== "info").length
        },
        mutationApplied: false
      });
    }
  };
}
