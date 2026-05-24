import { describe, expect, it } from "vitest";
import { buildAIPlanningContext } from "./aiPlanningContext";
import { supportedDomainCommandTypes } from "./commandLayer";
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
  purpose: "AI planning context tests",
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
  targetId: "p-1",
  type: "engineering_draft",
  content: "Draft handoff.",
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
    universes: [
      universe(),
      universe({ id: "u-2", name: "Universe Two", focus: "secondary" })
    ],
    thoughts: [
      thought(),
      thought({
        id: "t-2",
        title: "Thought Two",
        type: "task",
        status: "active",
        universeId: "u-1",
        projectId: undefined
      }),
      thought({
        id: "t-3",
        title: "Thought Three",
        type: "goal",
        status: "active",
        universeId: "u-2",
        projectId: "p-2"
      })
    ],
    projects: [
      project(),
      project({
        id: "p-2",
        name: "Project Two",
        sourceThoughtId: "t-3",
        linkedThoughtIds: ["t-3"],
        universeId: "u-2",
        readiness: "draftable"
      })
    ],
    relationships: [
      relationship(),
      relationship({
        id: "r-2",
        sourceId: "t-3",
        targetId: "p-2"
      })
    ],
    aiInsights: [aiInsight()],
    blockingQuestions: [blockingQuestion()],
    decisionRecords: [decisionRecord()],
    ...patch
  };
}

describe("AIPlanningContext", () => {
  it("builds app scope with health review queue allowed commands and safety rules", () => {
    const context = buildAIPlanningContext(baseState(), { type: "app" });

    expect(context.target).toEqual({ type: "app", valid: true });
    expect(context.appHealth.summary.totalFindings).toBeGreaterThan(0);
    expect(context.reviewItems.length).toBeGreaterThan(0);
    expect(context.allowedCommands.map((command) => command.type)).toEqual([...supportedDomainCommandTypes]);
    expect(context.allowedCommands.every((command) => command.requiresUserConfirmation)).toBe(true);
    expect(context.safetyRules).toEqual(expect.arrayContaining([
      "AIPlanningContext cannot mutate AppState.",
      "AI commands require human confirmation.",
      "handoff_ready cannot be set by generic update."
    ]));
    expect(context.limitations).toEqual(expect.arrayContaining([
      "AI can propose commands, but cannot execute commands."
    ]));
  });

  it("builds thought scope with its progression report relationship context and related project report", () => {
    const context = buildAIPlanningContext(baseState(), { type: "thought", id: "t-1" });

    expect(context.target).toMatchObject({ type: "thought", id: "t-1", valid: true });
    expect(context.thoughtReports.map((report) => report.target.id)).toEqual(["t-1"]);
    expect(context.relationshipContexts.map((item) => item.targetId)).toEqual(["t-1"]);
    expect(context.projectReports.map((report) => report.target.id)).toEqual(["p-1"]);
  });

  it("builds project scope with readiness relationship context and linked thought reports", () => {
    const context = buildAIPlanningContext(baseState(), { type: "project", id: "p-1" });

    expect(context.target).toMatchObject({ type: "project", id: "p-1", valid: true });
    expect(context.projectReports.map((report) => report.target.id)).toEqual(["p-1"]);
    expect(context.relationshipContexts.map((item) => item.targetId)).toEqual(["p-1"]);
    expect(context.thoughtReports.map((report) => report.target.id)).toEqual(["t-1"]);
  });

  it("builds universe scope from direct universe membership with deterministic summaries", () => {
    const context = buildAIPlanningContext(baseState(), { type: "universe", id: "u-1" });

    expect(context.target).toMatchObject({ type: "universe", id: "u-1", valid: true });
    expect(context.summaries.thoughts.map((summary) => summary.id)).toEqual(["t-1", "t-2"]);
    expect(context.summaries.projects.map((summary) => summary.id)).toEqual(["p-1"]);
    expect(context.relationshipContexts.map((item) => `${item.targetType}:${item.targetId}`)).toEqual([
      "project:p-1",
      "thought:t-1",
      "thought:t-2"
    ]);
  });

  it("returns deterministic invalid context for missing targets", () => {
    const first = buildAIPlanningContext(baseState(), { type: "thought", id: "missing" });
    const second = buildAIPlanningContext(baseState(), { type: "thought", id: "missing" });

    expect(first).toEqual(second);
    expect(first.target).toMatchObject({
      type: "thought",
      id: "missing",
      valid: false,
      reason: "Thought target was not found."
    });
    expect(first.thoughtReports[0].target).toEqual({ type: "thought", id: "missing", valid: false });
    expect(first.relationshipContexts[0].targetType).toBe("missing");
  });

  it("marks truncation deterministically when scoped collections exceed limits", () => {
    const context = buildAIPlanningContext(baseState(), { type: "app" }, {
      maxReports: 1,
      maxRelationshipContexts: 1,
      maxReviewItems: 1
    });

    expect(context.truncated.thoughtReports).toBe(true);
    expect(context.truncated.projectReports).toBe(true);
    expect(context.truncated.relationshipContexts).toBe(true);
    expect(context.truncated.reviewItems).toBe(true);
    expect(context.summaries.thoughts.map((summary) => summary.id)).toEqual(["t-1"]);
    expect(context.summaries.projects.map((summary) => summary.id)).toEqual(["p-1"]);
  });

  it("does not mutate input state or add persisted review/planning state", () => {
    const state = baseState();
    const before = JSON.parse(JSON.stringify(state));

    buildAIPlanningContext(state, { type: "app" });

    expect(state).toEqual(before);
    expect("reviewItems" in (state as unknown as Record<string, unknown>)).toBe(false);
    expect("aiPlanningContext" in (state as unknown as Record<string, unknown>)).toBe(false);
  });
});
