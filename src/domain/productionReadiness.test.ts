import { describe, expect, it } from "vitest";
import { seed } from "../data/seed";
import { calculateProductionReadinessSummary } from "./productionReadiness";

describe("production readiness", () => {
  it("summarizes production readiness from normalized AppState", () => {
    const summary = calculateProductionReadinessSummary(seed);

    expect(summary.ready).toBe(true);
    expect(summary.storageMode).toBe("localStorage");
    expect(summary.importExportSupport).toBe("full-app-state-json");
    expect(summary.items.map((item) => item.id)).toEqual([
      "build_ready",
      "persistence_ready",
      "import_export_ready",
      "review_system_ready",
      "decision_tracking_ready",
      "engineering_readiness_available",
      "next_action_system_available"
    ]);
  });

  it("keeps Decision, Readiness, and Next Action data available for legacy state", () => {
    const { blockingQuestions, decisionRecords, engineeringReadiness, nextActionState, ...legacyState } = seed;
    const summary = calculateProductionReadinessSummary(legacyState);

    expect(summary.retainedData.blockingQuestions).toBeGreaterThanOrEqual(3);
    expect(summary.retainedData.decisionRecords).toBe(0);
    expect(summary.retainedData.engineeringReadiness).toBe(true);
    expect(summary.retainedData.nextActionState).toBe(true);
    expect(summary.items.find((item) => item.id === "persistence_ready")?.ready).toBe(true);
  });
});
