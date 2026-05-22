import { describe, expect, it } from "vitest";
import { seed } from "../data/seed";
import type { AppState, Project } from "./types";
import {
  cleanupProjectThoughtReferences,
  linkThoughtToProjectReference,
  unlinkThoughtFromProjectReferences
} from "./projectThoughtLinks";

function state(): AppState {
  return structuredClone(seed);
}

function stateWithSecondProject(): AppState {
  const base = state();
  const sourceProject = base.projects.find((project) => project.id === "p-1") as Project;
  const { sourceThoughtId: _sourceThoughtId, ...projectWithoutSourceThought } = sourceProject;

  return {
    ...base,
    projects: [
      ...base.projects,
      {
        ...projectWithoutSourceThought,
        id: "p-2",
        name: "Second project",
        intent: "Second project for direct link helper tests.",
        linkedThoughtIds: []
      }
    ]
  };
}

describe("projectThoughtLinks", () => {
  it("links a thought to a project and adds the reciprocal linkedThoughtIds entry once", () => {
    const result = linkThoughtToProjectReference(state(), "p-1", "t-2");
    const linkedThoughtIds = result.state.projects.find((project) => project.id === "p-1")?.linkedThoughtIds ?? [];

    expect(result.ok).toBe(true);
    expect(result.projectId).toBe("p-1");
    expect(result.thoughtId).toBe("t-2");
    expect(result.state.thoughts.find((thought) => thought.id === "t-2")?.projectId).toBe("p-1");
    expect(linkedThoughtIds).toContain("t-2");
    expect(linkedThoughtIds.filter((id) => id === "t-2")).toHaveLength(1);
  });

  it("moves a thought without leaving stale linkedThoughtIds on the old project", () => {
    const result = linkThoughtToProjectReference(stateWithSecondProject(), "p-2", "t-1");
    const firstProjectLinkedThoughtIds =
      result.state.projects.find((project) => project.id === "p-1")?.linkedThoughtIds ?? [];
    const secondProjectLinkedThoughtIds =
      result.state.projects.find((project) => project.id === "p-2")?.linkedThoughtIds ?? [];

    expect(result.ok).toBe(true);
    expect(result.state.thoughts.find((thought) => thought.id === "t-1")?.projectId).toBe("p-2");
    expect(firstProjectLinkedThoughtIds).not.toContain("t-1");
    expect(secondProjectLinkedThoughtIds).toContain("t-1");
    expect(secondProjectLinkedThoughtIds.filter((id) => id === "t-1")).toHaveLength(1);
  });

  it("unlinks a thought from all project memberships without clearing sourceThoughtId", () => {
    const result = unlinkThoughtFromProjectReferences(state(), "t-1");
    const project = result.state.projects.find((item) => item.id === "p-1");

    expect(result.ok).toBe(true);
    expect(result.projectId).toBe("p-1");
    expect(result.state.thoughts.find((thought) => thought.id === "t-1")?.projectId).toBeUndefined();
    expect(project?.linkedThoughtIds).not.toContain("t-1");
    expect(project?.sourceThoughtId).toBe("t-1");
  });

  it("returns the original state for missing project or thought validation failures", () => {
    const base = state();
    const missingProject = linkThoughtToProjectReference(base, "missing-project", "t-1");
    const missingThought = linkThoughtToProjectReference(base, "p-1", "missing-thought");

    expect(missingProject).toMatchObject({ ok: false, error: "Project not found." });
    expect(missingProject.state).toBe(base);
    expect(missingThought).toMatchObject({ ok: false, error: "Thought not found." });
    expect(missingThought.state).toBe(base);
  });

  it("cleans missing direct references without touching relationships", () => {
    const base = state();
    const dirty: AppState = {
      ...base,
      thoughts: base.thoughts.map((thought) =>
        thought.id === "t-2" ? { ...thought, projectId: "missing-project" } : thought
      ),
      projects: base.projects.map((project) =>
        project.id === "p-1"
          ? { ...project, sourceThoughtId: "missing-thought", linkedThoughtIds: ["t-1", "missing-thought", "t-1"] }
          : project
      )
    };

    const result = cleanupProjectThoughtReferences(dirty);
    const project = result.state.projects.find((item) => item.id === "p-1");

    expect(result.ok).toBe(true);
    expect(result.changed).toBe(true);
    expect(result.state.thoughts.find((thought) => thought.id === "t-2")?.projectId).toBeUndefined();
    expect(project?.linkedThoughtIds).toEqual(["t-1"]);
    expect(project?.sourceThoughtId).toBeUndefined();
    expect(result.state.relationships).toBe(dirty.relationships);
  });
});
