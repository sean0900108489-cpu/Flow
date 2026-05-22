import { describe, expect, it } from "vitest";
import type { AIInsight, AppState, Project } from "../domain/types";
import { applyAiInsightPatch, setAiInsightStatus } from "./applyAiPatch";

const baseProject = (patch: Partial<Project> = {}): Project => ({
  id: "p-1",
  universeId: "u-1",
  status: "active",
  name: "Original project",
  intent: "Test project patching",
  users: ["Tester"],
  features: ["Patch"],
  screens: ["AI"],
  dataObjects: ["AIInsight"],
  flowSteps: ["Generate", "Accept"],
  unknowns: [],
  nextAction: "",
  readiness: "draftable",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...patch
});

const baseState = (): AppState => ({
  universes: [
    {
      id: "u-1",
      name: "Test Universe",
      description: "",
      purpose: "",
      focus: "main"
    }
  ],
  thoughts: [
    {
      id: "t-1",
      title: "Original thought",
      content: "Build a project",
      type: "inspiration",
      status: "inbox",
      universeId: "u-1",
      why: "",
      outcome: "",
      nextAction: "",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    },
    {
      id: "t-2",
      title: "Source thought",
      content: "",
      type: "note",
      status: "active",
      universeId: "u-1",
      why: "",
      outcome: "",
      nextAction: "",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    }
  ],
  projects: [
    baseProject(),
    baseProject({ id: "p-archived", status: "archived", name: "Archived project" })
  ],
  relationships: [],
  aiInsights: []
});

const insight = (patch?: AIInsight["patch"]): AIInsight => ({
  id: "ai-1",
  targetId: "t-1",
  type: "classification",
  content: "Draft insight",
  status: "draft",
  createdAt: "2026-01-01T00:00:00.000Z",
  patch
});

describe("applyAiInsightPatch", () => {
  it("updates Thought nextAction and reports an applied patch", () => {
    const state = baseState();
    const result = applyAiInsightPatch(state, insight({
      targetType: "thought",
      targetId: "t-1",
      operations: [
        {
          type: "updateThought",
          thoughtId: "t-1",
          patch: { nextAction: "Define the first concrete engineering step." }
        }
      ]
    }));

    expect(result.applied).toBe(true);
    expect(result.state.thoughts[0].nextAction).toBe("Define the first concrete engineering step.");
  });

  it("ignores disallowed Thought fields while applying valid allowed fields", () => {
    const state = baseState();
    const result = applyAiInsightPatch(state, insight({
      targetType: "thought",
      targetId: "t-1",
      operations: [
        {
          type: "updateThought",
          thoughtId: "t-1",
          patch: {
            id: "hijacked",
            createdAt: "2030-01-01T00:00:00.000Z",
            status: "done",
            nextAction: "Allowed change"
          }
        }
      ]
    }));

    expect(result.applied).toBe(true);
    expect(result.warnings).toContain("disallowed_field:id");
    expect(result.warnings).toContain("disallowed_field:createdAt");
    expect(result.warnings).toContain("disallowed_field:status");
    expect(result.state.thoughts[0].id).toBe("t-1");
    expect(result.state.thoughts[0].createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(result.state.thoughts[0].status).toBe("inbox");
    expect(result.state.thoughts[0].nextAction).toBe("Allowed change");
  });

  it("does not let AI directly change Project status, readiness, or lifecycleStatus", () => {
    const state = baseState();
    const result = applyAiInsightPatch(state, {
      ...insight(),
      targetId: "p-1",
      patch: {
        targetType: "project",
        targetId: "p-1",
        operations: [
          {
            type: "updateProject",
            projectId: "p-1",
            patch: {
              status: "archived",
              readiness: "ready_for_engineering",
              lifecycleStatus: "handoff_ready",
              name: "AI suggested project name"
            }
          }
        ]
      }
    });

    expect(result.applied).toBe(true);
    expect(result.warnings).toContain("disallowed_field:status");
    expect(result.warnings).toContain("disallowed_field:readiness");
    expect(result.warnings).toContain("disallowed_field:lifecycleStatus");
    expect(result.state.projects[0].name).toBe("AI suggested project name");
    expect(result.state.projects[0].status).toBe("active");
    expect(result.state.projects[0].lifecycleStatus).toBeUndefined();
    expect(result.state.projects[0].readiness).not.toBe("ready_for_engineering");
  });

  it("rejects empty Thought titles", () => {
    const state = baseState();
    const result = applyAiInsightPatch(state, insight({
      targetType: "thought",
      targetId: "t-1",
      operations: [{ type: "updateThought", thoughtId: "t-1", patch: { title: "   " } }]
    }));

    expect(result.applied).toBe(false);
    expect(result.error).toBe("invalid_value");
    expect(result.state).toBe(state);
  });

  it("rejects invalid Thought type values", () => {
    const state = baseState();
    const result = applyAiInsightPatch(state, insight({
      targetType: "thought",
      targetId: "t-1",
      operations: [
        { type: "updateThought", thoughtId: "t-1", patch: { type: "invalid" as never } }
      ]
    }));

    expect(result.applied).toBe(false);
    expect(result.error).toBe("invalid_value");
    expect(result.state).toBe(state);
  });

  it("rejects Thought universeId values that point to a missing universe", () => {
    const state = baseState();
    const result = applyAiInsightPatch(state, insight({
      targetType: "thought",
      targetId: "t-1",
      operations: [{ type: "updateThought", thoughtId: "t-1", patch: { universeId: "missing" } }]
    }));

    expect(result.applied).toBe(false);
    expect(result.error).toBe("invalid_value");
    expect(result.state).toBe(state);
  });

  it("rejects Thought projectId values that point to archived projects", () => {
    const state = baseState();
    const result = applyAiInsightPatch(state, insight({
      targetType: "thought",
      targetId: "t-1",
      operations: [{ type: "updateThought", thoughtId: "t-1", patch: { projectId: "p-archived" } }]
    }));

    expect(result.applied).toBe(false);
    expect(result.error).toBe("invalid_value");
    expect(result.state).toBe(state);
  });

  it("rejects empty Project names", () => {
    const state = baseState();
    const result = applyAiInsightPatch(state, {
      ...insight(),
      targetId: "p-1",
      patch: {
        targetType: "project",
        targetId: "p-1",
        operations: [{ type: "updateProject", projectId: "p-1", patch: { name: "" } }]
      }
    });

    expect(result.applied).toBe(false);
    expect(result.error).toBe("invalid_value");
    expect(result.state).toBe(state);
  });

  it("rejects Project universeId values that point to a missing universe", () => {
    const state = baseState();
    const result = applyAiInsightPatch(state, {
      ...insight(),
      targetId: "p-1",
      patch: {
        targetType: "project",
        targetId: "p-1",
        operations: [{ type: "updateProject", projectId: "p-1", patch: { universeId: "missing" } }]
      }
    });

    expect(result.applied).toBe(false);
    expect(result.error).toBe("invalid_value");
    expect(result.state).toBe(state);
  });

  it("applies valid Project reference patches after validation", () => {
    const state = baseState();
    const result = applyAiInsightPatch(state, {
      ...insight(),
      targetId: "p-1",
      patch: {
        targetType: "project",
        targetId: "p-1",
        operations: [
          { type: "updateProject", projectId: "p-1", patch: { sourceThoughtId: "t-2" } }
        ]
      }
    });

    expect(result.applied).toBe(true);
    expect(result.state.projects[0].sourceThoughtId).toBe("t-2");
  });

  it("rejects missing targets", () => {
    const state = baseState();
    const result = applyAiInsightPatch(state, insight({
      targetType: "thought",
      targetId: "missing",
      operations: [
        {
          type: "updateThought",
          thoughtId: "missing",
          patch: { nextAction: "Should not apply" }
        }
      ]
    }));

    expect(result.applied).toBe(false);
    expect(result.error).toBe("target_missing");
    expect(result.state).toBe(state);
  });

  it("rejects unsupported target types", () => {
    const state = baseState();
    const result = applyAiInsightPatch(state, {
      ...insight(),
      patch: {
        targetType: "universe",
        targetId: "u-1",
        operations: []
      } as unknown as AIInsight["patch"]
    });

    expect(result.applied).toBe(false);
    expect(result.error).toBe("unsupported_target_type");
    expect(result.state).toBe(state);
  });

  it("rejects patches with no allowed changes", () => {
    const state = baseState();
    const result = applyAiInsightPatch(state, insight({
      targetType: "thought",
      targetId: "t-1",
      operations: [
        {
          type: "updateThought",
          thoughtId: "t-1",
          patch: { status: "done" }
        }
      ]
    }));

    expect(result.applied).toBe(false);
    expect(result.error).toBe("no_allowed_changes");
    expect(result.warnings).toContain("disallowed_field:status");
    expect(result.state).toBe(state);
  });

  it("rejects valid patches that do not change target values", () => {
    const state = baseState();
    const result = applyAiInsightPatch(state, insight({
      targetType: "thought",
      targetId: "t-1",
      operations: [{ type: "updateThought", thoughtId: "t-1", patch: { title: "Original thought" } }]
    }));

    expect(result.applied).toBe(false);
    expect(result.error).toBe("no_allowed_changes");
    expect(result.state).toBe(state);
  });

  it("does not modify state when insight has no patch", () => {
    const state = baseState();
    const result = applyAiInsightPatch(state, insight());

    expect(result.applied).toBe(false);
    expect(result.error).toBe("invalid_patch");
    expect(result.state).toBe(state);
  });
});

describe("setAiInsightStatus", () => {
  it("accepts valid AI patches and then marks the insight accepted", () => {
    const state = baseState();
    const draft = insight({
      targetType: "thought",
      targetId: "t-1",
      operations: [{ type: "updateThought", thoughtId: "t-1", patch: { nextAction: "Ship it." } }]
    });

    const result = setAiInsightStatus({ ...state, aiInsights: [draft] }, "ai-1", "accepted");

    expect(result.applied).toBe(true);
    expect(result.statusChanged).toBe(true);
    expect(result.state.thoughts[0].nextAction).toBe("Ship it.");
    expect(result.state.aiInsights[0].status).toBe("accepted");
  });

  it("does not mark invalid AI patches as accepted", () => {
    const state = baseState();
    const draft = insight({
      targetType: "thought",
      targetId: "t-1",
      operations: [{ type: "updateThought", thoughtId: "t-1", patch: { title: "" } }]
    });

    const result = setAiInsightStatus({ ...state, aiInsights: [draft] }, "ai-1", "accepted");

    expect(result.applied).toBe(false);
    expect(result.statusChanged).toBe(false);
    expect(result.error).toBe("invalid_value");
    expect(result.state.aiInsights[0].status).toBe("draft");
  });

  it("can still accept non-patch AI insights as review decisions", () => {
    const state = baseState();
    const result = setAiInsightStatus({ ...state, aiInsights: [insight()] }, "ai-1", "accepted");

    expect(result.applied).toBe(false);
    expect(result.statusChanged).toBe(true);
    expect(result.state.aiInsights[0].status).toBe("accepted");
  });
});
