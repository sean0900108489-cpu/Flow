import { describe, expect, it } from "vitest";
import { buildDomainIndex, domainNodeResolutionPriority } from "./domainIndex";
import type { AppState, Project, ThoughtItem } from "./types";

const timestamp = "2026-01-01T00:00:00.000Z";

const thought = (patch: Partial<ThoughtItem> = {}): ThoughtItem => ({
  id: "t-index",
  title: "Index thought",
  content: "Thought content",
  type: "task",
  status: "active",
  universeId: "u-index",
  why: "Use one resolver",
  outcome: "Deterministic lookup",
  nextAction: "Build DomainIndex",
  createdAt: timestamp,
  updatedAt: timestamp,
  ...patch
});

const project = (patch: Partial<Project> = {}): Project => ({
  id: "p-index",
  universeId: "u-index",
  status: "active",
  lifecycleStatus: "planning",
  name: "Index project",
  intent: "Create a read-only domain lookup.",
  users: ["Builder"],
  features: ["DomainIndex"],
  screens: ["Project detail"],
  dataObjects: ["AppState"],
  flowSteps: ["Lookup", "Resolve"],
  unknowns: [],
  nextAction: "Write tests",
  readiness: "draftable",
  createdAt: timestamp,
  updatedAt: timestamp,
  ...patch
});

function baseState(patch: Partial<AppState> = {}): AppState {
  return {
    universes: [
      {
        id: "u-index",
        name: "Index Universe",
        description: "Universe for DomainIndex tests.",
        purpose: "Exercise lookup.",
        focus: "main"
      }
    ],
    thoughts: [thought()],
    projects: [project()],
    relationships: [
      {
        id: "r-index",
        sourceId: "t-index",
        sourceType: "thought",
        targetId: "p-index",
        targetType: "project",
        type: "supports",
        description: "Thought supports project."
      }
    ],
    aiInsights: [
      {
        id: "ai-index",
        targetId: "t-index",
        type: "classification",
        content: "Classify this thought.",
        status: "draft",
        createdAt: timestamp
      }
    ],
    blockingQuestions: [
      {
        id: "bq-index",
        question: "What should DomainIndex resolve?",
        status: "open",
        linkedProjectIds: ["p-index"],
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    decisionRecords: [
      {
        id: "decision-index",
        title: "Resolution priority",
        decision: "Use deterministic priority.",
        status: "accepted",
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    ...patch
  };
}

describe("DomainIndex", () => {
  it("builds all byId lookups", () => {
    const index = buildDomainIndex(baseState());

    expect(index.universeById["u-index"]).toMatchObject({ name: "Index Universe" });
    expect(index.thoughtById["t-index"]).toMatchObject({ title: "Index thought" });
    expect(index.projectById["p-index"]).toMatchObject({ name: "Index project" });
    expect(index.relationshipById["r-index"]).toMatchObject({ type: "supports" });
    expect(index.aiInsightById["ai-index"]).toMatchObject({ status: "draft" });
    expect(index.blockingQuestionById["bq-index"]).toMatchObject({ status: "open" });
    expect(index.decisionRecordById["decision-index"]).toMatchObject({ status: "accepted" });
  });

  it("resolves every supported node type", () => {
    const index = buildDomainIndex(baseState());

    expect(index.resolveNode("t-index")).toMatchObject({ type: "thought" });
    expect(index.resolveNode("p-index")).toMatchObject({ type: "project" });
    expect(index.resolveNode("u-index")).toMatchObject({ type: "universe" });
    expect(index.resolveNode("r-index")).toMatchObject({ type: "relationship" });
    expect(index.resolveNode("ai-index")).toMatchObject({ type: "aiInsight" });
    expect(index.resolveNode("bq-index")).toMatchObject({ type: "blockingQuestion" });
    expect(index.resolveNode("decision-index")).toMatchObject({ type: "decisionRecord" });
  });

  it("infers supported node types by id", () => {
    const index = buildDomainIndex(baseState());

    expect(index.inferNodeTypeById("t-index")).toBe("thought");
    expect(index.inferNodeTypeById("p-index")).toBe("project");
    expect(index.inferNodeTypeById("u-index")).toBe("universe");
    expect(index.inferNodeTypeById("r-index")).toBe("relationship");
    expect(index.inferNodeTypeById("ai-index")).toBe("aiInsight");
    expect(index.inferNodeTypeById("bq-index")).toBe("blockingQuestion");
    expect(index.inferNodeTypeById("decision-index")).toBe("decisionRecord");
  });

  it("returns undefined for missing ids", () => {
    const index = buildDomainIndex(baseState());

    expect(index.resolveNode("missing-id")).toBeUndefined();
    expect(index.inferNodeTypeById("missing-id")).toBeUndefined();
  });

  it("uses deterministic cross-entity priority for ambiguous ids", () => {
    const base = baseState();
    const state = baseState({
      universes: [{ ...base.universes[0], id: "same-id" }],
      thoughts: [thought({ id: "same-id" })],
      projects: [project({ id: "same-id" })],
      relationships: [{ ...base.relationships[0], id: "same-id" }],
      aiInsights: [{ ...base.aiInsights[0], id: "same-id" }],
      blockingQuestions: [{ ...base.blockingQuestions![0], id: "same-id" }],
      decisionRecords: [{ ...base.decisionRecords![0], id: "same-id" }]
    });
    const index = buildDomainIndex(state);

    expect(domainNodeResolutionPriority).toEqual([
      "thought",
      "project",
      "universe",
      "relationship",
      "aiInsight",
      "blockingQuestion",
      "decisionRecord"
    ]);
    expect(index.resolveNode("same-id")).toMatchObject({ type: "thought" });
    expect(index.inferNodeTypeById("same-id")).toBe("thought");
  });

  it("keeps the first source-order entity for duplicate ids inside one collection", () => {
    const state = baseState({
      thoughts: [
        thought({ id: "duplicate-id", title: "First duplicate" }),
        thought({ id: "duplicate-id", title: "Second duplicate" })
      ]
    });

    expect(buildDomainIndex(state).thoughtById["duplicate-id"]).toMatchObject({
      title: "First duplicate"
    });
  });

  it("keeps relationship id lookup available without repairing orphan endpoints", () => {
    const orphan = {
      id: "r-orphan",
      sourceId: "t-index",
      targetId: "missing-project",
      type: "blocks" as const,
      description: "Do not repair this relationship."
    };
    const state = baseState({ relationships: [orphan] });
    const index = buildDomainIndex(state);

    expect(index.relationshipById["r-orphan"]).toEqual(orphan);
    expect(index.resolveNode("r-orphan")).toMatchObject({ type: "relationship" });
    expect(state.relationships).toEqual([orphan]);
  });

  it("does not repair direct-ref drift", () => {
    const driftedThought = thought({ id: "t-drift", universeId: "missing-universe" });
    const state = baseState({ thoughts: [driftedThought] });
    const index = buildDomainIndex(state);

    expect(index.thoughtById["t-drift"].universeId).toBe("missing-universe");
    expect(index.universeById["missing-universe"]).toBeUndefined();
    expect(state.thoughts[0].universeId).toBe("missing-universe");
  });

  it("does not mutate input state", () => {
    const state = baseState();
    const before = JSON.stringify(state);

    buildDomainIndex(state);

    expect(JSON.stringify(state)).toBe(before);
  });

  it("exposes a frozen lookup object without mutation methods", () => {
    const index = buildDomainIndex(baseState());

    expect(Object.isFrozen(index)).toBe(true);
    expect(Object.isFrozen(index.thoughtById)).toBe(true);
    expect("save" in index).toBe(false);
    expect("update" in index).toBe(false);
    expect("delete" in index).toBe(false);
    expect("set" in index.thoughtById).toBe(false);
  });
});
