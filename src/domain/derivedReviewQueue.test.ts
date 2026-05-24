import { describe, expect, it } from "vitest";
import { buildDerivedReviewQueue } from "./derivedReviewQueue";
import type {
  AIInsight,
  AppState,
  BlockingQuestion,
  DecisionRecord,
  Project,
  Relationship,
  ThoughtItem,
  Universe
} from "./types";

const timestamp = "2026-01-01T00:00:00.000Z";

const universe = (patch: Partial<Universe> = {}): Universe => ({
  id: "u-1",
  name: "Universe One",
  description: "Primary universe",
  purpose: "Derived review tests",
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
  projectId: "p-1",
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
  readiness: "not_ready",
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
  targetId: "t-1",
  type: "classification",
  content: "Classify this thought.",
  status: "draft",
  createdAt: timestamp,
  ...patch
});

const blockingQuestion = (patch: Partial<BlockingQuestion> = {}): BlockingQuestion => ({
  id: "bq-1",
  question: "What blocks this?",
  status: "open",
  impactLevel: "blocking",
  linkedThoughtIds: ["t-1"],
  linkedProjectIds: ["p-1"],
  linkedUniverseIds: ["u-1"],
  createdAt: timestamp,
  updatedAt: timestamp,
  ...patch
});

const decisionRecord = (patch: Partial<DecisionRecord> = {}): DecisionRecord => ({
  id: "d-1",
  title: "Decision One",
  decision: "Choose a path.",
  status: "proposed",
  sourceBlockingQuestionId: "bq-1",
  linkedProjectIds: ["p-1"],
  linkedUniverseIds: ["u-1"],
  createdAt: timestamp,
  updatedAt: timestamp,
  ...patch
});

function baseState(patch: Partial<AppState> = {}): AppState {
  return {
    universes: [universe()],
    thoughts: [thought()],
    projects: [project()],
    relationships: [
      relationship(),
      relationship({
        id: "r-orphan",
        sourceId: "missing-thought",
        sourceType: "thought",
        type: "blocks"
      })
    ],
    aiInsights: [aiInsight()],
    blockingQuestions: [blockingQuestion()],
    decisionRecords: [decisionRecord()],
    ...patch
  };
}

describe("derived review queue", () => {
  it("derives actionable items from thought project health AI question and decision sources", () => {
    const queue = buildDerivedReviewQueue(baseState());

    expect(queue).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: "thought_progression",
        sourceCode: "classification_missing",
        target: { type: "thought", id: "t-1" }
      }),
      expect.objectContaining({
        source: "project_readiness",
        sourceCode: "readiness_drift",
        target: { type: "project", id: "p-1" }
      }),
      expect.objectContaining({
        source: "app_health",
        sourceCode: "orphan_relationship",
        target: { type: "relationship", id: "r-orphan" }
      }),
      expect.objectContaining({
        source: "ai_insight",
        sourceCode: "pending_ai_draft",
        target: { type: "aiInsight", id: "ai-1" }
      }),
      expect.objectContaining({
        source: "blocking_question",
        sourceCode: "open_blocking_question",
        target: { type: "blockingQuestion", id: "bq-1" }
      }),
      expect.objectContaining({
        source: "decision_record",
        sourceCode: "proposed_decision",
        target: { type: "decisionRecord", id: "d-1" }
      })
    ]));
  });

  it("uses stable ids and deterministic ordering", () => {
    const first = buildDerivedReviewQueue(baseState());
    const second = buildDerivedReviewQueue(baseState());

    expect(second.map((item) => item.id)).toEqual(first.map((item) => item.id));
    expect(second).toEqual(first);
  });

  it("keeps suggested commands as human-confirmed metadata only", () => {
    const queue = buildDerivedReviewQueue(baseState());
    const commands = queue.flatMap((item) => item.suggestedCommands);

    expect(commands.length).toBeGreaterThan(0);
    expect(commands.every((command) => command.requiresHumanConfirmation)).toBe(true);
    expect(queue.every((item) => item.requiresHumanConfirmation)).toBe(true);
  });

  it("derives invalid AI patch targets through AppHealthReport", () => {
    const queue = buildDerivedReviewQueue(baseState({
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
    }));

    expect(queue).toContainEqual(expect.objectContaining({
      source: "app_health",
      sourceCode: "invalid_ai_patch_target",
      target: { type: "aiInsight", id: "ai-invalid" }
    }));
  });

  it("does not persist review items or mutate state", () => {
    const state = baseState();
    const before = JSON.parse(JSON.stringify(state));

    buildDerivedReviewQueue(state);

    expect(state).toEqual(before);
    expect("reviewItems" in (state as unknown as Record<string, unknown>)).toBe(false);
  });
});
