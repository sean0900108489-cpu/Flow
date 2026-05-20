import { describe, expect, it } from "vitest";
import type { Project, ThoughtItem, Universe } from "../domain/types";
import { generateProjectReadinessInsight, generateThoughtClassificationInsight } from "./aiMock";

const universe: Universe = {
  id: "u-1",
  name: "Test Universe",
  description: "",
  purpose: "",
  focus: "main"
};

const thought: ThoughtItem = {
  id: "t-1",
  title: "Build a planning app",
  content: "A system for turning ideas into projects.",
  type: "inspiration",
  status: "inbox",
  universeId: "u-1",
  why: "",
  outcome: "",
  nextAction: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

const project: Project = {
  id: "p-1",
  universeId: "u-1",
  status: "active",
  name: "Patch Project",
  intent: "Test project patches",
  users: ["Tester"],
  features: ["AI patch"],
  screens: ["AI"],
  dataObjects: ["AIInsight"],
  flowSteps: ["Generate", "Accept"],
  unknowns: [],
  nextAction: "",
  readiness: "draftable",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

describe("aiMock", () => {
  it("generates deterministic thought patch insight", () => {
    const first = generateThoughtClassificationInsight(thought, [universe]);
    const second = generateThoughtClassificationInsight(thought, [universe]);

    expect(first).toEqual(second);
    expect(first.patch?.operations[0]).toMatchObject({
      type: "updateThought",
      thoughtId: "t-1",
      patch: {
        type: "project",
        nextAction: "Define the first concrete engineering step.",
        why: "Clarify why this matters before execution.",
        outcome: "Define what success looks like."
      }
    });
  });

  it("generates deterministic project readiness patch", () => {
    const first = generateProjectReadinessInsight(project);
    const second = generateProjectReadinessInsight(project);

    expect(first).toEqual(second);
    expect(first.patch?.operations[0]).toMatchObject({
      type: "updateProject",
      projectId: "p-1",
      patch: {
        nextAction: "Write the first implementation task."
      }
    });
  });
});
