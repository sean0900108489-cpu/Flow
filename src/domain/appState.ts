import { normalizeBlockingQuestions } from "./blockingQuestions";
import { normalizeEngineeringReadiness } from "./engineeringReadiness";
import { normalizeNextActionState } from "./nextActions";
import type { AppState } from "./types";

export function normalizeAppState(state: AppState): AppState {
  return {
    ...state,
    blockingQuestions: normalizeBlockingQuestions(state.blockingQuestions),
    decisionRecords: state.decisionRecords ?? [],
    engineeringReadiness: normalizeEngineeringReadiness(state.engineeringReadiness),
    nextActionState: normalizeNextActionState(state.nextActionState)
  };
}
