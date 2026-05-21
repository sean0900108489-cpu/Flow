import type { AppState, ThoughtItem, ThoughtType } from "./types";
import { isThoughtArchived, isThoughtInbox } from "./semantics/statusSemantics";
import { now } from "./utils";

export type ThoughtTriageStage = "needs_universe" | "needs_context" | "needs_next_action" | "ready";

export interface ThoughtTriageItem {
  thought: ThoughtItem;
  stage: ThoughtTriageStage;
  missingFields: string[];
  score: number;
}

export interface ThoughtTriageListOptions {
  searchText?: string;
  type?: ThoughtType | "all";
  universeId?: string | "all";
  stage?: ThoughtTriageStage | "all";
}

export interface ThoughtTriageResult {
  state: AppState;
  ok: boolean;
  error?: string;
}

export type ThoughtTriagePatch = Pick<
  Partial<ThoughtItem>,
  "title" | "content" | "type" | "universeId" | "why" | "outcome" | "nextAction"
>;

function value(text: string | undefined) {
  return text?.trim() ?? "";
}

function searchHaystack(thought: ThoughtItem) {
  return [
    thought.title,
    thought.content,
    thought.type,
    thought.why,
    thought.outcome,
    thought.nextAction
  ].join(" ").toLowerCase();
}

export function triageItem(thought: ThoughtItem): ThoughtTriageItem {
  const missingFields = [
    !value(thought.universeId) ? "universe" : "",
    !value(thought.why) ? "why" : "",
    !value(thought.outcome) ? "outcome" : "",
    !value(thought.nextAction) ? "nextAction" : ""
  ].filter(Boolean);

  let stage: ThoughtTriageStage = "ready";

  if (missingFields.includes("universe")) {
    stage = "needs_universe";
  } else if (missingFields.includes("why") || missingFields.includes("outcome")) {
    stage = "needs_context";
  } else if (missingFields.includes("nextAction")) {
    stage = "needs_next_action";
  }

  return {
    thought,
    stage,
    missingFields,
    score: Math.round(((4 - missingFields.length) / 4) * 100)
  };
}

function compareTriageItems(a: ThoughtTriageItem, b: ThoughtTriageItem) {
  const stagePriority: Record<ThoughtTriageStage, number> = {
    needs_universe: 0,
    needs_context: 1,
    needs_next_action: 2,
    ready: 3
  };
  const byStage = stagePriority[a.stage] - stagePriority[b.stage];

  if (byStage !== 0) return byStage;

  const byScore = a.score - b.score;

  if (byScore !== 0) return byScore;

  return Date.parse(b.thought.updatedAt) - Date.parse(a.thought.updatedAt);
}

export function listThoughtsForTriage(state: AppState, options: ThoughtTriageListOptions = {}) {
  const searchText = value(options.searchText).toLowerCase();
  const type = options.type ?? "all";
  const universeId = options.universeId ?? "all";
  const stage = options.stage ?? "all";

  return state.thoughts
    .filter(isThoughtInbox)
    .map(triageItem)
    .filter((item) => type === "all" || item.thought.type === type)
    .filter((item) => universeId === "all" || item.thought.universeId === universeId)
    .filter((item) => stage === "all" || item.stage === stage)
    .filter((item) => !searchText || searchHaystack(item.thought).includes(searchText))
    .sort(compareTriageItems);
}

export function updateThoughtTriage(
  state: AppState,
  thoughtId: string,
  patch: ThoughtTriagePatch
): ThoughtTriageResult {
  const thought = state.thoughts.find((item) => item.id === thoughtId);

  if (!thought) {
    return { state, ok: false, error: "Thought not found." };
  }

  if (isThoughtArchived(thought)) {
    return { state, ok: false, error: "Archived thoughts cannot be triaged." };
  }

  return {
    state: {
      ...state,
      thoughts: state.thoughts.map((item) =>
        item.id === thoughtId
          ? { ...item, ...patch, updatedAt: now() }
          : item
      )
    },
    ok: true
  };
}

export function markThoughtTriaged(state: AppState, thoughtId: string): ThoughtTriageResult {
  const thought = state.thoughts.find((item) => item.id === thoughtId);

  if (!thought) {
    return { state, ok: false, error: "Thought not found." };
  }

  if (!isThoughtInbox(thought)) {
    return { state, ok: false, error: "Only inbox thoughts can be marked triaged." };
  }

  return {
    state: {
      ...state,
      thoughts: state.thoughts.map((item) =>
        item.id === thoughtId
          ? { ...item, status: "active", updatedAt: now() }
          : item
      )
    },
    ok: true
  };
}
