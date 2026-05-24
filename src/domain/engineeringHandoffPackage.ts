import { buildAIPlanningContext } from "./aiPlanningContext";
import { buildDomainIndex } from "./domainIndex";
import {
  buildProjectReadinessReport,
  type ProjectReadinessReport
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

export interface EngineeringHandoffPackageOptions {
  generatedAt?: string | null;
}

export interface EngineeringEntitySummary {
  id: string;
  title: string;
  status?: string;
  type?: string;
  summary: string;
}

export interface EngineeringRelationshipSummary {
  id: string;
  type: Relationship["type"];
  source: {
    id: string;
    type?: string;
  };
  target: {
    id: string;
    type?: string;
  };
  description: string;
}

export interface EngineeringFlowInput {
  schemaVersion: "engineering-flow-input/v0";
  id: string;
  projectName: string;
  projectIntent: string;
  sourceType: "todo-thought-universe-handoff-package";
  createdAt: string | null;
  updatedAt: string | null;
  draftNotice: string;
  projectIdentity: {
    id: string;
    name: string;
    intent: string;
    status?: string;
    lifecycleStatus?: string;
    readiness?: string;
    nextAction: string;
  };
  universeContext: EngineeringEntitySummary | null;
  sourceThought: EngineeringEntitySummary | null;
  linkedThoughts: EngineeringEntitySummary[];
  relevantBlockers: EngineeringEntitySummary[];
  relevantDecisions: EngineeringEntitySummary[];
  aiInsights: EngineeringEntitySummary[];
  relationships: EngineeringRelationshipSummary[];
  readinessSummary: {
    storedReadiness?: string;
    computedReadiness?: string;
    effectiveStage?: string;
    canGenerateEngineeringDraft: boolean;
    canMarkHandoffReady: boolean;
    findingCodes: string[];
  };
  relationshipHealthSummary: {
    graphRelationshipIds: string[];
    warningCodes: string[];
    invalidDirectRefCodes: string[];
  };
  constraints: string[];
  assumptions: string[];
  userTypes: Array<{
    id: string;
    name: string;
    goal: string;
    description: string;
  }>;
  mainScreens: Array<{
    id: string;
    name: string;
    purpose: string;
    keyActions: string[];
  }>;
  coreFunctions: Array<{
    id: string;
    name: string;
    description: string;
    priority: "must_have" | "should_have";
    relatedScreenIds: string[];
    relatedDataObjectIds: string[];
  }>;
  flowSteps: Array<{
    id: string;
    step: number;
    title: string;
    description: string;
    relatedScreenId: string;
    relatedFunctionIds: string[];
  }>;
  dataObjects: Array<{
    id: string;
    name: string;
    description: string;
  }>;
  aiRoles: Array<{
    id: string;
    task: string;
    requiresHumanConfirmation: boolean;
    relatedScreenIds: string[];
    relatedFunctionIds: string[];
  }>;
  unknowns: Array<{
    id: string;
    question: string;
    blocksGeneration: boolean;
  }>;
}

export type EngineeringRiskLevel = "low" | "medium" | "high";

export interface RequiredSoftwareModule {
  id: string;
  name: string;
  responsibility: string;
  dependencies: string[];
  dataStateOwnershipNotes: string[];
  commandApiTouchpoints: string[];
  uiTouchpoints: string[];
  testingResponsibilities: string[];
  riskLevel: EngineeringRiskLevel;
  uncertainty: string;
}

export interface RequiredSoftwarePlan {
  summary: string;
  modules: RequiredSoftwareModule[];
}

export interface ProjectEvolutionPlan {
  currentMaturity: string;
  nextMilestones: string[];
  unresolvedQuestions: string[];
  decisionsNeeded: string[];
  migrationRisks: string[];
  suggestedImplementationSequence: string[];
  rollbackSafetyNotes: string[];
}

export interface ConstraintCodex {
  hardConstraints: string[];
  softConstraints: string[];
  forbiddenActions: string[];
  safetyRules: string[];
  schemaConstraints: string[];
  aiLimitations: string[];
  handoffLimitations: string[];
  localFirstConstraints: string[];
}

export interface BackendDesignPlan {
  localFirstAssumption: string;
  futureEndpointCandidates: Array<{
    method: "GET" | "POST" | "PUT";
    path: string;
    purpose: string;
  }>;
  explicitlyNotIncludedNow: string[];
  snapshotCommandContractNotes: string[];
  risks: string[];
  openQuestions: string[];
}

export interface CodexTask {
  id: string;
  title: string;
  objective: string;
  likelyTouchedFilesOrAreas: string[];
  dependencies: string[];
  acceptanceCriteria: string[];
  guardrails: string[];
  requiresHumanConfirmation: boolean;
}

export interface CodexTaskPlan {
  tasks: CodexTask[];
}

export interface AcceptanceTestPlan {
  unitTests: string[];
  integrationTests: string[];
  regressionTests: string[];
  handoffSafetyTests: string[];
  commandSafetyTests: string[];
  relationshipDirectRefTests: string[];
  aiDraftLimitationTests: string[];
  readinessLifecycleSeparationTests: string[];
}

export interface EngineeringHandoffSuggestedCommandDraft {
  id: string;
  commandType: string;
  label: string;
  reason: string;
  target: {
    type: "project";
    id: string;
  };
  requiresHumanConfirmation: true;
  payloadPreview?: unknown;
}

export interface EngineeringHandoffBlocker {
  id: string;
  source: string;
  severity: string;
  reason: string;
  evidenceIds: string[];
}

export interface EngineeringHandoffPackage {
  projectId: string;
  valid: boolean;
  generatedAt: string | null;
  reason?: string;
  readinessReport: ProjectReadinessReport;
  engineeringFlowInput: EngineeringFlowInput;
  requiredSoftwarePlan: RequiredSoftwarePlan;
  projectEvolutionPlan: ProjectEvolutionPlan;
  constraintCodex: ConstraintCodex;
  backendDesignPlan: BackendDesignPlan;
  codexTaskPlan: CodexTaskPlan;
  acceptanceTestPlan: AcceptanceTestPlan;
  safetyNotes: string[];
  blockers: EngineeringHandoffBlocker[];
  suggestedCommands: EngineeringHandoffSuggestedCommandDraft[];
}

const draftNotice = "This is a draft engineering input. It does not mark the project handoff_ready.";

function clean(value: string | undefined) {
  return value?.trim() ?? "";
}

function uniqueSorted(values: Iterable<string | undefined>) {
  return [...new Set([...values].filter((value): value is string => Boolean(value)))]
    .sort((a, b) => a.localeCompare(b));
}

function sortById<T extends { id: string }>(items: readonly T[]) {
  return [...items].sort((a, b) => a.id.localeCompare(b.id));
}

function intersects(ids: readonly string[] | undefined, relevantIds: Set<string>) {
  return (ids ?? []).some((id) => relevantIds.has(id));
}

function thoughtSummary(thought: Readonly<ThoughtItem>): EngineeringEntitySummary {
  return {
    id: thought.id,
    title: thought.title,
    status: thought.status,
    type: thought.type,
    summary: clean(thought.outcome) || clean(thought.content) || clean(thought.nextAction)
  };
}

function projectUniverseSummary(universe: Readonly<Universe> | undefined): EngineeringEntitySummary | null {
  if (!universe) return null;

  return {
    id: universe.id,
    title: universe.name,
    status: universe.status,
    type: "universe",
    summary: clean(universe.purpose) || clean(universe.description)
  };
}

function blockingQuestionSummary(question: Readonly<BlockingQuestion>): EngineeringEntitySummary {
  return {
    id: question.id,
    title: question.question,
    status: question.status,
    type: question.impactLevel,
    summary: clean(question.finalResolution) ||
      clean(question.proposedResolution) ||
      clean(question.context)
  };
}

function decisionSummary(decision: Readonly<DecisionRecord>): EngineeringEntitySummary {
  return {
    id: decision.id,
    title: decision.title,
    status: decision.status,
    type: "decision",
    summary: clean(decision.decision) || clean(decision.rationale)
  };
}

function insightSummary(insight: Readonly<AIInsight>): EngineeringEntitySummary {
  return {
    id: insight.id,
    title: insight.type,
    status: insight.status,
    type: "aiInsight",
    summary: clean(insight.content)
  };
}

function relatedThoughtIds(state: AppState, project: Readonly<Project>, report: ProjectReadinessReport) {
  const graphThoughtIds = (report.relationshipContext?.graphRelationships ?? []).flatMap((relationship) => [
    relationship.source.resolvedType === "thought" ? relationship.source.id : undefined,
    relationship.target.resolvedType === "thought" ? relationship.target.id : undefined
  ]);
  const directThoughtIds = state.thoughts
    .filter((thought) => thought.projectId === project.id)
    .map((thought) => thought.id);

  return uniqueSorted([
    project.sourceThoughtId,
    ...(project.linkedThoughtIds ?? []),
    ...directThoughtIds,
    ...graphThoughtIds
  ]);
}

function relationshipSummaries(report: ProjectReadinessReport): EngineeringRelationshipSummary[] {
  const byId = new Map<string, EngineeringRelationshipSummary>();

  for (const graphRelationship of report.relationshipContext?.graphRelationships ?? []) {
    const relationship = graphRelationship.relationship;

    byId.set(relationship.id, {
      id: relationship.id,
      type: relationship.type,
      source: {
        id: relationship.sourceId,
        type: relationship.sourceType ?? graphRelationship.source.resolvedType
      },
      target: {
        id: relationship.targetId,
        type: relationship.targetType ?? graphRelationship.target.resolvedType
      },
      description: relationship.description
    });
  }

  return sortById([...byId.values()]);
}

function relevantBlockingQuestions(
  state: AppState,
  project: Readonly<Project> | undefined,
  thoughtIds: readonly string[]
) {
  if (!project) return [];

  const relevantIds = new Set([project.id, project.universeId, ...thoughtIds]);

  return sortById(state.blockingQuestions ?? [])
    .filter((question) =>
      intersects(question.linkedProjectIds, relevantIds) ||
      intersects(question.linkedThoughtIds, relevantIds) ||
      intersects(question.linkedUniverseIds, relevantIds)
    );
}

function relevantDecisions(
  state: AppState,
  project: Readonly<Project> | undefined,
  thoughtIds: readonly string[]
) {
  if (!project) return [];

  const relevantIds = new Set([project.id, project.universeId, ...thoughtIds]);

  return sortById(state.decisionRecords ?? [])
    .filter((decision) =>
      intersects(decision.linkedProjectIds, relevantIds) ||
      intersects(decision.linkedThoughtIds, relevantIds) ||
      intersects(decision.linkedUniverseIds, relevantIds) ||
      Boolean(decision.sourceBlockingQuestionId && relevantIds.has(decision.sourceBlockingQuestionId))
    );
}

function relevantAiInsights(
  state: AppState,
  project: Readonly<Project> | undefined,
  thoughtIds: readonly string[]
) {
  if (!project) return [];

  const relevantIds = new Set([project.id, ...thoughtIds]);

  return sortById(state.aiInsights)
    .filter((insight) => relevantIds.has(insight.targetId));
}

function buildEngineeringFlowInput(
  state: AppState,
  project: Readonly<Project> | undefined,
  readinessReport: ProjectReadinessReport,
  generatedAt: string | null
): EngineeringFlowInput {
  const index = buildDomainIndex(state);
  const thoughtIds = project ? relatedThoughtIds(state, project, readinessReport) : [];
  const thoughts = thoughtIds
    .map((id) => index.thoughtById[id])
    .filter((thought): thought is Readonly<ThoughtItem> => Boolean(thought));
  const sourceThought = project?.sourceThoughtId ? index.thoughtById[project.sourceThoughtId] : undefined;
  const universe = project?.universeId ? index.universeById[project.universeId] : undefined;
  const blockers = relevantBlockingQuestions(state, project, thoughtIds);
  const decisions = relevantDecisions(state, project, thoughtIds);
  const aiInsights = relevantAiInsights(state, project, thoughtIds);
  const projectName = project?.name ?? "";
  const projectIntent = project?.intent ?? "";

  return {
    schemaVersion: "engineering-flow-input/v0",
    id: `input-${readinessReport.target.id}`,
    projectName,
    projectIntent,
    sourceType: "todo-thought-universe-handoff-package",
    createdAt: generatedAt,
    updatedAt: generatedAt,
    draftNotice,
    projectIdentity: {
      id: readinessReport.target.id,
      name: projectName,
      intent: projectIntent,
      status: project?.status,
      lifecycleStatus: readinessReport.lifecycleStatus,
      readiness: readinessReport.storedReadiness,
      nextAction: project?.nextAction ?? ""
    },
    universeContext: projectUniverseSummary(universe),
    sourceThought: sourceThought ? thoughtSummary(sourceThought) : null,
    linkedThoughts: thoughts.map(thoughtSummary),
    relevantBlockers: blockers.map(blockingQuestionSummary),
    relevantDecisions: decisions.map(decisionSummary),
    aiInsights: aiInsights.map(insightSummary),
    relationships: relationshipSummaries(readinessReport),
    readinessSummary: {
      storedReadiness: readinessReport.storedReadiness,
      computedReadiness: readinessReport.computedReadiness?.value,
      effectiveStage: readinessReport.effectiveStage?.stage,
      canGenerateEngineeringDraft: readinessReport.canGenerateEngineeringDraft,
      canMarkHandoffReady: readinessReport.canMarkHandoffReady,
      findingCodes: uniqueSorted(readinessReport.findings.map((finding) => finding.code))
    },
    relationshipHealthSummary: {
      graphRelationshipIds: uniqueSorted(
        (readinessReport.relationshipContext?.graphRelationships ?? [])
          .map((relationship) => relationship.relationship.id)
      ),
      warningCodes: uniqueSorted(readinessReport.relationshipHealth.warnings.map((finding) => finding.code)),
      invalidDirectRefCodes: uniqueSorted(readinessReport.directRefHealth?.invalidRefs.map((finding) => finding.code) ?? [])
    },
    constraints: [
      "ready_for_engineering does not imply handoff_ready",
      "AI suggestions are drafts only",
      "commands require validation and human confirmation",
      "relationship graph does not replace direct refs"
    ],
    assumptions: [
      "Package is generated from current local AppState only.",
      "Missing or invalid direct refs are surfaced but not repaired.",
      "Backend endpoints listed in this package are design candidates, not implemented routes."
    ],
    userTypes: (project?.users ?? []).map((name, indexNumber) => ({
      id: `user-${indexNumber + 1}`,
      name,
      goal: `Use ${projectName || "this project"} to reach the project goal.`,
      description: universe ? `Universe: ${universe.name}` : ""
    })),
    mainScreens: (project?.screens ?? []).map((name, indexNumber) => ({
      id: `screen-${indexNumber + 1}`,
      name,
      purpose: `${projectName || "Project"} screen: ${name}`,
      keyActions: []
    })),
    coreFunctions: (project?.features ?? []).map((name, indexNumber) => ({
      id: `feature-${indexNumber + 1}`,
      name,
      description: `${projectName || "Project"} feature: ${name}`,
      priority: indexNumber < 5 ? "must_have" : "should_have",
      relatedScreenIds: [],
      relatedDataObjectIds: []
    })),
    flowSteps: (project?.flowSteps ?? []).map((title, indexNumber) => ({
      id: `flow-${indexNumber + 1}`,
      step: indexNumber + 1,
      title,
      description: title,
      relatedScreenId: "",
      relatedFunctionIds: []
    })),
    dataObjects: (project?.dataObjects ?? []).map((name, indexNumber) => ({
      id: `data-${indexNumber + 1}`,
      name,
      description: `${projectName || "Project"} data object: ${name}`
    })),
    aiRoles: [
      {
        id: "ai-classification-suggestion",
        task: "Classification suggestion",
        requiresHumanConfirmation: true,
        relatedScreenIds: [],
        relatedFunctionIds: []
      },
      {
        id: "ai-next-step-suggestion",
        task: "Next step suggestion",
        requiresHumanConfirmation: true,
        relatedScreenIds: [],
        relatedFunctionIds: []
      },
      {
        id: "ai-engineering-input-draft",
        task: "Engineering input draft generation",
        requiresHumanConfirmation: true,
        relatedScreenIds: [],
        relatedFunctionIds: []
      }
    ],
    unknowns: (project?.unknowns ?? []).map((question, indexNumber) => ({
      id: `unknown-${indexNumber + 1}`,
      question,
      blocksGeneration: false
    }))
  };
}

function riskForReport(report: ProjectReadinessReport): EngineeringRiskLevel {
  if (!report.target.valid) return "high";
  if (report.handoffPreflight.blockedReasonCodes.length > 0) return "high";
  if (report.computedReadiness?.value === "ready_for_engineering") return "low";
  if (report.canGenerateEngineeringDraft) return "medium";

  return "high";
}

function moduleRisk(report: ProjectReadinessReport, fallback: EngineeringRiskLevel = "medium") {
  const packageRisk = riskForReport(report);
  if (packageRisk === "high") return "high";

  return fallback;
}

function buildRequiredSoftwarePlan(
  project: Readonly<Project> | undefined,
  report: ProjectReadinessReport
): RequiredSoftwarePlan {
  const projectName = project?.name || report.target.id;
  const screenTouchpoints = project?.screens.length ? project.screens : ["Project Detail", "Engineering Handoff Center"];
  const commandTouchpoints = [
    "executeDomainCommand",
    "project.updateReadiness",
    "project.markHandoffReady",
    "relationship.create/update/delete"
  ];

  return {
    summary: `${projectName} needs frontend, domain, validation, persistence, handoff generation, and backend adapter modules before engineering execution.`,
    modules: [
      {
        id: "module-frontend-ui",
        name: "Frontend UI module",
        responsibility: "Render project, review, relationship, and handoff workflows for human confirmation.",
        dependencies: ["module-domain-command", "module-validation-reporting"],
        dataStateOwnershipNotes: ["Reads AppState views; does not own canonical mutation rules."],
        commandApiTouchpoints: commandTouchpoints,
        uiTouchpoints: screenTouchpoints,
        testingResponsibilities: ["Component rendering", "handoff review controls", "disabled unsafe actions"],
        riskLevel: moduleRisk(report),
        uncertainty: project?.screens.length ? "Screen list is project-provided." : "Screen list is inferred from handoff workflow."
      },
      {
        id: "module-domain-command",
        name: "Domain command module",
        responsibility: "Validate and route human-confirmed commands through existing mutation owners.",
        dependencies: ["module-validation-reporting"],
        dataStateOwnershipNotes: ["Owns command result boundaries; does not persist suggested drafts."],
        commandApiTouchpoints: commandTouchpoints,
        uiTouchpoints: ["Review Queue", "AI Planning Panel"],
        testingResponsibilities: ["confirmation guards", "atomic failures", "direct ref versus graph boundaries"],
        riskLevel: moduleRisk(report, "low"),
        uncertainty: "Current command layer is local; backend contract is a later phase."
      },
      {
        id: "module-persistence-snapshot",
        name: "Persistence and snapshot module",
        responsibility: "Keep local workspace snapshots importable, exportable, and invariant-checked.",
        dependencies: ["module-validation-reporting"],
        dataStateOwnershipNotes: ["Owns local AppState serialization, not schema migration in this phase."],
        commandApiTouchpoints: ["GET /state", "PUT /state/import"],
        uiTouchpoints: ["Workspace / Export"],
        testingResponsibilities: ["snapshot round trip", "import warnings", "generated artifact exclusion"],
        riskLevel: "medium",
        uncertainty: "Backend storage remains a design candidate."
      },
      {
        id: "module-validation-reporting",
        name: "Validation and reporting module",
        responsibility: "Surface deterministic health, readiness, relationship, and review findings.",
        dependencies: [],
        dataStateOwnershipNotes: ["Read-only reports; no repair or normalization side effects."],
        commandApiTouchpoints: ["AppHealthReport", "ProjectReadinessReport", "AIPlanningContext"],
        uiTouchpoints: ["Review Queue", "Project Detail", "Engineering Handoff Center"],
        testingResponsibilities: ["non-mutation", "stable ordering", "relationship drift visibility"],
        riskLevel: moduleRisk(report, "low"),
        uncertainty: "Findings are deterministic but UI prioritization may evolve."
      },
      {
        id: "module-engineering-flow-generator",
        name: "Engineering flow generator",
        responsibility: "Create EngineeringFlowInput drafts and handoff packages without changing lifecycle state.",
        dependencies: ["module-validation-reporting", "module-constraint-codex"],
        dataStateOwnershipNotes: ["Reads project context; never marks handoff_ready."],
        commandApiTouchpoints: ["GET /projects/:id/handoff"],
        uiTouchpoints: ["Export / Engineering Handoff"],
        testingResponsibilities: ["deterministic generatedAt", "draft notice", "missing project invalid package"],
        riskLevel: moduleRisk(report),
        uncertainty: "Exact downstream EngineeringFlowInput consumer may add fields later."
      },
      {
        id: "module-project-evolution-planner",
        name: "Project evolution planner",
        responsibility: "Convert readiness, blockers, decisions, and unknowns into sequenced implementation milestones.",
        dependencies: ["module-validation-reporting"],
        dataStateOwnershipNotes: ["Produces planning metadata only."],
        commandApiTouchpoints: ["AIPlanningContext", "DerivedReviewQueue"],
        uiTouchpoints: ["AI Planning Panel", "Project Detail"],
        testingResponsibilities: ["milestone stability", "unresolved question visibility"],
        riskLevel: moduleRisk(report),
        uncertainty: "Milestones are heuristics from project context, not external AI output."
      },
      {
        id: "module-constraint-codex",
        name: "Constraint limiter and codex",
        responsibility: "Carry hard safety rules into engineering and Codex task planning.",
        dependencies: [],
        dataStateOwnershipNotes: ["Policy metadata only; no runtime state ownership."],
        commandApiTouchpoints: ["allowed command schema", "command safety rules"],
        uiTouchpoints: ["Engineering Handoff Center", "AI Interop"],
        testingResponsibilities: ["forbidden action coverage", "AI draft limitation coverage"],
        riskLevel: "low",
        uncertainty: "Future backend policies may add auth and permission constraints."
      },
      {
        id: "module-backend-design-adapter",
        name: "Backend design adapter",
        responsibility: "Describe future command and snapshot endpoints while preserving local-first behavior now.",
        dependencies: ["module-domain-command", "module-persistence-snapshot"],
        dataStateOwnershipNotes: ["No backend ownership in Phase 3C; this is design-only."],
        commandApiTouchpoints: ["POST /commands", "GET /state", "PUT /state/import", "GET /projects/:id/handoff"],
        uiTouchpoints: ["AI Interop", "Workspace / Export"],
        testingResponsibilities: ["contract placeholder tests in later phase"],
        riskLevel: "medium",
        uncertainty: "Backend command/snapshot contract is explicitly deferred to Phase 3D."
      }
    ]
  };
}

function buildProjectEvolutionPlan(
  project: Readonly<Project> | undefined,
  report: ProjectReadinessReport,
  flowInput: EngineeringFlowInput
): ProjectEvolutionPlan {
  const unresolvedQuestions = uniqueSorted([
    ...(project?.unknowns ?? []),
    ...flowInput.relevantBlockers
      .filter((blocker) => blocker.status === "open" || blocker.status === "in_review")
      .map((blocker) => blocker.title)
  ]);
  const decisionsNeeded = uniqueSorted([
    ...flowInput.relevantDecisions
      .filter((decision) => decision.status === "proposed")
      .map((decision) => decision.title),
    ...report.proposedDecisions.map((decision) => decision.title)
  ]);

  return {
    currentMaturity: report.effectiveStage?.stage ??
      report.computedReadiness?.value ??
      "missing_project",
    nextMilestones: uniqueSorted([
      "Review deterministic handoff package",
      report.canGenerateEngineeringDraft ? "Generate engineering draft" : "Fill missing readiness inputs",
      report.handoffPreflight.passed ? "Ask user to confirm handoff-ready transition" : "Resolve handoff blockers",
      "Split implementation into Codex-sized tasks",
      "Verify command and relationship safety before mutation work"
    ]),
    unresolvedQuestions,
    decisionsNeeded,
    migrationRisks: [
      "Do not add persisted TodoItem/todos without a schema migration.",
      "Do not replace direct universe/project refs with relationship graph edges.",
      "Do not infer handoff_ready from computed readiness.",
      "Backend persistence remains out of scope for this phase."
    ],
    suggestedImplementationSequence: [
      "Lock handoff package shape with unit tests.",
      "Wire read-only preview UI to the package once domain tests are stable.",
      "Use CodexTaskPlan tasks as separate implementation prompts.",
      "Add backend command/snapshot contract in Phase 3D before remote execution.",
      "Only mark handoff_ready through guarded command flow after human confirmation."
    ],
    rollbackSafetyNotes: [
      "The package is read-only and can be removed without changing AppState shape.",
      "If a generated plan is wrong, discard the package and rebuild from current state.",
      "Do not use suggested command drafts as executable input without Command Layer validation."
    ]
  };
}

function buildConstraintCodex(planningContextSafetyRules: readonly string[]): ConstraintCodex {
  return {
    hardConstraints: [
      "ready_for_engineering does not imply handoff_ready",
      "AI suggestions are drafts only",
      "commands require validation and human confirmation",
      "relationship graph does not replace direct refs",
      "EngineeringHandoffPackage is read-only and deterministic",
      "Local AppState required shape must not change in this phase"
    ],
    softConstraints: [
      "Prefer small, reviewable Codex tasks.",
      "Keep output bounded and deterministic.",
      "Reuse existing domain reports before adding new heuristics."
    ],
    forbiddenActions: [
      "Do not call markProjectHandoffReady.",
      "Do not execute DomainCommand drafts.",
      "Do not mutate AppState.",
      "Do not repair invalid refs.",
      "Do not implement backend command/snapshot contract in Phase 3C.",
      "Do not add login, auth, multi-user, permissions, realtime collaboration, or database normalization migration."
    ],
    safetyRules: uniqueSorted([
      ...planningContextSafetyRules,
      "ready_for_engineering does not imply handoff_ready",
      "AI suggestions are drafts only",
      "commands require validation and human confirmation",
      "relationship graph does not replace direct refs"
    ]),
    schemaConstraints: [
      "Do not change AppState required shape.",
      "Do not add persisted ReviewItem state.",
      "Do not add persisted TodoItem/todos state.",
      "Use direct Thought.universeId and Project.universeId as canonical membership refs.",
      "Suggested command metadata is not an executable schema."
    ],
    aiLimitations: [
      "AI can draft plans and command metadata only.",
      "AI cannot execute commands or call mutation owners.",
      "AI output requires user review before any state-changing command."
    ],
    handoffLimitations: [
      "This package does not mark the project handoff_ready.",
      "This package does not prove backend readiness.",
      "This package does not guarantee blockers are resolved.",
      "This package is a deterministic draft from current local state."
    ],
    localFirstConstraints: [
      "Current state source is local AppState.",
      "Backend endpoints are future candidates only.",
      "Snapshot import/export must preserve invariant warning visibility."
    ]
  };
}

function buildBackendDesignPlan(): BackendDesignPlan {
  return {
    localFirstAssumption: "Phase 3C remains local-first; backend routes are design candidates only.",
    futureEndpointCandidates: [
      {
        method: "POST",
        path: "/commands",
        purpose: "Validate and apply a human-confirmed DomainCommand through the Command Layer."
      },
      {
        method: "GET",
        path: "/state",
        purpose: "Fetch the current AppState snapshot."
      },
      {
        method: "PUT",
        path: "/state/import",
        purpose: "Import a validated AppState snapshot and surface invariant warnings."
      },
      {
        method: "GET",
        path: "/projects/:id/handoff",
        purpose: "Return a deterministic EngineeringHandoffPackage for a project."
      }
    ],
    explicitlyNotIncludedNow: [
      "login",
      "auth",
      "multi-user",
      "permissions",
      "complex sync conflict",
      "realtime collaboration",
      "database normalization migration"
    ],
    snapshotCommandContractNotes: [
      "Commands should be validated server-side before mutation.",
      "Snapshots should include schema version and invariant warning output.",
      "Command failures should be atomic and return the original state equivalent.",
      "Suggested command drafts should never be accepted as executable commands without confirmation."
    ],
    risks: [
      "Backend persistence can accidentally hide direct-ref drift if warnings are not returned.",
      "Remote command execution needs idempotency and conflict policy before use.",
      "Auth and permissions are explicitly deferred and must not be implied."
    ],
    openQuestions: [
      "What snapshot versioning contract should Phase 3D expose?",
      "How should command ids be deduplicated across sessions?",
      "Which invariant warnings should block import versus remain reviewable?"
    ]
  };
}

function buildCodexTaskPlan(): CodexTaskPlan {
  const commonGuardrails = [
    "Do not read or modify .env.local.",
    "Do not modify generated artifacts.",
    "Do not change AppState required shape.",
    "Do not auto-apply AI drafts or suggested commands."
  ];

  return {
    tasks: [
      {
        id: "codex-task-01-handoff-preview",
        title: "Read-only handoff preview",
        objective: "Render EngineeringHandoffPackage sections for human review.",
        likelyTouchedFilesOrAreas: ["components/screens/EngineeringHandoffCenter", "src/domain/engineeringHandoffPackage.ts"],
        dependencies: [],
        acceptanceCriteria: ["All package sections are visible.", "No state mutation occurs while previewing."],
        guardrails: commonGuardrails,
        requiresHumanConfirmation: false
      },
      {
        id: "codex-task-02-command-import",
        title: "Confirmed command import path",
        objective: "Wire selected command drafts into a validation/dry-run UI before executeDomainCommand.",
        likelyTouchedFilesOrAreas: ["Review Queue", "AI Interop", "src/domain/commandLayer.ts"],
        dependencies: ["codex-task-01-handoff-preview"],
        acceptanceCriteria: ["Drafts cannot execute directly.", "User confirmation is required.", "Failures are atomic."],
        guardrails: commonGuardrails,
        requiresHumanConfirmation: true
      },
      {
        id: "codex-task-03-relationship-health-ui",
        title: "Relationship health surfacing",
        objective: "Expose direct-ref and graph relationship warnings in project and handoff views.",
        likelyTouchedFilesOrAreas: ["Project Detail", "Relationship Map", "src/domain/relationshipContext.ts"],
        dependencies: ["codex-task-01-handoff-preview"],
        acceptanceCriteria: ["Direct refs and graph edges are displayed separately.", "Invalid refs are not auto-repaired."],
        guardrails: commonGuardrails,
        requiresHumanConfirmation: false
      },
      {
        id: "codex-task-04-backend-contract",
        title: "Backend command/snapshot contract",
        objective: "Define Phase 3D endpoint and snapshot contracts without implementing auth or sync.",
        likelyTouchedFilesOrAreas: ["docs/architecture", "src/domain/commandLayer.ts", "state transfer services"],
        dependencies: ["codex-task-02-command-import"],
        acceptanceCriteria: ["POST /commands and snapshot endpoints are specified.", "Out-of-scope backend features remain excluded."],
        guardrails: commonGuardrails,
        requiresHumanConfirmation: true
      },
      {
        id: "codex-task-05-acceptance-suite",
        title: "Handoff acceptance suite",
        objective: "Add regression tests around package determinism, command safety, AI draft limits, and lifecycle separation.",
        likelyTouchedFilesOrAreas: ["src/domain/*.test.ts", "src/services/*.test.ts"],
        dependencies: ["codex-task-01-handoff-preview", "codex-task-02-command-import"],
        acceptanceCriteria: ["Targeted tests pass.", "typecheck passes.", "No generated artifacts are required."],
        guardrails: commonGuardrails,
        requiresHumanConfirmation: false
      }
    ]
  };
}

function buildAcceptanceTestPlan(): AcceptanceTestPlan {
  return {
    unitTests: [
      "EngineeringHandoffPackage returns deterministic invalid packages for missing projects.",
      "EngineeringHandoffPackage includes all required top-level sections.",
      "RequiredSoftwarePlan modules include responsibilities, dependencies, touchpoints, and tests.",
      "generatedAt defaults to null and uses options.generatedAt when supplied."
    ],
    integrationTests: [
      "Project readiness, AI planning context, and handoff package agree on target validity.",
      "EngineeringFlowInput carries universe, source thought, linked thoughts, decisions, blockers, and AI insight summaries."
    ],
    regressionTests: [
      "Existing buildProjectHandoffPackage and markProjectHandoffReady behavior remains unchanged.",
      "Export schema remains draft-compatible for current project fields."
    ],
    handoffSafetyTests: [
      "Building a package does not call markProjectHandoffReady.",
      "Building a package does not set lifecycleStatus to handoff_ready.",
      "ready_for_engineering does not imply handoff_ready."
    ],
    commandSafetyTests: [
      "Suggested command drafts require human confirmation.",
      "Suggested command drafts are metadata only.",
      "Command Layer remains the only execution path."
    ],
    relationshipDirectRefTests: [
      "Relationship graph does not replace direct universe/project refs.",
      "Invalid direct refs are surfaced and not repaired.",
      "Direct membership and graph relationship drift remain visible."
    ],
    aiDraftLimitationTests: [
      "AI insights are summarized as drafts or reviewed artifacts.",
      "AI draft content does not mutate project or thought state.",
      "AI planning limitations are included in the ConstraintCodex."
    ],
    readinessLifecycleSeparationTests: [
      "computed readiness can be ready_for_engineering while lifecycleStatus remains planning.",
      "handoff_ready appears only from Project.lifecycleStatus.",
      "stale handoff is surfaced when lifecycle state no longer matches preflight gates."
    ]
  };
}

function buildBlockers(report: ProjectReadinessReport): EngineeringHandoffBlocker[] {
  const findingBlockers = report.findings
    .filter((finding) => finding.severity !== "info")
    .map((finding) => ({
      id: `finding:${finding.code}:${finding.target.type}:${finding.target.id}`,
      source: finding.code,
      severity: finding.severity,
      reason: finding.reason,
      evidenceIds: finding.evidenceIds
    }));
  const activeBlockers = report.activeBlockers.map((blocker) => ({
    id: `active-blocker:${blocker.id}`,
    source: blocker.source,
    severity: "warning",
    reason: blocker.reason,
    evidenceIds: blocker.evidenceIds
  }));

  return [...findingBlockers, ...activeBlockers]
    .sort((a, b) => a.id.localeCompare(b.id));
}

function packageCommand(
  projectId: string,
  commandType: string,
  label: string,
  reason: string,
  payloadPreview?: unknown
): EngineeringHandoffSuggestedCommandDraft {
  return {
    id: `engineering-handoff-package:${projectId}:${commandType}`,
    commandType,
    label,
    reason,
    target: { type: "project", id: projectId },
    requiresHumanConfirmation: true,
    ...(payloadPreview !== undefined ? { payloadPreview } : {})
  };
}

function buildSuggestedCommands(report: ProjectReadinessReport): EngineeringHandoffSuggestedCommandDraft[] {
  const projectId = report.target.id;
  const commands = [
    packageCommand(
      projectId,
      "handoffPackage.review",
      "Review handoff package",
      "Human review is required before using this draft package."
    ),
    packageCommand(
      projectId,
      "engineeringDraft.generate",
      "Generate engineering draft",
      "Draft generation is metadata only and does not mutate project state."
    ),
    packageCommand(
      projectId,
      "project.markHandoffReady",
      "Mark project handoff ready",
      "Only execute after handoff preflight passes and the user confirms.",
      { canMarkHandoffReady: report.canMarkHandoffReady }
    ),
    ...report.suggestedCommands.map((command) => packageCommand(
      projectId,
      command.commandType,
      command.label,
      command.reason,
      command.payloadPreview
    ))
  ];
  const byId = new Map(commands.map((command) => [command.id, command]));

  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function buildEngineeringHandoffPackage(
  state: AppState,
  projectId: string,
  options: EngineeringHandoffPackageOptions = {}
): EngineeringHandoffPackage {
  const generatedAt = options.generatedAt ?? null;
  const index = buildDomainIndex(state);
  const project = index.projectById[projectId];
  const readinessReport = buildProjectReadinessReport(state, projectId);
  const planningContext = buildAIPlanningContext(state, { type: "project", id: projectId });
  const engineeringFlowInput = buildEngineeringFlowInput(state, project, readinessReport, generatedAt);
  const constraintCodex = buildConstraintCodex(planningContext.safetyRules);

  return {
    projectId,
    valid: Boolean(project && readinessReport.target.valid && planningContext.target.valid),
    generatedAt,
    ...(!project ? { reason: "Project target was not found." } : {}),
    readinessReport,
    engineeringFlowInput,
    requiredSoftwarePlan: buildRequiredSoftwarePlan(project, readinessReport),
    projectEvolutionPlan: buildProjectEvolutionPlan(project, readinessReport, engineeringFlowInput),
    constraintCodex,
    backendDesignPlan: buildBackendDesignPlan(),
    codexTaskPlan: buildCodexTaskPlan(),
    acceptanceTestPlan: buildAcceptanceTestPlan(),
    safetyNotes: uniqueSorted([
      draftNotice,
      ...constraintCodex.hardConstraints,
      ...planningContext.limitations
    ]),
    blockers: buildBlockers(readinessReport),
    suggestedCommands: buildSuggestedCommands(readinessReport)
  };
}
