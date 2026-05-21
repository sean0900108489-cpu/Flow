import type { AppState, BlockingQuestion, Project, ThoughtItem } from "./types";
import { now } from "./utils";

export type NextActionSourceType = "thought" | "project" | "blocking_question";
export type NextActionStatus = "available" | "blocked" | "completed";

export interface NextActionItem {
  id: string;
  sourceType: NextActionSourceType;
  sourceId: string;
  title: string;
  actionText: string;
  universeId?: string;
  status: NextActionStatus;
  sourceStatus?: string;
  reason?: string;
  updatedAt?: string;
}

export interface NextActionListOptions {
  searchText?: string;
  sourceType?: NextActionSourceType | "all";
  universeId?: string | "all";
  status?: NextActionStatus | "all";
}

export interface NextActionResult {
  state: AppState;
  ok: boolean;
  error?: string;
}

function text(value: string | undefined) {
  return value?.trim() ?? "";
}

function questions(state: AppState) {
  return state.blockingQuestions ?? [];
}

function onlyUniverseId(question: BlockingQuestion) {
  return question.linkedUniverseIds?.length === 1 ? question.linkedUniverseIds[0] : undefined;
}

function thoughtStatus(thought: ThoughtItem): NextActionStatus {
  return thought.status === "paused" ? "blocked" : "available";
}

function projectStatus(project: Project): NextActionStatus {
  return project.lifecycleStatus === "blocked" ? "blocked" : "available";
}

function searchHaystack(item: NextActionItem) {
  return [
    item.title,
    item.actionText,
    item.reason,
    item.sourceStatus
  ].join(" ").toLowerCase();
}

function timestamp(value: string | undefined) {
  return value ? Date.parse(value) || 0 : 0;
}

function compareNextActions(a: NextActionItem, b: NextActionItem) {
  const statusPriority: Record<NextActionStatus, number> = {
    blocked: 0,
    available: 1,
    completed: 2
  };
  const byStatus = statusPriority[a.status] - statusPriority[b.status];

  if (byStatus !== 0) return byStatus;

  const byUpdatedAt = timestamp(b.updatedAt) - timestamp(a.updatedAt);

  if (byUpdatedAt !== 0) return byUpdatedAt;

  return a.id.localeCompare(b.id);
}

function thoughtAction(thought: ThoughtItem): NextActionItem | undefined {
  const actionText = text(thought.nextAction);

  if (thought.status === "archived" || !actionText) return undefined;

  return {
    id: `thought:${thought.id}`,
    sourceType: "thought",
    sourceId: thought.id,
    title: thought.title,
    actionText,
    universeId: thought.universeId,
    status: thoughtStatus(thought),
    sourceStatus: thought.status,
    updatedAt: thought.updatedAt
  };
}

function projectAction(project: Project): NextActionItem | undefined {
  const actionText = text(project.nextAction);

  if (project.status === "archived" || !actionText) return undefined;

  return {
    id: `project:${project.id}`,
    sourceType: "project",
    sourceId: project.id,
    title: project.name,
    actionText,
    universeId: project.universeId,
    status: projectStatus(project),
    sourceStatus: project.lifecycleStatus ?? project.status,
    updatedAt: project.updatedAt
  };
}

function blockingQuestionAction(question: BlockingQuestion): NextActionItem | undefined {
  if (question.status !== "open" && question.status !== "in_review") return undefined;

  return {
    id: `blocking_question:${question.id}`,
    sourceType: "blocking_question",
    sourceId: question.id,
    title: question.question,
    actionText: text(question.proposedResolution) ? "Review proposed resolution" : "Resolve blocking question",
    universeId: onlyUniverseId(question),
    status: "blocked",
    sourceStatus: question.status,
    reason: question.context,
    updatedAt: question.updatedAt
  };
}

export function listNextActions(state: AppState, options: NextActionListOptions = {}) {
  const searchText = text(options.searchText).toLowerCase();
  const sourceType = options.sourceType ?? "all";
  const universeId = options.universeId ?? "all";
  const status = options.status ?? "all";
  const actions = [
    ...state.thoughts.map(thoughtAction),
    ...state.projects.map(projectAction),
    ...questions(state).map(blockingQuestionAction)
  ].filter((item): item is NextActionItem => Boolean(item));

  return actions
    .filter((item) => sourceType === "all" || item.sourceType === sourceType)
    .filter((item) => universeId === "all" || item.universeId === universeId)
    .filter((item) => status === "all" || item.status === status)
    .filter((item) => !searchText || searchHaystack(item).includes(searchText))
    .sort(compareNextActions);
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

  const question = questions(state).find((candidate) => candidate.id === item.sourceId);

  if (!question) {
    return { state, ok: false, error: "Blocking question not found." };
  }

  return {
    state: {
      ...state,
      blockingQuestions: questions(state).map((candidate) =>
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
  if (sourceType === "blocking_question") {
    return {
      state,
      ok: false,
      error: "Blocking questions do not support direct nextAction."
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
