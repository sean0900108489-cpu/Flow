import { describe, expect, it } from "vitest";
import type { AIInsight, AppState } from "../domain/types";
import { applyAiInsightPatch } from "./applyAiPatch";

const baseState = (): AppState => ({
  universes: [
    {
      id: "u-1",
      name: "Test Universe",
      description: "",
      purpose: "",
      focus: "main"
    }
  ],
  thoughts: [
    {
      id: "t-1",
      title: "Original thought",
      content: "Build a project",
      type: "inspiration",
      status: "inbox",
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
      name: "Original project",
      intent: "Test project patching",
      users: ["Tester"],
      features: ["Patch"],
      screens: ["AI"],
      dataObjects: ["AIInsight"],
      flowSteps: ["Generate", "Accept"],
      unknowns: [],
      nextAction: "",
      readiness: "draftable",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    }
  ],
  relationships: [],
  aiInsights: []
});

const insight = (patch?: AIInsight["patch"]): AIInsight => ({
  id: "ai-1",
  targetId: "t-1",
  type: "classification",
  content: "Draft insight",
  status: "draft",
  createdAt: "2026-01-01T00:00:00.000Z",
  patch
});

describe("applyAiInsightPatch", () => {
  it("updates Thought nextAction", () => {
    const state = baseState();
    const next = applyAiInsightPatch(state, insight({
      targetType: "thought",
      targetId: "t-1",
      operations: [
        {
          type: "updateThought",
          thoughtId: "t-1",
          patch: { nextAction: "Define the first concrete engineering step." }
        }
      ]
    }));

    expect(next.thoughts[0].nextAction).toBe("Define the first concrete engineering step.");
  });

  it("does not update disallowed Thought fields", () => {
    const state = baseState();
    const next = applyAiInsightPatch(state, insight({
      targetType: "thought",
      targetId: "t-1",
      operations: [
        {
          type: "updateThought",
          thoughtId: "t-1",
          patch: {
            id: "hijacked",
            createdAt: "2030-01-01T00:00:00.000Z",
            nextAction: "Allowed change"
          }
        }
      ]
    }));

    expect(next.thoughts[0].id).toBe("t-1");
    expect(next.thoughts[0].createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(next.thoughts[0].nextAction).toBe("Allowed change");
  });

  it("keeps state safe when targetId is missing", () => {
    const state = baseState();
    const next = applyAiInsightPatch(state, insight({
      targetType: "thought",
      targetId: "missing",
      operations: [
        {
          type: "updateThought",
          thoughtId: "missing",
          patch: { nextAction: "Should not apply" }
        }
      ]
    }));

    expect(next).toBe(state);
  });

  it("does not modify state when insight has no patch", () => {
    const state = baseState();
    const next = applyAiInsightPatch(state, insight());

    expect(next).toBe(state);
  });
});
