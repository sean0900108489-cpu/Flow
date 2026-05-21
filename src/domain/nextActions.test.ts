import { describe, expect, it } from "vitest";
import type { AppState } from "./types";
import {
  calculateNextActionSummary,
  clearDismissedNextActions,
  clearFocusNextAction,
  completeNextAction,
  defaultNextActionState,
  dismissNextAction,
  listNextActions,
  normalizeNextActionState,
  pinNextAction,
  setNextActionForSource,
  updateNextActionState,
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
      why: "Thought reason",
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
  aiInsights: [
    {
      id: "ai-1",
      targetId: "t-1",
      type: "next_action",
      content: "Review draft next action",
      status: "draft",
      createdAt: "2026-01-05T00:00:00.000Z"
    }
  ],
  blockingQuestions: [
    {
      id: "bq-1",
      question: "Should this block execution?",
      context: "Architecture blocker",
      status: "open",
      impactLevel: "blocking",
      linkedUniverseIds: ["u-1"],
      createdAt: timestamp,
      updatedAt: "2026-01-04T00:00:00.000Z"
    }
  ],
  decisionRecords: []
};

function action(sourceType: NextActionItem["sourceType"], sourceId: string): NextActionItem {
  const item = calculateNextActionSummary(baseState).allActions.find((candidate) =>
    candidate.sourceType === sourceType && candidate.sourceId === sourceId
  );

  if (!item) throw new Error("Missing test action.");
  return item;
}

describe("next actions", () => {
  it("creates a default next action state", () => {
    expect(defaultNextActionState()).toMatchObject({
      savedActionIds: [],
      dismissedActionIds: [],
      manualNote: "",
      manualConfidence: "medium",
      focusMode: "decide"
    });
  });

  it("normalizes missing or partial next action state for old data", () => {
    expect(normalizeNextActionState(undefined)).toMatchObject({
      manualConfidence: "medium",
      focusMode: "decide"
    });
    expect(normalizeNextActionState({
      savedActionIds: [" a ", "a"],
      dismissedActionIds: [" b "],
      selectedFocusActionId: " a ",
      manualNote: "  Note  ",
      manualConfidence: "invalid" as never,
      focusMode: "bad" as never,
      updatedAt: ""
    })).toMatchObject({
      savedActionIds: ["a"],
      dismissedActionIds: ["b"],
      selectedFocusActionId: "a",
      manualNote: "Note",
      manualConfidence: "medium",
      focusMode: "decide"
    });
  });

  it("lists thought and project next actions", () => {
    expect(action("thought", "t-1")).toMatchObject({
      title: "Thought action",
      actionText: "Do the thought step",
      universeId: "u-1",
      status: "available",
      actionType: "implement"
    });
    expect(action("project", "p-1")).toMatchObject({
      title: "Project action",
      actionText: "Do the project step",
      universeId: "u-2",
      sourceStatus: "handoff_ready"
    });
  });

  it("prioritizes unresolved blocking decisions as the top action", () => {
    const summary = calculateNextActionSummary(baseState);

    expect(summary.topAction).toMatchObject({
      sourceType: "blocking_question",
      sourceId: "bq-1",
      priority: "urgent",
      actionType: "decide"
    });
    expect(summary.signals.highBlockingUnresolvedDecisionCount).toBe(1);
  });

  it("reflects engineering readiness blockers", () => {
    const readinessAction = action("engineering_readiness", "not_ready");

    expect(readinessAction).toMatchObject({
      sourceType: "engineering_readiness",
      actionType: "clarify",
      priority: "high"
    });
    expect(readinessAction.blockers.length).toBeGreaterThan(0);
  });

  it("reflects pending review queue items", () => {
    const reviewActions = calculateNextActionSummary(baseState).allActions.filter((item) => item.sourceType === "review_queue");

    expect(reviewActions.some((item) => item.sourceId === "ai-1")).toBe(true);
    expect(calculateNextActionSummary(baseState).signals.pendingReviewCount).toBeGreaterThan(0);
  });

  it("searches and filters recommended actions", () => {
    expect(listNextActions(baseState, { searchText: "PROJECT STEP" }).some((item) => item.sourceId === "p-1")).toBe(true);
    expect(listNextActions(baseState, { sourceType: "project" })).toEqual([
      expect.objectContaining({ sourceId: "p-1" })
    ]);
    expect(listNextActions(baseState, { universeId: "u-2" }).some((item) => item.sourceId === "p-1")).toBe(true);
  });

  it("pins, dismisses, clears dismissed actions, and clears focus", () => {
    const item = action("blocking_question", "bq-1");
    const pinned = pinNextAction(baseState, item.id);

    expect(pinned.ok).toBe(true);
    expect(pinned.state.nextActionState?.selectedFocusActionId).toBe(item.id);
    expect(calculateNextActionSummary(pinned.state).focusAction?.id).toBe(item.id);

    const dismissed = dismissNextAction(pinned.state, item.id);
    expect(dismissed.state.nextActionState?.dismissedActionIds).toContain(item.id);
    expect(calculateNextActionSummary(dismissed.state).recommendedActions.some((action) => action.id === item.id)).toBe(false);

    const clearedDismissed = clearDismissedNextActions(dismissed.state);
    expect(clearedDismissed.state.nextActionState?.dismissedActionIds).toEqual([]);

    const clearedFocus = clearFocusNextAction(clearedDismissed.state);
    expect(clearedFocus.state.nextActionState?.selectedFocusActionId).toBeUndefined();
  });

  it("updates manual note, confidence, and focus mode", () => {
    const result = updateNextActionState(baseState, {
      manualNote: "Focus the review path.",
      manualConfidence: "high",
      focusMode: "review"
    });

    expect(result.ok).toBe(true);
    expect(result.state.nextActionState).toMatchObject({
      manualNote: "Focus the review path.",
      manualConfidence: "high",
      focusMode: "review"
    });
  });

  it("completes source-backed actions and keeps direct updates scoped to thoughts/projects", () => {
    const thoughtResult = completeNextAction(baseState, action("thought", "t-1"));
    const projectResult = setNextActionForSource(baseState, "project", "p-1", "  New project step  ");
    const rejected = setNextActionForSource(baseState, "blocking_question", "bq-1", "Next");

    expect(thoughtResult.ok).toBe(true);
    expect(thoughtResult.state.thoughts.find((thought) => thought.id === "t-1")?.nextAction).toBe("");
    expect(projectResult.ok).toBe(true);
    expect(projectResult.state.projects.find((project) => project.id === "p-1")?.nextAction).toBe("New project step");
    expect(rejected.ok).toBe(false);
  });

  it("does not mutate original state when calculating or updating", () => {
    const original = JSON.stringify(baseState);

    calculateNextActionSummary(baseState);
    listNextActions(baseState);
    pinNextAction(baseState, "blocking_question:bq-1");

    expect(JSON.stringify(baseState)).toBe(original);
  });
});
