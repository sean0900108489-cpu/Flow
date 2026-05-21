import { describe, expect, it } from "vitest";
import type { AppState } from "../types";
import {
  archiveProject,
  deleteProject,
  deleteThought,
  restoreProject,
  updateThought
} from "./appMutations";

const timestamp = "2026-01-01T00:00:00.000Z";

function state(): AppState {
  return {
    universes: [
      {
        id: "u-1",
        name: "Universe",
        description: "",
        purpose: "",
        focus: "main",
        status: "active"
      }
    ],
    thoughts: [
      {
        id: "t-1",
        title: "Thought",
        content: "Content",
        type: "project",
        status: "active",
        universeId: "u-1",
        why: "",
        outcome: "",
        nextAction: "Do thought work",
        projectId: "p-1",
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    projects: [
      {
        id: "p-1",
        sourceThoughtId: "t-1",
        linkedThoughtIds: ["t-1"],
        universeId: "u-1",
        status: "active",
        lifecycleStatus: "planning",
        name: "Project",
        intent: "Intent",
        users: [],
        features: [],
        screens: [],
        dataObjects: [],
        flowSteps: [],
        unknowns: [],
        nextAction: "Do project work",
        readiness: "draftable",
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    relationships: [
      {
        id: "rel-1",
        sourceId: "t-1",
        sourceType: "thought",
        targetId: "p-1",
        targetType: "project",
        type: "evolves_into",
        description: "Promotion"
      }
    ],
    aiInsights: [
      {
        id: "ai-1",
        targetId: "t-1",
        type: "classification",
        content: "Draft",
        status: "draft",
        createdAt: timestamp
      },
      {
        id: "ai-2",
        targetId: "p-1",
        type: "project_readiness",
        content: "Draft",
        status: "draft",
        createdAt: timestamp
      }
    ],
    blockingQuestions: [
      {
        id: "bq-1",
        question: "Question",
        status: "open",
        linkedThoughtIds: ["t-1"],
        linkedProjectIds: ["p-1"],
        linkedUniverseIds: ["u-1"],
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    decisionRecords: [
      {
        id: "decision-1",
        title: "Decision",
        decision: "Decision body",
        status: "proposed",
        linkedThoughtIds: ["t-1"],
        linkedProjectIds: ["p-1"],
        linkedUniverseIds: ["u-1"],
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    nextActionState: {
      savedActionIds: ["thought:t-1", "project:p-1"],
      selectedFocusActionId: "thought:t-1",
      dismissedActionIds: ["thought:t-1"],
      manualNote: "",
      manualConfidence: "medium",
      focusMode: "decide",
      updatedAt: timestamp
    }
  };
}

describe("safe app mutations", () => {
  it("deleteThought clears relationships and stale references", () => {
    const result = deleteThought(state(), "t-1");

    expect(result.ok).toBe(true);
    expect(result.state.thoughts).toHaveLength(0);
    expect(result.state.relationships).toHaveLength(0);
    expect(result.state.projects[0].sourceThoughtId).toBeUndefined();
    expect(result.state.projects[0].linkedThoughtIds).toEqual([]);
    expect(result.state.blockingQuestions?.[0].linkedThoughtIds).toEqual([]);
    expect(result.state.decisionRecords?.[0].linkedThoughtIds).toEqual([]);
    expect(result.state.aiInsights.map((insight) => insight.id)).toEqual(["ai-2"]);
    expect(result.state.nextActionState?.selectedFocusActionId).toBeUndefined();
    expect(result.state.nextActionState?.savedActionIds).toEqual(["project:p-1"]);
    expect(result.state.nextActionState?.dismissedActionIds).toEqual([]);
  });

  it("deleteProject clears relationships and project references", () => {
    const result = deleteProject(state(), "p-1");

    expect(result.ok).toBe(true);
    expect(result.state.projects).toHaveLength(0);
    expect(result.state.relationships).toHaveLength(0);
    expect(result.state.thoughts[0].projectId).toBeUndefined();
    expect(result.state.blockingQuestions?.[0].linkedProjectIds).toEqual([]);
    expect(result.state.decisionRecords?.[0].linkedProjectIds).toEqual([]);
    expect(result.state.aiInsights.map((insight) => insight.id)).toEqual(["ai-1"]);
    expect(result.state.nextActionState?.savedActionIds).toEqual(["thought:t-1"]);
  });

  it("archive and restore project preserve relationships", () => {
    const archived = archiveProject(state(), "p-1");
    const restored = restoreProject(archived.state, "p-1");

    expect(archived.ok).toBe(true);
    expect(archived.state.projects[0].status).toBe("archived");
    expect(archived.state.relationships).toHaveLength(1);
    expect(restored.state.projects[0].status).toBe("active");
    expect(restored.state.relationships).toHaveLength(1);
  });

  it("updateThought rejects empty titles", () => {
    const base = state();
    const result = updateThought(base, "t-1", { title: "   " });

    expect(result.ok).toBe(false);
    expect(result.state).toBe(base);
  });
});
