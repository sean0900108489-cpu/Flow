import { describe, expect, it } from "vitest";
import { buildProjectClusters } from "./projectClusters";
import type { AppState, Project, Relationship, ThoughtItem, Universe } from "../types";

const timestamp = "2026-01-01T00:00:00.000Z";

const universe = (patch: Partial<Universe> = {}): Universe => ({
  id: "u-1",
  name: "Universe One",
  description: "Primary universe",
  purpose: "Cluster tests",
  focus: "main",
  status: "active",
  ...patch
});

const thought = (patch: Partial<ThoughtItem> = {}): ThoughtItem => ({
  id: "t-1",
  title: "Thought One",
  content: "Thought content.",
  type: "task",
  status: "active",
  universeId: "u-1",
  why: "Why",
  outcome: "Outcome",
  nextAction: "Next",
  createdAt: timestamp,
  updatedAt: timestamp,
  ...patch
});

const project = (patch: Partial<Project> = {}): Project => ({
  id: "p-1",
  universeId: "u-1",
  status: "active",
  lifecycleStatus: "planning",
  name: "Project One",
  intent: "Project intent.",
  users: ["user"],
  features: ["feature"],
  screens: ["screen"],
  dataObjects: ["data"],
  flowSteps: ["flow"],
  unknowns: [],
  nextAction: "Next project step.",
  readiness: "ready_for_engineering",
  createdAt: timestamp,
  updatedAt: timestamp,
  ...patch
});

const relationship = (patch: Partial<Relationship> = {}): Relationship => ({
  id: "r-1",
  sourceId: "t-1",
  sourceType: "thought",
  targetId: "p-1",
  targetType: "project",
  type: "belongs_to",
  description: "Graph edge.",
  ...patch
});

function baseState(patch: Partial<AppState> = {}): AppState {
  return {
    universes: [universe()],
    thoughts: [thought()],
    projects: [project()],
    relationships: [],
    aiInsights: [],
    blockingQuestions: [],
    decisionRecords: [],
    ...patch
  };
}

describe("buildProjectClusters", () => {
  it("keeps direct project membership separate from graph-only belongs_to", () => {
    const state = baseState({
      thoughts: [
        thought({ id: "t-direct", projectId: "p-1" }),
        thought({ id: "t-graph" })
      ],
      projects: [project({ linkedThoughtIds: ["t-direct"] })],
      relationships: [
        relationship({ id: "r-direct", sourceId: "t-direct" }),
        relationship({ id: "r-graph", sourceId: "t-graph" })
      ]
    });

    const clusters = buildProjectClusters(state);
    const direct = clusters.find((cluster) => cluster.kind === "existing_project" && cluster.primaryProjectId === "p-1");
    const graph = clusters.find((cluster) => cluster.kind === "relationship_cluster" && cluster.relationshipIds.includes("r-graph"));

    expect(direct?.thoughtIds).toEqual(["t-direct"]);
    expect(direct?.relationshipIds).toEqual([]);
    expect(graph?.thoughtIds).toContain("t-graph");
    expect(graph?.projectIds).toContain("p-1");
  });

  it("explains graph connected components without creating direct links", () => {
    const state = baseState({
      thoughts: [thought({ id: "t-graph" })],
      projects: [project({ linkedThoughtIds: [] })],
      relationships: [relationship({ id: "r-graph-only", sourceId: "t-graph" })]
    });

    const before = JSON.parse(JSON.stringify(state));
    const clusters = buildProjectClusters(state);
    const direct = clusters.find((cluster) => cluster.kind === "existing_project" && cluster.primaryProjectId === "p-1");
    const graph = clusters.find((cluster) => cluster.kind === "relationship_cluster");

    expect(direct?.thoughtIds).toEqual([]);
    expect(graph).toMatchObject({
      thoughtIds: ["t-graph"],
      projectIds: ["p-1"],
      relationshipIds: ["r-graph-only"],
      suggestedCommands: []
    });
    expect(state).toEqual(before);
  });

  it("keeps sourceThoughtId as provenance evidence only", () => {
    const state = baseState({
      thoughts: [thought({ id: "t-source" })],
      projects: [project({ sourceThoughtId: "t-source", linkedThoughtIds: [] })]
    });

    const cluster = buildProjectClusters(state)
      .find((item) => item.kind === "existing_project" && item.primaryProjectId === "p-1");

    expect(cluster?.thoughtIds).not.toContain("t-source");
    expect(cluster?.evidence).toContainEqual(expect.objectContaining({
      source: "Project.sourceThoughtId",
      role: "provenance",
      thoughtId: "t-source"
    }));
  });

  it("forms project_candidate_cluster from project-like thoughts", () => {
    const state = baseState({
      thoughts: [
        thought({
          id: "t-candidate",
          title: "Launch candidate",
          type: "project",
          projectId: undefined
        })
      ],
      projects: [],
      relationships: []
    });

    const cluster = buildProjectClusters(state)
      .find((item) => item.kind === "project_candidate_cluster");

    expect(cluster).toMatchObject({
      thoughtIds: ["t-candidate"],
      projectIds: [],
      reasons: ["thought_progression:promotion_candidate"]
    });
    expect(cluster?.suggestedCommands.map((command) => command.commandType)).toContain("promote_thought_to_project");
  });

  it("creates warning cluster for orphan relationships", () => {
    const state = baseState({
      relationships: [
        relationship({
          id: "r-orphan",
          targetId: "missing-project",
          targetType: "project"
        })
      ]
    });

    const cluster = buildProjectClusters(state)
      .find((item) => item.kind === "orphan_or_warning_cluster" && item.relationshipIds.includes("r-orphan"));

    expect(cluster?.warnings.map((warning) => warning.code)).toContain("orphan_relationship");
    expect(cluster?.confidence).toBe("low");
  });

  it("does not mutate AppState or persist clusters", () => {
    const state = baseState({
      thoughts: [thought({ id: "t-candidate", type: "project" })],
      relationships: [
        relationship({
          id: "r-orphan",
          targetId: "missing-project",
          targetType: "project"
        })
      ]
    });
    const before = JSON.parse(JSON.stringify(state));

    buildProjectClusters(state);

    expect(state).toEqual(before);
    expect(state).not.toHaveProperty("projectClusters");
  });
});
