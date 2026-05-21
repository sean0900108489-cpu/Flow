import { describe, expect, it } from "vitest";
import {
  buildGlobalSearchIndex,
  getGlobalSearchResultCounts,
  searchGlobal
} from "./globalSearch";
import type { AppState, Project, ThoughtItem } from "./types";

const timestamp = "2026-01-01T00:00:00.000Z";

const thought = (patch: Partial<ThoughtItem> = {}): ThoughtItem => ({
  id: "t-alpha",
  title: "Alpha thought",
  content: "Alpha thought content",
  type: "note",
  status: "active",
  universeId: "u-alpha",
  why: "Because alpha matters",
  outcome: "A searchable thought",
  nextAction: "Review alpha thought",
  createdAt: timestamp,
  updatedAt: timestamp,
  ...patch
});

const project = (patch: Partial<Project> = {}): Project => ({
  id: "p-alpha",
  universeId: "u-alpha",
  status: "active",
  lifecycleStatus: "planning",
  name: "Alpha project",
  intent: "Project description with searchable alpha scope",
  users: ["Tester"],
  features: ["Global search"],
  screens: ["Global Search Center"],
  dataObjects: ["Project"],
  flowSteps: ["Search", "Open"],
  unknowns: [],
  nextAction: "Review alpha project",
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
        description: "A searchable universe",
        purpose: "Test global search",
        focus: "main"
      },
      {
        id: "u-beta",
        name: "Beta Universe",
        description: "A separate universe",
        purpose: "Test universe filters",
        focus: "secondary"
      }
    ],
    thoughts: [
      thought(),
      thought({ id: "t-beta", title: "Beta thought", universeId: "u-beta", nextAction: "Review beta thought" })
    ],
    projects: [project()],
    relationships: [
      {
        id: "r-alpha",
        sourceId: "t-alpha",
        targetId: "p-alpha",
        sourceType: "thought",
        targetType: "project",
        type: "supports",
        description: "Alpha thought supports alpha project"
      }
    ],
    aiInsights: [],
    blockingQuestions: [
      {
        id: "bq-alpha",
        question: "What blocks alpha?",
        context: "A blocker visible to search",
        proposedResolution: "Resolve alpha blocker",
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
        decision: "Use deterministic global search.",
        rationale: "Search should be predictable.",
        consequences: "Users can open records quickly.",
        status: "accepted",
        linkedUniverseIds: ["u-alpha"],
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    ...patch
  };
}

describe("global search", () => {
  it("buildGlobalSearchIndex includes thought", () => {
    expect(buildGlobalSearchIndex(baseState())).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "thought", title: "Alpha thought" })
    ]));
  });

  it("buildGlobalSearchIndex includes project", () => {
    expect(buildGlobalSearchIndex(baseState())).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "project", title: "Alpha project" })
    ]));
  });

  it("buildGlobalSearchIndex includes universe", () => {
    expect(buildGlobalSearchIndex(baseState())).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "universe", title: "Alpha Universe" })
    ]));
  });

  it("buildGlobalSearchIndex does not crash without blockingQuestions or decisionRecords", () => {
    const results = buildGlobalSearchIndex(baseState({ blockingQuestions: undefined, decisionRecords: undefined }));

    expect(results.map((result) => result.title)).toContain("Alpha thought");
  });

  it("buildGlobalSearchIndex includes command results", () => {
    expect(buildGlobalSearchIndex(baseState())).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "command", title: "Open Next Action Center" })
    ]));
  });

  it("searchGlobal can search thought title", () => {
    const results = searchGlobal(baseState(), { searchText: "Alpha thought" });

    expect(results[0]).toMatchObject({ type: "thought", title: "Alpha thought" });
  });

  it("searchGlobal can search project description", () => {
    const results = searchGlobal(baseState(), { searchText: "searchable alpha scope" });

    expect(results).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "project", title: "Alpha project" })
    ]));
  });

  it("searchGlobal is case-insensitive", () => {
    const results = searchGlobal(baseState(), { searchText: "ALPHA THOUGHT" });

    expect(results[0]).toMatchObject({ type: "thought", title: "Alpha thought" });
  });

  it("type filter works", () => {
    const results = searchGlobal(baseState(), { type: "project" });

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((result) => result.type === "project")).toBe(true);
  });

  it("universe filter works", () => {
    const results = searchGlobal(baseState(), { universeId: "u-beta" });

    expect(results).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "thought", title: "Beta thought" })
    ]));
    expect(results.find((result) => result.title === "Alpha project")).toBeUndefined();
  });

  it("status filter works", () => {
    const results = searchGlobal(baseState(), { status: "accepted" });

    expect(results).toEqual([
      expect.objectContaining({ type: "decision_record", title: "Alpha decision", status: "accepted" })
    ]);
  });

  it("command search can find Open Next Action Center", () => {
    const results = searchGlobal(baseState(), { searchText: "Open Next Action Center" });

    expect(results[0]).toMatchObject({
      type: "command",
      title: "Open Next Action Center",
      targetId: "next-actions"
    });
  });

  it("results have deterministic sort order", () => {
    const first = searchGlobal(baseState(), { searchText: "alpha" }).map((result) => result.id);
    const second = searchGlobal(baseState(), { searchText: "alpha" }).map((result) => result.id);

    expect(first).toEqual(second);
  });

  it("functions do not mutate original state", () => {
    const state = baseState();
    const before = JSON.stringify(state);

    buildGlobalSearchIndex(state);
    searchGlobal(state, { searchText: "alpha", type: "thought", universeId: "u-alpha", status: "active" });
    getGlobalSearchResultCounts(buildGlobalSearchIndex(state));

    expect(JSON.stringify(state)).toBe(before);
  });
});
