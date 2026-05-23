import {
  buildAppHealthReport,
  type AppHealthFinding,
  type AppHealthFindingCode,
  type AppHealthSeverity
} from "./appHealthReport";
import {
  buildProjectReadinessReports,
  type ProjectReadinessCommandDraft,
  type ProjectReadinessFinding
} from "./projectReadinessReport";
import {
  buildThoughtProgressionReports,
  type ThoughtProgressionCommandDraft,
  type ThoughtProgressionFinding
} from "./thoughtProgressionReport";
import {
  isBlockingQuestionInReview,
  isBlockingQuestionOpen,
  isDecisionRecordPending
} from "./semantics/questionDecisionSemantics";
import { isAIInsightDraft } from "./semantics/statusSemantics";
import type { AIInsight, AppState, BlockingQuestion, DecisionRecord } from "./types";

export type DerivedReviewSeverity = AppHealthSeverity;

export interface DerivedReviewTarget {
  type: string;
  id: string;
}

export interface DerivedReviewSuggestedCommandDraft {
  id: string;
  commandType: string;
  label: string;
  reason: string;
  target: DerivedReviewTarget;
  requiresHumanConfirmation: true;
  payloadPreview?: unknown;
}

export interface DerivedReviewItem {
  id: string;
  source:
    | "thought_progression"
    | "project_readiness"
    | "app_health"
    | "ai_insight"
    | "blocking_question"
    | "decision_record";
  sourceCode: string;
  target: DerivedReviewTarget;
  severity: DerivedReviewSeverity;
  reason: string;
  evidence: Array<unknown>;
  suggestedCommands: DerivedReviewSuggestedCommandDraft[];
  requiresHumanConfirmation: boolean;
}

const severityRank: Record<DerivedReviewSeverity, number> = {
  info: 0,
  warning: 1,
  error: 2
};

const thoughtInfoReviewCodes = new Set<ThoughtProgressionFinding["code"]>([
  "promotion_candidate",
  "link_project_candidate",
  "needs_human_review"
]);

const projectInfoReviewCodes = new Set<ProjectReadinessFinding["code"]>([
  "engineering_draft_candidate",
  "handoff_candidate",
  "needs_human_review"
]);

const healthCommandByCode: Record<AppHealthFindingCode, string> = {
  duplicate_id: "resolve_duplicate_id",
  orphan_relationship: "repair_relationship_endpoint",
  ambiguous_relationship_endpoint: "review_relationship_endpoint",
  direct_ref_drift: "repair_direct_ref",
  invalid_ai_patch_target: "review_ai_draft",
  readiness_drift: "update_stored_readiness",
  stale_handoff: "review_handoff_state",
  invalid_universe_ref: "repair_direct_ref",
  invalid_project_ref: "repair_direct_ref",
  invalid_linked_thought_id: "repair_direct_ref",
  invalid_source_thought_id: "repair_direct_ref",
  invalid_relationship_endpoint: "repair_relationship_endpoint",
  invariant_warning: "review_invariant"
};

type ReportCommandDraft = ThoughtProgressionCommandDraft | ProjectReadinessCommandDraft;

function normalizeEvidence(values: readonly unknown[]) {
  return [...values]
    .filter((value) => value !== undefined && value !== "")
    .sort((a, b) => String(a).localeCompare(String(b)));
}

function normalizeCommand(command: ReportCommandDraft): DerivedReviewSuggestedCommandDraft {
  return {
    id: command.id,
    commandType: command.commandType,
    label: command.label,
    reason: command.reason,
    target: command.target,
    requiresHumanConfirmation: true,
    ...(command.payloadPreview !== undefined ? { payloadPreview: command.payloadPreview } : {})
  };
}

function commandDraft(input: {
  id: string;
  commandType: string;
  label: string;
  reason: string;
  target: DerivedReviewTarget;
  payloadPreview?: unknown;
}): DerivedReviewSuggestedCommandDraft {
  return {
    ...input,
    requiresHumanConfirmation: true
  };
}

function compareCommands(a: DerivedReviewSuggestedCommandDraft, b: DerivedReviewSuggestedCommandDraft) {
  return a.id.localeCompare(b.id) ||
    a.commandType.localeCompare(b.commandType) ||
    a.target.type.localeCompare(b.target.type) ||
    a.target.id.localeCompare(b.target.id);
}

function normalizeCommands(commands: readonly ReportCommandDraft[]) {
  return commands.map(normalizeCommand).sort(compareCommands);
}

function item(input: Omit<DerivedReviewItem, "evidence" | "requiresHumanConfirmation"> & {
  evidence: readonly unknown[];
}): DerivedReviewItem {
  const suggestedCommands = [...input.suggestedCommands].sort(compareCommands);

  return {
    ...input,
    evidence: normalizeEvidence(input.evidence),
    suggestedCommands,
    requiresHumanConfirmation: suggestedCommands.length > 0 || input.severity !== "info"
  };
}

function compareItems(a: DerivedReviewItem, b: DerivedReviewItem) {
  return severityRank[b.severity] - severityRank[a.severity] ||
    a.target.type.localeCompare(b.target.type) ||
    a.target.id.localeCompare(b.target.id) ||
    a.source.localeCompare(b.source) ||
    a.sourceCode.localeCompare(b.sourceCode) ||
    a.id.localeCompare(b.id);
}

function uniqueSortedItems(items: DerivedReviewItem[]) {
  const byKey = new Map<string, DerivedReviewItem>();

  for (const reviewItem of items) {
    const key = `${reviewItem.source}|${reviewItem.target.type}|${reviewItem.target.id}|${reviewItem.sourceCode}`;
    const current = byKey.get(key);

    if (!current) {
      byKey.set(key, reviewItem);
      continue;
    }

    const severity = severityRank[reviewItem.severity] > severityRank[current.severity]
      ? reviewItem.severity
      : current.severity;
    const preferred = severity === reviewItem.severity && severityRank[reviewItem.severity] > severityRank[current.severity]
      ? reviewItem
      : current;
    const commands = [...current.suggestedCommands, ...reviewItem.suggestedCommands];
    const commandMap = new Map(commands.map((command) => [command.id, command]));

    byKey.set(key, {
      ...preferred,
      severity,
      evidence: normalizeEvidence([...current.evidence, ...reviewItem.evidence]),
      suggestedCommands: [...commandMap.values()].sort(compareCommands),
      requiresHumanConfirmation: current.requiresHumanConfirmation || reviewItem.requiresHumanConfirmation,
      reason: current.reason === reviewItem.reason ? current.reason : `${current.reason} ${reviewItem.reason}`
    });
  }

  return [...byKey.values()].sort(compareItems);
}

function shouldCreateThoughtReviewItem(finding: ThoughtProgressionFinding) {
  return finding.severity !== "info" && finding.code !== "relationship_warning" ||
    thoughtInfoReviewCodes.has(finding.code);
}

function shouldCreateProjectReviewItem(finding: ProjectReadinessFinding) {
  if (finding.code === "relationship_warning" || finding.code === "direct_ref_warning") return false;

  return finding.severity !== "info" || projectInfoReviewCodes.has(finding.code);
}

function thoughtReviewItems(state: AppState): DerivedReviewItem[] {
  return buildThoughtProgressionReports(state)
    .flatMap((report) =>
      report.findings
        .filter(shouldCreateThoughtReviewItem)
        .map((finding) => item({
          id: `derived-review:thought:${report.target.id}:${finding.code}:${finding.target.type}:${finding.target.id}`,
          source: "thought_progression",
          sourceCode: finding.code,
          target: finding.target,
          severity: finding.severity,
          reason: finding.reason,
          evidence: finding.evidenceIds,
          suggestedCommands: normalizeCommands(report.suggestedCommands)
        }))
    );
}

function projectReviewItems(state: AppState): DerivedReviewItem[] {
  return buildProjectReadinessReports(state)
    .flatMap((report) =>
      report.findings
        .filter(shouldCreateProjectReviewItem)
        .map((finding) => item({
          id: `derived-review:project:${report.target.id}:${finding.code}:${finding.target.type}:${finding.target.id}`,
          source: "project_readiness",
          sourceCode: finding.code,
          target: finding.target,
          severity: finding.severity,
          reason: finding.reason,
          evidence: finding.evidenceIds,
          suggestedCommands: normalizeCommands(report.suggestedCommands)
        }))
    );
}

function healthCommand(finding: AppHealthFinding) {
  const commandType = healthCommandByCode[finding.code];

  return commandDraft({
    id: `app-health:${finding.code}:${finding.target.type}:${finding.target.id}:${commandType}`,
    commandType,
    label: commandType.split("_").join(" "),
    reason: finding.reason,
    target: finding.target,
    payloadPreview: {
      sourceCode: finding.sourceCode,
      evidenceIds: finding.evidenceIds
    }
  });
}

function appHealthReviewItems(state: AppState): DerivedReviewItem[] {
  return buildAppHealthReport(state).findings
    .filter((finding) => finding.severity !== "info")
    .map((finding) => item({
      id: `derived-review:app-health:${finding.code}:${finding.target.type}:${finding.target.id}`,
      source: "app_health",
      sourceCode: finding.code,
      target: finding.target,
      severity: finding.severity,
      reason: finding.reason,
      evidence: finding.evidenceIds,
      suggestedCommands: [healthCommand(finding)]
    }));
}

function targetForInsight(insight: AIInsight): DerivedReviewTarget {
  return {
    type: "aiInsight",
    id: insight.id
  };
}

function aiInsightReviewItems(state: AppState): DerivedReviewItem[] {
  return state.aiInsights
    .filter(isAIInsightDraft)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((insight) => {
      const target = targetForInsight(insight);

      return item({
        id: `derived-review:ai-insight:${insight.id}`,
        source: "ai_insight",
        sourceCode: "pending_ai_draft",
        target,
        severity: "warning",
        reason: "AI insight draft requires human review before any patch can be applied.",
        evidence: [insight.id, insight.targetId, insight.patch?.targetId],
        suggestedCommands: [commandDraft({
          id: `ai-insight:${insight.id}:review_ai_draft`,
          commandType: "review_ai_draft",
          label: "Review AI draft",
          reason: "Draft AI output cannot mutate state without human confirmation.",
          target,
          payloadPreview: {
            insightType: insight.type,
            targetId: insight.targetId,
            patchTargetId: insight.patch?.targetId
          }
        })]
      });
    });
}

function blockingQuestionCommand(question: BlockingQuestion): DerivedReviewSuggestedCommandDraft {
  const inReview = isBlockingQuestionInReview(question);

  return commandDraft({
    id: `blocking-question:${question.id}:${inReview ? "review_blocking_question" : "answer_blocking_question"}`,
    commandType: inReview ? "review_blocking_question" : "answer_blocking_question",
    label: inReview ? "Review blocking question" : "Answer blocking question",
    reason: "Blocking question must be resolved or reviewed before downstream automation treats it as decided.",
    target: { type: "blockingQuestion", id: question.id },
    payloadPreview: {
      status: question.status,
      linkedThoughtIds: question.linkedThoughtIds,
      linkedProjectIds: question.linkedProjectIds
    }
  });
}

function blockingQuestionReviewItems(state: AppState): DerivedReviewItem[] {
  return (state.blockingQuestions ?? [])
    .filter((question) => isBlockingQuestionOpen(question) || isBlockingQuestionInReview(question))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((question) => item({
      id: `derived-review:blocking-question:${question.id}`,
      source: "blocking_question",
      sourceCode: question.status === "open" ? "open_blocking_question" : "in_review_blocking_question",
      target: { type: "blockingQuestion", id: question.id },
      severity: "warning",
      reason: question.status === "open"
        ? "Blocking question is open and needs a human answer."
        : "Blocking question is in review and needs human confirmation.",
      evidence: [question.id, ...(question.linkedThoughtIds ?? []), ...(question.linkedProjectIds ?? [])],
      suggestedCommands: [blockingQuestionCommand(question)]
    }));
}

function decisionCommand(record: DecisionRecord): DerivedReviewSuggestedCommandDraft {
  return commandDraft({
    id: `decision-record:${record.id}:confirm_reject_decision`,
    commandType: "confirm_reject_decision",
    label: "Confirm or reject decision",
    reason: "Proposed decisions must be accepted, superseded, archived, or rejected by a human path.",
    target: { type: "decisionRecord", id: record.id },
    payloadPreview: {
      status: record.status,
      sourceBlockingQuestionId: record.sourceBlockingQuestionId,
      linkedProjectIds: record.linkedProjectIds
    }
  });
}

function decisionReviewItems(state: AppState): DerivedReviewItem[] {
  return (state.decisionRecords ?? [])
    .filter(isDecisionRecordPending)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((record) => item({
      id: `derived-review:decision-record:${record.id}`,
      source: "decision_record",
      sourceCode: "proposed_decision",
      target: { type: "decisionRecord", id: record.id },
      severity: "warning",
      reason: "Decision record is proposed and awaits human confirmation.",
      evidence: [record.id, record.sourceBlockingQuestionId, ...(record.linkedProjectIds ?? [])],
      suggestedCommands: [decisionCommand(record)]
    }));
}

export function buildDerivedReviewQueue(state: AppState): DerivedReviewItem[] {
  return uniqueSortedItems([
    ...thoughtReviewItems(state),
    ...projectReviewItems(state),
    ...appHealthReviewItems(state),
    ...aiInsightReviewItems(state),
    ...blockingQuestionReviewItems(state),
    ...decisionReviewItems(state)
  ]);
}
