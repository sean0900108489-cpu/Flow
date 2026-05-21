import { describe, expect, it } from "vitest";
import type { AppState } from "./types";
import {
  archiveUniverse,
  createUniverse,
  deleteUniverse,
  restoreUniverse,
  updateUniverse,
  universeInUseError
} from "./universeActions";

function baseState(): AppState {
  return {
    universes: [
      {
        id: "u-1",
        name: "Original Universe",
        description: "Original description",
        purpose: "Original purpose",
        focus: "main"
      },
      {
        id: "u-unused",
        name: "Unused Universe",
        description: "Can be deleted",
        purpose: "",
        focus: "secondary"
      }
    ],
    thoughts: [
      {
        id: "t-1",
        title: "Linked thought",
        content: "Uses universe",
        type: "note",
        status: "active",
        universeId: "u-1",
        why: "",
        outcome: "",
        nextAction: "",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      }
    ],
    projects: [
      {
        id: "p-1",
        universeId: "u-1",
        status: "active",
        name: "Linked project",
        intent: "Uses universe",
        users: [],
        features: [],
        screens: [],
        dataObjects: [],
        flowSteps: [],
        unknowns: [],
        nextAction: "",
        readiness: "not_ready",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      }
    ],
    relationships: [],
    aiInsights: []
  };
}

describe("universe actions", () => {
  it("createUniverse creates an active universe", () => {
    const result = createUniverse(baseState(), {
      name: "  New Universe  ",
      description: "  New description  "
    });

    expect(result.ok).toBe(true);
    expect(result.state.universes[0]).toMatchObject({
      name: "New Universe",
      description: "New description",
      status: "active"
    });
  });

  it("createUniverse rejects an empty name", () => {
    const state = baseState();
    const result = createUniverse(state, { name: "   " });

    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
    expect(result.error).toContain("name");
  });

  it("updateUniverse updates name and description", () => {
    const result = updateUniverse(baseState(), "u-1", {
      name: "Updated Universe",
      description: "Updated description"
    });

    expect(result.ok).toBe(true);
    expect(result.state.universes.find((universe) => universe.id === "u-1")).toMatchObject({
      name: "Updated Universe",
      description: "Updated description",
      purpose: "Original purpose",
      focus: "main"
    });
  });

  it("archiveUniverse does not delete linked thoughts", () => {
    const result = archiveUniverse(baseState(), "u-1");

    expect(result.ok).toBe(true);
    expect(result.state.universes.find((universe) => universe.id === "u-1")?.status).toBe("archived");
    expect(result.state.thoughts.find((thought) => thought.id === "t-1")?.universeId).toBe("u-1");
  });

  it("restoreUniverse changes status back to active", () => {
    const archived = archiveUniverse(baseState(), "u-1").state;
    const result = restoreUniverse(archived, "u-1");

    expect(result.ok).toBe(true);
    expect(result.state.universes.find((universe) => universe.id === "u-1")?.status).toBe("active");
  });

  it("deleteUniverse detach deletes the universe and clears linked items", () => {
    const result = deleteUniverse(baseState(), "u-1", "detach");

    expect(result.ok).toBe(true);
    expect(result.state.universes.some((universe) => universe.id === "u-1")).toBe(false);
    expect(result.state.thoughts[0].universeId).toBe("");
    expect(result.state.projects[0].universeId).toBe("");
  });

  it("deleteUniverse blockIfInUse stops deletion for linked universes", () => {
    const result = deleteUniverse(baseState(), "u-1", "blockIfInUse");

    expect(result.ok).toBe(false);
    expect(result.error).toBe(universeInUseError);
    expect(result.state.universes.some((universe) => universe.id === "u-1")).toBe(true);
  });

  it("actions do not mutate the original state", () => {
    const state = baseState();
    const original = structuredClone(state);

    createUniverse(state, { name: "Another Universe" });
    updateUniverse(state, "u-1", { name: "Updated" });
    archiveUniverse(state, "u-1");
    restoreUniverse({ ...state, universes: state.universes.map((universe) => ({ ...universe, status: "archived" })) }, "u-1");
    deleteUniverse(state, "u-1", "detach");

    expect(state).toEqual(original);
  });
});
