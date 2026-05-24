import { buildDomainIndex, type DomainEntityById } from "./domainIndex";
import {
  buildThoughtRelationshipContext,
  type GraphRelationshipContext,
  type RelationshipContextFinding,
  type ThoughtRelationshipContext
} from "./relationshipContext";
import { isBlockingQuestionUnresolved } from "./semantics/questionDecisionSemantics";
import type { AppState, BlockingQuestion, Project, ThoughtItem, ThoughtType, Universe } from "./types";

type EntityWithId = { id: string };

export type ThoughtSemanticRole =
  | "task"
  | "goal"
  | "question"
  | "project_seed"
  | "note"
  | "reference"
  | "unknown";

export type ThoughtProgressionStage =
  | "capture"
  | "inbox"
  | "classify"
  | "universe"
  | "context"
  | "actionable"
  | "project_candidate"
  | "promote_link_project";

export type ThoughtProgressionStageStatus = "complete" | "needs_attention" | "pending" | "blocked";
export type ThoughtProgressionSeverity = "info" | "warning" | "error";

export type ThoughtProgressionFindingCode =
  | "target_missing"
  | "thought_inbox"
  | "thought_active"
  | "classification_missing"
  | "universe_missing"
  | "universe_invalid"
  | "context_missing_why"
  | "context_missing_outcome"
  | "context_missing_next_action"
  | "semantic_role_task"
  | "semantic_role_goal"
  | "semantic_role_question"
  | "semantic_role_project_seed"
  | "semantic_role_note"
  | "semantic_role_reference"
  | "semantic_role_unknown"
  | "active_blocker"
  | "active_dependency"
  | "relationship_warning"
  | "promotion_candidate"
  | "promotion_blocked"
  | "link_project_candidate"
  | "needs_human_review";

export interface ThoughtProgressionFinding {
  code: ThoughtProgressionFindingCode;
  severity: ThoughtProgressionSeverity;
  target: {
    type: "thought" | "relationship" | "blockingQuestion" | "project" | "missing";
    id: string;
  };
  reason: string;
  evidenceIds: string[];
}

export interface ThoughtProgressionCommandDraft {
  id: string;
  commandType: string;
  label: string;
  reason: string;
  target: {
    type: "thought";
    id: string;
  };
  requiresHumanConfirmation: true;
  payloadPreview?: unknown;
}

export interface ThoughtProgressionStageSummary {
  stage: ThoughtProgressionStage;
  status: ThoughtProgressionStageStatus;
  reasonCodes: ThoughtProgressionFindingCode[];
}

export interface ThoughtProgressionRelationshipSummary {
  blockers: GraphRelationshipContext[];
  dependencies: GraphRelationshipContext[];
  unresolvedBlockingQuestions: Readonly<BlockingQuestion>[];
  relationshipWarnings: RelationshipContextFinding[];
}

export interface ThoughtProgressionUniverseRef {
  id?: string;
  present: boolean;
  valid: boolean;
  entity?: Readonly<Universe>;
}

export interface ThoughtProgressionReport {
  target: {
    type: "thought";
    id: string;
    valid: boolean;
  };
  thought?: Readonly<ThoughtItem>;
  isInbox: boolean;
  isActive: boolean;
  classificationMissing: boolean;
  semanticRole: ThoughtSemanticRole;
  universe: ThoughtProgressionUniverseRef;
  missingContext: {
    why: boolean;
    outcome: boolean;
    nextAction: boolean;
  };
  relationshipContext?: ThoughtRelationshipContext;
  relationships: ThoughtProgressionRelationshipSummary;
  canPromoteToProject: boolean;
  canLinkToExistingProject: boolean;
  existingProjectCandidates: Readonly<Project>[];
  recommendedNextStage: ThoughtProgressionStage;
  stages: ThoughtProgressionStageSummary[];
  findings: ThoughtProgressionFinding[];
  suggestedCommands: ThoughtProgressionCommandDraft[];
}

const semanticRoleFindingCode: Record<ThoughtSemanticRole, ThoughtProgressionFindingCode> = {
  task: "semantic_role_task",
  goal: "semantic_role_goal",
  question: "semantic_role_question",
  project_seed: "semantic_role_project_seed",
  note: "semantic_role_note",
  reference: "semantic_role_reference",
  unknown: "semantic_role_unknown"
};

function getById<T extends EntityWithId>(
  byId: DomainEntityById<T>,
  id: string | undefined
): Readonly<T> | undefined {
  return id && Object.prototype.hasOwnProperty.call(byId, id) ? byId[id] : undefined;
}

function clean(value: string | undefined) {
  return value?.trim() ?? "";
}

function finding(
  code: ThoughtProgressionFindingCode,
  severity: ThoughtProgressionSeverity,
  target: ThoughtProgressionFinding["target"],
  reason: string,
  evidenceIds: string[]
): ThoughtProgressionFinding {
  return {
    code,
    severity,
    target,
    reason,
    evidenceIds: [...evidenceIds].filter(Boolean).sort()
  };
}

function compareFindings(a: ThoughtProgressionFinding, b: ThoughtProgressionFinding) {
  return a.code.localeCompare(b.code) ||
    a.severity.localeCompare(b.severity) ||
    a.target.type.localeCompare(b.target.type) ||
    a.target.id.localeCompare(b.target.id) ||
    a.evidenceIds.join("|").localeCompare(b.evidenceIds.join("|"));
}

function uniqueSortedFindings(findings: ThoughtProgressionFinding[]) {
  const byKey = new Map<string, ThoughtProgressionFinding>();

  for (const item of findings) {
    const key = `${item.code}|${item.severity}|${item.target.type}|${item.target.id}|${item.evidenceIds.join("|")}`;
    if (!byKey.has(key)) byKey.set(key, item);
  }

  return [...byKey.values()].sort(compareFindings);
}

function inferSemanticRole(type: ThoughtType | string | undefined): ThoughtSemanticRole {
  if (type === "task") return "task";
  if (type === "goal") return "goal";
  if (type === "question") return "question";
  if (type === "project") return "project_seed";
  if (type === "note") return "note";
  if (type === "inspiration") return "reference";

  return "unknown";
}

function isClassificationMissing(thought: Readonly<ThoughtItem>, semanticRole: ThoughtSemanticRole) {
  return thought.status === "inbox" && (semanticRole === "note" || semanticRole === "reference" || semanticRole === "unknown");
}

function incomingBlocker(context: GraphRelationshipContext) {
  return context.relationship.type === "blocks" && context.direction === "incoming";
}

function dependency(context: GraphRelationshipContext) {
  return context.relationship.type === "depends_on";
}

function unresolvedBlockingQuestionsForThought(state: AppState, thoughtId: string) {
  return (state.blockingQuestions ?? [])
    .filter((question) => isBlockingQuestionUnresolved(question))
    .filter((question) => question.linkedThoughtIds?.includes(thoughtId))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function activeProjectCandidates(
  projects: readonly Readonly<Project>[],
  thought: Readonly<ThoughtItem>,
  universe: ThoughtProgressionUniverseRef
) {
  if (thought.projectId || !universe.valid || !universe.id) return [];

  return projects
    .filter((project) => project.status !== "archived")
    .filter((project) => project.universeId === universe.id)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

function canPromote(
  thought: Readonly<ThoughtItem>,
  semanticRole: ThoughtSemanticRole,
  universe: ThoughtProgressionUniverseRef,
  missingContext: ThoughtProgressionReport["missingContext"],
  activeBlockers: readonly GraphRelationshipContext[],
  unresolvedBlockingQuestions: readonly Readonly<BlockingQuestion>[]
) {
  return thought.status !== "archived" &&
    !thought.projectId &&
    semanticRole === "project_seed" &&
    universe.valid &&
    !missingContext.why &&
    !missingContext.outcome &&
    !missingContext.nextAction &&
    activeBlockers.length === 0 &&
    unresolvedBlockingQuestions.length === 0;
}

function recommendedStage(
  report: Pick<
    ThoughtProgressionReport,
    | "target"
    | "isInbox"
    | "classificationMissing"
    | "universe"
    | "missingContext"
    | "canPromoteToProject"
    | "canLinkToExistingProject"
  >
) {
  if (!report.target.valid) return "capture";
  if (report.isInbox) return "classify";
  if (report.classificationMissing) return "classify";
  if (!report.universe.present || !report.universe.valid) return "universe";
  if (report.missingContext.why || report.missingContext.outcome) return "context";
  if (report.missingContext.nextAction) return "actionable";
  if (report.canPromoteToProject || report.canLinkToExistingProject) return "promote_link_project";

  return "actionable";
}

function stageSummary(
  report: Pick<
    ThoughtProgressionReport,
    | "target"
    | "isInbox"
    | "classificationMissing"
    | "universe"
    | "missingContext"
    | "canPromoteToProject"
    | "canLinkToExistingProject"
  >,
  activeBlockers: readonly GraphRelationshipContext[],
  unresolvedBlockingQuestions: readonly Readonly<BlockingQuestion>[]
): ThoughtProgressionStageSummary[] {
  const contextMissing = report.missingContext.why || report.missingContext.outcome;
  const blockersPresent = activeBlockers.length > 0 || unresolvedBlockingQuestions.length > 0;

  return [
    {
      stage: "capture",
      status: report.target.valid ? "complete" : "needs_attention",
      reasonCodes: report.target.valid ? [] : ["target_missing"]
    },
    {
      stage: "inbox",
      status: report.isInbox ? "needs_attention" : report.target.valid ? "complete" : "pending",
      reasonCodes: report.isInbox ? ["thought_inbox"] : []
    },
    {
      stage: "classify",
      status: report.classificationMissing ? "needs_attention" : report.target.valid ? "complete" : "pending",
      reasonCodes: report.classificationMissing ? ["classification_missing"] : []
    },
    {
      stage: "universe",
      status: !report.universe.present || !report.universe.valid ? "needs_attention" : "complete",
      reasonCodes: !report.universe.present
        ? ["universe_missing"]
        : !report.universe.valid
          ? ["universe_invalid"]
          : []
    },
    {
      stage: "context",
      status: contextMissing ? "needs_attention" : report.target.valid ? "complete" : "pending",
      reasonCodes: [
        report.missingContext.why ? "context_missing_why" : undefined,
        report.missingContext.outcome ? "context_missing_outcome" : undefined
      ].filter((code): code is ThoughtProgressionFindingCode => Boolean(code))
    },
    {
      stage: "actionable",
      status: blockersPresent
        ? "blocked"
        : report.missingContext.nextAction
          ? "needs_attention"
          : report.target.valid
            ? "complete"
            : "pending",
      reasonCodes: [
        report.missingContext.nextAction ? "context_missing_next_action" : undefined,
        blockersPresent ? "active_blocker" : undefined
      ].filter((code): code is ThoughtProgressionFindingCode => Boolean(code))
    },
    {
      stage: "project_candidate",
      status: report.canPromoteToProject || report.canLinkToExistingProject
        ? "complete"
        : report.target.valid
          ? "pending"
          : "pending",
      reasonCodes: report.canPromoteToProject ? ["promotion_candidate"] : report.canLinkToExistingProject ? ["link_project_candidate"] : []
    },
    {
      stage: "promote_link_project",
      status: report.canPromoteToProject || report.canLinkToExistingProject ? "needs_attention" : "pending",
      reasonCodes: [
        report.canPromoteToProject ? "promotion_candidate" : undefined,
        report.canLinkToExistingProject ? "link_project_candidate" : undefined
      ].filter((code): code is ThoughtProgressionFindingCode => Boolean(code))
    }
  ];
}

function relationshipFindings(context: ThoughtRelationshipContext | undefined) {
  return (context?.findings ?? []).map((item) => finding(
    "relationship_warning",
    item.severity === "error" ? "error" : "warning",
    { type: item.target.type === "relationship" ? "relationship" : "thought", id: item.target.id },
    item.reason,
    item.evidenceIds
  ));
}

function buildFindings(
  thought: Readonly<ThoughtItem>,
  semanticRole: ThoughtSemanticRole,
  universe: ThoughtProgressionUniverseRef,
  classificationMissing: boolean,
  missingContext: ThoughtProgressionReport["missingContext"],
  activeBlockers: readonly GraphRelationshipContext[],
  activeDependencies: readonly GraphRelationshipContext[],
  unresolvedBlockingQuestions: readonly Readonly<BlockingQuestion>[],
  relationshipContext: ThoughtRelationshipContext,
  canPromoteToProject: boolean,
  canLinkToExistingProject: boolean,
  promotionBlocked: boolean
) {
  const findings: ThoughtProgressionFinding[] = [
    finding(
      semanticRoleFindingCode[semanticRole],
      "info",
      { type: "thought", id: thought.id },
      `Thought semantic role inferred as ${semanticRole}.`,
      [thought.id, thought.type]
    )
  ];

  if (thought.status === "inbox") {
    findings.push(finding(
      "thought_inbox",
      "info",
      { type: "thought", id: thought.id },
      "Thought is still in inbox and awaits triage.",
      [thought.id]
    ));
  }

  if (thought.status === "active") {
    findings.push(finding(
      "thought_active",
      "info",
      { type: "thought", id: thought.id },
      "Thought is active and can participate in planning.",
      [thought.id]
    ));
  }

  if (classificationMissing) {
    findings.push(finding(
      "classification_missing",
      "warning",
      { type: "thought", id: thought.id },
      "Inbox thought still has a generic note/reference/unknown role.",
      [thought.id, thought.type]
    ));
  }

  if (!universe.present) {
    findings.push(finding(
      "universe_missing",
      "warning",
      { type: "thought", id: thought.id },
      "Thought.universeId is empty.",
      [thought.id]
    ));
  } else if (!universe.valid) {
    findings.push(finding(
      "universe_invalid",
      "warning",
      { type: "thought", id: thought.id },
      "Thought.universeId does not resolve to a universe.",
      [thought.id, universe.id ?? ""]
    ));
  }

  if (missingContext.why) {
    findings.push(finding(
      "context_missing_why",
      "warning",
      { type: "thought", id: thought.id },
      "Thought.why is missing.",
      [thought.id]
    ));
  }

  if (missingContext.outcome) {
    findings.push(finding(
      "context_missing_outcome",
      "warning",
      { type: "thought", id: thought.id },
      "Thought.outcome is missing.",
      [thought.id]
    ));
  }

  if (missingContext.nextAction) {
    findings.push(finding(
      "context_missing_next_action",
      "warning",
      { type: "thought", id: thought.id },
      "Thought.nextAction is missing.",
      [thought.id]
    ));
  }

  for (const blocker of activeBlockers) {
    findings.push(finding(
      "active_blocker",
      "warning",
      { type: "relationship", id: blocker.relationship.id },
      "Incoming blocks relationship currently blocks this thought.",
      [thought.id, blocker.relationship.id]
    ));
  }

  for (const question of unresolvedBlockingQuestions) {
    findings.push(finding(
      "active_blocker",
      "warning",
      { type: "blockingQuestion", id: question.id },
      "Unresolved blocking question is linked to this thought.",
      [thought.id, question.id]
    ));
  }

  for (const dependencyItem of activeDependencies) {
    findings.push(finding(
      "active_dependency",
      "warning",
      { type: "relationship", id: dependencyItem.relationship.id },
      "depends_on relationship is part of this thought progression context.",
      [thought.id, dependencyItem.relationship.id]
    ));
  }

  if (canPromoteToProject) {
    findings.push(finding(
      "promotion_candidate",
      "info",
      { type: "thought", id: thought.id },
      "Thought has enough context to be promoted to a project candidate.",
      [thought.id]
    ));
  } else if (promotionBlocked) {
    findings.push(finding(
      "promotion_blocked",
      "warning",
      { type: "thought", id: thought.id },
      "Thought looks like a project seed but is missing required promotion inputs or has blockers.",
      [thought.id]
    ));
  }

  if (canLinkToExistingProject) {
    findings.push(finding(
      "link_project_candidate",
      "info",
      { type: "thought", id: thought.id },
      "Thought can be linked to an existing active project in the same universe.",
      [thought.id]
    ));
  }

  findings.push(...relationshipFindings(relationshipContext));

  return findings;
}

function commandDraft(
  thoughtId: string,
  commandType: string,
  label: string,
  reason: string,
  payloadPreview?: unknown
): ThoughtProgressionCommandDraft {
  return {
    id: `thought-progress:${thoughtId}:${commandType}`,
    commandType,
    label,
    reason,
    target: { type: "thought", id: thoughtId },
    requiresHumanConfirmation: true,
    ...(payloadPreview !== undefined ? { payloadPreview } : {})
  };
}

function suggestedCommands(
  thought: Readonly<ThoughtItem>,
  classificationMissing: boolean,
  universe: ThoughtProgressionUniverseRef,
  missingContext: ThoughtProgressionReport["missingContext"],
  canPromoteToProject: boolean,
  existingProjectCandidates: readonly Readonly<Project>[],
  hasBlockersOrWarnings: boolean
) {
  const commands: ThoughtProgressionCommandDraft[] = [];

  if (classificationMissing) {
    commands.push(commandDraft(
      thought.id,
      "classify_thought",
      "Classify thought",
      "Thought still has a generic inbox classification.",
      { currentType: thought.type }
    ));
  }

  if (!universe.present || !universe.valid) {
    commands.push(commandDraft(
      thought.id,
      "assign_universe",
      "Assign universe",
      "Thought needs a valid direct universeId.",
      { currentUniverseId: universe.id }
    ));
  }

  if (missingContext.why || missingContext.outcome) {
    commands.push(commandDraft(
      thought.id,
      "add_thought_context",
      "Add thought context",
      "Thought needs why/outcome context before it can progress.",
      { missing: { why: missingContext.why, outcome: missingContext.outcome } }
    ));
  }

  if (missingContext.nextAction) {
    commands.push(commandDraft(
      thought.id,
      "add_next_action",
      "Add next action",
      "Thought needs a next action before it can become actionable.",
      { currentNextAction: thought.nextAction }
    ));
  }

  if (existingProjectCandidates.length > 0) {
    commands.push(commandDraft(
      thought.id,
      "link_thought_to_project",
      "Link thought to project",
      "Thought can be linked to an existing project in the same universe.",
      { candidateProjectIds: existingProjectCandidates.map((project) => project.id) }
    ));
  }

  if (canPromoteToProject) {
    commands.push(commandDraft(
      thought.id,
      "promote_thought_to_project",
      "Promote thought to project",
      "Thought has project-seed shape and enough context to become a project candidate.",
      {
        title: thought.title,
        universeId: thought.universeId,
        nextAction: thought.nextAction
      }
    ));
  }

  if (hasBlockersOrWarnings) {
    commands.push(commandDraft(
      thought.id,
      "review_relationship_blockers",
      "Review blockers and relationships",
      "Thought has blockers, dependencies, or relationship warnings that need human review."
    ));
  }

  return commands.sort((a, b) => a.id.localeCompare(b.id));
}

function missingReport(thoughtId: string): ThoughtProgressionReport {
  const target = { type: "thought" as const, id: thoughtId, valid: false };
  const universe: ThoughtProgressionUniverseRef = { present: false, valid: false };
  const missingContext = { why: true, outcome: true, nextAction: true };
  const base = {
    target,
    isInbox: false,
    isActive: false,
    classificationMissing: false,
    semanticRole: "unknown" as const,
    universe,
    missingContext,
    relationships: {
      blockers: [],
      dependencies: [],
      unresolvedBlockingQuestions: [],
      relationshipWarnings: []
    },
    canPromoteToProject: false,
    canLinkToExistingProject: false,
    existingProjectCandidates: [],
    recommendedNextStage: "capture" as const
  };
  const findings = uniqueSortedFindings([
    finding(
      "target_missing",
      "error",
      { type: "missing", id: thoughtId },
      "ThoughtProgressionReport target id does not resolve to a thought.",
      [thoughtId]
    )
  ]);

  return {
    ...base,
    stages: stageSummary(base, [], []),
    findings,
    suggestedCommands: []
  };
}

export function buildThoughtProgressionReport(state: AppState, thoughtId: string): ThoughtProgressionReport {
  const index = buildDomainIndex(state);
  const thought = getById(index.thoughtById, thoughtId);

  if (!thought) return missingReport(thoughtId);

  const relationshipContext = buildThoughtRelationshipContext(state, thoughtId);
  const validRelationshipContext = relationshipContext.targetType === "thought" ? relationshipContext : undefined;
  const universeEntity = getById(index.universeById, thought.universeId);
  const universe: ThoughtProgressionUniverseRef = {
    id: thought.universeId || undefined,
    present: clean(thought.universeId).length > 0,
    valid: Boolean(universeEntity),
    entity: universeEntity
  };
  const semanticRole = inferSemanticRole(thought.type);
  const classificationMissing = isClassificationMissing(thought, semanticRole);
  const missingContext = {
    why: clean(thought.why).length === 0,
    outcome: clean(thought.outcome).length === 0,
    nextAction: clean(thought.nextAction).length === 0
  };
  const blockers = (validRelationshipContext?.blockersAndDependencies ?? []).filter(incomingBlocker);
  const dependencies = (validRelationshipContext?.blockersAndDependencies ?? []).filter(dependency);
  const unresolvedBlockingQuestions = unresolvedBlockingQuestionsForThought(state, thoughtId);
  const projects = Object.values(index.projectById);
  const existingProjectCandidates = activeProjectCandidates(projects, thought, universe);
  const canPromoteToProject = canPromote(
    thought,
    semanticRole,
    universe,
    missingContext,
    blockers,
    unresolvedBlockingQuestions
  );
  const canLinkToExistingProject = existingProjectCandidates.length > 0;
  const promotionBlocked = semanticRole === "project_seed" && !canPromoteToProject;
  const findingsWithoutReview = buildFindings(
    thought,
    semanticRole,
    universe,
    classificationMissing,
    missingContext,
    blockers,
    dependencies,
    unresolvedBlockingQuestions,
    validRelationshipContext ?? relationshipContext as ThoughtRelationshipContext,
    canPromoteToProject,
    canLinkToExistingProject,
    promotionBlocked
  );
  const relationshipWarnings = validRelationshipContext?.findings ?? [];
  const hasBlockersOrWarnings = blockers.length > 0 ||
    dependencies.length > 0 ||
    unresolvedBlockingQuestions.length > 0 ||
    relationshipWarnings.length > 0;
  const commands = suggestedCommands(
    thought,
    classificationMissing,
    universe,
    missingContext,
    canPromoteToProject,
    existingProjectCandidates,
    hasBlockersOrWarnings
  );
  const findings = uniqueSortedFindings([
    ...findingsWithoutReview,
    ...(commands.length > 0
      ? [finding(
          "needs_human_review",
          "info",
          { type: "thought", id: thought.id },
          "Suggested command drafts are metadata only and require human confirmation.",
          [thought.id, ...commands.map((command) => command.id)]
        )]
      : [])
  ]);
  const partialReport = {
    target: { type: "thought" as const, id: thoughtId, valid: true },
    isInbox: thought.status === "inbox",
    isActive: thought.status === "active",
    classificationMissing,
    semanticRole,
    universe,
    missingContext,
    canPromoteToProject,
    canLinkToExistingProject
  };
  const recommendedNextStage = recommendedStage(partialReport);

  return {
    ...partialReport,
    thought,
    relationshipContext: validRelationshipContext,
    relationships: {
      blockers,
      dependencies,
      unresolvedBlockingQuestions,
      relationshipWarnings
    },
    existingProjectCandidates,
    recommendedNextStage,
    stages: stageSummary(partialReport, blockers, unresolvedBlockingQuestions),
    findings,
    suggestedCommands: commands
  };
}

export function buildThoughtProgressionReports(state: AppState): ThoughtProgressionReport[] {
  return state.thoughts
    .map((thought) => buildThoughtProgressionReport(state, thought.id))
    .sort((a, b) => a.target.id.localeCompare(b.target.id));
}
