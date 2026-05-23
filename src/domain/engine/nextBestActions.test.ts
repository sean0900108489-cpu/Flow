import { describe, expect, it } from "vitest";
import { buildNextBestActions } from "./nextBestActions";
import type {
  AIInsight,
  AppState,
  Project,
  Relationship,
  ThoughtItem,
  Universe
} from "../types";

const timestamp = "2026-01-01T00:00:00.000Z";

const universe = (patch: Partial<Universe> = {}): Universe => ({
  id: "u-1",
  name: "Universe One",
  description: "Primary universe",
  purpose: "Next best action tests",
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
  readiness: "ready_for_engineering",
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
  type: "belongs_to",
  description: "Thought belongs to project.",
  ...patch
});

const aiInsight = (patch: Partial<AIInsight> = {}): AIInsight => ({
  id: "ai-1",
  targetId: "p-1",
  type: "project_readiness",
  content: "Draft",
  status: "draft",
  createdAt: timestamp,
  ...patch
});

function baseState(patch: Partial<AppState> = {}): AppState {
  return {
    universes: [universe()],
    thoughts: [thought({ projectId: "p-1" })],
    projects: [project()],
    relationships: [relationship()],
    aiInsights: [],
    blockingQuestions: [],
    decisionRecords: [],
    ...patch
  };
}

describe("buildNextBestActions", () => {
  it("returns stable sorted actions for app scope", () => {
    const state = baseState({
      relationships: [
        relationship({ id: "r-orphan", sourceId: "missing-thought", sourceType: "thought" })
      ],
      aiInsights: [
        aiInsight({
          targetId: "missing-project",
          patch: {
            targetType: "project",
            targetId: "missing-project",
            operations: [
              {
                type: "updateProject",
                projectId: "missing-project",
                patch: { name: "Missing project" }
              }
            ]
          }
        })
      ]
    });

    const first = buildNextBestActions(state, { type: "app" });
    const second = buildNextBestActions(state, { type: "app" });

    expect(first.length).toBeGreaterThan(0);
    expect(first.map((action) => action.id)).toEqual(second.map((action) => action.id));
    expect(first.map((action) => action.sortKey)).toEqual([...first.map((action) => action.sortKey)].sort());
  });

  it("prioritizes project blockers and stale handoff before ordinary handoff work", () => {
    const state = baseState({
      projects: [
        project({
          lifecycleStatus: "handoff_ready",
          features: [],
          screens: [],
          dataObjects: [],
          flowSteps: [],
          nextAction: "",
          readiness: "ready_for_engineering"
        })
      ]
    });

    const actions = buildNextBestActions(state, { type: "project", id: "p-1" });

    expect(actions[0]?.reasonCodes).toEqual(expect.arrayContaining(["stale_handoff"]));
    expect(actions.find((action) => action.reasonCodes.includes("handoff_candidate"))).toBeUndefined();
  });

  it("returns invalid AI accept as disabled when ConstraintRuntime blocks it", () => {
    const state = baseState({
      aiInsights: [
        aiInsight({
          id: "ai-invalid",
          targetId: "missing-project",
          patch: {
            targetType: "project",
            targetId: "missing-project",
            operations: [
              {
                type: "updateProject",
                projectId: "missing-project",
                patch: { name: "Missing project" }
              }
            ]
          }
        })
      ]
    });

    const action = buildNextBestActions(state, { type: "app" })
      .find((item) => item.reasonCodes.includes("invalid_ai_patch_target"));

    expect(action).toBeDefined();
    expect(action?.disabledReason).toContain("AI actors cannot execute canonical mutation commands directly");
    expect(action?.suggestedCommand?.domainCommand?.type).toBe("aiInsight.review");
  });

  it("suggests a guarded handoff action for a ready-for-engineering planning project", () => {
    const actions = buildNextBestActions(baseState(), { type: "project", id: "p-1" });
    const handoffAction = actions.find((action) => action.reasonCodes.includes("handoff_candidate"));

    expect(handoffAction).toBeDefined();
    expect(handoffAction?.suggestedCommand?.domainCommand?.type).toBe("project.markHandoffReady");
    expect(handoffAction?.disabledReason).toBeUndefined();
  });

  it("does not mutate AppState or persist derived state", () => {
    const state = baseState({
      thoughts: [
        thought({
          id: "t-inbox",
          type: "note",
          status: "inbox",
          projectId: undefined
        })
      ],
      projects: []
    });
    const before = JSON.parse(JSON.stringify(state));

    buildNextBestActions(state, { type: "app" });

    expect(state).toEqual(before);
    expect(state).not.toHaveProperty("nextBestActions");
    expect(state).not.toHaveProperty("reviewItems");
  });
});
