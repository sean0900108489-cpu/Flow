import { describe, expect, it } from "vitest";
import type { AppState } from "./types";
import {
  completeNextAction,
  listNextActions,
  setNextActionForSource,
  type NextActionItem
} from "./nextActions";

const timestamp = "2026-01-01T00:00:00.000Z";

const baseState: AppState = {
  universes: [
    {
      id: "u-1",
      name: "Universe One",
      description: "",
      purpose: "",
      focus: "main"
    },
    {
      id: "u-2",
      name: "Universe Two",
      description: "",
      purpose: "",
      focus: "secondary"
    }
  ],
  thoughts: [
    {
      id: "t-1",
      title: "Thought action",
      content: "",
      type: "task",
      status: "active",
      universeId: "u-1",
      why: "",
      outcome: "",
      nextAction: "Do the thought step",
      createdAt: timestamp,
      updatedAt: "2026-01-03T00:00:00.000Z"
    },
    {
      id: "t-archived",
      title: "Archived thought",
      content: "",
      type: "task",
      status: "archived",
      universeId: "u-1",
      why: "",
      outcome: "",
      nextAction: "Hidden thought action",
      createdAt: timestamp,
      updatedAt: timestamp
    }
  ],
  projects: [
    {
      id: "p-1",
      universeId: "u-2",
      status: "active",
      lifecycleStatus: "handoff_ready",
      name: "Project action",
      intent: "",
      users: [],
      features: [],
      screens: [],
      dataObjects: [],
      flowSteps: [],
      unknowns: [],
      nextAction: "Do the project step",
      readiness: "ready_for_engineering",
      createdAt: timestamp,
      updatedAt: "2026-01-02T00:00:00.000Z"
    },
    {
      id: "p-archived",
      universeId: "u-2",
      status: "archived",
      name: "Archived project",
      intent: "",
      users: [],
      features: [],
      screens: [],
      dataObjects: [],
      flowSteps: [],
      unknowns: [],
      nextAction: "Hidden project action",
      readiness: "not_ready",
      createdAt: timestamp,
      updatedAt: timestamp
    }
  ],
  relationships: [],
  aiInsights: [],
  blockingQuestions: [
    {
      id: "bq-1",
      question: "Should this block execution?",
      context: "Architecture blocker",
      status: "open",
      linkedUniverseIds: ["u-1"],
      createdAt: timestamp,
      updatedAt: "2026-01-04T00:00:00.000Z"
    }
  ]
};

function action(sourceType: NextActionItem["sourceType"], sourceId: string): NextActionItem {
  const item = listNextActions(baseState).find((candidate) =>
    candidate.sourceType === sourceType && candidate.sourceId === sourceId
  );

  if (!item) throw new Error("Missing test action.");
  return item;
}

describe("next actions", () => {
  it("lists thought next actions", () => {
    expect(action("thought", "t-1")).toMatchObject({
      title: "Thought action",
      actionText: "Do the thought step",
      universeId: "u-1",
      status: "available"
    });
  });

  it("lists project next actions", () => {
    expect(action("project", "p-1")).toMatchObject({
      title: "Project action",
      actionText: "Do the project step",
      universeId: "u-2",
      sourceStatus: "handoff_ready"
    });
  });

  it("lists open blocking questions as blocked actions", () => {
    expect(action("blocking_question", "bq-1")).toMatchObject({
      title: "Should this block execution?",
      actionText: "Resolve blocking question",
      universeId: "u-1",
      status: "blocked"
    });
  });

  it("omits archived thought and project sources", () => {
    const actions = listNextActions(baseState);

    expect(actions.find((item) => item.sourceId === "t-archived")).toBeUndefined();
    expect(actions.find((item) => item.sourceId === "p-archived")).toBeUndefined();
  });

  it("searches case-insensitively", () => {
    expect(listNextActions(baseState, { searchText: "PROJECT STEP" })).toHaveLength(1);
    expect(listNextActions(baseState, { searchText: "architecture" })).toHaveLength(1);
    expect(listNextActions(baseState, { searchText: "missing" })).toHaveLength(0);
  });

  it("filters by source type", () => {
    const actions = listNextActions(baseState, { sourceType: "project" });

    expect(actions).toHaveLength(1);
    expect(actions[0].sourceType).toBe("project");
  });

  it("filters by universe", () => {
    const actions = listNextActions(baseState, { universeId: "u-2" });

    expect(actions).toHaveLength(1);
    expect(actions[0].sourceId).toBe("p-1");
  });

  it("completes a thought action by clearing nextAction", () => {
    const result = completeNextAction(baseState, action("thought", "t-1"));

    expect(result.ok).toBe(true);
    expect(result.state.thoughts.find((thought) => thought.id === "t-1")?.nextAction).toBe("");
  });

  it("completes a project action by clearing nextAction", () => {
    const result = completeNextAction(baseState, action("project", "p-1"));

    expect(result.ok).toBe(true);
    expect(result.state.projects.find((project) => project.id === "p-1")?.nextAction).toBe("");
  });

  it("moves an open blocking question to in_review without resolving it", () => {
    const result = completeNextAction(baseState, action("blocking_question", "bq-1"));
    const question = result.state.blockingQuestions?.find((item) => item.id === "bq-1");

    expect(result.ok).toBe(true);
    expect(question?.status).toBe("in_review");
    expect(question?.finalResolution).toBeUndefined();
  });

  it("does not crash when completing a missing source", () => {
    const result = completeNextAction(baseState, {
      ...action("thought", "t-1"),
      sourceId: "missing"
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Thought not found.");
  });

  it("updates thought and project next action text without mutating state", () => {
    const original = JSON.stringify(baseState);
    const thoughtResult = setNextActionForSource(baseState, "thought", "t-1", "  New thought step  ");
    const projectResult = setNextActionForSource(baseState, "project", "p-1", "  New project step  ");

    expect(thoughtResult.ok).toBe(true);
    expect(projectResult.ok).toBe(true);
    expect(thoughtResult.state.thoughts.find((thought) => thought.id === "t-1")?.nextAction).toBe("New thought step");
    expect(projectResult.state.projects.find((project) => project.id === "p-1")?.nextAction).toBe("New project step");
    expect(JSON.stringify(baseState)).toBe(original);
  });

  it("rejects direct blocking question next action updates", () => {
    const result = setNextActionForSource(baseState, "blocking_question", "bq-1", "Next");

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Blocking questions do not support direct nextAction.");
  });

  it("does not mutate original state when listing or completing actions", () => {
    const original = JSON.stringify(baseState);

    listNextActions(baseState);
    completeNextAction(baseState, action("thought", "t-1"));
    completeNextAction(baseState, action("project", "p-1"));
    completeNextAction(baseState, action("blocking_question", "bq-1"));

    expect(JSON.stringify(baseState)).toBe(original);
  });
});
