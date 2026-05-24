import { describe, expect, it } from "vitest";
import { buildRelationshipContext } from "./relationshipContext";
import type { AppState, Project, Relationship, ThoughtItem, Universe } from "./types";

const timestamp = "2026-01-01T00:00:00.000Z";

const universe = (patch: Partial<Universe> = {}): Universe => ({
  id: "u-1",
  name: "Universe One",
  description: "Primary universe",
  purpose: "Test relationship context",
  focus: "main",
  status: "active",
  ...patch
});

const thought = (patch: Partial<ThoughtItem> = {}): ThoughtItem => ({
  id: "t-1",
  title: "Thought One",
  content: "Thought content.",
  type: "note",
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
  users: [],
  features: [],
  screens: [],
  dataObjects: [],
  flowSteps: [],
  unknowns: [],
  nextAction: "Project next",
  readiness: "draftable",
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
  description: "Graph membership.",
  ...patch
});

function baseState(patch: Partial<AppState> = {}): AppState {
  return {
    universes: [universe(), universe({ id: "u-2", name: "Universe Two" })],
    thoughts: [thought()],
    projects: [project()],
    relationships: [],
    aiInsights: [],
    blockingQuestions: [
      {
        id: "bq-1",
        question: "What blocks this?",
        status: "open",
        linkedUniverseIds: ["u-1"],
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    decisionRecords: [],
    ...patch
  };
}

const codes = (state: AppState, targetId: string) =>
  buildRelationshipContext(state, targetId).findings.map((finding) => finding.code);

describe("relationship context", () => {
  it("returns direct universe context for a thought", () => {
    const context = buildRelationshipContext(baseState(), "t-1");

    expect(context.targetType).toBe("thought");
    if (context.targetType !== "thought") throw new Error("Expected thought context");
    expect(context.directMembershipRefs.universe).toMatchObject({
      id: "u-1",
      valid: true
    });
    expect(context.graphRelationships).toEqual([]);
  });

  it("returns direct universe context for a project", () => {
    const context = buildRelationshipContext(baseState(), "p-1");

    expect(context.targetType).toBe("project");
    if (context.targetType !== "project") throw new Error("Expected project context");
    expect(context.directMembershipRefs.universe).toMatchObject({
      id: "u-1",
      valid: true
    });
  });

  it("reports active direct project membership for a thought", () => {
    const state = baseState({
      thoughts: [thought({ projectId: "p-1" })],
      projects: [project({ linkedThoughtIds: ["t-1"] })],
      relationships: [relationship()]
    });
    const context = buildRelationshipContext(state, "t-1");

    expect(context.targetType).toBe("thought");
    if (context.targetType !== "thought") throw new Error("Expected thought context");
    expect(context.directMembershipRefs.project).toMatchObject({
      id: "p-1",
      valid: true,
      active: true,
      projectHasLinkedThought: true
    });
  });

  it("returns direct linkedThoughtIds membership for a project", () => {
    const state = baseState({
      thoughts: [thought({ projectId: "p-1" })],
      projects: [project({ linkedThoughtIds: ["t-1"] })],
      relationships: [relationship()]
    });
    const context = buildRelationshipContext(state, "p-1");

    expect(context.targetType).toBe("project");
    if (context.targetType !== "project") throw new Error("Expected project context");
    expect(context.directMembershipRefs.linkedThoughts).toHaveLength(1);
    expect(context.directMembershipRefs.linkedThoughts[0]).toMatchObject({
      id: "t-1",
      valid: true
    });
  });

  it("returns sourceThoughtId as provenance instead of direct membership", () => {
    const state = baseState({
      thoughts: [thought({ id: "t-source" })],
      projects: [project({ sourceThoughtId: "t-source", linkedThoughtIds: [] })]
    });
    const context = buildRelationshipContext(state, "p-1");

    expect(context.targetType).toBe("project");
    if (context.targetType !== "project") throw new Error("Expected project context");
    expect(context.provenanceRefs.sourceThought).toMatchObject({
      id: "t-source",
      valid: true
    });
    expect(context.directMembershipRefs.linkedThoughts).toEqual([]);
    expect(context.findings.map((finding) => finding.code)).toContain("source_thought_not_linked_thought");
  });

  it("keeps graph relationships and direct membership side-by-side", () => {
    const state = baseState({
      thoughts: [thought({ projectId: "p-1" })],
      projects: [project({ linkedThoughtIds: ["t-1"] })],
      relationships: [relationship({ id: "r-belongs" })]
    });
    const context = buildRelationshipContext(state, "t-1");

    expect(context.targetType).toBe("thought");
    if (context.targetType !== "thought") throw new Error("Expected thought context");
    expect(context.directMembershipRefs.project?.id).toBe("p-1");
    expect(context.graphProjectMemberships.map((item) => item.relationship.id)).toEqual(["r-belongs"]);
    expect(context.graphOnlyProjectMemberships).toEqual([]);
  });

  it("does not treat graph belongs_to universe as a replacement for direct universeId", () => {
    const state = baseState({
      thoughts: [thought({ universeId: "u-1" })],
      relationships: [
        relationship({
          id: "r-graph-universe",
          targetId: "u-2",
          targetType: "universe",
          type: "belongs_to"
        })
      ]
    });
    const context = buildRelationshipContext(state, "t-1");

    expect(context.targetType).toBe("thought");
    if (context.targetType !== "thought") throw new Error("Expected thought context");
    expect(context.directMembershipRefs.universe?.id).toBe("u-1");
    expect(context.graphRelationships.map((item) => item.relationship.id)).toEqual(["r-graph-universe"]);
    expect(context.findings.map((finding) => finding.code)).toContain("graph_universe_membership_without_direct_ref");
  });

  it("reports orphan relationship endpoints without repairing them", () => {
    const state = baseState({
      relationships: [
        relationship({
          id: "r-orphan",
          targetId: "missing-project",
          targetType: "project",
          type: "blocks"
        })
      ]
    });
    const before = JSON.stringify(state);
    const context = buildRelationshipContext(state, "t-1");

    expect(context.graphRelationships[0]).toMatchObject({
      hasOrphanEndpoint: true
    });
    expect(context.findings.map((finding) => finding.code)).toContain("orphan_relationship_endpoint");
    expect(state.relationships[0].targetId).toBe("missing-project");
    expect(JSON.stringify(state)).toBe(before);
  });

  it("reports invalid direct refs without repairing them", () => {
    const state = baseState({
      thoughts: [thought({ universeId: "missing-universe", projectId: "missing-project" })],
      projects: [
        project({
          universeId: "missing-universe",
          sourceThoughtId: "missing-source",
          linkedThoughtIds: ["missing-linked"]
        })
      ]
    });
    const before = JSON.stringify(state);

    expect(codes(state, "t-1")).toEqual(expect.arrayContaining([
      "invalid_thought_project_id",
      "invalid_thought_universe_id"
    ]));
    expect(codes(state, "p-1")).toEqual(expect.arrayContaining([
      "invalid_project_linked_thought_id",
      "invalid_project_source_thought_id",
      "invalid_project_universe_id"
    ]));
    expect(JSON.stringify(state)).toBe(before);
  });

  it("reports deterministic direct membership mismatch warnings", () => {
    const state = baseState({
      thoughts: [
        thought({ id: "t-forward-missing" }),
        thought({ id: "t-reverse-missing", projectId: "p-1" }),
        thought({ id: "t-mismatch", projectId: "p-2" })
      ],
      projects: [
        project({ linkedThoughtIds: ["t-forward-missing", "t-mismatch"] }),
        project({ id: "p-2", name: "Other Project", linkedThoughtIds: [] })
      ]
    });
    const context = buildRelationshipContext(state, "p-1");

    expect(context.findings.map((finding) => finding.code)).toEqual([
      "direct_project_membership_without_graph_edge",
      "direct_project_membership_without_graph_edge",
      "direct_project_membership_without_graph_edge",
      "project_linked_thought_mismatched_forward_link",
      "project_linked_thought_missing_forward_link",
      "thought_project_missing_reverse_link"
    ]);
  });

  it("reports graph/direct drift in both directions", () => {
    const graphOnlyState = baseState({
      relationships: [relationship({ id: "r-graph-only" })]
    });
    const directOnlyState = baseState({
      thoughts: [thought({ projectId: "p-1" })],
      projects: [project({ linkedThoughtIds: ["t-1"] })]
    });

    expect(codes(graphOnlyState, "t-1")).toContain("graph_project_membership_without_direct_membership");
    expect(codes(directOnlyState, "t-1")).toContain("direct_project_membership_without_graph_edge");
  });

  it("keeps sourceThoughtId out of linkedThoughtIds direct membership", () => {
    const state = baseState({
      thoughts: [thought({ id: "t-source" })],
      projects: [project({ sourceThoughtId: "t-source", linkedThoughtIds: [] })]
    });
    const context = buildRelationshipContext(state, "p-1");

    expect(context.targetType).toBe("project");
    if (context.targetType !== "project") throw new Error("Expected project context");
    expect(context.provenanceRefs.sourceThought?.id).toBe("t-source");
    expect(context.directMembershipRefs.linkedThoughts.map((item) => item.id)).not.toContain("t-source");
    expect(context.findings.map((finding) => finding.code)).toContain("source_thought_not_linked_thought");
  });

  it("lists blockers and dependencies from graph relationships", () => {
    const state = baseState({
      relationships: [
        relationship({
          id: "r-blocks",
          sourceId: "bq-1",
          sourceType: "blocking_question",
          targetId: "t-1",
          targetType: "thought",
          type: "blocks"
        }),
        relationship({
          id: "r-depends",
          type: "depends_on"
        })
      ]
    });
    const context = buildRelationshipContext(state, "t-1");

    expect(context.blockersAndDependencies.map((item) => item.relationship.id)).toEqual([
      "r-blocks",
      "r-depends"
    ]);
  });

  it("returns deterministic invalid target context for missing ids", () => {
    const context = buildRelationshipContext(baseState(), "missing-target");

    expect(context).toMatchObject({
      targetId: "missing-target",
      targetType: "missing",
      graphRelationships: [],
      blockersAndDependencies: []
    });
    expect(context.findings).toHaveLength(1);
    expect(context.findings[0]).toMatchObject({
      code: "target_missing",
      severity: "error"
    });
  });

  it("does not mutate input state", () => {
    const state = baseState({
      thoughts: [thought({ universeId: "missing-universe", projectId: "p-1" })],
      projects: [project({ linkedThoughtIds: [] })],
      relationships: [
        relationship({
          id: "r-orphan",
          sourceType: undefined,
          targetId: "missing-project",
          targetType: "project"
        })
      ]
    });
    const before = JSON.stringify(state);

    buildRelationshipContext(state, "t-1");

    expect(JSON.stringify(state)).toBe(before);
  });
});
