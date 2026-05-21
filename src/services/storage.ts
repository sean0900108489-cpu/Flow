import type { AppState } from "../domain/types";
import { seed } from "../data/seed";
import { normalizeAppState } from "../domain/appState";
import { validateAppState } from "./appStateTransfer";

export const STORAGE_KEY = "todo-thought-universe:v1";

function normalizeState(state: AppState): AppState {
  return normalizeAppState(state);
}

function fallbackState() {
  return normalizeState(seed);
}

function safeLocalStorage(): Storage | undefined {
  try {
    if (typeof window !== "undefined") return window.localStorage;
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    return undefined;
  }

  return undefined;
}

export function loadState(): AppState {
  const storage = safeLocalStorage();

  if (!storage) return fallbackState();

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return fallbackState();

    const result = validateAppState(JSON.parse(raw));

    return result.ok && result.state ? result.state : fallbackState();
  } catch {
    return fallbackState();
  }
}

export function saveState(state: AppState) {
  const storage = safeLocalStorage();

  if (!storage) return;

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state), null, 2));
  } catch {
    // Local-first persistence should never make the app unusable.
  }
}
