import { describe, expect, it } from "vitest";
import {
  createTypedRelationship,
  listOrphanRelationships,
  relationshipTargetsNode,
  repairRelationshipEndpointTypes,
  removeRelationshipsForNode,
  resolveRelationshipEndpoint
} from "./relationshipGraph";
import type { AppState, Project, ThoughtItem } from "../types";

const timestamp = "2026-01-01T00:00:00.000Z";

const thought = (patch: Partial<ThoughtItem> = {}): ThoughtItem => ({
  id: "t-alpha",
  title: "Alpha thought",
  content: "Relationship graph thought.",
  type: "note",
  status: "active",
  universeId: "u-alpha",
  why: "Test",
  outcome: "Typed endpoints",
  nextAction: "Link it",
  createdAt: timestamp,
  updatedAt: timestamp,
  ...patch
});

const project = (patch: Partial<Project> = {}): Project => ({
  id: "p-alpha",
  universeId: "u-alpha",
  status: "active",
  name: "Alpha project",
  intent: "Relationship graph project.",
  users: ["Tester"],
  features: ["Relationship Graph"],
  screens: ["Relationship Explorer"],
  dataObjects: ["Relationship"],
  flowSteps: ["Create relationship"],
  unknowns: [],
  nextAction: "Verify relationships",
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
        purpose: "Test graph helpers",
        focus: "main"
      }
    ],
    thoughts: [thought()],
    projects: [project()],
    relationships: [],
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
        decision: "Keep endpoints typed.",
        status: "accepted",
        linkedUniverseIds: ["u-alpha"],
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    ...patch
  };
}

describe("relationship graph", () => {
  it("repairs legacy relationship endpoint types when endpoints can be resolved", () => {
    const state = baseState({
      relationships: [
        {
          id: "r-legacy",
          sourceId: "t-alpha",
          targetId: "p-alpha",
          type: "supports",
          description: "Legacy support relationship."
        }
      ]
    });
    const original = JSON.stringify(state);
    const result = repairRelationshipEndpointTypes(state);

    expect(result.repairedRelationshipIds).toEqual(["r-legacy"]);
    expect(result.warnings).toEqual([]);
    expect(result.state.relationships[0]).toMatchObject({
      sourceType: "thought",
      targetType: "project"
    });
    expect(JSON.stringify(state)).toBe(original);
  });

  it("reports orphan relationships without deleting them", () => {
    const state = baseState({
      relationships: [
        {
          id: "r-orphan",
          sourceId: "missing-source",
          targetId: "p-alpha",
          targetType: "project",
          type: "blocks",
          description: "Missing source blocks project."
        }
      ]
    });
    const result = repairRelationshipEndpointTypes(state);

    expect(result.orphanRelationshipIds).toEqual(["r-orphan"]);
    expect(result.warnings[0]).toMatchObject({
      relationshipId: "r-orphan",
      endpoint: "source",
      status: "missing"
    });
    expect(listOrphanRelationships(state).map((relationship) => relationship.id)).toEqual(["r-orphan"]);
    expect(result.state.relationships).toHaveLength(1);
  });

  it("creates new relationships with typed endpoints", () => {
    const result = createTypedRelationship(baseState(), {
      sourceType: "blocking_question",
      sourceId: "bq-alpha",
      type: "blocks",
      targetType: "project",
      targetId: "p-alpha",
      description: "Question blocks project"
    });

    expect(result.ok).toBe(true);
    expect(result.state.relationships[0]).toMatchObject({
      sourceType: "blocking_question",
      targetType: "project",
      type: "blocks"
    });
    expect(relationshipTargetsNode(result.state.relationships[0], { id: "p-alpha", type: "project" })).toBe(true);
  });

  it("rejects duplicate typed relationships including repairable legacy duplicates", () => {
    const state = baseState({
      relationships: [
        {
          id: "r-support",
          sourceId: "t-alpha",
          targetId: "p-alpha",
          type: "supports",
          description: "Legacy support relationship."
        }
      ]
    });
    const result = createTypedRelationship(state, {
      sourceType: "thought",
      sourceId: "t-alpha",
      type: "supports",
      targetType: "project",
      targetId: "p-alpha"
    });

    expect(result).toMatchObject({ ok: false, error: "Relationship already exists." });
  });

  it("removes relationships by typed node while preserving same-id different typed endpoints", () => {
    const state = baseState({
      thoughts: [thought(), thought({ id: "shared-id", title: "Shared thought" })],
      projects: [project(), project({ id: "shared-id", name: "Shared project" })],
      relationships: [
        {
          id: "r-remove",
          sourceId: "t-alpha",
          sourceType: "thought",
          targetId: "shared-id",
          targetType: "project",
          type: "supports",
          description: "Touches the project."
        },
        {
          id: "r-keep",
          sourceId: "t-alpha",
          sourceType: "thought",
          targetId: "shared-id",
          targetType: "thought",
          type: "related_to",
          description: "Touches the thought."
        }
      ]
    });
    const result = removeRelationshipsForNode(state, { id: "shared-id", type: "project" });

    expect(result.removedRelationships.map((relationship) => relationship.id)).toEqual(["r-remove"]);
    expect(result.state.relationships.map((relationship) => relationship.id)).toEqual(["r-keep"]);
  });

  it("marks untyped same-id endpoints as ambiguous instead of guessing for repair", () => {
    const state = baseState({
      thoughts: [thought({ id: "shared-id" })],
      projects: [project({ id: "shared-id" })]
    });

    expect(resolveRelationshipEndpoint(state, "shared-id").status).toBe("ambiguous");
  });
});
