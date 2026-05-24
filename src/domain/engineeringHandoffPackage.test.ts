import { describe, expect, it } from "vitest";
import { buildEngineeringHandoffPackage } from "./engineeringHandoffPackage";
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
  purpose: "Ship a durable thought-to-project workflow.",
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
  why: "It makes planning clearer.",
  outcome: "A usable engineering handoff.",
  nextAction: "Create the package.",
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
  name: "Thought Handoff Project",
  intent: "Create a deterministic handoff package for engineering.",
  users: ["builder"],
  features: ["handoff package", "review queue", "command guard"],
  screens: ["Project Detail", "Engineering Handoff"],
  dataObjects: ["Project", "ThoughtItem", "EngineeringHandoffPackage"],
  flowSteps: ["Review readiness", "Generate package", "Confirm commands"],
  unknowns: ["Which backend contract comes next?"],
  nextAction: "Review the handoff package.",
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
  description: "Source thought belongs to project.",
  ...patch
});

const aiInsight = (patch: Partial<AIInsight> = {}): AIInsight => ({
  id: "ai-1",
  targetId: "p-1",
  type: "engineering_draft",
  content: "Draft package should stay read-only.",
  status: "accepted",
  createdAt: timestamp,
  ...patch
});

const blockingQuestion = (patch: Partial<BlockingQuestion> = {}): BlockingQuestion => ({
  id: "bq-1",
  question: "What backend contract is next?",
  status: "resolved",
  impactLevel: "medium",
  proposedResolution: "Defer backend contract to Phase 3D.",
  finalResolution: "Phase 3C remains design-only.",
  linkedProjectIds: ["p-1"],
  linkedThoughtIds: ["t-1"],
  linkedUniverseIds: ["u-1"],
  createdAt: timestamp,
  updatedAt: timestamp,
  ...patch
});

const decisionRecord = (patch: Partial<DecisionRecord> = {}): DecisionRecord => ({
  id: "d-1",
  title: "Keep backend design-only",
  decision: "Phase 3C describes backend candidates but does not implement them.",
  status: "accepted",
  linkedProjectIds: ["p-1"],
  linkedUniverseIds: ["u-1"],
  sourceBlockingQuestionId: "bq-1",
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
    aiInsights: [aiInsight()],
    blockingQuestions: [blockingQuestion()],
    decisionRecords: [decisionRecord()],
    ...patch
  };
}

describe("EngineeringHandoffPackage", () => {
  it("returns a deterministic invalid package for a missing project", () => {
    const first = buildEngineeringHandoffPackage(baseState(), "missing");
    const second = buildEngineeringHandoffPackage(baseState(), "missing");

    expect(first).toEqual(second);
    expect(first.valid).toBe(false);
    expect(first.reason).toBe("Project target was not found.");
    expect(first.generatedAt).toBeNull();
    expect(first.readinessReport.target).toEqual({ type: "project", id: "missing", valid: false });
    expect(first.engineeringFlowInput.projectIdentity.id).toBe("missing");
  });

  it("builds every top-level handoff section for a valid project", () => {
    const result = buildEngineeringHandoffPackage(baseState(), "p-1");

    expect(result.valid).toBe(true);
    expect(result.readinessReport.target.valid).toBe(true);
    expect(result.engineeringFlowInput.draftNotice).toContain("does not mark the project handoff_ready");
    expect(result.engineeringFlowInput.universeContext?.id).toBe("u-1");
    expect(result.engineeringFlowInput.sourceThought?.id).toBe("t-1");
    expect(result.engineeringFlowInput.relevantBlockers.map((item) => item.id)).toEqual(["bq-1"]);
    expect(result.engineeringFlowInput.relevantDecisions.map((item) => item.id)).toEqual(["d-1"]);
    expect(result.requiredSoftwarePlan.modules.length).toBeGreaterThanOrEqual(8);
    expect(result.projectEvolutionPlan.suggestedImplementationSequence.length).toBeGreaterThan(0);
    expect(result.constraintCodex.hardConstraints.length).toBeGreaterThan(0);
    expect(result.backendDesignPlan.futureEndpointCandidates.length).toBe(4);
    expect(result.codexTaskPlan.tasks.length).toBeGreaterThan(1);
    expect(result.acceptanceTestPlan.handoffSafetyTests.length).toBeGreaterThan(0);
  });

  it("uses ProjectReadinessReport without deriving handoff_ready from ready_for_engineering", () => {
    const state = baseState();
    const result = buildEngineeringHandoffPackage(state, "p-1");

    expect(result.readinessReport.storedReadiness).toBe("ready_for_engineering");
    expect(result.readinessReport.lifecycleStatus).toBe("planning");
    expect(result.engineeringFlowInput.readinessSummary.storedReadiness).toBe("ready_for_engineering");
    expect(result.safetyNotes).toEqual(expect.arrayContaining([
      "ready_for_engineering does not imply handoff_ready"
    ]));
    expect(state.projects[0].lifecycleStatus).toBe("planning");
  });

  it("keeps generatedAt deterministic by default and uses an explicit timestamp when provided", () => {
    const defaultResult = buildEngineeringHandoffPackage(baseState(), "p-1");
    const datedResult = buildEngineeringHandoffPackage(baseState(), "p-1", {
      generatedAt: "2026-02-03T04:05:06.000Z"
    });

    expect(defaultResult.generatedAt).toBeNull();
    expect(defaultResult.engineeringFlowInput.createdAt).toBeNull();
    expect(datedResult.generatedAt).toBe("2026-02-03T04:05:06.000Z");
    expect(datedResult.engineeringFlowInput.createdAt).toBe("2026-02-03T04:05:06.000Z");
    expect(datedResult.engineeringFlowInput.updatedAt).toBe("2026-02-03T04:05:06.000Z");
  });

  it("creates deterministic software modules with responsibilities dependencies and tests", () => {
    const first = buildEngineeringHandoffPackage(baseState(), "p-1").requiredSoftwarePlan;
    const second = buildEngineeringHandoffPackage(baseState(), "p-1").requiredSoftwarePlan;

    expect(first).toEqual(second);
    expect(first.modules.map((module) => module.id)).toEqual([
      "module-frontend-ui",
      "module-domain-command",
      "module-persistence-snapshot",
      "module-validation-reporting",
      "module-engineering-flow-generator",
      "module-project-evolution-planner",
      "module-constraint-codex",
      "module-backend-design-adapter"
    ]);
    expect(first.modules.every((module) => module.responsibility && module.testingResponsibilities.length > 0)).toBe(true);
    expect(first.modules.some((module) => module.dependencies.length > 0)).toBe(true);
  });

  it("includes required constraint and backend design boundaries", () => {
    const result = buildEngineeringHandoffPackage(baseState(), "p-1");

    expect(result.constraintCodex.hardConstraints).toEqual(expect.arrayContaining([
      "ready_for_engineering does not imply handoff_ready",
      "AI suggestions are drafts only",
      "commands require validation and human confirmation",
      "relationship graph does not replace direct refs"
    ]));
    expect(result.constraintCodex.forbiddenActions).toEqual(expect.arrayContaining([
      "Do not call markProjectHandoffReady.",
      "Do not implement backend command/snapshot contract in Phase 3C."
    ]));
    expect(result.backendDesignPlan.futureEndpointCandidates.map((endpoint) => `${endpoint.method} ${endpoint.path}`)).toEqual([
      "POST /commands",
      "GET /state",
      "PUT /state/import",
      "GET /projects/:id/handoff"
    ]);
    expect(result.backendDesignPlan.explicitlyNotIncludedNow).toEqual(expect.arrayContaining([
      "login",
      "auth",
      "multi-user",
      "permissions",
      "complex sync conflict",
      "realtime collaboration",
      "database normalization migration"
    ]));
  });

  it("builds Codex tasks with stable ids acceptance criteria and guardrails", () => {
    const tasks = buildEngineeringHandoffPackage(baseState(), "p-1").codexTaskPlan.tasks;

    expect(tasks.map((task) => task.id)).toEqual([
      "codex-task-01-handoff-preview",
      "codex-task-02-command-import",
      "codex-task-03-relationship-health-ui",
      "codex-task-04-backend-contract",
      "codex-task-05-acceptance-suite"
    ]);
    expect(tasks.every((task) => task.acceptanceCriteria.length > 0)).toBe(true);
    expect(tasks.every((task) => task.guardrails.includes("Do not change AppState required shape."))).toBe(true);
  });

  it("includes acceptance coverage for handoff command relationship AI and lifecycle safety", () => {
    const plan = buildEngineeringHandoffPackage(baseState(), "p-1").acceptanceTestPlan;

    expect(plan.handoffSafetyTests.join(" ")).toContain("markProjectHandoffReady");
    expect(plan.commandSafetyTests.join(" ")).toContain("metadata only");
    expect(plan.relationshipDirectRefTests.join(" ")).toContain("direct universe/project refs");
    expect(plan.aiDraftLimitationTests.join(" ")).toContain("does not mutate");
    expect(plan.readinessLifecycleSeparationTests.join(" ")).toContain("ready_for_engineering");
  });

  it("keeps suggested commands as human-confirmed metadata only", () => {
    const commands = buildEngineeringHandoffPackage(baseState(), "p-1").suggestedCommands;

    expect(commands.map((command) => command.commandType)).toEqual(expect.arrayContaining([
      "handoffPackage.review",
      "engineeringDraft.generate",
      "project.markHandoffReady"
    ]));
    expect(commands.every((command) => command.requiresHumanConfirmation)).toBe(true);
  });

  it("does not mutate input state or add persisted handoff package state", () => {
    const state = baseState();
    const before = JSON.parse(JSON.stringify(state));

    buildEngineeringHandoffPackage(state, "p-1");

    expect(state).toEqual(before);
    expect("engineeringHandoffPackage" in (state as unknown as Record<string, unknown>)).toBe(false);
  });
});
