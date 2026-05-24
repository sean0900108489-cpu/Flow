import { describe, expect, it } from "vitest";
import {
  buildProjectReadinessReport,
  buildProjectReadinessReports
} from "./projectReadinessReport";
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
  purpose: "Project readiness tests",
  focus: "main",
  status: "active",
  ...patch
});

const project = (patch: Partial<Project> = {}): Project => ({
  id: "p-1",
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
  nextAction: "Ship a small slice.",
  readiness: "ready_for_engineering",
  createdAt: timestamp,
  updatedAt: timestamp,
  ...patch
});

const draftableProject = (patch: Partial<Project> = {}): Project => project({
  flowSteps: [],
  readiness: "draftable",
  ...patch
});

const thought = (patch: Partial<ThoughtItem> = {}): ThoughtItem => ({
  id: "t-1",
  title: "Thought One",
  content: "Context",
  type: "task",
  status: "active",
  universeId: "u-1",
  why: "Why",
  outcome: "Outcome",
  nextAction: "Next",
  projectId: "p-1",
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
  type: "blocks",
  description: "Blocks project.",
  ...patch
});

const blockingQuestion = (patch: Partial<BlockingQuestion> = {}): BlockingQuestion => ({
  id: "bq-1",
  question: "What blocks handoff?",
  status: "open",
  impactLevel: "medium",
  linkedProjectIds: ["p-1"],
  linkedUniverseIds: ["u-1"],
  createdAt: timestamp,
  updatedAt: timestamp,
  ...patch
});

const decisionRecord = (patch: Partial<DecisionRecord> = {}): DecisionRecord => ({
  id: "d-1",
  title: "Decision",
  decision: "Decide a path.",
  status: "proposed",
  linkedProjectIds: ["p-1"],
  linkedUniverseIds: ["u-1"],
  createdAt: timestamp,
  updatedAt: timestamp,
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

function baseState(patch: Partial<AppState> = {}): AppState {
  return {
    universes: [universe()],
    thoughts: [],
    projects: [project()],
    relationships: [],
    aiInsights: [],
    blockingQuestions: [],
    decisionRecords: [],
    ...patch
  };
}

const codes = (report: ReturnType<typeof buildProjectReadinessReport>) =>
  report.findings.map((finding) => finding.code);

describe("project readiness report", () => {
  it("returns a deterministic missing report for a missing project", () => {
    const report = buildProjectReadinessReport(baseState(), "missing-project");

    expect(report.target).toEqual({ type: "project", id: "missing-project", valid: false });
    expect(report.handoffPreflight).toMatchObject({
      projectExists: false,
      passed: false,
      blockedReasonCodes: ["target_missing"]
    });
    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "target_missing", severity: "error" })
    ]));
    expect(report.suggestedCommands).toEqual([]);
  });

  it("presents stored readiness computed readiness and effective stage", () => {
    const report = buildProjectReadinessReport(baseState(), "p-1");

    expect(report.storedReadiness).toBe("ready_for_engineering");
    expect(report.computedReadiness).toMatchObject({
      value: "ready_for_engineering",
      score: 100,
      missing: []
    });
    expect(report.readinessDrift).toMatchObject({
      storedReadiness: "ready_for_engineering",
      computedReadiness: "ready_for_engineering",
      hasDrift: false
    });
    expect(report.effectiveStage).toMatchObject({
      stage: "ready_for_engineering",
      source: "computed_readiness"
    });
  });

  it("detects readiness drift deterministically", () => {
    const report = buildProjectReadinessReport(baseState({
      projects: [project({ readiness: "not_ready" })]
    }), "p-1");

    expect(report.readinessDrift).toMatchObject({
      storedReadiness: "not_ready",
      computedReadiness: "ready_for_engineering",
      hasDrift: true
    });
    expect(codes(report)).toContain("readiness_drift");
    expect(report.suggestedCommands.map((command) => command.commandType)).toContain(
      "recompute_update_stored_readiness"
    );
  });

  it("reports missing stored readiness without using it as lifecycle state", () => {
    const report = buildProjectReadinessReport(baseState({
      projects: [project({ readiness: undefined as never })]
    }), "p-1");

    expect(report.storedReadiness).toBeUndefined();
    expect(report.computedReadiness?.value).toBe("ready_for_engineering");
    expect(codes(report)).toEqual(expect.arrayContaining([
      "stored_readiness_missing",
      "readiness_drift"
    ]));
    expect(report.lifecycleStatus).toBe("planning");
  });

  it("does not auto-derive handoff_ready from ready_for_engineering readiness", () => {
    const report = buildProjectReadinessReport(baseState(), "p-1");

    expect(report.lifecycleStatus).toBe("planning");
    expect(report.effectiveStage).toMatchObject({
      stage: "ready_for_engineering",
      source: "computed_readiness"
    });
    expect(codes(report)).not.toContain("lifecycle_handoff_ready");
    expect(report.canMarkHandoffReady).toBe(true);
  });

  it("reflects handoff_ready only from lifecycleStatus and reports stale handoff", () => {
    const report = buildProjectReadinessReport(baseState({
      projects: [project({ lifecycleStatus: "handoff_ready", nextAction: "", readiness: "ready_for_engineering" })]
    }), "p-1");

    expect(report.lifecycleStatus).toBe("handoff_ready");
    expect(report.effectiveStage).toMatchObject({
      stage: "handoff_ready",
      source: "project.lifecycleStatus"
    });
    expect(report.staleHandoff).toBe(true);
    expect(codes(report)).toEqual(expect.arrayContaining([
      "lifecycle_handoff_ready",
      "lifecycle_drift",
      "stale_handoff"
    ]));
  });

  it("blocks handoff on active blockers", () => {
    const report = buildProjectReadinessReport(baseState({
      thoughts: [thought()],
      relationships: [relationship()]
    }), "p-1");

    expect(report.activeBlockers.map((blocker) => blocker.id)).toEqual(["r-1"]);
    expect(report.canMarkHandoffReady).toBe(false);
    expect(report.handoffPreflight.blockedReasonCodes).toContain("active_blocker");
    expect(codes(report)).toContain("active_blocker");
  });

  it("blocks handoff on open and in-review blocking questions", () => {
    const report = buildProjectReadinessReport(baseState({
      blockingQuestions: [
        blockingQuestion({ id: "bq-open", status: "open" }),
        blockingQuestion({ id: "bq-review", status: "in_review" })
      ]
    }), "p-1");

    expect(report.blockingQuestions.open.map((question) => question.id)).toEqual(["bq-open"]);
    expect(report.blockingQuestions.inReview.map((question) => question.id)).toEqual(["bq-review"]);
    expect(report.canMarkHandoffReady).toBe(false);
    expect(codes(report)).toEqual(expect.arrayContaining([
      "open_blocking_question",
      "in_review_blocking_question"
    ]));
  });

  it("blocks handoff on proposed decisions", () => {
    const report = buildProjectReadinessReport(baseState({
      decisionRecords: [decisionRecord()]
    }), "p-1");

    expect(report.proposedDecisions.map((record) => record.id)).toEqual(["d-1"]);
    expect(report.canMarkHandoffReady).toBe(false);
    expect(codes(report)).toContain("proposed_decision");
  });

  it("blocks handoff on pending AI drafts", () => {
    const report = buildProjectReadinessReport(baseState({
      aiInsights: [aiInsight()]
    }), "p-1");

    expect(report.pendingAiDrafts.map((insight) => insight.id)).toEqual(["ai-1"]);
    expect(report.canMarkHandoffReady).toBe(false);
    expect(codes(report)).toContain("pending_ai_draft");
  });

  it("includes relationship warnings from RelationshipContext", () => {
    const report = buildProjectReadinessReport(baseState({
      relationships: [
        relationship({
          id: "r-orphan",
          sourceId: "missing-source",
          sourceType: "thought"
        })
      ]
    }), "p-1");

    expect(report.relationshipHealth.warnings.map((finding) => finding.code)).toContain(
      "orphan_relationship_endpoint"
    );
    expect(codes(report)).toContain("relationship_warning");
  });

  it("includes invalid direct refs and blocks handoff", () => {
    const report = buildProjectReadinessReport(baseState({
      projects: [project({ universeId: "missing-universe" })]
    }), "p-1");

    expect(report.directRefHealth?.invalidRefs.map((finding) => finding.code)).toContain(
      "invalid_project_universe_id"
    );
    expect(report.canMarkHandoffReady).toBe(false);
    expect(codes(report)).toEqual(expect.arrayContaining([
      "direct_ref_warning",
      "relationship_warning"
    ]));
  });

  it("separates draft generation from handoff readiness", () => {
    const report = buildProjectReadinessReport(baseState({
      projects: [draftableProject()]
    }), "p-1");

    expect(report.computedReadiness?.value).toBe("draftable");
    expect(report.canGenerateEngineeringDraft).toBe(true);
    expect(report.canMarkHandoffReady).toBe(false);
    expect(codes(report)).toContain("engineering_draft_candidate");
    expect(codes(report)).toContain("handoff_preflight_blocked");
  });

  it("reports handoff preflight passed and handoff candidate for clean ready projects", () => {
    const report = buildProjectReadinessReport(baseState(), "p-1");

    expect(report.handoffPreflight).toMatchObject({
      passed: true,
      canGenerateEngineeringDraft: true,
      canMarkHandoffReady: true,
      blockedReasonCodes: []
    });
    expect(codes(report)).toEqual(expect.arrayContaining([
      "handoff_preflight_passed",
      "handoff_candidate"
    ]));
  });

  it("generates stable command metadata requiring human confirmation", () => {
    const report = buildProjectReadinessReport(baseState({
      projects: [project({ readiness: "not_ready" })]
    }), "p-1");

    expect(report.suggestedCommands.map((command) => command.id)).toEqual([
      "project-readiness:p-1:generate_engineering_draft",
      "project-readiness:p-1:mark_project_handoff_ready",
      "project-readiness:p-1:recompute_update_stored_readiness"
    ]);
    expect(report.suggestedCommands.every((command) => command.requiresHumanConfirmation)).toBe(true);
    expect(codes(report)).toContain("needs_human_review");
  });

  it("returns reports in deterministic project id order", () => {
    const reports = buildProjectReadinessReports(baseState({
      projects: [
        project({ id: "p-b" }),
        project({ id: "p-a" })
      ]
    }));

    expect(reports.map((report) => report.target.id)).toEqual(["p-a", "p-b"]);
  });

  it("does not mutate input state", () => {
    const state = baseState({
      projects: [project({ readiness: "not_ready" })],
      aiInsights: [aiInsight()]
    });
    const before = JSON.stringify(state);

    buildProjectReadinessReport(state, "p-1");

    expect(JSON.stringify(state)).toBe(before);
  });
});
