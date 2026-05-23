import { describe, expect, it } from "vitest";
import { buildAppHealthReport } from "./appHealthReport";
import type {
  AIInsight,
  AppState,
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
  purpose: "Health tests",
  focus: "main",
  status: "active",
  ...patch
});

const thought = (patch: Partial<ThoughtItem> = {}): ThoughtItem => ({
  id: "t-1",
  title: "Thought One",
  content: "Context",
  type: "project",
  status: "active",
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
  readiness: "ready_for_engineering",
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
  type: "project_readiness",
  content: "Draft",
  status: "draft",
  createdAt: timestamp,
  ...patch
});

function baseState(patch: Partial<AppState> = {}): AppState {
  return {
    universes: [universe()],
    thoughts: [thought()],
    projects: [project()],
    relationships: [relationship()],
    aiInsights: [],
    blockingQuestions: [],
    decisionRecords: [],
    ...patch
  };
}

function codes(state: AppState) {
  return buildAppHealthReport(state).findings.map((finding) => finding.code);
}

describe("app health report", () => {
  it("lists orphan relationship endpoints without repairing them", () => {
    const state = baseState({
      relationships: [
        relationship({
          id: "r-orphan",
          sourceId: "missing-thought",
          sourceType: "thought"
        })
      ]
    });
    const before = JSON.stringify(state);
    const report = buildAppHealthReport(state);

    expect(report.findings).toContainEqual(expect.objectContaining({
      code: "orphan_relationship",
      target: { type: "relationship", id: "r-orphan" }
    }));
    expect(JSON.stringify(state)).toBe(before);
  });

  it("lists invalid direct refs for universe project source thought and linked thoughts", () => {
    const report = buildAppHealthReport(baseState({
      thoughts: [
        thought({
          universeId: "missing-universe",
          projectId: "missing-project"
        })
      ],
      projects: [
        project({
          universeId: "missing-universe",
          sourceThoughtId: "missing-source",
          linkedThoughtIds: ["missing-linked-thought"]
        })
      ],
      relationships: []
    }));

    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "invalid_universe_ref", target: { type: "thought", id: "t-1" } }),
      expect.objectContaining({ code: "invalid_project_ref", target: { type: "thought", id: "t-1" } }),
      expect.objectContaining({ code: "invalid_source_thought_id", target: { type: "project", id: "p-1" } }),
      expect.objectContaining({ code: "invalid_linked_thought_id", target: { type: "project", id: "p-1" } })
    ]));
  });

  it("lists direct-ref drift deterministically", () => {
    expect(codes(baseState({
      projects: [project({ linkedThoughtIds: [] })]
    }))).toContain("direct_ref_drift");
  });

  it("lists invalid AI patch targets", () => {
    const report = buildAppHealthReport(baseState({
      aiInsights: [
        aiInsight({
          targetId: "missing-project",
          patch: {
            targetType: "project",
            targetId: "missing-project",
            operations: [
              {
                type: "updateProject",
                projectId: "missing-project",
                patch: { name: "Missing project" }
              }
            ]
          }
        })
      ]
    }));

    expect(report.findings).toContainEqual(expect.objectContaining({
      code: "invalid_ai_patch_target",
      target: { type: "aiInsight", id: "ai-1" }
    }));
  });

  it("lists readiness drift and stale handoff findings", () => {
    const driftCodes = codes(baseState({
      projects: [project({ readiness: "not_ready" })]
    }));
    const staleCodes = codes(baseState({
      projects: [
        project({
          lifecycleStatus: "handoff_ready",
          features: [],
          screens: [],
          dataObjects: [],
          flowSteps: [],
          nextAction: "",
          readiness: "ready_for_engineering"
        })
      ]
    }));

    expect(driftCodes).toContain("readiness_drift");
    expect(staleCodes).toContain("stale_handoff");
  });

  it("lists duplicate ids when detectable by existing invariant helpers", () => {
    expect(codes(baseState({
      universes: [
        universe(),
        universe({ name: "Duplicate universe" })
      ]
    }))).toContain("duplicate_id");
  });

  it("does not mutate the input state", () => {
    const state = baseState({
      projects: [project({ readiness: "not_ready" })],
      relationships: [relationship({ sourceId: "missing-thought", sourceType: "thought" })]
    });
    const before = JSON.parse(JSON.stringify(state));

    buildAppHealthReport(state);

    expect(state).toEqual(before);
  });
});
