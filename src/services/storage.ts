import type { AppState } from "../domain/types";
import { seed } from "../data/seed";
import { normalizeAppState } from "../domain/blockingQuestions";

export const STORAGE_KEY = "todo-thought-universe:v1";

function normalizeState(state: AppState): AppState {
  return normalizeAppState(state);
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeState(JSON.parse(raw) as AppState) : normalizeState(seed);
  } catch {
    return normalizeState(seed);
  }
}

export function saveState(state: AppState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state), null, 2));
}
