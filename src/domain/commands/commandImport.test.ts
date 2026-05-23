import { describe, expect, it } from "vitest";
import { dryRunCommandImport } from "./commandDryRun";
import { applyConfirmedCommandImport } from "./confirmedCommandImport";
import { validateCommandImport } from "./commandImport";
import type { DomainCommand } from "../commandLayer";
import type { AIInsight, AppState, Project, Relationship, ThoughtItem, Universe } from "../types";

const timestamp = "2026-01-01T00:00:00.000Z";

const universe = (patch: Partial<Universe> = {}): Universe => ({
  id: "u-1",
  name: "Universe One",
  description: "Primary universe",
  purpose: "Command import tests",
  focus: "main",
  status: "active",
  ...patch
});

const thought = (patch: Partial<ThoughtItem> = {}): ThoughtItem => ({
  id: "t-1",
  title: "Thought One",
  content: "Captured idea.",
  type: "note",
  status: "inbox",
  universeId: "u-1",
  why: "Why",
  outcome: "Outcome",
  nextAction: "Next",
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
  intent: "Build the thing.",
  users: ["user"],
  features: ["feature"],
  screens: ["screen"],
  dataObjects: ["data"],
  flowSteps: ["flow"],
  unknowns: [],
  nextAction: "Ship.",
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
  type: "supports",
  description: "Thought supports project.",
  ...patch
});

const aiInsight = (patch: Partial<AIInsight> = {}): AIInsight => ({
  id: "ai-1",
  targetId: "t-1",
  type: "classification",
  content: "Classify this thought.",
  status: "draft",
  createdAt: timestamp,
  ...patch
});

function baseState(patch: Partial<AppState> = {}): AppState {
  return {
    universes: [universe()],
    thoughts: [thought()],
    projects: [project()],
    relationships: [relationship()],
    aiInsights: [aiInsight()],
    blockingQuestions: [],
    decisionRecords: [],
    ...patch
  };
}

function command(patch: Partial<DomainCommand> = {}): DomainCommand {
  return {
    id: "cmd-classify",
    type: "thought.classify",
    target: { type: "thought", id: "t-1" },
    payload: { type: "task" },
    source: "ai",
    confirmedByUser: false,
    ...patch
  };
}

describe("command import", () => {
  it("returns a validation error for invalid JSON", () => {
    const result = validateCommandImport("{bad json");

    expect(result.ok).toBe(false);
    expect(result.errors[0].code).toBe("invalid_json");
    expect(result.sourceSummary.commandCount).toBe(0);
  });

  it("parses a single command payload", () => {
    const result = validateCommandImport(JSON.stringify(command()));

    expect(result.ok).toBe(true);
    expect(result.sourceSummary.format).toBe("single_command");
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].id).toBe("cmd-classify");
  });

  it("parses a command array payload", () => {
    const result = validateCommandImport(JSON.stringify([
      command({ id: "cmd-1" }),
      command({ id: "cmd-2", payload: { type: "goal" } })
    ]));

    expect(result.ok).toBe(true);
    expect(result.sourceSummary.format).toBe("command_array");
    expect(result.commands).toHaveLength(2);
  });

  it("parses a wrapped commands payload", () => {
    const result = validateCommandImport(JSON.stringify({
      commands: [command({ id: "cmd-wrapped" })]
    }));

    expect(result.ok).toBe(true);
    expect(result.sourceSummary.format).toBe("wrapped_payload");
    expect(result.commands[0].id).toBe("cmd-wrapped");
  });

  it("reports unknown command types and missing required fields", () => {
    const result = validateCommandImport(JSON.stringify({
      id: "cmd-bad",
      type: "unknown.command",
      source: "ai",
      confirmedByUser: false
    }));

    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.code === "unknown_command_type")).toBe(true);

    const missing = validateCommandImport(JSON.stringify({
      id: "cmd-missing",
      type: "thought.classify",
      source: "ai",
      confirmedByUser: false,
      payload: {}
    }));

    expect(missing.ok).toBe(false);
    expect(missing.errors.some((error) => error.code === "missing_required_field")).toBe(true);
  });

  it("dry-runs without mutating the original AppState", () => {
    const state = baseState();
    const before = JSON.stringify(state);
    const validation = validateCommandImport(JSON.stringify(command()));
    const result = dryRunCommandImport(state, validation.commands);

    expect(validation.ok).toBe(true);
    expect(result.ok).toBe(true);
    expect(result.results[0].preview.expectedChanges).toContain("thought type note -> task");
    expect(JSON.stringify(state)).toBe(before);
    expect(state.thoughts[0].type).toBe("note");
  });

  it("reports a failed command in dry-run without applying partial state", () => {
    const state = baseState();
    const before = JSON.stringify(state);
    const commands = [
      command({ id: "cmd-ok" }),
      command({ id: "cmd-missing-target", target: { type: "thought", id: "missing" } })
    ];
    const result = dryRunCommandImport(state, commands);

    expect(result.ok).toBe(false);
    expect(result.aggregate.executableCount).toBe(1);
    expect(result.aggregate.blockedCount).toBe(1);
    expect(result.results[1].errors[0].code).toBe("invalid_target");
    expect(JSON.stringify(state)).toBe(before);
  });

  it("requires the confirmed apply path", () => {
    const state = baseState();
    const result = applyConfirmedCommandImport(state, [command()], { confirmed: false });

    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
    expect(result.errors[0].code).toBe("apply_requires_user_confirmation");
  });

  it("applies confirmed batches atomically", () => {
    const state = baseState();
    const result = applyConfirmedCommandImport(
      state,
      [
        command({ id: "cmd-ok" }),
        command({ id: "cmd-bad", target: { type: "thought", id: "missing" } })
      ],
      { confirmed: true }
    );

    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
    expect(result.appliedCount).toBe(0);
    expect(state.thoughts[0].type).toBe("note");
  });

  it("blocks generic handoff_ready updates during validation", () => {
    const result = validateCommandImport(JSON.stringify({
      id: "cmd-handoff",
      type: "project.genericUpdate",
      target: { type: "project", id: "p-1" },
      payload: { patch: { lifecycleStatus: "handoff_ready" } },
      source: "ai",
      confirmedByUser: false
    }));

    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.code === "unsafe_generic_handoff_ready")).toBe(true);
  });

  it("blocks relationship commands that attempt direct reference changes", () => {
    const result = validateCommandImport(JSON.stringify(command({
      id: "cmd-rel-direct-ref",
      type: "relationship.update",
      target: { type: "relationship", id: "r-1" },
      payload: { projectId: "p-1", type: "blocks" }
    })));

    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.code === "relationship_command_cannot_update_direct_refs")).toBe(true);
  });
});
