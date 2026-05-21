import { describe, expect, it } from "vitest";
import {
  acceptDecisionRecord,
  archiveDecisionRecord,
  createDecisionFromBlockingQuestion,
  createDecisionRecord,
  deleteDecisionRecord,
  listDecisionRecords,
  updateDecisionRecord
} from "./decisionRecords";
import type { AppState, DecisionRecord } from "./types";

const timestamp = "2026-01-01T00:00:00.000Z";

const emptyState: AppState = {
  universes: [],
  thoughts: [],
  projects: [],
  relationships: [],
  aiInsights: []
};

function decision(patch: Partial<DecisionRecord> = {}): DecisionRecord {
  return {
    id: "decision-1",
    title: "Use TodoItem as the implementation entity",
    decision: "Keep TodoItem for persisted app items.",
    rationale: "It preserves migration safety.",
    consequences: "Future naming can be handled in UI copy.",
    status: "proposed",
    linkedUniverseIds: ["u-1"],
    createdAt: timestamp,
    updatedAt: timestamp,
    ...patch
  };
}

function stateWithDecision(patch: Partial<AppState> = {}): AppState {
  return {
    universes: [
      {
        id: "u-1",
        name: "Universe",
        description: "",
        purpose: "",
        focus: "main"
      }
    ],
    thoughts: [],
    projects: [],
    relationships: [],
    aiInsights: [],
    decisionRecords: [decision()],
    ...patch
  };
}

describe("decision records", () => {
  it("lists without records", () => {
    expect(listDecisionRecords(emptyState)).toEqual([]);
  });

  it("creates a proposed decision record by default", () => {
    const result = createDecisionRecord(emptyState, {
      title: " Use TodoItem ",
      decision: " Keep the persistence object stable. ",
      linkedThoughtIds: ["t-1", "t-1"]
    });

    expect(result.ok).toBe(true);
    expect(result.state.decisionRecords?.[0]).toMatchObject({
      title: "Use TodoItem",
      decision: "Keep the persistence object stable.",
      status: "proposed",
      linkedThoughtIds: ["t-1"]
    });
  });

  it("rejects empty title and decision", () => {
    expect(createDecisionRecord(emptyState, { title: " ", decision: "Valid" })).toMatchObject({
      ok: false,
      error: "Decision title is required."
    });
    expect(createDecisionRecord(emptyState, { title: "Valid", decision: " " })).toMatchObject({
      ok: false,
      error: "Decision is required."
    });
  });

  it("updates rationale consequences and status", () => {
    const result = updateDecisionRecord(stateWithDecision(), "decision-1", {
      rationale: "Better architecture boundary.",
      consequences: "Migration remains small.",
      status: "accepted"
    });

    expect(result.ok).toBe(true);
    expect(result.state.decisionRecords?.[0]).toMatchObject({
      rationale: "Better architecture boundary.",
      consequences: "Migration remains small.",
      status: "accepted"
    });
  });

  it("accepts archives and deletes a decision record", () => {
    const accepted = acceptDecisionRecord(stateWithDecision(), "decision-1");
    expect(accepted.state.decisionRecords?.[0].status).toBe("accepted");

    const archived = archiveDecisionRecord(accepted.state, "decision-1");
    expect(archived.state.decisionRecords?.[0].status).toBe("archived");

    const deleted = deleteDecisionRecord(archived.state, "decision-1");
    expect(deleted.state.decisionRecords).toHaveLength(0);
  });

  it("acceptDecisionRecord resolves its source blocking question", () => {
    const result = acceptDecisionRecord({
      ...emptyState,
      blockingQuestions: [
        {
          id: "bq-1",
          question: "Resolve from decision?",
          status: "in_review",
          createdAt: timestamp,
          updatedAt: timestamp
        }
      ],
      decisionRecords: [
        decision({
          id: "decision-1",
          decision: "Use the accepted decision as the final resolution.",
          status: "proposed",
          sourceBlockingQuestionId: "bq-1"
        })
      ]
    }, "decision-1");

    expect(result.ok).toBe(true);
    expect(result.state.decisionRecords?.[0].status).toBe("accepted");
    expect(result.state.blockingQuestions?.[0]).toMatchObject({
      status: "resolved",
      finalResolution: "Use the accepted decision as the final resolution."
    });
  });

  it("creates a decision from a resolved blocking question", () => {
    const state: AppState = {
      ...emptyState,
      blockingQuestions: [
        {
          id: "bq-1",
          question: "Should TodoItem and ThoughtItem split?",
          context: "Architecture boundary.",
          proposedResolution: "Keep together.",
          finalResolution: "Use TodoItem now.",
          status: "resolved",
          linkedThoughtIds: ["t-1"],
          linkedProjectIds: ["p-1"],
          linkedUniverseIds: ["u-1"],
          createdAt: timestamp,
          updatedAt: timestamp
        }
      ]
    };
    const result = createDecisionFromBlockingQuestion(state, "bq-1");

    expect(result.ok).toBe(true);
    expect(result.state.decisionRecords?.[0]).toMatchObject({
      title: "Should TodoItem and ThoughtItem split?",
      decision: "Use TodoItem now.",
      rationale: "Architecture boundary.",
      status: "accepted",
      sourceBlockingQuestionId: "bq-1",
      linkedThoughtIds: ["t-1"],
      linkedProjectIds: ["p-1"],
      linkedUniverseIds: ["u-1"]
    });
  });

  it("returns the exact error when a blocking question has no resolution", () => {
    const state: AppState = {
      ...emptyState,
      blockingQuestions: [
        {
          id: "bq-1",
          question: "Unresolved?",
          status: "open",
          createdAt: timestamp,
          updatedAt: timestamp
        }
      ]
    };

    const result = createDecisionFromBlockingQuestion(state, "bq-1");

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Blocking question needs a resolution before creating a decision.");
  });

  it("searches case-insensitively", () => {
    expect(listDecisionRecords(stateWithDecision(), { searchText: "migration SAFETY" })).toHaveLength(1);
    expect(listDecisionRecords(stateWithDecision(), { searchText: "missing" })).toHaveLength(0);
  });

  it("filters by universe", () => {
    const state = stateWithDecision({
      decisionRecords: [
        decision({ id: "decision-1", linkedUniverseIds: ["u-1"] }),
        decision({ id: "decision-2", linkedUniverseIds: ["u-2"] })
      ]
    });

    expect(listDecisionRecords(state, { universeId: "u-1" }).map((item) => item.id)).toEqual(["decision-1"]);
  });

  it("deleteDecisionRecord clears supersedes references", () => {
    const result = deleteDecisionRecord(stateWithDecision({
      decisionRecords: [
        decision({ id: "decision-1" }),
        decision({ id: "decision-2", supersedesDecisionId: "decision-1" })
      ]
    }), "decision-1");

    expect(result.state.decisionRecords?.[0]).toMatchObject({
      id: "decision-2",
      supersedesDecisionId: undefined
    });
  });

  it("does not mutate original state", () => {
    const state = stateWithDecision();
    const original = JSON.stringify(state);

    listDecisionRecords(state);
    createDecisionRecord(state, { title: "New", decision: "New decision" });
    updateDecisionRecord(state, "decision-1", { status: "accepted" });
    acceptDecisionRecord(state, "decision-1");
    archiveDecisionRecord(state, "decision-1");
    deleteDecisionRecord(state, "decision-1");

    expect(JSON.stringify(state)).toBe(original);
  });
});
