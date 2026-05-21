import { describe, expect, it } from "vitest";
import { seed } from "../data/seed";
import {
  buildProjectHandoffPackage,
  evaluateProjectHandoff,
  markProjectHandoffReady
} from "./engineeringHandoff";
import type { AppState, Project } from "./types";

const completeProject = (patch: Partial<Project> = {}): Project => ({
  id: "p-ready",
  sourceThoughtId: "t-ready",
  universeId: "u-ready",
  status: "active",
  name: "Ready Project",
  intent: "A clear project intent.",
  users: ["Tester"],
  features: ["Feature"],
  screens: ["Screen"],
  dataObjects: ["DataObject"],
  flowSteps: ["Do the work"],
  unknowns: [],
  nextAction: "Start engineering handoff.",
  readiness: "ready_for_engineering",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...patch
});

const stateWithProject = (project: Project): AppState => ({
  universes: [
    {
      id: "u-ready",
      name: "Ready Universe",
      description: "Universe description",
      purpose: "Testing",
      focus: "main"
    }
  ],
  thoughts: [
    {
      id: "t-ready",
      title: "Ready thought",
      content: "Linked project context.",
      type: "project",
      status: "active",
      universeId: "u-ready",
      why: "Testing",
      outcome: "A good handoff.",
      nextAction: "Start engineering handoff.",
      projectId: project.id,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    }
  ],
  projects: [project],
  relationships: [
    {
      id: "r-support",
      sourceId: "t-ready",
      targetId: project.id,
      type: "supports",
      description: "Thought supports project."
    }
  ],
  aiInsights: []
});

describe("engineering handoff", () => {
  it("returns ready for a complete project", () => {
    const state = stateWithProject(completeProject());

    expect(evaluateProjectHandoff(state.projects[0], state)).toMatchObject({
      projectId: "p-ready",
      readiness: "ready",
      score: 100,
      missing: []
    });
  });

  it("returns needs clarification when nextAction is missing", () => {
    const project = completeProject({ nextAction: "" });
    const state = stateWithProject(project);
    const result = evaluateProjectHandoff(project, state);

    expect(result.readiness).toBe("needs_clarification");
    expect(result.missing).toContain("nextAction");
  });

  it("returns blocked for an archived project", () => {
    const project = completeProject({ status: "archived" });
    const state = stateWithProject(project);
    const result = evaluateProjectHandoff(project, state);

    expect(result.readiness).toBe("blocked");
    expect(result.warnings).toContain("Project is archived.");
  });

  it("returns blocked when a relationship blocks the project", () => {
    const project = completeProject();
    const state: AppState = {
      ...stateWithProject(project),
      relationships: [
        {
          id: "r-block",
          sourceId: "t-ready",
          targetId: project.id,
          type: "blocks",
          description: "Blocks handoff."
        }
      ]
    };

    expect(evaluateProjectHandoff(project, state).readiness).toBe("blocked");
  });

  it("treats typed blocks relationships targeting a project as handoff blockers", () => {
    const project = completeProject();
    const state: AppState = {
      ...stateWithProject(project),
      relationships: [
        {
          id: "r-block-typed",
          sourceId: "t-ready",
          sourceType: "thought",
          targetId: project.id,
          targetType: "project",
          type: "blocks",
          description: "Typed blocker."
        }
      ]
    };

    expect(evaluateProjectHandoff(project, state).readiness).toBe("blocked");
  });

  it("builds a handoff package with project, linked thoughts, relationships, and readiness", () => {
    const state = stateWithProject(completeProject());
    const result = buildProjectHandoffPackage("p-ready", state);

    expect(result.kind).toBe("EngineeringFlowInput");
    expect(result.project.id).toBe("p-ready");
    expect(result.linkedThoughts).toHaveLength(1);
    expect(result.relationships).toHaveLength(1);
    expect(result.readiness.readiness).toBe("ready");
    expect(result.engineeringInput.schemaVersion).toBe("engineering-flow-input/v0");
  });

  it("marks a ready project as handoff_ready", () => {
    const state = stateWithProject(completeProject());
    const result = markProjectHandoffReady(state, "p-ready");

    expect(result.ok).toBe(true);
    expect(result.state.projects[0].lifecycleStatus).toBe("handoff_ready");
    expect(result.state.projects[0].readiness).toBe("ready_for_engineering");
  });

  it("does not mark a blocked project as handoff_ready", () => {
    const project = completeProject({ status: "archived" });
    const state = stateWithProject(project);
    const result = markProjectHandoffReady(state, "p-ready");

    expect(result.ok).toBe(false);
    expect(result.state.projects[0].lifecycleStatus).toBeUndefined();
  });

  it("does not mutate original state", () => {
    const state = stateWithProject(completeProject());
    const original = JSON.stringify(state);

    evaluateProjectHandoff(state.projects[0], state);
    buildProjectHandoffPackage("p-ready", state);
    markProjectHandoffReady(state, "p-ready");

    expect(JSON.stringify(state)).toBe(original);
  });

  it("legacy seed projects without lifecycleStatus remain valid", () => {
    const result = evaluateProjectHandoff(seed.projects[0], seed);

    expect(result.projectId).toBe("p-1");
    expect(seed.projects[0].lifecycleStatus).toBeUndefined();
  });
});
