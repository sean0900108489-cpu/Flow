import {
  buildAppHealthReport,
  type AppHealthFinding,
  type AppHealthSeverity
} from "../appHealthReport";
import type {
  DomainCommand,
  DomainCommandContext
} from "../commandLayer";
import {
  buildDerivedReviewQueue,
  type DerivedReviewItem,
  type DerivedReviewSuggestedCommandDraft,
  type DerivedReviewTarget
} from "../derivedReviewQueue";
import {
  buildProjectReadinessReports,
  type ProjectReadinessFinding,
  type ProjectReadinessReport
} from "../projectReadinessReport";
import {
  buildThoughtProgressionReports,
  type ThoughtProgressionFinding,
  type ThoughtProgressionReport
} from "../thoughtProgressionReport";
import type { AppState, Project, ThoughtItem } from "../types";
import { checkCommandAgainstConstraints } from "./constraintRuntime";

export type NextBestActionPriority = "critical" | "high" | "medium" | "low";
export type NextBestActionEstimate = "high" | "medium" | "low";

export type NextBestActionScope =
  | { type: "app" }
  | { type: "universe"; id: string }
  | { type: "project"; id: string }
  | { type: "thought"; id: string };

export interface NextBestActionTarget {
  type: string;
  id: string;
}

export interface NextBestActionSuggestedCommand {
  id: string;
  commandType: string;
  label: string;
  reason: string;
  target: NextBestActionTarget;
  requiresHumanConfirmation: true;
  payloadPreview?: unknown;
  domainCommand?: DomainCommand;
}

export interface NextBestAction {
  id: string;
  title: string;
  summary: string;
  target: NextBestActionTarget;
  priority: NextBestActionPriority;
  reasonCodes: string[];
  evidence: unknown[];
  suggestedCommand?: NextBestActionSuggestedCommand;
  disabledReason?: string;
  estimatedImpact: NextBestActionEstimate;
  estimatedRisk: NextBestActionEstimate;
  sourceIds: string[];
  sortKey: string;
}

export interface BuildNextBestActionsOptions {
  includeDisabled?: boolean;
  limit?: number;
}

interface ActionDraft extends Omit<NextBestAction, "sortKey"> {
  rank: number;
}

const safetyCodes = new Set([
  "duplicate_id",
  "orphan_relationship",
  "ambiguous_relationship_endpoint",
  "direct_ref_drift",
  "invalid_universe_ref",
  "invalid_project_ref",
  "invalid_linked_thought_id",
  "invalid_source_thought_id",
  "invalid_relationship_endpoint",
  "invariant_warning",
  "target_missing"
]);

const blockerCodes = new Set([
  "active_blocker",
  "pending_ai_draft",
  "proposed_decision",
  "open_blocking_question",
  "in_review_blocking_question",
  "promotion_blocked",
  "handoff_preflight_blocked"
]);

const handoffStaleCodes = new Set([
  "stale_handoff",
  "lifecycle_drift"
]);

const guardedHandoffCodes = new Set([
  "handoff_candidate",
  "computed_readiness_ready_for_engineering",
  "handoff_preflight_passed"
]);

const inboxCodes = new Set([
  "thought_inbox",
  "classification_missing",
  "universe_missing",
  "universe_invalid"
]);

const contextCleanupCodes = new Set([
  "context_missing_why",
  "context_missing_outcome",
  "context_missing_next_action",
  "engineering_draft_candidate",
  "promotion_candidate",
  "link_project_candidate",
  "needs_human_review"
]);

function uniqueSortedStrings(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function normalizeEvidence(values: readonly unknown[]) {
  return [...values]
    .filter((value) => value !== undefined && value !== "")
    .sort((a, b) => String(a).localeCompare(String(b)));
}

function targetKey(target: NextBestActionTarget) {
  return `${target.type}:${target.id}`;
}

function severityRank(severity?: AppHealthSeverity) {
  if (severity === "error") return 90;
  if (severity === "warning") return 55;
  return 25;
}

function rankForCodes(reasonCodes: readonly string[], severity?: AppHealthSeverity) {
  if (reasonCodes.some((code) => safetyCodes.has(code))) return 100;
  if (reasonCodes.includes("invalid_ai_patch_target")) return 95;
  if (reasonCodes.some((code) => handoffStaleCodes.has(code))) return 85;
  if (reasonCodes.some((code) => blockerCodes.has(code))) return 75;
  if (reasonCodes.some((code) => guardedHandoffCodes.has(code))) return 62;
  if (reasonCodes.some((code) => inboxCodes.has(code))) return 52;
  if (reasonCodes.includes("readiness_drift") || reasonCodes.includes("stored_readiness_missing")) return 48;
  if (reasonCodes.some((code) => contextCleanupCodes.has(code))) return 35;

  return severityRank(severity);
}

function priorityForRank(rank: number): NextBestActionPriority {
  if (rank >= 90) return "critical";
  if (rank >= 70) return "high";
  if (rank >= 45) return "medium";
  return "low";
}

function impactForRank(rank: number): NextBestActionEstimate {
  if (rank >= 70) return "high";
  if (rank >= 45) return "medium";
  return "low";
}

function riskForAction(
  reasonCodes: readonly string[],
  suggestedCommand?: NextBestActionSuggestedCommand,
  disabledReason?: string
): NextBestActionEstimate {
  if (disabledReason) return "high";
  if (reasonCodes.some((code) => safetyCodes.has(code) || code === "invalid_ai_patch_target")) return "medium";
  if (suggestedCommand?.domainCommand) return "medium";
  return "low";
}

function titleForCodes(reasonCodes: readonly string[], fallback: string) {
  if (reasonCodes.includes("invalid_ai_patch_target")) return "Review invalid AI accept path";
  if (reasonCodes.some((code) => safetyCodes.has(code))) return "Resolve state safety warning";
  if (reasonCodes.some((code) => handoffStaleCodes.has(code))) return "Review stale handoff state";
  if (reasonCodes.includes("active_blocker")) return "Clear project blocker";
  if (reasonCodes.includes("open_blocking_question")) return "Answer blocking question";
  if (reasonCodes.includes("in_review_blocking_question")) return "Review blocking question";
  if (reasonCodes.includes("proposed_decision")) return "Review proposed decision";
  if (reasonCodes.includes("pending_ai_draft")) return "Review pending AI draft";
  if (reasonCodes.includes("handoff_candidate")) return "Mark project handoff ready";
  if (reasonCodes.includes("engineering_draft_candidate")) return "Generate engineering draft";
  if (reasonCodes.includes("thought_inbox") || reasonCodes.includes("classification_missing")) return "Triage inbox thought";
  if (reasonCodes.includes("readiness_drift")) return "Reconcile readiness drift";
  if (reasonCodes.some((code) => contextCleanupCodes.has(code))) return "Clean up planning context";

  return fallback;
}

function suggestedFromDraft(
  draft: DerivedReviewSuggestedCommandDraft,
  domainCommand?: DomainCommand
): NextBestActionSuggestedCommand {
  return {
    id: draft.id,
    commandType: draft.commandType,
    label: draft.label,
    reason: draft.reason,
    target: draft.target,
    requiresHumanConfirmation: true,
    ...(draft.payloadPreview !== undefined ? { payloadPreview: draft.payloadPreview } : {}),
    ...(domainCommand ? { domainCommand } : {})
  };
}

function reviewDraftForCommand(input: {
  id: string;
  commandType: string;
  label: string;
  reason: string;
  target: NextBestActionTarget;
  payloadPreview?: unknown;
  domainCommand?: DomainCommand;
}): NextBestActionSuggestedCommand {
  return {
    id: input.id,
    commandType: input.commandType,
    label: input.label,
    reason: input.reason,
    target: input.target,
    requiresHumanConfirmation: true,
    ...(input.payloadPreview !== undefined ? { payloadPreview: input.payloadPreview } : {}),
    ...(input.domainCommand ? { domainCommand: input.domainCommand } : {})
  };
}

function markHandoffReadyCommand(projectId: string): DomainCommand {
  return {
    id: `next-best:project:${projectId}:mark-handoff-ready`,
    type: "project.markHandoffReady",
    target: { type: "project", id: projectId },
    payload: {},
    source: "user",
    confirmedByUser: true
  };
}

function disabledAiAcceptCommand(aiInsightId: string): DomainCommand {
  return {
    id: `next-best:aiInsight:${aiInsightId}:accept-invalid-draft`,
    type: "aiInsight.review",
    target: { type: "aiInsight", id: aiInsightId },
    payload: { status: "accepted" },
    source: "ai",
    confirmedByUser: false
  };
}

function canonicalCommandForReviewItem(item: DerivedReviewItem): {
  command?: DomainCommand;
  context?: DomainCommandContext;
} {
  if (item.sourceCode === "invalid_ai_patch_target" && item.target.type === "aiInsight") {
    return {
      command: disabledAiAcceptCommand(item.target.id),
      context: { actor: "ai", actorId: "next-best-action-engine" }
    };
  }

  const firstCommand = item.suggestedCommands[0];
  if (
    firstCommand?.commandType === "mark_project_handoff_ready" &&
    firstCommand.target.type === "project"
  ) {
    return {
      command: markHandoffReadyCommand(firstCommand.target.id)
    };
  }

  return {};
}

function applyConstraint(
  state: AppState,
  action: ActionDraft,
  command: DomainCommand | undefined,
  context?: DomainCommandContext
): ActionDraft {
  if (!command) return action;

  const result = checkCommandAgainstConstraints(state, command, context);
  const suggestedCommand = action.suggestedCommand
    ? {
        ...action.suggestedCommand,
        domainCommand: command
      }
    : undefined;

  return {
    ...action,
    ...(suggestedCommand ? { suggestedCommand } : {}),
    ...(result.disabledReason ? { disabledReason: result.disabledReason } : {}),
    estimatedRisk: riskForAction(action.reasonCodes, suggestedCommand, result.disabledReason)
  };
}

function reviewAction(state: AppState, item: DerivedReviewItem): ActionDraft {
  const reasonCodes = uniqueSortedStrings([item.sourceCode]);
  const rank = rankForCodes(reasonCodes, item.severity);
  const canonical = canonicalCommandForReviewItem(item);
  const baseSuggested = item.suggestedCommands[0]
    ? suggestedFromDraft(item.suggestedCommands[0], canonical.command)
    : undefined;
  const action: ActionDraft = {
    id: `next-best:review:${item.id}`,
    title: titleForCodes(reasonCodes, item.reason),
    summary: item.reason,
    target: item.target,
    priority: priorityForRank(rank),
    reasonCodes,
    evidence: normalizeEvidence(item.evidence),
    ...(baseSuggested ? { suggestedCommand: baseSuggested } : {}),
    estimatedImpact: impactForRank(rank),
    estimatedRisk: riskForAction(reasonCodes, baseSuggested),
    sourceIds: uniqueSortedStrings([item.id]),
    rank
  };

  return applyConstraint(state, action, canonical.command, canonical.context);
}

function projectReportAction(
  state: AppState,
  report: ProjectReadinessReport,
  reasonCodes: readonly string[],
  input: {
    title: string;
    summary: string;
    evidence: readonly unknown[];
    command?: NextBestActionSuggestedCommand;
  }
): ActionDraft {
  const normalizedReasonCodes = uniqueSortedStrings([...reasonCodes]);
  const rank = rankForCodes(normalizedReasonCodes);
  const command = input.command?.domainCommand;
  const action: ActionDraft = {
    id: `next-best:project-report:${report.target.id}:${normalizedReasonCodes.join("+")}`,
    title: input.title,
    summary: input.summary,
    target: { type: "project", id: report.target.id },
    priority: priorityForRank(rank),
    reasonCodes: normalizedReasonCodes,
    evidence: normalizeEvidence(input.evidence),
    ...(input.command ? { suggestedCommand: input.command } : {}),
    estimatedImpact: impactForRank(rank),
    estimatedRisk: riskForAction(normalizedReasonCodes, input.command),
    sourceIds: uniqueSortedStrings([
      `project-readiness:${report.target.id}`,
      ...normalizedReasonCodes.map((code) => `project-readiness:${report.target.id}:${code}`)
    ]),
    rank
  };

  return applyConstraint(state, action, command);
}

function projectReportActions(state: AppState, report: ProjectReadinessReport): ActionDraft[] {
  const actions: ActionDraft[] = [];

  if (report.staleHandoff) {
    const staleCodes = report.findings
      .filter((finding) => handoffStaleCodes.has(finding.code))
      .map((finding) => finding.code);

    actions.push(projectReportAction(state, report, staleCodes.length > 0 ? staleCodes : ["stale_handoff"], {
      title: "Review stale handoff state",
      summary: "Project is marked handoff_ready, but current read-only preflight says it is no longer safe to hand off.",
      evidence: [
        report.target.id,
        ...report.handoffPreflight.blockedReasonCodes,
        ...report.findings.flatMap((finding) => finding.evidenceIds)
      ]
    }));
  }

  if (report.activeBlockers.length > 0) {
    actions.push(projectReportAction(state, report, ["active_blocker"], {
      title: "Clear project blocker",
      summary: "Project has active blockers before handoff can proceed.",
      evidence: report.activeBlockers.flatMap((blocker) => blocker.evidenceIds.length > 0
        ? blocker.evidenceIds
        : [blocker.id])
    }));
  }

  if (report.canMarkHandoffReady) {
    const command = markHandoffReadyCommand(report.target.id);
    const suggestedCommand = reviewDraftForCommand({
      id: `project-readiness:${report.target.id}:mark_project_handoff_ready`,
      commandType: "mark_project_handoff_ready",
      label: "Mark project handoff ready",
      reason: "Project passed handoff preflight and still requires human confirmation.",
      target: { type: "project", id: report.target.id },
      domainCommand: command
    });

    actions.push(projectReportAction(state, report, [
      "computed_readiness_ready_for_engineering",
      "handoff_candidate"
    ], {
      title: "Mark project handoff ready",
      summary: "Project is ready_for_engineering and can use the guarded handoff command after human confirmation.",
      evidence: [report.target.id, report.computedReadiness?.value, report.lifecycleStatus],
      command: suggestedCommand
    }));
  }

  return actions;
}

function thoughtReportAction(report: ThoughtProgressionReport, finding: ThoughtProgressionFinding): ActionDraft {
  const reasonCodes = uniqueSortedStrings([finding.code]);
  const rank = rankForCodes(reasonCodes, finding.severity);
  const suggested = report.suggestedCommands[0]
    ? suggestedFromDraft(report.suggestedCommands[0])
    : undefined;

  return {
    id: `next-best:thought-report:${report.target.id}:${finding.code}:${targetKey(finding.target)}`,
    title: titleForCodes(reasonCodes, finding.reason),
    summary: finding.reason,
    target: finding.target,
    priority: priorityForRank(rank),
    reasonCodes,
    evidence: normalizeEvidence(finding.evidenceIds),
    ...(suggested ? { suggestedCommand: suggested } : {}),
    estimatedImpact: impactForRank(rank),
    estimatedRisk: riskForAction(reasonCodes, suggested),
    sourceIds: uniqueSortedStrings([
      `thought-progression:${report.target.id}`,
      `thought-progression:${report.target.id}:${finding.code}`
    ]),
    rank
  };
}

function thoughtReportActions(report: ThoughtProgressionReport): ActionDraft[] {
  return report.findings
    .filter((finding) =>
      finding.code === "thought_inbox" ||
      finding.code === "classification_missing" ||
      contextCleanupCodes.has(finding.code)
    )
    .map((finding) => thoughtReportAction(report, finding));
}

function appHealthSourceId(finding: AppHealthFinding) {
  return `app-health:${finding.code}:${finding.target.type}:${finding.target.id}`;
}

function mergeSourceIdsFromAppHealth(actions: ActionDraft[], findings: readonly AppHealthFinding[]) {
  const idsByTargetAndCode = new Map<string, string[]>();

  for (const finding of findings) {
    const key = `${targetKey(finding.target)}:${finding.code}`;
    idsByTargetAndCode.set(key, [
      ...(idsByTargetAndCode.get(key) ?? []),
      appHealthSourceId(finding)
    ]);
  }

  return actions.map((action) => ({
    ...action,
    sourceIds: uniqueSortedStrings([
      ...action.sourceIds,
      ...action.reasonCodes.flatMap((code) => idsByTargetAndCode.get(`${targetKey(action.target)}:${code}`) ?? [])
    ])
  }));
}

function scopedEntityIds(state: AppState, scope: NextBestActionScope) {
  const ids = new Set<string>();
  ids.add(scope.type);
  if (scope.type === "app") return ids;

  ids.add(scope.id);

  if (scope.type === "project") {
    const project = state.projects.find((item) => item.id === scope.id);
    if (project) addProjectIds(ids, project);
  }

  if (scope.type === "thought") {
    const thought = state.thoughts.find((item) => item.id === scope.id);
    if (thought) addThoughtIds(ids, thought);
  }

  if (scope.type === "universe") {
    for (const thought of state.thoughts.filter((item) => item.universeId === scope.id)) {
      addThoughtIds(ids, thought);
    }
    for (const project of state.projects.filter((item) => item.universeId === scope.id)) {
      addProjectIds(ids, project);
    }
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

function matchesScope(state: AppState, action: ActionDraft, scope: NextBestActionScope) {
  if (scope.type === "app") return true;

  const ids = scopedEntityIds(state, scope);
  if (ids.has(action.target.id)) return true;

  return [
    ...action.sourceIds,
    ...action.evidence.map((value) => String(value))
  ].some((value) => ids.has(value));
}

function sortKeyFor(action: ActionDraft) {
  const rank = String(999 - action.rank).padStart(3, "0");
  const disabled = action.disabledReason ? "1" : "0";

  return [
    rank,
    disabled,
    action.priority,
    action.target.type,
    action.target.id,
    action.id
  ].join(":");
}

function finalize(action: ActionDraft): NextBestAction {
  const sortKey = sortKeyFor(action);
  const { rank, ...rest } = action;

  return {
    ...rest,
    sortKey
  };
}

function uniqueActions(actions: readonly ActionDraft[]) {
  const byId = new Map<string, ActionDraft>();

  for (const action of actions) {
    const current = byId.get(action.id);
    if (!current || sortKeyFor(action).localeCompare(sortKeyFor(current)) < 0) {
      byId.set(action.id, action);
    }
  }

  return [...byId.values()];
}

export function buildNextBestActions(
  state: AppState,
  scope: NextBestActionScope = { type: "app" },
  options: BuildNextBestActionsOptions = {}
): NextBestAction[] {
  const appHealthReport = buildAppHealthReport(state);
  const reviewItems = buildDerivedReviewQueue(state);
  const projectReports = buildProjectReadinessReports(state);
  const thoughtReports = buildThoughtProgressionReports(state);
  const includeDisabled = options.includeDisabled ?? true;

  const reviewActions = reviewItems.map((reviewItem) => reviewAction(state, reviewItem));
  const reportActions = [
    ...projectReports.flatMap((report) => projectReportActions(state, report)),
    ...thoughtReports.flatMap(thoughtReportActions)
  ];
  const allActions = mergeSourceIdsFromAppHealth(
    uniqueActions([...reviewActions, ...reportActions]),
    appHealthReport.findings
  );
  const sorted = allActions
    .filter((action) => includeDisabled || !action.disabledReason)
    .filter((action) => matchesScope(state, action, scope))
    .map(finalize)
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  if (options.limit !== undefined) return sorted.slice(0, Math.max(0, options.limit));

  return sorted;
}
