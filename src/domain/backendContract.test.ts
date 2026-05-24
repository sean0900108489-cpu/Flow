import { describe, expect, it } from "vitest";
import {
  getBackendContract,
  validateBackendCommandRequest,
  validateStateImportRequest,
  type BackendEndpointId
} from "./backendContract";
import type { AppState, Project, ThoughtItem, Universe } from "./types";

const timestamp = "2026-01-01T00:00:00.000Z";

const universe = (patch: Partial<Universe> = {}): Universe => ({
  id: "u-1",
  name: "Universe One",
  description: "Primary universe",
  purpose: "Backend contract tests",
  focus: "main",
  status: "active",
  ...patch
});

const thought = (patch: Partial<ThoughtItem> = {}): ThoughtItem => ({
  id: "t-1",
  title: "Thought One",
  content: "Captured idea.",
  type: "task",
  status: "active",
  universeId: "u-1",
  why: "Why",
  outcome: "Outcome",
  nextAction: "Next",
  projectId: "p-1",
  createdAt: timestamp,
  updatedAt: timestamp,
  ...patch
});

const project = (patch: Partial<Project> = {}): Project => ({
  id: "p-1",
  sourceThoughtId: "t-1",
  linkedThoughtIds: ["t-1"],
  universeId: "u-1",
  status: "active",
  lifecycleStatus: "planning",
  name: "Project One",
  intent: "Keep backend as a future transport boundary.",
  users: ["builder"],
  features: ["backend contract"],
  screens: ["Project Detail"],
  dataObjects: ["AppState"],
  flowSteps: ["Validate", "Dry Run", "Apply"],
  unknowns: [],
  nextAction: "Review backend contract.",
  readiness: "draftable",
  createdAt: timestamp,
  updatedAt: timestamp,
  ...patch
});

function baseState(patch: Partial<AppState> = {}): AppState {
  return {
    universes: [universe()],
    thoughts: [thought()],
    projects: [project()],
    relationships: [],
    aiInsights: [],
    blockingQuestions: [],
    decisionRecords: [],
    ...patch
  };
}

const endpointIds = (): BackendEndpointId[] =>
  getBackendContract().endpoints.map((endpoint) => endpoint.id);

describe("backend command/snapshot contract", () => {
  it("contains the four future endpoints in deterministic order", () => {
    expect(endpointIds()).toEqual([
      "POST /commands",
      "GET /state",
      "PUT /state/import",
      "GET /projects/:id/handoff"
    ]);
  });

  it("keeps POST /commands as a Command Layer transport wrapper", () => {
    const endpoint = getBackendContract().endpoints[0];

    expect(endpoint.id).toBe("POST /commands");
    expect(endpoint.transportRole).toContain("executeDomainCommand");
    expect(endpoint.mutationPolicy).toContain("Must use executeDomainCommand");
    expect(endpoint.mutationPolicy).toContain("must not call mutation owners directly");
    expect(endpoint.safetyRules).toEqual(expect.arrayContaining([
      "Backend command endpoint is a transport wrapper only.",
      "Command Layer remains the mutation gate.",
      "Direct mutation owner calls are forbidden."
    ]));
  });

  it("passes a valid command request through transport validation", () => {
    const result = validateBackendCommandRequest({
      command: {
        id: "cmd-1",
        type: "thought.classify",
        target: { type: "thought", id: "t-1" },
        payload: { type: "task" },
        source: "user",
        confirmedByUser: true
      },
      ctx: { actorId: "user-1" }
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.endpoint).toBe("POST /commands");
    expect(result.ok && result.request.command.id).toBe("cmd-1");
  });

  it("deterministically rejects missing or invalid command requests", () => {
    const missing = validateBackendCommandRequest({});
    const missingAgain = validateBackendCommandRequest({});
    const invalid = validateBackendCommandRequest({ command: { id: "cmd-1" } });

    expect(missing).toEqual(missingAgain);
    expect(missing.ok).toBe(false);
    expect(missing.ok || missing.error.code).toBe("missing_command");
    expect(invalid.ok).toBe(false);
    expect(invalid.ok || invalid.error.code).toBe("invalid_command_shape");
  });

  it("marks unconfirmed AI commands as Command Layer rejects in contract notes", () => {
    const endpoint = getBackendContract().endpoints[0];
    const transportResult = validateBackendCommandRequest({
      command: {
        id: "cmd-ai",
        type: "thought.classify",
        target: { type: "thought", id: "t-1" },
        payload: { type: "task" },
        source: "ai",
        confirmedByUser: false
      }
    });

    expect(transportResult.ok).toBe(true);
    expect(endpoint.requiredConfirmationFlags).toEqual(expect.arrayContaining([
      "AI commands without human confirmation must fail in Command Layer."
    ]));
    expect(endpoint.safetyRules).toEqual(expect.arrayContaining([
      "Unconfirmed AI commands must be rejected by Command Layer."
    ]));
  });

  it("keeps PUT /state/import on the Validate -> Dry Run -> Apply path", () => {
    const contract = getBackendContract();
    const endpoint = contract.endpoints.find((item) => item.id === "PUT /state/import");
    const validation = validateStateImportRequest({
      snapshot: baseState(),
      mode: "dry_run"
    });
    const applyFalseValidation = validateStateImportRequest({
      snapshot: baseState(),
      mode: "dry_run",
      apply: false
    });

    expect(contract.importStrategy).toEqual(["Validate", "Dry Run", "Apply"]);
    expect(endpoint?.requiredFlow).toEqual(["Validate", "Dry Run", "Apply"]);
    expect(endpoint?.requestShape).toContain("apply: true");
    expect(endpoint?.mutationPolicy).toContain("validate, dry_run, and apply:false must not overwrite state");
    expect(endpoint?.mutationPolicy).toContain("only explicit apply:true may full-replace state");
    expect(endpoint?.safetyRules).toEqual(expect.arrayContaining([
      "snapshot import must still follow Validate -> Dry Run -> Apply.",
      "Import warnings must be visible before apply.",
      "Import warnings must not block explicit confirmed apply.",
      "validate, dry_run, and apply:false requests must not mutate AppState.",
      "Explicit apply:true is the only backend snapshot path that may full-replace AppState.",
      "Validation errors and rejected imports must never mutate AppState."
    ]));
    expect(endpoint?.requiredConfirmationFlags).toEqual(expect.arrayContaining([
      "apply:true is required for confirmed full-replace snapshot import."
    ]));
    expect(validation.ok).toBe(true);
    expect(validation.ok && validation.request.apply).toBe(false);
    expect(applyFalseValidation.ok).toBe(true);
    expect(applyFalseValidation.ok && applyFalseValidation.request.apply).toBe(false);
  });

  it("forbids state import validation from applying state", () => {
    const result = validateStateImportRequest({
      snapshot: baseState(),
      mode: "dry_run",
      apply: true
    });

    expect(result.ok).toBe(false);
    expect(result.ok || result.error.code).toBe("apply_not_allowed");
  });

  it("keeps GET /projects/:id/handoff read-only and away from handoff_ready mutation", () => {
    const endpoint = getBackendContract().endpoints.find((item) => item.id === "GET /projects/:id/handoff");

    expect(endpoint?.responseShape).toContain("EngineeringHandoffPackage");
    expect(endpoint?.mutationPolicy).toBe("Must not mark handoff_ready, execute commands, or mutate state.");
    expect(endpoint?.safetyRules).toEqual(expect.arrayContaining([
      "GET /projects/:id/handoff must not mark handoff_ready.",
      "GET /projects/:id/handoff must not execute commands.",
      "GET /projects/:id/handoff must not mutate AppState.",
      "Missing projects must return deterministic invalid package responses."
    ]));
  });

  it("keeps excluded backend features explicit", () => {
    expect(getBackendContract().excludedFeatures).toEqual(expect.arrayContaining([
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
    ]));
  });

  it("validation helpers do not mutate input requests or snapshots", () => {
    const snapshot = baseState();
    const importRequest = { snapshot, mode: "dry_run" };
    const commandRequest = {
      command: {
        id: "cmd-1",
        type: "thought.classify",
        target: { type: "thought", id: "t-1" },
        payload: { type: "task" },
        source: "user",
        confirmedByUser: true
      }
    };
    const beforeSnapshot = JSON.stringify(snapshot);
    const beforeImportRequest = JSON.stringify(importRequest);
    const beforeCommandRequest = JSON.stringify(commandRequest);

    validateStateImportRequest(importRequest);
    validateBackendCommandRequest(commandRequest);

    expect(JSON.stringify(snapshot)).toBe(beforeSnapshot);
    expect(JSON.stringify(importRequest)).toBe(beforeImportRequest);
    expect(JSON.stringify(commandRequest)).toBe(beforeCommandRequest);
  });
});
