import { describe, expect, it } from "vitest";
import {
  executeDomainCommand,
  type DomainCommand
} from "./commandLayer";
import type { AIInsight, AppState, Project, Relationship, ThoughtItem, Universe } from "./types";

const timestamp = "2026-01-01T00:00:00.000Z";

const universe = (patch: Partial<Universe> = {}): Universe => ({
  id: "u-1",
  name: "Universe One",
  description: "Primary universe",
  purpose: "Command layer tests",
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

describe("command layer", () => {
  it("rejects unconfirmed AI commands without changing state", () => {
    const state = baseState();
    const result = executeDomainCommand(state, command({
      source: "ai",
      confirmedByUser: false
    }));

    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
    expect(result.ok || result.error.code).toBe("ai_command_requires_user_confirmation");
  });

  it("lets confirmed AI commands reach validation but still rejects invalid targets", () => {
    const state = baseState();
    const result = executeDomainCommand(state, command({
      source: "ai",
      confirmedByUser: true,
      target: { type: "thought", id: "missing-thought" }
    }));

    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
    expect(result.ok || result.error.code).toBe("invalid_target");
  });

  it("blocks AI actors through ConstraintRuntime without changing state", () => {
    const state = baseState();
    const before = JSON.stringify(state);
    const result = executeDomainCommand(state, command(), { actor: "ai", actorId: "planner" });

    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
    expect(JSON.stringify(state)).toBe(before);
    expect(result.ok || result.error.code).toBe("constraint_preflight_failed");
  });

  it("rejects invalid command types atomically", () => {
    const state = baseState();
    const result = executeDomainCommand(state, command({ type: "unknown.command" }));

    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
    expect(result.ok || result.error.code).toBe("invalid_command_type");
  });

  it("rejects invalid targets atomically", () => {
    const state = baseState();
    const result = executeDomainCommand(state, command({
      target: { type: "project", id: "p-1" }
    }));

    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
    expect(result.ok || result.error.code).toBe("invalid_target");
  });

  it("rejects invalid payloads atomically", () => {
    const state = baseState();
    const before = JSON.stringify(state);
    const result = executeDomainCommand(state, command({ payload: { type: "unknown" } }));

    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
    expect(JSON.stringify(state)).toBe(before);
    expect(result.ok || result.error.code).toBe("invalid_payload");
  });

  it("forbids generic handoff_ready updates", () => {
    const state = baseState();
    const result = executeDomainCommand(state, command({
      type: "project.genericUpdate",
      target: { type: "project", id: "p-1" },
      payload: { patch: { lifecycleStatus: "handoff_ready" } }
    }));

    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
    expect(result.ok || result.error.code).toBe("forbidden_generic_handoff_ready");
  });

  it("routes project.markHandoffReady through guarded preflight", () => {
    const state = baseState({
      projects: [project({ readiness: "not_ready", nextAction: "" })]
    });
    const result = executeDomainCommand(state, command({
      type: "project.markHandoffReady",
      target: { type: "project", id: "p-1" },
      payload: {}
    }));

    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
    expect(result.ok || result.error.code).toBe("handoff_preflight_failed");
    expect(state.projects[0].lifecycleStatus).toBe("planning");
  });

  it("creates graph relationships without changing direct refs", () => {
    const state = baseState({
      thoughts: [thought({ projectId: undefined })],
      projects: [project({ linkedThoughtIds: [] })],
      relationships: []
    });
    const result = executeDomainCommand(state, command({
      id: "cmd-rel-create",
      type: "relationship.create",
      target: undefined,
      payload: {
        sourceType: "thought",
        sourceId: "t-1",
        targetType: "project",
        targetId: "p-1",
        type: "belongs_to",
        description: "Graph only"
      }
    }));

    expect(result.ok).toBe(true);
    expect(result.state.relationships).toHaveLength(1);
    expect(result.state.thoughts[0].projectId).toBeUndefined();
    expect(result.state.projects[0].linkedThoughtIds).toEqual([]);
  });

  it("rejects relationship commands that attempt direct ref changes", () => {
    const state = baseState();
    const result = executeDomainCommand(state, command({
      id: "cmd-rel-bad",
      type: "relationship.update",
      target: { type: "relationship", id: "r-1" },
      payload: { projectId: "p-1", type: "blocks" }
    }));

    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
    expect(result.ok || result.error.code).toBe("relationship_command_cannot_update_direct_refs");
  });

  it("rejects direct membership commands that attempt graph changes", () => {
    const state = baseState();
    const result = executeDomainCommand(state, command({
      id: "cmd-direct-bad",
      type: "thought.linkProject",
      target: { type: "thought", id: "t-1" },
      payload: {
        projectId: "p-1",
        relationshipType: "belongs_to"
      }
    }));

    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
    expect(result.ok || result.error.code).toBe("direct_membership_command_cannot_update_graph");
  });

  it("respects ConstraintRuntime failures atomically", () => {
    const state = baseState();
    const before = JSON.stringify(state);
    const result = executeDomainCommand(state, command({
      id: "cmd-derived-state-bad",
      type: "project.updateReadiness",
      target: { type: "project", id: "p-1" },
      payload: {
        readiness: "ready_for_engineering",
        reviewItems: []
      }
    }));

    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
    expect(JSON.stringify(state)).toBe(before);
    expect(result.ok || result.error.code).toBe("constraint_preflight_failed");
  });

  it("returns ok true and a new state for valid commands", () => {
    const state = baseState();
    const result = executeDomainCommand(state, command());

    expect(result.ok).toBe(true);
    expect(result.state).not.toBe(state);
    expect(result.state.thoughts[0].type).toBe("task");
    expect(result.commandId).toBe("cmd-1");
  });

  it("does not execute suggested command metadata directly", () => {
    const state = baseState();
    const result = executeDomainCommand(
      state,
      {
        id: "derived-review:t-1:classify",
        type: "classify_thought",
        target: { type: "thought", id: "t-1" },
        requiresHumanConfirmation: true,
        payloadPreview: { type: "task" }
      } as unknown as DomainCommand
    );

    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
    expect(result.ok || result.error.code).toBe("invalid_payload");
  });

  it("rejects invalid AI patch targets before status changes", () => {
    const state = baseState({
      aiInsights: [
        aiInsight({
          id: "ai-invalid",
          targetId: "missing-thought",
          patch: {
            targetType: "thought",
            targetId: "missing-thought",
            operations: [
              {
                type: "updateThought",
                thoughtId: "missing-thought",
                patch: { title: "Missing thought" }
              }
            ]
          }
        })
      ]
    });
    const result = executeDomainCommand(state, command({
      id: "cmd-ai-review",
      type: "aiInsight.review",
      target: { type: "aiInsight", id: "ai-invalid" },
      payload: { status: "accepted" }
    }));

    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
    expect(result.ok || result.error.code).toBe("invalid_target");
    expect(state.aiInsights[0].status).toBe("draft");
  });

  it("has deterministic success and failure result shapes", () => {
    const state = baseState();
    const failed = executeDomainCommand(state, command({ type: "unknown.command" }));
    const deleted = executeDomainCommand(state, command({
      id: "cmd-delete-rel",
      type: "relationship.delete",
      target: { type: "relationship", id: "r-1" },
      payload: {}
    }));

    expect(Object.keys(failed).sort()).toEqual(["commandId", "error", "ok", "state"]);
    expect(Object.keys(deleted).sort()).toEqual(["commandId", "events", "ok", "state", "warnings"]);
    expect(deleted.ok).toBe(true);
    expect(deleted.state.relationships).toEqual([]);
    expect(deleted.state.thoughts[0].projectId).toBeUndefined();
  });
});
