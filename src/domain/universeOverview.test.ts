import { describe, expect, it } from "vitest";
import type { AppState, Project, ThoughtItem } from "./types";
import {
  buildUniversePackage,
  getUniverseOverview,
  listUniverseOverviews
} from "./universeOverview";

const timestamp = "2026-01-01T00:00:00.000Z";

function thought(patch: Partial<ThoughtItem> = {}): ThoughtItem {
  return {
    id: "t-1",
    title: "Universe thought",
    content: "Thought content",
    type: "note",
    status: "active",
    universeId: "u-1",
    why: "Because it matters.",
    outcome: "Clear outcome.",
    nextAction: "Do the thought step.",
    createdAt: timestamp,
    updatedAt: timestamp,
    ...patch
  };
}

function project(patch: Partial<Project> = {}): Project {
  return {
    id: "p-1",
    universeId: "u-1",
    status: "active",
    name: "Universe project",
    intent: "Project intent",
    users: ["Tester"],
    features: ["Overview"],
    screens: ["Universe Detail Center"],
    dataObjects: ["UniverseOverview"],
    flowSteps: ["Open center", "Review"],
    unknowns: [],
    nextAction: "Do the project step.",
    readiness: "ready_for_engineering",
    createdAt: timestamp,
    updatedAt: timestamp,
    ...patch
  };
}

function baseState(patch: Partial<AppState> = {}): AppState {
  return {
    universes: [
      {
        id: "u-1",
        name: "Universe One",
        description: "Primary universe",
        purpose: "",
        focus: "main"
      },
      {
        id: "u-2",
        name: "Universe Two",
        description: "Secondary universe",
        purpose: "",
        focus: "secondary"
      }
    ],
    thoughts: [
      thought(),
      thought({
        id: "t-archived",
        title: "Archived thought",
        status: "archived",
        nextAction: "Hidden archived thought action."
      }),
      thought({
        id: "t-other",
        title: "Other universe thought",
        universeId: "u-2",
        nextAction: "Other action."
      })
    ],
    projects: [
      project({ lifecycleStatus: "handoff_ready" }),
      project({
        id: "p-archived",
        name: "Archived project",
        status: "archived",
        nextAction: "Hidden archived project action."
      }),
      project({
        id: "p-other",
        name: "Other universe project",
        universeId: "u-2",
        nextAction: "Other project action."
      })
    ],
    relationships: [
      {
        id: "r-1",
        sourceId: "t-1",
        targetId: "p-1",
        type: "supports",
        description: "Thought supports project."
      }
    ],
    aiInsights: [],
    blockingQuestions: [
      {
        id: "bq-1",
        question: "What blocks Universe One?",
        status: "open",
        linkedUniverseIds: ["u-1"],
        proposedResolution: "Decide the blocker.",
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    decisionRecords: [
      {
        id: "decision-1",
        title: "Universe decision",
        decision: "Use this universe as the decision scope.",
        status: "accepted",
        linkedUniverseIds: ["u-1"],
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    ...patch
  };
}

function overview(state: AppState = baseState()) {
  const result = getUniverseOverview(state, "u-1");

  if (!result.ok) throw new Error(result.error);
  return result.overview;
}

describe("universe overview", () => {
  it("counts active and archived thoughts in the universe", () => {
    expect(overview().summary).toMatchObject({
      activeThoughts: 1,
      archivedThoughts: 1
    });
  });

  it("counts active and archived projects in the universe", () => {
    expect(overview().summary).toMatchObject({
      activeProjects: 1,
      archivedProjects: 1
    });
  });

  it("lists next actions only for the requested universe", () => {
    const actions = overview().nextActions;

    expect(actions.map((action) => action.title)).toEqual(
      expect.arrayContaining(["What blocks Universe One?", "Universe thought", "Universe project"])
    );
    expect(actions).toHaveLength(3);
    expect(actions.find((action) => action.title === "Other universe thought")).toBeUndefined();
  });

  it("includes blocking questions linked through linkedUniverseIds", () => {
    expect(overview().blockingQuestions.map((question) => question.id)).toEqual(["bq-1"]);
    expect(overview().summary.blockingQuestions).toBe(1);
  });

  it("includes decision records linked through linkedUniverseIds", () => {
    expect(overview().decisionRecords.map((decision) => decision.id)).toEqual(["decision-1"]);
  });

  it("counts thoughts that still need triage", () => {
    const state = baseState({
      thoughts: [
        thought({
          id: "t-needs-triage",
          status: "inbox",
          why: "",
          outcome: "",
          nextAction: ""
        }),
        thought({
          id: "t-ready-inbox",
          status: "inbox",
          nextAction: "Ready action."
        })
      ]
    });

    expect(overview(state).summary.needsTriage).toBe(1);
  });

  it("counts handoff-ready projects", () => {
    expect(overview().summary.handoffReadyProjects).toBe(1);
  });

  it("does not label archived universes as healthy", () => {
    const state = baseState({
      universes: [
        {
          id: "u-1",
          name: "Archived Universe",
          description: "",
          purpose: "",
          focus: "main",
          status: "archived"
        }
      ],
      blockingQuestions: []
    });

    expect(overview(state).health.label).not.toBe("healthy");
  });

  it("builds a universe package with generatedAt and required fields", () => {
    const pkg = buildUniversePackage(baseState(), "u-1");

    expect(pkg.kind).toBe("UniversePackage");
    expect(pkg.version).toBe("0.1");
    expect(pkg.universe.name).toBe("Universe One");
    expect(pkg.summary.activeThoughts).toBe(1);
    expect(pkg.thoughts).toHaveLength(2);
    expect(pkg.projects).toHaveLength(2);
    expect(pkg.relationships).toHaveLength(1);
    expect(pkg.blockingQuestions).toHaveLength(1);
    expect(pkg.decisionRecords).toHaveLength(1);
    expect(pkg.generatedAt).toBeTruthy();
  });

  it("returns a predictable error for a missing universe", () => {
    expect(getUniverseOverview(baseState(), "missing")).toEqual({
      ok: false,
      error: "Universe not found."
    });
  });

  it("does not mutate state while listing, reading, or packaging overviews", () => {
    const state = baseState();
    const original = JSON.stringify(state);

    getUniverseOverview(state, "u-1");
    listUniverseOverviews(state);
    buildUniversePackage(state, "u-1");

    expect(JSON.stringify(state)).toBe(original);
  });
});
