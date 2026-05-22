import { describe, expect, it } from "vitest";
import { parseAppStateJson } from "../../services/appStateTransfer";
import type { AIInsight, AppState, Project, Relationship, ThoughtItem, Universe } from "../types";
import { validateAppStateInvariants } from "./appStateInvariants";

const timestamp = "2026-01-01T00:00:00.000Z";

function universe(patch: Partial<Universe> = {}): Universe {
  return {
    id: "u-1",
    name: "Main universe",
    description: "A universe.",
    purpose: "Hold the work.",
    focus: "main",
    ...patch
  };
}

function thought(patch: Partial<ThoughtItem> = {}): ThoughtItem {
  return {
    id: "t-1",
    title: "Main thought",
    content: "Thought content.",
    type: "project",
    status: "active",
    universeId: "u-1",
    projectId: "p-1",
    why: "Important.",
    outcome: "Useful output.",
    nextAction: "Build it.",
    createdAt: timestamp,
    updatedAt: timestamp,
    ...patch
  };
}

function project(patch: Partial<Project> = {}): Project {
  return {
    id: "p-1",
    sourceThoughtId: "t-1",
    linkedThoughtIds: ["t-1"],
    universeId: "u-1",
    status: "active",
    name: "Main project",
    intent: "Build the project.",
    users: ["User"],
    features: ["Feature"],
    screens: ["Screen"],
    dataObjects: ["Object"],
    flowSteps: ["Step"],
    unknowns: [],
    nextAction: "Ship the first step.",
    readiness: "ready_for_engineering",
    createdAt: timestamp,
    updatedAt: timestamp,
    ...patch
  };
}

function relationship(patch: Partial<Relationship> = {}): Relationship {
  return {
    id: "r-1",
    sourceId: "t-1",
    sourceType: "thought",
    targetId: "p-1",
    targetType: "project",
    type: "supports",
    description: "Thought supports project.",
    ...patch
  };
}

function baseState(patch: Partial<AppState> = {}): AppState {
  return {
    universes: [universe()],
    thoughts: [thought()],
    projects: [project()],
    relationships: [relationship()],
    aiInsights: [],
    blockingQuestions: [],
    decisionRecords: [],
    ...patch
  };
}

function codes(state: AppState) {
  return validateAppStateInvariants(state).map((item) => item.code);
}

describe("app state invariants", () => {
  it("reports duplicate ids inside a collection", () => {
    const warnings = validateAppStateInvariants(baseState({
      universes: [universe(), universe({ name: "Duplicate universe" })]
    }));

    expect(warnings).toContainEqual(expect.objectContaining({
      code: "duplicate_id",
      entityType: "universes",
      entityId: "u-1"
    }));
  });

  it("reports invalid enum values", () => {
    const warnings = validateAppStateInvariants(baseState({
      thoughts: [thought({ status: "lost" as ThoughtItem["status"] })]
    }));

    expect(warnings).toContainEqual(expect.objectContaining({
      code: "invalid_enum",
      entityType: "thought",
      entityId: "t-1",
      field: "status"
    }));
  });

  it("reports missing relationship endpoints", () => {
    expect(codes(baseState({
      relationships: [relationship({ sourceId: "missing-thought", sourceType: "thought" })]
    }))).toContain("missing_relationship_endpoint");
  });

  it("reports direct missing references", () => {
    const warnings = validateAppStateInvariants(baseState({
      thoughts: [thought({ projectId: "missing-project" })],
      projects: [project({ sourceThoughtId: "missing-source-thought", linkedThoughtIds: ["missing-linked-thought"] })]
    }));

    expect(warnings).toContainEqual(expect.objectContaining({
      code: "missing_reference",
      entityType: "thought",
      entityId: "t-1",
      field: "projectId"
    }));
    expect(warnings).toContainEqual(expect.objectContaining({
      code: "missing_reference",
      entityType: "project",
      entityId: "p-1",
      field: "linkedThoughtIds"
    }));
    expect(warnings).toContainEqual(expect.objectContaining({
      code: "missing_reference",
      entityType: "project",
      entityId: "p-1",
      field: "sourceThoughtId"
    }));
  });

  it("reports Thought projectId drift when the project does not link back", () => {
    const warnings = validateAppStateInvariants(baseState({
      projects: [project({ linkedThoughtIds: [] })]
    }));

    expect(warnings).toContainEqual(expect.objectContaining({
      code: "thought_project_reference_drift",
      entityType: "thought",
      entityId: "t-1",
      field: "projectId"
    }));
  });

  it("reports Project linkedThoughtIds drift when the thought points elsewhere", () => {
    const warnings = validateAppStateInvariants(baseState({
      thoughts: [thought({ projectId: "p-2" })],
      projects: [
        project(),
        project({ id: "p-2", name: "Second project", linkedThoughtIds: [] })
      ]
    }));

    expect(warnings).toContainEqual(expect.objectContaining({
      code: "thought_project_reference_drift",
      entityType: "project",
      entityId: "p-1",
      field: "linkedThoughtIds"
    }));
  });

  it("does not require Project sourceThoughtId to be an active membership link", () => {
    const warnings = validateAppStateInvariants(baseState({
      thoughts: [thought({ projectId: undefined })],
      projects: [project({ linkedThoughtIds: [] })]
    }));

    expect(warnings).not.toContainEqual(expect.objectContaining({
      code: "thought_project_reference_drift",
      entityType: "project",
      entityId: "p-1",
      field: "sourceThoughtId"
    }));
  });

  it("reports handoff_ready projects that fail handoff semantics", () => {
    expect(codes(baseState({
      projects: [
        project({
          lifecycleStatus: "handoff_ready",
          features: [],
          screens: [],
          dataObjects: [],
          flowSteps: [],
          nextAction: "",
          readiness: "not_ready"
        })
      ]
    }))).toContain("invalid_handoff_ready");
  });

  it("reports stored readiness drift from computed readiness", () => {
    expect(codes(baseState({
      projects: [project({ readiness: "not_ready" })]
    }))).toContain("readiness_drift");
  });

  it("reports AI insight and next action missing references", () => {
    const warnings = validateAppStateInvariants(baseState({
      aiInsights: [
        {
          id: "ai-1",
          targetId: "missing-thought",
          type: "classification",
          content: "Draft",
          status: "draft",
          createdAt: timestamp
        }
      ],
      nextActionState: {
        savedActionIds: ["project:missing-project"],
        selectedFocusActionId: "thought:t-1",
        dismissedActionIds: [],
        manualNote: "",
        manualConfidence: "medium",
        focusMode: "decide",
        updatedAt: timestamp
      }
    }));

    expect(warnings).toContainEqual(expect.objectContaining({ code: "ai_insight_target_missing" }));
    expect(warnings).toContainEqual(expect.objectContaining({ code: "next_action_reference_missing" }));
  });

  it("does not mutate the input state or remove orphan relationships", () => {
    const state = baseState({
      relationships: [relationship({ sourceId: "missing-thought", sourceType: "thought" })]
    });
    const before = JSON.parse(JSON.stringify(state));

    validateAppStateInvariants(state);

    expect(state).toEqual(before);
    expect(state.relationships).toHaveLength(1);
    expect(state.relationships[0].sourceId).toBe("missing-thought");
  });

  it("attaches invariant warnings to imported normalized state without deleting orphan relationships", () => {
    const result = parseAppStateJson(JSON.stringify(baseState({
      relationships: [relationship({ sourceId: "missing-thought", sourceType: "thought" })]
    })));

    expect(result.ok).toBe(true);
    expect(result.state?.relationships).toHaveLength(1);
    expect(result.state?.relationships[0].sourceId).toBe("missing-thought");
    expect(result.warnings).toContainEqual(expect.objectContaining({
      code: "missing_relationship_endpoint"
    }));
  });

  it("attaches Thought-Project drift warnings during import without rewriting direct refs", () => {
    const imported = baseState({
      thoughts: [thought({ projectId: "p-1" })],
      projects: [project({ linkedThoughtIds: [] })]
    });
    const result = parseAppStateJson(JSON.stringify(imported));

    expect(result.ok).toBe(true);
    expect(result.state?.thoughts[0].projectId).toBe("p-1");
    expect(result.state?.projects[0].linkedThoughtIds).toEqual([]);
    expect(result.warnings).toContainEqual(expect.objectContaining({
      code: "thought_project_reference_drift",
      severity: "warning",
      entityType: "thought",
      entityId: "t-1",
      field: "projectId"
    }));
  });

  it("reports invalid imported AI patch targetType as a warning without failing import", () => {
    const imported = baseState({
      aiInsights: [
        {
          id: "ai-invalid-patch-target",
          targetId: "t-1",
          type: "classification",
          content: "Invalid imported patch target.",
          status: "draft",
          createdAt: timestamp,
          patch: {
            targetType: "universe",
            targetId: "u-1",
            operations: []
          } as unknown as AIInsight["patch"]
        }
      ]
    });

    expect(() => validateAppStateInvariants(imported)).not.toThrow();

    const result = parseAppStateJson(JSON.stringify(imported));

    expect(result.ok).toBe(true);
    expect(result.warnings).toContainEqual(expect.objectContaining({
      code: "invalid_patch_target_type",
      entityType: "ai_insight",
      entityId: "ai-invalid-patch-target",
      field: "patch.targetType"
    }));
  });
});
