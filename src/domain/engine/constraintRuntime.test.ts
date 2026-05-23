import { describe, expect, it } from "vitest";
import {
  checkCommandAgainstConstraints,
  getCommandDisabledReason
} from "./constraintRuntime";
import type { DomainCommand } from "../commandLayer";
import type { AIInsight, AppState, Project, Relationship, ThoughtItem, Universe } from "../types";

const timestamp = "2026-01-01T00:00:00.000Z";

const universe = (patch: Partial<Universe> = {}): Universe => ({
  id: "u-1",
  name: "Universe One",
  description: "Primary universe",
  purpose: "Constraint runtime tests",
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
    id: "cmd-1",
    type: "thought.classify",
    target: { type: "thought", id: "t-1" },
    payload: { type: "task" },
    source: "user",
    confirmedByUser: true,
    ...patch
  };
}

function issueCodes(result: ReturnType<typeof checkCommandAgainstConstraints>) {
  return result.issues.map((issue) => issue.code);
}

describe("ConstraintRuntime", () => {
  it("blocks AI actors from executing canonical mutations", () => {
    const state = baseState();
    const result = checkCommandAgainstConstraints(state, command(), { actor: "ai", actorId: "planner" });

    expect(result.allowed).toBe(false);
    expect(result.severity).toBe("error");
    expect(issueCodes(result)).toContain("ai_actor_cannot_execute_canonical_mutation");
    expect(getCommandDisabledReason(state, command(), { actor: "ai" })).toContain("AI actors");
  });

  it("blocks generic handoff_ready updates", () => {
    const result = checkCommandAgainstConstraints(baseState(), command({
      type: "project.genericUpdate",
      target: { type: "project", id: "p-1" },
      payload: { patch: { lifecycleStatus: "handoff_ready" } }
    }));

    expect(result.allowed).toBe(false);
    expect(issueCodes(result)).toContain("handoff_ready_requires_guarded_command");
  });

  it("allows project.markHandoffReady to proceed to the guarded owner", () => {
    const result = checkCommandAgainstConstraints(baseState(), command({
      type: "project.markHandoffReady",
      target: { type: "project", id: "p-1" },
      payload: {}
    }));

    expect(result.allowed).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("allows graph relationships without implying direct project membership", () => {
    const result = checkCommandAgainstConstraints(baseState(), command({
      id: "cmd-rel-create",
      type: "relationship.create",
      target: undefined,
      payload: {
        sourceType: "thought",
        sourceId: "t-1",
        targetType: "project",
        targetId: "p-1",
        type: "belongs_to"
      }
    }));

    expect(result.allowed).toBe(true);
  });

  it("allows thought.linkProject only as direct membership, not graph edge creation", () => {
    const state = baseState();
    const allowed = checkCommandAgainstConstraints(state, command({
      type: "thought.linkProject",
      payload: { projectId: "p-1" }
    }));
    const blocked = checkCommandAgainstConstraints(state, command({
      type: "thought.linkProject",
      payload: {
        projectId: "p-1",
        relationshipType: "belongs_to"
      }
    }));

    expect(allowed.allowed).toBe(true);
    expect(blocked.allowed).toBe(false);
    expect(issueCodes(blocked)).toContain("direct_membership_command_cannot_update_graph");
  });

  it("blocks attempted persistence of derived reports and planning packages", () => {
    const result = checkCommandAgainstConstraints(baseState(), command({
      type: "project.updateReadiness",
      target: { type: "project", id: "p-1" },
      payload: {
        readiness: "ready_for_engineering",
        reviewItems: [],
        engineeringHandoffPackage: {}
      }
    }));

    expect(result.allowed).toBe(false);
    expect(issueCodes(result)).toContain("derived_state_persistence_forbidden");
  });

  it("fails unsupported commands safely", () => {
    const result = checkCommandAgainstConstraints(baseState(), command({ type: "unknown.command" }));

    expect(result.allowed).toBe(false);
    expect(issueCodes(result)).toContain("unsupported_command_type");
  });
});
