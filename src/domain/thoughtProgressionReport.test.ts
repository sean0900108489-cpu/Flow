import { describe, expect, it } from "vitest";
import {
  buildThoughtProgressionReport,
  buildThoughtProgressionReports
} from "./thoughtProgressionReport";
import type { AppState, BlockingQuestion, Project, Relationship, ThoughtItem, Universe } from "./types";

const timestamp = "2026-01-01T00:00:00.000Z";

const universe = (patch: Partial<Universe> = {}): Universe => ({
  id: "u-1",
  name: "Universe One",
  description: "Primary universe",
  purpose: "Test thought progression",
  focus: "main",
  status: "active",
  ...patch
});

const thought = (patch: Partial<ThoughtItem> = {}): ThoughtItem => ({
  id: "t-1",
  title: "Thought One",
  content: "Captured idea.",
  type: "note",
  status: "active",
  universeId: "u-1",
  why: "It matters.",
  outcome: "A clear result.",
  nextAction: "Do the next step.",
  createdAt: timestamp,
  updatedAt: timestamp,
  ...patch
});

const project = (patch: Partial<Project> = {}): Project => ({
  id: "p-1",
  universeId: "u-1",
  status: "active",
  lifecycleStatus: "planning",
  name: "Project One",
  intent: "Project intent.",
  users: [],
  features: [],
  screens: [],
  dataObjects: [],
  flowSteps: [],
  unknowns: [],
  nextAction: "Project next",
  readiness: "draftable",
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
  type: "depends_on",
  description: "Dependency.",
  ...patch
});

const blockingQuestion = (patch: Partial<BlockingQuestion> = {}): BlockingQuestion => ({
  id: "bq-1",
  question: "What blocks this thought?",
  status: "open",
  impactLevel: "blocking",
  linkedThoughtIds: ["t-1"],
  linkedUniverseIds: ["u-1"],
  createdAt: timestamp,
  updatedAt: timestamp,
  ...patch
});

function baseState(patch: Partial<AppState> = {}): AppState {
  return {
    universes: [universe(), universe({ id: "u-2", name: "Universe Two" })],
    thoughts: [thought()],
    projects: [],
    relationships: [],
    aiInsights: [],
    blockingQuestions: [],
    decisionRecords: [],
    ...patch
  };
}

const codes = (report: ReturnType<typeof buildThoughtProgressionReport>) =>
  report.findings.map((finding) => finding.code);

describe("thought progression report", () => {
  it("returns a deterministic missing report for a missing thought", () => {
    const report = buildThoughtProgressionReport(baseState(), "missing-thought");

    expect(report.target).toEqual({ type: "thought", id: "missing-thought", valid: false });
    expect(report.recommendedNextStage).toBe("capture");
    expect(report.findings).toEqual([
      expect.objectContaining({
        code: "target_missing",
        severity: "error",
        evidenceIds: ["missing-thought"]
      })
    ]);
    expect(report.suggestedCommands).toEqual([]);
  });

  it("identifies inbox thoughts", () => {
    const report = buildThoughtProgressionReport(baseState({
      thoughts: [thought({ status: "inbox" })]
    }), "t-1");

    expect(report.isInbox).toBe(true);
    expect(report.recommendedNextStage).toBe("classify");
    expect(codes(report)).toContain("thought_inbox");
  });

  it("identifies active thoughts", () => {
    const report = buildThoughtProgressionReport(baseState(), "t-1");

    expect(report.isActive).toBe(true);
    expect(codes(report)).toContain("thought_active");
  });

  it("reports missing classification for generic inbox thoughts", () => {
    const report = buildThoughtProgressionReport(baseState({
      thoughts: [thought({ status: "inbox", type: "note" })]
    }), "t-1");

    expect(report.classificationMissing).toBe(true);
    expect(report.semanticRole).toBe("note");
    expect(codes(report)).toContain("classification_missing");
    expect(report.suggestedCommands.map((command) => command.commandType)).toContain("classify_thought");
  });

  it("reports missing universe refs", () => {
    const report = buildThoughtProgressionReport(baseState({
      thoughts: [thought({ universeId: "" })]
    }), "t-1");

    expect(report.universe).toMatchObject({
      present: false,
      valid: false
    });
    expect(codes(report)).toContain("universe_missing");
    expect(report.recommendedNextStage).toBe("universe");
  });

  it("reports invalid universe refs without repairing them", () => {
    const state = baseState({
      thoughts: [thought({ universeId: "missing-universe" })]
    });
    const before = JSON.stringify(state);
    const report = buildThoughtProgressionReport(state, "t-1");

    expect(report.universe).toMatchObject({
      id: "missing-universe",
      present: true,
      valid: false
    });
    expect(codes(report)).toContain("universe_invalid");
    expect(JSON.stringify(state)).toBe(before);
  });

  it("reports missing why outcome and nextAction", () => {
    const report = buildThoughtProgressionReport(baseState({
      thoughts: [thought({ why: "", outcome: "   ", nextAction: "" })]
    }), "t-1");

    expect(report.missingContext).toEqual({
      why: true,
      outcome: true,
      nextAction: true
    });
    expect(codes(report)).toEqual(expect.arrayContaining([
      "context_missing_why",
      "context_missing_outcome",
      "context_missing_next_action"
    ]));
  });

  it("infers semantic roles for task goal question and project seed", () => {
    const state = baseState({
      thoughts: [
        thought({ id: "t-task", type: "task" }),
        thought({ id: "t-goal", type: "goal" }),
        thought({ id: "t-question", type: "question" }),
        thought({ id: "t-project", type: "project" })
      ]
    });

    expect(buildThoughtProgressionReport(state, "t-task").semanticRole).toBe("task");
    expect(buildThoughtProgressionReport(state, "t-goal").semanticRole).toBe("goal");
    expect(buildThoughtProgressionReport(state, "t-question").semanticRole).toBe("question");
    expect(buildThoughtProgressionReport(state, "t-project").semanticRole).toBe("project_seed");
    expect(codes(buildThoughtProgressionReport(state, "t-project"))).toContain("semantic_role_project_seed");
  });

  it("includes active blockers and dependencies in the report", () => {
    const state = baseState({
      relationships: [
        relationship({
          id: "r-block",
          sourceId: "bq-1",
          sourceType: "blocking_question",
          targetId: "t-1",
          targetType: "thought",
          type: "blocks"
        }),
        relationship({ id: "r-depends", type: "depends_on" })
      ],
      blockingQuestions: [blockingQuestion()]
    });
    const report = buildThoughtProgressionReport(state, "t-1");

    expect(report.relationships.blockers.map((item) => item.relationship.id)).toEqual(["r-block"]);
    expect(report.relationships.dependencies.map((item) => item.relationship.id)).toEqual(["r-depends"]);
    expect(report.relationships.unresolvedBlockingQuestions.map((question) => question.id)).toEqual(["bq-1"]);
    expect(codes(report)).toEqual(expect.arrayContaining(["active_blocker", "active_dependency"]));
  });

  it("carries relationship warnings and does not replace direct universe refs with graph refs", () => {
    const state = baseState({
      thoughts: [thought({ universeId: "u-1" })],
      relationships: [
        relationship({
          id: "r-graph-universe",
          targetId: "u-2",
          targetType: "universe",
          type: "belongs_to"
        })
      ]
    });
    const report = buildThoughtProgressionReport(state, "t-1");

    expect(report.universe).toMatchObject({
      id: "u-1",
      valid: true
    });
    expect(report.relationships.relationshipWarnings.map((finding) => finding.code)).toContain(
      "graph_universe_membership_without_direct_ref"
    );
    expect(codes(report)).toContain("relationship_warning");
  });

  it("computes canPromoteToProject true and false with basic rules", () => {
    const readyProjectSeed = baseState({
      thoughts: [thought({ type: "project" })]
    });
    const blockedProjectSeed = baseState({
      thoughts: [thought({ type: "project", nextAction: "" })]
    });

    expect(buildThoughtProgressionReport(readyProjectSeed, "t-1").canPromoteToProject).toBe(true);
    expect(buildThoughtProgressionReport(readyProjectSeed, "t-1").recommendedNextStage).toBe("promote_link_project");
    expect(buildThoughtProgressionReport(blockedProjectSeed, "t-1").canPromoteToProject).toBe(false);
    expect(codes(buildThoughtProgressionReport(blockedProjectSeed, "t-1"))).toContain("promotion_blocked");
  });

  it("computes canLinkToExistingProject true and false with basic rules", () => {
    const linkable = baseState({
      projects: [project()]
    });
    const alreadyLinked = baseState({
      thoughts: [thought({ projectId: "p-1" })],
      projects: [project({ linkedThoughtIds: ["t-1"] })]
    });

    expect(buildThoughtProgressionReport(linkable, "t-1").canLinkToExistingProject).toBe(true);
    expect(buildThoughtProgressionReport(linkable, "t-1").existingProjectCandidates.map((item) => item.id)).toEqual(["p-1"]);
    expect(buildThoughtProgressionReport(alreadyLinked, "t-1").canLinkToExistingProject).toBe(false);
  });

  it("creates stable suggested command drafts that require human confirmation", () => {
    const report = buildThoughtProgressionReport(baseState({
      thoughts: [thought({
        status: "inbox",
        type: "note",
        universeId: "",
        why: "",
        outcome: "",
        nextAction: ""
      })]
    }), "t-1");

    expect(report.suggestedCommands.map((command) => command.id)).toEqual([
      "thought-progress:t-1:add_next_action",
      "thought-progress:t-1:add_thought_context",
      "thought-progress:t-1:assign_universe",
      "thought-progress:t-1:classify_thought",
      "thought-progress:t-1:review_relationship_blockers"
    ]);
    expect(report.suggestedCommands.every((command) => command.requiresHumanConfirmation)).toBe(true);
    expect(codes(report)).toContain("needs_human_review");
  });

  it("builds deterministic reports for every thought", () => {
    const reports = buildThoughtProgressionReports(baseState({
      thoughts: [
        thought({ id: "t-b" }),
        thought({ id: "t-a" })
      ]
    }));

    expect(reports.map((report) => report.target.id)).toEqual(["t-a", "t-b"]);
  });

  it("does not mutate input state", () => {
    const state = baseState({
      thoughts: [thought({ type: "project", universeId: "missing-universe", nextAction: "" })],
      relationships: [
        relationship({
          id: "r-orphan",
          targetId: "missing-project",
          targetType: "project",
          type: "depends_on"
        })
      ]
    });
    const before = JSON.stringify(state);

    buildThoughtProgressionReport(state, "t-1");

    expect(JSON.stringify(state)).toBe(before);
  });
});
