import { describe, expect, it } from "vitest";
import { seed } from "../data/seed";
import {
  archiveBlockingQuestion,
  createBlockingQuestion,
  deleteBlockingQuestion,
  getBlockingQuestionSummary,
  listBlockingQuestions,
  normalizeAppState,
  resolveBlockingQuestion,
  updateBlockingQuestion
} from "./blockingQuestions";
import type { AppState } from "./types";

const emptyState: AppState = {
  universes: [],
  thoughts: [],
  projects: [],
  relationships: [],
  aiInsights: []
};

const linkedState: AppState = {
  universes: [
    {
      id: "u-1",
      name: "Universe",
      description: "",
      purpose: "",
      focus: "main"
    }
  ],
  thoughts: [
    {
      id: "t-1",
      title: "Thought",
      content: "Thought content",
      type: "task",
      status: "active",
      universeId: "u-1",
      why: "",
      outcome: "",
      nextAction: "",
      projectId: "p-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    }
  ],
  projects: [
    {
      id: "p-1",
      universeId: "u-1",
      status: "active",
      name: "Project",
      intent: "Intent",
      users: ["Tester"],
      features: ["Feature"],
      screens: ["Screen"],
      dataObjects: ["Data"],
      flowSteps: ["Step"],
      unknowns: [],
      nextAction: "Next",
      readiness: "ready_for_engineering",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    }
  ],
  relationships: [],
  aiInsights: [],
  blockingQuestions: [
    {
      id: "bq-1",
      question: "Should this be first-class?",
      context: "Architecture decision",
      status: "open",
      linkedThoughtIds: ["t-1"],
      linkedProjectIds: ["p-1"],
      linkedUniverseIds: ["u-1"],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    }
  ]
};

describe("blocking questions", () => {
  it("lists seed and empty state without crashing", () => {
    expect(listBlockingQuestions(seed).length).toBeGreaterThanOrEqual(3);
    expect(listBlockingQuestions(emptyState)).toEqual([]);
  });

  it("initializes default core decision center questions for legacy state", () => {
    const normalized = normalizeAppState(emptyState);

    expect(normalized.blockingQuestions).toHaveLength(3);
    expect(normalized.blockingQuestions?.map((question) => question.id)).toEqual([
      "bq-thought-todo",
      "bq-universe-model",
      "bq-engineering-readiness"
    ]);
    expect(normalized.blockingQuestions?.[0].possibleOptions?.length).toBeGreaterThan(0);
    expect(normalized.blockingQuestions?.[0].impactLevel).toBe("blocking");
  });

  it("creates an open question", () => {
    const result = createBlockingQuestion(emptyState, { question: " Should goals be first-class? " });

    expect(result.ok).toBe(true);
    expect(result.state.blockingQuestions?.[0]).toMatchObject({
      question: "Should goals be first-class?",
      status: "open"
    });
  });

  it("rejects an empty question", () => {
    const result = createBlockingQuestion(emptyState, { question: "   " });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Question is required.");
  });

  it("updates proposed resolution and status", () => {
    const result = updateBlockingQuestion(linkedState, "bq-1", {
      proposedResolution: "Keep it simple.",
      status: "in_review"
    });

    expect(result.ok).toBe(true);
    expect(result.state.blockingQuestions?.[0].proposedResolution).toBe("Keep it simple.");
    expect(result.state.blockingQuestions?.[0].status).toBe("in_review");
  });

  it("updates decision note, impact, and preferred option", () => {
    const state = normalizeAppState(emptyState);
    const result = updateBlockingQuestion(state, "bq-engineering-readiness", {
      status: "resolved",
      impactLevel: "high",
      decisionNote: "Engineering can start after the review queue has no blocking architecture items.",
      preferredOptionId: "after-review-queue-confirms-minimum-architecture"
    });

    const question = result.state.blockingQuestions?.find((item) => item.id === "bq-engineering-readiness");

    expect(result.ok).toBe(true);
    expect(question).toMatchObject({
      status: "resolved",
      impactLevel: "high",
      decisionNote: "Engineering can start after the review queue has no blocking architecture items.",
      preferredOptionId: "after-review-queue-confirms-minimum-architecture"
    });
  });

  it("resolves with a final resolution", () => {
    const result = resolveBlockingQuestion(linkedState, "bq-1", "Use a subtype for now.");

    expect(result.ok).toBe(true);
    expect(result.state.blockingQuestions?.[0].finalResolution).toBe("Use a subtype for now.");
    expect(result.state.blockingQuestions?.[0].status).toBe("resolved");
  });

  it("rejects an empty final resolution", () => {
    const result = resolveBlockingQuestion(linkedState, "bq-1", " ");

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Final resolution is required.");
  });

  it("archives a question", () => {
    const result = archiveBlockingQuestion(linkedState, "bq-1");

    expect(result.ok).toBe(true);
    expect(result.state.blockingQuestions?.[0].status).toBe("archived");
  });

  it("deletes only the question and leaves linked entities", () => {
    const result = deleteBlockingQuestion(linkedState, "bq-1");

    expect(result.ok).toBe(true);
    expect(result.state.blockingQuestions).toHaveLength(0);
    expect(result.state.thoughts).toHaveLength(1);
    expect(result.state.projects).toHaveLength(1);
    expect(result.state.universes).toHaveLength(1);
  });

  it("deleteBlockingQuestion clears decision source references", () => {
    const result = deleteBlockingQuestion({
      ...linkedState,
      decisionRecords: [
        {
          id: "decision-1",
          title: "Decision",
          decision: "Decision body",
          status: "accepted",
          sourceBlockingQuestionId: "bq-1",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z"
        }
      ]
    }, "bq-1");

    expect(result.state.decisionRecords?.[0].sourceBlockingQuestionId).toBeUndefined();
  });

  it("searches case-insensitively", () => {
    expect(listBlockingQuestions(linkedState, { searchText: "ARCHITECTURE" })).toHaveLength(1);
    expect(listBlockingQuestions(linkedState, { searchText: "missing" })).toHaveLength(0);
  });

  it("summarizes unresolved blockers and engineering readiness", () => {
    const summary = getBlockingQuestionSummary(normalizeAppState(emptyState));

    expect(summary.openCount).toBe(1);
    expect(summary.decidedCount).toBe(2);
    expect(summary.allCoreDecided).toBe(false);
    expect(summary.suggestedNextDecision?.id).toBe("bq-engineering-readiness");
    expect(summary.readinessMessage).toContain("Not fully ready");
  });

  it("does not mutate original state", () => {
    const original = JSON.stringify(linkedState);

    createBlockingQuestion(linkedState, { question: "New question" });
    updateBlockingQuestion(linkedState, "bq-1", { status: "resolved" });
    resolveBlockingQuestion(linkedState, "bq-1", "Resolve");
    archiveBlockingQuestion(linkedState, "bq-1");
    deleteBlockingQuestion(linkedState, "bq-1");

    expect(JSON.stringify(linkedState)).toBe(original);
  });
});
