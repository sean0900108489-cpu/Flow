import { describe, expect, it } from "vitest";
import {
  createRelationshipSafe,
  getRelationshipImpact,
  listOrphanItems,
  listRelationshipEdges,
  listRelationshipNodes
} from "./relationshipExplorer";
import type { AppState, Project, ThoughtItem } from "./types";

const timestamp = "2026-01-01T00:00:00.000Z";

const thought = (patch: Partial<ThoughtItem> = {}): ThoughtItem => ({
  id: "t-alpha",
  title: "Alpha thought",
  content: "A thought for relationship explorer tests.",
  type: "note",
  status: "active",
  universeId: "u-alpha",
  why: "Test relationships",
  outcome: "Relationship explorer works",
  nextAction: "Create a relationship",
  createdAt: timestamp,
  updatedAt: timestamp,
  ...patch
});

const project = (patch: Partial<Project> = {}): Project => ({
  id: "p-alpha",
  universeId: "u-alpha",
  status: "active",
  name: "Alpha project",
  intent: "A project for relationship explorer tests.",
  users: ["Tester"],
  features: ["Relationship Explorer"],
  screens: ["Relationship Explorer"],
  dataObjects: ["Relationship"],
  flowSteps: ["Create relationship", "Inspect impact"],
  unknowns: [],
  nextAction: "Inspect impact map",
  readiness: "draftable",
  createdAt: timestamp,
  updatedAt: timestamp,
  ...patch
});

function baseState(patch: Partial<AppState> = {}): AppState {
  return {
    universes: [
      {
        id: "u-alpha",
        name: "Alpha Universe",
        description: "Primary universe",
        purpose: "Test filtering",
        focus: "main"
      },
      {
        id: "u-beta",
        name: "Beta Universe",
        description: "Secondary universe",
        purpose: "Test unrelated filters",
        focus: "secondary"
      }
    ],
    thoughts: [
      thought(),
      thought({ id: "t-orphan", title: "Orphan thought" })
    ],
    projects: [
      project(),
      project({ id: "p-orphan", name: "Orphan project", universeId: "u-beta" })
    ],
    relationships: [
      {
        id: "r-support",
        sourceId: "t-alpha",
        targetId: "p-alpha",
        type: "supports",
        description: "Alpha thought supports Alpha project"
      }
    ],
    aiInsights: [],
    blockingQuestions: [
      {
        id: "bq-alpha",
        question: "What blocks Alpha?",
        status: "open",
        linkedUniverseIds: ["u-alpha"],
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    decisionRecords: [
      {
        id: "decision-alpha",
        title: "Alpha decision",
        decision: "Keep relationships inspectable.",
        status: "accepted",
        linkedUniverseIds: ["u-alpha"],
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    ...patch
  };
}

describe("relationship explorer", () => {
  it("lists relationship nodes for thoughts, projects, and universes", () => {
    const nodes = listRelationshipNodes(baseState());

    expect(nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "t-alpha", type: "thought", title: "Alpha thought" }),
      expect.objectContaining({ id: "p-alpha", type: "project", title: "Alpha project" }),
      expect.objectContaining({ id: "u-alpha", type: "universe", title: "Alpha Universe" })
    ]));
  });

  it("does not crash without blockingQuestions or decisionRecords", () => {
    const state = baseState({ blockingQuestions: undefined, decisionRecords: undefined });

    expect(listRelationshipNodes(state).map((node) => node.id)).toContain("t-alpha");
  });

  it("resolves relationship source and target titles", () => {
    const edges = listRelationshipEdges(baseState());

    expect(edges[0]).toMatchObject({
      source: { title: "Alpha thought" },
      target: { title: "Alpha project" }
    });
  });

  it("keeps missing nodes visible without crashing", () => {
    const state = baseState({
      relationships: [
        {
          id: "r-missing",
          sourceId: "missing-source",
          targetId: "p-alpha",
          type: "blocks",
          description: "Missing source blocks project"
        }
      ]
    });

    expect(listRelationshipEdges(state)[0].source).toMatchObject({
      title: "Missing node",
      status: "missing"
    });
  });

  it("searches relationships case-insensitively", () => {
    const edges = listRelationshipEdges(baseState(), { searchText: "ALPHA THOUGHT" });

    expect(edges).toHaveLength(1);
    expect(edges[0].id).toBe("r-support");
  });

  it("filters by relationship type", () => {
    const state = baseState({
      relationships: [
        ...baseState().relationships,
        {
          id: "r-block",
          sourceId: "bq-alpha",
          sourceType: "blocking_question",
          targetId: "p-alpha",
          targetType: "project",
          type: "blocks",
          description: "Question blocks project"
        }
      ]
    });

    expect(listRelationshipEdges(state, { type: "blocks" }).map((edge) => edge.id)).toEqual(["r-block"]);
  });

  it("filters by universe", () => {
    const state = baseState({
      relationships: [
        ...baseState().relationships,
        {
          id: "r-beta",
          sourceId: "u-beta",
          sourceType: "universe",
          targetId: "p-orphan",
          targetType: "project",
          type: "related_to",
          description: "Beta universe related to orphan project"
        }
      ]
    });

    expect(listRelationshipEdges(state, { universeId: "u-alpha" }).map((edge) => edge.id)).toEqual(["r-support"]);
    expect(listRelationshipEdges(state, { universeId: "u-beta" }).map((edge) => edge.id)).toEqual(["r-beta"]);
  });

  it("returns incoming and outgoing impact for a selected node", () => {
    const state = baseState({
      relationships: [
        ...baseState().relationships,
        {
          id: "r-depends",
          sourceId: "p-alpha",
          targetId: "decision-alpha",
          sourceType: "project",
          targetType: "decision_record",
          type: "depends_on",
          description: "Project depends on accepted decision"
        }
      ]
    });

    const result = getRelationshipImpact(state, "p-alpha", "project");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.incoming.map((edge) => edge.id)).toContain("r-support");
    expect(result.summary.outgoing.map((edge) => edge.id)).toContain("r-depends");
  });

  it("classifies blocks relationships in the correct direction", () => {
    const state = baseState({
      relationships: [
        {
          id: "r-block",
          sourceId: "t-alpha",
          sourceType: "thought",
          targetId: "p-alpha",
          targetType: "project",
          type: "blocks",
          description: "Thought blocks project"
        }
      ]
    });

    const projectImpact = getRelationshipImpact(state, "p-alpha", "project");
    const thoughtImpact = getRelationshipImpact(state, "t-alpha", "thought");

    expect(projectImpact.ok && projectImpact.summary.blockers[0].id).toBe("r-block");
    expect(thoughtImpact.ok && thoughtImpact.summary.blocks[0].id).toBe("r-block");
  });

  it("lists non-archived thoughts and projects without relationships as orphans", () => {
    const orphans = listOrphanItems(baseState());

    expect(orphans.thoughts.map((item) => item.title)).toContain("Orphan thought");
    expect(orphans.projects.map((item) => item.name)).toContain("Orphan project");
  });

  it("creates a relationship safely", () => {
    const result = createRelationshipSafe(baseState(), {
      sourceType: "thought",
      sourceId: "t-orphan",
      type: "related_to",
      targetType: "project",
      targetId: "p-orphan",
      description: "Orphan thought relates to orphan project"
    });

    expect(result.ok).toBe(true);
    expect(result.state.relationships[0]).toMatchObject({
      sourceType: "thought",
      targetType: "project",
      type: "related_to"
    });
  });

  it("rejects missing source and target", () => {
    const missingSource = createRelationshipSafe(baseState(), {
      sourceType: "thought",
      sourceId: "missing",
      type: "supports",
      targetType: "project",
      targetId: "p-alpha"
    });
    const missingTarget = createRelationshipSafe(baseState(), {
      sourceType: "thought",
      sourceId: "t-alpha",
      type: "supports",
      targetType: "project",
      targetId: "missing"
    });

    expect(missingSource).toMatchObject({ ok: false, error: "Source node not found." });
    expect(missingTarget).toMatchObject({ ok: false, error: "Target node not found." });
  });

  it("rejects duplicate relationships", () => {
    const result = createRelationshipSafe(baseState(), {
      sourceType: "thought",
      sourceId: "t-alpha",
      type: "supports",
      targetType: "project",
      targetId: "p-alpha"
    });

    expect(result).toMatchObject({ ok: false, error: "Relationship already exists." });
  });

  it("does not mutate original state", () => {
    const state = baseState();
    const original = JSON.stringify(state);

    listRelationshipNodes(state);
    listRelationshipEdges(state, { searchText: "alpha" });
    getRelationshipImpact(state, "p-alpha", "project");
    listOrphanItems(state);
    createRelationshipSafe(state, {
      sourceType: "thought",
      sourceId: "t-orphan",
      type: "related_to",
      targetType: "project",
      targetId: "p-orphan"
    });

    expect(JSON.stringify(state)).toBe(original);
  });
});
