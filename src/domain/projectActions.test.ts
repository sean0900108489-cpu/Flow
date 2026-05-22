import { describe, expect, it } from "vitest";
import { seed } from "../data/seed";
import type { AppState, Project } from "./types";
import {
  createProject,
  linkThoughtToProject,
  promoteThoughtToProject,
  unlinkThoughtFromProject,
  updateProjectDetails
} from "./projectActions";

function state(): AppState {
  return structuredClone(seed);
}

function stateWithProjectPatch(patch: Partial<Project>): AppState {
  const base = state();

  return {
    ...base,
    projects: base.projects.map((project) =>
      project.id === "p-1" ? { ...project, ...patch } : project
    )
  };
}

function stateWithSecondProject(): AppState {
  const base = state();
  const sourceProject = base.projects.find((project) => project.id === "p-1");

  if (!sourceProject) return base;

  const { sourceThoughtId: _sourceThoughtId, ...projectWithoutSourceThought } = sourceProject;

  return {
    ...base,
    projects: [
      ...base.projects,
      {
        ...projectWithoutSourceThought,
        id: "p-2",
        name: "Second project",
        intent: "A second project for move behavior tests.",
        linkedThoughtIds: []
      }
    ]
  };
}

describe("project actions", () => {
  it("createProject creates an active project", () => {
    const result = createProject(state(), {
      title: "New project",
      description: "A project created from the domain service.",
      universeId: "u-thought",
      nextAction: "Define scope"
    });

    expect(result.ok).toBe(true);
    expect(result.projectId).toBeDefined();
    expect(result.state.projects[0]).toMatchObject({
      name: "New project",
      intent: "A project created from the domain service.",
      universeId: "u-thought",
      status: "active",
      lifecycleStatus: "planning",
      nextAction: "Define scope"
    });
  });

  it("createProject rejects an empty title", () => {
    const base = state();
    const result = createProject(base, { title: "   " });

    expect(result.ok).toBe(false);
    expect(result.state).toBe(base);
    expect(result.error).toContain("title");
  });

  it("updateProjectDetails updates title description and next action", () => {
    const result = updateProjectDetails(state(), "p-1", {
      title: "Updated project",
      description: "Updated description",
      nextAction: "Updated next action"
    });

    expect(result.ok).toBe(true);
    expect(result.state.projects.find((project) => project.id === "p-1")).toMatchObject({
      name: "Updated project",
      intent: "Updated description",
      nextAction: "Updated next action"
    });
  });

  it("updateProjectDetails rejects direct handoff_ready transitions for archived projects", () => {
    const base = stateWithProjectPatch({
      status: "archived",
      lifecycleStatus: "planning",
      readiness: "ready_for_engineering"
    });
    const result = updateProjectDetails(base, "p-1", { lifecycleStatus: "handoff_ready" });

    expect(result.ok).toBe(false);
    expect(result.state).toBe(base);
    expect(result.error).toContain("guarded handoff");
  });

  it("updateProjectDetails rejects direct handoff_ready transitions for blocked projects", () => {
    const base = stateWithProjectPatch({
      lifecycleStatus: "blocked",
      readiness: "ready_for_engineering"
    });
    const result = updateProjectDetails(base, "p-1", { lifecycleStatus: "handoff_ready" });

    expect(result.ok).toBe(false);
    expect(result.state).toBe(base);
    expect(result.error).toContain("guarded handoff");
  });

  it("updateProjectDetails rejects direct handoff_ready transitions for not-ready projects", () => {
    const base = stateWithProjectPatch({
      lifecycleStatus: "planning",
      readiness: "not_ready",
      nextAction: ""
    });
    const result = updateProjectDetails(base, "p-1", { lifecycleStatus: "handoff_ready" });

    expect(result.ok).toBe(false);
    expect(result.state).toBe(base);
    expect(result.error).toContain("guarded handoff");
  });

  it("updateProjectDetails allows leaving handoff_ready for another legal lifecycle status", () => {
    const base = stateWithProjectPatch({
      lifecycleStatus: "handoff_ready",
      readiness: "ready_for_engineering"
    });
    const result = updateProjectDetails(base, "p-1", { lifecycleStatus: "planning" });

    expect(result.ok).toBe(true);
    expect(result.state.projects.find((project) => project.id === "p-1")?.lifecycleStatus).toBe("planning");
  });

  it("updateProjectDetails can save other fields when an already handoff_ready project remains handoff_ready", () => {
    const base = stateWithProjectPatch({
      lifecycleStatus: "handoff_ready",
      readiness: "ready_for_engineering"
    });
    const result = updateProjectDetails(base, "p-1", {
      lifecycleStatus: "handoff_ready",
      title: "Still handoff ready"
    });

    expect(result.ok).toBe(true);
    expect(result.state.projects.find((project) => project.id === "p-1")).toMatchObject({
      lifecycleStatus: "handoff_ready",
      name: "Still handoff ready"
    });
  });

  it("linkThoughtToProject adds linkedThoughtIds", () => {
    const result = linkThoughtToProject(state(), "p-1", "t-2");
    const linkedThoughtIds = result.state.projects.find((project) => project.id === "p-1")?.linkedThoughtIds ?? [];

    expect(result.ok).toBe(true);
    expect(linkedThoughtIds).toContain("t-2");
    expect(linkedThoughtIds.filter((id) => id === "t-2")).toHaveLength(1);
    expect(result.state.thoughts.find((thought) => thought.id === "t-2")?.projectId).toBe("p-1");
  });

  it("linkThoughtToProject does not add duplicates", () => {
    const once = linkThoughtToProject(state(), "p-1", "t-2");
    const twice = linkThoughtToProject(once.state, "p-1", "t-2");
    const linkedThoughtIds = twice.state.projects.find((project) => project.id === "p-1")?.linkedThoughtIds ?? [];

    expect(twice.ok).toBe(true);
    expect(linkedThoughtIds.filter((id) => id === "t-2")).toHaveLength(1);
  });

  it("unlinkThoughtFromProject does not delete the thought", () => {
    const linked = linkThoughtToProject(state(), "p-1", "t-2");
    const result = unlinkThoughtFromProject(linked.state, "p-1", "t-2");
    const thought = result.state.thoughts.find((item) => item.id === "t-2");

    expect(result.ok).toBe(true);
    expect(thought).toBeDefined();
    expect(thought?.projectId).toBeUndefined();
    expect(result.state.projects.find((project) => project.id === "p-1")?.linkedThoughtIds ?? []).not.toContain("t-2");
  });

  it("linkThoughtToProject moves a thought from one project to another without stale links", () => {
    const linkedToFirst = linkThoughtToProject(stateWithSecondProject(), "p-1", "t-2");
    const movedToSecond = linkThoughtToProject(linkedToFirst.state, "p-2", "t-2");
    const thought = movedToSecond.state.thoughts.find((item) => item.id === "t-2");
    const firstProjectLinkedThoughtIds =
      movedToSecond.state.projects.find((project) => project.id === "p-1")?.linkedThoughtIds ?? [];
    const secondProjectLinkedThoughtIds =
      movedToSecond.state.projects.find((project) => project.id === "p-2")?.linkedThoughtIds ?? [];

    expect(movedToSecond.ok).toBe(true);
    expect(thought?.projectId).toBe("p-2");
    expect(firstProjectLinkedThoughtIds).not.toContain("t-2");
    expect(secondProjectLinkedThoughtIds).toContain("t-2");
    expect(secondProjectLinkedThoughtIds.filter((id) => id === "t-2")).toHaveLength(1);
  });

  it("updateProjectDetails clears removed linked thoughts from the project reference", () => {
    const base = state();
    const linkedBase: AppState = {
      ...base,
      projects: base.projects.map((project) =>
        project.id === "p-1"
          ? { ...project, linkedThoughtIds: ["t-1", "t-2"] }
          : project
      ),
      thoughts: base.thoughts.map((thought) =>
        thought.id === "t-2"
          ? { ...thought, projectId: "p-1" }
          : thought
      )
    };

    const result = updateProjectDetails(linkedBase, "p-1", { linkedThoughtIds: ["t-1"] });
    const projectLinkedThoughtIds =
      result.state.projects.find((project) => project.id === "p-1")?.linkedThoughtIds ?? [];

    expect(result.ok).toBe(true);
    expect(projectLinkedThoughtIds).not.toContain("t-2");
    expect(result.state.thoughts.find((thought) => thought.id === "t-2")?.projectId).toBeUndefined();
  });

  it("updateProjectDetails moves linked thoughts from previous projects without stale links", () => {
    const base = stateWithSecondProject();
    const linkedBase: AppState = {
      ...base,
      projects: base.projects.map((project) =>
        project.id === "p-2"
          ? { ...project, linkedThoughtIds: ["t-2"] }
          : project
      ),
      thoughts: base.thoughts.map((thought) =>
        thought.id === "t-2"
          ? { ...thought, projectId: "p-2" }
          : thought
      )
    };

    const result = updateProjectDetails(linkedBase, "p-1", { linkedThoughtIds: ["t-1", "t-2"] });
    const firstProjectLinkedThoughtIds =
      result.state.projects.find((project) => project.id === "p-1")?.linkedThoughtIds ?? [];
    const secondProjectLinkedThoughtIds =
      result.state.projects.find((project) => project.id === "p-2")?.linkedThoughtIds ?? [];

    expect(result.ok).toBe(true);
    expect(result.state.thoughts.find((thought) => thought.id === "t-2")?.projectId).toBe("p-1");
    expect(firstProjectLinkedThoughtIds.filter((id) => id === "t-2")).toHaveLength(1);
    expect(secondProjectLinkedThoughtIds).not.toContain("t-2");
  });

  it("updateProjectDetails preserves a thought already moved to another project when removing stale links", () => {
    const base = stateWithSecondProject();
    const linkedBase: AppState = {
      ...base,
      projects: base.projects.map((project) => {
        if (project.id === "p-1") return { ...project, linkedThoughtIds: ["t-1", "t-2"] };
        if (project.id === "p-2") return { ...project, linkedThoughtIds: ["t-2"] };
        return project;
      }),
      thoughts: base.thoughts.map((thought) =>
        thought.id === "t-2"
          ? { ...thought, projectId: "p-2" }
          : thought
      )
    };

    const result = updateProjectDetails(linkedBase, "p-1", { linkedThoughtIds: ["t-1"] });
    const firstProjectLinkedThoughtIds =
      result.state.projects.find((project) => project.id === "p-1")?.linkedThoughtIds ?? [];
    const secondProjectLinkedThoughtIds =
      result.state.projects.find((project) => project.id === "p-2")?.linkedThoughtIds ?? [];

    expect(result.ok).toBe(true);
    expect(firstProjectLinkedThoughtIds).not.toContain("t-2");
    expect(secondProjectLinkedThoughtIds).toContain("t-2");
    expect(result.state.thoughts.find((thought) => thought.id === "t-2")?.projectId).toBe("p-2");
  });

  it("promoteThoughtToProject creates a project and links the source thought", () => {
    const result = promoteThoughtToProject(state(), "t-2");
    const project = result.state.projects.find((item) => item.id === result.projectId);
    const thought = result.state.thoughts.find((item) => item.id === "t-2");

    expect(result.ok).toBe(true);
    expect(project?.name).toBe("AI 幫我建議分類與下一步");
    expect(project?.sourceThoughtId).toBe("t-2");
    expect(project?.linkedThoughtIds).toEqual(["t-2"]);
    expect(thought?.projectId).toBe(result.projectId);
    expect(thought?.type).toBe("project");
    expect(result.state.relationships[0]).toMatchObject({
      sourceId: "t-2",
      sourceType: "thought",
      targetId: result.projectId,
      targetType: "project",
      type: "evolves_into"
    });
  });

  it("promoteThoughtToProject carries universe and next action from the thought", () => {
    const result = promoteThoughtToProject(state(), "t-2");
    const project = result.state.projects.find((item) => item.id === result.projectId);

    expect(project?.universeId).toBe("u-ai");
    expect(project?.nextAction).toBe("先做 mock AI。");
  });

  it("promoteThoughtToProject does not mutate the original state", () => {
    const base = state();
    const originalProjectCount = base.projects.length;
    const originalThought = base.thoughts.find((thought) => thought.id === "t-2");

    promoteThoughtToProject(base, "t-2");

    expect(base.projects).toHaveLength(originalProjectCount);
    expect(base.thoughts.find((thought) => thought.id === "t-2")).toEqual(originalThought);
  });

  it("missing thought or project returns an error without crashing", () => {
    const base = state();
    const missingThought = promoteThoughtToProject(base, "missing-thought");
    const missingProject = linkThoughtToProject(base, "missing-project", "t-1");

    expect(missingThought.ok).toBe(false);
    expect(missingThought.error).toContain("Thought");
    expect(missingProject.ok).toBe(false);
    expect(missingProject.error).toContain("Project");
  });
});
