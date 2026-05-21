import { describe, expect, it } from "vitest";
import { seed } from "../data/seed";
import { normalizeAppState } from "./appState";
import {
  calculateEngineeringReadiness,
  defaultEngineeringReadinessAssessment,
  updateEngineeringReadinessAssessment
} from "./engineeringReadiness";
import type { AppState, BlockingQuestion } from "./types";

const emptyState: AppState = {
  universes: [],
  thoughts: [],
  projects: [],
  relationships: [],
  aiInsights: []
};

function withoutDecisionPath(question: BlockingQuestion): BlockingQuestion {
  return {
    ...question,
    status: "open",
    proposedResolution: "",
    finalResolution: "",
    decisionNote: "",
    preferredOptionId: ""
  };
}

describe("engineering readiness", () => {
  it("initializes default readiness state for legacy app state", () => {
    const normalized = normalizeAppState(emptyState);

    expect(normalized.engineeringReadiness).toEqual(defaultEngineeringReadinessAssessment());
  });

  it("does not return Ready for Engineering while high impact blocking questions have no decision path", () => {
    const normalized = normalizeAppState(seed);
    const state: AppState = {
      ...normalized,
      blockingQuestions: normalized.blockingQuestions?.map((question) =>
        question.id === "bq-engineering-readiness" ? withoutDecisionPath(question) : question
      )
    };
    const summary = calculateEngineeringReadiness(state);

    expect(summary.overallStatus).toBe("not_ready");
    expect(summary.blockers).toContain("專案什麼時候可以進入工程階段？");
    expect(summary.score).toBeLessThan(75);
  });

  it("raises readiness when high impact decisions have a preferred option", () => {
    const normalized = normalizeAppState(seed);
    const blockedState: AppState = {
      ...normalized,
      blockingQuestions: normalized.blockingQuestions?.map((question) =>
        question.id === "bq-engineering-readiness" ? withoutDecisionPath(question) : question
      )
    };
    const preferredState: AppState = {
      ...normalized,
      blockingQuestions: normalized.blockingQuestions?.map((question) =>
        question.id === "bq-engineering-readiness"
          ? {
              ...withoutDecisionPath(question),
              preferredOptionId: "after-review-queue-confirms-minimum-architecture"
            }
          : question
      )
    };
    const blocked = calculateEngineeringReadiness(blockedState);
    const preferred = calculateEngineeringReadiness(preferredState);

    expect(preferred.score).toBeGreaterThan(blocked.score);
    expect(preferred.overallStatus).toBe("ready_to_prototype");
    expect(preferred.warnings).toContain("High impact decisions still need formal resolution before Ready for Engineering.");
  });

  it("updates readiness note, confidence, and target phase", () => {
    const result = updateEngineeringReadinessAssessment(seed, {
      note: "Engineering readiness depends on the review queue and core data decisions.",
      manualConfidence: "high",
      targetPhase: "engineering",
      lastReviewedAt: "2026-05-21T00:00:00.000Z"
    });

    expect(result.ok).toBe(true);
    expect(result.state.engineeringReadiness).toMatchObject({
      note: "Engineering readiness depends on the review queue and core data decisions.",
      manualConfidence: "high",
      targetPhase: "engineering",
      lastReviewedAt: "2026-05-21T00:00:00.000Z"
    });
  });

  it("requires strict conditions before Ready for Engineering", () => {
    const normalized = normalizeAppState(seed);
    const state: AppState = {
      ...normalized,
      engineeringReadiness: {
        note: "Ready after strict review.",
        manualConfidence: "high",
        targetPhase: "engineering",
        updatedAt: "2026-05-21T00:00:00.000Z"
      },
      blockingQuestions: normalized.blockingQuestions?.map((question) => ({
        ...question,
        status: "resolved",
        finalResolution: question.finalResolution ?? question.proposedResolution ?? "Resolved."
      })),
      decisionRecords: [],
      aiInsights: []
    };
    const summary = calculateEngineeringReadiness(state);

    expect(summary.overallStatus).toBe("ready_for_engineering");
    expect(summary.blockers).toEqual([]);
  });
});
