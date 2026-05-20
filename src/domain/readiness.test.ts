import { describe, expect, it } from "vitest";
import type { Project } from "./types";
import { readiness } from "./readiness";

const baseProject: Project = {
  id: "p-test",
  universeId: "u-test",
  status: "active",
  name: "Test Project",
  intent: "Build thought system",
  users: ["Sean"],
  features: ["Capture"],
  screens: ["Dashboard"],
  dataObjects: ["ThoughtItem"],
  flowSteps: ["Capture idea"],
  unknowns: [],
  nextAction: "Build MVP",
  readiness: "draftable",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

describe("project readiness", () => {
  it("marks complete project as ready_for_engineering", () => {
    const result = readiness(baseProject);

    expect(result.score).toBe(100);
    expect(result.value).toBe("ready_for_engineering");
    expect(result.missing).toEqual([]);
  });

  it("marks incomplete project as needs_clarification", () => {
    const result = readiness({
      ...baseProject,
      features: [],
      screens: [],
      flowSteps: [],
      nextAction: ""
    });

    expect(result.score).toBe(43);
    expect(result.value).toBe("needs_clarification");
    expect(result.missing).toEqual(["features", "screens", "flowSteps", "nextAction"]);
  });
});
