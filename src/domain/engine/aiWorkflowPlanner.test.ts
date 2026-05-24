import { describe, expect, it } from "vitest";
import {
  buildAIWorkflowPlan,
  type AIWorkflowPlanDagEdge,
  type AIWorkflowPlanDagNode
} from "./aiWorkflowPlanner";
import type {
  AIInsight,
  AppState,
  BlockingQuestion,
  DecisionRecord,
  Project,
  Relationship,
  ThoughtItem,
  Universe
} from "../types";

const timestamp = "2026-01-01T00:00:00.000Z";

const universe = (patch: Partial<Universe> = {}): Universe => ({
  id: "u-1",
  name: "Universe One",
  description: "Primary universe",
  purpose: "Workflow planner tests",
  focus: "main",
  status: "active",
  ...patch
});

const thought = (patch: Partial<ThoughtItem> = {}): ThoughtItem => ({
  id: "t-1",
  title: "Source Thought",
  content: "A structured product idea.",
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
  name: "Workflow Project",
  intent: "Create a deterministic workflow plan.",
  users: ["builder"],
  features: ["planner"],
  screens: ["Project Detail"],
  dataObjects: ["Project"],
  flowSteps: ["Review", "Generate", "Confirm"],
  unknowns: [],
  nextAction: "Review package.",
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

const blockingQuestion = (patch: Partial<BlockingQuestion> = {}): BlockingQuestion => ({
  id: "bq-1",
  question: "What should block handoff?",
  status: "open",
  impactLevel: "blocking",
  linkedProjectIds: ["p-1"],
  linkedThoughtIds: ["t-1"],
  linkedUniverseIds: ["u-1"],
  createdAt: timestamp,
  updatedAt: timestamp,
  ...patch
});

const decisionRecord = (patch: Partial<DecisionRecord> = {}): DecisionRecord => ({
  id: "d-1",
  title: "Proposed decision",
  decision: "Proposed path.",
  status: "proposed",
  linkedProjectIds: ["p-1"],
  createdAt: timestamp,
  updatedAt: timestamp,
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

function nodeIndex(plan: ReturnType<typeof buildAIWorkflowPlan>, type: string) {
  return plan.dagNodes.findIndex((node) => node.type === type);
}

describe("buildAIWorkflowPlan", () => {
  it("produces project workflow phases from context cleanup to guarded handoff", () => {
    const state = baseState({
      thoughts: [thought({ nextAction: "" })]
    });

    const plan = buildAIWorkflowPlan(state, { type: "project", id: "p-1" });
    const phaseIds = plan.orderedPhases.map((phase) => phase.id);

    expect(phaseIds).toEqual(expect.arrayContaining([
      "context_cleanup",
      "safety_review",
      "handoff_package",
      "guarded_handoff"
    ]));
    expect(nodeIndex(plan, "add_context")).toBeLessThan(nodeIndex(plan, "generate_handoff_package"));
    expect(nodeIndex(plan, "generate_handoff_package")).toBeLessThan(nodeIndex(plan, "mark_handoff_ready"));
    expect(plan.humanConfirmationRequired).toBe(true);
  });

  it("orders blocker and decision resolution before handoff package generation", () => {
    const state = baseState({
      relationships: [
        relationship(),
        relationship({
          id: "r-blocker",
          sourceId: "t-1",
          sourceType: "thought",
          targetId: "p-1",
          targetType: "project",
          type: "blocks",
          description: "Thought blocks project."
        })
      ],
      blockingQuestions: [blockingQuestion()],
      decisionRecords: [decisionRecord()]
    });

    const plan = buildAIWorkflowPlan(state, { type: "project", id: "p-1" });
    const blocker = plan.dagNodes.find((node) => node.type === "resolve_blocker");
    const decision = plan.dagNodes.find((node) => node.type === "resolve_decision");
    const generate = plan.dagNodes.find((node) => node.type === "generate_handoff_package");

    expect(blocker).toBeDefined();
    expect(decision).toBeDefined();
    expect(generate).toBeDefined();
    expect(plan.dagEdges).toContainEqual(expect.objectContaining({
      from: blocker?.id,
      to: generate?.id,
      reason: "readiness_gates_before_handoff_package"
    }));
    expect(plan.dagEdges).toContainEqual(expect.objectContaining({
      from: decision?.id,
      to: generate?.id,
      reason: "readiness_gates_before_handoff_package"
    }));
    expect(plan.blockedNodes.map((node) => node.type)).toEqual(expect.arrayContaining([
      "resolve_blocker",
      "resolve_decision"
    ]));
  });

  it("keeps invalid or metadata-only commands disabled with reasons", () => {
    const state = baseState({
      aiInsights: [
        aiInsight({
          id: "ai-invalid",
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
    });

    const plan = buildAIWorkflowPlan(state, { type: "app" });
    const invalidAiCommand = plan.disabledSuggestedCommands
      .find((command) => command.commandType === "accept_invalid_ai_draft" || command.domainCommand?.type === "aiInsight.review");

    expect(invalidAiCommand).toBeDefined();
    expect(invalidAiCommand?.disabledReason).toContain("AI actors cannot execute canonical mutation commands directly");
    expect(plan.risks.map((risk) => risk.code)).toContain("disabled_suggested_commands_present");
  });

  it("reports DAG cycles supplied by constructed test data without repairing them", () => {
    const cycleNodeA: AIWorkflowPlanDagNode = {
      id: "cycle-a",
      type: "maintenance_review",
      title: "Cycle A",
      summary: "Synthetic cycle node A.",
      target: { type: "project", id: "p-1" },
      phaseId: "safety_review",
      status: "ready",
      reasonCodes: ["synthetic_cycle_a"],
      sourceIds: ["test"],
      commandIds: [],
      evidence: []
    };
    const cycleNodeB: AIWorkflowPlanDagNode = {
      ...cycleNodeA,
      id: "cycle-b",
      title: "Cycle B",
      reasonCodes: ["synthetic_cycle_b"]
    };
    const cycleEdges: AIWorkflowPlanDagEdge[] = [
      { id: "cycle-a-to-b", from: "cycle-a", to: "cycle-b", reason: "synthetic_cycle" },
      { id: "cycle-b-to-a", from: "cycle-b", to: "cycle-a", reason: "synthetic_cycle" }
    ];

    const plan = buildAIWorkflowPlan(baseState(), { type: "project", id: "p-1" }, {
      additionalDagNodes: [cycleNodeA, cycleNodeB],
      additionalDagEdges: cycleEdges
    });

    expect(plan.risks).toContainEqual(expect.objectContaining({
      code: "dag_cycle_detected",
      severity: "warning"
    }));
    expect(plan.dagEdges).toEqual(expect.arrayContaining(cycleEdges));
    expect(plan.blockedNodes.map((node) => node.id)).toEqual(expect.arrayContaining(["cycle-a", "cycle-b"]));
  });

  it("places handoff package generation after readiness gate review", () => {
    const plan = buildAIWorkflowPlan(baseState(), { type: "project", id: "p-1" });
    const gate = plan.dagNodes.find((node) =>
      node.type === "maintenance_review" &&
      node.reasonCodes.includes("handoff_preflight_passed")
    );
    const generate = plan.dagNodes.find((node) => node.type === "generate_handoff_package");

    expect(gate).toBeDefined();
    expect(generate).toBeDefined();
    expect(plan.dagEdges).toContainEqual(expect.objectContaining({
      from: gate?.id,
      to: generate?.id,
      reason: "readiness_gates_before_handoff_package"
    }));
  });

  it("does not mutate AppState or persist workflow plans", () => {
    const state = baseState({
      thoughts: [thought({ id: "t-candidate", projectId: undefined })],
      projects: []
    });
    const before = JSON.parse(JSON.stringify(state));

    buildAIWorkflowPlan(state, { type: "app" });

    expect(state).toEqual(before);
    expect(state).not.toHaveProperty("aiWorkflowPlan");
    expect(state).not.toHaveProperty("workflowPlans");
  });
});
