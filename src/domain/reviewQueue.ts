import { shouldAIInsightAppearInReviewQueue } from "./semantics/statusSemantics";
import {
  isBlockingQuestionInReview,
  shouldBlockingQuestionAppearInReviewQueue,
  shouldDecisionRecordAppearInReviewQueue
} from "./semantics/questionDecisionSemantics";
import {
  getProjectContentReadiness,
  shouldProjectAppearInHandoffReviewQueue
} from "./semantics/projectSemantics";
import type { AIInsight, AppState, BlockingQuestion, DecisionRecord, Project } from "./types";

export type ReviewQueueItemType =
  | "ai_insight"
  | "decision_record"
  | "blocking_question"
  | "handoff_candidate";

export type ReviewQueueItem = {
  id: string;
  type: ReviewQueueItemType;
  title: string;
  subtitle: string;
  body?: string;
  status: string;
  sourceId: string;
  sourceType: ReviewQueueItemType;
  targetId?: string;
  targetType?: "thought" | "project";
  universeId?: string;
  priority: number;
  createdAt?: string;
  updatedAt?: string;
  reviewResolution?: string;
};

export type ReviewQueueOptions = {
  searchText?: string;
  type?: ReviewQueueItemType | "all";
  status?: string | "all";
  universeId?: string | "all";
};

export type ReviewQueueCounts = {
  total: number;
  aiDrafts: number;
  proposedDecisions: number;
  blockingQuestions: number;
  handoffCandidates: number;
};

function clean(value: string | undefined) {
  return value?.trim() ?? "";
}

function timestamp(value: string | undefined) {
  return value ? Date.parse(value) || 0 : 0;
}

function firstValue(values: string[] | undefined) {
  return values?.find((value) => clean(value));
}

function compareItems(a: ReviewQueueItem, b: ReviewQueueItem) {
  const byPriority = b.priority - a.priority;
  if (byPriority !== 0) return byPriority;

  const byUpdatedAt = timestamp(b.updatedAt ?? b.createdAt) - timestamp(a.updatedAt ?? a.createdAt);
  if (byUpdatedAt !== 0) return byUpdatedAt;

  return a.title.localeCompare(b.title) || a.type.localeCompare(b.type) || a.id.localeCompare(b.id);
}

function itemHaystack(item: ReviewQueueItem) {
  return [
    item.title,
    item.subtitle,
    item.body,
    item.status,
    item.type,
    item.targetType,
    item.reviewResolution
  ].join(" ").toLowerCase();
}

function targetForInsight(state: AppState, insight: AIInsight) {
  const patchTarget = insight.patch?.targetType;
  const thought = patchTarget !== "project" ? state.thoughts.find((item) => item.id === insight.targetId) : undefined;
  const project = patchTarget !== "thought" ? state.projects.find((item) => item.id === insight.targetId) : undefined;

  if (thought) {
    return {
      title: thought.title,
      type: "thought" as const,
      universeId: thought.universeId
    };
  }

  if (project) {
    return {
      title: project.name,
      type: "project" as const,
      universeId: project.universeId
    };
  }

  return {
    title: insight.targetId,
    type: patchTarget,
    universeId: undefined
  };
}

function aiInsightItem(state: AppState, insight: AIInsight): ReviewQueueItem | undefined {
  if (!shouldAIInsightAppearInReviewQueue(insight)) return undefined;

  const target = targetForInsight(state, insight);

  return {
    id: `ai_insight:${insight.id}`,
    type: "ai_insight",
    title: `AI draft: ${target.title}`,
    subtitle: `${insight.type} draft`,
    body: insight.content,
    status: insight.status,
    sourceId: insight.id,
    sourceType: "ai_insight",
    targetId: insight.targetId,
    targetType: target.type,
    universeId: target.universeId,
    priority: insight.patch ? 95 : 85,
    createdAt: insight.createdAt,
    updatedAt: insight.createdAt
  };
}

function decisionRecordItem(record: DecisionRecord): ReviewQueueItem | undefined {
  if (!shouldDecisionRecordAppearInReviewQueue(record)) return undefined;

  return {
    id: `decision_record:${record.id}`,
    type: "decision_record",
    title: `Decision: ${clean(record.title) || "Untitled decision"}`,
    subtitle: "Proposed decision",
    body: [record.decision, record.rationale, record.consequences].filter(Boolean).join(" "),
    status: record.status,
    sourceId: record.id,
    sourceType: "decision_record",
    universeId: firstValue(record.linkedUniverseIds),
    priority: 80,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function blockingQuestionPriority(question: BlockingQuestion) {
  if (question.impactLevel === "blocking") return 95;
  if (question.impactLevel === "high") return 92;
  if (question.finalResolution || question.proposedResolution) return 90;
  if (isBlockingQuestionInReview(question)) return 75;
  return 55;
}

function blockingQuestionItem(question: BlockingQuestion): ReviewQueueItem | undefined {
  if (!shouldBlockingQuestionAppearInReviewQueue(question)) return undefined;

  const reviewResolution = clean(question.finalResolution) || clean(question.proposedResolution);

  return {
    id: `blocking_question:${question.id}`,
    type: "blocking_question",
    title: `Blocking question: ${clean(question.question) || "Untitled question"}`,
    subtitle: "Needs user review",
    body: [
      question.context,
      question.decisionNote,
      question.proposedResolution,
      question.finalResolution,
      question.preferredOptionId
    ].filter(Boolean).join(" "),
    status: question.status,
    sourceId: question.id,
    sourceType: "blocking_question",
    universeId: firstValue(question.linkedUniverseIds),
    priority: blockingQuestionPriority(question),
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
    reviewResolution
  };
}

function handoffCandidateItem(project: Project): ReviewQueueItem | undefined {
  const projectReadiness = getProjectContentReadiness(project);

  if (!shouldProjectAppearInHandoffReviewQueue(project, projectReadiness)) {
    return undefined;
  }

  return {
    id: `handoff_candidate:${project.id}`,
    type: "handoff_candidate",
    title: `Handoff review: ${clean(project.name) || "Untitled project"}`,
    subtitle: `${projectReadiness.score}% ready for engineering`,
    body: [project.intent, project.nextAction, project.unknowns.join(" ")].filter(Boolean).join(" "),
    status: projectReadiness.value,
    sourceId: project.id,
    sourceType: "handoff_candidate",
    targetId: project.id,
    targetType: "project",
    universeId: project.universeId,
    priority: 70,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt
  };
}

export function buildReviewQueue(state: AppState): ReviewQueueItem[] {
  return [
    ...state.aiInsights.map((insight) => aiInsightItem(state, insight)),
    ...(state.decisionRecords ?? []).map(decisionRecordItem),
    ...(state.blockingQuestions ?? []).map(blockingQuestionItem),
    ...state.projects.map(handoffCandidateItem)
  ]
    .filter((item): item is ReviewQueueItem => Boolean(item))
    .sort(compareItems);
}

export function searchReviewQueue(state: AppState, options: ReviewQueueOptions = {}) {
  const searchText = clean(options.searchText).toLowerCase();
  const type = options.type ?? "all";
  const status = options.status ?? "all";
  const universeId = options.universeId ?? "all";

  return buildReviewQueue(state)
    .filter((item) => type === "all" || item.type === type)
    .filter((item) => status === "all" || item.status === status)
    .filter((item) => universeId === "all" || item.universeId === universeId)
    .filter((item) => !searchText || itemHaystack(item).includes(searchText));
}

export function getReviewQueueCounts(items: ReviewQueueItem[]): ReviewQueueCounts {
  return {
    total: items.length,
    aiDrafts: items.filter((item) => item.type === "ai_insight").length,
    proposedDecisions: items.filter((item) => item.type === "decision_record").length,
    blockingQuestions: items.filter((item) => item.type === "blocking_question").length,
    handoffCandidates: items.filter((item) => item.type === "handoff_candidate").length
  };
}
