import type { BlockingQuestion, DecisionRecord } from "../types";

const unresolvedBlockingQuestionStatuses = new Set(["open", "in_review"]);
const highImpactLevels = new Set(["high", "blocking"]);

function clean(value: string | undefined) {
  return value?.trim() ?? "";
}

export function isBlockingQuestionArchived(question: Pick<BlockingQuestion, "status">) {
  return question.status === "archived";
}

export function isBlockingQuestionOpen(question: Pick<BlockingQuestion, "status">) {
  return question.status === "open";
}

export function isBlockingQuestionInReview(question: Pick<BlockingQuestion, "status">) {
  return question.status === "in_review";
}

export function isBlockingQuestionUnresolved(question: Pick<BlockingQuestion, "status">) {
  return unresolvedBlockingQuestionStatuses.has(question.status);
}

export function isBlockingQuestionResolved(question: Pick<BlockingQuestion, "status">) {
  return question.status === "resolved";
}

export function isHighImpactBlockingQuestion(question: Pick<BlockingQuestion, "impactLevel">) {
  return highImpactLevels.has(question.impactLevel ?? "medium");
}

export function hasBlockingQuestionResolution(
  question: Pick<BlockingQuestion, "finalResolution" | "proposedResolution">
) {
  return Boolean(clean(question.finalResolution) || clean(question.proposedResolution));
}

export function hasBlockingQuestionDecisionPath(
  question: Pick<
    BlockingQuestion,
    "finalResolution" | "proposedResolution" | "decisionNote" | "preferredOptionId"
  >
) {
  return Boolean(
    clean(question.finalResolution) ||
    clean(question.proposedResolution) ||
    clean(question.decisionNote) ||
    clean(question.preferredOptionId)
  );
}

export function isBlockingQuestionStrictlyDecided(
  question: Pick<BlockingQuestion, "status" | "finalResolution" | "proposedResolution">
) {
  return isBlockingQuestionResolved(question) && hasBlockingQuestionResolution(question);
}

export function shouldBlockingQuestionAppearInReviewQueue(question: Pick<BlockingQuestion, "status">) {
  return isBlockingQuestionUnresolved(question);
}

export function shouldBlockingQuestionAppearInNextAction(question: Pick<BlockingQuestion, "status">) {
  return isBlockingQuestionUnresolved(question);
}

export function shouldBlockingQuestionAffectEngineeringReadiness(
  question: Pick<BlockingQuestion, "status" | "impactLevel">
) {
  return isBlockingQuestionUnresolved(question) && isHighImpactBlockingQuestion(question);
}

export function blockingQuestionAffectsProjectHandoff(
  question: Pick<BlockingQuestion, "status" | "impactLevel" | "linkedProjectIds">,
  projectId: string
) {
  return shouldBlockingQuestionAffectEngineeringReadiness(question) &&
    (question.linkedProjectIds ?? []).includes(projectId);
}

export function isDecisionRecordAccepted(record: Pick<DecisionRecord, "status">) {
  return record.status === "accepted";
}

export function isDecisionRecordPending(record: Pick<DecisionRecord, "status">) {
  return record.status === "proposed";
}

export function isDecisionRecordArchived(record: Pick<DecisionRecord, "status">) {
  return record.status === "archived";
}

export function shouldDecisionRecordAppearInReviewQueue(record: Pick<DecisionRecord, "status">) {
  return isDecisionRecordPending(record);
}

export function acceptedDecisionCanResolveBlockingQuestion(
  record: Pick<DecisionRecord, "status" | "sourceBlockingQuestionId">,
  question: Pick<BlockingQuestion, "id">
) {
  return isDecisionRecordAccepted(record) && record.sourceBlockingQuestionId === question.id;
}
