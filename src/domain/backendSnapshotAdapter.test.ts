import { describe, expect, it } from "vitest";
import {
  createBackendSnapshotAdapter,
  type BackendSnapshotAdapter
} from "./backendSnapshotAdapter";
import type { DomainCommand } from "./commandLayer";
import type { AppState, Project, Relationship, ThoughtItem, Universe } from "./types";

const timestamp = "2026-01-01T00:00:00.000Z";
const now = () => timestamp;

const universe = (patch: Partial<Universe> = {}): Universe => ({
  id: "u-1",
  name: "Universe One",
  description: "Primary universe",
  purpose: "Backend adapter tests",
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
  intent: "Keep backend as a local contract harness.",
  users: ["builder"],
  features: ["backend adapter"],
  screens: ["Project Detail"],
  dataObjects: ["AppState"],
  flowSteps: ["Validate", "Dry Run", "Apply"],
  unknowns: [],
  nextAction: "Review backend adapter.",
  readiness: "draftable",
  createdAt: timestamp,
  updatedAt: timestamp,
  ...patch
});

const relationship = (patch: Partial<Relationship> = {}): Relationship => ({
  id: "r-1",
  sourceId: "t-1",
  sourceType: "thought",
  targetId: "p-1",
  targetType: "project",
  type: "related_to",
  description: "A relationship for backend adapter tests.",
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

function replacementState(): AppState {
  return baseState({
    universes: [universe({ id: "u-2", name: "Universe Two" })],
    thoughts: [],
    projects: [
      project({
        id: "p-2",
        sourceThoughtId: undefined,
        linkedThoughtIds: [],
        universeId: "u-2",
        name: "Replacement Project",
        readiness: "not_ready"
      })
    ]
  });
}

function warningReplacementState(): AppState {
  return baseState({
    universes: [universe({ id: "u-warning", name: "Warning Universe" })],
    thoughts: [
      thought({
        id: "t-warning",
        title: "Warning Thought",
        universeId: "u-warning",
        projectId: "p-warning"
      })
    ],
    projects: [
      project({
        id: "p-warning",
        sourceThoughtId: "t-warning",
        linkedThoughtIds: [],
        universeId: "u-warning",
        name: "Warning Project"
      })
    ],
    relationships: [
      relationship({
        id: "r-orphan",
        sourceId: "missing-thought",
        sourceType: "thought",
        targetId: "p-warning",
        targetType: "project",
        type: "blocks",
        description: "An orphan relationship that should be reported, not repaired."
      })
    ]
  });
}

function getState(adapter: BackendSnapshotAdapter) {
  const result = adapter.getState();
  if (!result.ok || !result.data) throw new Error("Expected adapter state.");
  return result.data.state;
}

const readinessCommand = (patch: Partial<DomainCommand> = {}): DomainCommand => ({
  id: "cmd-readiness",
  type: "project.updateReadiness",
  target: { type: "project", id: "p-1" },
  payload: { readiness: "ready_for_engineering" },
  source: "user",
  confirmedByUser: false,
  ...patch
});

describe("backend snapshot adapter", () => {
  it("getState returns a clone so caller mutation cannot change internal state", () => {
    const adapter = createBackendSnapshotAdapter(baseState(), { now });
    const first = adapter.getState();

    expect(first.ok).toBe(true);
    first.data!.state.projects[0].name = "Mutated outside adapter";

    expect(getState(adapter).projects[0].name).toBe("Project One");
    expect(first.data!.localFirstSourceOfTruth).toBe(true);
    expect(first.data!.mutationApplied).toBe(false);
  });

  it("importState dry_run validates without changing internal state", () => {
    const adapter = createBackendSnapshotAdapter(baseState(), { now });
    const before = JSON.stringify(getState(adapter));
    const result = adapter.importState({ snapshot: replacementState(), mode: "dry_run" });

    expect(result.ok).toBe(true);
    expect(result.mutationApplied).toBe(false);
    expect(result.data?.mutationApplied).toBe(false);
    expect(result.data?.importMode).toBe("dry_run");
    expect(result.data?.state.projects.map((item) => item.id)).toEqual(["p-2"]);
    expect(JSON.stringify(getState(adapter))).toBe(before);
  });

  it("importState apply:false validates without changing internal state", () => {
    const adapter = createBackendSnapshotAdapter(baseState(), { now });
    const before = JSON.stringify(getState(adapter));
    const result = adapter.importState({ snapshot: replacementState(), apply: false });

    expect(result.ok).toBe(true);
    expect(result.mutationApplied).toBe(false);
    expect(result.data?.mutationApplied).toBe(false);
    expect(result.data?.importMode).toBe("dry_run");
    expect(JSON.stringify(getState(adapter))).toBe(before);
  });

  it("importState validate-only returns mutationApplied:false", () => {
    const adapter = createBackendSnapshotAdapter(baseState(), { now });
    const before = JSON.stringify(getState(adapter));
    const result = adapter.importState({ snapshot: replacementState(), mode: "validate" });

    expect(result.ok).toBe(true);
    expect(result.mutationApplied).toBe(false);
    expect(result.data?.mutationApplied).toBe(false);
    expect(result.data?.importMode).toBe("validate");
    expect(JSON.stringify(getState(adapter))).toBe(before);
  });

  it("importState rejects invalid snapshots without changing internal state", () => {
    const adapter = createBackendSnapshotAdapter(baseState(), { now });
    const before = JSON.stringify(getState(adapter));
    const result = adapter.importState({ snapshot: { projects: [] } as unknown as AppState });

    expect(result.ok).toBe(false);
    expect(result.mutationApplied).toBe(false);
    expect(result.errors[0].code).toBe("invalid_snapshot_shape");
    expect(JSON.stringify(getState(adapter))).toBe(before);
  });

  it("importState confirmed apply rejects invalid snapshots before changing internal state", () => {
    const adapter = createBackendSnapshotAdapter(baseState(), { now });
    const before = JSON.stringify(getState(adapter));
    const result = adapter.importState({
      snapshot: { projects: [] } as unknown as AppState,
      apply: true
    });

    expect(result.ok).toBe(false);
    expect(result.mutationApplied).toBe(false);
    expect(result.errors[0].code).toBe("invalid_snapshot_shape");
    expect(JSON.stringify(getState(adapter))).toBe(before);
  });

  it("importState confirmed apply full replaces internal state for valid snapshots", () => {
    const adapter = createBackendSnapshotAdapter(baseState(), { now });
    const result = adapter.importState({ snapshot: replacementState(), apply: true });

    expect(result.ok).toBe(true);
    expect(result.mutationApplied).toBe(true);
    expect(result.data?.importMode).toBe("full_replace");
    expect(result.data?.mutationApplied).toBe(true);
    expect(getState(adapter).projects.map((item) => item.id)).toEqual(["p-2"]);
    expect(getState(adapter).thoughts).toEqual([]);
  });

  it("importState confirmed apply does not merge old state into the replacement snapshot", () => {
    const adapter = createBackendSnapshotAdapter(baseState(), { now });

    adapter.importState({ snapshot: replacementState(), apply: true });

    expect(getState(adapter).projects.some((item) => item.id === "p-1")).toBe(false);
    expect(getState(adapter).universes.map((item) => item.id)).toEqual(["u-2"]);
  });

  it("importState confirmed apply keeps warnings non-blocking without repairing imported data", () => {
    const adapter = createBackendSnapshotAdapter(baseState(), { now });
    const snapshot = warningReplacementState();
    const beforeSnapshot = JSON.stringify(snapshot);
    const result = adapter.importState({ snapshot, apply: true });

    expect(result.ok).toBe(true);
    expect(result.mutationApplied).toBe(true);
    expect(result.data?.mutationApplied).toBe(true);
    expect(result.warnings.map((warning) => warning.code)).toEqual(expect.arrayContaining([
      "direct_ref_drift",
      "orphan_relationship"
    ]));
    expect(JSON.stringify(snapshot)).toBe(beforeSnapshot);
    expect(getState(adapter).projects.map((item) => item.id)).toEqual(["p-warning"]);
    expect(getState(adapter).projects[0].linkedThoughtIds).toEqual([]);
    expect(getState(adapter).relationships.map((item) => item.id)).toEqual(["r-orphan"]);
    expect(getState(adapter).relationships[0]).toMatchObject({
      sourceId: "missing-thought",
      sourceType: "thought",
      targetId: "p-warning",
      targetType: "project"
    });
  });

  it("postCommands rejects command requests without explicit adapter confirmation", () => {
    const adapter = createBackendSnapshotAdapter(baseState(), { now });
    const before = JSON.stringify(getState(adapter));
    const result = adapter.postCommands({ command: readinessCommand() });

    expect(result.ok).toBe(false);
    expect(result.errors[0].code).toBe("command_confirmation_required");
    expect(JSON.stringify(getState(adapter))).toBe(before);
  });

  it("postCommands applies confirmed commands through the command layer", () => {
    const adapter = createBackendSnapshotAdapter(baseState(), { now });
    const result = adapter.postCommands({
      command: readinessCommand(),
      confirmed: true,
      ctx: { actorId: "adapter-test" }
    });

    expect(result.ok).toBe(true);
    expect(result.data?.appliedCount).toBe(1);
    expect(getState(adapter).projects[0].readiness).toBe("ready_for_engineering");
  });

  it("postCommands keeps original state when a command fails", () => {
    const adapter = createBackendSnapshotAdapter(baseState(), { now });
    const before = JSON.stringify(getState(adapter));
    const result = adapter.postCommands({
      command: readinessCommand({ target: { type: "project", id: "missing-project" } }),
      confirmed: true
    });

    expect(result.ok).toBe(false);
    expect(result.errors[0].code).toBe("command_apply_failed");
    expect(JSON.stringify(getState(adapter))).toBe(before);
  });

  it("postCommands keeps batch apply atomic when a later command fails", () => {
    const adapter = createBackendSnapshotAdapter(baseState(), { now });
    const result = adapter.postCommands({
      commands: [
        readinessCommand({ id: "cmd-ready" }),
        readinessCommand({ id: "cmd-fail", target: { type: "project", id: "missing-project" } })
      ],
      confirmed: true
    });

    expect(result.ok).toBe(false);
    expect(getState(adapter).projects[0].readiness).toBe("draftable");
  });

  it("postCommands rejects unsafe generic handoff_ready updates", () => {
    const adapter = createBackendSnapshotAdapter(baseState(), { now });
    const before = JSON.stringify(getState(adapter));
    const result = adapter.postCommands({
      command: {
        id: "cmd-unsafe",
        type: "project.update",
        target: { type: "project", id: "p-1" },
        payload: { patch: { lifecycleStatus: "handoff_ready" } },
        source: "user",
        confirmedByUser: true
      },
      confirmed: true
    });

    expect(result.ok).toBe(false);
    expect(JSON.stringify(result.errors)).toContain("unsafe_generic_handoff_ready");
    expect(JSON.stringify(getState(adapter))).toBe(before);
  });

  it("getProjectHandoff returns read-only handoff export for existing project", () => {
    const adapter = createBackendSnapshotAdapter(baseState(), { now });
    const before = JSON.stringify(getState(adapter));
    const result = adapter.getProjectHandoff("p-1");

    expect(result.ok).toBe(true);
    expect(result.data?.endpoint).toBe("GET /projects/:id/handoff");
    expect(result.data?.export.schema).toBe("engineering-handoff-package-export/v0");
    expect(result.data?.projectId).toBe("p-1");
    expect(result.data?.readinessSummary.canGenerateEngineeringDraft).toBe(true);
    expect(JSON.stringify(getState(adapter))).toBe(before);
  });

  it("getProjectHandoff returns ok:false for missing project", () => {
    const adapter = createBackendSnapshotAdapter(baseState(), { now });
    const result = adapter.getProjectHandoff("missing-project");

    expect(result.ok).toBe(false);
    expect(result.errors[0].code).toBe("project_not_found");
  });

  it("adapter methods do not rely on real network or server APIs", () => {
    const adapter = createBackendSnapshotAdapter(baseState(), { now });
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;

    globalThis.fetch = (() => {
      fetchCalled = true;
      throw new Error("Network should not be used by backend snapshot adapter.");
    }) as typeof fetch;

    try {
      expect(adapter.getState().ok).toBe(true);
      expect(adapter.getProjectHandoff("p-1").ok).toBe(true);
      expect(adapter.importState({ snapshot: replacementState(), apply: true }).ok).toBe(true);
      expect(adapter.postCommands({
        command: readinessCommand({ target: { type: "project", id: "p-2" } }),
        confirmed: true
      }).ok).toBe(true);
      expect(fetchCalled).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
