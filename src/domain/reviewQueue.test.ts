import { describe, expect, it } from "vitest";
import {
  buildReviewQueue,
  getReviewQueueCounts,
  searchReviewQueue
} from "./reviewQueue";
import type { AppState, Project, ThoughtItem } from "./types";

const timestamp = "2026-01-01T00:00:00.000Z";

const thought = (patch: Partial<ThoughtItem> = {}): ThoughtItem => ({
  id: "t-review",
  title: "Review queue thought",
  content: "Thought content",
  type: "note",
  status: "inbox",
  universeId: "u-review",
  why: "",
  outcome: "",
  nextAction: "",
  createdAt: timestamp,
  updatedAt: timestamp,
  ...patch
});

const project = (patch: Partial<Project> = {}): Project => ({
  id: "p-review",
  universeId: "u-review",
  status: "active",
  lifecycleStatus: "planning",
  name: "Review queue project",
  intent: "Project ready for review queue handoff.",
  users: ["User"],
  features: ["Review Queue"],
  screens: ["Review Queue Center"],
  dataObjects: ["Project"],
  flowSteps: ["Review", "Handoff"],
  unknowns: [],
  nextAction: "Mark handoff ready.",
  readiness: "ready_for_engineering",
  createdAt: timestamp,
  updatedAt: timestamp,
  ...patch
});

function baseState(patch: Partial<AppState> = {}): AppState {
  return {
    universes: [
      {
        id: "u-review",
        name: "Review Universe",
        description: "Review testing",
        purpose: "Exercise review queue",
        focus: "main"
      },
      {
        id: "u-other",
        name: "Other Universe",
        description: "Other",
        purpose: "Filter target",
        focus: "secondary"
      }
    ],
    thoughts: [thought()],
    projects: [project()],
    relationships: [],
    aiInsights: [
      {
        id: "ai-review",
        targetId: "t-review",
        type: "classification",
        content: "Classify the review queue thought.",
        status: "draft",
        createdAt: timestamp,
        patch: {
          targetType: "thought",
          targetId: "t-review",
          operations: [
            {
              type: "updateThought",
              thoughtId: "t-review",
              patch: { nextAction: "Review this thought." }
            }
          ]
        }
      },
      {
        id: "ai-accepted",
        targetId: "t-review",
        type: "next_action",
        content: "Already accepted",
        status: "accepted",
        createdAt: timestamp
      }
    ],
    blockingQuestions: [
      {
        id: "bq-review",
        question: "Should this blocker be reviewed?",
        context: "The blocker has a proposed resolution.",
        proposedResolution: "Resolve the blocker deliberately.",
        status: "in_review",
        linkedUniverseIds: ["u-review"],
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        id: "bq-resolved",
        question: "Already resolved?",
        status: "resolved",
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    decisionRecords: [
      {
        id: "decision-review",
        title: "Review queue decision",
        decision: "Use a central queue for pending review.",
        status: "proposed",
        linkedUniverseIds: ["u-review"],
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        id: "decision-accepted",
        title: "Accepted decision",
        decision: "Already accepted",
        status: "accepted",
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    ...patch
  };
}

describe("review queue", () => {
  it("buildReviewQueue includes pending AI drafts, decisions, blockers, and handoff candidates", () => {
    const results = buildReviewQueue(baseState());

    expect(results).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "ai_insight", sourceId: "ai-review" }),
      expect.objectContaining({ type: "decision_record", sourceId: "decision-review" }),
      expect.objectContaining({ type: "blocking_question", sourceId: "bq-review" }),
      expect.objectContaining({ type: "handoff_candidate", sourceId: "p-review" })
    ]));
  });

  it("buildReviewQueue excludes already reviewed records", () => {
    const ids = buildReviewQueue(baseState()).map((item) => item.sourceId);

    expect(ids).not.toContain("ai-accepted");
    expect(ids).not.toContain("decision-accepted");
    expect(ids).not.toContain("bq-resolved");
  });

  it("searchReviewQueue filters by type", () => {
    const results = searchReviewQueue(baseState(), { type: "decision_record" });

    expect(results).toEqual([
      expect.objectContaining({ type: "decision_record", sourceId: "decision-review" })
    ]);
  });

  it("searchReviewQueue filters by status", () => {
    const results = searchReviewQueue(baseState(), { status: "in_review" });

    expect(results).toEqual([
      expect.objectContaining({ type: "blocking_question", sourceId: "bq-review" })
    ]);
  });

  it("searchReviewQueue filters by universe", () => {
    const results = searchReviewQueue(baseState(), { universeId: "u-other" });

    expect(results).toEqual([]);
  });

  it("searchReviewQueue is case-insensitive", () => {
    const results = searchReviewQueue(baseState(), { searchText: "CENTRAL QUEUE" });

    expect(results).toEqual([
      expect.objectContaining({ type: "decision_record", sourceId: "decision-review" })
    ]);
  });

  it("getReviewQueueCounts returns type counts", () => {
    expect(getReviewQueueCounts(buildReviewQueue(baseState()))).toEqual({
      total: 4,
      aiDrafts: 1,
      proposedDecisions: 1,
      blockingQuestions: 1,
      handoffCandidates: 1
    });
  });

  it("does not crash without optional review arrays", () => {
    const results = buildReviewQueue(baseState({
      aiInsights: [],
      blockingQuestions: undefined,
      decisionRecords: undefined
    }));

    expect(results).toEqual([
      expect.objectContaining({ type: "handoff_candidate", sourceId: "p-review" })
    ]);
  });

  it("does not include projects already marked handoff ready", () => {
    const results = buildReviewQueue(baseState({
      projects: [project({ lifecycleStatus: "handoff_ready" })]
    }));

    expect(results.find((item) => item.type === "handoff_candidate")).toBeUndefined();
  });

  it("functions do not mutate original state", () => {
    const state = baseState();
    const before = JSON.stringify(state);

    buildReviewQueue(state);
    searchReviewQueue(state, { searchText: "review", type: "ai_insight", status: "draft", universeId: "u-review" });
    getReviewQueueCounts(buildReviewQueue(state));

    expect(JSON.stringify(state)).toBe(before);
  });
});
