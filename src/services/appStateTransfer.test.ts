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
  });

  it("round trips archived thought and project statuses", () => {
    const json = stringifyAppState({
      ...seed,
      universes: seed.universes.map((universe, index) => index === 0 ? { ...universe, status: "archived" } : universe),
      thoughts: seed.thoughts.map((thought, index) => index === 0 ? { ...thought, status: "archived" } : thought),
      projects: seed.projects.map((project, index) => index === 0 ? { ...project, status: "archived" } : project)
    });

    const result = parseAppStateJson(json);

    expect(result.ok).toBe(true);
    expect(result.state?.universes[0].status).toBe("archived");
    expect(result.state?.thoughts[0].status).toBe("archived");
    expect(result.state?.projects[0].status).toBe("archived");
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
