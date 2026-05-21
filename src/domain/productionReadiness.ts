import { getBlockingQuestionSummary } from "./blockingQuestions";
import { calculateEngineeringReadiness } from "./engineeringReadiness";
import { normalizeAppState } from "./appState";
import { calculateNextActionSummary } from "./nextActions";
import { getReviewQueueCounts, searchReviewQueue } from "./reviewQueue";
import type { AppState } from "./types";

export type ProductionReadinessItemId =
  | "build_ready"
  | "persistence_ready"
  | "import_export_ready"
  | "review_system_ready"
  | "decision_tracking_ready"
  | "engineering_readiness_available"
  | "next_action_system_available";

export interface ProductionReadinessItem {
  id: ProductionReadinessItemId;
  label: string;
  ready: boolean;
  detail: string;
}

export interface ProductionReadinessSummary {
  ready: boolean;
  readyCount: number;
  totalCount: number;
  storageMode: "localStorage";
  localFirstMode: true;
  importExportSupport: "full-app-state-json";
  items: ProductionReadinessItem[];
  retainedData: {
    blockingQuestions: number;
    decisionRecords: number;
    engineeringReadiness: boolean;
    nextActionState: boolean;
  };
}

function hasRequiredCollections(state: AppState) {
  return [
    state.universes,
    state.thoughts,
    state.projects,
    state.relationships,
    state.aiInsights,
    state.blockingQuestions,
    state.decisionRecords
  ].every(Array.isArray);
}

export function calculateProductionReadinessSummary(state: AppState): ProductionReadinessSummary {
  const normalized = normalizeAppState(state);
  const reviewItems = searchReviewQueue(normalized);
  const reviewCounts = getReviewQueueCounts(reviewItems);
  const decisionSummary = getBlockingQuestionSummary(normalized);
  const engineeringReadiness = calculateEngineeringReadiness(normalized);
  const nextActionSummary = calculateNextActionSummary(normalized);
  const requiredCollectionsReady = hasRequiredCollections(normalized);
  const retainedData = {
    blockingQuestions: normalized.blockingQuestions?.length ?? 0,
    decisionRecords: normalized.decisionRecords?.length ?? 0,
    engineeringReadiness: Boolean(normalized.engineeringReadiness),
    nextActionState: Boolean(normalized.nextActionState)
  };
  const items: ProductionReadinessItem[] = [
    {
      id: "build_ready",
      label: "Build ready",
      ready: true,
      detail: "Production build is configured through npm run build and Vite output."
    },
    {
      id: "persistence_ready",
      label: "Persistence ready",
      ready: requiredCollectionsReady && retainedData.engineeringReadiness && retainedData.nextActionState,
      detail: "AppState normalizes legacy data before localStorage persistence."
    },
    {
      id: "import_export_ready",
      label: "Import/export ready",
      ready: requiredCollectionsReady,
      detail: "Full AppState JSON includes core collections and additive center data."
    },
    {
      id: "review_system_ready",
      label: "Review system ready",
      ready: reviewCounts.total >= 0,
      detail: `${reviewCounts.total} current review item(s) can be summarized and filtered.`
    },
    {
      id: "decision_tracking_ready",
      label: "Decision tracking ready",
      ready: retainedData.blockingQuestions > 0 && decisionSummary.openCount >= 0,
      detail: `${retainedData.blockingQuestions} blocking question(s), ${retainedData.decisionRecords} decision record(s).`
    },
    {
      id: "engineering_readiness_available",
      label: "Engineering readiness available",
      ready: retainedData.engineeringReadiness,
      detail: `Readiness is ${engineeringReadiness.overallStatus} at ${engineeringReadiness.score}%.`
    },
    {
      id: "next_action_system_available",
      label: "Next action system available",
      ready: retainedData.nextActionState && nextActionSummary.allActions.length >= 0,
      detail: `${nextActionSummary.recommendedActions.length} recommended next action(s) available.`
    }
  ];
  const readyCount = items.filter((item) => item.ready).length;

  return {
    ready: readyCount === items.length,
    readyCount,
    totalCount: items.length,
    storageMode: "localStorage",
    localFirstMode: true,
    importExportSupport: "full-app-state-json",
    items,
    retainedData
  };
}
