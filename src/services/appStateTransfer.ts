import type { AppState } from "../domain/types";
import { normalizeAppState } from "../domain/appState";
import {
  validateAppStateInvariants,
  type AppStateInvariantWarning
} from "../domain/validation/appStateInvariants";

export interface AppStateImportResult {
  ok: boolean;
  state?: AppState;
  error?: string;
  warnings?: AppStateInvariantWarning[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateAppState(value: unknown): AppStateImportResult {
  if (!isRecord(value)) {
    return { ok: false, error: "Imported JSON must be an object." };
  }

  const requiredArrays = ["universes", "thoughts", "projects", "relationships", "aiInsights"] as const;

  for (const key of requiredArrays) {
    if (!Array.isArray(value[key])) {
      return { ok: false, error: `Missing or invalid array: ${key}` };
    }
  }

  if ("blockingQuestions" in value && value.blockingQuestions !== undefined && !Array.isArray(value.blockingQuestions)) {
    return { ok: false, error: "Invalid array: blockingQuestions" };
  }

  if ("decisionRecords" in value && value.decisionRecords !== undefined && !Array.isArray(value.decisionRecords)) {
    return { ok: false, error: "Invalid array: decisionRecords" };
  }

  if ("nextActionState" in value && value.nextActionState !== undefined && !isRecord(value.nextActionState)) {
    return { ok: false, error: "Invalid object: nextActionState" };
  }

  if ("engineeringReadiness" in value && value.engineeringReadiness !== undefined && !isRecord(value.engineeringReadiness)) {
    return { ok: false, error: "Invalid object: engineeringReadiness" };
  }

  const state = normalizeAppState(value as unknown as AppState);

  return {
    ok: true,
    state,
    warnings: validateAppStateInvariants(state)
  };
}

export function parseAppStateJson(json: string): AppStateImportResult {
  try {
    return validateAppState(JSON.parse(json));
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid JSON."
    };
  }
}

export function stringifyAppState(state: AppState): string {
  return JSON.stringify(normalizeAppState(state), null, 2);
}

export function downloadJson(filename: string, json: string) {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}
