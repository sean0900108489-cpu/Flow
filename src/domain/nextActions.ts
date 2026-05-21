import { getBlockingQuestionSummary, normalizeBlockingQuestions } from "./blockingQuestions";
import { calculateEngineeringReadiness, normalizeEngineeringReadiness } from "./engineeringReadiness";
import { getReviewQueueCounts, searchReviewQueue } from "./reviewQueue";
import type {
  AppState,
  BlockingQuestion,
  NextActionConfidence,
  NextActionFocusMode,
  NextActionState,
  Project,
  ThoughtItem
} from "./types";
import { now } from "./utils";

export type NextActionSourceType =
  | "thought"
  | "project"
  | "blocking_question"
  | "review_queue"
  | "engineering_readiness"
  | "system";
export type NextActionStatus = "available" | "blocked" | "completed";
export type NextActionPriority = "low" | "medium" | "high" | "urgent";
export type NextActionType =
  | "decide"
  | "review"
  | "clarify"
  | "prototype"
  | "implement"
  | "organize"
  | "follow-up";

export interface NextActionItem {
  id: string;
  sourceType: NextActionSourceType;
  sourceId: string;
  sourceKey?: string;
  title: string;
  description: string;
  actionText: string;
  suggestedNextActionText: string;
  universeId?: string;
  status: NextActionStatus;
  sourceStatus?: string;
  sourceArea: string;
  reason: string;
  priority: NextActionPriority;
  actionType: NextActionType;
  blockers: string[];
  confidence: number;
  updatedAt?: string;
}

export interface NextActionListOptions {
  searchText?: string;
  sourceType?: NextActionSourceType | "all";
  universeId?: string | "all";
  status?: NextActionStatus | "all";
}

export interface NextActionSignals {
  openBlockingDecisionCount: number;
  highBlockingUnresolvedDecisionCount: number;
  decidedDecisionCount: number;
  readinessStatus: string;
  readinessScore: number;
  pendingReviewCount: number;
  reviewBlockerCount: number;
  dismissedActionCount: number;
}

export interface NextActionSummary {
  recommendedActions: NextActionItem[];
  dismissedActions: NextActionItem[];
  allActions: NextActionItem[];
  topAction?: NextActionItem;
  focusAction?: NextActionItem;
  priority: NextActionPriority;
  reason: string;
  sourceType?: NextActionSourceType;
  sourceId?: string;
  sourceKey?: string;
  blockers: string[];
  suggestedNextActionText: string;
  confidence: number;
  score: number;
  nextActionState: NextActionState;
  signals: NextActionSignals;
}

export interface NextActionResult {
  state: AppState;
  ok: boolean;
  error?: string;
}

export type NextActionStatePatch = Partial<
  Pick<NextActionState, "manualNote" | "manualConfidence" | "focusMode" | "lastReviewedAt">
>;

const defaultTimestamp = "2026-01-01T00:00:00.000Z";
const confidenceLevels: NextActionConfidence[] = ["low", "medium", "high"];
const focusModes: NextActionFocusMode[] = ["explore", "decide", "build", "review"];
const highImpactLevels = new Set(["high", "blocking"]);

export function defaultNextActionState(): NextActionState {
  return {
    savedActionIds: [],
    selectedFocusActionId: undefined,
    dismissedActionIds: [],
    manualNote: "",
    manualConfidence: "medium",
    focusMode: "decide",
    lastReviewedAt: undefined,
    updatedAt: defaultTimestamp
  };
}

function text(value: string | undefined) {
  return value?.trim() ?? "";
}

function unique(values: Array<string | undefined>) {
  return Array.from(new Set(values.map(text).filter(Boolean)));
}

function isConfidence(value: unknown): value is NextActionConfidence {
  return typeof value === "string" && confidenceLevels.includes(value as NextActionConfidence);
}

function isFocusMode(value: unknown): value is NextActionFocusMode {
  return typeof value === "string" && focusModes.includes(value as NextActionFocusMode);
}

export function normalizeNextActionState(state: NextActionState | undefined): NextActionState {
  const fallback = defaultNextActionState();

  if (!state) return fallback;

  return {
    savedActionIds: unique(state.savedActionIds ?? []),
    selectedFocusActionId: text(state.selectedFocusActionId) || undefined,
    dismissedActionIds: unique(state.dismissedActionIds ?? []),
    manualNote: text(state.manualNote),
    manualConfidence: isConfidence(state.manualConfidence) ? state.manualConfidence : fallback.manualConfidence,
    focusMode: isFocusMode(state.focusMode) ? state.focusMode : fallback.focusMode,
    lastReviewedAt: text(state.lastReviewedAt) || undefined,
    updatedAt: text(state.updatedAt) || fallback.updatedAt
  };
}

function normalizedState(state: AppState): AppState {
  return {
    ...state,
    blockingQuestions: normalizeBlockingQuestions(state.blockingQuestions),
    decisionRecords: state.decisionRecords ?? [],
    engineeringReadiness: normalizeEngineeringReadiness(state.engineeringReadiness),
    nextActionState: normalizeNextActionState(state.nextActionState)
  };
}

function firstValue(values: string[] | undefined) {
  return values?.find((value) => text(value));
}

function isUnresolved(question: BlockingQuestion) {
  return question.status === "open" || question.status === "in_review";
}

function isHighImpact(question: BlockingQuestion) {
  return highImpactLevels.has(question.impactLevel ?? "medium");
}

function priorityRank(priority: NextActionPriority) {
  return {
    urgent: 4,
    high: 3,
    medium: 2,
    low: 1
  }[priority];
}

function timestamp(value: string | undefined) {
  return value ? Date.parse(value) || 0 : 0;
}

function compareNextActions(a: NextActionItem, b: NextActionItem) {
  const byPriority = priorityRank(b.priority) - priorityRank(a.priority);
  if (byPriority !== 0) return byPriority;

  const statusPriority: Record<NextActionStatus, number> = {
    blocked: 3,
    available: 2,
    completed: 1
  };
  const byStatus = statusPriority[b.status] - statusPriority[a.status];
  if (byStatus !== 0) return byStatus;

  const byConfidence = b.confidence - a.confidence;
  if (byConfidence !== 0) return byConfidence;

  const byUpdatedAt = timestamp(b.updatedAt) - timestamp(a.updatedAt);
  if (byUpdatedAt !== 0) return byUpdatedAt;

  return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
}

function searchHaystack(item: NextActionItem) {
  return [
    item.title,
    item.description,
    item.actionText,
    item.reason,
    item.sourceStatus,
    item.sourceArea,
    item.priority,
    item.actionType,
    item.status
  ].join(" ").toLowerCase();
}

function thoughtAction(thought: ThoughtItem): NextActionItem | undefined {
  const actionText = text(thought.nextAction);

  if (thought.status === "archived" || !actionText) return undefined;

  const actionType: NextActionType =
    thought.type === "task" ? "implement" : thought.type === "question" ? "clarify" : "organize";

  return {
    id: `thought:${thought.id}`,
    sourceType: "thought",
    sourceId: thought.id,
    title: thought.title,
    description: text(thought.outcome) || text(thought.content) || "Thought has a saved next action.",
    actionText,
    suggestedNextActionText: actionText,
    universeId: thought.universeId,
    status: thought.status === "paused" ? "blocked" : "available",
    sourceStatus: thought.status,
    sourceArea: "Thought",
    reason: text(thought.why) || "Existing thought next action is ready to review.",
    priority: thought.status === "paused" ? "high" : "medium",
    actionType,
    blockers: thought.status === "paused" ? [thought.title] : [],
    confidence: thought.type === "task" ? 72 : 64,
    updatedAt: thought.updatedAt
  };
}

function projectAction(project: Project): NextActionItem | undefined {
  const actionText = text(project.nextAction);

  if (project.status === "archived" || !actionText) return undefined;

  const blocked = project.lifecycleStatus === "blocked";
  const ready = project.readiness === "ready_for_engineering";

  return {
    id: `project:${project.id}`,
    sourceType: "project",
    sourceId: project.id,
    title: project.name,
    description: text(project.intent) || "Project has a saved next action.",
    actionText,
    suggestedNextActionText: actionText,
    universeId: project.universeId,
    status: blocked ? "blocked" : "available",
    sourceStatus: project.lifecycleStatus ?? project.readiness,
    sourceArea: "Project",
    reason: ready ? "Project is already close to an engineering handoff." : "Project next action can move planning forward.",
    priority: blocked ? "high" : ready ? "high" : "medium",
    actionType: ready ? "implement" : "prototype",
    blockers: blocked ? [project.name] : [],
    confidence: ready ? 78 : 66,
    updatedAt: project.updatedAt
  };
}

function blockingQuestionAction(question: BlockingQuestion): NextActionItem | undefined {
  if (!isUnresolved(question)) return undefined;

  const highImpact = isHighImpact(question);
  const actionText = text(question.proposedResolution) ? "Review proposed resolution" : "Resolve blocking question";

  return {
    id: `blocking_question:${question.id}`,
    sourceType: "blocking_question",
    sourceId: question.id,
    title: question.question,
    description: text(question.context) || "Blocking decision needs a clear path.",
    actionText,
    suggestedNextActionText: actionText,
    universeId: firstValue(question.linkedUniverseIds),
    status: highImpact ? "blocked" : "available",
    sourceStatus: question.status,
    sourceArea: "Decision",
    reason: highImpact
      ? "Unresolved high/blocking decision should be handled before engineering moves forward."
      : "Open decision can clarify the next product step.",
    priority: highImpact ? "urgent" : "medium",
    actionType: "decide",
    blockers: highImpact ? [question.question] : [],
    confidence: highImpact ? 98 : 70,
    updatedAt: question.updatedAt
  };
}

function reviewAction(item: ReturnType<typeof searchReviewQueue>[number]): NextActionItem {
  const urgent = item.type === "blocking_question" && item.priority >= 92;
  const actionText =
    item.type === "decision_record"
      ? "Accept or supersede proposed decision"
      : item.type === "handoff_candidate"
        ? "Review handoff candidate"
        : item.type === "ai_insight"
          ? "Review AI draft"
          : "Review blocking question";

  return {
    id: `review_queue:${item.id}`,
    sourceType: "review_queue",
    sourceId: item.sourceId,
    sourceKey: item.id,
    title: `Review: ${item.title}`,
    description: item.subtitle,
    actionText,
    suggestedNextActionText: actionText,
    universeId: item.universeId,
    status: urgent ? "blocked" : "available",
    sourceStatus: item.status,
    sourceArea: "Review",
    reason: urgent ? "Review Queue contains a blocking item." : "Review Queue has a pending item.",
    priority: urgent ? "high" : "medium",
    actionType: "review",
    blockers: urgent ? [item.title] : [],
    confidence: urgent ? 88 : 62,
    updatedAt: item.updatedAt ?? item.createdAt
  };
}

function readinessAction(state: AppState): NextActionItem {
  const readiness = calculateEngineeringReadiness(state);
  const blocker = readiness.blockers[0];
  const readyForEngineering = readiness.overallStatus === "ready_for_engineering";
  const readyToPrototype = readiness.overallStatus === "ready_to_prototype";
  const actionType: NextActionType = readyForEngineering ? "implement" : readyToPrototype ? "prototype" : "clarify";
  const title = readyForEngineering
    ? "Pick the smallest implementable engineering scope"
    : readyToPrototype
      ? "Shape the next prototype workflow"
      : "Clear the main engineering readiness blocker";

  return {
    id: "engineering_readiness:next",
    sourceType: "engineering_readiness",
    sourceId: readiness.overallStatus,
    sourceKey: "engineering_readiness",
    title,
    description: `Readiness is ${readiness.overallStatus} at ${readiness.score}%.`,
    actionText: readiness.suggestedNextAction,
    suggestedNextActionText: readiness.suggestedNextAction,
    status: blocker ? "blocked" : "available",
    sourceStatus: readiness.overallStatus,
    sourceArea: "Readiness",
    reason: blocker
      ? "Engineering Readiness Center still reports a blocker."
      : "Engineering Readiness Center has a clear next phase suggestion.",
    priority: blocker ? "high" : readyForEngineering ? "high" : "medium",
    actionType,
    blockers: blocker ? [blocker] : [],
    confidence: readyForEngineering ? 86 : readyToPrototype ? 74 : 68,
    updatedAt: readiness.assessment.updatedAt
  };
}

function fallbackAction(state: AppState): NextActionItem | undefined {
  if (state.thoughts.length > 0 || state.projects.length > 0) return undefined;

  return {
    id: "system:capture-first-thought",
    sourceType: "system",
    sourceId: "capture-first-thought",
    title: "Capture the first thought",
    description: "No thoughts or projects exist yet.",
    actionText: "Create or classify the first thought/task/universe.",
    suggestedNextActionText: "Create or classify the first thought/task/universe.",
    status: "available",
    sourceArea: "System",
    reason: "The app needs source material before it can recommend deeper workflow actions.",
    priority: "medium",
    actionType: "organize",
    blockers: [],
    confidence: 60
  };
}

function buildActions(state: AppState) {
  const reviewItems = searchReviewQueue(state);
  const actions = [
    ...(state.blockingQuestions ?? []).map(blockingQuestionAction),
    readinessAction(state),
    ...reviewItems.filter((item) => item.type !== "blocking_question").map(reviewAction),
    ...state.thoughts.map(thoughtAction),
    ...state.projects.map(projectAction),
    fallbackAction(state)
  ].filter((item): item is NextActionItem => Boolean(item));

  return actions.sort(compareNextActions);
}

function filterActions(actions: NextActionItem[], options: NextActionListOptions) {
  const searchText = text(options.searchText).toLowerCase();
  const sourceType = options.sourceType ?? "all";
  const universeId = options.universeId ?? "all";
  const status = options.status ?? "all";

  return actions
    .filter((item) => sourceType === "all" || item.sourceType === sourceType)
    .filter((item) => universeId === "all" || item.universeId === universeId)
    .filter((item) => status === "all" || item.status === status)
    .filter((item) => !searchText || searchHaystack(item).includes(searchText));
}

export function calculateNextActionSummary(state: AppState): NextActionSummary {
  const nextState = normalizedState(state);
  const nextActionState = nextState.nextActionState ?? defaultNextActionState();
  const actions = buildActions(nextState);
  const dismissedIds = new Set(nextActionState.dismissedActionIds);
  const recommendedActions = actions.filter((item) => !dismissedIds.has(item.id));
  const dismissedActions = actions.filter((item) => dismissedIds.has(item.id));
  const focusAction = actions.find((item) => item.id === nextActionState.selectedFocusActionId && !dismissedIds.has(item.id));
  const topAction = recommendedActions[0];
  const readiness = calculateEngineeringReadiness(nextState);
  const reviewItems = searchReviewQueue(nextState);
  const reviewCounts = getReviewQueueCounts(reviewItems);
  const decisionSummary = getBlockingQuestionSummary(nextState);
  const highBlockingUnresolved = (nextState.blockingQuestions ?? []).filter(
    (question) => isUnresolved(question) && isHighImpact(question)
  );
  const confidenceOffset = nextActionState.manualConfidence === "high" ? 8 : nextActionState.manualConfidence === "low" ? -8 : 0;
  const confidence = Math.max(0, Math.min(100, (topAction?.confidence ?? 50) + confidenceOffset));

  return {
    recommendedActions,
    dismissedActions,
    allActions: actions,
    topAction,
    focusAction,
    priority: topAction?.priority ?? "low",
    reason: topAction?.reason ?? "No recommended action is currently available.",
    sourceType: topAction?.sourceType,
    sourceId: topAction?.sourceId,
    sourceKey: topAction?.sourceKey,
    blockers: topAction?.blockers ?? [],
    suggestedNextActionText: topAction?.suggestedNextActionText ?? "Review the dashboard.",
    confidence,
    score: confidence,
    nextActionState,
    signals: {
      openBlockingDecisionCount: decisionSummary.openCount,
      highBlockingUnresolvedDecisionCount: highBlockingUnresolved.length,
      decidedDecisionCount: decisionSummary.decidedCount,
      readinessStatus: readiness.overallStatus,
      readinessScore: readiness.score,
      pendingReviewCount: reviewCounts.total,
      reviewBlockerCount: readiness.reviewBlockerCount,
      dismissedActionCount: nextActionState.dismissedActionIds.length
    }
  };
}

export function listNextActions(state: AppState, options: NextActionListOptions = {}) {
  const summary = calculateNextActionSummary(state);

  return filterActions(summary.recommendedActions, options);
}

function updateState(state: AppState, patch: Partial<NextActionState>): NextActionResult {
  const current = normalizeNextActionState(state.nextActionState);
  const next = normalizeNextActionState({
    ...current,
    ...patch,
    updatedAt: now()
  });

  return {
    state: {
      ...state,
      nextActionState: next
    },
    ok: true
  };
}

export function updateNextActionState(state: AppState, patch: NextActionStatePatch): NextActionResult {
  return updateState(state, patch);
}

export function pinNextAction(state: AppState, actionId: string): NextActionResult {
  const id = text(actionId);

  if (!id) return { state, ok: false, error: "Next action id is required." };

  const current = normalizeNextActionState(state.nextActionState);

  return updateState(state, {
    selectedFocusActionId: id,
    savedActionIds: unique([...current.savedActionIds, id])
  });
}

export function clearFocusNextAction(state: AppState): NextActionResult {
  return updateState(state, { selectedFocusActionId: undefined });
}

export function dismissNextAction(state: AppState, actionId: string): NextActionResult {
  const id = text(actionId);

  if (!id) return { state, ok: false, error: "Next action id is required." };

  const current = normalizeNextActionState(state.nextActionState);

  return updateState(state, {
    dismissedActionIds: unique([...current.dismissedActionIds, id]),
    selectedFocusActionId: current.selectedFocusActionId === id ? undefined : current.selectedFocusActionId
  });
}

export function clearDismissedNextActions(state: AppState): NextActionResult {
  return updateState(state, { dismissedActionIds: [] });
}

export function completeNextAction(state: AppState, item: NextActionItem): NextActionResult {
  if (item.sourceType === "thought") {
    const thought = state.thoughts.find((candidate) => candidate.id === item.sourceId);

    if (!thought) {
      return { state, ok: false, error: "Thought not found." };
    }

    return {
      state: {
        ...state,
        thoughts: state.thoughts.map((candidate) =>
          candidate.id === item.sourceId
            ? { ...candidate, nextAction: "", updatedAt: now() }
            : candidate
        )
      },
      ok: true
    };
  }

  if (item.sourceType === "project") {
    const project = state.projects.find((candidate) => candidate.id === item.sourceId);

    if (!project) {
      return { state, ok: false, error: "Project not found." };
    }

    return {
      state: {
        ...state,
        projects: state.projects.map((candidate) =>
          candidate.id === item.sourceId
            ? { ...candidate, nextAction: "", updatedAt: now() }
            : candidate
        )
      },
      ok: true
    };
  }

  if (item.sourceType !== "blocking_question") {
    return { state, ok: false, error: "Only thought, project, and blocking question actions can be completed directly." };
  }

  const question = (state.blockingQuestions ?? []).find((candidate) => candidate.id === item.sourceId);

  if (!question) {
    return { state, ok: false, error: "Blocking question not found." };
  }

  return {
    state: {
      ...state,
      blockingQuestions: (state.blockingQuestions ?? []).map((candidate) =>
        candidate.id === item.sourceId
          ? {
              ...candidate,
              status: candidate.status === "open" ? "in_review" : candidate.status,
              updatedAt: now()
            }
          : candidate
      )
    },
    ok: true
  };
}

export function setNextActionForSource(
  state: AppState,
  sourceType: NextActionSourceType,
  sourceId: string,
  nextAction: string
): NextActionResult {
  if (sourceType !== "thought" && sourceType !== "project") {
    return {
      state,
      ok: false,
      error: "Only thoughts and projects support direct nextAction updates."
    };
  }

  const value = nextAction.trim();

  if (sourceType === "thought") {
    const thought = state.thoughts.find((candidate) => candidate.id === sourceId);

    if (!thought) {
      return { state, ok: false, error: "Thought not found." };
    }

    return {
      state: {
        ...state,
        thoughts: state.thoughts.map((candidate) =>
          candidate.id === sourceId
            ? { ...candidate, nextAction: value, updatedAt: now() }
            : candidate
        )
      },
      ok: true
    };
  }

  const project = state.projects.find((candidate) => candidate.id === sourceId);

  if (!project) {
    return { state, ok: false, error: "Project not found." };
  }

  return {
    state: {
      ...state,
      projects: state.projects.map((candidate) =>
        candidate.id === sourceId
          ? { ...candidate, nextAction: value, updatedAt: now() }
          : candidate
      )
    },
    ok: true
  };
}
