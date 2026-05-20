import type { AppState } from "../domain/types";
import { seed } from "../data/seed";

export const STORAGE_KEY = "todo-thought-universe:v1";

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AppState) : seed;
  } catch {
    return seed;
  }
}

export function saveState(state: AppState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state, null, 2));
}
