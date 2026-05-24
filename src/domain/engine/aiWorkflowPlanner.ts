import type {
  DomainCommand,
  DomainCommandContext,
  DomainCommandTarget
} from "../commandLayer";
import {
  buildDerivedReviewQueue,
  type DerivedReviewItem
} from "../derivedReviewQueue";
import {
  buildEngineeringHandoffPackage,
  type EngineeringHandoffPackage,
  type EngineeringHandoffSuggestedCommandDraft
} from "../engineeringHandoffPackage";
import {
  buildProjectReadinessReport,
  buildProjectReadinessReports,
  type ProjectReadinessCommandDraft,
  type ProjectReadinessFinding,
  type ProjectReadinessReport
} from "../projectReadinessReport";
import {
  buildThoughtProgressionReports,
  type ThoughtProgressionCommandDraft,
  type ThoughtProgressionFinding,
  type ThoughtProgressionReport
} from "../thoughtProgressionReport";
import type { AppState, Project, ThoughtItem } from "../types";
import {
  checkCommandAgainstConstraints,
  type ConstraintCheckResult
} from "./constraintRuntime";
import {
  buildNextBestActions,
  type NextBestAction,
  type NextBestActionScope,
  type NextBestActionSuggestedCommand,
  type NextBestActionTarget
} from "./nextBestActions";
import {
  buildProjectClusters,
  type ProjectCluster,
  type ProjectClusterSuggestedCommand
} from "./projectClusters";

export type AIWorkflowPlanScope = NextBestActionScope;

export type AIWorkflowPlanNodeType =
  | "triage_thought"
  | "add_context"
  | "assign_universe"
  | "link_project"
  | "promote_project"
  | "resolve_blocker"
  | "resolve_decision"
  | "review_ai_insight"
  | "mark_handoff_ready"
  | "generate_handoff_package"
  | "export_handoff_package"
  | "maintenance_review";

export type AIWorkflowPlanNodeStatus = "ready" | "blocked" | "disabled" | "informational";
export type AIWorkflowPlanPhaseId =
  | "context_cleanup"
  | "safety_review"
  | "handoff_package"
  | "guarded_handoff";
export type AIWorkflowPlanRiskSeverity = "info" | "warning" | "error";
export type AIWorkflowSuggestedCommandSource =
  | "next_best_action"
  | "project_cluster"
  | "project_readiness_report"
  | "thought_progression_report"
  | "handoff_package";

export interface AIWorkflowPlanTarget {
  type: string;
  id: string;
}

export interface AIWorkflowPlanDagNode {
  id: string;
  type: AIWorkflowPlanNodeType;
  title: string;
  summary: string;
  target: AIWorkflowPlanTarget;
  phaseId: AIWorkflowPlanPhaseId;
  status: AIWorkflowPlanNodeStatus;
  reasonCodes: string[];
  sourceIds: string[];
  commandIds: string[];
  evidence: unknown[];
}

export interface AIWorkflowPlanDagEdge {
  id: string;
  from: string;
  to: string;
  reason: string;
}

export interface AIWorkflowPlanPhase {
  id: AIWorkflowPlanPhaseId;
  title: string;
  summary: string;
  nodeIds: string[];
  blockedNodeIds: string[];
}

export interface AIWorkflowSuggestedCommand {
  id: string;
  source: AIWorkflowSuggestedCommandSource;
  commandType: string;
  label: string;
  reason: string;
  target: AIWorkflowPlanTarget;
  requiresHumanConfirmation: true;
  payloadPreview?: unknown;
  domainCommand?: DomainCommand;
  constraintResult?: ConstraintCheckResult;
  disabledReason?: string;
}

export interface AIWorkflowPlanRisk {
  code: string;
  severity: AIWorkflowPlanRiskSeverity;
  reason: string;
  evidence: unknown[];
}

export interface AIWorkflowPlan {
  version: 1;
  scope: AIWorkflowPlanScope;
  objectiveSummary: string;
  orderedPhases: AIWorkflowPlanPhase[];
  dagNodes: AIWorkflowPlanDagNode[];
  dagEdges: AIWorkflowPlanDagEdge[];
  blockedNodes: AIWorkflowPlanDagNode[];
  executableSuggestedCommands: AIWorkflowSuggestedCommand[];
  disabledSuggestedCommands: AIWorkflowSuggestedCommand[];
  humanConfirmationRequired: boolean;
  risks: AIWorkflowPlanRisk[];
  evidence: unknown[];
}

export interface BuildAIWorkflowPlanOptions {
  includeDisabled?: boolean;
  limitNextBestActions?: number;
  additionalDagNodes?: AIWorkflowPlanDagNode[];
  additionalDagEdges?: AIWorkflowPlanDagEdge[];
}

type AnySuggestedCommand =
  | NextBestActionSuggestedCommand
  | ProjectClusterSuggestedCommand
  | ProjectReadinessCommandDraft
  | ThoughtProgressionCommandDraft
  | EngineeringHandoffSuggestedCommandDraft;

type NodeDraft = AIWorkflowPlanDagNode;

const phaseOrder: AIWorkflowPlanPhaseId[] = [
  "context_cleanup",
  "safety_review",
  "handoff_package",
  "guarded_handoff"
];

const phaseRank = new Map(phaseOrder.map((phaseId, index) => [phaseId, index]));

const phaseTitles: Record<AIWorkflowPlanPhaseId, string> = {
  context_cleanup: "Context cleanup",
  safety_review: "Safety review",
  handoff_package: "Handoff package",
  guarded_handoff: "Guarded handoff"
};

const phaseSummaries: Record<AIWorkflowPlanPhaseId, string> = {
  context_cleanup: "Small, local context steps before project-level workflow changes.",
  safety_review: "Review blockers, decisions, AI drafts, relationship warnings, and readiness gates.",
  handoff_package: "Generate and export reviewable handoff material without changing AppState.",
  guarded_handoff: "Only guarded, human-confirmed lifecycle transition candidates."
};

const commandTargetTypes = new Set(["thought", "project", "relationship", "aiInsight"]);

function uniqueSortedStrings(values: readonly (string | undefined)[]) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
    .sort((a, b) => a.localeCompare(b));
}

function stableString(value: unknown) {
  if (typeof value === "string") return value;

  return JSON.stringify(value);
}

function normalizeEvidence(values: readonly unknown[]) {
  return [...values]
    .filter((value) => value !== undefined && value !== "")
    .sort((a, b) => stableString(a).localeCompare(stableString(b)));
}

function targetKey(target: AIWorkflowPlanTarget) {
  return `${target.type}:${target.id}`;
}

function nodeId(type: AIWorkflowPlanNodeType, target: AIWorkflowPlanTarget) {
  return `ai-workflow:${type}:${target.type}:${target.id}`;
}

function edgeId(from: string, to: string, reason: string) {
  return `ai-workflow-edge:${from}->${to}:${reason}`;
}

function statusRank(status: AIWorkflowPlanNodeStatus) {
  if (status === "disabled") return 4;
  if (status === "blocked") return 3;
  if (status === "ready") return 2;
  return 1;
}

function mergeStatus(
  current: AIWorkflowPlanNodeStatus,
  next: AIWorkflowPlanNodeStatus
): AIWorkflowPlanNodeStatus {
  return statusRank(next) > statusRank(current) ? next : current;
}

function compareNodes(a: AIWorkflowPlanDagNode, b: AIWorkflowPlanDagNode) {
  return (phaseRank.get(a.phaseId) ?? 99) - (phaseRank.get(b.phaseId) ?? 99) ||
    a.type.localeCompare(b.type) ||
    targetKey(a.target).localeCompare(targetKey(b.target)) ||
    a.id.localeCompare(b.id);
}

function compareEdges(a: AIWorkflowPlanDagEdge, b: AIWorkflowPlanDagEdge) {
  return a.from.localeCompare(b.from) ||
    a.to.localeCompare(b.to) ||
    a.reason.localeCompare(b.reason) ||
    a.id.localeCompare(b.id);
}

function mergeNodes(nodes: readonly NodeDraft[]) {
  const byId = new Map<string, AIWorkflowPlanDagNode>();

  for (const node of nodes) {
    const current = byId.get(node.id);
    if (!current) {
      byId.set(node.id, {
        ...node,
        reasonCodes: uniqueSortedStrings(node.reasonCodes),
        sourceIds: uniqueSortedStrings(node.sourceIds),
        commandIds: uniqueSortedStrings(node.commandIds),
        evidence: normalizeEvidence(node.evidence)
      });
      continue;
    }

    byId.set(node.id, {
      ...current,
      title: current.title.localeCompare(node.title) <= 0 ? current.title : node.title,
      summary: uniqueSortedStrings([current.summary, node.summary]).join(" "),
      status: mergeStatus(current.status, node.status),
      reasonCodes: uniqueSortedStrings([...current.reasonCodes, ...node.reasonCodes]),
      sourceIds: uniqueSortedStrings([...current.sourceIds, ...node.sourceIds]),
      commandIds: uniqueSortedStrings([...current.commandIds, ...node.commandIds]),
      evidence: normalizeEvidence([...current.evidence, ...node.evidence])
    });
  }

  return [...byId.values()].sort(compareNodes);
}

function uniqueEdges(edges: readonly AIWorkflowPlanDagEdge[]) {
  const byId = new Map<string, AIWorkflowPlanDagEdge>();

  for (const edge of edges) {
    if (edge.from !== edge.to && !byId.has(edge.id)) byId.set(edge.id, edge);
  }

  return [...byId.values()].sort(compareEdges);
}

function commandTarget(target: AIWorkflowPlanTarget): DomainCommandTarget | undefined {
  if (!commandTargetTypes.has(target.type)) return undefined;

  return {
    type: target.type as DomainCommandTarget["type"],
    id: target.id
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonicalCommandFromSuggested(
  command: AnySuggestedCommand,
  domainCommand?: DomainCommand
): DomainCommand | undefined {
  if (domainCommand) return domainCommand;

  const target = commandTarget(command.target);
  if (!target) return undefined;

  if (command.commandType === "mark_project_handoff_ready" || command.commandType === "project.markHandoffReady") {
    return {
      id: `ai-workflow:${command.id}:canonical`,
      type: "project.markHandoffReady",
      target,
      payload: {},
      source: "user",
      confirmedByUser: true
    };
  }

  if (command.commandType === "promote_thought_to_project" && target.type === "thought") {
    return {
      id: `ai-workflow:${command.id}:canonical`,
      type: "project.promoteFromThought",
      target,
      payload: command.payloadPreview ?? {},
      source: "user",
      confirmedByUser: true
    };
  }

  if (command.commandType === "recompute_update_stored_readiness" && target.type === "project" && isRecord(command.payloadPreview)) {
    return {
      id: `ai-workflow:${command.id}:canonical`,
      type: "project.updateReadiness",
      target,
      payload: { readiness: command.payloadPreview.computedReadiness },
      source: "user",
      confirmedByUser: true
    };
  }

  return undefined;
}

function shouldDisableBeforeConstraint(command: AnySuggestedCommand) {
  if (
    command.commandType === "project.markHandoffReady" &&
    isRecord(command.payloadPreview) &&
    command.payloadPreview.canMarkHandoffReady === false
  ) {
    return "Handoff preflight has not passed; keep this command as metadata until gates pass.";
  }

  return undefined;
}

function commandContextFor(command: DomainCommand): DomainCommandContext {
  return command.source === "ai"
    ? { actor: "ai", actorId: "ai-workflow-planner" }
    : { actor: "user", actorId: "ai-workflow-planner" };
}

function planCommand(input: {
  state: AppState;
  source: AIWorkflowSuggestedCommandSource;
  command: AnySuggestedCommand;
  domainCommand?: DomainCommand;
  disabledReason?: string;
}): AIWorkflowSuggestedCommand {
  const domainCommand = canonicalCommandFromSuggested(input.command, input.domainCommand);
  const preConstraintDisabledReason = input.disabledReason ?? shouldDisableBeforeConstraint(input.command);
  const constraintResult = domainCommand
    ? checkCommandAgainstConstraints(input.state, domainCommand, commandContextFor(domainCommand))
    : undefined;
  const disabledReason = preConstraintDisabledReason ??
    constraintResult?.disabledReason ??
    (!domainCommand ? "Suggested command is metadata-only; no canonical DomainCommand is attached." : undefined);

  return {
    id: `${input.source}:${input.command.id}`,
    source: input.source,
    commandType: input.command.commandType,
    label: input.command.label,
    reason: input.command.reason,
    target: input.command.target,
    requiresHumanConfirmation: true,
    ...(input.command.payloadPreview !== undefined ? { payloadPreview: input.command.payloadPreview } : {}),
    ...(domainCommand ? { domainCommand } : {}),
    ...(constraintResult ? { constraintResult } : {}),
    ...(disabledReason ? { disabledReason } : {})
  };
}

function nodeTypeForReasonCodes(reasonCodes: readonly string[]): AIWorkflowPlanNodeType {
  if (reasonCodes.some((code) => code === "thought_inbox" || code === "classification_missing")) return "triage_thought";
  if (reasonCodes.some((code) => code.startsWith("context_missing") || code === "engineering_draft_candidate")) return "add_context";
  if (reasonCodes.some((code) => code === "universe_missing" || code === "universe_invalid")) return "assign_universe";
  if (reasonCodes.includes("link_project_candidate")) return "link_project";
  if (reasonCodes.some((code) => code === "promotion_candidate" || code === "promotion_blocked")) return "promote_project";
  if (reasonCodes.includes("active_blocker")) return "resolve_blocker";
  if (reasonCodes.some((code) =>
    code === "proposed_decision" ||
    code === "open_blocking_question" ||
    code === "in_review_blocking_question"
  )) {
    return "resolve_decision";
  }
  if (reasonCodes.some((code) => code === "pending_ai_draft" || code === "invalid_ai_patch_target")) return "review_ai_insight";
  if (reasonCodes.some((code) => code === "handoff_candidate" || code === "computed_readiness_ready_for_engineering")) return "mark_handoff_ready";

  return "maintenance_review";
}

function phaseForNodeType(type: AIWorkflowPlanNodeType): AIWorkflowPlanPhaseId {
  if (
    type === "triage_thought" ||
    type === "add_context" ||
    type === "assign_universe" ||
    type === "link_project" ||
    type === "promote_project"
  ) {
    return "context_cleanup";
  }
  if (type === "generate_handoff_package" || type === "export_handoff_package") return "handoff_package";
  if (type === "mark_handoff_ready") return "guarded_handoff";

  return "safety_review";
}

function statusFromInput(input: {
  reasonCodes: readonly string[];
  severity?: string;
  disabledReason?: string;
  blocked?: boolean;
}): AIWorkflowPlanNodeStatus {
  if (input.disabledReason) return "disabled";
  if (input.blocked) return "blocked";
  if (input.severity === "error" || input.severity === "warning") return "blocked";
  if (input.reasonCodes.includes("handoff_preflight_blocked")) return "blocked";
  if (input.reasonCodes.includes("target_missing")) return "blocked";

  return "ready";
}

function nodeFromAction(action: NextBestAction): NodeDraft {
  const type = nodeTypeForReasonCodes(action.reasonCodes);
  const commandIds = action.suggestedCommand ? [action.suggestedCommand.id] : [];

  return {
    id: nodeId(type, action.target),
    type,
    title: action.title,
    summary: action.summary,
    target: action.target,
    phaseId: phaseForNodeType(type),
    status: statusFromInput({
      reasonCodes: action.reasonCodes,
      disabledReason: action.disabledReason,
      blocked: action.priority === "critical" || action.priority === "high"
    }),
    reasonCodes: action.reasonCodes,
    sourceIds: action.sourceIds,
    commandIds,
    evidence: action.evidence
  };
}

function nodeFromThoughtFinding(report: ThoughtProgressionReport, finding: ThoughtProgressionFinding): NodeDraft {
  const type = nodeTypeForReasonCodes([finding.code]);

  return {
    id: nodeId(type, finding.target),
    type,
    title: `Thought workflow: ${finding.code}`,
    summary: finding.reason,
    target: finding.target,
    phaseId: phaseForNodeType(type),
    status: statusFromInput({ reasonCodes: [finding.code], severity: finding.severity }),
    reasonCodes: [finding.code],
    sourceIds: [`thought-progression:${report.target.id}:${finding.code}`],
    commandIds: report.suggestedCommands.map((command) => command.id),
    evidence: finding.evidenceIds
  };
}

function nodeFromProjectFinding(report: ProjectReadinessReport, finding: ProjectReadinessFinding): NodeDraft {
  const type = nodeTypeForReasonCodes([finding.code]);

  return {
    id: nodeId(type, finding.target),
    type,
    title: `Project workflow: ${finding.code}`,
    summary: finding.reason,
    target: finding.target,
    phaseId: phaseForNodeType(type),
    status: statusFromInput({ reasonCodes: [finding.code], severity: finding.severity }),
    reasonCodes: [finding.code],
    sourceIds: [`project-readiness:${report.target.id}:${finding.code}`],
    commandIds: report.suggestedCommands.map((command) => command.id),
    evidence: finding.evidenceIds
  };
}

function preflightNode(report: ProjectReadinessReport): NodeDraft {
  const code = report.handoffPreflight.passed ? "handoff_preflight_passed" : "handoff_preflight_blocked";

  return {
    id: nodeId("maintenance_review", report.target),
    type: "maintenance_review",
    title: "Review handoff readiness gates",
    summary: report.handoffPreflight.passed
      ? "Project passed read-only handoff preflight."
      : "Project handoff preflight is blocked by one or more readiness gates.",
    target: report.target,
    phaseId: "safety_review",
    status: report.handoffPreflight.passed ? "ready" : "blocked",
    reasonCodes: [code, ...report.handoffPreflight.blockedReasonCodes],
    sourceIds: [`project-readiness:${report.target.id}:handoff-preflight`],
    commandIds: report.suggestedCommands.map((command) => command.id),
    evidence: [
      {
        source: "ProjectReadinessReport",
        projectId: report.target.id,
        passed: report.handoffPreflight.passed,
        blockedReasonCodes: report.handoffPreflight.blockedReasonCodes
      }
    ]
  };
}

function projectHandoffNodes(report: ProjectReadinessReport, handoffPackage?: EngineeringHandoffPackage): NodeDraft[] {
  const nodes: NodeDraft[] = [];

  if (report.canGenerateEngineeringDraft || handoffPackage) {
    nodes.push({
      id: nodeId("generate_handoff_package", report.target),
      type: "generate_handoff_package",
      title: "Generate handoff package",
      summary: "Build a deterministic EngineeringHandoffPackage for human review without changing lifecycle state.",
      target: report.target,
      phaseId: "handoff_package",
      status: report.canGenerateEngineeringDraft ? "ready" : "blocked",
      reasonCodes: ["engineering_draft_candidate"],
      sourceIds: [
        `project-readiness:${report.target.id}:engineering_draft_candidate`,
        ...(handoffPackage ? [`engineering-handoff-package:${handoffPackage.projectId}`] : [])
      ],
      commandIds: [],
      evidence: [
        {
          source: "EngineeringHandoffPackage",
          projectId: report.target.id,
          valid: handoffPackage?.valid ?? false
        }
      ]
    });
  }

  if (handoffPackage) {
    nodes.push({
      id: nodeId("export_handoff_package", report.target),
      type: "export_handoff_package",
      title: "Export handoff package",
      summary: "Export the reviewed handoff draft for downstream engineering intake.",
      target: report.target,
      phaseId: "handoff_package",
      status: handoffPackage.valid ? "ready" : "blocked",
      reasonCodes: ["engineering_handoff_package"],
      sourceIds: [`engineering-handoff-package:${handoffPackage.projectId}`],
      commandIds: handoffPackage.suggestedCommands.map((command) => command.id),
      evidence: [
        {
          source: "EngineeringHandoffPackage",
          projectId: handoffPackage.projectId,
          valid: handoffPackage.valid,
          blockerIds: handoffPackage.blockers.map((blocker) => blocker.id)
        }
      ]
    });
  }

  if (report.canMarkHandoffReady) {
    nodes.push({
      id: nodeId("mark_handoff_ready", report.target),
      type: "mark_handoff_ready",
      title: "Mark project handoff ready",
      summary: "Use the guarded command only after human confirmation.",
      target: report.target,
      phaseId: "guarded_handoff",
      status: "ready",
      reasonCodes: ["handoff_candidate"],
      sourceIds: [`project-readiness:${report.target.id}:handoff_candidate`],
      commandIds: report.suggestedCommands
        .filter((command) => command.commandType === "mark_project_handoff_ready")
        .map((command) => command.id),
      evidence: [report.target.id]
    });
  }

  return nodes;
}

function nodeFromCluster(cluster: ProjectCluster): NodeDraft | undefined {
  const target = cluster.primaryProjectId
    ? { type: "project", id: cluster.primaryProjectId }
    : cluster.thoughtIds[0]
      ? { type: "thought", id: cluster.thoughtIds[0] }
      : cluster.projectIds[0]
        ? { type: "project", id: cluster.projectIds[0] }
        : cluster.relationshipIds[0]
          ? { type: "relationship", id: cluster.relationshipIds[0] }
          : undefined;
  if (!target) return undefined;

  const type: AIWorkflowPlanNodeType = cluster.kind === "project_candidate_cluster"
    ? "promote_project"
    : cluster.kind === "orphan_or_warning_cluster"
      ? "maintenance_review"
      : "maintenance_review";

  return {
    id: nodeId(type, target),
    type,
    title: cluster.title,
    summary: cluster.summary,
    target,
    phaseId: phaseForNodeType(type),
    status: cluster.warnings.length > 0 ? "blocked" : cluster.kind === "project_candidate_cluster" ? "ready" : "informational",
    reasonCodes: cluster.reasons,
    sourceIds: [cluster.id],
    commandIds: cluster.suggestedCommands.map((command) => command.id),
    evidence: cluster.evidence
  };
}

function scopedEntityIds(state: AppState, scope: AIWorkflowPlanScope) {
  const ids = new Set<string>([scope.type]);
  if (scope.type === "app") return ids;

  ids.add(scope.id);

  if (scope.type === "project") {
    const project = state.projects.find((item) => item.id === scope.id);
    if (project) {
      addProjectIds(ids, project);
      for (const thought of state.thoughts.filter((item) => item.projectId === project.id)) addThoughtIds(ids, thought);
    }
  }

  if (scope.type === "thought") {
    const thought = state.thoughts.find((item) => item.id === scope.id);
    if (thought) addThoughtIds(ids, thought);
  }

  if (scope.type === "universe") {
    for (const thought of state.thoughts.filter((item) => item.universeId === scope.id)) addThoughtIds(ids, thought);
    for (const project of state.projects.filter((item) => item.universeId === scope.id)) addProjectIds(ids, project);
  }

  return ids;
}

function addProjectIds(ids: Set<string>, project: Readonly<Project>) {
  ids.add(project.id);
  ids.add(project.universeId);
  if (project.sourceThoughtId) ids.add(project.sourceThoughtId);
  for (const thoughtId of project.linkedThoughtIds ?? []) ids.add(thoughtId);
}

function addThoughtIds(ids: Set<string>, thought: Readonly<ThoughtItem>) {
  ids.add(thought.id);
  ids.add(thought.universeId);
  if (thought.projectId) ids.add(thought.projectId);
}

function evidenceMatchesScope(evidence: readonly unknown[], ids: ReadonlySet<string>) {
  return evidence.some((item) => ids.has(String(item)) || [...ids].some((id) => stableString(item).includes(id)));
}

function matchesScope(
  state: AppState,
  scope: AIWorkflowPlanScope,
  input: {
    target: AIWorkflowPlanTarget;
    evidence?: readonly unknown[];
    sourceIds?: readonly string[];
  }
) {
  if (scope.type === "app") return true;

  const ids = scopedEntityIds(state, scope);
  if (ids.has(input.target.id)) return true;
  if ((input.sourceIds ?? []).some((id) => ids.has(id) || [...ids].some((scopeId) => id.includes(scopeId)))) return true;

  return evidenceMatchesScope(input.evidence ?? [], ids);
}

function relevantProjectReports(state: AppState, scope: AIWorkflowPlanScope): ProjectReadinessReport[] {
  if (scope.type === "project") return [buildProjectReadinessReport(state, scope.id)];

  return buildProjectReadinessReports(state)
    .filter((report) => matchesScope(state, scope, {
      target: report.target,
      evidence: report.findings.flatMap((finding) => finding.evidenceIds),
      sourceIds: report.findings.map((finding) => finding.code)
    }));
}

function relevantThoughtReports(state: AppState, scope: AIWorkflowPlanScope): ThoughtProgressionReport[] {
  return buildThoughtProgressionReports(state)
    .filter((report) => matchesScope(state, scope, {
      target: report.target,
      evidence: report.findings.flatMap((finding) => finding.evidenceIds),
      sourceIds: report.findings.map((finding) => finding.code)
    }));
}

function relevantClusters(state: AppState, scope: AIWorkflowPlanScope): ProjectCluster[] {
  return buildProjectClusters(state)
    .filter((cluster) => {
      if (scope.type === "app") return true;
      const ids = scopedEntityIds(state, scope);

      return [
        ...cluster.thoughtIds,
        ...cluster.projectIds,
        ...cluster.universeIds,
        ...cluster.relationshipIds
      ].some((id) => ids.has(id)) || evidenceMatchesScope(cluster.evidence, ids);
    });
}

function relevantReviewItems(state: AppState, scope: AIWorkflowPlanScope): DerivedReviewItem[] {
  return buildDerivedReviewQueue(state)
    .filter((item) => matchesScope(state, scope, {
      target: item.target,
      evidence: item.evidence,
      sourceIds: [item.sourceCode, item.id]
    }));
}

function buildPhaseEdges(nodes: readonly AIWorkflowPlanDagNode[]) {
  const edges: AIWorkflowPlanDagEdge[] = [];
  const nodesByPhase = new Map<AIWorkflowPlanPhaseId, AIWorkflowPlanDagNode[]>();

  for (const node of nodes) {
    nodesByPhase.set(node.phaseId, [...(nodesByPhase.get(node.phaseId) ?? []), node]);
  }

  const contextNodes = nodesByPhase.get("context_cleanup") ?? [];
  const safetyNodes = nodesByPhase.get("safety_review") ?? [];
  const handoffNodes = nodesByPhase.get("handoff_package") ?? [];
  const guardedNodes = nodesByPhase.get("guarded_handoff") ?? [];
  const generateNodes = handoffNodes.filter((node) => node.type === "generate_handoff_package");
  const exportNodes = handoffNodes.filter((node) => node.type === "export_handoff_package");

  for (const from of contextNodes) {
    for (const to of safetyNodes) {
      edges.push({ id: edgeId(from.id, to.id, "context_before_safety"), from: from.id, to: to.id, reason: "context_before_safety" });
    }
  }

  for (const to of generateNodes) {
    const prerequisites = safetyNodes.length > 0 ? safetyNodes : contextNodes;
    for (const from of prerequisites) {
      edges.push({ id: edgeId(from.id, to.id, "readiness_gates_before_handoff_package"), from: from.id, to: to.id, reason: "readiness_gates_before_handoff_package" });
    }
  }

  for (const from of generateNodes) {
    for (const to of exportNodes) {
      edges.push({ id: edgeId(from.id, to.id, "generate_before_export"), from: from.id, to: to.id, reason: "generate_before_export" });
    }
  }

  for (const to of guardedNodes) {
    const prerequisites = exportNodes.length > 0 ? exportNodes : generateNodes.length > 0 ? generateNodes : safetyNodes;
    for (const from of prerequisites) {
      edges.push({ id: edgeId(from.id, to.id, "reviewable_package_before_guarded_handoff"), from: from.id, to: to.id, reason: "reviewable_package_before_guarded_handoff" });
    }
  }

  return uniqueEdges(edges);
}

function detectCycle(
  nodes: readonly AIWorkflowPlanDagNode[],
  edges: readonly AIWorkflowPlanDagEdge[]
) {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const id of nodeIds) {
    adjacency.set(id, []);
    inDegree.set(id, 0);
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) continue;
    adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), edge.to]);
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
  }

  const queue = [...inDegree.entries()]
    .filter(([, degree]) => degree === 0)
    .map(([id]) => id)
    .sort((a, b) => a.localeCompare(b));
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    visited.add(current);

    for (const next of adjacency.get(current) ?? []) {
      const nextDegree = (inDegree.get(next) ?? 0) - 1;
      inDegree.set(next, nextDegree);
      if (nextDegree === 0) {
        queue.push(next);
        queue.sort((a, b) => a.localeCompare(b));
      }
    }
  }

  if (visited.size === nodeIds.size) {
    return { hasCycle: false, nodeIds: [] as string[] };
  }

  return {
    hasCycle: true,
    nodeIds: [...nodeIds].filter((id) => !visited.has(id)).sort((a, b) => a.localeCompare(b))
  };
}

function buildPhases(nodes: readonly AIWorkflowPlanDagNode[]): AIWorkflowPlanPhase[] {
  return phaseOrder.map((phaseId) => {
    const phaseNodes = nodes.filter((node) => node.phaseId === phaseId).sort(compareNodes);

    return {
      id: phaseId,
      title: phaseTitles[phaseId],
      summary: phaseSummaries[phaseId],
      nodeIds: phaseNodes.map((node) => node.id),
      blockedNodeIds: phaseNodes
        .filter((node) => node.status === "blocked" || node.status === "disabled")
        .map((node) => node.id)
    };
  }).filter((phase) => phase.nodeIds.length > 0);
}

function objectiveSummary(
  state: AppState,
  scope: AIWorkflowPlanScope,
  report?: ProjectReadinessReport
) {
  if (scope.type === "project") {
    const project = state.projects.find((item) => item.id === scope.id);
    const label = project?.name ?? scope.id;

    return report?.handoffPreflight.passed
      ? `Plan safe handoff workflow for ${label}; readiness gates currently pass.`
      : `Plan safe project workflow for ${label}; resolve gates before guarded handoff.`;
  }

  if (scope.type === "thought") return `Plan small safe workflow steps for thought ${scope.id}.`;
  if (scope.type === "universe") return `Plan safe workflow steps inside universe ${scope.id}.`;

  return "Plan app-wide review, cleanup, and handoff steps without executing commands.";
}

function buildRisks(input: {
  cycleNodeIds: readonly string[];
  disabledCommands: readonly AIWorkflowSuggestedCommand[];
  blockedNodes: readonly AIWorkflowPlanDagNode[];
  projectReports: readonly ProjectReadinessReport[];
  handoffPackage?: EngineeringHandoffPackage;
}) {
  const risks: AIWorkflowPlanRisk[] = [];

  if (input.cycleNodeIds.length > 0) {
    risks.push({
      code: "dag_cycle_detected",
      severity: "warning",
      reason: "Workflow DAG contains a cycle; the planner reports it and leaves the graph unchanged.",
      evidence: [...input.cycleNodeIds]
    });
  }

  if (input.disabledCommands.length > 0) {
    risks.push({
      code: "disabled_suggested_commands_present",
      severity: "warning",
      reason: "Some suggested commands are metadata-only or failed ConstraintRuntime preflight.",
      evidence: input.disabledCommands.map((command) => ({
        id: command.id,
        commandType: command.commandType,
        disabledReason: command.disabledReason
      }))
    });
  }

  if (input.blockedNodes.length > 0) {
    risks.push({
      code: "blocked_workflow_nodes_present",
      severity: "warning",
      reason: "One or more workflow nodes are blocked and should be resolved before later phases.",
      evidence: input.blockedNodes.map((node) => ({
        id: node.id,
        type: node.type,
        reasonCodes: node.reasonCodes
      }))
    });
  }

  const blockedPreflightReports = input.projectReports.filter((report) => !report.handoffPreflight.passed);
  if (blockedPreflightReports.length > 0) {
    risks.push({
      code: "handoff_preflight_blocked",
      severity: "warning",
      reason: "At least one project has blocked handoff preflight gates.",
      evidence: blockedPreflightReports.map((report) => ({
        projectId: report.target.id,
        blockedReasonCodes: report.handoffPreflight.blockedReasonCodes
      }))
    });
  }

  if (input.handoffPackage && !input.handoffPackage.valid) {
    risks.push({
      code: "invalid_handoff_package",
      severity: "warning",
      reason: "The project handoff package is present as a review artifact but is not valid yet.",
      evidence: [input.handoffPackage.reason ?? input.handoffPackage.projectId]
    });
  }

  risks.push({
    code: "commands_require_human_confirmation",
    severity: "info",
    reason: "The planner only emits reviewable command metadata; it does not execute commands.",
    evidence: ["ConstraintRuntime", "humanConfirmationRequired"]
  });

  return risks.sort((a, b) => a.severity.localeCompare(b.severity) || a.code.localeCompare(b.code));
}

function commandSourceIds(commands: readonly AIWorkflowSuggestedCommand[]) {
  return commands.map((command) => `${command.source}:${command.commandType}:${command.target.type}:${command.target.id}`);
}

export function buildAIWorkflowPlan(
  state: AppState,
  scope: AIWorkflowPlanScope = { type: "app" },
  options: BuildAIWorkflowPlanOptions = {}
): AIWorkflowPlan {
  const nextBestActions = buildNextBestActions(state, scope, {
    includeDisabled: options.includeDisabled ?? true,
    limit: options.limitNextBestActions
  });
  const projectReports = relevantProjectReports(state, scope);
  const thoughtReports = relevantThoughtReports(state, scope);
  const clusters = relevantClusters(state, scope);
  const reviewItems = relevantReviewItems(state, scope);
  const handoffPackage = scope.type === "project"
    ? buildEngineeringHandoffPackage(state, scope.id)
    : undefined;
  const primaryProjectReport = scope.type === "project"
    ? projectReports.find((report) => report.target.id === scope.id)
    : undefined;

  const nextBestCommands = nextBestActions
    .filter((action) => action.suggestedCommand)
    .map((action) => planCommand({
      state,
      source: "next_best_action",
      command: action.suggestedCommand as NextBestActionSuggestedCommand,
      domainCommand: action.suggestedCommand?.domainCommand,
      disabledReason: action.disabledReason
    }));
  const clusterCommands = clusters.flatMap((cluster) =>
    cluster.suggestedCommands.map((command) => planCommand({ state, source: "project_cluster", command }))
  );
  const projectReportCommands = projectReports.flatMap((report) =>
    report.suggestedCommands.map((command) => planCommand({ state, source: "project_readiness_report", command }))
  );
  const thoughtReportCommands = thoughtReports.flatMap((report) =>
    report.suggestedCommands.map((command) => planCommand({ state, source: "thought_progression_report", command }))
  );
  const handoffCommands = handoffPackage
    ? handoffPackage.suggestedCommands.map((command) => planCommand({ state, source: "handoff_package", command }))
    : [];
  const allCommands = [
    ...nextBestCommands,
    ...clusterCommands,
    ...projectReportCommands,
    ...thoughtReportCommands,
    ...handoffCommands
  ].sort((a, b) => a.id.localeCompare(b.id));
  const executableSuggestedCommands = allCommands.filter((command) =>
    command.domainCommand &&
    !command.disabledReason &&
    command.constraintResult?.allowed
  );
  const disabledSuggestedCommands = allCommands.filter((command) => !executableSuggestedCommands.includes(command));
  const commandIds = commandSourceIds(allCommands);

  const nodes = mergeNodes([
    ...nextBestActions.map(nodeFromAction),
    ...thoughtReports.flatMap((report) => report.findings.map((finding) => nodeFromThoughtFinding(report, finding))),
    ...projectReports.flatMap((report) => [
      preflightNode(report),
      ...report.findings.map((finding) => nodeFromProjectFinding(report, finding)),
      ...projectHandoffNodes(report, handoffPackage)
    ]),
    ...clusters.map(nodeFromCluster).filter((node): node is NodeDraft => Boolean(node)),
    ...(options.additionalDagNodes ?? [])
  ].map((node) => ({
    ...node,
    commandIds: uniqueSortedStrings([...node.commandIds, ...commandIds.filter((id) => id.includes(`${node.target.type}:${node.target.id}`))])
  })));
  const dagEdges = uniqueEdges([
    ...buildPhaseEdges(nodes),
    ...(options.additionalDagEdges ?? [])
  ]);
  const cycle = detectCycle(nodes, dagEdges);
  const blockedNodes = nodes
    .filter((node) =>
      node.status === "blocked" ||
      node.status === "disabled" ||
      cycle.nodeIds.includes(node.id)
    )
    .sort(compareNodes);

  return {
    version: 1,
    scope,
    objectiveSummary: objectiveSummary(state, scope, primaryProjectReport),
    orderedPhases: buildPhases(nodes),
    dagNodes: nodes,
    dagEdges,
    blockedNodes,
    executableSuggestedCommands,
    disabledSuggestedCommands,
    humanConfirmationRequired: allCommands.length > 0 || nodes.length > 0,
    risks: buildRisks({
      cycleNodeIds: cycle.nodeIds,
      disabledCommands: disabledSuggestedCommands,
      blockedNodes,
      projectReports,
      handoffPackage
    }),
    evidence: normalizeEvidence([
      {
        source: "NextBestActionEngine",
        actionIds: nextBestActions.map((action) => action.id)
      },
      {
        source: "ProjectClusterEngine",
        clusterIds: clusters.map((cluster) => cluster.id)
      },
      {
        source: "ReviewItems",
        reviewItemIds: reviewItems.map((item) => item.id)
      },
      {
        source: "ProjectReadinessReport",
        projectIds: projectReports.map((report) => report.target.id)
      },
      {
        source: "ThoughtProgressionReport",
        thoughtIds: thoughtReports.map((report) => report.target.id)
      },
      handoffPackage
        ? {
            source: "EngineeringHandoffPackage",
            projectId: handoffPackage.projectId,
            valid: handoffPackage.valid
          }
        : undefined,
      {
        source: "ConstraintRuntime",
        executableCommandIds: executableSuggestedCommands.map((command) => command.id),
        disabledCommandIds: disabledSuggestedCommands.map((command) => command.id)
      }
    ])
  };
}
