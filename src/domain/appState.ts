import { normalizeBlockingQuestions } from "./blockingQuestions";
import { normalizeEngineeringReadiness } from "./engineeringReadiness";
import type { AppState } from "./types";

export function normalizeAppState(state: AppState): AppState {
  return {
    ...state,
    blockingQuestions: normalizeBlockingQuestions(state.blockingQuestions),
    decisionRecords: state.decisionRecords ?? [],
    engineeringReadiness: normalizeEngineeringReadiness(state.engineeringReadiness)
  };
}
