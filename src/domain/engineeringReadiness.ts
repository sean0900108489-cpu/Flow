import { getBlockingQuestionSummary, normalizeBlockingQuestions } from "./blockingQuestions";
import { getReviewQueueCounts, searchReviewQueue, type ReviewQueueItem } from "./reviewQueue";
import {
  hasBlockingQuestionDecisionPath,
  isBlockingQuestionArchived,
  isBlockingQuestionResolved,
  isBlockingQuestionStrictlyDecided,
  isBlockingQuestionUnresolved,
  isHighImpactBlockingQuestion,
  shouldBlockingQuestionAffectEngineeringReadiness
} from "./semantics/questionDecisionSemantics";
import { listOrphanRelationships } from "./relationships/relationshipGraph";
import type {
  AppState,
  BlockingQuestion,
  EngineeringReadinessAssessment,
  EngineeringReadinessConfidence,
  EngineeringReadinessCriterionStatus,
  EngineeringReadinessOverallStatus,
  EngineeringReadinessTargetPhase
} from "./types";
import { now } from "./utils";

export type EngineeringReadinessCriterionId =
  | "core_identity"
  | "universe_model"
  | "blocking_questions"
  | "review_queue"
  | "app_state_persistence"
  | "minimum_workflow";

export interface EngineeringReadinessCriterionResult {
  id: EngineeringReadinessCriterionId;
  title: string;
  status: EngineeringReadinessCriterionStatus;
  explanation: string;
  relatedBlockers: string[];
  relatedDecisions: string[];
}

export interface EngineeringReadinessSummary {
  overallStatus: EngineeringReadinessOverallStatus;
  score: number;
  criteria: EngineeringReadinessCriterionResult[];
  blockers: string[];
  warnings: string[];
  suggestedNextAction: string;
  assessment: EngineeringReadinessAssessment;
  openBlockingCount: number;
  highImpactUnresolvedCount: number;
  decidedCount: number;
  pendingReviewCount: number;
  reviewBlockerCount: number;
  currentlyBlockingDecisions: BlockingQuestion[];
  unresolvedHighImpactDecisions: BlockingQuestion[];
  reviewItemsNeedingAttention: ReviewQueueItem[];
}

export type EngineeringReadinessPatch = Partial<
  Pick<EngineeringReadinessAssessment, "note" | "manualConfidence" | "targetPhase" | "lastReviewedAt">
>;

export interface EngineeringReadinessActionResult {
  ok: boolean;
  state: AppState;
  error?: string;
}

const defaultTimestamp = "2026-01-01T00:00:00.000Z";
const confidenceLevels: EngineeringReadinessConfidence[] = ["low", "medium", "high"];
const targetPhases: EngineeringReadinessTargetPhase[] = ["exploration", "prototype", "engineering"];

export function defaultEngineeringReadinessAssessment(): EngineeringReadinessAssessment {
  return {
    note: "",
    manualConfidence: "medium",
    targetPhase: "exploration",
    lastReviewedAt: undefined,
    updatedAt: defaultTimestamp
  };
}

function clean(value: string | undefined) {
  return value?.trim() ?? "";
}

function isConfidence(value: unknown): value is EngineeringReadinessConfidence {
  return typeof value === "string" && confidenceLevels.includes(value as EngineeringReadinessConfidence);
}

function isTargetPhase(value: unknown): value is EngineeringReadinessTargetPhase {
  return typeof value === "string" && targetPhases.includes(value as EngineeringReadinessTargetPhase);
}

export function normalizeEngineeringReadiness(
  assessment: EngineeringReadinessAssessment | undefined
): EngineeringReadinessAssessment {
  const fallback = defaultEngineeringReadinessAssessment();

  if (!assessment) return fallback;

  return {
    note: clean(assessment.note),
    manualConfidence: isConfidence(assessment.manualConfidence)
      ? assessment.manualConfidence
      : fallback.manualConfidence,
    targetPhase: isTargetPhase(assessment.targetPhase) ? assessment.targetPhase : fallback.targetPhase,
    lastReviewedAt: clean(assessment.lastReviewedAt) || undefined,
    updatedAt: clean(assessment.updatedAt) || fallback.updatedAt
  };
}

function normalizedState(state: AppState): AppState {
  return {
    ...state,
    blockingQuestions: normalizeBlockingQuestions(state.blockingQuestions),
    decisionRecords: state.decisionRecords ?? [],
    engineeringReadiness: normalizeEngineeringReadiness(state.engineeringReadiness)
  };
}

function preferredOptionLabel(question: BlockingQuestion) {
  return question.possibleOptions?.find((option) => option.id === question.preferredOptionId)?.label;
}

function questionById(questions: BlockingQuestion[], id: string, fallbackQuestion: string) {
  return questions.find((question) => question.id === id || question.question === fallbackQuestion);
}

function criterionScore(status: EngineeringReadinessCriterionStatus) {
  return {
    met: 100,
    partial: 65,
    unmet: 30,
    blocked: 0
  }[status];
}

function decisionCriterion(
  id: EngineeringReadinessCriterionId,
  title: string,
  question: BlockingQuestion | undefined,
  missingExplanation: string
): EngineeringReadinessCriterionResult {
  if (!question) {
    return {
      id,
      title,
      status: "unmet",
      explanation: missingExplanation,
      relatedBlockers: [],
      relatedDecisions: []
    };
  }

  if (isBlockingQuestionStrictlyDecided(question)) {
    return {
      id,
      title,
      status: "met",
      explanation: `Decided: ${clean(question.finalResolution) || clean(question.proposedResolution)}`,
      relatedBlockers: [],
      relatedDecisions: [question.question]
    };
  }

  if (hasBlockingQuestionDecisionPath(question)) {
    const option = preferredOptionLabel(question);

    return {
      id,
      title,
      status: "partial",
      explanation: option ? `Preferred option on file: ${option}` : "A tentative decision path exists.",
      relatedBlockers: isBlockingQuestionUnresolved(question) ? [question.question] : [],
      relatedDecisions: [question.question]
    };
  }

  return {
    id,
    title,
    status: isHighImpactBlockingQuestion(question) && isBlockingQuestionUnresolved(question) ? "blocked" : "unmet",
    explanation: "No final decision or preferred option has been captured yet.",
    relatedBlockers: isBlockingQuestionUnresolved(question) ? [question.question] : [],
    relatedDecisions: [question.question]
  };
}

function reviewItemHasDecisionPath(item: ReviewQueueItem, questions: BlockingQuestion[]) {
  if (item.type !== "blocking_question") return false;
  const question = questions.find((candidate) => candidate.id === item.sourceId);

  return question ? hasBlockingQuestionDecisionPath(question) : Boolean(item.reviewResolution);
}

export function calculateEngineeringReadiness(state: AppState): EngineeringReadinessSummary {
  const nextState = normalizedState(state);
  const assessment = nextState.engineeringReadiness ?? defaultEngineeringReadinessAssessment();
  const questions = (nextState.blockingQuestions ?? []).filter((question) => !isBlockingQuestionArchived(question));
  const thoughtTodoQuestion = questionById(
    questions,
    "bq-thought-todo",
    "ThoughtItem 和 TodoItem 是否應該分開？"
  );
  const universeQuestion = questionById(
    questions,
    "bq-universe-model",
    "Universe 是標籤、資料夾，還是獨立物件？"
  );

  const highImpactUnresolved = questions.filter(shouldBlockingQuestionAffectEngineeringReadiness);
  const hardDecisionBlockers = highImpactUnresolved.filter((question) => !hasBlockingQuestionDecisionPath(question));
  const reviewItems = searchReviewQueue(nextState);
  const reviewCounts = getReviewQueueCounts(reviewItems);
  const orphanRelationships = listOrphanRelationships(nextState);
  const reviewBlockers = reviewItems.filter(
    (item) =>
      item.type === "blocking_question" &&
      item.priority >= 92 &&
      item.status !== "resolved" &&
      !reviewItemHasDecisionPath(item, questions)
  );
  const decisionSummary = getBlockingQuestionSummary(nextState);

  const blockingCriterion: EngineeringReadinessCriterionResult = (() => {
    if (hardDecisionBlockers.length > 0) {
      return {
        id: "blocking_questions",
        title: "Blocking questions resolved enough",
        status: "blocked",
        explanation: "High impact or blocking decisions still need a final decision or preferred option.",
        relatedBlockers: hardDecisionBlockers.map((question) => question.question),
        relatedDecisions: highImpactUnresolved.map((question) => question.question)
      };
    }

    if (highImpactUnresolved.length > 0) {
      return {
        id: "blocking_questions",
        title: "Blocking questions resolved enough",
        status: "partial",
        explanation: "High impact questions still need formal resolution, but each has a preferred path.",
        relatedBlockers: highImpactUnresolved.map((question) => question.question),
        relatedDecisions: highImpactUnresolved.map((question) => question.question)
      };
    }

    return {
      id: "blocking_questions",
      title: "Blocking questions resolved enough",
      status: "met",
      explanation: "No high impact unresolved decision currently blocks readiness.",
      relatedBlockers: [],
      relatedDecisions: questions.filter(isBlockingQuestionResolved).map((question) => question.question)
    };
  })();

  const reviewCriterion: EngineeringReadinessCriterionResult = (() => {
    if (reviewBlockers.length > 0) {
      return {
        id: "review_queue",
        title: "Review queue health",
        status: "blocked",
        explanation: "Review Queue still has high impact blocking items without a clear review path.",
        relatedBlockers: reviewBlockers.map((item) => item.title),
        relatedDecisions: []
      };
    }

    if (reviewCounts.total > 0) {
      return {
        id: "review_queue",
        title: "Review queue health",
        status: "partial",
        explanation: `${reviewCounts.total} review item(s) remain, but no major unresolved review blocker is detected.`,
        relatedBlockers: [],
        relatedDecisions: reviewItems.slice(0, 5).map((item) => item.title)
      };
    }

    return {
      id: "review_queue",
      title: "Review queue health",
      status: "met",
      explanation: "No pending review queue items are blocking engineering readiness.",
      relatedBlockers: [],
      relatedDecisions: []
    };
  })();

  const persistenceReady = [
    nextState.universes,
    nextState.thoughts,
    nextState.projects,
    nextState.relationships,
    nextState.aiInsights,
    nextState.blockingQuestions,
    nextState.decisionRecords
  ].every(Array.isArray) && Boolean(assessment.updatedAt);

  const hasNextAction = nextState.projects.some((project) => clean(project.nextAction)) ||
    nextState.thoughts.some((thought) => clean(thought.nextAction));
  const workflowChecks = [
    nextState.thoughts.length > 0,
    nextState.projects.length > 0,
    hasNextAction,
    questions.length > 0,
    reviewItems.length >= 0
  ];
  const workflowScore = workflowChecks.filter(Boolean).length;

  const criteria: EngineeringReadinessCriterionResult[] = [
    decisionCriterion(
      "core_identity",
      "Core identity clarified",
      thoughtTodoQuestion,
      "ThoughtItem and TodoItem identity has not been captured."
    ),
    decisionCriterion(
      "universe_model",
      "Universe model clarified",
      universeQuestion,
      "Universe model decision has not been captured."
    ),
    blockingCriterion,
    reviewCriterion,
    {
      id: "app_state_persistence",
      title: "AppState persistence stable",
      status: persistenceReady ? "met" : "blocked",
      explanation: persistenceReady
        ? "AppState arrays and readiness assessment can be normalized for localStorage and transfer."
        : "Required AppState collections or readiness assessment data are missing.",
      relatedBlockers: persistenceReady ? [] : ["AppState import/export stability"],
      relatedDecisions: []
    },
    {
      id: "minimum_workflow",
      title: "Minimum workflow visible",
      status: workflowScore >= 4 ? "met" : workflowScore >= 3 ? "partial" : "unmet",
      explanation: workflowScore >= 4
        ? "A visible path exists from captured thoughts/projects through decisions, review, and next action."
        : "The app needs more visible workflow coverage before engineering can rely on the handoff.",
      relatedBlockers: workflowScore >= 4 ? [] : ["Minimum workflow"],
      relatedDecisions: []
    }
  ];

  const score = Math.round(
    criteria.reduce((total, criterion) => total + criterionScore(criterion.status), 0) / criteria.length
  );
  const blockers = [
    ...hardDecisionBlockers.map((question) => question.question),
    ...reviewBlockers.map((item) => item.title),
    ...criteria.filter((criterion) => criterion.status === "blocked").flatMap((criterion) => criterion.relatedBlockers)
  ].filter((value, index, values) => values.indexOf(value) === index);
  const warnings = [
    highImpactUnresolved.length > 0 && hardDecisionBlockers.length === 0
      ? "High impact decisions still need formal resolution before Ready for Engineering."
      : "",
    reviewCounts.total > 0 ? `${reviewCounts.total} review queue item(s) still need attention.` : "",
    orphanRelationships.length > 0 ? `${orphanRelationships.length} relationship(s) have unresolved endpoints.` : "",
    assessment.manualConfidence !== "high" ? "Manual confidence is not high yet." : "",
    assessment.targetPhase !== "engineering" ? "Target phase is not engineering yet." : ""
  ].filter(Boolean);

  const strictReady =
    score >= 90 &&
    highImpactUnresolved.length === 0 &&
    reviewCounts.blockingQuestions === 0 &&
    reviewCounts.proposedDecisions === 0 &&
    assessment.manualConfidence === "high" &&
    assessment.targetPhase === "engineering" &&
    criteria.every((criterion) => criterion.status === "met" || criterion.id === "review_queue");

  const overallStatus: EngineeringReadinessOverallStatus =
    blockers.length > 0 || score < 50
      ? "not_ready"
      : strictReady
        ? "ready_for_engineering"
        : score >= 75
          ? "ready_to_prototype"
          : "partially_ready";

  const suggestedNextAction =
    hardDecisionBlockers[0]
      ? `Choose a preferred option for: ${hardDecisionBlockers[0].question}`
      : highImpactUnresolved[0]
        ? `Resolve the remaining high impact decision: ${highImpactUnresolved[0].question}`
        : reviewBlockers[0]
          ? `Clear Review Queue blocker: ${reviewBlockers[0].title}`
          : assessment.manualConfidence !== "high" || assessment.targetPhase !== "engineering"
            ? "Raise confidence and target phase only after decisions and review are stable."
            : "Prepare the engineering handoff package.";

  return {
    overallStatus,
    score,
    criteria,
    blockers,
    warnings,
    suggestedNextAction,
    assessment,
    openBlockingCount: decisionSummary.openCount,
    highImpactUnresolvedCount: highImpactUnresolved.length,
    decidedCount: decisionSummary.decidedCount,
    pendingReviewCount: reviewCounts.total,
    reviewBlockerCount: reviewBlockers.length,
    currentlyBlockingDecisions: hardDecisionBlockers,
    unresolvedHighImpactDecisions: highImpactUnresolved,
    reviewItemsNeedingAttention: reviewItems.slice(0, 5)
  };
}

export function updateEngineeringReadinessAssessment(
  state: AppState,
  patch: EngineeringReadinessPatch
): EngineeringReadinessActionResult {
  const current = normalizeEngineeringReadiness(state.engineeringReadiness);
  const next = normalizeEngineeringReadiness({
    ...current,
    ...patch,
    updatedAt: now()
  });

  return {
    ok: true,
    state: {
      ...state,
      engineeringReadiness: next
    }
  };
}
