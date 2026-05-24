import { buildDomainIndex } from "./domainIndex";
import {
  buildProjectRelationshipContext,
  type GraphRelationshipContext,
  type ProjectRelationshipContext,
  type RelationshipContextFinding
} from "./relationshipContext";
import { readiness as computeProjectReadiness } from "./readiness";
import {
  getProjectEffectiveStage,
  getProjectReadinessDrift,
  type ProjectEffectiveStage
} from "./semantics/canonicalStatusSemantics";
import { projectLifecycleStatus } from "./semantics/projectSemantics";
import {
  isBlockingQuestionInReview,
  isBlockingQuestionOpen,
  isDecisionRecordPending
} from "./semantics/questionDecisionSemantics";
import { isAIInsightDraft } from "./semantics/statusSemantics";
import type {
  AIInsight,
  AppState,
  BlockingQuestion,
  DecisionRecord,
  Project,
  ProjectLifecycleStatus,
  Readiness
} from "./types";

export type ProjectReadinessSeverity = "info" | "warning" | "error";

export type ProjectReadinessFindingCode =
  | "target_missing"
  | "project_archived"
  | "stored_readiness_missing"
  | "computed_readiness_ready_for_engineering"
  | "readiness_drift"
  | "lifecycle_handoff_ready"
  | "lifecycle_drift"
  | "stale_handoff"
  | "active_blocker"
  | "pending_ai_draft"
  | "proposed_decision"
  | "open_blocking_question"
  | "in_review_blocking_question"
  | "direct_ref_warning"
  | "relationship_warning"
  | "handoff_preflight_passed"
  | "handoff_preflight_blocked"
  | "engineering_draft_candidate"
  | "handoff_candidate"
  | "needs_human_review";

export interface ProjectReadinessFinding {
  code: ProjectReadinessFindingCode;
  severity: ProjectReadinessSeverity;
  target: {
    type:
      | "project"
      | "thought"
      | "universe"
      | "relationship"
      | "aiInsight"
      | "decisionRecord"
      | "blockingQuestion"
      | "missing"
      | "unsupported";
    id: string;
  };
  reason: string;
  evidenceIds: string[];
}

export interface ProjectReadinessCommandDraft {
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

export interface ProjectComputedReadiness {
  value: Readiness;
  score: number;
  missing: string[];
}

export interface ProjectReadinessDriftSummary {
  storedReadiness?: Readiness;
  computedReadiness: Readiness;
  computedScore: number;
  missing: string[];
  hasDrift: boolean;
}

export interface ProjectReadinessBlocker {
  id: string;
  source: "lifecycleStatus" | "relationship";
  reason: string;
  evidenceIds: string[];
}

export interface ProjectDirectRefHealth {
  universe?: ProjectRelationshipContext["directMembershipRefs"]["universe"];
  sourceThought?: ProjectRelationshipContext["provenanceRefs"]["sourceThought"];
  linkedThoughts: ProjectRelationshipContext["directMembershipRefs"]["linkedThoughts"];
  warnings: RelationshipContextFinding[];
  invalidRefs: RelationshipContextFinding[];
}

export interface ProjectRelationshipHealth {
  warnings: RelationshipContextFinding[];
  blockingWarnings: RelationshipContextFinding[];
}

export interface ProjectBlockingQuestionSummary {
  open: Readonly<BlockingQuestion>[];
  inReview: Readonly<BlockingQuestion>[];
  unresolved: Readonly<BlockingQuestion>[];
}

export interface ProjectHandoffPreflight {
  projectExists: boolean;
  projectArchived: boolean;
  computedReadinessReady: boolean;
  hasActiveBlockers: boolean;
  hasUnresolvedBlockingQuestions: boolean;
  hasProposedDecisions: boolean;
  hasPendingAiDrafts: boolean;
  hasStaleHandoff: boolean;
  hasInvalidDirectRefs: boolean;
  hasRelationshipWarnings: boolean;
  canGenerateEngineeringDraft: boolean;
  canMarkHandoffReady: boolean;
  passed: boolean;
  blockedReasonCodes: ProjectReadinessFindingCode[];
}

export interface ProjectReadinessReport {
  target: {
    type: "project";
    id: string;
    valid: boolean;
  };
  project?: Readonly<Project>;
  storedReadiness?: Readiness;
  computedReadiness?: ProjectComputedReadiness;
  readinessDrift?: ProjectReadinessDriftSummary;
  lifecycleStatus?: ProjectLifecycleStatus;
  lifecycleDrift: boolean;
  staleHandoff: boolean;
  effectiveStage?: ProjectEffectiveStage;
  activeBlockers: ProjectReadinessBlocker[];
  pendingAiDrafts: Readonly<AIInsight>[];
  proposedDecisions: Readonly<DecisionRecord>[];
  blockingQuestions: ProjectBlockingQuestionSummary;
  directRefHealth?: ProjectDirectRefHealth;
  relationshipContext?: ProjectRelationshipContext;
  relationshipHealth: ProjectRelationshipHealth;
  handoffPreflight: ProjectHandoffPreflight;
  canGenerateEngineeringDraft: boolean;
  canMarkHandoffReady: boolean;
  findings: ProjectReadinessFinding[];
  suggestedCommands: ProjectReadinessCommandDraft[];
}

const draftableReadiness = new Set<Readiness>(["draftable", "ready_for_engineering"]);
const directRefWarningCodes = new Set<RelationshipContextFinding["code"]>([
  "invalid_project_universe_id",
  "invalid_project_source_thought_id",
  "invalid_project_linked_thought_id",
  "thought_project_missing_reverse_link",
  "project_linked_thought_missing_forward_link",
  "project_linked_thought_mismatched_forward_link",
  "direct_project_membership_without_graph_edge",
  "graph_project_membership_without_direct_membership",
  "source_thought_not_linked_thought"
]);
const invalidDirectRefCodes = new Set<RelationshipContextFinding["code"]>([
  "invalid_project_universe_id",
  "invalid_project_source_thought_id",
  "invalid_project_linked_thought_id"
]);

function clean(value: string | undefined) {
  return value?.trim() ?? "";
}

function finding(
  code: ProjectReadinessFindingCode,
  severity: ProjectReadinessSeverity,
  target: ProjectReadinessFinding["target"],
  reason: string,
  evidenceIds: string[]
): ProjectReadinessFinding {
  return {
    code,
    severity,
    target,
    evidenceIds: [...evidenceIds].filter(Boolean).sort(),
    reason
  };
}

function compareFindings(a: ProjectReadinessFinding, b: ProjectReadinessFinding) {
  return a.code.localeCompare(b.code) ||
    a.severity.localeCompare(b.severity) ||
    a.target.type.localeCompare(b.target.type) ||
    a.target.id.localeCompare(b.target.id) ||
    a.evidenceIds.join("|").localeCompare(b.evidenceIds.join("|"));
}

function uniqueSortedFindings(findings: ProjectReadinessFinding[]) {
  const byKey = new Map<string, ProjectReadinessFinding>();

  for (const item of findings) {
    const key = `${item.code}|${item.severity}|${item.target.type}|${item.target.id}|${item.evidenceIds.join("|")}`;
    if (!byKey.has(key)) byKey.set(key, item);
  }

  return [...byKey.values()].sort(compareFindings);
}

function commandDraft(
  projectId: string,
  commandType: string,
  label: string,
  reason: string,
  payloadPreview?: unknown
): ProjectReadinessCommandDraft {
  return {
    id: `project-readiness:${projectId}:${commandType}`,
    commandType,
    label,
    reason,
    target: { type: "project", id: projectId },
    requiresHumanConfirmation: true,
    ...(payloadPreview !== undefined ? { payloadPreview } : {})
  };
}

function relationshipFindingSeverity(findingItem: RelationshipContextFinding): ProjectReadinessSeverity {
  if (findingItem.severity === "error") return "error";
  if (findingItem.severity === "info") return "info";

  return "warning";
}

function isDirectRefWarning(findingItem: RelationshipContextFinding) {
  return directRefWarningCodes.has(findingItem.code);
}

function isInvalidDirectRef(findingItem: RelationshipContextFinding) {
  return invalidDirectRefCodes.has(findingItem.code);
}

function relationshipTargetType(findingItem: RelationshipContextFinding): ProjectReadinessFinding["target"]["type"] {
  if (findingItem.target.type === "aiInsight") return "aiInsight";
  if (findingItem.target.type === "blockingQuestion") return "blockingQuestion";
  if (findingItem.target.type === "decisionRecord") return "decisionRecord";
  if (findingItem.target.type === "missing") return "missing";
  if (findingItem.target.type === "project") return "project";
  if (findingItem.target.type === "relationship") return "relationship";
  if (findingItem.target.type === "thought") return "thought";
  if (findingItem.target.type === "universe") return "universe";

  return "unsupported";
}

function projectRelationshipBlockers(context: ProjectRelationshipContext): GraphRelationshipContext[] {
  return context.blockersAndDependencies.filter((item) =>
    item.relationship.type === "blocks" && item.direction === "incoming"
  );
}

function activeBlockers(
  project: Readonly<Project>,
  lifecycleStatus: ProjectLifecycleStatus,
  relationshipContext: ProjectRelationshipContext
): ProjectReadinessBlocker[] {
  const blockers: ProjectReadinessBlocker[] = [];

  if (lifecycleStatus === "blocked") {
    blockers.push({
      id: `${project.id}:lifecycleStatus`,
      source: "lifecycleStatus",
      reason: "Project lifecycleStatus is blocked.",
      evidenceIds: [project.id, "blocked"]
    });
  }

  for (const blocker of projectRelationshipBlockers(relationshipContext)) {
    blockers.push({
      id: blocker.relationship.id,
      source: "relationship",
      reason: "Incoming blocks relationship targets the project.",
      evidenceIds: [project.id, blocker.relationship.id]
    });
  }

  return blockers.sort((a, b) => a.id.localeCompare(b.id));
}

function blockingQuestionsForProject(state: AppState, projectId: string): ProjectBlockingQuestionSummary {
  const unresolved = (state.blockingQuestions ?? [])
    .filter((question) => (question.linkedProjectIds ?? []).includes(projectId))
    .filter((question) => isBlockingQuestionOpen(question) || isBlockingQuestionInReview(question))
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    open: unresolved.filter(isBlockingQuestionOpen),
    inReview: unresolved.filter(isBlockingQuestionInReview),
    unresolved
  };
}

function proposedDecisionsForProject(state: AppState, projectId: string): Readonly<DecisionRecord>[] {
  const linkedQuestionIds = new Set(
    (state.blockingQuestions ?? [])
      .filter((question) => (question.linkedProjectIds ?? []).includes(projectId))
      .map((question) => question.id)
  );

  return (state.decisionRecords ?? [])
    .filter(isDecisionRecordPending)
    .filter((record) =>
      (record.linkedProjectIds ?? []).includes(projectId) ||
      Boolean(record.sourceBlockingQuestionId && linkedQuestionIds.has(record.sourceBlockingQuestionId))
    )
    .sort((a, b) => a.id.localeCompare(b.id));
}

function pendingAiDraftsForProject(state: AppState, projectId: string): Readonly<AIInsight>[] {
  return state.aiInsights
    .filter(isAIInsightDraft)
    .filter((insight) => insight.targetId === projectId && insight.patch?.targetType !== "thought")
    .sort((a, b) => a.id.localeCompare(b.id));
}

function directRefHealth(context: ProjectRelationshipContext): ProjectDirectRefHealth {
  const warnings = context.findings.filter(isDirectRefWarning);

  return {
    universe: context.directMembershipRefs.universe,
    sourceThought: context.provenanceRefs.sourceThought,
    linkedThoughts: context.directMembershipRefs.linkedThoughts,
    warnings,
    invalidRefs: warnings.filter(isInvalidDirectRef)
  };
}

function relationshipHealth(context: ProjectRelationshipContext): ProjectRelationshipHealth {
  const warnings = context.findings;

  return {
    warnings,
    blockingWarnings: warnings.filter((item) => item.severity === "error")
  };
}

function readinessDriftForProject(project: Readonly<Project>): ProjectReadinessDriftSummary {
  const storedReadiness = (project as { readiness?: Readiness }).readiness;

  if (storedReadiness) {
    const drift = getProjectReadinessDrift(project as Project);

    return {
      storedReadiness,
      computedReadiness: drift.computedReadiness,
      computedScore: drift.computedScore,
      missing: drift.missing,
      hasDrift: drift.hasDrift
    };
  }

  const computed = computeProjectReadiness(project as Project);

  return {
    storedReadiness,
    computedReadiness: computed.value,
    computedScore: computed.score,
    missing: computed.missing,
    hasDrift: true
  };
}

function computedReadinessFromDrift(drift: ProjectReadinessDriftSummary): ProjectComputedReadiness {
  return {
    value: drift.computedReadiness,
    score: drift.computedScore,
    missing: drift.missing
  };
}

function effectiveStageForProject(
  project: Readonly<Project>,
  readinessDrift: ProjectReadinessDriftSummary,
  state: AppState
): ProjectEffectiveStage {
  const projectForSemantics = {
    ...project,
    readiness: readinessDrift.storedReadiness ?? readinessDrift.computedReadiness
  } as Project;

  return getProjectEffectiveStage(projectForSemantics, {
    relationships: state.relationships,
    blockingQuestions: state.blockingQuestions
  });
}

function canGenerateEngineeringDraft(project: Readonly<Project>, computedReadiness: ProjectComputedReadiness) {
  return project.status !== "archived" && draftableReadiness.has(computedReadiness.value);
}

function blockedReasonCodes(input: {
  projectArchived: boolean;
  computedReadinessReady: boolean;
  activeBlockers: ProjectReadinessBlocker[];
  blockingQuestions: ProjectBlockingQuestionSummary;
  proposedDecisions: readonly Readonly<DecisionRecord>[];
  pendingAiDrafts: readonly Readonly<AIInsight>[];
  directRefHealth: ProjectDirectRefHealth;
  relationshipHealth: ProjectRelationshipHealth;
  staleHandoff: boolean;
}): ProjectReadinessFindingCode[] {
  const codes: ProjectReadinessFindingCode[] = [];

  if (input.projectArchived) codes.push("project_archived");
  if (!input.computedReadinessReady) codes.push("handoff_preflight_blocked");
  if (input.activeBlockers.length > 0) codes.push("active_blocker");
  if (input.blockingQuestions.open.length > 0) codes.push("open_blocking_question");
  if (input.blockingQuestions.inReview.length > 0) codes.push("in_review_blocking_question");
  if (input.proposedDecisions.length > 0) codes.push("proposed_decision");
  if (input.pendingAiDrafts.length > 0) codes.push("pending_ai_draft");
  if (input.directRefHealth.invalidRefs.length > 0) codes.push("direct_ref_warning");
  if (input.relationshipHealth.blockingWarnings.length > 0) codes.push("relationship_warning");
  if (input.staleHandoff) codes.push("stale_handoff");

  return Array.from(new Set(codes)).sort();
}

function buildPreflight(input: {
  project: Readonly<Project>;
  computedReadiness: ProjectComputedReadiness;
  activeBlockers: ProjectReadinessBlocker[];
  blockingQuestions: ProjectBlockingQuestionSummary;
  proposedDecisions: readonly Readonly<DecisionRecord>[];
  pendingAiDrafts: readonly Readonly<AIInsight>[];
  directRefHealth: ProjectDirectRefHealth;
  relationshipHealth: ProjectRelationshipHealth;
  staleHandoff: boolean;
  canGenerateEngineeringDraft: boolean;
  lifecycleStatus: ProjectLifecycleStatus;
}): ProjectHandoffPreflight {
  const projectArchived = input.project.status === "archived";
  const computedReadinessReady = input.computedReadiness.value === "ready_for_engineering";
  const basePassed = !projectArchived &&
    computedReadinessReady &&
    input.activeBlockers.length === 0 &&
    input.blockingQuestions.unresolved.length === 0 &&
    input.proposedDecisions.length === 0 &&
    input.pendingAiDrafts.length === 0 &&
    input.directRefHealth.invalidRefs.length === 0 &&
    input.relationshipHealth.blockingWarnings.length === 0;
  const canMarkHandoffReady = basePassed && input.lifecycleStatus !== "handoff_ready";

  return {
    projectExists: true,
    projectArchived,
    computedReadinessReady,
    hasActiveBlockers: input.activeBlockers.length > 0,
    hasUnresolvedBlockingQuestions: input.blockingQuestions.unresolved.length > 0,
    hasProposedDecisions: input.proposedDecisions.length > 0,
    hasPendingAiDrafts: input.pendingAiDrafts.length > 0,
    hasStaleHandoff: input.staleHandoff,
    hasInvalidDirectRefs: input.directRefHealth.invalidRefs.length > 0,
    hasRelationshipWarnings: input.relationshipHealth.warnings.length > 0,
    canGenerateEngineeringDraft: input.canGenerateEngineeringDraft,
    canMarkHandoffReady,
    passed: basePassed,
    blockedReasonCodes: blockedReasonCodes({
      projectArchived,
      computedReadinessReady,
      activeBlockers: input.activeBlockers,
      blockingQuestions: input.blockingQuestions,
      proposedDecisions: input.proposedDecisions,
      pendingAiDrafts: input.pendingAiDrafts,
      directRefHealth: input.directRefHealth,
      relationshipHealth: input.relationshipHealth,
      staleHandoff: input.staleHandoff
    })
  };
}

function suggestedCommands(input: {
  project: Readonly<Project>;
  readinessDrift: ProjectReadinessDriftSummary;
  activeBlockers: ProjectReadinessBlocker[];
  blockingQuestions: ProjectBlockingQuestionSummary;
  proposedDecisions: readonly Readonly<DecisionRecord>[];
  pendingAiDrafts: readonly Readonly<AIInsight>[];
  directRefHealth: ProjectDirectRefHealth;
  relationshipHealth: ProjectRelationshipHealth;
  canGenerateEngineeringDraft: boolean;
  canMarkHandoffReady: boolean;
}) {
  const commands: ProjectReadinessCommandDraft[] = [];
  const projectId = input.project.id;

  if (input.readinessDrift.hasDrift) {
    commands.push(commandDraft(
      projectId,
      "recompute_update_stored_readiness",
      "Update stored readiness",
      "Stored readiness differs from computed readiness.",
      {
        storedReadiness: input.readinessDrift.storedReadiness,
        computedReadiness: input.readinessDrift.computedReadiness
      }
    ));
  }

  if (input.activeBlockers.length > 0) {
    commands.push(commandDraft(
      projectId,
      "resolve_blocker",
      "Resolve blocker",
      "Project has active blockers before handoff.",
      { blockerIds: input.activeBlockers.map((blocker) => blocker.id) }
    ));
  }

  if (input.blockingQuestions.unresolved.length > 0) {
    commands.push(commandDraft(
      projectId,
      "answer_review_blocking_question",
      "Answer blocking question",
      "Project has open or in-review blocking questions.",
      { blockingQuestionIds: input.blockingQuestions.unresolved.map((question) => question.id) }
    ));
  }

  if (input.proposedDecisions.length > 0) {
    commands.push(commandDraft(
      projectId,
      "confirm_reject_proposed_decision",
      "Review proposed decision",
      "Project has proposed decisions awaiting confirmation.",
      { decisionRecordIds: input.proposedDecisions.map((record) => record.id) }
    ));
  }

  if (input.pendingAiDrafts.length > 0) {
    commands.push(commandDraft(
      projectId,
      "review_ai_draft",
      "Review AI draft",
      "Project has pending AI drafts.",
      { aiInsightIds: input.pendingAiDrafts.map((insight) => insight.id) }
    ));
  }

  if (input.directRefHealth.invalidRefs.length > 0) {
    commands.push(commandDraft(
      projectId,
      "repair_direct_ref",
      "Repair direct ref",
      "Project has invalid direct refs.",
      { findingEvidenceIds: input.directRefHealth.invalidRefs.flatMap((item) => item.evidenceIds) }
    ));
  }

  if (input.relationshipHealth.warnings.length > 0) {
    commands.push(commandDraft(
      projectId,
      "review_relationship_drift",
      "Review relationship drift",
      "RelationshipContext reported project relationship warnings.",
      { findingCodes: input.relationshipHealth.warnings.map((item) => item.code) }
    ));
  }

  if (input.canGenerateEngineeringDraft) {
    commands.push(commandDraft(
      projectId,
      "generate_engineering_draft",
      "Generate engineering draft",
      "Project content is mature enough to draft engineering input."
    ));
  }

  if (input.canMarkHandoffReady) {
    commands.push(commandDraft(
      projectId,
      "mark_project_handoff_ready",
      "Mark project handoff ready",
      "Project passed handoff preflight and still requires human confirmation."
    ));
  }

  return commands.sort((a, b) => a.id.localeCompare(b.id));
}

function buildFindings(input: {
  project: Readonly<Project>;
  storedReadiness?: Readiness;
  computedReadiness: ProjectComputedReadiness;
  readinessDrift: ProjectReadinessDriftSummary;
  lifecycleStatus: ProjectLifecycleStatus;
  lifecycleDrift: boolean;
  staleHandoff: boolean;
  activeBlockers: ProjectReadinessBlocker[];
  blockingQuestions: ProjectBlockingQuestionSummary;
  proposedDecisions: readonly Readonly<DecisionRecord>[];
  pendingAiDrafts: readonly Readonly<AIInsight>[];
  directRefHealth: ProjectDirectRefHealth;
  relationshipHealth: ProjectRelationshipHealth;
  handoffPreflight: ProjectHandoffPreflight;
  canGenerateEngineeringDraft: boolean;
  canMarkHandoffReady: boolean;
  commandCount: number;
}) {
  const findings: ProjectReadinessFinding[] = [];
  const projectTarget = { type: "project" as const, id: input.project.id };

  if (input.project.status === "archived") {
    findings.push(finding(
      "project_archived",
      "warning",
      projectTarget,
      "Project.status is archived.",
      [input.project.id]
    ));
  }

  if (!input.storedReadiness) {
    findings.push(finding(
      "stored_readiness_missing",
      "warning",
      projectTarget,
      "Project.readiness is missing.",
      [input.project.id]
    ));
  }

  if (input.computedReadiness.value === "ready_for_engineering") {
    findings.push(finding(
      "computed_readiness_ready_for_engineering",
      "info",
      projectTarget,
      "Computed readiness reached ready_for_engineering.",
      [input.project.id, input.computedReadiness.value]
    ));
  }

  if (input.readinessDrift.hasDrift) {
    findings.push(finding(
      "readiness_drift",
      "warning",
      projectTarget,
      "Stored readiness differs from computed readiness.",
      [input.project.id, input.readinessDrift.storedReadiness ?? "", input.readinessDrift.computedReadiness]
    ));
  }

  if (input.lifecycleStatus === "handoff_ready") {
    findings.push(finding(
      "lifecycle_handoff_ready",
      "info",
      projectTarget,
      "Project lifecycleStatus is handoff_ready.",
      [input.project.id, "handoff_ready"]
    ));
  }

  if (input.lifecycleDrift) {
    findings.push(finding(
      "lifecycle_drift",
      "warning",
      projectTarget,
      "Project lifecycle state no longer matches current handoff gates.",
      [input.project.id, input.lifecycleStatus]
    ));
  }

  if (input.staleHandoff) {
    findings.push(finding(
      "stale_handoff",
      "warning",
      projectTarget,
      "Project is marked handoff_ready but current handoff preflight is blocked.",
      [input.project.id]
    ));
  }

  for (const blocker of input.activeBlockers) {
    findings.push(finding(
      "active_blocker",
      "warning",
      blocker.source === "relationship" ? { type: "relationship", id: blocker.id } : projectTarget,
      blocker.reason,
      blocker.evidenceIds
    ));
  }

  for (const insight of input.pendingAiDrafts) {
    findings.push(finding(
      "pending_ai_draft",
      "warning",
      { type: "aiInsight", id: insight.id },
      "AI draft is pending review for this project.",
      [input.project.id, insight.id]
    ));
  }

  for (const record of input.proposedDecisions) {
    findings.push(finding(
      "proposed_decision",
      "warning",
      { type: "decisionRecord", id: record.id },
      "Proposed decision is linked to this project.",
      [input.project.id, record.id]
    ));
  }

  for (const question of input.blockingQuestions.open) {
    findings.push(finding(
      "open_blocking_question",
      "warning",
      { type: "blockingQuestion", id: question.id },
      "Open blocking question is linked to this project.",
      [input.project.id, question.id]
    ));
  }

  for (const question of input.blockingQuestions.inReview) {
    findings.push(finding(
      "in_review_blocking_question",
      "warning",
      { type: "blockingQuestion", id: question.id },
      "In-review blocking question is linked to this project.",
      [input.project.id, question.id]
    ));
  }

  for (const item of input.directRefHealth.warnings) {
    findings.push(finding(
      "direct_ref_warning",
      relationshipFindingSeverity(item),
      { type: "project", id: input.project.id },
      item.reason,
      item.evidenceIds
    ));
  }

  for (const item of input.relationshipHealth.warnings) {
    findings.push(finding(
      "relationship_warning",
      relationshipFindingSeverity(item),
      { type: relationshipTargetType(item), id: item.target.id },
      item.reason,
      item.evidenceIds
    ));
  }

  findings.push(finding(
    input.handoffPreflight.passed ? "handoff_preflight_passed" : "handoff_preflight_blocked",
    input.handoffPreflight.passed ? "info" : "warning",
    projectTarget,
    input.handoffPreflight.passed
      ? "Project passed read-only handoff preflight."
      : "Project handoff preflight is blocked.",
    [input.project.id, ...input.handoffPreflight.blockedReasonCodes]
  ));

  if (input.canGenerateEngineeringDraft) {
    findings.push(finding(
      "engineering_draft_candidate",
      "info",
      projectTarget,
      "Project can generate an engineering draft without marking handoff ready.",
      [input.project.id]
    ));
  }

  if (input.canMarkHandoffReady) {
    findings.push(finding(
      "handoff_candidate",
      "info",
      projectTarget,
      "Project can be marked handoff ready after human confirmation.",
      [input.project.id]
    ));
  }

  if (input.commandCount > 0) {
    findings.push(finding(
      "needs_human_review",
      "info",
      projectTarget,
      "Suggested command drafts are metadata only and require human confirmation.",
      [input.project.id]
    ));
  }

  return uniqueSortedFindings(findings);
}

function missingReport(projectId: string): ProjectReadinessReport {
  const handoffPreflight: ProjectHandoffPreflight = {
    projectExists: false,
    projectArchived: false,
    computedReadinessReady: false,
    hasActiveBlockers: false,
    hasUnresolvedBlockingQuestions: false,
    hasProposedDecisions: false,
    hasPendingAiDrafts: false,
    hasStaleHandoff: false,
    hasInvalidDirectRefs: false,
    hasRelationshipWarnings: false,
    canGenerateEngineeringDraft: false,
    canMarkHandoffReady: false,
    passed: false,
    blockedReasonCodes: ["target_missing"]
  };

  return {
    target: { type: "project", id: projectId, valid: false },
    lifecycleDrift: false,
    staleHandoff: false,
    activeBlockers: [],
    pendingAiDrafts: [],
    proposedDecisions: [],
    blockingQuestions: {
      open: [],
      inReview: [],
      unresolved: []
    },
    relationshipHealth: {
      warnings: [],
      blockingWarnings: []
    },
    handoffPreflight,
    canGenerateEngineeringDraft: false,
    canMarkHandoffReady: false,
    findings: uniqueSortedFindings([
      finding(
        "target_missing",
        "error",
        { type: "missing", id: projectId },
        "ProjectReadinessReport target id does not resolve to a project.",
        [projectId]
      ),
      finding(
        "handoff_preflight_blocked",
        "warning",
        { type: "missing", id: projectId },
        "Project handoff preflight cannot run without a project target.",
        [projectId]
      )
    ]),
    suggestedCommands: []
  };
}

export function buildProjectReadinessReport(state: AppState, projectId: string): ProjectReadinessReport {
  const index = buildDomainIndex(state);
  const project = Object.prototype.hasOwnProperty.call(index.projectById, projectId)
    ? index.projectById[projectId]
    : undefined;

  if (!project) return missingReport(projectId);

  const relationshipContext = buildProjectRelationshipContext(state, projectId);
  const validRelationshipContext = relationshipContext.targetType === "project" ? relationshipContext : undefined;

  if (!validRelationshipContext) return missingReport(projectId);

  const storedReadiness = (project as { readiness?: Readiness }).readiness;
  const readinessDrift = readinessDriftForProject(project);
  const computedReadiness = computedReadinessFromDrift(readinessDrift);
  const lifecycleStatus = projectLifecycleStatus(project);
  const activeProjectBlockers = activeBlockers(project, lifecycleStatus, validRelationshipContext);
  const pendingAiDrafts = pendingAiDraftsForProject(state, project.id);
  const proposedDecisions = proposedDecisionsForProject(state, project.id);
  const blockingQuestions = blockingQuestionsForProject(state, project.id);
  const directHealth = directRefHealth(validRelationshipContext);
  const relHealth = relationshipHealth(validRelationshipContext);
  const draftable = canGenerateEngineeringDraft(project, computedReadiness);
  const basePreflightPass = project.status !== "archived" &&
    computedReadiness.value === "ready_for_engineering" &&
    activeProjectBlockers.length === 0 &&
    blockingQuestions.unresolved.length === 0 &&
    proposedDecisions.length === 0 &&
    pendingAiDrafts.length === 0 &&
    directHealth.invalidRefs.length === 0 &&
    relHealth.blockingWarnings.length === 0;
  const staleHandoff = lifecycleStatus === "handoff_ready" && !basePreflightPass;
  const lifecycleDrift = staleHandoff ||
    (lifecycleStatus === "blocked" && activeProjectBlockers.length === 1 && activeProjectBlockers[0]?.source === "lifecycleStatus");
  const handoffPreflight = buildPreflight({
    project,
    computedReadiness,
    activeBlockers: activeProjectBlockers,
    blockingQuestions,
    proposedDecisions,
    pendingAiDrafts,
    directRefHealth: directHealth,
    relationshipHealth: relHealth,
    staleHandoff,
    canGenerateEngineeringDraft: draftable,
    lifecycleStatus
  });
  const canMarkHandoffReady = handoffPreflight.canMarkHandoffReady;
  const commands = suggestedCommands({
    project,
    readinessDrift,
    activeBlockers: activeProjectBlockers,
    blockingQuestions,
    proposedDecisions,
    pendingAiDrafts,
    directRefHealth: directHealth,
    relationshipHealth: relHealth,
    canGenerateEngineeringDraft: draftable,
    canMarkHandoffReady
  });
  const findings = buildFindings({
    project,
    storedReadiness,
    computedReadiness,
    readinessDrift,
    lifecycleStatus,
    lifecycleDrift,
    staleHandoff,
    activeBlockers: activeProjectBlockers,
    blockingQuestions,
    proposedDecisions,
    pendingAiDrafts,
    directRefHealth: directHealth,
    relationshipHealth: relHealth,
    handoffPreflight,
    canGenerateEngineeringDraft: draftable,
    canMarkHandoffReady,
    commandCount: commands.length
  });

  return {
    target: { type: "project", id: projectId, valid: true },
    project,
    storedReadiness,
    computedReadiness,
    readinessDrift,
    lifecycleStatus,
    lifecycleDrift,
    staleHandoff,
    effectiveStage: effectiveStageForProject(project, readinessDrift, state),
    activeBlockers: activeProjectBlockers,
    pendingAiDrafts,
    proposedDecisions,
    blockingQuestions,
    directRefHealth: directHealth,
    relationshipContext: validRelationshipContext,
    relationshipHealth: relHealth,
    handoffPreflight,
    canGenerateEngineeringDraft: draftable,
    canMarkHandoffReady,
    findings,
    suggestedCommands: commands
  };
}

export function buildProjectReadinessReports(state: AppState): ProjectReadinessReport[] {
  return state.projects
    .map((project) => buildProjectReadinessReport(state, project.id))
    .sort((a, b) => a.target.id.localeCompare(b.target.id));
}
