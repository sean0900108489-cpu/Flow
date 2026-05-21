import { describe, expect, it } from "vitest";
import type { AppState, ThoughtItem } from "./types";
import {
  listThoughtsForTriage,
  markThoughtTriaged,
  triageItem,
  updateThoughtTriage
} from "./thoughtTriage";

const baseThought: ThoughtItem = {
  id: "t-triage",
  title: "Triage candidate",
  content: "Needs better structure.",
  type: "note",
  status: "inbox",
  universeId: "",
  why: "",
  outcome: "",
  nextAction: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

function stateWithThought(thought: ThoughtItem): AppState {
  return {
    universes: [],
    thoughts: [thought],
    projects: [],
    relationships: [],
    aiInsights: []
  };
}

describe("thought triage", () => {
  it("scores missing triage fields", () => {
    const item = triageItem(baseThought);

    expect(item.stage).toBe("needs_universe");
    expect(item.score).toBe(0);
    expect(item.missingFields).toEqual(["universe", "why", "outcome", "nextAction"]);
  });

  it("lists only inbox thoughts for triage", () => {
    const activeThought = { ...baseThought, id: "t-active", status: "active" as const };
    const state = stateWithThought(baseThought);

    const result = listThoughtsForTriage({ ...state, thoughts: [baseThought, activeThought] });

    expect(result).toHaveLength(1);
    expect(result[0].thought.id).toBe("t-triage");
  });

  it("updates triage fields without changing storage shape", () => {
    const result = updateThoughtTriage(stateWithThought(baseThought), "t-triage", {
      type: "task",
      universeId: "u-main",
      why: "It matters.",
      outcome: "Clear next step.",
      nextAction: "Do the first step."
    });

    expect(result.ok).toBe(true);
    expect(result.state.thoughts[0]).toMatchObject({
      type: "task",
      universeId: "u-main",
      why: "It matters.",
      outcome: "Clear next step.",
      nextAction: "Do the first step."
    });
  });

  it("marks an inbox thought active when triage is complete", () => {
    const readyThought = {
      ...baseThought,
      universeId: "u-main",
      why: "It matters.",
      outcome: "A clear plan.",
      nextAction: "Start."
    };
    const result = markThoughtTriaged(stateWithThought(readyThought), "t-triage");

    expect(result.ok).toBe(true);
    expect(result.state.thoughts[0].status).toBe("active");
  });
});
