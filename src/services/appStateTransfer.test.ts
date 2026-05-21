import { describe, expect, it } from "vitest";
import { seed } from "../data/seed";
import { parseAppStateJson, stringifyAppState, validateAppState } from "./appStateTransfer";

describe("app state transfer", () => {
  it("validates seed state", () => {
    const result = validateAppState(seed);

    expect(result.ok).toBe(true);
    expect(result.state?.thoughts.length).toBeGreaterThan(0);
  });

  it("rejects invalid shape", () => {
    const result = validateAppState({ thoughts: [] });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("universes");
  });

  it("round trips app state json", () => {
    const json = stringifyAppState(seed);
    const result = parseAppStateJson(json);

    expect(result.ok).toBe(true);
    expect(result.state?.projects[0].name).toBe("Todo Thought Universe MVP");
    expect(result.state?.projects[0].status).toBe("active");
    expect(result.state?.blockingQuestions?.length).toBeGreaterThanOrEqual(3);
  });

  it("imports old state without blocking questions", () => {
    const { blockingQuestions, ...oldState } = seed;
    const result = parseAppStateJson(JSON.stringify(oldState));

    expect(result.ok).toBe(true);
    expect(result.state?.blockingQuestions).toBeUndefined();
  });

  it("imports old state without decision records", () => {
    const { decisionRecords, ...oldState } = {
      ...seed,
      decisionRecords: undefined
    };
    const result = parseAppStateJson(JSON.stringify(oldState));

    expect(result.ok).toBe(true);
    expect(result.state?.decisionRecords).toBeUndefined();
  });

  it("imports state with blocking questions", () => {
    const result = parseAppStateJson(stringifyAppState(seed));

    expect(result.ok).toBe(true);
    expect(result.state?.blockingQuestions?.[0].question).toContain("ThoughtItem");
  });

  it("imports state with decision records", () => {
    const result = parseAppStateJson(stringifyAppState({
      ...seed,
      decisionRecords: [
        {
          id: "decision-transfer",
          title: "Persist decision records",
          decision: "Include decisionRecords in AppState.",
          status: "accepted",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z"
        }
      ]
    }));

    expect(result.ok).toBe(true);
    expect(result.state?.decisionRecords?.[0].title).toBe("Persist decision records");
  });

  it("exports blocking questions when present", () => {
    const json = stringifyAppState(seed);

    expect(json).toContain('"blockingQuestions"');
    expect(json).toContain("Universe 是標籤、資料夾，還是獨立物件？");
  });

  it("exports decision records when present", () => {
    const json = stringifyAppState({
      ...seed,
      decisionRecords: [
        {
          id: "decision-export",
          title: "Export decision records",
          decision: "Keep decisions portable with AppState.",
          status: "proposed",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z"
        }
      ]
    });

    expect(json).toContain('"decisionRecords"');
    expect(json).toContain("Export decision records");
  });

  it("round trips project linked thought ids", () => {
    const json = stringifyAppState({
      ...seed,
      projects: seed.projects.map((project, index) =>
        index === 0 ? { ...project, linkedThoughtIds: ["t-1", "t-2"] } : project
      )
    });
    const result = parseAppStateJson(json);

    expect(result.ok).toBe(true);
    expect(result.state?.projects[0].linkedThoughtIds).toEqual(["t-1", "t-2"]);
  });

  it("round trips archived thought and project statuses", () => {
    const json = stringifyAppState({
      ...seed,
      universes: seed.universes.map((universe, index) => index === 0 ? { ...universe, status: "archived" } : universe),
      thoughts: seed.thoughts.map((thought, index) => index === 0 ? { ...thought, status: "archived" } : thought),
      projects: seed.projects.map((project, index) => index === 0 ? { ...project, status: "archived", lifecycleStatus: "handoff_ready" } : project)
    });

    const result = parseAppStateJson(json);

    expect(result.ok).toBe(true);
    expect(result.state?.universes[0].status).toBe("archived");
    expect(result.state?.thoughts[0].status).toBe("archived");
    expect(result.state?.projects[0].status).toBe("archived");
    expect(result.state?.projects[0].lifecycleStatus).toBe("handoff_ready");
  });

  it("round trips AIInsight patches and legacy insights without patches", () => {
    const json = stringifyAppState({
      ...seed,
      aiInsights: [
        {
          id: "ai-patch",
          targetId: "t-1",
          type: "classification",
          content: "Patch draft",
          status: "draft",
          createdAt: "2026-01-01T00:00:00.000Z",
          patch: {
            targetType: "thought",
            targetId: "t-1",
            operations: [
              {
                type: "updateThought",
                thoughtId: "t-1",
                patch: { nextAction: "Patch from imported state" }
              }
            ]
          }
        },
        {
          id: "ai-legacy",
          targetId: "t-2",
          type: "classification",
          content: "Legacy draft",
          status: "draft",
          createdAt: "2026-01-01T00:00:00.000Z"
        }
      ]
    });

    const result = parseAppStateJson(json);

    expect(result.ok).toBe(true);
    expect(result.state?.aiInsights[0].patch?.operations[0].type).toBe("updateThought");
    expect(result.state?.aiInsights[1].patch).toBeUndefined();
  });
});
